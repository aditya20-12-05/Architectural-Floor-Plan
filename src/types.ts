export type Category = 'Billable' | 'Internal'

export interface Room {
  id: string
  name: string
  area: number // sq ft
  category: Category
  flagship: boolean
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

export interface FloorConfig {
  totalArea: number // built-up area, sq ft
  carpetArea: number // sq ft
  walkableArea: number // circulation, sq ft
  wallHeight: number // ft
  rooms: Room[]
  view: ViewToggles
  title: TitleBlockInfo
}
