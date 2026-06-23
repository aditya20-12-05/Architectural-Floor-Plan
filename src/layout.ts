import { FloorConfig, Room } from './types'
import { SLAB_ASPECT, CORRIDOR_MIN_FT, CORRIDOR_MAX_FT } from './constants'
import { Pt, bbox, shapeToWorld, shapeByName, doorEdgeIndex, normalizeShape } from './shapes'

export interface RoomFootprint {
  id: string
  cx: number
  cz: number
  poly: Pt[]
  doorEdge: number
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

function slabDims(carpet: number): { slabW: number; slabD: number } {
  const c = Math.max(carpet, 1)
  return { slabW: Math.sqrt(c * SLAB_ASPECT), slabD: Math.sqrt(c / SLAB_ASPECT) }
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
  return {
    id: room.id,
    cx: room.px as number,
    cz: room.pz as number,
    poly,
    doorEdge: doorEdgeIndex(poly, attractors),
    ...bbox(poly),
  }
}

// Renders only PLACED rooms (px/pz set). Unplaced rooms are "in the menu".
export function computeLayout(config: FloorConfig): Layout {
  const { slabW, slabD } = slabDims(config.carpetArea)
  const corridorWidth = corridorW(config, slabW, slabD)
  const attractors: Pt[] =
    config.walkways.length > 0 ? config.walkways.map((w) => [w.x, w.z] as Pt) : [[0, 0]]

  const footprints = config.rooms
    .filter((r) => r.px != null && r.pz != null && r.area > 0)
    .map((r) => shapeFootprint(r, attractors))

  const corridors: CorridorSeg[] = [{ cx: 0, cz: 0, w: slabW, d: corridorWidth, axis: 'x' }]
  const entrance: Entrance = { x: slabW / 2, z: 0, width: corridorWidth, dir: -1 }

  return {
    slabW,
    slabD,
    corridorWidth,
    corridors,
    entrance,
    footprints,
    circulationArea: corridorWidth * slabW,
  }
}

// Double-loaded band slots for all rooms (used by auto-arrange).
function bandSlots(config: FloorConfig): Slot[] {
  const { slabW, slabD } = slabDims(config.carpetArea)
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
    ...layBandSlots(rooms.slice(0, splitIdx), northCz, bandD, slabW),
    ...layBandSlots(rooms.slice(splitIdx), southCz, bandD, slabW),
  ]
}

function layBandSlots(list: Room[], cz: number, bandD: number, slabW: number): Slot[] {
  if (list.length === 0 || bandD <= 0) return []
  const scale = slabW / (list.reduce((s, r) => s + r.area, 0) / bandD || 1)
  let widths = list.map((r) => (r.area / bandD) * scale)
  const minW = Math.min(6, slabW / list.length)
  for (let iter = 0; iter < 4; iter++) {
    const fixed = widths.map((w) => w <= minW + 1e-6)
    let fixedSum = 0
    let flexSum = 0
    widths.forEach((w, i) => (fixed[i] ? (fixedSum += minW) : (flexSum += w)))
    const remain = slabW - fixedSum
    if (flexSum <= 0 || remain <= 0) break
    const k = remain / flexSum
    let changed = false
    widths = widths.map((w, i) => {
      if (fixed[i]) return minW
      const nw = w * k
      if (nw <= minW + 1e-6) changed = true
      return nw
    })
    if (!changed) break
  }
  const slots: Slot[] = []
  let x = -slabW / 2
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
