import { FloorConfig, Room } from './types'
import { SLAB_ASPECT, CORRIDOR_MIN_FT, CORRIDOR_MAX_FT } from './constants'

export type CorridorSide = 'minZ' | 'maxZ'

export interface RoomFootprint {
  id: string
  cx: number // world x of block centre
  cz: number // world z of block centre
  w: number // block width (x)
  d: number // block depth (z)
  corridorSide: CorridorSide // which z-wall fronts the corridor (door wall)
  band: 'north' | 'south'
}

export interface CorridorSeg {
  cx: number
  cz: number
  w: number
  d: number
  axis: 'x' | 'z'
}

export interface Layout {
  slabW: number
  slabD: number
  corridorWidth: number
  corridors: CorridorSeg[]
  footprints: RoomFootprint[]
  circulationArea: number // actual corridor area
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

// Double-loaded corridor office: a central spine runs the length of the floor;
// rooms sit in the two bands either side, each spanning the band depth so every
// room fronts the corridor. 1 world unit == 1 ft.
export function computeLayout(config: FloorConfig): Layout {
  const carpet = Math.max(config.carpetArea, 1)
  const slabW = Math.sqrt(carpet * SLAB_ASPECT)
  const slabD = Math.sqrt(carpet / SLAB_ASPECT)

  const rooms = config.rooms.filter((r) => r.area > 0)
  const totalRoom = rooms.reduce((s, r) => s + r.area, 0)

  // Corridor width from the walkable budget, clamped to a realistic band.
  const walkable = Math.min(Math.max(config.walkableArea, 0), carpet * 0.6)
  const maxByDepth = slabD * 0.4
  const corridorWidth = clamp(walkable / slabW, CORRIDOR_MIN_FT, Math.min(CORRIDOR_MAX_FT, maxByDepth))
  const bandD = (slabD - corridorWidth) / 2

  // Split rooms into two bands by cumulative area (~half each), preserving order.
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

  const footprints: RoomFootprint[] = [
    ...layBand(north, northCz, bandD, slabW, 'minZ', 'north'),
    ...layBand(south, southCz, bandD, slabW, 'maxZ', 'south'),
  ]

  const corridors: CorridorSeg[] = [{ cx: 0, cz: 0, w: slabW, d: corridorWidth, axis: 'x' }]

  return {
    slabW,
    slabD,
    corridorWidth,
    corridors,
    footprints,
    circulationArea: corridorWidth * slabW,
  }
}

// Lay one band as a row of single-depth rooms along x, widths proportional to
// area, scaled to fill the floor length so the band reads as a tidy run.
function layBand(
  list: Room[],
  cz: number,
  bandD: number,
  slabW: number,
  corridorSide: CorridorSide,
  band: 'north' | 'south'
): RoomFootprint[] {
  if (list.length === 0 || bandD <= 0) return []
  const rawW = list.map((r) => r.area / bandD)
  const sumW = rawW.reduce((a, b) => a + b, 0)
  const scale = sumW > 0 ? slabW / sumW : 1
  const fps: RoomFootprint[] = []
  let x = -slabW / 2
  for (let i = 0; i < list.length; i++) {
    const w = rawW[i] * scale
    fps.push({ id: list[i].id, cx: x + w / 2, cz, w, d: bandD, corridorSide, band })
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
