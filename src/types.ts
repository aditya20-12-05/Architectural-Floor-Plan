export type Category = 'Billable' | 'Internal'

export interface Room {
  id: string
  name: string
  area: number // sq ft
  category: Category
  flagship: boolean
  // Manual placement on the base (feet). When set, overrides the auto layout.
  px?: number
  pz?: number
  pw?: number
  pd?: number
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
}

export interface Walkway {
  id: string
  x: number // centre x (ft)
  z: number // centre z (ft)
  w: number // width (ft)
  d: number // depth (ft)
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
