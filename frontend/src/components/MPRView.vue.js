/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { useImagingStore } from '../store/imaging';
const props = defineProps();
const store = useImagingStore();
const cvs = ref();
const PLANE_NAMES = { axial: '横断面', coronal: '冠状面', sagittal: '矢状面' };
const planeName = computed(() => PLANE_NAMES[props.plane]);
const sliceIdx = computed(() => store.mprSlice[props.plane]);
const maxSlice = computed(() => {
    const [d, h, w] = store.dims;
    return props.plane === 'axial' ? d - 1 : props.plane === 'coronal' ? h - 1 : w - 1;
});
const draft = ref(null);
const hover = ref(null);
const draftShape = computed(() => {
    if (draft.value?.kind === 'drag')
        return draft.value.shape;
    if (draft.value?.kind === 'polygon')
        return 'polygon';
    return null;
});
const isDrawingPlane = computed(() => (store.activeTool === 'ellipsoid' || store.activeTool === 'box' || store.activeTool === 'polygon')
    && (store.activePlane === null || store.activePlane === props.plane));
const hint = computed(() => {
    if (!isDrawingPlane.value)
        return '';
    if (draft.value?.kind === 'polygon')
        return '单击添加顶点，双击 / 右键 / 点“完成”闭合';
    if (store.activeTool === 'polygon')
        return '单击影像添加多边形顶点（至少 3 个），双击完成，Esc 取消';
    return `在影像上按住鼠标拖拽绘制${store.activeTool === 'box' ? '矩形' : '椭圆'}，Esc 取消`;
});
function onSliceInput(e) {
    const v = Number(e.target.value);
    store.mprSlice[props.plane] = v;
}
// 体素坐标 <-> 画布坐标
function toVoxel(e) {
    const c = cvs.value;
    const rect = c.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width * c.width;
    const py = (e.clientY - rect.top) / rect.height * c.height;
    const [d, h, w] = store.dims;
    const cols = props.plane === 'sagittal' ? h : w;
    const rows = d;
    return [px / c.width * cols, py / c.height * rows];
}
function cellSize() {
    const c = cvs.value;
    const [d, h, w] = store.dims;
    const cols = props.plane === 'sagittal' ? h : w;
    const rows = d;
    return { sx: c.width / cols, sy: c.height / rows };
}
// ROI 中心在当前平面的 (u, v, n)
function roiUVN(roi) {
    const [cx, cy, cz] = roi.center;
    if (props.plane === 'axial')
        return [cx, cy, cz];
    if (props.plane === 'coronal')
        return [cx, cz, cy];
    return [cy, cz, cx];
}
// 当前平面对应的三轴尺寸索引（x/y/z 轴序号）
function planeAxes() {
    if (props.plane === 'axial')
        return [0, 1]; // u=x, v=y
    if (props.plane === 'coronal')
        return [0, 2]; // u=x, v=z
    return [1, 2]; // u=y, v=z
}
const PALETTE = ['#58a6ff', '#3fb950', '#d29922', '#bc8cff', '#f778ba', '#39c5cf'];
function colorFor(id) {
    let h = 0;
    for (const ch of id)
        h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
}
function draw() {
    const c = cvs.value;
    if (!c)
        return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);
    const vd = store.volumeData;
    if (!vd)
        return;
    const sl = sliceIdx.value;
    const [d, h, w] = vd.dimensions;
    const cols = props.plane === 'sagittal' ? h : w;
    const rows = d;
    const cellW = W / cols, cellH = H / rows;
    // 窗宽窗位：lower = WL - WW/2，upper = WL + WW/2
    const ww = store.windowVal, wl = store.levelVal;
    const lower = wl - ww / 2, upper = wl + ww / 2;
    for (let v = 0; v < rows; v++) {
        for (let u = 0; u < cols; u++) {
            let val;
            if (props.plane === 'axial')
                val = vd.volume[sl][v][u];
            else if (props.plane === 'coronal')
                val = vd.volume[v][sl][u];
            else
                val = vd.volume[v][u][sl];
            let t = (val - lower) / (upper - lower);
            t = Math.max(0, Math.min(1, t));
            const gray = Math.floor(t * 255);
            ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
            ctx.fillRect(u * cellW, v * cellH, cellW + 0.5, cellH + 0.5);
        }
    }
    // 叠加标记
    for (const roi of store.rois) {
        const invalid = !!store.validateROI(roi);
        drawROI(ctx, roi, sl, cellW, cellH, invalid);
    }
    drawDraft(ctx, cellW, cellH);
}
function drawROI(ctx, roi, sl, cellW, cellH, invalid) {
    const [cu, cv, cn] = roiUVN(roi);
    const X = (u) => u * cellW;
    const Y = (v) => v * cellH;
    const selected = store.selectedROIId === roi.id;
    const color = invalid ? '#f85149' : colorFor(roi.id);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = selected ? 2.4 : 1.4;
    if (selected) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
    }
    if (invalid)
        ctx.setLineDash([4, 3]);
    let drawCross = true;
    if (roi.shape === 'polygon') {
        if (roi.plane !== props.plane || roi.slice !== sl || !roi.points?.length) {
            ctx.restore();
            return;
        }
        ctx.beginPath();
        roi.points.forEach(([u, v], i) => i === 0 ? ctx.moveTo(X(u), Y(v)) : ctx.lineTo(X(u), Y(v)));
        ctx.closePath();
        ctx.fillStyle = color + '33';
        ctx.fill();
        ctx.stroke();
        // 顶点
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        for (const [u, v] of roi.points) {
            ctx.beginPath();
            ctx.arc(X(u), Y(v), 2.2, 0, Math.PI * 2);
            ctx.fill();
        }
        drawCross = false;
    }
    else if (roi.shape === 'box' && roi.size && roi.size.length === 3) {
        const [ia, ib] = planeAxes();
        const normalAxis = [0, 1, 2].find(a => a !== ia && a !== ib);
        const sa = roi.size[ia], sb = roi.size[ib], sn = roi.size[normalAxis];
        if (Math.abs(cn - sl) > sn / 2) {
            ctx.restore();
            return;
        }
        ctx.strokeRect(X(cu - sa / 2), Y(cv - sb / 2), sa * cellW, sb * cellH);
        ctx.fillStyle = color + '26';
        ctx.fillRect(X(cu - sa / 2), Y(cv - sb / 2), sa * cellW, sb * cellH);
    }
    else if (roi.shape === 'ellipsoid' && roi.radii && roi.radii.length === 3) {
        const [ia, ib] = planeAxes();
        const normalAxis = [0, 1, 2].find(a => a !== ia && a !== ib);
        const ra = roi.radii[ia], rb = roi.radii[ib], rc = roi.radii[normalAxis];
        const dn = sl - cn;
        const scale = Math.sqrt(Math.max(0, 1 - (dn / rc) ** 2));
        if (scale <= 0.001) {
            ctx.restore();
            return;
        }
        ctx.beginPath();
        ctx.ellipse(X(cu), Y(cv), ra * scale * cellW, rb * scale * cellH, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = color + '26';
        ctx.fill();
    }
    else if (roi.shape === 'sphere' && roi.radius) {
        const dn = sl - cn;
        if (Math.abs(dn) > roi.radius) {
            ctx.restore();
            return;
        }
        const r = Math.sqrt(Math.max(0, roi.radius ** 2 - dn ** 2));
        ctx.beginPath();
        ctx.ellipse(X(cu), Y(cv), r * cellW, r * cellH, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = color + '26';
        ctx.fill();
    }
    // 中心十字
    if (drawCross) {
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(X(cu) - 4, Y(cv));
        ctx.lineTo(X(cu) + 4, Y(cv));
        ctx.moveTo(X(cu), Y(cv) - 4);
        ctx.lineTo(X(cu), Y(cv) + 4);
        ctx.stroke();
    }
    // 标签
    ctx.setLineDash([]);
    ctx.font = '10px system-ui';
    ctx.fillStyle = color;
    ctx.fillText(roi.label + (invalid ? ' ⚠' : ''), X(cu) + 6, Math.max(10, Y(cv) - 6));
    ctx.restore();
}
function drawDraft(ctx, cellW, cellH) {
    const d = draft.value;
    if (!d)
        return;
    const X = (u) => u * cellW;
    const Y = (v) => v * cellH;
    ctx.save();
    ctx.strokeStyle = '#e6edf3';
    ctx.fillStyle = '#e6edf3';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 3]);
    if (d.kind === 'drag') {
        const u0 = Math.min(d.u0, d.u), v0 = Math.min(d.v0, d.v);
        const su = Math.abs(d.u - d.u0), sv = Math.abs(d.v - d.v0);
        if (d.shape === 'box') {
            ctx.strokeRect(X(u0), Y(v0), su * cellW, sv * cellH);
        }
        else {
            ctx.beginPath();
            ctx.ellipse(X((d.u0 + d.u) / 2), Y((d.v0 + d.v) / 2), su / 2 * cellW, sv / 2 * cellH, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    else {
        ctx.beginPath();
        d.pts.forEach(([u, v], i) => i === 0 ? ctx.moveTo(X(u), Y(v)) : ctx.lineTo(X(u), Y(v)));
        if (hover.value && store.activePlane === props.plane)
            ctx.lineTo(X(hover.value[0]), Y(hover.value[1]));
        ctx.stroke();
        ctx.setLineDash([]);
        for (const [u, v] of d.pts) {
            ctx.beginPath();
            ctx.arc(X(u), Y(v), 2.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}
// ---- 鼠标交互 ----
function onMouseDown(e) {
    if (!store.volumeData)
        return;
    if (e.button !== 0)
        return;
    const tool = store.activeTool;
    const [u, v] = toVoxel(e);
    if (tool === 'ellipsoid' || tool === 'box') {
        if (store.activePlane && store.activePlane !== props.plane)
            return;
        store.setTool(tool, props.plane);
        draft.value = { kind: 'drag', shape: tool, u0: u, v0: v, u, v };
    }
}
function onMouseMove(e) {
    const [u, v] = toVoxel(e);
    hover.value = [u, v];
    const d = draft.value;
    if (d?.kind === 'drag') {
        d.u = u;
        d.v = v;
    }
}
function onMouseUp() {
    const d = draft.value;
    if (d?.kind !== 'drag')
        return;
    const su = Math.max(1, Math.round(Math.abs(d.u - d.u0)));
    const sv = Math.max(1, Math.round(Math.abs(d.v - d.v0)));
    if (su < 1 || sv < 1) {
        cancelDraw();
        return;
    }
    const cu = (d.u0 + d.u) / 2, cv = (d.v0 + d.v) / 2, cn = sliceIdx.value;
    const center = backToXYZ(cu, cv, cn).map(Math.round);
    const sn = Math.min(su, sv);
    if (d.shape === 'box') {
        const size = planeToXYZ(su, sv, sn);
        store.addROI({ label: `box-${store.rois.length + 1}`, shape: 'box', center, size });
    }
    else {
        const radii = planeToXYZ(su, sv, sn);
        store.addROI({ label: `ellipse-${store.rois.length + 1}`, shape: 'ellipsoid', center, radii });
    }
    draft.value = null;
    store.setTool('select');
}
function onClick(e) {
    if (!store.volumeData)
        return;
    const [u, v] = toVoxel(e);
    if (store.activeTool === 'polygon') {
        if (store.activePlane && store.activePlane !== props.plane)
            return;
        const d = draft.value;
        if (!d || d.kind !== 'polygon') {
            store.setTool('polygon', props.plane);
            draft.value = { kind: 'polygon', pts: [[u, v]] };
        }
        else {
            d.pts.push([u, v]);
        }
        return;
    }
    if (store.activeTool === 'select') {
        // 点中标记中心则选中
        let hit = null;
        for (const roi of store.rois) {
            const [cu, cv] = roiUVN(roi);
            if (Math.hypot(cu - u, cv - v) < 3) {
                hit = roi;
                break;
            }
        }
        store.selectedROIId = hit ? hit.id : null;
    }
}
function onDblClick(e) {
    const d = draft.value;
    if (d?.kind === 'polygon' && store.activePlane === props.plane) {
        e.preventDefault();
        // 双击会先触发两次 click，最后一个顶点是重复点，剔除后再闭合
        if (d.pts.length >= 2)
            d.pts.pop();
        finishPolygon();
    }
}
function onContextMenu(e) {
    const d = draft.value;
    if (d?.kind === 'polygon' && store.activePlane === props.plane) {
        e.preventDefault();
        finishPolygon();
    }
}
function finishPolygon() {
    const d = draft.value;
    if (!d || d.kind !== 'polygon' || d.pts.length < 3)
        return;
    const pts = d.pts.map(([u, v]) => [Math.round(u), Math.round(v)]);
    const cu = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cv = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const center = backToXYZ(cu, cv, sliceIdx.value).map(Math.round);
    store.addROI({
        label: `poly-${store.rois.length + 1}`, shape: 'polygon', center,
        plane: props.plane, slice: sliceIdx.value, points: pts,
    });
    cancelDraw();
}
function cancelDraw() {
    draft.value = null;
    hover.value = null;
    store.setTool('select');
}
function onKey(e) {
    if (e.key === 'Escape')
        cancelDraw();
    if (e.key === 'Enter' && draft.value?.kind === 'polygon')
        finishPolygon();
}
// 当前平面 (u,v,n) 还原到 xyz
function backToXYZ(u, v, n) {
    if (props.plane === 'axial')
        return [u, v, n];
    if (props.plane === 'coronal')
        return [u, n, v];
    return [n, u, v];
}
// 当前平面 (u,v,n) 三个方向的尺寸映射到 xyz
function planeToXYZ(su, sv, sn) {
    if (props.plane === 'axial')
        return [su, sv, sn];
    if (props.plane === 'coronal')
        return [su, sn, sv];
    return [sn, su, sv];
}
watch(() => store.volumeData, draw, { deep: true });
watch(() => [store.windowVal, store.levelVal], draw);
watch(() => store.mprSlice[props.plane], draw);
watch(() => store.rois, draw, { deep: true });
watch(() => [store.selectedROIId, store.activeTool, store.activePlane], draw);
watch(draft, draw, { deep: true });
watch(hover, draw);
onMounted(() => { draw(); window.addEventListener('keydown', onKey); });
onUnmounted(() => window.removeEventListener('keydown', onKey));
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['mpr-canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['poly-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['poly-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['poly-actions']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "mpr-wrap" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.canvas, __VLS_intrinsicElements.canvas)({
    ...{ onMousedown: (__VLS_ctx.onMouseDown) },
    ...{ onMousemove: (__VLS_ctx.onMouseMove) },
    ...{ onMouseup: (__VLS_ctx.onMouseUp) },
    ...{ onClick: (__VLS_ctx.onClick) },
    ...{ onDblclick: (__VLS_ctx.onDblClick) },
    ...{ onContextmenu: (__VLS_ctx.onContextMenu) },
    ref: "cvs",
    width: "256",
    height: "256",
    ...{ class: "mpr-canvas" },
    ...{ class: ({ drawing: __VLS_ctx.isDrawingPlane }) },
});
/** @type {typeof __VLS_ctx.cvs} */ ;
if (__VLS_ctx.hint) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "draw-hint" },
    });
    (__VLS_ctx.hint);
}
if (__VLS_ctx.draftShape === 'polygon' && __VLS_ctx.draft && 'pts' in __VLS_ctx.draft) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "poly-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.draft.pts.length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.finishPolygon) },
        disabled: (__VLS_ctx.draft.pts.length < 3),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.cancelDraw) },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onInput: (__VLS_ctx.onSliceInput) },
    type: "range",
    ...{ class: "slider" },
    min: (0),
    max: (__VLS_ctx.maxSlice),
    value: (__VLS_ctx.sliceIdx),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "slice-info" },
});
(__VLS_ctx.planeName);
(__VLS_ctx.sliceIdx);
(__VLS_ctx.maxSlice);
/** @type {__VLS_StyleScopedClasses['mpr-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['mpr-canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['draw-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['poly-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['slider']} */ ;
/** @type {__VLS_StyleScopedClasses['slice-info']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            cvs: cvs,
            planeName: planeName,
            sliceIdx: sliceIdx,
            maxSlice: maxSlice,
            draft: draft,
            draftShape: draftShape,
            isDrawingPlane: isDrawingPlane,
            hint: hint,
            onSliceInput: onSliceInput,
            onMouseDown: onMouseDown,
            onMouseMove: onMouseMove,
            onMouseUp: onMouseUp,
            onClick: onClick,
            onDblClick: onDblClick,
            onContextMenu: onContextMenu,
            finishPolygon: finishPolygon,
            cancelDraw: cancelDraw,
        };
    },
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
