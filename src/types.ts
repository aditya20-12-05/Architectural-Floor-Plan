export type Category = 'Billable' | 'Internal'

export interface Room {
  id: string
  name: string
  area: number // sq ft
  category: Category
  flagship: boolean
  // Shape (chosen in the menu): a normalized unit-area polygon + display name.
  shapeName?: string
  shapePoints?: [number, number][]
  // Manual placement on the base (feet) + rotation (radians). When px/pz are
  // set, the room is placed manually and overrides the auto layout.
  px?: number
  pz?: number
  rot?: number
  // Door override: which polygon edge the doorway sits on, and where along it
  // (0..1). When unset the door auto-picks the edge facing circulation.
  doorEdge?: number
  doorT?: number
}

export interface ViewToggles {
  labels: boolean
  roomNumbers: boolean
  grid: boolean
  titleBlock: boolean
  schedule: boolean
  wireframe: boolean
  lockIso: boolean
}

export interface TitleBlockInfo {
  project: string
  drawing: string
  scale: string
  sheet: string
  location?: string
  headline?: string
  brand?: string
}

export interface Walkway {
  id: string
  // Centreline path in world XZ (>= 2 points), rendered as a smooth, rounded
  // corridor of the given width. Two points = a straight run; more = a curve.
  points: [number, number][]
  width: number // ft
}

export interface FloorConfig {
  totalArea: number // built-up area, sq ft
  carpetArea: number // sq ft
  walkableArea: number // circulation, sq ft
  wallHeight: number // ft
  rooms: Room[]
  walkways: Walkway[]
  view: ViewToggles
  title: TitleBlockInfo
  // Shape of the whole floor plate, as a normalized unit-area polygon (scaled
  // by sqrt(carpetArea)). Unset = the default 1.6:1 rectangle.
  slabShapeName?: string
  slabPoints?: [number, number][]
}
