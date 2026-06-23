import { FloorConfig, Room } from './types'
import { computeLayout, RoomFootprint } from './layout'
import { roomNo, GRID_FT } from './constants'

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

// ---------------------------------------------------------------------------
// Poster PNG export — a self-contained dark "blueprint sheet": navy grid, a
// vector isometric of the plan drawn from the room footprints (so it never
// depends on the on-screen WebGL theme), a Billable/Internal room schedule,
// masthead and title block.
// ---------------------------------------------------------------------------

const REF_W = 2000
const REF_H = 1086
const SS = 1.5 // supersample → crisp 3000×1629 PNG

const C = {
  bg: '#0e2c49',
  frame: 'rgba(159,187,216,0.30)',
  grid: 'rgba(140,176,212,0.055)',
  ink: '#eef4fb',
  inkSoft: 'rgba(223,235,248,0.55)',
  inkFaint: 'rgba(223,235,248,0.32)',
  accent: '#d2632f',
  accentSoft: '#b9542a',
  cyan: '#9fbcda',
  topFill: 'rgba(180,208,236,0.06)',
  leftFill: 'rgba(7,24,42,0.55)',
  rightFill: 'rgba(150,182,214,0.05)',
  slabLine: 'rgba(150,182,214,0.16)',
}

const ISO_C = Math.cos(Math.PI / 6)
const ISO_S = Math.sin(Math.PI / 6)
type P2 = { x: number; y: number }
function iso(wx: number, wz: number, wy: number): P2 {
  return { x: (wx - wz) * ISO_C, y: (wx + wz) * ISO_S - wy }
}

function withLetterSpacing(ctx: CanvasRenderingContext2D, px: number, fn: () => void): void {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  const prev = c.letterSpacing ?? '0px'
  try {
    c.letterSpacing = `${px}px`
    fn()
  } finally {
    c.letterSpacing = prev
  }
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1)
  return t + '…'
}

export async function exportPosterPNG(config: FloorConfig): Promise<void> {
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready
  } catch {
    /* fonts best-effort */
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(REF_W * SS)
  canvas.height = Math.round(REF_H * SS)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(SS, 0, 0, SS, 0, 0)
  ctx.textBaseline = 'alphabetic'

  // background + blueprint grid + frame
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, REF_W, REF_H)
  drawGrid(ctx)
  ctx.strokeStyle = C.frame
  ctx.lineWidth = 1.4
  ctx.strokeRect(26, 26, REF_W - 52, REF_H - 52)

  const t = config.title
  drawMasthead(ctx, t.brand || 'THE SPACE', t.headline || 'The floor, drawn to plan.')

  // plan area (left) — vector isometric drawn from the footprints
  const layout = computeLayout(config)
  drawPlan(ctx, config, layout, { x: 58, y: 236, w: 1250, h: 672 })

  drawSchedule(ctx, config.rooms, { x: 1378, y: 232, w: 566, bottom: 1024 })
  drawTitleBlock(ctx, t, { x: 58, y: 928, w: 1250, h: 96 })

  // page number from the sheet code (trailing digits)
  const pageNo = (t.sheet.match(/(\d+)\s*$/)?.[1] || '01').padStart(2, '0')
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = C.inkFaint
  ctx.font = `500 13px 'JetBrains Mono', monospace`
  ctx.fillText(pageNo, REF_W - 40, REF_H - 40)

  triggerDownload(canvas.toDataURL('image/png'), 'floor-plan-poster.png')
}

function drawGrid(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = C.grid
  ctx.lineWidth = 1
  const step = 48
  ctx.beginPath()
  for (let x = 0; x <= REF_W; x += step) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, REF_H)
  }
  for (let y = 0; y <= REF_H; y += step) {
    ctx.moveTo(0, y)
    ctx.lineTo(REF_W, y)
  }
  ctx.stroke()
}

function drawMasthead(ctx: CanvasRenderingContext2D, brand: string, headline: string): void {
  // isometric cube mark
  const cx = 92
  const cy = 96
  const r = 21
  const rH = 19
  const top: P2[] = [
    { x: cx, y: cy - r * 0.5 },
    { x: cx + r, y: cy },
    { x: cx, y: cy + r * 0.5 },
    { x: cx - r, y: cy },
  ]
  const poly = (pts: P2[], fill: string) => {
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
  }
  // left + right faces
  poly(
    [top[3], top[2], { x: cx, y: cy + r * 0.5 + rH }, { x: cx - r, y: cy + rH }],
    C.accentSoft
  )
  poly(
    [top[1], top[2], { x: cx, y: cy + r * 0.5 + rH }, { x: cx + r, y: cy + rH }],
    '#9a4622'
  )
  poly(top, C.accent)

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = C.accent
  ctx.font = `700 21px 'Inter', system-ui, sans-serif`
  withLetterSpacing(ctx, 5, () => ctx.fillText(brand.toUpperCase(), 132, cy + 1))

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = C.ink
  ctx.font = `800 68px 'Inter', system-ui, sans-serif`
  ctx.fillText(headline, 60, 196)
}

// --- isometric plan --------------------------------------------------------

function insetPoly(poly: P2[], cx: number, cz: number, factor: number): P2[] {
  return poly.map((p) => ({ x: cx + (p.x - cx) * factor, y: cz + (p.y - cz) * factor }))
}

function drawPlan(
  ctx: CanvasRenderingContext2D,
  config: FloorConfig,
  layout: ReturnType<typeof computeLayout>,
  area: { x: number; y: number; w: number; h: number }
): void {
  const fps = layout.footprints
  const idxById = new Map(config.rooms.map((r, i) => [r.id, i]))
  const flagshipById = new Map(config.rooms.map((r) => [r.id, r.flagship]))

  // poster extrusion height in world feet, scaled to the rooms
  const avgDim =
    fps.length > 0
      ? fps.reduce((s, f) => s + Math.hypot(f.maxX - f.minX, f.maxZ - f.minZ), 0) / fps.length
      : 14
  const Hp = Math.max(3, avgDim * 0.22)

  const slabW = layout.slabW
  const slabD = layout.slabD
  const slab: P2[] = layout.slabPoly.map(([x, z]) => ({ x, y: z }))

  // fit transform over slab + every room (top & bottom)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const acc = (p: P2) => {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  for (const s of slab) acc(iso(s.x, s.y, 0))
  for (const f of fps) {
    for (const [px, pz] of f.poly) {
      acc(iso(px, pz, 0))
      acc(iso(px, pz, Hp))
    }
  }
  const spanX = Math.max(1, maxX - minX)
  const spanY = Math.max(1, maxY - minY)
  const scale = Math.min(area.w / spanX, area.h / spanY) * 0.96
  const offX = area.x + area.w / 2 - ((minX + maxX) / 2) * scale
  const offY = area.y + area.h / 2 - ((minY + maxY) / 2) * scale
  const S = (p: P2): P2 => ({ x: offX + p.x * scale, y: offY + p.y * scale })

  // slab base + iso grid
  const slabScreen = slab.map((s) => S(iso(s.x, s.y, 0)))
  ctx.beginPath()
  ctx.moveTo(slabScreen[0].x, slabScreen[0].y)
  for (let i = 1; i < slabScreen.length; i++) ctx.lineTo(slabScreen[i].x, slabScreen[i].y)
  ctx.closePath()
  ctx.strokeStyle = C.slabLine
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.save()
  ctx.strokeStyle = C.grid
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let gx = -slabW / 2; gx <= slabW / 2 + 0.1; gx += GRID_FT) {
    const a = S(iso(gx, -slabD / 2, 0))
    const b = S(iso(gx, slabD / 2, 0))
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
  }
  for (let gz = -slabD / 2; gz <= slabD / 2 + 0.1; gz += GRID_FT) {
    const a = S(iso(-slabW / 2, gz, 0))
    const b = S(iso(slabW / 2, gz, 0))
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
  }
  ctx.stroke()
  ctx.restore()

  // rooms, back-to-front
  const order = [...fps].sort((a, b) => a.cx + a.cz - (b.cx + b.cz))
  for (const f of order) {
    const flag = !!flagshipById.get(f.id)
    drawRoomBlock(ctx, f, Hp, S, flag)
    const idx = idxById.get(f.id) ?? 0
    drawRoomNumber(ctx, f, Hp, S, scale, String(idx + 1), flag)
  }

  drawNorth(ctx, { x: area.x + area.w - 70, y: area.y + area.h - 96 })
}

function drawRoomBlock(
  ctx: CanvasRenderingContext2D,
  f: RoomFootprint,
  Hp: number,
  S: (p: P2) => P2,
  flag: boolean
): void {
  const poly: P2[] = f.poly.map(([x, y]) => ({ x, y }))
  const inset = insetPoly(poly, f.cx, f.cz, 0.9)
  const n = inset.length
  const edgeStroke = flag ? C.accent : C.ink
  ctx.lineJoin = 'round'

  // visible side faces (viewer sits toward +x/+z)
  for (let i = 0; i < n; i++) {
    const a = inset[i]
    const b = inset[(i + 1) % n]
    const mx = (a.x + b.x) / 2
    const mz = (a.y + b.y) / 2
    const facing = mx - f.cx + (mz - f.cz)
    if (facing <= 0) continue
    const rightish = mx - f.cx >= mz - f.cz
    const top0 = S(iso(a.x, a.y, Hp))
    const top1 = S(iso(b.x, b.y, Hp))
    const bot1 = S(iso(b.x, b.y, 0))
    const bot0 = S(iso(a.x, a.y, 0))
    ctx.beginPath()
    ctx.moveTo(top0.x, top0.y)
    ctx.lineTo(top1.x, top1.y)
    ctx.lineTo(bot1.x, bot1.y)
    ctx.lineTo(bot0.x, bot0.y)
    ctx.closePath()
    ctx.fillStyle = rightish ? C.rightFill : C.leftFill
    ctx.fill()
    ctx.strokeStyle = edgeStroke
    ctx.lineWidth = 1.3
    ctx.stroke()
  }

  // top face
  ctx.beginPath()
  const t0 = S(iso(inset[0].x, inset[0].y, Hp))
  ctx.moveTo(t0.x, t0.y)
  for (let i = 1; i < n; i++) {
    const t = S(iso(inset[i].x, inset[i].y, Hp))
    ctx.lineTo(t.x, t.y)
  }
  ctx.closePath()
  ctx.fillStyle = flag ? 'rgba(210,99,47,0.12)' : C.topFill
  ctx.fill()
  ctx.strokeStyle = edgeStroke
  ctx.lineWidth = flag ? 2 : 1.5
  ctx.stroke()
}

function drawRoomNumber(
  ctx: CanvasRenderingContext2D,
  f: RoomFootprint,
  Hp: number,
  S: (p: P2) => P2,
  scale: number,
  label: string,
  flag: boolean
): void {
  const c = S(iso(f.cx, f.cz, Hp))
  const dim = Math.min(f.maxX - f.minX, f.maxZ - f.minZ) * scale
  const fs = Math.max(13, Math.min(dim * 0.42, 30))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = flag ? C.accent : C.ink
  ctx.font = `${flag ? 700 : 500} ${fs}px 'Inter', system-ui, sans-serif`
  ctx.fillText(label, c.x, c.y)
}

function drawNorth(ctx: CanvasRenderingContext2D, at: P2): void {
  ctx.save()
  ctx.strokeStyle = C.inkSoft
  ctx.fillStyle = C.inkSoft
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(at.x, at.y + 30)
  ctx.lineTo(at.x, at.y - 26)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(at.x, at.y - 34)
  ctx.lineTo(at.x - 6, at.y - 22)
  ctx.lineTo(at.x + 6, at.y - 22)
  ctx.closePath()
  ctx.fill()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = C.ink
  ctx.font = `600 15px 'Inter', system-ui, sans-serif`
  ctx.fillText('N', at.x + 18, at.y - 26)
  ctx.restore()
}

// --- schedule --------------------------------------------------------------

function drawSchedule(
  ctx: CanvasRenderingContext2D,
  rooms: Room[],
  box: { x: number; y: number; w: number; bottom: number }
): void {
  const indexed = rooms.map((r, i) => ({ r, i }))
  const billable = indexed.filter((o) => o.r.category === 'Billable')
  const internal = indexed.filter((o) => o.r.category === 'Internal')
  const groups = [
    { title: 'Billable', list: billable },
    { title: 'Internal', list: internal },
  ].filter((g) => g.list.length)

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = C.cyan
  ctx.font = `700 21px 'Inter', system-ui, sans-serif`
  withLetterSpacing(ctx, 4, () => ctx.fillText('ROOM SCHEDULE', box.x, box.y + 16))

  // adaptive row height so all rooms fit the column
  const top = box.y + 56
  const avail = box.bottom - top
  const units = rooms.length + groups.length * 1.9
  const lineH = Math.min(33, avail / units)
  const numX = box.x
  const nameX = box.x + 54
  const areaX = box.x + box.w
  const nameMax = areaX - nameX - 56

  let cy = top
  for (const g of groups) {
    ctx.textAlign = 'left'
    ctx.fillStyle = C.accent
    ctx.font = `700 14px 'Inter', system-ui, sans-serif`
    withLetterSpacing(ctx, 2.5, () =>
      ctx.fillText(`${g.title.toUpperCase()} · ${g.list.length} ROOMS`, box.x, cy + 4)
    )
    cy += lineH * 1.5

    for (const { r, i } of g.list) {
      ctx.textBaseline = 'middle'
      ctx.font = `500 15px 'JetBrains Mono', monospace`
      ctx.textAlign = 'left'
      ctx.fillStyle = r.flagship ? C.accent : C.cyan
      ctx.fillText(roomNo(i), numX, cy)
      ctx.fillStyle = r.flagship ? C.accent : C.ink
      ctx.font = `500 16px 'Inter', system-ui, sans-serif`
      ctx.fillText(ellipsize(ctx, r.name, nameMax), nameX, cy)
      ctx.textAlign = 'right'
      ctx.fillStyle = C.inkSoft
      ctx.font = `500 15px 'JetBrains Mono', monospace`
      ctx.fillText(String(Math.round(r.area)), areaX, cy)
      ctx.textBaseline = 'alphabetic'
      cy += lineH
    }
    cy += lineH * 0.4
  }
}

// --- title block -----------------------------------------------------------

function drawTitleBlock(
  ctx: CanvasRenderingContext2D,
  t: FloorConfig['title'],
  box: { x: number; y: number; w: number; h: number }
): void {
  const cells: [string, string][] = [
    ['PROJECT', t.project],
    ['DRAWING', t.drawing],
    ['LOCATION', t.location || '—'],
    ['SCALE / SHEET', `${t.scale} · ${t.sheet}`],
  ]
  // weight project/drawing wider
  const weights = [1.25, 1.15, 1.05, 0.9]
  const wSum = weights.reduce((s, w) => s + w, 0)

  ctx.strokeStyle = C.frame
  ctx.lineWidth = 1.3
  ctx.strokeRect(box.x, box.y, box.w, box.h)

  let cx = box.x
  cells.forEach(([label, val], idx) => {
    const cw = (weights[idx] / wSum) * box.w
    if (idx > 0) {
      ctx.strokeStyle = C.frame
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx, box.y)
      ctx.lineTo(cx, box.y + box.h)
      ctx.stroke()
    }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = C.cyan
    ctx.font = `600 11px 'JetBrains Mono', monospace`
    withLetterSpacing(ctx, 1.5, () => ctx.fillText(label, cx + 18, box.y + 30))
    ctx.fillStyle = C.ink
    ctx.font = `600 19px 'Inter', system-ui, sans-serif`
    ctx.fillText(ellipsize(ctx, val.toUpperCase(), cw - 34), cx + 18, box.y + 64)
    cx += cw
  })
}
