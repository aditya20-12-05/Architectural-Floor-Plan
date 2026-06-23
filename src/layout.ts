import { FloorConfig, Room, Walkway } from './types'
import { CORRIDOR_MIN_FT, CORRIDOR_MAX_FT, uid } from './constants'
import {
  Pt,
  bbox,
  shapeToWorld,
  shapeByName,
  doorEdgeIndex,
  normalizeShape,
  DEFAULT_SLAB_POINTS,
} from './shapes'

export interface RoomFootprint {
  id: string
  cx: number
  cz: number
  poly: Pt[]
  doorEdge: number
  doorT: number
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface CorridorSeg {
  cx: number
  cz: number
  w: number
  d: number
  axis: 'x' | 'z'
}

export interface Entrance {
  x: number
  z: number
  width: number
  dir: number
}

export interface Layout {
  slabW: number
  slabD: number
  slabPoly: Pt[]
  corridorWidth: number
  corridors: CorridorSeg[]
  entrance: Entrance
  footprints: RoomFootprint[]
  circulationArea: number
}

export interface AreaSummary {
  allocated: number
  available: number
  walkable: number
  carpet: number
  builtUp: number
  diff: number
  balanced: boolean
}

interface Slot {
  id: string
  cx: number
  cz: number
  w: number
  d: number
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// Whole-floor plate polygon (world ft) + its bounding dimensions. A normalized
// unit-area shape scaled by sqrt(carpet) keeps the plate area == carpet area.
function slabShape(config: FloorConfig): { poly: Pt[]; slabW: number; slabD: number } {
  const base =
    config.slabPoints && config.slabPoints.length >= 3
      ? (config.slabPoints as Pt[])
      : DEFAULT_SLAB_POINTS
  const s = Math.sqrt(Math.max(config.carpetArea, 1))
  const poly = base.map(([x, z]) => [x * s, z * s] as Pt)
  const bb = bbox(poly)
  return { poly, slabW: bb.maxX - bb.minX, slabD: bb.maxZ - bb.minZ }
}

function corridorW(config: FloorConfig, slabW: number, slabD: number): number {
  const walkable = Math.min(Math.max(config.walkableArea, 0), config.carpetArea * 0.6)
  return clamp(walkable / slabW, CORRIDOR_MIN_FT, Math.min(CORRIDOR_MAX_FT, slabD * 0.4))
}

function shapeFootprint(room: Room, attractors: Pt[]): RoomFootprint {
  const pts =
    room.shapePoints && room.shapePoints.length >= 3
      ? (room.shapePoints as Pt[])
      : shapeByName(room.shapeName).points
  const s = Math.sqrt(Math.max(room.area, 1))
  const poly = shapeToWorld(pts, room.px as number, room.pz as number, s, room.rot ?? 0)
  // Honour a manual door override when its edge index is still valid for the
  // current shape; otherwise auto-pick the edge facing circulation.
  const manualEdge =
    room.doorEdge != null && room.doorEdge >= 0 && room.doorEdge < poly.length
      ? room.doorEdge
      : null
  return {
    id: room.id,
    cx: room.px as number,
    cz: room.pz as number,
    poly,
    doorEdge: manualEdge ?? doorEdgeIndex(poly, attractors),
    doorT: room.doorT != null ? Math.min(0.85, Math.max(0.15, room.doorT)) : 0.5,
    ...bbox(poly),
  }
}

// Renders only PLACED rooms (px/pz set). Unplaced rooms are "in the menu".
export function computeLayout(config: FloorConfig): Layout {
  const { poly: slabPoly, slabW, slabD } = slabShape(config)
  const corridorWidth = corridorW(config, slabW, slabD)
  const attractors: Pt[] =
    config.walkways.length > 0
      ? config.walkways.map((w) => [(w.x1 + w.x2) / 2, (w.z1 + w.z2) / 2] as Pt)
      : [[0, 0]]

  const footprints = config.rooms
    .filter((r) => r.px != null && r.pz != null && r.area > 0)
    .map((r) => shapeFootprint(r, attractors))

  const corridors: CorridorSeg[] = [{ cx: 0, cz: 0, w: slabW, d: corridorWidth, axis: 'x' }]
  const entrance: Entrance = { x: slabW / 2, z: 0, width: corridorWidth, dir: -1 }

  return {
    slabW,
    slabD,
    slabPoly,
    corridorWidth,
    corridors,
    entrance,
    footprints,
    circulationArea: corridorWidth * slabW,
  }
}

// Ids of rooms whose bounding boxes overlap each other (collision flag).
export function overlappingIds(fps: RoomFootprint[]): Set<string> {
  const set = new Set<string>()
  for (let i = 0; i < fps.length; i++) {
    for (let j = i + 1; j < fps.length; j++) {
      const a = fps[i]
      const b = fps[j]
      if (
        a.minX < b.maxX - 0.05 &&
        a.maxX > b.minX + 0.05 &&
        a.minZ < b.maxZ - 0.05 &&
        a.maxZ > b.minZ + 0.05
      ) {
        set.add(a.id)
        set.add(b.id)
      }
    }
  }
  return set
}

// Double-loaded band slots for all rooms (used by auto-arrange).
function bandSlots(config: FloorConfig): Slot[] {
  const { slabW, slabD } = slabShape(config)
  const corridorWidth = corridorW(config, slabW, slabD)
  const bandD = (slabD - corridorWidth) / 2
  const rooms = config.rooms.filter((r) => r.area > 0)
  const total = rooms.reduce((s, r) => s + r.area, 0)
  let cum = 0
  let splitIdx = rooms.length
  for (let i = 0; i < rooms.length; i++) {
    cum += rooms[i].area
    if (cum >= total / 2) {
      splitIdx = i + 1
      break
    }
  }
  const northCz = corridorWidth / 2 + bandD / 2
  const southCz = -(corridorWidth / 2 + bandD / 2)
  return [
    ...layBandSlots(rooms.slice(0, splitIdx), northCz, bandD),
    ...layBandSlots(rooms.slice(splitIdx), southCz, bandD),
  ]
}

// Area-preserving, edge-to-edge packing: each room fills the band depth with
// width = area / bandD, laid in a centred row. Every slot's area equals the
// room's area, so the rendered (area-preserving) footprint fits its slot
// exactly — adjacent rooms share edges but never overlap. When the rooms
// exceed the slab they overflow the sides symmetrically (a visible signal).
function layBandSlots(list: Room[], cz: number, bandD: number): Slot[] {
  if (list.length === 0 || bandD <= 0) return []
  const widths = list.map((r) => Math.max(r.area, 1) / bandD)
  const total = widths.reduce((s, w) => s + w, 0)
  const slots: Slot[] = []
  let x = -total / 2
  for (let i = 0; i < list.length; i++) {
    const w = widths[i]
    slots.push({ id: list[i].id, cx: x + w / 2, cz, w, d: bandD })
    x += w
  }
  return slots
}

// Place every room into the double-loaded arrangement (a tidy starting point).
export function autoArrangeRooms(config: FloorConfig): Room[] {
  const slots = new Map(bandSlots(config).map((s) => [s.id, s]))
  return config.rooms.map((r) => {
    const s = slots.get(r.id)
    if (!s) return r
    const rectPts: Pt[] = [
      [-s.w / 2, -s.d / 2],
      [s.w / 2, -s.d / 2],
      [s.w / 2, s.d / 2],
      [-s.w / 2, s.d / 2],
    ]
    return { ...r, px: s.cx, pz: s.cz, rot: 0, shapeName: 'Square', shapePoints: normalizeShape(rectPts) }
  })
}

// ---------------------------------------------------------------------------
// Magic Layout — a fresh, efficient, non-overlapping arrangement every call,
// complete with its own walkways. Randomised across orientation, band count,
// distribution, room shapes (incl. L / T) and corridor width, and clipped to
// the (possibly non-rectangular) plate outline so each run differs and fits.
// ---------------------------------------------------------------------------

function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Largest inside-interval of a polygon (u-v space) along the scanline v = const.
function spanAtV(poly: Pt[], v: number): [number, number] | null {
  const xs: number[] = []
  for (let i = 0; i < poly.length; i++) {
    const [u1, v1] = poly[i]
    const [u2, v2] = poly[(i + 1) % poly.length]
    if ((v1 <= v && v2 > v) || (v2 <= v && v1 > v)) {
      xs.push(u1 + ((v - v1) / (v2 - v1)) * (u2 - u1))
    }
  }
  if (xs.length < 2) return null
  xs.sort((a, b) => a - b)
  let best: [number, number] | null = null
  let bestLen = -1
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const len = xs[i + 1] - xs[i]
    if (len > bestLen) {
      bestLen = len
      best = [xs[i], xs[i + 1]]
    }
  }
  return best
}

// Translate a polygon so its bounding box is centred on the origin.
function bboxCenter(pts: Pt[]): Pt[] {
  const bb = bbox(pts)
  const cx = (bb.minX + bb.maxX) / 2
  const cz = (bb.minZ + bb.maxZ) / 2
  return pts.map(([x, z]) => [x - cx, z - cz] as Pt)
}

interface MagicItem {
  name: string
  points: Pt[] // normalized unit-area, bbox-centred, in (u,v)
  bw: number // size along width axis
  bh: number // size along depth axis (<= bandD)
}

// Pick a footprint for a room within a band of depth bandD: mostly full-depth
// rectangles, with some wide/shallow rectangles and the occasional L / T.
function roomShapeFor(room: Room, bandD: number): MagicItem {
  const s = Math.sqrt(Math.max(room.area, 1))
  const roll = Math.random()
  if (roll < 0.2) {
    const preset = Math.random() < 0.5 ? shapeByName('L-Shape') : shapeByName('T-Shape')
    const bb = bbox(preset.points)
    const bh = (bb.maxZ - bb.minZ) * s
    const bw = (bb.maxX - bb.minX) * s
    if (bh <= bandD) return { name: preset.name, points: bboxCenter(preset.points), bw, bh }
  }
  const bh = roll < 0.42 ? bandD * (0.55 + Math.random() * 0.3) : bandD
  const bw = Math.max(room.area, 1) / bh
  const rectPts: Pt[] = [
    [-bw / 2, -bh / 2],
    [bw / 2, -bh / 2],
    [bw / 2, bh / 2],
    [-bw / 2, bh / 2],
  ]
  const aspect = bw / bh
  const name = aspect > 1.35 ? 'Wide' : aspect < 0.74 ? 'Tall' : 'Square'
  return { name, points: normalizeShape(rectPts), bw, bh }
}

interface BandInfo {
  vCenter: number
  align: number // -1 toward smaller v, +1 toward larger v, 0 centre
  uMin: number
  uMax: number
  cap: number
  rooms: Room[]
}

interface MagicCell {
  id: string
  u: number
  v: number
  name: string
  points: Pt[]
}

// Lay a band's rooms left-to-right within its plate span, flush to the corridor.
function packBand(bd: BandInfo, bandD: number, cells: MagicCell[]): void {
  const items = bd.rooms.map((r) => ({ r, ...roomShapeFor(r, bandD) }))
  const total = items.reduce((s, it) => s + it.bw, 0)
  let u = (bd.uMin + bd.uMax) / 2 - total / 2
  for (const it of items) {
    const v =
      bd.align < 0
        ? bd.vCenter - bandD / 2 + it.bh / 2
        : bd.align > 0
        ? bd.vCenter + bandD / 2 - it.bh / 2
        : bd.vCenter
    cells.push({ id: it.r.id, u: u + it.bw / 2, v, name: it.name, points: it.points })
    u += it.bw
  }
}

export function magicLayout(config: FloorConfig): { rooms: Room[]; walkways: Walkway[] } {
  const { poly: slabPoly, slabW, slabD } = slabShape(config)
  const placed = config.rooms.filter((r) => r.area > 0)
  if (placed.length === 0) return { rooms: config.rooms, walkways: [] }

  // u = width axis, v = depth axis (bands stack along v). Flip for variety.
  const vertical = Math.random() < 0.5
  const Wu = vertical ? slabD : slabW
  const Dv = vertical ? slabW : slabD
  const plateUV: Pt[] = slabPoly.map(([x, z]) => (vertical ? [z, x] : [x, z]) as Pt)

  const corridorW = 4 + Math.random() * 2.5
  const big = placed.length
  const pool0 = big >= 12 ? [2, 3, 3, 4] : big >= 7 ? [2, 2, 3, 3] : [2, 2]
  let nBands = pool0[Math.floor(Math.random() * pool0.length)]
  // keep bands a sensible depth
  while (nBands > 2 && (Dv - (nBands - 1) * corridorW) / nBands < 11) nBands--
  const bandD = (Dv - (nBands - 1) * corridorW) / nBands

  // bands with their plate-clipped width spans + which side faces a corridor
  const bandData: BandInfo[] = []
  for (let b = 0; b < nBands; b++) {
    const vCenter = -Dv / 2 + bandD / 2 + b * (bandD + corridorW)
    const span = spanAtV(plateUV, vCenter) ?? [-Wu / 2, Wu / 2]
    const align = nBands === 1 ? 0 : b === 0 ? 1 : b === nBands - 1 ? -1 : 0
    bandData.push({
      vCenter,
      align,
      uMin: span[0],
      uMax: span[1],
      cap: Math.max(span[1] - span[0], 1) * bandD,
      rooms: [],
    })
  }

  // distribute rooms into bands proportional to each band's capacity
  const modes = ['balanced', 'shuffled', 'category', 'reversed'] as const
  const mode = modes[Math.floor(Math.random() * modes.length)]
  const totalCap = bandData.reduce((s, b) => s + b.cap, 0) || 1
  if (mode === 'balanced') {
    const sorted = placed.slice().sort((a, b) => b.area - a.area)
    const load = bandData.map(() => 0)
    for (const r of sorted) {
      let m = 0
      let best = -Infinity
      for (let i = 0; i < bandData.length; i++) {
        const rem = bandData[i].cap - load[i]
        if (rem > best) {
          best = rem
          m = i
        }
      }
      bandData[m].rooms.push(r)
      load[m] += r.area
    }
  } else {
    let pool = placed.slice()
    if (mode === 'reversed') pool.reverse()
    else if (mode === 'shuffled') pool = shuffled(pool)
    else pool.sort((a, b) => (a.category === b.category ? 0 : a.category === 'Billable' ? -1 : 1))
    const totalArea = pool.reduce((s, r) => s + r.area, 0)
    const target = bandData.map((b) => (totalArea * b.cap) / totalCap)
    let bi = 0
    let load = 0
    for (const r of pool) {
      bandData[bi].rooms.push(r)
      load += r.area
      if (bi < bandData.length - 1 && load >= target[bi]) {
        bi++
        load = 0
      }
    }
  }

  const cells: MagicCell[] = []
  for (const bd of bandData) packBand(bd, bandD, cells)

  const byId = new Map(cells.map((c) => [c.id, c]))
  const rooms = config.rooms.map((r): Room => {
    const c = byId.get(r.id)
    if (!c) return r
    const pts: Pt[] = vertical ? c.points.map(([u, v]) => [v, u] as Pt) : c.points
    return {
      ...r,
      px: vertical ? c.v : c.u,
      pz: vertical ? c.u : c.v,
      rot: 0,
      shapeName: c.name,
      shapePoints: pts,
      doorEdge: undefined,
      doorT: undefined,
    }
  })

  // --- walkways: a plate-fitted corridor in every band gap, tied together by
  // connector spine(s) into one circulation network ------------------------
  const map = (u: number, v: number): { x: number; z: number } =>
    vertical ? { x: v, z: u } : { x: u, z: v }
  const seg = (u1: number, v1: number, u2: number, v2: number, w: number): Walkway => {
    const a = map(u1, v1)
    const b = map(u2, v2)
    return { id: uid(), x1: a.x, z1: a.z, x2: b.x, z2: b.z, width: w }
  }
  const walkways: Walkway[] = []
  const gaps: { v: number; uMin: number; uMax: number }[] = []
  for (let g = 0; g < nBands - 1; g++) {
    const vGap = bandData[g].vCenter + bandD / 2 + corridorW / 2
    const span = spanAtV(plateUV, vGap) ?? [-Wu / 2, Wu / 2]
    const inset = Math.min(2, (span[1] - span[0]) * 0.04)
    walkways.push(seg(span[0] + inset, vGap, span[1] - inset, vGap, corridorW))
    gaps.push({ v: vGap, uMin: span[0], uMax: span[1] })
  }
  if (gaps.length >= 2) {
    const cw = corridorW * 0.8
    const uLo = Math.max(...gaps.map((g) => g.uMin))
    const uHi = Math.min(...gaps.map((g) => g.uMax))
    if (uLo < uHi) {
      const spines = gaps.length >= 3 && Math.random() < 0.5 ? 2 : 1
      for (let i = 0; i < spines; i++) {
        const f = spines === 1 ? 0.5 : 0.27 + i * 0.46
        const cu = uLo + (uHi - uLo) * f
        walkways.push(seg(cu, gaps[0].v, cu, gaps[gaps.length - 1].v, cw))
      }
    } else {
      for (let i = 0; i + 1 < gaps.length; i++) {
        const lo = Math.max(gaps[i].uMin, gaps[i + 1].uMin)
        const hi = Math.min(gaps[i].uMax, gaps[i + 1].uMax)
        const cu = lo < hi ? (lo + hi) / 2 : (gaps[i].uMin + gaps[i].uMax) / 2
        walkways.push(seg(cu, gaps[i].v, cu, gaps[i + 1].v, cw))
      }
    }
  }

  return { rooms, walkways }
}

// Ensure a freshly loaded config has rooms on the plan (auto-arrange once).
export function ensurePlaced(config: FloorConfig): FloorConfig {
  if (config.rooms.some((r) => r.px != null)) return config
  return { ...config, rooms: autoArrangeRooms(config) }
}

export function summarizeAreas(config: FloorConfig, tolerance: number): AreaSummary {
  const allocated = config.rooms.reduce((s, r) => s + Math.max(0, r.area), 0)
  const carpet = config.carpetArea
  const walkable = config.walkableArea
  const available = carpet - walkable
  const diff = allocated + walkable - carpet
  return {
    allocated,
    available,
    walkable,
    carpet,
    builtUp: config.totalArea,
    diff,
    balanced: Math.abs(diff) <= tolerance,
  }
}
