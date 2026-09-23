<template>
  <div class="panel">
    <h4>📐 ROI感兴趣区域分析</h4>

    <div class="tool-row">
      <span class="tool-label">在影像上绘制：</span>
      <el-button-group>
        <el-button size="small" :type="store.activeTool==='rect'?'primary':''" @click="toggleTool('rect')">▭ 矩形</el-button>
        <el-button size="small" :type="store.activeTool==='ellipse'?'primary':''" @click="toggleTool('ellipse')">◯ 椭圆</el-button>
        <el-button size="small" :type="store.activeTool==='polygon'?'primary':''" @click="toggleTool('polygon')">⬠ 多边形</el-button>
      </el-button-group>
      <el-button size="small" @click="addSphere">+ 球体</el-button>
    </div>

    <div v-if="store.activeTool" class="draw-hint">
      <template v-if="store.activeTool==='polygon'">
        在任意切面影像上单击添加顶点，<b>双击或按回车</b>闭合多边形；右键/Esc 取消
      </template>
      <template v-else>
        在任意切面影像上<b>按住左键拖拽</b>绘制{{ store.activeTool==='rect' ? '矩形' : '椭圆' }}；右键/Esc 取消
      </template>
    </div>

    <div v-if="!rois.length" class="empty-block">
      <el-empty description="暂无标记：点击上方工具在任意切面影像上直接绘制，或点“+ 球体”按坐标添加" :image-size="60"/>
    </div>

    <div v-for="(roi, i) in rois" :key="roi.id" class="roi-config" :class="statusClass(roi.id)">
      <div class="roi-row">
        <span class="badge" :style="{ background: roiColor(i) }">{{ i + 1 }}</span>
        <el-input v-model="roi.label" size="small" placeholder="标签" style="width:86px"/>
        <span class="shape-tag">{{ shapeName(roi.shape) }}</span>
        <el-button size="small" type="danger" @click="store.removeROI(roi.id)" circle>×</el-button>
      </div>

      <div class="roi-row coords">
        <span class="coord-label">中心 x/y/z</span>
        <el-input-number v-model="roi.center[0]" size="small" :step="1" style="width:62px" controls-position="right" @change="store.syncPlaneSlice(roi)"/>
        <el-input-number v-model="roi.center[1]" size="small" :step="1" style="width:62px" controls-position="right" @change="store.syncPlaneSlice(roi)"/>
        <el-input-number v-model="roi.center[2]" size="small" :step="1" style="width:62px" controls-position="right" @change="store.syncPlaneSlice(roi)"/>
      </div>

      <div v-if="roi.shape==='sphere'" class="roi-row coords">
        <span class="coord-label">半径</span>
        <el-input-number v-model="roi.radius" size="small" :min="1" :step="1" style="width:90px" controls-position="right"/>
      </div>
      <template v-else>
        <div v-if="roi.shape==='ellipse'" class="roi-row coords">
          <span class="coord-label">半轴 a/b</span>
          <el-input-number v-model="roi.radii![0]" size="small" :min="0.1" :step="0.5" style="width:62px" controls-position="right"/>
          <el-input-number v-model="roi.radii![1]" size="small" :min="0.1" :step="0.5" style="width:62px" controls-position="right"/>
        </div>
        <div v-else-if="roi.shape==='rect'" class="roi-row coords">
          <span class="coord-label">半宽/半高</span>
          <el-input-number v-model="roi.size![0]" size="small" :min="0.1" :step="0.5" style="width:62px" controls-position="right"/>
          <el-input-number v-model="roi.size![1]" size="small" :min="0.1" :step="0.5" style="width:62px" controls-position="right"/>
        </div>
        <div v-else class="roi-row coords">
          <span class="coord-label">顶点</span>
          <span class="coord-hint">{{ roi.points?.length ?? 0 }} 个（{{ planeName(roi.plane!) }}）</span>
        </div>
        <div class="roi-row coords">
          <span class="coord-label">所在切片</span>
          <el-input-number
            :model-value="roi.sliceIndex" size="small" :step="1" style="width:90px" controls-position="right"
            @update:model-value="setSlice(roi, Number($event))"
          />
          <el-button size="small" @click="gotoSlice(roi)">跳转</el-button>
        </div>
      </template>

      <div v-if="result(roi.id)" class="status-line" :class="result(roi.id)!.status">
        <template v-if="result(roi.id)!.status==='error'">✕ {{ result(roi.id)!.message }}</template>
        <template v-else-if="result(roi.id)!.status==='empty'">∅ 未测到体素：{{ result(roi.id)!.message }}</template>
        <template v-else-if="result(roi.id)!.clipped">⚠ {{ result(roi.id)!.message }}</template>
        <template v-else>✓ 测量完成（{{ result(roi.id)!.voxelCount }} 体素）</template>
      </div>
    </div>

    <el-button
      type="success" size="small"
      @click="store.analyzeROI()"
      :loading="store.analyzing"
      :disabled="!rois.length"
      style="margin-top:8px"
    >📊 重新分析ROI</el-button>

    <div class="results">
      <template v-for="(row, i) in rows" :key="row.roi.id">
        <div v-if="row.r && row.r.status==='ok'" class="roi-result" :class="{ clipped: row.r.clipped }">
          <div class="r-label">
            <i class="dot" :style="{ background: roiColor(i) }"></i>{{ row.r.label }}
            <span class="r-shape">{{ shapeName(row.r.shape) }}</span>
          </div>
          <div class="r-stats">
            <div class="stat"><span>均值</span><b>{{ fmt(row.r.mean) }}</b> HU</div>
            <div class="stat"><span>标准差</span><b>{{ fmt(row.r.std) }}</b></div>
            <div class="stat"><span>范围</span><b>{{ fmt(row.r.min) }}~{{ fmt(row.r.max) }}</b></div>
            <div class="stat"><span>体素</span><b>{{ row.r.voxelCount }}</b></div>
          </div>
          <div class="mini-hist">
            <i v-for="(b, bi) in row.r.histogram" :key="bi" :style="{ height: histBar(b, row.r.histogram!) + '%' }"></i>
          </div>
        </div>
        <div v-else-if="row.r" class="result-empty">
          <i class="dot" :style="{ background: roiColor(i) }"></i>
          <span>{{ row.roi.label }}：<b :class="row.r.status">{{ row.r.status==='error' ? '分析失败' : '无测量结果' }}</b>（{{ row.r.message }}）</span>
        </div>
      </template>
      <div v-if="store.analyzing && !store.roiResults.length" class="result-empty">正在分析…</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useImagingStore } from '../store/imaging'
import { roiColor, defaultLabel, genId } from '../utils/roi'
import type { ROIResult, ROIPlane, ROIDef } from '../types'

const store = useImagingStore()
const rois = store.rois // 直接使用 store 中的持久化标记

// 首次使用（无任何已保存标记）时播种一个默认球体，保持原有开箱体验
if (!rois.length) {
  rois.push({ id: genId(), label: 'lesion1', shape: 'sphere', center: [30, 28, 32], radius: 6 })
}

const rows = computed(() =>
  rois.map((roi) => ({ roi, r: store.resultOf(roi.id) })))

const shapeNames: Record<string, string> = {
  sphere: '球体', ellipse: '椭圆', rect: '矩形', polygon: '多边形',
}
function shapeName(s: string) { return shapeNames[s] || s }
const planeNames: Record<ROIPlane, string> = { axial: '横断面', coronal: '冠状面', sagittal: '矢状面' }
function planeName(p: ROIPlane) { return planeNames[p] }

function result(id: string): ROIResult | undefined { return store.resultOf(id) }
function fmt(v?: number) { return v === undefined || v === null ? '—' : v }

function statusClass(id: string) {
  const s = store.resultOf(id)?.status
  return s === 'error' ? 'st-error' : s === 'empty' ? 'st-empty' : ''
}

function histBar(v: number, hist: number[]) {
  const max = Math.max(1, ...hist)
  return Math.max(6, Math.round((v / max) * 100))
}

function toggleTool(tool: 'rect' | 'ellipse' | 'polygon') {
  store.setTool(store.activeTool === tool ? '' : tool)
}

function addSphere() {
  store.setTool('')
  store.addROI({
    shape: 'sphere',
    label: defaultLabel('sphere', store.rois.length),
    center: [30, 28, store.mprSlice.axial],
    radius: 6,
  })
}

/** 修改二维标记所在切片时，同步中心的固定轴坐标，保证与后端口径一致 */
function setSlice(roi: ROIDef, s: number) {
  if (!roi.plane || Number.isNaN(s)) return
  store.syncPlaneSlice(roi, s)
}

/** 把对应切面滑块跳到标记所在切片，方便在影像上定位 */
function gotoSlice(roi: ROIDef) {
  if (roi.plane && roi.sliceIndex !== undefined) store.mprSlice[roi.plane] = roi.sliceIndex
}

// 标记增删改后自动重新分析（防抖），保证越界/无效标记立刻得到原因说明
let timer: number | undefined
watch(() => [store.rois, store.volumeData], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => { store.analyzeROI() }, 300)
}, { deep: true })

onMounted(() => { if (store.volumeData && store.rois.length) store.analyzeROI() })
onBeforeUnmount(() => window.clearTimeout(timer))
</script>

<style scoped>
.panel { background:#161b22; border-radius:6px; padding:10px; border:1px solid #30363d }
.panel h4 { color:#58a6ff; font-size:12px; margin-bottom:8px }
.tool-row { display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-bottom:6px }
.tool-label { font-size:11px; color:#8b949e }
.draw-hint { font-size:11px; color:#ffd93d; background:rgba(255,217,61,.08); border:1px solid rgba(255,217,61,.25);
  border-radius:4px; padding:5px 8px; margin-bottom:8px; line-height:1.5 }
.empty-block { margin:6px 0; }
.roi-config { border:1px solid #30363d; border-radius:5px; padding:5px 7px; margin-bottom:6px; background:#0d1117 }
.roi-config.st-error { border-color:#ff4d4f66 }
.roi-config.st-empty { border-color:#faad1466 }
.roi-row { display:flex; gap:4px; align-items:center; padding:2px 0; font-size:11px; flex-wrap:wrap }
.badge { display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px;
  border-radius:50%; color:#0d1117; font-size:10px; font-weight:700; flex:none }
.shape-tag { color:#8b949e; font-size:10px }
.coords .coord-label { color:#8b949e; width:64px; flex:none }
.coord-hint { color:#8b949e; font-size:10px }
.status-line { font-size:10px; margin-top:2px; line-height:1.4 }
.status-line.error { color:#ff7875 }
.status-line.empty { color:#ffc53d }
.status-line.ok { color:#73d13d }
.results { margin-top:10px; display:flex; flex-direction:column; gap:6px }
.r-label { font-size:12px; color:#e6edf3; font-weight:600; margin-bottom:4px; display:flex; align-items:center; gap:5px }
.r-shape { font-weight:400; font-size:10px; color:#8b949e; border:1px solid #30363d; border-radius:3px; padding:0 4px }
.dot { display:inline-block; width:8px; height:8px; border-radius:50%; flex:none }
.r-stats { display:grid; grid-template-columns:1fr 1fr; gap:4px }
.stat { font-size:10px; color:#8b949e; padding:3px 4px; background:#0d1117; border-radius:3px }
.stat b { color:#e6edf3; margin-left:4px }
.mini-hist { display:flex; align-items:flex-end; gap:1px; width:100%; height:36px; margin-top:4px;
  background:#0d1117; border-radius:3px; padding:3px }
.mini-hist i { flex:1; background:linear-gradient(#58a6ff,#1f6feb); border-radius:1px 1px 0 0; min-height:2px }
.roi-result { background:#161b22; border:1px solid #30363d; border-radius:5px; padding:6px 8px }
.roi-result.clipped { border-color:#58a6ff66 }
.result-empty { font-size:11px; color:#8b949e; display:flex; gap:6px; align-items:flex-start; padding:5px 7px;
  background:#161b22; border:1px dashed #30363d; border-radius:5px }
.result-empty b.error { color:#ff7875 }
.result-empty b.empty { color:#ffc53d }
:deep(.el-empty__description p) { font-size:11px; color:#8b949e; }
</style>
