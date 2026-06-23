import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { reducer } from './state'
import { loadConfig, saveConfig } from './storage'
import { computeLayout, summarizeAreas } from './layout'
import { AREA_TOLERANCE } from './constants'
import { ThreeHandles, frameCamera, frameTopDown, defaultCameraPosition } from './cameraApi'
import { exportViewPNG, exportConfigJSON, readConfigFile } from './export'
import { normalizeConfig } from './storage'
import { Walkway } from './types'
import Scene from './components/Scene'
import ControlPanel from './components/ControlPanel'
import RoomSchedule from './components/RoomSchedule'
import TitleBlock from './components/TitleBlock'

export default function App() {
  const [config, dispatch] = useReducer(reducer, undefined, loadConfig)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [editTool, setEditTool] = useState<'move' | 'walkway'>('move')
  const handlesRef = useRef<ThreeHandles | null>(null)

  const roomDragEnabled = mode === 'view' || editTool === 'move'
  const walkwayActive = mode === 'edit' && editTool === 'walkway'

  const layout = useMemo(
    () => computeLayout(config),
    [config.rooms, config.carpetArea, config.walkableArea]
  )
  const summary = useMemo(() => summarizeAreas(config, AREA_TOLERANCE), [config])

  // Persist to localStorage on every change.
  useEffect(() => saveConfig(config), [config])

  // Drop selection if the selected room was removed.
  useEffect(() => {
    if (selectedId && !config.rooms.some((r) => r.id === selectedId)) setSelectedId(null)
  }, [config.rooms, selectedId])

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
  const placeRoom = (id: string, px: number, pz: number, pw: number, pd: number) =>
    dispatch({ type: 'placeRoom', id, px, pz, pw, pd })
  const resetLayout = () => dispatch({ type: 'resetLayout' })
  const addWalkway = (w: Walkway) => dispatch({ type: 'addWalkway', walkway: w })
  const removeWalkway = (id: string) => dispatch({ type: 'removeWalkway', id })
  const clearWalkways = () => dispatch({ type: 'clearWalkways' })

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
      <div className="stage">
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
            onSelect={setSelectedId}
            onPlace={placeRoom}
            onAddWalkway={addWalkway}
            onRemoveWalkway={removeWalkway}
            handlesRef={handlesRef}
            onSnapIso={snapIso}
            onReady={handleReady}
          />
        </Canvas>

        <div className="cam-toolbar">
          {mode === 'view' ? (
            <>
              <button onClick={reset}>Reset View</button>
              <button onClick={snapIso}>Isometric</button>
              <button
                className={config.view.lockIso ? 'primary' : ''}
                onClick={() => dispatch({ type: 'toggleView', key: 'lockIso' })}
              >
                {config.view.lockIso ? 'Locked' : 'Lock Iso'}
              </button>
              <button className="primary" onClick={enterEdit}>
                Edit Layout
              </button>
            </>
          ) : (
            <>
              <button
                className={editTool === 'move' ? 'primary' : ''}
                onClick={() => setEditTool('move')}
              >
                Move
              </button>
              <button
                className={editTool === 'walkway' ? 'primary' : ''}
                onClick={() => setEditTool('walkway')}
              >
                Draw Walkway
              </button>
              {config.walkways.length > 0 && <button onClick={clearWalkways}>Clear Walkways</button>}
              <button onClick={resetLayout}>Reset Layout</button>
              <button onClick={enterView}>Done · 3D</button>
            </>
          )}
        </div>

        {mode === 'edit' && (
          <div className="edit-hint">
            {editTool === 'walkway'
              ? 'Walkway tool · drag on the base to draw a corridor strip; click a corridor to erase it.'
              : 'Edit mode · drag a room to move it (snaps to grid). Switch to Draw Walkway to lay corridors.'}
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
