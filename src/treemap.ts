// Squarified treemap (Bruls, Huizing & van Wijk).
// Packs weighted items into a rectangle as sub-rectangles whose areas are
// proportional to the weights, kept as close to square as possible.

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface TreemapItem {
  id: string
  value: number
}

export interface TreemapCell {
  id: string
  rect: Rect
}

interface ScaledItem {
  id: string
  value: number // already scaled to area units of the container
}

export function squarify(items: TreemapItem[], container: Rect): TreemapCell[] {
  const cells: TreemapCell[] = []
  const valid = items.filter((it) => it.value > 0)
  const total = valid.reduce((s, it) => s + it.value, 0)
  if (total <= 0 || container.w <= 0 || container.h <= 0) return cells

  // Scale weights so the row areas are expressed in real rectangle units.
  const scale = (container.w * container.h) / total
  const scaled: ScaledItem[] = valid.map((it) => ({ id: it.id, value: it.value * scale }))

  let remaining: Rect = { ...container }
  let row: ScaledItem[] = []
  let i = 0

  while (i < scaled.length) {
    const length = Math.min(remaining.w, remaining.h)
    const currentAreas = row.map((r) => r.value)
    const withNext = currentAreas.concat(scaled[i].value)
    // Add the next item to the row while it does not worsen the aspect ratio.
    if (row.length === 0 || worst(currentAreas, length) >= worst(withNext, length)) {
      row.push(scaled[i])
      i++
    } else {
      remaining = layoutRow(row, remaining, cells)
      row = []
    }
  }
  if (row.length > 0) layoutRow(row, remaining, cells)

  return cells
}

// Worst (largest) aspect ratio of a row of given areas laid along `length`.
function worst(areas: number[], length: number): number {
  if (areas.length === 0) return Infinity
  let sum = 0
  let max = -Infinity
  let min = Infinity
  for (const a of areas) {
    sum += a
    if (a > max) max = a
    if (a < min) min = a
  }
  if (sum <= 0) return Infinity
  const s2 = sum * sum
  const l2 = length * length
  return Math.max((l2 * max) / s2, s2 / (l2 * min))
}

// Lay a finished row along the shorter side of `rect`; return the leftover rect.
function layoutRow(row: ScaledItem[], rect: Rect, cells: TreemapCell[]): Rect {
  const sum = row.reduce((s, r) => s + r.value, 0)
  if (sum <= 0) return rect

  if (rect.w >= rect.h) {
    // Vertical strip (column) on the left; subdivide along y.
    const t = sum / rect.h
    let y = rect.y
    for (const r of row) {
      const h = r.value / t
      cells.push({ id: r.id, rect: { x: rect.x, y, w: t, h } })
      y += h
    }
    return { x: rect.x + t, y: rect.y, w: Math.max(0, rect.w - t), h: rect.h }
  } else {
    // Horizontal strip (row) on top; subdivide along x.
    const t = sum / rect.w
    let x = rect.x
    for (const r of row) {
      const w = r.value / t
      cells.push({ id: r.id, rect: { x, y: rect.y, w, h: t } })
      x += w
    }
    return { x: rect.x, y: rect.y + t, w: rect.w, h: Math.max(0, rect.h - t) }
  }
}
