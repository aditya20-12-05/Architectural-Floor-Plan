import { FloorConfig, Room } from './types'
import { CORRIDOR_MIN_FT, CORRIDOR_MAX_FT } from './constants'
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
