/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { useImagingStore } from '../store/imaging';
import HistBars from './HistBars.vue';
const store = useImagingStore();
const SHAPE_NAMES = { sphere: '球体', ellipsoid: '椭圆', box: '矩形', polygon: '多边形' };
const PLANE_NAMES = { axial: '横断面', coronal: '冠状面', sagittal: '矢状面' };
function shapeName(s) { return SHAPE_NAMES[s]; }
function planeName(p) { return p ? PLANE_NAMES[p] : ''; }
function result(roi) { return store.resultOf(roi.id); }
function tagType(roi) {
    const r = result(roi);
    if (!r)
        return 'info';
    if (!r.valid)
        return r.reason === '正在测量…' ? 'info' : 'danger';
    return 'success';
}
function addSphere() {
    const [d, h, w] = store.dims;
    store.addROI({
        label: `sphere-${store.rois.length + 1}`,
        shape: 'sphere',
        center: [Math.floor(w / 2), Math.floor(h / 2), Math.floor(d / 2)],
        radius: 6,
    });
}
const TOOL_TEXT = {
    ellipsoid: '在切面上按住拖拽画出椭圆（第三轴半径取较短边）',
    box: '在切面上按住拖拽画出矩形（第三轴厚度取较短边）',
    polygon: '逐次单击添加顶点，双击 / 右键 / Enter 闭合，至少 3 个顶点',
};
const toolText = () => TOOL_TEXT[store.activeTool] ?? '';
function isTool(t) { return store.activeTool === t; }
function toggleTool(t) {
    if (store.activeTool === t)
        store.setTool('select');
    else
        store.setTool(t);
}
function touch(roi) {
    // el-input-number 清空时可能产生 null，统一规整为数字
    const center = roi.center.map(v => Number(v) || 0);
    const patch = { center };
    if (roi.shape === 'sphere')
        patch.radius = Number(roi.radius) || 0;
    if (roi.shape === 'ellipsoid' && roi.radii)
        patch.radii = roi.radii.map(v => Number(v) || 0);
    if (roi.shape === 'box' && roi.size)
        patch.size = roi.size.map(v => Number(v) || 0);
    store.updateROI(roi.id, patch);
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['roi-config']} */ ;
/** @type {__VLS_StyleScopedClasses['stat']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "toolbar" },
});
const __VLS_0 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onClick': {} },
    size: "small",
}));
const __VLS_2 = __VLS_1({
    ...{ 'onClick': {} },
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_4;
let __VLS_5;
let __VLS_6;
const __VLS_7 = {
    onClick: (__VLS_ctx.addSphere)
};
__VLS_3.slots.default;
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "tb-sep" },
});
const __VLS_8 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    ...{ 'onClick': {} },
    size: "small",
    type: (__VLS_ctx.isTool('ellipsoid') ? 'primary' : ''),
}));
const __VLS_10 = __VLS_9({
    ...{ 'onClick': {} },
    size: "small",
    type: (__VLS_ctx.isTool('ellipsoid') ? 'primary' : ''),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
let __VLS_12;
let __VLS_13;
let __VLS_14;
const __VLS_15 = {
    onClick: (...[$event]) => {
        __VLS_ctx.toggleTool('ellipsoid');
    }
};
__VLS_11.slots.default;
var __VLS_11;
const __VLS_16 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    ...{ 'onClick': {} },
    size: "small",
    type: (__VLS_ctx.isTool('box') ? 'primary' : ''),
}));
const __VLS_18 = __VLS_17({
    ...{ 'onClick': {} },
    size: "small",
    type: (__VLS_ctx.isTool('box') ? 'primary' : ''),
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
let __VLS_20;
let __VLS_21;
let __VLS_22;
const __VLS_23 = {
    onClick: (...[$event]) => {
        __VLS_ctx.toggleTool('box');
    }
};
__VLS_19.slots.default;
var __VLS_19;
const __VLS_24 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    ...{ 'onClick': {} },
    size: "small",
    type: (__VLS_ctx.isTool('polygon') ? 'primary' : ''),
}));
const __VLS_26 = __VLS_25({
    ...{ 'onClick': {} },
    size: "small",
    type: (__VLS_ctx.isTool('polygon') ? 'primary' : ''),
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
let __VLS_28;
let __VLS_29;
let __VLS_30;
const __VLS_31 = {
    onClick: (...[$event]) => {
        __VLS_ctx.toggleTool('polygon');
    }
};
__VLS_27.slots.default;
var __VLS_27;
if (__VLS_ctx.store.activeTool !== 'select') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "tool-tip" },
    });
    (__VLS_ctx.toolText);
}
if (!__VLS_ctx.store.rois.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "empty-state" },
    });
}
for (const [roi, i] of __VLS_getVForSourceType((__VLS_ctx.store.rois))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (roi.id),
        ...{ class: "roi-config" },
        ...{ class: ({ selected: __VLS_ctx.store.selectedROIId === roi.id }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "roi-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "roi-no" },
    });
    (i + 1);
    const __VLS_32 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        size: "small",
        type: (__VLS_ctx.tagType(roi)),
        effect: "dark",
    }));
    const __VLS_34 = __VLS_33({
        size: "small",
        type: (__VLS_ctx.tagType(roi)),
        effect: "dark",
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    __VLS_35.slots.default;
    (__VLS_ctx.shapeName(roi.shape));
    var __VLS_35;
    const __VLS_36 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        ...{ 'onChange': {} },
        modelValue: (roi.label),
        size: "small",
        placeholder: "标签",
        ...{ style: {} },
    }));
    const __VLS_38 = __VLS_37({
        ...{ 'onChange': {} },
        modelValue: (roi.label),
        size: "small",
        placeholder: "标签",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    let __VLS_40;
    let __VLS_41;
    let __VLS_42;
    const __VLS_43 = {
        onChange: (...[$event]) => {
            __VLS_ctx.touch(roi);
        }
    };
    var __VLS_39;
    const __VLS_44 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
        ...{ 'onClick': {} },
        size: "small",
        type: (__VLS_ctx.store.selectedROIId === roi.id ? 'primary' : 'default'),
        circle: true,
    }));
    const __VLS_46 = __VLS_45({
        ...{ 'onClick': {} },
        size: "small",
        type: (__VLS_ctx.store.selectedROIId === roi.id ? 'primary' : 'default'),
        circle: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    let __VLS_48;
    let __VLS_49;
    let __VLS_50;
    const __VLS_51 = {
        onClick: (...[$event]) => {
            __VLS_ctx.store.selectedROIId = __VLS_ctx.store.selectedROIId === roi.id ? null : roi.id;
        }
    };
    __VLS_47.slots.default;
    var __VLS_47;
    const __VLS_52 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        ...{ 'onClick': {} },
        size: "small",
        type: "danger",
        circle: true,
    }));
    const __VLS_54 = __VLS_53({
        ...{ 'onClick': {} },
        size: "small",
        type: "danger",
        circle: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    let __VLS_56;
    let __VLS_57;
    let __VLS_58;
    const __VLS_59 = {
        onClick: (...[$event]) => {
            __VLS_ctx.store.removeROI(roi.id);
        }
    };
    __VLS_55.slots.default;
    var __VLS_55;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "roi-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "lbl" },
    });
    const __VLS_60 = {}.ElInputNumber;
    /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        ...{ 'onChange': {} },
        modelValue: (roi.center[0]),
        size: "small",
        step: (1),
        controlsPosition: "right",
        ...{ style: {} },
    }));
    const __VLS_62 = __VLS_61({
        ...{ 'onChange': {} },
        modelValue: (roi.center[0]),
        size: "small",
        step: (1),
        controlsPosition: "right",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    let __VLS_64;
    let __VLS_65;
    let __VLS_66;
    const __VLS_67 = {
        onChange: (...[$event]) => {
            __VLS_ctx.touch(roi);
        }
    };
    var __VLS_63;
    const __VLS_68 = {}.ElInputNumber;
    /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        ...{ 'onChange': {} },
        modelValue: (roi.center[1]),
        size: "small",
        step: (1),
        controlsPosition: "right",
        ...{ style: {} },
    }));
    const __VLS_70 = __VLS_69({
        ...{ 'onChange': {} },
        modelValue: (roi.center[1]),
        size: "small",
        step: (1),
        controlsPosition: "right",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    let __VLS_72;
    let __VLS_73;
    let __VLS_74;
    const __VLS_75 = {
        onChange: (...[$event]) => {
            __VLS_ctx.touch(roi);
        }
    };
    var __VLS_71;
    const __VLS_76 = {}.ElInputNumber;
    /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
    // @ts-ignore
    const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
        ...{ 'onChange': {} },
        modelValue: (roi.center[2]),
        size: "small",
        step: (1),
        controlsPosition: "right",
        ...{ style: {} },
    }));
    const __VLS_78 = __VLS_77({
        ...{ 'onChange': {} },
        modelValue: (roi.center[2]),
        size: "small",
        step: (1),
        controlsPosition: "right",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_77));
    let __VLS_80;
    let __VLS_81;
    let __VLS_82;
    const __VLS_83 = {
        onChange: (...[$event]) => {
            __VLS_ctx.touch(roi);
        }
    };
    var __VLS_79;
    if (roi.shape === 'sphere') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "roi-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "lbl" },
        });
        const __VLS_84 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
            ...{ 'onChange': {} },
            modelValue: (roi.radius),
            size: "small",
            step: (1),
            controlsPosition: "right",
            ...{ style: {} },
        }));
        const __VLS_86 = __VLS_85({
            ...{ 'onChange': {} },
            modelValue: (roi.radius),
            size: "small",
            step: (1),
            controlsPosition: "right",
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_85));
        let __VLS_88;
        let __VLS_89;
        let __VLS_90;
        const __VLS_91 = {
            onChange: (...[$event]) => {
                if (!(roi.shape === 'sphere'))
                    return;
                __VLS_ctx.touch(roi);
            }
        };
        var __VLS_87;
    }
    else if (roi.shape === 'ellipsoid') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "roi-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "lbl" },
        });
        const __VLS_92 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
            ...{ 'onChange': {} },
            modelValue: (roi.radii[0]),
            size: "small",
            step: (1),
            controlsPosition: "right",
            ...{ style: {} },
        }));
        const __VLS_94 = __VLS_93({
            ...{ 'onChange': {} },
            modelValue: (roi.radii[0]),
            size: "small",
            step: (1),
            controlsPosition: "right",
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_93));
        let __VLS_96;
        let __VLS_97;
        let __VLS_98;
        const __VLS_99 = {
            onChange: (...[$event]) => {
                if (!!(roi.shape === 'sphere'))
                    return;
                if (!(roi.shape === 'ellipsoid'))
                    return;
                __VLS_ctx.touch(roi);
            }
        };
        var __VLS_95;
        const __VLS_100 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
            ...{ 'onChange': {} },
            modelValue: (roi.radii[1]),
            size: "small",
            step: (1),
            controlsPosition: "right",
            ...{ style: {} },
        }));
        const __VLS_102 = __VLS_101({
            ...{ 'onChange': {} },
            modelValue: (roi.radii[1]),
            size: "small",
            step: (1),
            controlsPosition: "right",
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_101));
        let __VLS_104;
        let __VLS_105;
        let __VLS_106;
        const __VLS_107 = {
            onChange: (...[$event]) => {
                if (!!(roi.shape === 'sphere'))
                    return;
                if (!(roi.shape === 'ellipsoid'))
                    return;
                __VLS_ctx.touch(roi);
            }
        };
        var __VLS_103;
        const __VLS_108 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
            ...{ 'onChange': {} },
            modelValue: (roi.radii[2]),
            size: "small",
            step: (1),
            controlsPosition: "right",
            ...{ style: {} },
        }));
        const __VLS_110 = __VLS_109({
            ...{ 'onChange': {} },
            modelValue: (roi.radii[2]),
            size: "small",
            step: (1),
            controlsPosition: "right",
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_109));
        let __VLS_112;
        let __VLS_113;
        let __VLS_114;
        const __VLS_115 = {
            onChange: (...[$event]) => {
                if (!!(roi.shape === 'sphere'))
                    return;
                if (!(roi.shape === 'ellipsoid'))
                    return;
                __VLS_ctx.touch(roi);
            }
        };
        var __VLS_111;
    }
    else if (roi.shape === 'box') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "roi-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "lbl" },
        });
        const __VLS_116 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
            ...{ 'onChange': {} },
            modelValue: (roi.size[0]),
            size: "small",
            step: (1),
            controlsPosition: "right",
            ...{ style: {} },
        }));
        const __VLS_118 = __VLS_117({
            ...{ 'onChange': {} },
            modelValue: (roi.size[0]),
            size: "small",
            step: (1),
            controlsPosition: "right",
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_117));
        let __VLS_120;
        let __VLS_121;
        let __VLS_122;
        const __VLS_123 = {
            onChange: (...[$event]) => {
                if (!!(roi.shape === 'sphere'))
                    return;
                if (!!(roi.shape === 'ellipsoid'))
                    return;
                if (!(roi.shape === 'box'))
                    return;
                __VLS_ctx.touch(roi);
            }
        };
        var __VLS_119;
        const __VLS_124 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
            ...{ 'onChange': {} },
            modelValue: (roi.size[1]),
            size: "small",
            step: (1),
            controlsPosition: "right",
            ...{ style: {} },
        }));
        const __VLS_126 = __VLS_125({
            ...{ 'onChange': {} },
            modelValue: (roi.size[1]),
            size: "small",
            step: (1),
            controlsPosition: "right",
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_125));
        let __VLS_128;
        let __VLS_129;
        let __VLS_130;
        const __VLS_131 = {
            onChange: (...[$event]) => {
                if (!!(roi.shape === 'sphere'))
                    return;
                if (!!(roi.shape === 'ellipsoid'))
                    return;
                if (!(roi.shape === 'box'))
                    return;
                __VLS_ctx.touch(roi);
            }
        };
        var __VLS_127;
        const __VLS_132 = {}.ElInputNumber;
        /** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
        // @ts-ignore
        const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
            ...{ 'onChange': {} },
            modelValue: (roi.size[2]),
            size: "small",
            step: (1),
            controlsPosition: "right",
            ...{ style: {} },
        }));
        const __VLS_134 = __VLS_133({
            ...{ 'onChange': {} },
            modelValue: (roi.size[2]),
            size: "small",
            step: (1),
            controlsPosition: "right",
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_133));
        let __VLS_136;
        let __VLS_137;
        let __VLS_138;
        const __VLS_139 = {
            onChange: (...[$event]) => {
                if (!!(roi.shape === 'sphere'))
                    return;
                if (!!(roi.shape === 'ellipsoid'))
                    return;
                if (!(roi.shape === 'box'))
                    return;
                __VLS_ctx.touch(roi);
            }
        };
        var __VLS_135;
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "roi-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "lbl" },
        });
        (__VLS_ctx.planeName(roi.plane));
        (roi.slice);
        (roi.points?.length ?? 0);
    }
    if (__VLS_ctx.result(roi)?.reason && !__VLS_ctx.result(roi)?.valid) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "result-invalid" },
        });
        (__VLS_ctx.result(roi)?.reason);
    }
    if (__VLS_ctx.result(roi)?.valid) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "r-stats" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)({});
        (__VLS_ctx.result(roi)?.mean);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)({});
        (__VLS_ctx.result(roi)?.std);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)({});
        (__VLS_ctx.result(roi)?.min);
        (__VLS_ctx.result(roi)?.max);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)({});
        (__VLS_ctx.result(roi)?.voxelCount);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "hist-wrap" },
        });
        /** @type {[typeof HistBars, ]} */ ;
        // @ts-ignore
        const __VLS_140 = __VLS_asFunctionalComponent(HistBars, new HistBars({
            data: (__VLS_ctx.result(roi)?.histogram ?? []),
        }));
        const __VLS_141 = __VLS_140({
            data: (__VLS_ctx.result(roi)?.histogram ?? []),
        }, ...__VLS_functionalComponentArgsRest(__VLS_140));
    }
}
if (__VLS_ctx.store.analyzeError) {
    const __VLS_143 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    const __VLS_144 = __VLS_asFunctionalComponent(__VLS_143, new __VLS_143({
        title: (__VLS_ctx.store.analyzeError),
        type: "error",
        closable: (false),
        ...{ style: {} },
    }));
    const __VLS_145 = __VLS_144({
        title: (__VLS_ctx.store.analyzeError),
        type: "error",
        closable: (false),
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_144));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "reanalyze" },
});
const __VLS_147 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_148 = __VLS_asFunctionalComponent(__VLS_147, new __VLS_147({
    ...{ 'onClick': {} },
    type: "success",
    size: "small",
    loading: (__VLS_ctx.store.loading),
}));
const __VLS_149 = __VLS_148({
    ...{ 'onClick': {} },
    type: "success",
    size: "small",
    loading: (__VLS_ctx.store.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_148));
let __VLS_151;
let __VLS_152;
let __VLS_153;
const __VLS_154 = {
    onClick: (...[$event]) => {
        __VLS_ctx.store.analyzeROIs();
    }
};
__VLS_150.slots.default;
var __VLS_150;
if (__VLS_ctx.store.loading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "measuring" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "persist-hint" },
    });
}
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['tb-sep']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-tip']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
/** @type {__VLS_StyleScopedClasses['roi-config']} */ ;
/** @type {__VLS_StyleScopedClasses['roi-row']} */ ;
/** @type {__VLS_StyleScopedClasses['roi-no']} */ ;
/** @type {__VLS_StyleScopedClasses['roi-row']} */ ;
/** @type {__VLS_StyleScopedClasses['lbl']} */ ;
/** @type {__VLS_StyleScopedClasses['roi-row']} */ ;
/** @type {__VLS_StyleScopedClasses['lbl']} */ ;
/** @type {__VLS_StyleScopedClasses['roi-row']} */ ;
/** @type {__VLS_StyleScopedClasses['lbl']} */ ;
/** @type {__VLS_StyleScopedClasses['roi-row']} */ ;
/** @type {__VLS_StyleScopedClasses['lbl']} */ ;
/** @type {__VLS_StyleScopedClasses['roi-row']} */ ;
/** @type {__VLS_StyleScopedClasses['lbl']} */ ;
/** @type {__VLS_StyleScopedClasses['result-invalid']} */ ;
/** @type {__VLS_StyleScopedClasses['r-stats']} */ ;
/** @type {__VLS_StyleScopedClasses['stat']} */ ;
/** @type {__VLS_StyleScopedClasses['stat']} */ ;
/** @type {__VLS_StyleScopedClasses['stat']} */ ;
/** @type {__VLS_StyleScopedClasses['stat']} */ ;
/** @type {__VLS_StyleScopedClasses['hist-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['reanalyze']} */ ;
/** @type {__VLS_StyleScopedClasses['measuring']} */ ;
/** @type {__VLS_StyleScopedClasses['persist-hint']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            HistBars: HistBars,
            store: store,
            shapeName: shapeName,
            planeName: planeName,
            result: result,
            tagType: tagType,
            addSphere: addSphere,
            toolText: toolText,
            isTool: isTool,
            toggleTool: toggleTool,
            touch: touch,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
