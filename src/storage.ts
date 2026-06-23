import { FloorConfig, Room, Category, ViewToggles, TitleBlockInfo } from './types'
import { SAMPLE_CONFIG } from './sampleConfig'
import { uid } from './constants'
import { ensurePlaced } from './layout'

const KEY = 'blueprint-floorplan:config:v1'

export function loadConfig(): FloorConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return ensurePlaced(clone(SAMPLE_CONFIG))
    return ensurePlaced(normalizeConfig(JSON.parse(raw)))
  } catch {
    return ensurePlaced(clone(SAMPLE_CONFIG))
  }
}

export function saveConfig(config: FloorConfig): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(config))
  } catch {
    /* ignore quota / private-mode errors */
  }
}

function clone(c: FloorConfig): FloorConfig {
  return JSON.parse(JSON.stringify(c))
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number)
  return Number.isFinite(n) ? n : fallback
}
function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

// Coerce arbitrary (imported or older) JSON into a valid FloorConfig.
export function normalizeConfig(input: any): FloorConfig {
  const d = SAMPLE_CONFIG
  const rawRooms = Array.isArray(input?.rooms) ? input.rooms : d.rooms
  const rooms: Room[] = rawRooms.map((r: any, i: number) => {
    const room: Room = {
      id: str(r?.id, '') || uid(),
      name: str(r?.name, `Room ${i + 1}`),
      area: Math.max(0, num(r?.area, 100)),
      category: (r?.category === 'Internal' ? 'Internal' : 'Billable') as Category,
      flagship: bool(r?.flagship, false),
    }
    if (typeof r?.px === 'number') room.px = r.px
    if (typeof r?.pz === 'number') room.pz = r.pz
    if (typeof r?.rot === 'number') room.rot = r.rot
    if (typeof r?.shapeName === 'string') room.shapeName = r.shapeName
    if (Array.isArray(r?.shapePoints)) room.shapePoints = r.shapePoints as [number, number][]
    return room
  })
  const seen = new Set<string>()
  for (const r of rooms) {
    while (seen.has(r.id)) r.id = uid()
    seen.add(r.id)
  }
  const view: ViewToggles = {
    labels: bool(input?.view?.labels, d.view.labels),
    roomNumbers: bool(input?.view?.roomNumbers, d.view.roomNumbers),
    grid: bool(input?.view?.grid, d.view.grid),
    titleBlock: bool(input?.view?.titleBlock, d.view.titleBlock),
    schedule: bool(input?.view?.schedule, d.view.schedule),
    wireframe: bool(input?.view?.wireframe, d.view.wireframe),
    lockIso: bool(input?.view?.lockIso, d.view.lockIso),
  }
  const title: TitleBlockInfo = {
    project: str(input?.title?.project, d.title.project),
    drawing: str(input?.title?.drawing, d.title.drawing),
    scale: str(input?.title?.scale, d.title.scale),
    sheet: str(input?.title?.sheet, d.title.sheet),
    location: str(input?.title?.location, d.title.location ?? ''),
    headline: str(input?.title?.headline, d.title.headline ?? 'The floor, drawn to plan.'),
    brand: str(input?.title?.brand, d.title.brand ?? 'THE SPACE'),
  }
  const walkways = Array.isArray(input?.walkways)
    ? input.walkways.map((w: any) => ({
        id: str(w?.id, '') || uid(),
        x: num(w?.x, 0),
        z: num(w?.z, 0),
        w: Math.max(1, num(w?.w, 4)),
        d: Math.max(1, num(w?.d, 4)),
      }))
    : []

  return {
    totalArea: Math.max(0, num(input?.totalArea, d.totalArea)),
    carpetArea: Math.max(1, num(input?.carpetArea, d.carpetArea)),
    walkableArea: Math.max(0, num(input?.walkableArea, d.walkableArea)),
    wallHeight: Math.max(1, num(input?.wallHeight, d.wallHeight)),
    rooms: rooms.length > 0 ? rooms : clone(d).rooms,
    walkways,
    view,
    title,
  }
}
