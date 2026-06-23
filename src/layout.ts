import { FloorConfig, Room } from './types'
import { SLAB_ASPECT, CORRIDOR_MIN_FT, CORRIDOR_MAX_FT } from './constants'
import { Pt, bbox, shapeToWorld, shapeByName, doorEdgeIndex } from './shapes'

export interface RoomFootprint {
  id: string
  cx: number // centre x
  cz: number // centre z
  poly: Pt[] // world polygon
  doorEdge: number // index of the edge carrying the door
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

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function rectFootprint(id: string, cx: number, cz: number, w: number, d: number, doorEdge: number): RoomFootprint {
  const hw = w / 2
  const hd = d / 2
  const poly: Pt[] = [
    [cx - hw, cz - hd],
    [cx + hw, cz - hd],
    [cx + hw, cz + hd],
    [cx - hw, cz + hd],
  ]
  return { id, cx, cz, poly, doorEdge, ...bbox(poly) }
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

export function computeLayout(config: FloorConfig): Layout {
  const carpet = Math.max(config.carpetArea, 1)
  const slabW = Math.sqrt(carpet * SLAB_ASPECT)
  const slabD = Math.sqrt(carpet / SLAB_ASPECT)

  const rooms = config.rooms.filter((r) => r.area > 0)
  const totalRoom = rooms.reduce((s, r) => s + r.area, 0)

  const walkable = Math.min(Math.max(config.walkableArea, 0), carpet * 0.6)
  const maxByDepth = slabD * 0.4
  const corridorWidth = clamp(walkable / slabW, CORRIDOR_MIN_FT, Math.min(CORRIDOR_MAX_FT, maxByDepth))
  const bandD = (slabD - corridorWidth) / 2

  let cum = 0
  let splitIdx = rooms.length
  for (let i = 0; i < rooms.length; i++) {
    cum += rooms[i].area
    if (cum >= totalRoom / 2) {
      splitIdx = i + 1
      break
    }
  }
  const north = rooms.slice(0, splitIdx)
  const south = rooms.slice(splitIdx)

  const northCz = corridorWidth / 2 + bandD / 2
  const southCz = -(corridorWidth / 2 + bandD / 2)

  const autoFootprints: RoomFootprint[] = [
    ...layBand(north, northCz, bandD, slabW, 0),
    ...layBand(south, southCz, bandD, slabW, 2),
  ]

  // Override placed rooms with their chosen shape, scaled by area.
  const byId = new Map(autoFootprints.map((f) => [f.id, f]))
  const attractors: Pt[] = config.walkways.map((w) => [w.x, w.z] as Pt)
  for (const r of config.rooms) {
    if (r.px != null && r.pz != null) byId.set(r.id, shapeFootprint(r, attractors))
  }
  const footprints = Array.from(byId.values())

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

function layBand(
  list: Room[],
  cz: number,
  bandD: number,
  slabW: number,
  doorEdge: number
): RoomFootprint[] {
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

  const fps: RoomFootprint[] = []
  let x = -slabW / 2
  for (let i = 0; i < list.length; i++) {
    const w = widths[i]
    fps.push(rectFootprint(list[i].id, x + w / 2, cz, w, bandD, doorEdge))
    x += w
  }
  return fps
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
