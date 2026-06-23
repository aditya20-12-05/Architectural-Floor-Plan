// Room shapes as normalized polygons (centred on origin, scaled to unit area).
// A room's real footprint = its shape scaled by sqrt(areaSqFt), rotated, placed.

export type Pt = [number, number]

export interface RoomShape {
  name: string
  points: Pt[]
}

export function polyArea(pts: Pt[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[(i + 1) % pts.length]
    a += x1 * z2 - x2 * z1
  }
  return Math.abs(a) / 2
}

export function centroid(pts: Pt[]): Pt {
  let cx = 0
  let cz = 0
  for (const [x, z] of pts) {
    cx += x
    cz += z
  }
  return [cx / pts.length, cz / pts.length]
}

// Centre on the centroid and scale so the polygon has unit area.
export function normalizeShape(pts: Pt[]): Pt[] {
  const [cx, cz] = centroid(pts)
  const centered = pts.map(([x, z]) => [x - cx, z - cz] as Pt)
  const a = polyArea(centered)
  const s = a > 0 ? 1 / Math.sqrt(a) : 1
  return centered.map(([x, z]) => [x * s, z * s] as Pt)
}

function rect(w: number, d: number): Pt[] {
  const hw = w / 2
  const hd = d / 2
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ]
}

export const SHAPE_PRESETS: RoomShape[] = [
  { name: 'Square', points: normalizeShape(rect(1, 1)) },
  { name: 'Wide', points: normalizeShape(rect(1.7, 1)) },
  { name: 'Tall', points: normalizeShape(rect(1, 1.7)) },
  {
    name: 'L-Shape',
    points: normalizeShape([
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.1],
      [0.0, 0.1],
      [0.0, 0.5],
      [-0.5, 0.5],
    ]),
  },
  {
    name: 'T-Shape',
    points: normalizeShape([
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, -0.1],
      [0.15, -0.1],
      [0.15, 0.5],
      [-0.15, 0.5],
      [-0.15, -0.1],
      [-0.5, -0.1],
    ]),
  },
]

export const DEFAULT_SHAPE = SHAPE_PRESETS[0]

export function shapeByName(name: string | undefined): RoomShape {
  return SHAPE_PRESETS.find((s) => s.name === name) ?? DEFAULT_SHAPE
}

// Scale (by s), rotate (rot radians), translate to (px,pz) -> world polygon.
export function shapeToWorld(pts: Pt[], px: number, pz: number, s: number, rot: number): Pt[] {
  const c = Math.cos(rot)
  const sn = Math.sin(rot)
  return pts.map(([x, z]) => {
    const X = x * s
    const Z = z * s
    return [px + X * c - Z * sn, pz + X * sn + Z * c] as Pt
  })
}

export function bbox(pts: Pt[]): { minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const [x, z] of pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  return { minX, maxX, minZ, maxZ }
}

// Index of the polygon edge best suited for a door (longest edge by default,
// or the edge whose midpoint is closest to one of the given attractor points).
export function doorEdgeIndex(pts: Pt[], attractors: Pt[]): number {
  let best = 0
  if (attractors.length > 0) {
    let bestDist = Infinity
    for (let i = 0; i < pts.length; i++) {
      const [x1, z1] = pts[i]
      const [x2, z2] = pts[(i + 1) % pts.length]
      const mx = (x1 + x2) / 2
      const mz = (z1 + z2) / 2
      for (const [ax, az] of attractors) {
        const dist = Math.hypot(mx - ax, mz - az)
        if (dist < bestDist) {
          bestDist = dist
          best = i
        }
      }
    }
    return best
  }
  let bestLen = -1
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[(i + 1) % pts.length]
    const len = Math.hypot(x2 - x1, z2 - z1)
    if (len > bestLen) {
      bestLen = len
      best = i
    }
  }
  return best
}
