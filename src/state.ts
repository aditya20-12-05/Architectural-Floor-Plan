import { FloorConfig, Room, ViewToggles, TitleBlockInfo, Walkway } from './types'
import { uid } from './constants'
import { normalizeConfig } from './storage'
import { SAMPLE_CONFIG } from './sampleConfig'
import { magicLayout, ensurePlaced } from './layout'

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
  | { type: 'setDoor'; id: string; doorEdge: number; doorT: number }
  | { type: 'unplaceRoom'; id: string }
  | { type: 'autoArrange' }
  | { type: 'resetLayout' }
  | { type: 'addWalkway'; walkway: Walkway }
  | { type: 'removeWalkway'; id: string }
  | { type: 'clearWalkways' }
  | { type: 'setSlabShape'; shapeName: string; points: [number, number][] }
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

    case 'setDoor':
      return {
        ...state,
        rooms: state.rooms.map((r) =>
          r.id === action.id ? { ...r, doorEdge: action.doorEdge, doorT: action.doorT } : r
        ),
      }

    case 'unplaceRoom':
      return {
        ...state,
        rooms: state.rooms.map((r) => {
          if (r.id !== action.id) return r
          const { px, pz, rot, ...rest } = r
          void px
          void pz
          void rot
          return rest
        }),
      }

    case 'autoArrange': {
      const { rooms, walkways } = magicLayout(state)
      return { ...state, rooms, walkways }
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

    case 'setSlabShape':
      return { ...state, slabShapeName: action.shapeName, slabPoints: action.points }

    case 'toggleView':
      return { ...state, view: { ...state.view, [action.key]: !state.view[action.key] } }

    case 'setTitle':
      return { ...state, title: { ...state.title, [action.field]: action.value } }

    case 'import':
      return ensurePlaced(normalizeConfig(action.config))

    case 'loadSample':
      return ensurePlaced(JSON.parse(JSON.stringify(SAMPLE_CONFIG)))

    default:
      return state
  }
}

// ---- Undo / redo history wrapper -----------------------------------------
export interface HistoryState {
  past: FloorConfig[]
  present: FloorConfig
  future: FloorConfig[]
  lastKey: string | null
}

export type HistoryAction = Action | { type: 'undo' } | { type: 'redo' }

const HISTORY_LIMIT = 80

export function initHistory(present: FloorConfig): HistoryState {
  return { past: [], present, future: [], lastKey: null }
}

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  if (action.type === 'undo') {
    if (state.past.length === 0) return state
    const previous = state.past[state.past.length - 1]
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future],
      lastKey: null,
    }
  }
  if (action.type === 'redo') {
    if (state.future.length === 0) return state
    return {
      past: [...state.past, state.present],
      present: state.future[0],
      future: state.future.slice(1),
      lastKey: null,
    }
  }

  const newPresent = reducer(state.present, action)
  if (newPresent === state.present) return state

  const a = action as { id?: string; field?: string; key?: string }
  const key = `${action.type}:${a.id ?? a.field ?? a.key ?? ''}`

  // Coalesce continuous edits of the same target into a single undo step.
  // (Each Magic Layout is its own step so you can undo back through variants.)
  if (key === state.lastKey && state.past.length > 0 && action.type !== 'autoArrange') {
    return { ...state, present: newPresent }
  }

  return {
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    present: newPresent,
    future: [],
    lastKey: key,
  }
}
