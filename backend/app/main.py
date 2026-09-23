import math
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Medical Imaging Viewer")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class VolumeRequest(BaseModel):
    preset: str = "brain"  # brain / chest / abdomen
    width: int = 64
    height: int = 64
    depth: int = 64


class ROIAnalyzeRequest(BaseModel):
    volume: list = []
    rois: list = []


WINDOW_PRESETS = {
    "lung":     {"window": 1500, "level": -600, "desc": "肺窗 (W1500/L-600)"},
    "mediastinum": {"window": 350, "level": 50, "desc": "纵隔窗 (W350/L50)"},
    "bone":     {"window": 2000, "level": 300, "desc": "骨窗 (W2000/L300)"},
    "brain":    {"window": 80, "level": 40, "desc": "脑窗 (W80/L40)"},
    "abdomen":  {"window": 400, "level": 40, "desc": "腹窗 (W400/L40)"},
}


def generate_volume(preset: str, w: int, h: int, d: int):
    """Generate synthetic CT-like volume"""
    np.random.seed(42)
    vol = np.zeros((d, h, w), dtype=np.float32)

    center_x, center_y, center_z = w//2, h//2, d//2
    for z in range(d):
        for y in range(h):
            for x in range(w):
                # Head-like shape
                rx = (x - center_x - 5) / (w * 0.4)
                ry = (y - center_y) / (h * 0.45)
                rz = (z - center_z + 3) / (d * 0.4)
                dist = math.sqrt(rx**2 + ry**2 + rz**2)

                if preset == "brain":
                    if dist < 0.85:
                        # Brain tissue
                        base = 35
                        # Sulci pattern
                        noise = (np.sin(x * 0.4) * np.cos(y * 0.3) + np.sin(z * 0.35)) * 8
                        # Ventricles (CSF)
                        vent_dist = math.sqrt(((x-center_x+2)/(w*0.15))**2 + ((y-center_y)/(h*0.12))**2 + ((z-center_z)/(d*0.1))**2)
                        if vent_dist < 0.6:
                            base = 10 + noise * 0.3
                        # Skull
                        if dist > 0.7 and dist < 0.85:
                            base = 200 + np.random.uniform(-20, 20)
                        vol[z, y, x] = base + noise
                    elif dist < 0.9:
                        vol[z, y, x] = 100  # Scalp
                elif preset == "chest":
                    # Body oval
                    bx = (x - center_x) / (w * 0.35)
                    by = (y - center_y) / (h * 0.4)
                    body = math.sqrt(bx**2 + by**2)
                    if body < 1.0:
                        # Lungs (dark)
                        lung_dist1 = math.sqrt(((x-center_x+8)/(w*0.12))**2 + ((y-center_y)/(h*0.13))**2)
                        lung_dist2 = math.sqrt(((x-center_x-8)/(w*0.12))**2 + ((y-center_y)/(h*0.13))**2)
                        if lung_dist1 < 0.7 or lung_dist2 < 0.7:
                            vol[z, y, x] = -650 + np.sin(z*0.3)*30
                        else:
                            vol[z, y, x] = 30 + np.random.uniform(-5, 5)
                        # Spine
                        if abs(x - center_x) < 3 and abs(y - center_y + 8) < 4:
                            vol[z, y, x] = 250
                    vol[z, y, x] += np.random.uniform(-3, 3)
                elif preset == "abdomen":
                    bx = (x - center_x) / (w * 0.33)
                    by = (y - center_y) / (h * 0.4)
                    body = math.sqrt(bx**2 + by**2)
                    if body < 1.0:
                        base = 35
                        # Liver (right upper)
                        lv = math.sqrt(((x-center_x-6)/(w*0.08))**2 + ((y-center_y+4)/(h*0.07))**2)
                        if lv < 0.6:
                            base = 55 + np.random.uniform(-5, 5)
                        # Kidneys
                        kd1 = math.sqrt(((x-center_x-5)/(w*0.04))**2 + ((y-center_y-5)/(h*0.04))**2)
                        kd2 = math.sqrt(((x-center_x+5)/(w*0.04))**2 + ((y-center_y-5)/(h*0.04))**2)
                        if kd1 < 0.4 or kd2 < 0.4:
                            base = 45
                        # Spine
                        if abs(x - center_x) < 3 and abs(y - center_y + 7) < 4:
                            base = 250 + np.random.uniform(-10, 10)
                        vol[z, y, x] = base + np.random.uniform(-9, 9)

    return vol.tolist()


@app.post("/api/volume")
def get_volume(req: VolumeRequest):
    vol = generate_volume(req.preset, req.width, req.height, req.depth)

    # Extract mid slices for MPR
    mid_axial = int(req.depth // 2)
    mid_coronal = int(req.height // 2)
    mid_sagittal = int(req.width // 2)

    # Return: 3D volume + 3 MPR slices
    return {
        "volume": vol,
        "dimensions": [req.depth, req.height, req.width],
        "mpr": {
            "axial": vol[mid_axial],
            "coronal": [[vol[z][mid_coronal][x] for x in range(req.width)] for z in range(req.depth)],
            "sagittal": [[vol[z][y][mid_sagittal] for y in range(req.height)] for z in range(req.depth)]
        },
        "preset": req.preset,
        "windowPresets": WINDOW_PRESETS
    }


# ————————————————————————————————————————————————————————————
# ROI 分析
# 每个标记始终返回一条结果：
#   status = ok     -> 有统计结果；clipped=True 表示标记部分越界、只统计了影像内体素
#   status = empty  -> 标记在影像内没有覆盖任何体素（完全越界 / 形状退化为空）
#   status = error  -> 参数无效，无法进行测量
# message 给出中文原因，前端原样展示，测量值不再静默丢失。
# ————————————————————————————————————————————————————————————

AXIS_NAMES = ["x", "y", "z"]


def _base_result(roi: dict, fallback_idx: int):
    rid = roi.get("id")
    if not rid:
        rid = f"roi-{fallback_idx}"
    return {
        "id": rid,
        "label": roi.get("label", "roi"),
        "shape": roi.get("shape", "sphere"),
        "status": "empty",
        "voxelCount": 0,
    }


def _stats(roi: dict, base: dict, voxels: list, clipped: bool, clip_msg: str = ""):
    if not voxels:
        base["status"] = "empty"
        base["message"] = "标记完全位于影像范围之外，覆盖到的体素数为 0，请把中心/半径或形状移回影像内"
        return base

    arr = np.array(voxels, dtype=np.float64)
    vmin, vmax = float(np.min(arr)), float(np.max(arr))
    if vmin == vmax:
        # 常值 ROI 时 np.histogram 的 range=(min,max) 会报错，对称扩 0.5 HU
        hist = np.histogram(arr, bins=10, range=(vmin - 0.5, vmax + 0.5))[0].tolist()
    else:
        hist = np.histogram(arr, bins=10, range=(vmin, vmax))[0].tolist()

    base.update({
        "status": "ok",
        "voxelCount": len(voxels),
        "mean": round(float(np.mean(arr)), 2),
        "std": round(float(np.std(arr)), 2),
        "min": round(vmin, 2),
        "max": round(vmax, 2),
        "histogram": hist,
        "clipped": clipped,
    })
    if clipped:
        base["message"] = clip_msg or "标记部分超出影像边界，仅统计了影像范围内的体素"
    return base


def _num(v, default=0.0):
    try:
        if v is None:
            return default
        return float(v)
    except (TypeError, ValueError):
        raise ValueError("参数必须是数值")


def _sphere_voxels(vol: np.ndarray, center, radius):
    d, h, w = vol.shape
    cx, cy, cz = center
    r = radius
    voxels = []
    z0, z1 = max(0, int(cz - r)), min(d, int(cz + r) + 1)
    y0, y1 = max(0, int(cy - r)), min(h, int(cy + r) + 1)
    x0, x1 = max(0, int(cx - r)), min(w, int(cx + r) + 1)
    for z in range(z0, z1):
        for y in range(y0, y1):
            for x in range(x0, x1):
                if math.sqrt((x-cx)**2 + (y-cy)**2 + (z-cz)**2) <= r:
                    voxels.append(float(vol[z, y, x]))
    clipped = (z0 != int(cz-r) or z1 != min(d, int(cz+r)+1)
               or y0 != int(cy-r) or y1 != min(h, int(cy+r)+1)
               or x0 != int(cx-r) or x1 != min(w, int(cx+r)+1))
    return voxels, clipped


def _plane_axes(plane: str):
    """返回 (固定轴, u轴, v轴)，即切面像素坐标 (u,v) 对应 (x,y,z) 的哪两个分量"""
    if plane == "axial":      # z 固定，u=x, v=y
        return 2, 0, 1
    if plane == "coronal":    # y 固定，u=x, v=z
        return 1, 0, 2
    if plane == "sagittal":   # x 固定，u=y, v=z
        return 0, 1, 2
    return None


def _plane_slice(plane, fixed, center):
    """2D 形状所在切片号：优先 sliceIndex，否则取中心对应分量"""
    iaxis, _, _ = _plane_axes(plane)
    s = fixed
    if s is None:
        s = center[iaxis]
    return int(round(s))


def _rect_ellipse_voxels(vol: np.ndarray, plane: str, s: int, center, au, av, kind: str):
    d, h, w = vol.shape
    iaxis, uaxis, vaxis = _plane_axes(plane)
    shape = [w, h, d]
    cu, cv = center[uaxis], center[vaxis]

    if kind == "ellipse":
        u0, u1 = int(math.floor(cu - au)), int(math.ceil(cu + au)) + 1
        v0, v1 = int(math.floor(cv - av)), int(math.ceil(cv + av)) + 1
    else:
        u0, u1 = int(math.ceil(cu - au)), int(math.floor(cu + au)) + 1
        v0, v1 = int(math.ceil(cv - av)), int(math.floor(cv + av)) + 1

    u0c, u1c = max(0, u0), min(shape[uaxis], u1)
    v0c, v1c = max(0, v0), min(shape[vaxis], v1)
    clipped = (u0 != u0c or u1 != u1c or v0 != v0c or v1 != v1c
               or s < 0 or s >= shape[iaxis])

    if s < 0 or s >= shape[iaxis]:
        return [], clipped

    voxels = []
    for vv in range(v0c, v1c):
        for uu in range(u0c, u1c):
            inside = (abs(uu - cu) <= au and abs(vv - cv) <= av) if kind == "rect" \
                else (((uu - cu) / au) ** 2 + ((vv - cv) / av) ** 2 <= 1.0)
            if inside:
                idx = [0, 0, 0]
                idx[iaxis] = s; idx[uaxis] = uu; idx[vaxis] = vv
                voxels.append(float(vol[idx[2], idx[1], idx[0]]))
    return voxels, clipped


def _polygon_voxels(vol: np.ndarray, plane: str, s: int, points):
    d, h, w = vol.shape
    iaxis, uaxis, vaxis = _plane_axes(plane)
    shape = [w, h, d]

    us = [p[0] for p in points]
    vs = [p[1] for p in points]
    u0, u1 = int(math.floor(min(us))), int(math.ceil(max(us))) + 1
    v0, v1 = int(math.floor(min(vs))), int(math.ceil(max(vs))) + 1
    u0c, u1c = max(0, u0), min(shape[uaxis], u1)
    v0c, v1c = max(0, v0), min(shape[vaxis], v1)
    clipped = (u0 != u0c or u1 != u1c or v0 != v0c or v1 != v1c
               or s < 0 or s >= shape[iaxis])

    if s < 0 or s >= shape[iaxis]:
        return [], clipped

    pts = np.array(points, dtype=np.float64)
    U, V = np.meshgrid(np.arange(u0c, u1c), np.arange(v0c, v1c))
    inside = np.zeros(U.shape, dtype=bool)
    n = len(pts)
    j = n - 1
    for i in range(n):
        ui, vi = pts[i]
        uj, vj = pts[j]
        cond = ((vi > V) != (vj > V)) & \
               (U < (uj - ui) * (V - vi) / ((vj - vi) or 1e-12) + ui)
        inside ^= cond
        j = i

    coords = np.argwhere(inside)  # 行对应 v，列对应 u
    voxels = []
    for vv_i, uu_i in coords:
        uu = int(U[vv_i, uu_i]); vv = int(V[vv_i, uu_i])
        idx = [0, 0, 0]
        idx[iaxis] = s; idx[uaxis] = uu; idx[vaxis] = vv
        voxels.append(float(vol[idx[2], idx[1], idx[0]]))
    return voxels, clipped


def _analyze_one(vol: np.ndarray, dims, roi: dict, idx: int):
    base = _base_result(roi, idx)
    shape = roi.get("shape", "sphere")
    try:
        center_raw = roi.get("center", [32, 32, 32])
        if not isinstance(center_raw, (list, tuple)) or len(center_raw) < 3:
            raise ValueError("中心坐标必须是 [x, y, z] 三个数值")
        center = [_num(center_raw[0]), _num(center_raw[1]), _num(center_raw[2])]
        w, h, d = dims

        if shape == "sphere":
            radius = _num(roi.get("radius", 8))
            base.update({"center": [round(v, 2) for v in center], "radius": round(radius, 2)})
            if radius <= 0:
                base["status"] = "error"
                base["message"] = "球体半径必须大于 0"
                return base
            outside = [AXIS_NAMES[i] for i in range(3)
                       if center[i] < 0 or center[i] >= dims[i]]
            if outside:
                bounds = {"x": w - 1, "y": h - 1, "z": d - 1}
                detail = "、".join(
                    f"{a}={int(round(center[i]))} 超出 0~{bounds[a]}"
                    for i, a in enumerate(AXIS_NAMES) if a in outside)
                base["status"] = "empty"
                base["message"] = (
                    f"球心坐标在影像范围之外（{detail}），未测到任何体素；"
                    f"请把中心移回影像内或删除该标记")
                return base
            voxels, clipped = _sphere_voxels(vol, center, radius)
            return _stats(roi, base, voxels, clipped,
                          "球体部分超出影像边界，仅统计了影像范围内的体素")

        # —— 2D 形状（矩形/椭圆/多边形）——
        plane = roi.get("plane")
        plane_axes = _plane_axes(plane)
        if plane_axes is None:
            raise ValueError("缺少有效的切面 plane（axial/coronal/sagittal）")
        iaxis = plane_axes[0]
        s = _plane_slice(plane, roi.get("sliceIndex"), center)
        base["center"] = [round(v, 2) for v in center]

        dim_name = AXIS_NAMES[iaxis]
        dim_max = dims[iaxis] - 1
        if s < 0 or s > dim_max:
            base["status"] = "empty"
            base["message"] = (f"{plane} 标记所在的第 {s} 层超出该切面范围（0~{dim_max}），"
                               f"请切换到有效切片或修改 {dim_name} 坐标")
            return base

        if shape in ("rect", "ellipse"):
            key = "size" if shape == "rect" else "radii"
            raw = roi.get(key)
            if not isinstance(raw, (list, tuple)) or len(raw) < 2:
                raise ValueError(f"{shape} 缺少 {key} 参数（两个正数）")
            au, av = _num(raw[0]), _num(raw[1])
            if au <= 0 or av <= 0:
                base["status"] = "error"
                base["message"] = ("矩形半宽/半高" if shape == "rect" else "椭圆半轴") + "必须大于 0"
                return base
            base[key] = [round(au, 2), round(av, 2)]
            voxels, clipped = _rect_ellipse_voxels(vol, plane, s, center, au, av, shape)
            return _stats(roi, base, voxels, clipped,
                          f"{shape == 'rect' and '矩形' or '椭圆'}部分超出影像边界，仅统计了影像范围内的体素")

        if shape == "polygon":
            pts_raw = roi.get("points", [])
            if not isinstance(pts_raw, list) or len(pts_raw) < 3:
                base["status"] = "error"
                base["message"] = "多边形至少需要 3 个顶点"
                return base
            points = []
            for p in pts_raw:
                if not isinstance(p, (list, tuple)) or len(p) < 2:
                    raise ValueError("多边形顶点必须是 [u, v] 数值对")
                points.append([_num(p[0]), _num(p[1])])
            voxels, clipped = _polygon_voxels(vol, plane, s, points)
            return _stats(roi, base, voxels, clipped,
                          "多边形部分超出影像边界，仅统计了影像范围内的体素")

        base["status"] = "error"
        base["message"] = f"未知的标记形状：{shape}"
        return base
    except ValueError as e:
        base["status"] = "error"
        base["message"] = f"标记参数无效：{e}"
        return base
    except Exception as e:  # 兜底：任何意外都不能让该标记静默消失
        base["status"] = "error"
        base["message"] = f"分析失败：{type(e).__name__}"
        return base


@app.post("/api/roi")
def analyze_roi(req: ROIAnalyzeRequest):
    try:
        vol = np.array(req.volume, dtype=np.float32)
        if vol.ndim != 3:
            raise ValueError("影像数据不是三维数组")
        d, h, w = vol.shape
    except Exception:
        # 影像数据本身不可用：每个标记都返回错误说明
        return {"rois": [{
            "id": r.get("id", f"roi-{i}"),
            "label": r.get("label", "roi"),
            "shape": r.get("shape", "sphere"),
            "status": "error",
            "voxelCount": 0,
            "message": "影像数据不可用，请重新载入影像后再分析",
        } for i, r in enumerate(req.rois)]}

    results = []
    for i, roi in enumerate(req.rois):
        if not isinstance(roi, dict):
            results.append({
                "id": f"roi-{i}", "label": "roi", "shape": "sphere",
                "status": "error", "voxelCount": 0, "message": "标记数据格式错误",
            })
            continue
        results.append(_analyze_one(vol, (w, h, d), roi, i))

    return {"rois": results}


@app.get("/api/windows")
def get_windows():
    return {"presets": WINDOW_PRESETS}
