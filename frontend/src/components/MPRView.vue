<template>
  <div class="mpr-wrap">
    <canvas
      ref="cvs" width="256" height="256" class="mpr-canvas"
      :class="{ drawing: !!store.activeTool }"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @click="onClick"
      @dblclick="onDblClick"
      @contextmenu.prevent="cancelDraft"
    ></canvas>
    <div class="slice-bar">
      <span class="slice-tag">{{ sliceName }} #{{ slice }}</span>
      <input type="range" class="slider" :min="0" :max="maxSlice" v-model.number="slice"/>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { useImagingStore } from '../store/imaging'
import { roiColor, xyzToUV, uvToXYZ, planeAxis, polyInfo, defaultLabel } from '../utils/roi'
import type { ROIPlane, ROIDef } from '../types'

const props = defineProps<{ plane: ROIPlane }>()
const store = useImagingStore()
const cvs = ref<HTMLCanvasElement>()

const planeNames: Record<ROIPlane, string> = { axial: '横断面', coronal: '冠状面', sagittal: '矢状面' }
const sliceName = planeNames[props.plane]

const slice = computed({
  get: () => store.mprSlice[props.plane],
  set: (v: number) => { store.mprSlice[props.plane] = v },
})

const dims = computed<[number, number, number]>(() =>
  store.volumeData?.dimensions ?? [64, 64, 64])

// 该切面的切片上限：axial 沿 z(d)，coronal 沿 y(h)，sagittal 沿 x(w)
const maxSlice = computed(() => {
  const [d, h, w] = dims.value
  return props.plane === 'axial' ? d - 1 : props.plane === 'coronal' ? h - 1 : w - 1
})

/** 从全量体数据取当前切片；返回二维数组（行 v，列 u） */
function getSliceData(): number[][] | null {
  const vd = store.volumeData
  if (!vd) return null
  const s = Math.min(Math.max(Math.round(slice.value), 0), maxSlice.value)
  const vol = vd.volume
  if (props.plane === 'axial') return vol[s]
  const [d, h, w] = dims.value
  const out: number[][] = []
  if (props.plane === 'coronal') {
    for (let z = 0; z < d; z++) out.push(vol[z][s])
  } else {
    for (let z = 0; z < d; z++) {
      const row: number[] = []
      for (let y = 0; y < h; y++) row.push(vol[z][y][s])
      out.push(row)
    }
  }
  return out
}

function draw() {
  const c = cvs.value
  if (!c) return
  const ctx = c.getContext('2d')!
  const W = c.width, H = c.height
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, W, H)

  const sliceData = getSliceData()
  if (!sliceData || !sliceData.length) return

  // —— 1. 影像像素（沿用原有窗值口径）——
  const wl = store.windowVal, ww = store.levelVal
  const lower = wl - ww / 2, upper = wl + ww / 2
  const rows = sliceData.length, cols = sliceData[0].length
  const cellW = W / cols, cellH = H / rows

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const val = sliceData[y][x]
      let t = (val - lower) / (upper - lower)
      t = Math.max(0, Math.min(1, t))
      const gray = Math.floor(t * 255)
      ctx.fillStyle = `rgb(${gray},${gray},${gray})`
      ctx.fillRect(x * cellW, y * cellH, cellW + 0.5, cellH + 0.5)
    }
  }

  // —— 2. ROI 标记叠加层 ——
  store.rois.forEach((roi, i) => drawROI(ctx, roi, i, cellW, cellH))
  drawDraft(ctx, cellW, cellH)
}

function statusOf(roi: ROIDef) {
  return store.resultOf(roi.id)?.status ?? 'ok'
}

function drawROI(
  ctx: CanvasRenderingContext2D, roi: ROIDef, index: number,
  cellW: number, cellH: number,
) {
  const [cu, cv] = xyzToUV(props.plane, roi.center[0], roi.center[1], roi.center[2])
  const onPlane = roi.shape !== 'sphere' && roi.plane === props.plane &&
    Math.round(roi.sliceIndex ?? -1) === Math.round(slice.value)
  let color = roiColor(index)
  const status = statusOf(roi)
  const bad = status === 'empty' || status === 'error'
  if (bad) color = status === 'error' ? '#ff4d4f' : '#faad14'

  ctx.lineWidth = 1.5
  ctx.strokeStyle = color
  ctx.fillStyle = color

  if (roi.shape === 'sphere') {
    // 球体在平行平面上的截面是圆
    const r = roi.radius ?? 0
    const axis = roi.center[planeAxis(props.plane)]
    const dc = slice.value - axis
    if (Math.abs(dc) <= r) {
      const pr = Math.sqrt(Math.max(0, r * r - dc * dc))
      ctx.beginPath()
      ctx.ellipse(cu * cellW, cv * cellH, pr * cellW, pr * cellH, 0, 0, Math.PI * 2)
      ctx.stroke()
      drawCross(ctx, cu, cv, cellW, cellH, color)
      drawTag(ctx, `#${index + 1} ${roi.label}`, cu, cv - r, cellW, cellH, color)
    } else {
      drawCross(ctx, cu, cv, cellW, cellH, color, 3)
    }
    if (bad) drawWarn(ctx, cu, cv, cellW, cellH, status)
    return
  }

  // 二维形状：只在所属切面的对应切片上画实体形状，其他切面/切片画定位十字
  if (onPlane) {
    if (roi.shape === 'rect' && roi.size) {
      const [su, sv] = roi.size
      ctx.strokeRect((cu - su) * cellW, (cv - sv) * cellH, 2 * su * cellW, 2 * sv * cellH)
    } else if (roi.shape === 'ellipse' && roi.radii) {
      const [ru, rv] = roi.radii
      ctx.beginPath()
      ctx.ellipse(cu * cellW, cv * cellH, ru * cellW, rv * cellH, 0, 0, Math.PI * 2)
      ctx.stroke()
    } else if (roi.shape === 'polygon' && roi.points && roi.points.length >= 2) {
      ctx.beginPath()
      roi.points.forEach(([u, v], k) => k ? ctx.lineTo(u * cellW, v * cellH) : ctx.moveTo(u * cellW, v * cellH))
      ctx.closePath()
      ctx.stroke()
      // 顶点
      roi.points.forEach(([u, v]) => {
        ctx.beginPath(); ctx.arc(u * cellW, v * cellH, 1.6, 0, Math.PI * 2); ctx.fill()
      })
    }
    drawCross(ctx, cu, cv, cellW, cellH, color)
    drawTag(ctx, `#${index + 1} ${roi.label}`, cu, cv, cellW, cellH, color)
    if (bad) drawWarn(ctx, cu, cv, cellW, cellH, status)
  } else {
    drawCross(ctx, cu, cv, cellW, cellH, color, 3)
  }
}

function drawCross(
  ctx: CanvasRenderingContext2D, u: number, v: number,
  cellW: number, cellH: number, color: string, len = 2,
) {
  const x = u * cellW, y = v * cellH
  ctx.save()
  ctx.strokeStyle = color
  ctx.beginPath()
  ctx.moveTo(x - len * cellW, y); ctx.lineTo(x + len * cellW, y)
  ctx.moveTo(x, y - len * cellH); ctx.lineTo(x, y + len * cellH)
  ctx.stroke()
  ctx.restore()
}

function drawTag(
  ctx: CanvasRenderingContext2D, text: string, u: number, v: number,
  cellW: number, cellH: number, color: string,
) {
  ctx.save()
  ctx.font = '10px system-ui, sans-serif'
  const w = ctx.measureText(text).width + 6
  const x = Math.min(Math.max(u * cellW - w / 2, 0), (cvs.value!.width - w))
  const y = Math.max(v * cellH - 14, 1)
  ctx.fillStyle = 'rgba(13,17,23,0.75)'
  ctx.fillRect(x, y, w, 12)
  ctx.fillStyle = color
  ctx.fillText(text, x + 3, y + 9)
  ctx.restore()
}

function drawWarn(
  ctx: CanvasRenderingContext2D, u: number, v: number,
  cellW: number, cellH: number, kind: string,
) {
  ctx.save()
  ctx.font = 'bold 11px system-ui, sans-serif'
  ctx.fillStyle = kind === 'error' ? '#ff4d4f' : '#faad14'
  ctx.fillText(kind === 'error' ? '✕' : '∅', u * cellW + 4, v * cellH - 3)
  ctx.restore()
}

/** 正在绘制的临时图形（虚线预览） */
function drawDraft(ctx: CanvasRenderingContext2D, cellW: number, cellH: number) {
  const d = store.draft
  if (!d || d.plane !== props.plane) return
  ctx.save()
  ctx.strokeStyle = '#ffd93d'
  ctx.fillStyle = '#ffd93d'
  ctx.setLineDash([4, 3])
  ctx.lineWidth = 1.5

  if ((d.kind === 'rect' || d.kind === 'ellipse') && d.points.length === 1 && d.current) {
    const [u0, v0] = d.points[0]
    const [u1, v1] = d.current
    const x = Math.min(u0, u1) * cellW, y = Math.min(v0, v1) * cellH
    const w = Math.abs(u1 - u0) * cellW, h = Math.abs(v1 - v0) * cellH
    if (d.kind === 'rect') ctx.strokeRect(x, y, w, h)
    else {
      ctx.beginPath()
      ctx.ellipse((u0 + u1) / 2 * cellW, (v0 + v1) / 2 * cellH, w / 2, h / 2, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else if (d.kind === 'polygon') {
    const pts = d.current ? [...d.points, d.current] : d.points
    ctx.beginPath()
    pts.forEach(([u, v], k) => k ? ctx.lineTo(u * cellW, v * cellH) : ctx.moveTo(u * cellW, v * cellH))
    ctx.stroke()
    d.points.forEach(([u, v]) => {
      ctx.beginPath(); ctx.arc(u * cellW, v * cellH, 2, 0, Math.PI * 2); ctx.fill()
    })
  }
  ctx.restore()
}

// —— 鼠标绘制交互 ——
function eventUV(e: MouseEvent): [number, number] {
  const c = cvs.value!
  const rect = c.getBoundingClientRect()
  const sliceData = getSliceData()
  const rows = sliceData?.length ?? 64
  const cols = sliceData?.[0]?.length ?? 64
  const u = ((e.clientX - rect.left) / rect.width) * cols
  const v = ((e.clientY - rect.top) / rect.height) * rows
  return [Math.max(0, Math.min(cols - 1, u)), Math.max(0, Math.min(rows - 1, v))]
}

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0 || !store.activeTool) return
  const kind = store.activeTool
  if (kind === 'polygon') return // 多边形用 click 加点
  const [u, v] = eventUV(e)
  store.draft = { plane: props.plane, kind, points: [[u, v]], current: [u, v] }
}

function onMouseMove(e: MouseEvent) {
  const d = store.draft
  if (!d || d.plane !== props.plane) return
  d.current = eventUV(e)
}

function onClick(e: MouseEvent) {
  if (store.activeTool !== 'polygon') return
  const [u, v] = eventUV(e)
  const d = store.draft
  if (!d || d.plane !== props.plane) {
    store.draft = { plane: props.plane, kind: 'polygon', points: [[u, v]], current: [u, v] }
    return
  }
  const last = d.points[d.points.length - 1]
  if (last && Math.hypot(last[0] - u, last[1] - v) < 0.6) return // 双击产生的重复点
  d.points.push([u, v])
  d.current = [u, v]
}

function onDblClick() {
  if (store.activeTool !== 'polygon') return
  const d = store.draft
  if (d && d.plane === props.plane && d.points.length >= 3) {
    commitPolygon(d.points)
  }
}

function onMouseUp(e: MouseEvent) {
  if (e.button !== 0) return
  const d = store.draft
  if (!d || d.plane !== props.plane) return
  if (d.kind === 'rect' || d.kind === 'ellipse') {
    let committed = false
    if (d.current) {
      const [u0, v0] = d.points[0]
      const [u1, v1] = d.current
      const du = Math.abs(u1 - u0), dv = Math.abs(v1 - v0)
      if (du >= 1.5 && dv >= 1.5) {
        commitBox(d.kind, u0, v0, u1, v1)
        committed = true
      }
    }
    // 成功创建后退出工具；误触（太小）则清除草稿并保持工具，可继续画
    store.draft = null
    if (committed) store.setTool('')
  }
}

function commitBox(kind: 'rect' | 'ellipse', u0: number, v0: number, u1: number, v1: number) {
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2
  const hu = Math.abs(u1 - u0) / 2, hv = Math.abs(v1 - v0) / 2
  const [x, y, z] = uvToXYZ(props.plane, cu, cv, slice.value)
  const n = store.rois.length
  store.addROI(kind === 'rect'
    ? { shape: 'rect', label: defaultLabel('rect', n), center: [x, y, z], size: [hu, hv], plane: props.plane, sliceIndex: Math.round(slice.value) }
    : { shape: 'ellipse', label: defaultLabel('ellipse', n), center: [x, y, z], radii: [hu, hv], plane: props.plane, sliceIndex: Math.round(slice.value) })
}

function commitPolygon(points: [number, number][]) {
  const { cu, cv } = polyInfo(points)
  const [x, y, z] = uvToXYZ(props.plane, cu, cv, slice.value)
  const n = store.rois.length
  store.addROI({
    shape: 'polygon', label: defaultLabel('polygon', n),
    center: [x, y, z], points, plane: props.plane,
    sliceIndex: Math.round(slice.value),
  })
  store.setTool('')
}

function cancelDraft() {
  if (store.draft?.plane === props.plane) store.setTool('')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && store.draft?.plane === props.plane) store.setTool('')
  if (e.key === 'Enter' && store.activeTool === 'polygon' && store.draft?.plane === props.plane && store.draft.points.length >= 3) {
    commitPolygon(store.draft.points)
  }
}

watch(() => store.volumeData, draw, { deep: true })
watch(() => [store.windowVal, store.levelVal], draw)
watch(() => store.mprSlice[props.plane], draw)
watch(() => store.rois, draw, { deep: true })
watch(() => store.roiResults, draw, { deep: true })
watch(() => store.draft, draw, { deep: true })

onMounted(() => {
  draw()
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.mpr-wrap { display: flex; flex-direction: column; }
.mpr-canvas { display: block; width: 100%; aspect-ratio: 1; border-radius: 4px; }
.mpr-canvas.drawing { cursor: crosshair; }
.slice-bar { display: flex; align-items: center; gap: 6px; padding: 2px 6px 4px; }
.slice-tag { font-size: 9px; color: #8b949e; font-family: monospace; white-space: nowrap; }
.slider { flex: 1; accent-color: #58a6ff; height: 4px; }
</style>
