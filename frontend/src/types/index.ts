export interface WindowPreset { window: number; level: number; desc: string }
export interface VolumeData {
  volume: number[][][]
  dimensions: [number, number, number]
  mpr: { axial: number[][]; coronal: number[][]; sagittal: number[][] }
  preset: string
  windowPresets: Record<string, WindowPreset>
}

export type ROIPlane = 'axial' | 'coronal' | 'sagittal'
export type ROIShape = 'sphere' | 'ellipse' | 'rect' | 'polygon'

/** ROI 标注定义。sphere 为三维球体（原有口径）；ellipse/rect/polygon 为画在指定切面切片上的二维形状 */
export interface ROIDef {
  id: string
  label: string
  shape: ROIShape
  /** 三维中心 [x, y, z]（polygon 为由顶点算出的质心，用于其他切面定位） */
  center: [number, number, number]
  /** sphere：球体半径（体素） */
  radius?: number
  /** ellipse：切面内两轴半径（体素） */
  radii?: [number, number]
  /** rect：切面内半宽、半高（体素） */
  size?: [number, number]
  /** polygon：切面内绝对像素坐标顶点 [u, v][] */
  points?: [number, number][]
  /** 二维形状所属切面 */
  plane?: ROIPlane
  /** 二维形状所在切片号 */
  sliceIndex?: number
}

export type ROIStatus = 'ok' | 'empty' | 'error'

export interface ROIResult {
  id: string
  label: string
  shape: ROIShape
  status: ROIStatus
  voxelCount: number
  center?: number[]
  radius?: number
  mean?: number
  std?: number
  min?: number
  max?: number
  histogram?: number[]
  /** 标记部分越出影像边界、仅统计了影像内体素时为 true */
  clipped?: boolean
  /** status 非 ok 或 clipped 时的说明 */
  message?: string
}

/** 正在影像上拖拽/点击的临时绘制图形 */
export interface DraftShape {
  plane: ROIPlane
  kind: Exclude<ROIShape, 'sphere'>
  /** rect/ellipse: [起点, 终点]; polygon: 已确认的顶点 */
  points: [number, number][]
  /** 当前鼠标位置（polygon 悬停预览 / rect 拖拽终点） */
  current: [number, number] | null
}
