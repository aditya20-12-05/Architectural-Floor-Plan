import { useEffect, useRef, useState } from 'react'
import { FloorConfig, Category, ViewToggles } from '../types'
import { Action } from '../state'
import { AreaSummary } from '../layout'
import { roomNo } from '../constants'
import { SHAPE_PRESETS, shapeByName } from '../shapes'

interface Props {
  config: FloorConfig
  dispatch: React.Dispatch<Action>
  selectedId: string | null
  onSelect: (id: string | null) => void
  summary: AreaSummary
  onExportPNG: () => void
  onExportJSON: () => void
  onImportJSON: (file: File) => void
  onLoadSample: () => void
}

const VIEW_LABELS: [keyof ViewToggles, string][] = [
  ['labels', 'Labels'],
  ['roomNumbers', 'Room Nos'],
  ['grid', 'Floor Grid'],
  ['titleBlock', 'Title Block'],
  ['schedule', 'Schedule'],
  ['wireframe', 'Wireframe'],
]

function NumberInput({
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  step?: number
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  return (
    <input
      type="number"
      value={text}
      min={min}
      step={step}
      onChange={(e) => {
        setText(e.target.value)
        const n = parseFloat(e.target.value)
        if (Number.isFinite(n)) onChange(Math.max(min, n))
      }}
      onBlur={() => {
        const n = parseFloat(text)
        if (!Number.isFinite(n)) setText(String(value))
      }}
    />
  )
}

export default function ControlPanel({
  config,
  dispatch,
  selectedId,
  onSelect,
  summary,
  onExportPNG,
  onExportJSON,
  onImportJSON,
  onLoadSample,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)

  // Focus the selected room's editor when a block is clicked in the scene.
  useEffect(() => {
    if (!selectedId || !listRef.current) return
    const node = listRef.current.querySelector<HTMLElement>(`[data-room-id="${selectedId}"]`)
    if (node) {
      node.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      node.querySelector<HTMLInputElement>('input.room-name')?.focus()
    }
  }, [selectedId])

  const reorderTo = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const ids = config.rooms.map((r) => r.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    ids.splice(from, 1)
    ids.splice(to, 0, dragId)
    dispatch({ type: 'reorder', order: ids })
  }

  const pct = summary.available > 0 ? summary.allocated / summary.available : 0
  const over = summary.allocated > summary.available + 0.5

  return (
    <div className="panel">
      <div>
        <h1 className="panel-title">Blueprint Floor-Plan</h1>
        <p className="panel-sub">Isometric Generator</p>
      </div>

      {/* Title block fields */}
      <div className="section">
        <h3>Sheet</h3>
        <div className="field-row">
          <label>Project</label>
          <input
            type="text"
            value={config.title.project}
            onChange={(e) => dispatch({ type: 'setTitle', field: 'project', value: e.target.value })}
          />
        </div>
        <div className="field-row">
          <label>Drawing</label>
          <input
            type="text"
            value={config.title.drawing}
            onChange={(e) => dispatch({ type: 'setTitle', field: 'drawing', value: e.target.value })}
          />
        </div>
        <div className="field-row">
          <label>Sheet No</label>
          <input
            type="text"
            value={config.title.sheet}
            onChange={(e) => dispatch({ type: 'setTitle', field: 'sheet', value: e.target.value })}
          />
        </div>
      </div>

      {/* Floor areas */}
      <div className="section">
        <h3>Floor</h3>
        <div className="field-row">
          <label>Built-up (sq ft)</label>
          <NumberInput
            value={config.totalArea}
            onChange={(v) => dispatch({ type: 'setFloor', field: 'totalArea', value: v })}
            step={50}
          />
        </div>
        <div className="field-row">
          <label>Carpet (sq ft)</label>
          <NumberInput
            value={config.carpetArea}
            onChange={(v) => dispatch({ type: 'setFloor', field: 'carpetArea', value: v })}
            step={50}
            min={1}
          />
        </div>
        <div className="field-row">
          <label>Walkable (sq ft)</label>
          <NumberInput
            value={config.walkableArea}
            onChange={(v) => dispatch({ type: 'setFloor', field: 'walkableArea', value: v })}
            step={25}
          />
        </div>
        <div className="field-row">
          <label>Wall Height (ft)</label>
          <NumberInput
            value={config.wallHeight}
            onChange={(v) => dispatch({ type: 'setFloor', field: 'wallHeight', value: v })}
            step={1}
            min={1}
          />
        </div>
      </div>

      {/* Live readout */}
      <div className="section">
        <h3>Allocation</h3>
        <div className="readout">
          <div className="row">
            <span>Allocated rooms</span>
            <b>{Math.round(summary.allocated).toLocaleString()} sf</b>
          </div>
          <div className="row">
            <span>Available (carpet − walkable)</span>
            <b>{Math.round(summary.available).toLocaleString()} sf</b>
          </div>
          <div className="bar">
            <span
              className={over ? 'over' : ''}
              style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%` }}
            />
          </div>
          <div className={`balance ${summary.balanced ? 'ok' : 'warn'}`}>
            {summary.balanced
              ? '✓ Balanced — rooms + walkable = carpet'
              : summary.diff > 0
              ? `▲ Over by ${Math.round(Math.abs(summary.diff)).toLocaleString()} sf — rooms + walkable exceed carpet`
              : `▼ Short by ${Math.round(Math.abs(summary.diff)).toLocaleString()} sf — rooms + walkable below carpet`}
          </div>
        </div>
      </div>

      {/* Rooms */}
      <div className="section">
        <h3>
          Rooms · {config.rooms.length}
        </h3>
        <div className="rooms" ref={listRef}>
          {config.rooms.map((room, i) => (
            <div
              key={room.id}
              data-room-id={room.id}
              className={`room-item${selectedId === room.id ? ' selected' : ''}${
                dragId === room.id ? ' dragging' : ''
              }`}
              onClick={() => onSelect(room.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                reorderTo(room.id)
                setDragId(null)
              }}
            >
              <div className="room-head">
                <span
                  className="drag-handle"
                  draggable
                  title="Drag to reorder, or onto the plan to place"
                  onDragStart={(e) => {
                    setDragId(room.id)
                    e.dataTransfer.setData('text/plain', room.id)
                    e.dataTransfer.effectAllowed = 'copyMove'
                  }}
                  onDragEnd={() => setDragId(null)}
                >
                  ⠿
                </span>
                <span className={`room-no${room.flagship ? ' flagship' : ''}`}>{roomNo(i)}</span>
                <input
                  type="text"
                  className={`room-name${room.flagship ? ' flagship-focus' : ''}`}
                  value={room.name}
                  onChange={(e) =>
                    dispatch({ type: 'updateRoom', id: room.id, patch: { name: e.target.value } })
                  }
                />
              </div>
              <div className="room-grid">
                <div>
                  <span className="mini-label">Area (sq ft)</span>
                  <NumberInput
                    value={room.area}
                    onChange={(v) =>
                      dispatch({ type: 'updateRoom', id: room.id, patch: { area: v } })
                    }
                    step={25}
                  />
                </div>
                <div>
                  <span className="mini-label">Category</span>
                  <select
                    value={room.category}
                    onChange={(e) =>
                      dispatch({
                        type: 'updateRoom',
                        id: room.id,
                        patch: { category: e.target.value as Category },
                      })
                    }
                  >
                    <option value="Billable">Billable</option>
                    <option value="Internal">Internal</option>
                  </select>
                </div>
                <div>
                  <span className="mini-label">Shape</span>
                  <select
                    value={room.shapeName ?? 'Square'}
                    onChange={(e) => {
                      if (e.target.value === 'Custom') {
                        const pts = room.shapePoints ?? shapeByName(room.shapeName).points
                        dispatch({ type: 'setShape', id: room.id, shapeName: 'Custom', shapePoints: pts })
                      } else {
                        const sh = shapeByName(e.target.value)
                        dispatch({
                          type: 'setShape',
                          id: room.id,
                          shapeName: sh.name,
                          shapePoints: sh.points,
                        })
                      }
                    }}
                  >
                    {SHAPE_PRESETS.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                    <option value="Custom">Custom</option>
                  </select>
                </div>
              </div>
              <div className="room-place">
                <span className={`place-badge ${room.px != null ? 'on' : 'off'}`}>
                  {room.px != null ? '● On plan' : '○ In menu'}
                </span>
                {room.px != null ? (
                  <button
                    className="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      dispatch({ type: 'unplaceRoom', id: room.id })
                    }}
                  >
                    Send to menu
                  </button>
                ) : (
                  <button
                    className="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      dispatch({ type: 'placeRoom', id: room.id, px: 0, pz: 0 })
                    }}
                  >
                    Place on plan
                  </button>
                )}
              </div>
              <div className="room-actions">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={room.flagship}
                    onChange={(e) =>
                      dispatch({
                        type: 'updateRoom',
                        id: room.id,
                        patch: { flagship: e.target.checked },
                      })
                    }
                  />
                  Flagship
                </label>
                <button
                  className="ghost danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (selectedId === room.id) onSelect(null)
                    dispatch({ type: 'removeRoom', id: room.id })
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <button className="primary" onClick={() => dispatch({ type: 'addRoom' })}>
          + Add Room
        </button>
      </div>

      {/* View toggles */}
      <div className="section">
        <h3>View</h3>
        <div className="toggles">
          {VIEW_LABELS.map(([key, label]) => (
            <label className="toggle" key={key}>
              <input
                type="checkbox"
                checked={config.view[key]}
                onChange={() => dispatch({ type: 'toggleView', key })}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Data */}
      <div className="section">
        <h3>Data</h3>
        <div className="btn-row">
          <button onClick={onExportJSON}>Export JSON</button>
          <button onClick={() => fileRef.current?.click()}>Import JSON</button>
        </div>
        <div className="btn-row">
          <button onClick={onExportPNG}>Export PNG</button>
          <button onClick={onLoadSample}>Reset Sample</button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden-file"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onImportJSON(f)
            e.target.value = ''
          }}
        />
      </div>

      <p className="footer-note">
        Drag <span className="kbd">⠿</span> to reorder, or onto the plan to place a room ·{' '}
        <b>Edit Layout</b> (top-right) for top-down editing and walkways · config auto-saves.
      </p>
    </div>
  )
}
