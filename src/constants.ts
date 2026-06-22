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

// Floor slab default footprint aspect ratio (width : depth).
export const SLAB_ASPECT = 4 / 3

// Grid spacing in feet.
export const GRID_FT = 5

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
