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
  // A path segment drawn start -> end (ft), rendered as a rounded corridor of
  // the given width. Chain several to build an L / U / branching circulation.
  x1: number
  z1: number
  x2: number
  z2: number
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
}
