import random, math
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


class ROIRequest(BaseModel):
    center: list = [32, 32, 32]
    radius: int = 10
    label: str = "lesion"


class WindowLevelRequest(BaseModel):
    window: float = 400.0
    level: float = 40.0
    preset: str = "brain"


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
                            base = 200 + random.uniform(-20, 20)
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


class ROIAnalyzeRequest(BaseModel):
    volume: list
    rois: list = []


def _stats_dict(label, roi, voxels):
    """计算 ROI 统计值。球体等所有形状共用同一口径（均值/标准差/极值/体素数/直方图）。"""
    arr = np.array(voxels, dtype=np.float64)
    vmin, vmax = float(np.min(arr)), float(np.max(arr))
    if vmax > vmin:
        histogram = np.histogram(arr, bins=10, range=(vmin, vmax))[0].tolist()
    else:
        histogram = [len(voxels)] + [0] * 9
    return {
        "id": roi.get("id"),
        "label": label,
        "shape": roi.get("shape", "sphere"),
        "center": roi.get("center"),
        "radius": roi.get("radius"),
        "radii": roi.get("radii"),
        "size": roi.get("size"),
        "plane": roi.get("plane"),
        "slice": roi.get("slice"),
        "points": roi.get("points"),
        "valid": True,
        "reason": None,
        "mean": round(float(np.mean(arr)), 2),
        "std": round(float(np.std(arr)), 2),
        "min": round(vmin, 2),
        "max": round(vmax, 2),
        "voxelCount": len(voxels),
        "histogram": histogram,
    }


def _invalid(roi, label, reason):
    return {
        "id": roi.get("id"),
        "label": label,
        "shape": roi.get("shape", "sphere"),
        "center": roi.get("center"),
        "radius": roi.get("radius"),
        "radii": roi.get("radii"),
        "size": roi.get("size"),
        "plane": roi.get("plane"),
        "slice": roi.get("slice"),
        "points": roi.get("points"),
        "valid": False,
        "reason": reason,
        "mean": 0, "std": 0, "min": 0, "max": 0, "voxelCount": 0, "histogram": [],
    }


def _point_in_polygon(u, v, pts):
    """射线法判断点 (u, v) 是否在二维多边形内（边界点算入）。"""
    n = len(pts)
    inside = False
    j = n - 1
    for i in range(n):
        ui, vi = pts[i]
        uj, vj = pts[j]
        if (ui == u and vi == v) or ((vi > v) != (vj > v)):
            x_cross = ui + (v - vi) * (uj - ui) / (vj - vi) if vj != vi else ui
            if u <= x_cross:
                inside = not inside
        j = i
    return inside


@app.post("/api/roi")
def analyze_roi(req: ROIAnalyzeRequest):
    results = []

    try:
        vol = np.array(req.volume, dtype=np.float64)
        d, h, w = vol.shape
    except Exception:
        # 体数据本身不可用：逐个标记返回失败原因，而不是整体静默
        for roi in req.rois:
            results.append(_invalid(roi, roi.get("label", "roi"), "体数据不可用，无法测量"))
        return {"rois": results}

    for roi in req.rois:
        center = roi.get("center", [32, 32, 32])
        label = roi.get("label", "roi")
        shape = roi.get("shape", "sphere")

        try:
            cx, cy, cz = float(center[0]), float(center[1]), float(center[2])
        except (TypeError, ValueError, IndexError, KeyError):
            results.append(_invalid(roi, label, "标记中心坐标不是有效数字"))
            continue

        center_out = not (0 <= cx < w and 0 <= cy < h and 0 <= cz < d)
        voxels = []

        if shape == "polygon":
            pts = roi.get("points") or []
            plane = roi.get("plane", "axial")
            try:
                sl = int(roi.get("slice", -1))
            except (TypeError, ValueError):
                sl = -1

            if len(pts) < 3:
                results.append(_invalid(roi, label, f"多边形至少需要 3 个顶点（当前 {len(pts)} 个）"))
                continue
            try:
                pts = [(float(p[0]), float(p[1])) for p in pts]
            except (TypeError, ValueError, IndexError):
                results.append(_invalid(roi, label, "多边形顶点坐标不是有效数字"))
                continue

            if plane == "axial":
                u_max, v_max, n_max = w, h, d
            elif plane == "coronal":
                u_max, v_max, n_max = w, d, h
            else:
                u_max, v_max, n_max = h, d, w
            if not (0 <= sl < n_max):
                results.append(_invalid(roi, label, f"多边形所在切片超出影像范围（0~{n_max - 1}），范围内没有可测量体素"))
                continue
            if any(not (0 <= u < u_max and 0 <= v < v_max) for u, v in pts):
                results.append(_invalid(roi, label, "多边形顶点超出影像范围，范围内没有可测量体素"))
                continue

            us = sorted(set(int(round(u)) for u, _ in pts))
            vs = sorted(set(int(round(v)) for _, v in pts))
            for uu in range(max(0, us[0]), min(u_max, us[-1] + 1)):
                for vv in range(max(0, vs[0]), min(v_max, vs[-1] + 1)):
                    if _point_in_polygon(uu + 0.5, vv + 0.5, pts):
                        if plane == "axial":
                            voxels.append(float(vol[sl, vv, uu]))
                        elif plane == "coronal":
                            voxels.append(float(vol[vv, sl, uu]))
                        else:
                            voxels.append(float(vol[vv, uu, sl]))

        elif shape == "box":
            size = roi.get("size") or []
            try:
                sx, sy, sz = float(size[0]), float(size[1]), float(size[2])
            except (TypeError, ValueError, IndexError):
                results.append(_invalid(roi, label, "矩形长宽高不是有效数字"))
                continue
            if sx <= 0 or sy <= 0 or sz <= 0:
                results.append(_invalid(roi, label, "矩形长宽高必须均为正数，范围内没有可测量体素"))
                continue
            if center_out:
                results.append(_invalid(roi, label, f"标记中心超出影像范围（允许范围 x:0~{w - 1} y:0~{h - 1} z:0~{d - 1}），范围内没有可测量体素"))
                continue
            x0, x1 = math.ceil(cx - sx / 2), math.floor(cx + sx / 2)
            y0, y1 = math.ceil(cy - sy / 2), math.floor(cy + sy / 2)
            z0, z1 = math.ceil(cz - sz / 2), math.floor(cz + sz / 2)
            for zz in range(max(0, z0), min(d, z1 + 1)):
                for yy in range(max(0, y0), min(h, y1 + 1)):
                    for xx in range(max(0, x0), min(w, x1 + 1)):
                        voxels.append(float(vol[zz, yy, xx]))

        elif shape == "ellipsoid":
            radii = roi.get("radii") or []
            try:
                rx, ry, rz = float(radii[0]), float(radii[1]), float(radii[2])
            except (TypeError, ValueError, IndexError):
                results.append(_invalid(roi, label, "椭圆三轴半径不是有效数字"))
                continue
            if rx <= 0 or ry <= 0 or rz <= 0:
                results.append(_invalid(roi, label, "椭圆三轴半径必须均为正数，范围内没有可测量体素"))
                continue
            if center_out:
                results.append(_invalid(roi, label, f"标记中心超出影像范围（允许范围 x:0~{w - 1} y:0~{h - 1} z:0~{d - 1}），范围内没有可测量体素"))
                continue
            rmax = max(rx, ry, rz)
            for zz in range(max(0, int(cz - rmax)), min(d, int(cz + rmax) + 1)):
                for yy in range(max(0, int(cy - rmax)), min(h, int(cy + rmax) + 1)):
                    for xx in range(max(0, int(cx - rmax)), min(w, int(cx + rmax) + 1)):
                        if ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 + ((zz - cz) / rz) ** 2 <= 1:
                            voxels.append(float(vol[zz, yy, xx]))

        else:  # sphere（原有测量口径保持不变）
            try:
                radius = int(roi.get("radius", 8))
            except (TypeError, ValueError):
                results.append(_invalid(roi, label, "半径不是有效数字"))
                continue
            if radius <= 0:
                results.append(_invalid(roi, label, "半径必须为正数，范围内没有可测量体素"))
                continue
            if center_out:
                results.append(_invalid(roi, label, f"标记中心超出影像范围（允许范围 x:0~{w - 1} y:0~{h - 1} z:0~{d - 1}），范围内没有可测量体素"))
                continue
            for z in range(max(0, int(cz) - radius), min(d, int(cz) + radius + 1)):
                for y in range(max(0, int(cy) - radius), min(h, int(cy) + radius + 1)):
                    for x in range(max(0, int(cx) - radius), min(w, int(cx) + radius + 1)):
                        if math.sqrt((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2) <= radius:
                            voxels.append(float(vol[z, y, x]))

        if not voxels:
            # 标记合法但与影像没有重叠体素（如半径为 0 交集），明确告知而不是静默丢弃
            results.append(_invalid(roi, label, "标记范围内未覆盖任何影像体素，请调整中心或大小"))
            continue
        results.append(_stats_dict(label, roi, voxels))

    return {"rois": results}


@app.get("/api/windows")
def get_windows():
    return {"presets": WINDOW_PRESETS}