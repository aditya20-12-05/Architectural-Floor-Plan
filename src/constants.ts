// Light "white-paper" blueprint palette: white ground, navy line-work,
// clay accent. (Inverted from the original white-on-blue scheme.)
export const PALETTE = {
  bg: '#ffffff', // scene + page background
  slab: '#eef3f8', // floor + block face fill (whisper of blue, for occlusion)
  line: '#0e3a5c', // hairlines / ink (navy)
  accent: '#c2613f', // flagship / selected (clay)
  cyan: '#3f6d96', // secondary blue (label sub-text, muted UI)
  white: '#ffffff',
} as const

// Floor slab default footprint aspect ratio (width : depth). Longer than wide
// so a central corridor spine running the length reads naturally.
export const SLAB_ASPECT = 1.6

// Grid spacing in feet (planning module).
export const GRID_FT = 5

// Circulation corridor width clamps (feet).
export const CORRIDOR_MIN_FT = 4
export const CORRIDOR_MAX_FT = 14

// Default width (feet) of a hand-drawn walkway path segment.
export const DEFAULT_WALK_W = 5

// Architectural dimensions (feet).
export const WALL_THICKNESS_FT = 0.5
export const DOOR_WIDTH_FT = 3.2

// Exponential damping rate for the block resize / re-flow animation.
// Higher = snappier; ~9 settles in roughly 300ms.
export const ANIM_RATE = 9

// Tolerance (sq ft) for the "rooms + walkable == carpet" balance check.
export const AREA_TOLERANCE = 1

// Minimum packed fraction so the plan never collapses to nothing.
export const MIN_PACKED_FRACTION = 0.15

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'r' + Math.random().toString(36).slice(2, 10)
}

// Two-digit room number from a zero-based index.
export function roomNo(index: number): string {
  return String(index + 1).padStart(2, '0')
}
