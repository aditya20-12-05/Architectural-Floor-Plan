import { FloorConfig, Room, ViewToggles, TitleBlockInfo, Walkway } from './types'
import { uid } from './constants'
import { normalizeConfig } from './storage'
import { SAMPLE_CONFIG } from './sampleConfig'

export type Action =
  | { type: 'setFloor'; field: 'totalArea' | 'carpetArea' | 'walkableArea' | 'wallHeight'; value: number }
  | { type: 'addRoom' }
  | { type: 'removeRoom'; id: string }
  | { type: 'updateRoom'; id: string; patch: Partial<Room> }
  | { type: 'reorder'; order: string[] }
  | { type: 'swap'; a: string; b: string }
  | { type: 'placeRoom'; id: string; px: number; pz: number }
  | { type: 'setShape'; id: string; shapeName: string; shapePoints: [number, number][] }
  | { type: 'setRot'; id: string; rot: number }
  | { type: 'resetLayout' }
  | { type: 'addWalkway'; walkway: Walkway }
  | { type: 'removeWalkway'; id: string }
  | { type: 'clearWalkways' }
  | { type: 'toggleView'; key: keyof ViewToggles }
  | { type: 'setTitle'; field: keyof TitleBlockInfo; value: string }
  | { type: 'import'; config: unknown }
  | { type: 'loadSample' }

export function reducer(state: FloorConfig, action: Action): FloorConfig {
  switch (action.type) {
    case 'setFloor':
      return { ...state, [action.field]: Math.max(0, action.value) }

    case 'addRoom': {
      const room: Room = {
        id: uid(),
        name: `New Room ${state.rooms.length + 1}`,
        area: 150,
        category: 'Billable',
        flagship: false,
      }
      return { ...state, rooms: [...state.rooms, room] }
    }

    case 'removeRoom':
      return { ...state, rooms: state.rooms.filter((r) => r.id !== action.id) }

    case 'updateRoom':
      return {
        ...state,
        rooms: state.rooms.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
      }

    case 'reorder': {
      const byId = new Map(state.rooms.map((r) => [r.id, r]))
      const next: Room[] = []
      for (const id of action.order) {
        const r = byId.get(id)
        if (r) {
          next.push(r)
          byId.delete(id)
        }
      }
      for (const r of byId.values()) next.push(r) // keep any not mentioned
      return { ...state, rooms: next }
    }

    case 'swap': {
      const arr = state.rooms.slice()
      const i = arr.findIndex((r) => r.id === action.a)
      const j = arr.findIndex((r) => r.id === action.b)
      if (i < 0 || j < 0 || i === j) return state
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
      return { ...state, rooms: arr }
    }

    case 'placeRoom':
      return {
        ...state,
        rooms: state.rooms.map((r) =>
          r.id === action.id ? { ...r, px: action.px, pz: action.pz } : r
        ),
      }

    case 'setShape':
      return {
        ...state,
        rooms: state.rooms.map((r) =>
          r.id === action.id
            ? { ...r, shapeName: action.shapeName, shapePoints: action.shapePoints }
            : r
        ),
      }

    case 'setRot':
      return {
        ...state,
        rooms: state.rooms.map((r) => (r.id === action.id ? { ...r, rot: action.rot } : r)),
      }

    case 'resetLayout':
      return {
        ...state,
        rooms: state.rooms.map((r) => {
          const { px, pz, rot, ...rest } = r
          void px
          void pz
          void rot
          return rest
        }),
      }

    case 'addWalkway':
      return { ...state, walkways: [...state.walkways, action.walkway] }

    case 'removeWalkway':
      return { ...state, walkways: state.walkways.filter((w) => w.id !== action.id) }

    case 'clearWalkways':
      return { ...state, walkways: [] }

    case 'toggleView':
      return { ...state, view: { ...state.view, [action.key]: !state.view[action.key] } }

    case 'setTitle':
      return { ...state, title: { ...state.title, [action.field]: action.value } }

    case 'import':
      return normalizeConfig(action.config)

    case 'loadSample':
      return JSON.parse(JSON.stringify(SAMPLE_CONFIG))

    default:
      return state
  }
}
