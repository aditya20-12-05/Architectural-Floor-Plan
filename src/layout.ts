import { squarify, Rect } from './treemap'
import { FloorConfig } from './types'
import { SLAB_ASPECT, MIN_PACKED_FRACTION } from './constants'

export interface RoomFootprint {
  id: string
  cx: number // world x of block centre
  cz: number // world z of block centre
  w: number // block width (x)
  d: number // block depth (z)
}

export interface Layout {
  slabW: number // world units (= feet)
  slabD: number
  packedFraction: number // (carpet - walkable) / carpet, clamped
  footprints: RoomFootprint[]
}

export interface AreaSummary {
  allocated: number // sum of room areas
  available: number // carpet - walkable
  walkable: number
  carpet: number
  builtUp: number
  diff: number // allocated + walkable - carpet
  balanced: boolean
}

// 1 world unit == 1 sq ft of footprint, so the slab footprint area == carpet area.
export function computeLayout(config: FloorConfig): Layout {
  const carpet = Math.max(config.carpetArea, 1)
  const slabW = Math.sqrt(carpet * SLAB_ASPECT)
  const slabD = Math.sqrt(carpet / SLAB_ASPECT)

  // Circulation: rooms occupy (carpet - walkable); the leftover reads as floor.
  const walk = Math.min(Math.max(config.walkableArea, 0), carpet * (1 - MIN_PACKED_FRACTION))
  const fraction = Math.max(MIN_PACKED_FRACTION, Math.min(1, (carpet - walk) / carpet))
  const s = Math.sqrt(fraction) // centre-scale factor that yields that packed area

  // Keep the rooms in list order (do NOT sort by area) so that reordering /
  // dragging a block to another's place actually re-packs the plan.
  const items = config.rooms
    .filter((r) => r.area > 0)
    .map((r) => ({ id: r.id, value: r.area }))

  const container: Rect = { x: 0, y: 0, w: slabW, h: slabD }
  const cells = squarify(items, container)

  const footprints: RoomFootprint[] = cells.map((c) => {
    const w = c.rect.w * s
    const d = c.rect.h * s
    // treemap origin is top-left of the slab; recentre on the world origin.
    const cx = c.rect.x + c.rect.w / 2 - slabW / 2
    const cz = c.rect.y + c.rect.h / 2 - slabD / 2
    return { id: c.id, cx, cz, w, d }
  })

  return { slabW, slabD, packedFraction: fraction, footprints }
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
