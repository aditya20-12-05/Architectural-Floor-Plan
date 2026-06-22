import { FloorConfig, Room } from './types'
import { ThreeHandles } from './cameraApi'
import { PALETTE, roomNo } from './constants'

export function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function exportConfigJSON(config: FloorConfig): void {
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, 'floor-plan-config.json')
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function readConfigFile(file: File): Promise<unknown> {
  const text = await file.text()
  return JSON.parse(text)
}

// Render the WebGL view to a 2D canvas and composite the drafting overlays so
// the exported PNG is a complete blueprint sheet (labels + north arrow are
// already part of the 3D scene and therefore captured directly).
export function exportViewPNG(handles: ThreeHandles, config: FloorConfig): void {
  const { gl, scene, camera } = handles
  gl.render(scene, camera)
  const src = gl.domElement
  const W = src.width
  const H = src.height

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = PALETTE.bg
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(src, 0, 0, W, H)

  const k = W / 1600 // scale relative to a 1600px reference width

  drawFrame(ctx, W, H, k)
  if (config.view.schedule) drawSchedule(ctx, k, config.rooms)
  if (config.view.titleBlock) drawTitleBlock(ctx, W, H, k, config)

  triggerDownload(canvas.toDataURL('image/png'), 'floor-plan.png')
}

function drawFrame(ctx: CanvasRenderingContext2D, W: number, H: number, k: number): void {
  ctx.strokeStyle = 'rgba(14,58,92,0.85)'
  ctx.lineWidth = Math.max(1, 1.6 * k)
  const m1 = 18 * k
  ctx.strokeRect(m1, m1, W - 2 * m1, H - 2 * m1)
  ctx.lineWidth = Math.max(1, 1 * k)
  const m2 = 25 * k
  ctx.strokeRect(m2, m2, W - 2 * m2, H - 2 * m2)
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1)
  return t + '…'
}

function drawTitleBlock(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  k: number,
  config: FloorConfig
): void {
  const w = 330 * k
  const rowH = 30 * k
  const h = rowH * 4
  const x = W - 34 * k - w
  const y = H - 34 * k - h

  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = PALETTE.line
  ctx.lineWidth = Math.max(1, 1.2 * k)
  ctx.strokeRect(x, y, w, h)

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillStyle = PALETTE.line
  ctx.font = `600 ${14 * k}px 'Inter', system-ui, sans-serif`
  ctx.fillText(config.title.project.toUpperCase(), x + w / 2, y + rowH / 2)

  const rows: [string, string][] = [
    ['DRAWING', config.title.drawing],
    ['SCALE', config.title.scale],
    ['SHEET', config.title.sheet],
  ]
  const keyW = 84 * k
  rows.forEach(([key, val], idx) => {
    const ry = y + rowH * (idx + 1)
    ctx.strokeStyle = 'rgba(14,58,92,0.3)'
    ctx.lineWidth = Math.max(1, 0.8 * k)
    ctx.beginPath()
    ctx.moveTo(x, ry)
    ctx.lineTo(x + w, ry)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + keyW, ry)
    ctx.lineTo(x + keyW, ry + rowH)
    ctx.stroke()
    ctx.textAlign = 'left'
    ctx.fillStyle = PALETTE.cyan
    ctx.font = `${9 * k}px 'JetBrains Mono', monospace`
    ctx.fillText(key, x + 10 * k, ry + rowH / 2)
    ctx.fillStyle = PALETTE.line
    ctx.font = `${12 * k}px 'JetBrains Mono', monospace`
    ctx.fillText(ellipsize(ctx, val.toUpperCase(), w - keyW - 18 * k), x + keyW + 10 * k, ry + rowH / 2)
  })
}

function drawSchedule(ctx: CanvasRenderingContext2D, k: number, rooms: Room[]): void {
  const indexed = rooms.map((r, i) => ({ r, i }))
  const billable = indexed.filter((o) => o.r.category === 'Billable')
  const internal = indexed.filter((o) => o.r.category === 'Internal')

  const x = 34 * k
  const y = 34 * k
  const colW = 264 * k
  const lineH = 21 * k
  const groupH = 22 * k

  const groups = (billable.length ? 1 : 0) + (internal.length ? 1 : 0)
  const h = 30 * k + groups * groupH + (billable.length + internal.length) * lineH + 16 * k

  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.fillRect(x, y, colW, h)
  ctx.strokeStyle = 'rgba(14,58,92,0.28)'
  ctx.lineWidth = Math.max(1, 1 * k)
  ctx.strokeRect(x, y, colW, h)

  let cy = y + 18 * k
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillStyle = PALETTE.line
  ctx.font = `600 ${12 * k}px 'Inter', system-ui, sans-serif`
  ctx.fillText('ROOM SCHEDULE', x + colW / 2, cy)
  cy += 24 * k

  const drawGroup = (title: string, list: { r: Room; i: number }[]) => {
    if (!list.length) return
    ctx.textAlign = 'left'
    ctx.fillStyle = PALETTE.accent
    ctx.font = `600 ${9 * k}px 'Inter', system-ui, sans-serif`
    ctx.fillText(title.toUpperCase(), x + 12 * k, cy)
    cy += groupH - 4 * k
    for (const { r, i } of list) {
      ctx.font = `${11 * k}px 'JetBrains Mono', monospace`
      ctx.fillStyle = r.flagship ? PALETTE.accent : PALETTE.cyan
      ctx.textAlign = 'left'
      ctx.fillText(roomNo(i), x + 12 * k, cy)
      ctx.fillText(ellipsize(ctx, r.name.toUpperCase(), colW - 116 * k), x + 46 * k, cy)
      ctx.textAlign = 'right'
      ctx.fillText(String(Math.round(r.area)), x + colW - 12 * k, cy)
      cy += lineH
    }
    cy += 4 * k
  }

  drawGroup('Billable', billable)
  drawGroup('Internal', internal)
}
