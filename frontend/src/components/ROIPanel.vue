<template>
  <div class="panel">
    <h4>📐 ROI感兴趣区域标注</h4>

    <div class="toolbar">
      <el-button size="small" @click="addSphere">+ 球体</el-button>
      <span class="tb-sep">在影像上绘制：</span>
      <el-button size="small" :type="isTool('ellipsoid') ? 'primary' : ''" @click="toggleTool('ellipsoid')">⭘ 椭圆</el-button>
      <el-button size="small" :type="isTool('box') ? 'primary' : ''" @click="toggleTool('box')">▭ 矩形</el-button>
      <el-button size="small" :type="isTool('polygon') ? 'primary' : ''" @click="toggleTool('polygon')">⬠ 多边形</el-button>
    </div>
    <div v-if="store.activeTool !== 'select'" class="tool-tip">
      绘制模式：{{ toolText }}（在任意一张切面上操作，Esc 取消）
    </div>

    <div v-if="!store.rois.length" class="empty-state">
      暂无标记。点击“+ 球体”或选择椭圆 / 矩形 / 多边形工具，在影像上直接绘制。
    </div>

    <div v-for="(roi, i) in store.rois" :key="roi.id" class="roi-config" :class="{ selected: store.selectedROIId === roi.id }">
      <div class="roi-row">
        <span class="roi-no">#{{ i + 1 }}</span>
        <el-tag size="small" :type="tagType(roi)" effect="dark">{{ shapeName(roi.shape) }}</el-tag>
        <el-input v-model="roi.label" size="small" placeholder="标签" style="width:88px" @change="touch(roi)"/>
        <el-button size="small" :type="store.selectedROIId === roi.id ? 'primary' : 'default'" circle @click="store.selectedROIId = store.selectedROIId === roi.id ? null : roi.id">◎</el-button>
        <el-button size="small" type="danger" @click="store.removeROI(roi.id)" circle>×</el-button>
      </div>

      <div class="roi-row">
        <span class="lbl">中心 xyz</span>
        <el-input-number v-model="roi.center[0]" size="small" :step="1" controls-position="right" style="width:62px" @change="touch(roi)"/>
        <el-input-number v-model="roi.center[1]" size="small" :step="1" controls-position="right" style="width:62px" @change="touch(roi)"/>
        <el-input-number v-model="roi.center[2]" size="small" :step="1" controls-position="right" style="width:62px" @change="touch(roi)"/>
      </div>

      <div v-if="roi.shape === 'sphere'" class="roi-row">
        <span class="lbl">半径</span>
        <el-input-number v-model="roi.radius!" size="small" :step="1" controls-position="right" style="width:90px" @change="touch(roi)"/>
      </div>
      <div v-else-if="roi.shape === 'ellipsoid'" class="roi-row">
        <span class="lbl">半径 xyz</span>
        <el-input-number v-model="roi.radii![0]" size="small" :step="1" controls-position="right" style="width:62px" @change="touch(roi)"/>
        <el-input-number v-model="roi.radii![1]" size="small" :step="1" controls-position="right" style="width:62px" @change="touch(roi)"/>
        <el-input-number v-model="roi.radii![2]" size="small" :step="1" controls-position="right" style="width:62px" @change="touch(roi)"/>
      </div>
      <div v-else-if="roi.shape === 'box'" class="roi-row">
        <span class="lbl">长宽高 xyz</span>
        <el-input-number v-model="roi.size![0]" size="small" :step="1" controls-position="right" style="width:62px" @change="touch(roi)"/>
        <el-input-number v-model="roi.size![1]" size="small" :step="1" controls-position="right" style="width:62px" @change="touch(roi)"/>
        <el-input-number v-model="roi.size![2]" size="small" :step="1" controls-position="right" style="width:62px" @change="touch(roi)"/>
      </div>
      <div v-else class="roi-row">
        <span class="lbl">{{ planeName(roi.plane) }} 第{{ roi.slice }}层 · {{ roi.points?.length ?? 0 }} 顶点</span>
      </div>

      <div v-if="result(roi)?.reason && !result(roi)?.valid" class="result-invalid">
        ⚠ {{ result(roi)?.reason }}
      </div>

      <div v-if="result(roi)?.valid" class="r-stats">
        <div class="stat"><span>均值</span><b>{{ result(roi)?.mean }}</b> HU</div>
        <div class="stat"><span>标准差</span><b>{{ result(roi)?.std }}</b></div>
        <div class="stat"><span>范围</span><b>{{ result(roi)?.min }}~{{ result(roi)?.max }}</b></div>
        <div class="stat"><span>体素</span><b>{{ result(roi)?.voxelCount }}</b></div>
        <div class="hist-wrap"><HistBars :data="result(roi)?.histogram ?? []"/></div>
      </div>
    </div>

    <el-alert v-if="store.analyzeError" :title="store.analyzeError" type="error" :closable="false" style="margin-top:8px"/>
    <div class="reanalyze">
      <el-button type="success" size="small" @click="store.analyzeROIs()" :loading="store.loading">
        📊 重新测量
      </el-button>
      <span v-if="store.loading" class="measuring">测量中…</span>
      <span v-else class="persist-hint">标记自动保存在本浏览器，重开页面可恢复</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useImagingStore } from '../store/imaging'
import type { ROI, ROIShape, Plane } from '../types'
import HistBars from './HistBars.vue'

const store = useImagingStore()

const SHAPE_NAMES: Record<ROIShape, string> = { sphere: '球体', ellipsoid: '椭圆', box: '矩形', polygon: '多边形' }
const PLANE_NAMES: Record<Plane, string> = { axial: '横断面', coronal: '冠状面', sagittal: '矢状面' }

function shapeName(s: ROIShape) { return SHAPE_NAMES[s] }
function planeName(p?: Plane) { return p ? PLANE_NAMES[p] : '' }
function result(roi: ROI) { return store.resultOf(roi.id) }
function tagType(roi: ROI) {
  const r = result(roi)
  if (!r) return 'info'
  if (!r.valid) return r.reason === '正在测量…' ? 'info' : 'danger'
  return 'success'
}

function addSphere() {
  const [d, h, w] = store.dims
  store.addROI({
    label: `sphere-${store.rois.length + 1}`,
    shape: 'sphere',
    center: [Math.floor(w / 2), Math.floor(h / 2), Math.floor(d / 2)],
    radius: 6,
  })
}

const TOOL_TEXT: Record<string, string> = {
  ellipsoid: '在切面上按住拖拽画出椭圆（第三轴半径取较短边）',
  box: '在切面上按住拖拽画出矩形（第三轴厚度取较短边）',
  polygon: '逐次单击添加顶点，双击 / 右键 / Enter 闭合，至少 3 个顶点',
}
const toolText = () => TOOL_TEXT[store.activeTool] ?? ''

function isTool(t: ROIShape) { return store.activeTool === t }
function toggleTool(t: ROIShape) {
  if (store.activeTool === t) store.setTool('select')
  else store.setTool(t)
}
function touch(roi: ROI) {
  // el-input-number 清空时可能产生 null，统一规整为数字
  const center = roi.center.map(v => Number(v) || 0)
  const patch: Partial<ROI> = { center }
  if (roi.shape === 'sphere') patch.radius = Number(roi.radius) || 0
  if (roi.shape === 'ellipsoid' && roi.radii) patch.radii = roi.radii.map(v => Number(v) || 0)
  if (roi.shape === 'box' && roi.size) patch.size = roi.size.map(v => Number(v) || 0)
  store.updateROI(roi.id, patch)
}
</script>

<style scoped>
.panel { background:#161b22; border-radius:6px; padding:10px; border:1px solid #30363d }
.panel h4 { color:#58a6ff; font-size:12px; margin-bottom:8px }
.toolbar { display:flex; gap:4px; align-items:center; flex-wrap:wrap }
.tb-sep { font-size:10px; color:#8b949e }
.tool-tip { margin-top:6px; font-size:10px; color:#d29922; background:#1c1a10; border:1px solid #3a2f0d; padding:4px 6px; border-radius:3px }
.empty-state { margin-top:8px; font-size:11px; color:#8b949e; background:#0d1117; border:1px dashed #30363d; border-radius:4px; padding:10px; text-align:center; line-height:1.6 }
.roi-config { margin-top:8px; padding:6px; background:#0d1117; border:1px solid #30363d; border-radius:4px }
.roi-config.selected { border-color:#58a6ff }
.roi-row { display:flex; gap:3px; align-items:center; padding:2px 0; font-size:11px; flex-wrap:wrap }
.roi-no { color:#8b949e; width:22px }
.lbl { color:#8b949e; font-size:10px }
.result-invalid { margin-top:4px; font-size:10px; color:#ff7b72; background:#2d1416; border:1px solid #6e2328; border-radius:3px; padding:4px 6px; line-height:1.5 }
.r-stats { display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-top:4px }
.stat { font-size:10px; color:#8b949e; padding:3px 4px; background:#161b22; border-radius:3px }
.stat b { color:#e6edf3; margin-left:4px }
.hist-wrap { grid-column:1 / -1 }
.reanalyze { margin-top:8px; display:flex; align-items:center; gap:8px }
.measuring, .persist-hint { font-size:10px; color:#8b949e }
</style>
