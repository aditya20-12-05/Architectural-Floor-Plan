import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { historyReducer, initHistory } from './state'
import { loadConfig, saveConfig } from './storage'
import { computeLayout, summarizeAreas, overlappingIds } from './layout'
import { AREA_TOLERANCE } from './constants'
import { ThreeHandles, frameCamera, frameTopDown, defaultCameraPosition } from './cameraApi'
import { exportViewPNG, exportConfigJSON, readConfigFile } from './export'
import { normalizeConfig } from './storage'
import { Walkway } from './types'
import Scene from './components/Scene'
import ControlPanel from './components/ControlPanel'
import RoomSchedule from './components/RoomSchedule'
import TitleBlock from './components/TitleBlock'

const WELCOME_KEY = 'blueprint-floorplan:welcomed:v1'

export default function App() {
  const [hist, dispatch] = useReducer(historyReducer, undefined, () => initHistory(loadConfig()))
  const config = hist.present
  const canUndo = hist.past.length > 0
  const canRedo = hist.future.length > 0
  const undo = () => dispatch({ type: 'undo' })
  const redo = () => dispatch({ type: 'redo' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [editTool, setEditTool] = useState<'move' | 'walkway'>('move')
  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      return !localStorage.getItem(WELCOME_KEY)
    } catch {
      return false
    }
  })
  const dismissWelcome = () => {
    try {
      localStorage.setItem(WELCOME_KEY, '1')
    } catch {
      /* ignore */
    }
    setShowWelcome(false)
  }
  const handlesRef = useRef<ThreeHandles | null>(null)

  const roomDragEnabled = mode === 'view' || editTool === 'move'
  const walkwayActive = mode === 'edit' && editTool === 'walkway'

  const layout = useMemo(
    () => computeLayout(config),
    [config.rooms, config.carpetArea, config.walkableArea]
  )
  const summary = useMemo(() => summarizeAreas(config, AREA_TOLERANCE), [config])
  const overlapCount = useMemo(() => overlappingIds(layout.footprints).size, [layout])

  // Persist to localStorage (debounced, so live reshaping does not hammer it).
  useEffect(() => {
    const t = setTimeout(() => saveConfig(config), 350)
    return () => clearTimeout(t)
  }, [config])

  // Drop selection if the selected room was removed.
  useEffect(() => {
    if (selectedId && !config.rooms.some((r) => r.id === selectedId)) setSelectedId(null)
  }, [config.rooms, selectedId])

  // Keyboard shortcuts (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) dispatch({ type: 'redo' })
        else dispatch({ type: 'undo' })
        return
      }
      if (meta && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        dispatch({ type: 'redo' })
        return
      }
      if (e.key === 'Escape') {
        setSelectedId(null)
        return
      }
      const room = config.rooms.find((r) => r.id === selectedId)
      if (!room || room.px == null || room.pz == null) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        dispatch({ type: 'unplaceRoom', id: room.id })
        setSelectedId(null)
        return
      }
      if (e.key.toLowerCase() === 'r') {
        dispatch({
          type: 'setRot',
          id: room.id,
          rot: (room.rot ?? 0) + (e.shiftKey ? -Math.PI / 2 : Math.PI / 2),
        })
        return
      }
      const step = e.shiftKey ? 5 : 1
      const nudge = (dx: number, dz: number) => {
        e.preventDefault()
        dispatch({ type: 'placeRoom', id: room.id, px: (room.px as number) + dx, pz: (room.pz as number) + dz })
      }
      if (e.key === 'ArrowLeft') nudge(-step, 0)
      else if (e.key === 'ArrowRight') nudge(step, 0)
      else if (e.key === 'ArrowUp') nudge(0, -step)
      else if (e.key === 'ArrowDown') nudge(0, step)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [config, selectedId])

  const reset = () => {
    if (handlesRef.current)
      frameCamera(handlesRef.current, layout.slabW, layout.slabD, config.wallHeight, false)
  }
  const snapIso = () => {
    if (handlesRef.current)
      frameCamera(handlesRef.current, layout.slabW, layout.slabD, config.wallHeight, true)
  }
  // Explicit initial framing once the camera/controls exist (handles the
  // locked-on-load case where OrbitControls won't orient the camera itself).
  const handleReady = () => {
    if (handlesRef.current)
      frameCamera(
        handlesRef.current,
        layout.slabW,
        layout.slabD,
        config.wallHeight,
        config.view.lockIso
      )
  }
  const exportPNG = () => {
    if (handlesRef.current) exportViewPNG(handlesRef.current, config)
  }
  const exportJSON = () => exportConfigJSON(config)
  const importJSON = (file: File) => {
    readConfigFile(file)
      .then((c) => dispatch({ type: 'import', config: normalizeConfig(c) }))
      .catch(() => window.alert('Could not read that file as JSON.'))
  }
  const loadSample = () => {
    setSelectedId(null)
    dispatch({ type: 'loadSample' })
  }
  const placeRoom = (id: string, px: number, pz: number) =>
    dispatch({ type: 'placeRoom', id, px, pz })
  const resetLayout = () => dispatch({ type: 'resetLayout' })
  const autoArrange = () => dispatch({ type: 'autoArrange' })
  const setRot = (id: string, rot: number) => dispatch({ type: 'setRot', id, rot })
  const setShape = (id: string, points: [number, number][]) =>
    dispatch({ type: 'setShape', id, shapeName: 'Custom', shapePoints: points })
  const addWalkway = (w: Walkway) => dispatch({ type: 'addWalkway', walkway: w })
  const removeWalkway = (id: string) => dispatch({ type: 'removeWalkway', id })
  const clearWalkways = () => dispatch({ type: 'clearWalkways' })

  // Drag a room chip from the menu onto the base to place it there.
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    const h = handlesRef.current
    if (!id || !h) return
    const room = config.rooms.find((r) => r.id === id)
    if (!room) return
    const rect = h.gl.domElement.getBoundingClientRect()
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1
    const ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2(nx, ny), h.camera)
    const pt = new THREE.Vector3()
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt)) return
    placeRoom(id, Math.round(pt.x), Math.round(pt.z))
  }

  const enterEdit = () => {
    setMode('edit')
    const h = handlesRef.current
    if (h) {
      frameTopDown(h, layout.slabW, layout.slabD)
      if (h.controls) h.controls.enableRotate = false
    }
  }
  const enterView = () => {
    setMode('view')
    setEditTool('move')
    const h = handlesRef.current
    if (h) {
      frameCamera(h, layout.slabW, layout.slabD, config.wallHeight, false)
      if (h.controls) h.controls.enableRotate = !config.view.lockIso
    }
  }

  // Initial camera placement (re-framing afterwards is via the toolbar).
  const initialCam = useMemo(
    () => defaultCameraPosition(layout.slabW, layout.slabD, config.wallHeight, config.view.lockIso),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return (
    <div className="app">
      <ControlPanel
        config={config}
        dispatch={dispatch}
        selectedId={selectedId}
        onSelect={setSelectedId}
        summary={summary}
        onExportPNG={exportPNG}
        onExportJSON={exportJSON}
        onImportJSON={importJSON}
        onLoadSample={loadSample}
      />
      <div
        className="stage"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <Canvas
          camera={{ position: initialCam, fov: 30, near: 0.1, far: 4000 }}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          dpr={[1, 2]}
          onCreated={({ camera }) => camera.lookAt(0, config.wallHeight * 0.25, 0)}
          onPointerMissed={() => setSelectedId(null)}
        >
          <Scene
            layout={layout}
            config={config}
            selectedId={selectedId}
            roomDragEnabled={roomDragEnabled}
            walkwayActive={walkwayActive}
            editMode={mode === 'edit'}
            onSelect={setSelectedId}
            onPlace={placeRoom}
            onAddWalkway={addWalkway}
            onRemoveWalkway={removeWalkway}
            onSetRot={setRot}
            onSetShape={setShape}
            handlesRef={handlesRef}
            onSnapIso={snapIso}
            onReady={handleReady}
          />
        </Canvas>

        <div className="cam-toolbar">
          <button onClick={undo} disabled={!canUndo} title="Undo (Cmd/Ctrl+Z)">
            ↶
          </button>
          <button onClick={redo} disabled={!canRedo} title="Redo (Cmd/Ctrl+Shift+Z)">
            ↷
          </button>
          {mode === 'view' ? (
            <>
              <button onClick={reset} title="Reset to the default 3/4 view">
                Reset View
              </button>
              <button onClick={snapIso} title="Snap to a true isometric angle">
                Isometric
              </button>
              <button
                className={config.view.lockIso ? 'primary' : ''}
                onClick={() => dispatch({ type: 'toggleView', key: 'lockIso' })}
                title="Lock the camera to the isometric angle (disables orbit)"
              >
                {config.view.lockIso ? 'Locked' : 'Lock Iso'}
              </button>
              <button
                className="primary"
                onClick={enterEdit}
                title="Top-down mode: move, reshape and rotate rooms, draw walkways"
              >
                Edit Layout
              </button>
            </>
          ) : (
            <>
              <button
                className={editTool === 'move' ? 'primary' : ''}
                onClick={() => setEditTool('move')}
                title="Drag rooms to move them; they snap to neighbours"
              >
                Move
              </button>
              <button
                className={editTool === 'walkway' ? 'primary' : ''}
                onClick={() => setEditTool('walkway')}
                title="Drag on the base to draw corridor strips; click one to erase"
              >
                Draw Walkway
              </button>
              {config.walkways.length > 0 && (
                <button onClick={clearWalkways} title="Remove all corridor strips">
                  Clear Walkways
                </button>
              )}
              <button onClick={autoArrange} title="Tile every room into a double-loaded corridor">
                Auto-arrange
              </button>
              <button onClick={resetLayout} title="Send all rooms back to the menu (empty the plan)">
                Clear Plan
              </button>
              <button onClick={enterView} title="Return to the 3D orbit view">
                Done · 3D
              </button>
            </>
          )}
          <button className="help-btn" onClick={() => setShowWelcome(true)} title="How it works">
            ?
          </button>
        </div>

        {overlapCount > 0 && (
          <div
            className="overlap-warn"
            title="Rooms drawn in red overlap each other. Drag them apart, or use Auto-arrange to re-tile."
          >
            ⚠ {overlapCount} room{overlapCount > 1 ? 's' : ''} overlapping
          </div>
        )}

        {mode === 'edit' && (
          <div className="edit-hint">
            {editTool === 'walkway'
              ? 'Walkway tool · drag on the base to draw a corridor strip; click a corridor to erase it.'
              : 'Edit · drag a room to move it; click to select, then drag white corners to reshape (area kept) or the round handle to rotate. Keys: R rotate · arrows nudge · Delete remove · Esc deselect · ⌘/Ctrl+Z undo.'}
          </div>
        )}

        {layout.footprints.length === 0 && !showWelcome && (
          <div className="empty-plan">
            <p>No rooms on the plan yet.</p>
            <p className="sub">
              Drag a room's <span className="kbd">⠿</span> handle from the menu onto the base, or tile
              them all at once:
            </p>
            <button
              className="primary"
              onClick={() => {
                if (mode === 'view') enterEdit()
                autoArrange()
              }}
            >
              Auto-arrange rooms
            </button>
          </div>
        )}

        {showWelcome && (
          <div className="welcome-backdrop" onClick={dismissWelcome}>
            <div className="welcome-card" onClick={(e) => e.stopPropagation()}>
              <h2>Isometric Floor-Plan Generator</h2>
              <p className="welcome-lead">
                Lay out an office floor in 3D — rooms size themselves to the areas you enter and stay
                balanced against the carpet area.
              </p>
              <ol className="welcome-steps">
                <li>
                  <b>Edit rooms</b> in the left panel — name, area, category and shape. Add or remove
                  rooms anytime.
                </li>
                <li>
                  <b>Edit Layout</b> (top-right) opens a top-down view. Drag rooms to move them, the
                  white corners to reshape (area kept), the round handle to rotate.
                </li>
                <li>
                  <b>Place from the menu</b> — drag a room's <span className="kbd">⠿</span> handle onto
                  the base, or hit <b>Auto-arrange</b> to tile everything into a corridor.
                </li>
                <li>
                  <b>Draw Walkway</b> lets you drag corridor strips; rooms snap to each other and turn
                  red if they overlap.
                </li>
                <li>
                  <b>Done · 3D</b> returns to the orbit view. Export PNG or JSON whenever you like — it
                  all auto-saves.
                </li>
              </ol>
              <button className="primary" onClick={dismissWelcome}>
                Got it
              </button>
            </div>
          </div>
        )}

        {config.view.schedule && (
          <RoomSchedule rooms={config.rooms} selectedId={selectedId} onSelect={setSelectedId} />
        )}
        {config.view.titleBlock && <TitleBlock title={config.title} />}
      </div>
    </div>
  )
}
