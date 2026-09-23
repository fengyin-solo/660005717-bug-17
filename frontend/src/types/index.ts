export interface WindowPreset { window: number; level: number; desc: string }
export interface VolumeData {
  volume: number[][][]
  dimensions: [number, number, number]
  mpr: { axial: number[][]; coronal: number[][]; sagittal: number[][] }
  preset: string
  windowPresets: Record<string, WindowPreset>
}

export type ROIShape = 'sphere' | 'ellipsoid' | 'box' | 'polygon'
export type Plane = 'axial' | 'coronal' | 'sagittal'

export interface ROI {
  id: string
  label: string
  shape: ROIShape
  center: number[] // [x, y, z] 体素坐标
  radius?: number // 球体半径（保持原有口径）
  radii?: number[] // 椭球三轴半径 [rx, ry, rz]
  size?: number[] // 矩形盒全宽 [sx, sy, sz]
  plane?: Plane // 多边形所在切面
  slice?: number // 多边形所在切片（该平面法线方向索引）
  points?: number[][] // 多边形顶点，每项为对应切面上的二维坐标
}

export interface ROIResult {
  id?: string
  label: string
  shape?: ROIShape
  center: number[]
  radius?: number
  radii?: number[]
  size?: number[]
  plane?: Plane
  slice?: number
  points?: number[][]
  valid: boolean
  reason?: string
  mean: number
  std: number
  min: number
  max: number
  voxelCount: number
  histogram: number[]
}
