import type { ROIPlane, ROIDef } from '@/types'

/** ROI 叠加层配色（按列表序号循环） */
const PALETTE = ['#ff6b6b', '#4ecdc4', '#ffd93d', '#6bcB77', '#a78bfa', '#ff9f43', '#54a0ff']
export function roiColor(index: number) { return PALETTE[index % PALETTE.length] }

let seq = 0
export function genId(): string {
  seq += 1
  return `roi_${Date.now().toString(36)}_${seq}`
}

/** 体素坐标 [x,y,z] -> 指定切面上的 [u, v]（像素坐标） */
export function xyzToUV(plane: ROIPlane, x: number, y: number, z: number): [number, number] {
  if (plane === 'axial') return [x, y]
  if (plane === 'coronal') return [x, z]
  return [y, z] // sagittal
}

/** 指定切面上的像素坐标 -> 体素坐标；sliceIndex 为该切面当前切片号 */
export function uvToXYZ(plane: ROIPlane, u: number, v: number, sliceIndex: number): [number, number, number] {
  const s = Math.round(sliceIndex)
  if (plane === 'axial') return [u, v, s]
  if (plane === 'coronal') return [u, s, v]
  return [s, u, v] // sagittal: x = 切片号
}

/** 切面的当前切片号对应三维体素的哪个分量 */
export function planeAxis(plane: ROIPlane): 0 | 1 | 2 {
  return plane === 'axial' ? 2 : plane === 'coronal' ? 1 : 0
}

/** 二维顶点列表的质心与包围盒 */
export function polyInfo(points: [number, number][]) {
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity
  let su = 0, sv = 0
  for (const [u, v] of points) {
    su += u; sv += v
    if (u < minU) minU = u
    if (u > maxU) maxU = u
    if (v < minV) minV = v
    if (v > maxV) maxV = v
  }
  const n = Math.max(1, points.length)
  return { cu: su / n, cv: sv / n, minU, maxU, minV, maxV }
}

/** 依据 shape 给新标记生成默认标签 */
export function defaultLabel(shape: ROIDef['shape'], n: number): string {
  const tag = shape === 'sphere' ? 'lesion' : shape
  return `${tag}${n + 1}`
}
