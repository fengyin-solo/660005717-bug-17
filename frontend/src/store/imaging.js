import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from 'axios';
const STORAGE_KEY = 'miv-rois-v1';
let idSeq = 0;
function genId() {
    idSeq += 1;
    return `roi-${Date.now().toString(36)}-${idSeq}`;
}
function defaultROIs() {
    return [{ id: genId(), label: 'lesion1', shape: 'sphere', center: [30, 28, 32], radius: 6 }];
}
function loadROIs() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return defaultROIs();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || !parsed.length)
            return defaultROIs();
        // 兼容旧版本（无 id / shape 的标记）
        return parsed.map((r) => ({
            id: typeof r.id === 'string' ? r.id : genId(),
            label: String(r.label ?? 'roi'),
            shape: (['sphere', 'ellipsoid', 'box', 'polygon'].includes(r.shape) ? r.shape : 'sphere'),
            center: Array.isArray(r.center) ? r.center.map(Number) : [0, 0, 0],
            radius: r.radius != null ? Number(r.radius) : undefined,
            radii: Array.isArray(r.radii) ? r.radii.map(Number) : undefined,
            size: Array.isArray(r.size) ? r.size.map(Number) : undefined,
            plane: r.plane,
            slice: r.slice != null ? Number(r.slice) : undefined,
            points: Array.isArray(r.points) ? r.points.map((p) => p.map(Number)) : undefined,
        }));
    }
    catch {
        return defaultROIs();
    }
}
export const useImagingStore = defineStore('imaging', () => {
    const loading = ref(false);
    const volumeData = ref(null);
    const preset = ref('brain');
    const windowVal = ref(80); // 窗宽 WW
    const levelVal = ref(40); // 窗位 WL
    const rois = ref(loadROIs());
    const roiResults = ref([]);
    const analyzeError = ref('');
    const activeTool = ref('select');
    const activePlane = ref(null);
    const mprSlice = ref({ axial: 32, coronal: 32, sagittal: 32 });
    const selectedROIId = ref(null);
    const dims = computed(() => volumeData.value?.dimensions ?? [64, 64, 64]);
    function persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(rois.value));
        }
        catch { /* 忽略存储失败 */ }
    }
    async function loadVolume() {
        loading.value = true;
        try {
            const { data } = await axios.post('/api/volume', {
                preset: preset.value, width: 64, height: 64, depth: 64
            });
            volumeData.value = data;
            const [d, h, w] = data.dimensions;
            mprSlice.value = { axial: Math.floor(d / 2), coronal: Math.floor(h / 2), sagittal: Math.floor(w / 2) };
            scheduleAnalyze();
        }
        finally {
            loading.value = false;
        }
    }
    // ---- ROI 增删改 ----
    function addROI(roi) {
        const [d, h, w] = dims.value;
        const item = {
            id: genId(),
            label: `roi-${rois.value.length + 1}`,
            shape: 'sphere',
            center: [Math.floor(w / 2), Math.floor(h / 2), Math.floor(d / 2)],
            radius: 6,
            ...roi,
        };
        rois.value.push(item);
        selectedROIId.value = item.id;
        persist();
        scheduleAnalyze();
        return item;
    }
    function removeROI(id) {
        rois.value = rois.value.filter(r => r.id !== id);
        if (selectedROIId.value === id)
            selectedROIId.value = null;
        persist();
        scheduleAnalyze();
    }
    function updateROI(id, patch) {
        const i = rois.value.findIndex(r => r.id === id);
        if (i >= 0) {
            rois.value[i] = { ...rois.value[i], ...patch };
            persist();
            scheduleAnalyze();
        }
    }
    function setTool(tool, plane) {
        activeTool.value = tool;
        activePlane.value = plane ?? null;
    }
    /** 本地参数校验：返回错误原因；null 表示可提交测量 */
    function validateROI(roi) {
        const [d, h, w] = dims.value;
        const [cx, cy, cz] = roi.center.map(v => Number(v));
        if (![cx, cy, cz].every(v => Number.isFinite(v)))
            return '中心坐标不是有效数字';
        const centerOutOfBounds = cx < 0 || cy < 0 || cz < 0 || cx >= w || cy >= h || cz >= d;
        const radiusInvalid = roi.shape === 'sphere' && (!(Number(roi.radius) > 0) || !Number.isFinite(Number(roi.radius)));
        const radiiInvalid = roi.shape === 'ellipsoid' &&
            (!roi.radii || roi.radii.length !== 3 || !roi.radii.every(v => Number(v) > 0 && Number.isFinite(Number(v))));
        if (roi.shape === 'polygon') {
            const pts = roi.points ?? [];
            if (pts.length < 3)
                return `多边形至少需要 3 个顶点（当前 ${pts.length} 个），继续在影像上单击添加顶点`;
            const axes = roi.plane === 'axial' ? ['x', 'y'] : roi.plane === 'coronal' ? ['x', 'z'] : ['y', 'z'];
            const maxU = axes[0] === 'x' ? w : h;
            const maxV = axes[1] === 'y' ? h : d;
            const inPlane = pts.every(([u, v]) => u >= 0 && u < maxU && v >= 0 && v < maxV);
            if (!inPlane)
                return '多边形顶点超出影像范围';
            const n = roi.plane === 'axial' ? d : roi.plane === 'coronal' ? h : w;
            if (roi.slice == null || roi.slice < 0 || roi.slice >= n)
                return `多边形所在切片超出影像范围（0~${n - 1}）`;
            return null;
        }
        if (roi.shape === 'box') {
            const s = roi.size ?? [];
            if (s.length !== 3 || !s.every(v => Number(v) > 0 && Number.isFinite(Number(v))))
                return '矩形长宽高必须均为正数';
            if (centerOutOfBounds)
                return `标记中心超出影像范围（允许范围 x:0~${w - 1} y:0~${h - 1} z:0~${d - 1}），范围内没有可测量体素`;
            return null;
        }
        if (radiusInvalid)
            return '半径必须为正数';
        if (radiiInvalid)
            return '椭圆三轴半径必须均为正数';
        if (centerOutOfBounds)
            return `标记中心超出影像范围（允许范围 x:0~${w - 1} y:0~${h - 1} z:0~${d - 1}），范围内没有可测量体素`;
        return null;
    }
    // ---- 测量 ----
    let analyzeTimer = null;
    function scheduleAnalyze() {
        if (analyzeTimer)
            clearTimeout(analyzeTimer);
        analyzeTimer = setTimeout(analyzeROIs, 300);
    }
    async function analyzeROIs() {
        if (!volumeData.value)
            return;
        if (analyzeTimer) {
            clearTimeout(analyzeTimer);
            analyzeTimer = null;
        }
        loading.value = true;
        analyzeError.value = '';
        // 先给出本地校验结果，避免请求期间看起来像“测量值丢失”
        roiResults.value = rois.value.map(r => {
            const reason = validateROI(r);
            return reason ? emptyResult(r, reason) : emptyResult(r, '正在测量…');
        });
        const payload = rois.value.map(r => ({
            id: r.id, label: r.label, shape: r.shape, center: r.center.map(Number),
            radius: r.radius, radii: r.radii, size: r.size,
            plane: r.plane, slice: r.slice, points: r.points,
        }));
        try {
            const { data } = await axios.post('/api/roi', { volume: volumeData.value.volume, rois: payload });
            const byId = new Map(data.rois.map(r => [String(r.id), r]));
            roiResults.value = rois.value.map(r => byId.get(r.id) ?? emptyResult(r, '测量失败：服务端未返回该标记的结果'));
        }
        catch (e) {
            analyzeError.value = e?.response?.data?.detail || e?.message || '测量请求失败，请重试';
        }
        finally {
            loading.value = false;
        }
    }
    function emptyResult(r, reason) {
        return {
            id: r.id, label: r.label, shape: r.shape, center: r.center,
            radius: r.radius, radii: r.radii, size: r.size, plane: r.plane, slice: r.slice, points: r.points,
            valid: !reason, reason: reason || undefined,
            mean: 0, std: 0, min: 0, max: 0, voxelCount: 0, histogram: [],
        };
    }
    function resultOf(id) {
        return roiResults.value.find(r => r.id === id);
    }
    return {
        loading, volumeData, preset, windowVal, levelVal, rois, roiResults, analyzeError,
        activeTool, activePlane, mprSlice, selectedROIId, dims,
        loadVolume, analyzeROIs, addROI, removeROI, updateROI, setTool, validateROI, resultOf,
    };
});
