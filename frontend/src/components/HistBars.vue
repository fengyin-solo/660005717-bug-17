<template>
  <canvas ref="cvs" width="220" height="40" class="hist-canvas"></canvas>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const props = defineProps<{ data: number[] }>()
const cvs = ref<HTMLCanvasElement>()

function draw() {
  const c = cvs.value
  if (!c) return
  const ctx = c.getContext('2d')!
  const W = c.width, H = c.height
  ctx.clearRect(0, 0, W, H)
  const bins = props.data
  if (!bins.length) return
  const max = Math.max(1, ...bins)
  const bw = W / bins.length
  bins.forEach((v, i) => {
    const bh = Math.max(1, v / max * (H - 4))
    ctx.fillStyle = '#58a6ff'
    ctx.fillRect(i * bw + 0.5, H - bh, bw - 1, bh)
  })
}

watch(() => props.data, draw, { deep: true })
onMounted(draw)
</script>

<style scoped>
.hist-canvas { width: 100%; height: 40px; background: #0d1117; border-radius: 3px; display: block }
</style>
