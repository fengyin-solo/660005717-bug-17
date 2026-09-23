import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import axios from 'axios'
import type { VolumeData, ROIResult, ROIDef, ROIPlane, DraftShape } from '@/types'
import { genId } from '@/utils/roi'

const ROI_STORAGE_KEY = 'mpr_viewer_rois_v1'

function loadPersistedRois(): ROIDef[] {
  try {
    const raw = localStorage.getItem(ROI_STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((r) => r && Array.isArray(r.center) && r.center.length === 3)
      .map((r) => ({
        ...r,
        id: typeof r.id === 'string' ? r.id : genId(),
        shape: r.shape ?? 'sphere',
      })) as ROIDef[]
  } catch {
    return []
  }
}

export const useImagingStore = defineStore('imaging', () => {
  const loading = ref(false)
  const analyzing = ref(false)
  const volumeData = ref<VolumeData | null>(null)
  const preset = ref('brain')
  const windowVal = ref(80)
  const levelVal = ref(40)
  const roiResults = ref<ROIResult[]>([])
  const mprSlice = ref({ axial: 32, coronal: 32, sagittal: 32 })

  // —— 标记（持久化，刷新后仍在原位）——
  const rois = ref<ROIDef[]>(loadPersistedRois())
  watch(rois, (v) => {
    try { localStorage.setItem(ROI_STORAGE_KEY, JSON.stringify(v)) } catch { /* 忽略写入失败 */ }
  }, { deep: true })

  // —— 在影像上绘制标记的工具状态 ——
  const activeTool = ref<Exclude<ROIDef['shape'], 'sphere'> | ''>('')
  const draft = ref<DraftShape | null>(null)
  function setTool(tool: typeof activeTool.value) {
    draft.value = null
    activeTool.value = tool
  }

  const planeFixedAxis: Record<ROIPlane, 0 | 1 | 2> = { axial: 2, coronal: 1, sagittal: 0 }

  function addROI(roi: Omit<ROIDef, 'id'> & { id?: string }): ROIDef {
    const def: ROIDef = { id: roi.id || genId(), ...roi } as ROIDef
    // 二维形状：中心固定轴始终等于所属切片，保证面板中心坐标与切片输入不漂移
    if (def.shape !== 'sphere' && def.plane && def.sliceIndex !== undefined) {
      def.center[planeFixedAxis[def.plane]] = def.sliceIndex
    }
    rois.value.push(def)
    return def
  }
  function removeROI(id: string) {
    const i = rois.value.findIndex((r) => r.id === id)
    if (i >= 0) rois.value.splice(i, 1)
  }

  /** 保持二维标记中心固定轴与切片号一致。
   *  面板改中心坐标：用中心分量回填 sliceIndex（不传 slice）；
   *  面板改切片号：传入新 slice，同步到中心固定轴。 */
  function syncPlaneSlice(roi: ROIDef, slice?: number) {
    if (roi.shape !== 'sphere' && roi.plane) {
      const axis = planeFixedAxis[roi.plane]
      if (slice !== undefined) {
        roi.sliceIndex = slice
        roi.center[axis] = slice
      } else {
        roi.sliceIndex = Math.round(roi.center[axis])
      }
    }
  }

  function resultOf(id: string): ROIResult | undefined {
    return roiResults.value.find((r) => r.id === id)
  }

  async function loadVolume() {
    loading.value = true
    try {
      const { data } = await axios.post('/api/volume', {
        preset: preset.value, width: 64, height: 64, depth: 64
      })
      volumeData.value = data
      const mid: [number, number, number] = [
        Math.floor((data.dimensions?.[0] ?? 64) / 2),
        Math.floor((data.dimensions?.[1] ?? 64) / 2),
        Math.floor((data.dimensions?.[2] ?? 64) / 2),
      ]
      mprSlice.value = { axial: mid[0], coronal: mid[1], sagittal: mid[2] }
    } finally { loading.value = false }
  }

  /** 分析全部标记。每个标记都会拿到一条结果（ok / empty / error），不会再静默丢失 */
  async function analyzeROI() {
    if (!volumeData.value || !rois.value.length) {
      roiResults.value = []
      return
    }
    analyzing.value = true
    try {
      const { data } = await axios.post('/api/roi', {
        volume: volumeData.value.volume,
        rois: rois.value,
      })
      // 以标记 id 对齐结果，顺序以面板为准
      const byId = new Map<string, ROIResult>((data.rois || []).map((r: ROIResult) => [r.id, r]))
      roiResults.value = rois.value.map((r) => byId.get(r.id) || {
        id: r.id, label: r.label, shape: r.shape, status: 'error' as const, voxelCount: 0,
        message: '分析服务未返回该标记的结果，请重试',
      })
    } catch (e) {
      roiResults.value = rois.value.map((r) => ({
        id: r.id, label: r.label, shape: r.shape, status: 'error' as const, voxelCount: 0,
        message: '分析请求失败，请检查后端服务后重试',
      }))
    } finally {
      analyzing.value = false
    }
  }

  function applyWindow(w: number, l: number) { windowVal.value = w; levelVal.value = l }

  return {
    loading, analyzing, volumeData, preset, windowVal, levelVal, roiResults, mprSlice,
    rois, activeTool, draft,
    loadVolume, analyzeROI, applyWindow,
    addROI, removeROI, resultOf, setTool, syncPlaneSlice,
  }
})
