/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, watch, onMounted } from 'vue';
const props = defineProps();
const cvs = ref();
function draw() {
    const c = cvs.value;
    if (!c)
        return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const bins = props.data;
    if (!bins.length)
        return;
    const max = Math.max(1, ...bins);
    const bw = W / bins.length;
    bins.forEach((v, i) => {
        const bh = Math.max(1, v / max * (H - 4));
        ctx.fillStyle = '#58a6ff';
        ctx.fillRect(i * bw + 0.5, H - bh, bw - 1, bh);
    });
}
watch(() => props.data, draw, { deep: true });
onMounted(draw);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.canvas, __VLS_intrinsicElements.canvas)({
    ref: "cvs",
    width: "220",
    height: "40",
    ...{ class: "hist-canvas" },
});
/** @type {typeof __VLS_ctx.cvs} */ ;
/** @type {__VLS_StyleScopedClasses['hist-canvas']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            cvs: cvs,
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
