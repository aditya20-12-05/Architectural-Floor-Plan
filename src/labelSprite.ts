import * as THREE from 'three'
import { PALETTE } from './constants'

export interface LabelContent {
  number?: string // omit → number line hidden
  name: string
  area: string
  highlight: boolean // flagship or selected → accent colour
}

const CW = 512
const CH = 256

// Sprite world size (keeps the 2:1 texture aspect).
export const LABEL_W = 6.4
export const LABEL_H = 3.2

export function makeLabelTexture(c: LabelContent): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = CW
  canvas.height = CH
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, CW, CH)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  try {
    // letterSpacing is supported on Canvas2D in modern Chromium.
    ;(ctx as unknown as { letterSpacing: string }).letterSpacing = '3px'
  } catch {
    /* ignore */
  }

  const main = c.highlight ? PALETTE.accent : PALETTE.line
  const sub = c.highlight ? PALETTE.accent : PALETTE.cyan
  const hasNum = !!c.number

  let y = hasNum ? 60 : 96
  if (hasNum) {
    ctx.fillStyle = sub
    ctx.font = "600 40px 'JetBrains Mono', monospace"
    ctx.fillText(c.number!.toUpperCase(), CW / 2, y)
    y += 68
  }

  ctx.fillStyle = main
  const nameFont = "700 50px 'Inter', system-ui, sans-serif"
  ctx.font = nameFont
  ctx.fillText(fit(ctx, c.name.toUpperCase(), CW - 36, nameFont), CW / 2, y)
  y += 60

  ctx.fillStyle = sub
  ctx.font = "500 36px 'JetBrains Mono', monospace"
  ctx.fillText(c.area.toUpperCase(), CW / 2, y)

  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 4
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: string): string {
  ctx.font = font
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 2 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1)
  return t + '…'
}
