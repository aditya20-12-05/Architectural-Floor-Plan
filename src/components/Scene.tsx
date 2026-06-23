import { Layout } from '../layout'
import { FloorConfig, Walkway } from '../types'
import { Pt } from '../shapes'
import EditGizmo from './EditGizmo'
import { ThreeHandles } from '../cameraApi'
import { PALETTE } from '../constants'
import FloorSlab from './FloorSlab'
import FloorGrid from './FloorGrid'
import WalkwayLayer from './WalkwayLayer'
import RoomsLayer from './RoomsLayer'
import NorthArrow from './NorthArrow'
import CameraRig from './CameraRig'

interface Props {
  layout: Layout
  config: FloorConfig
  selectedId: string | null
  roomDragEnabled: boolean
  walkwayActive: boolean
  editMode: boolean
  onSelect: (id: string) => void
  onPlace: (id: string, px: number, pz: number) => void
  onAddWalkway: (w: Walkway) => void
  onRemoveWalkway: (id: string) => void
  onSetRot: (id: string, rot: number) => void
  onSetShape: (id: string, points: Pt[]) => void
  onSetDoor: (id: string, doorEdge: number, doorT: number) => void
  handlesRef: React.MutableRefObject<ThreeHandles | null>
  onSnapIso: () => void
  onReady: () => void
}

export default function Scene({
  layout,
  config,
  selectedId,
  roomDragEnabled,
  walkwayActive,
  editMode,
  onSelect,
  onPlace,
  onAddWalkway,
  onRemoveWalkway,
  onSetRot,
  onSetShape,
  onSetDoor,
  handlesRef,
  onSnapIso,
  onReady,
}: Props) {
  const selectedRoom = config.rooms.find((r) => r.id === selectedId)
  const selectedFp = layout.footprints.find((f) => f.id === selectedId)
  return (
    <>
      <color attach="background" args={[PALETTE.bg]} />
      <ambientLight intensity={1} />
      <FloorSlab slabW={layout.slabW} slabD={layout.slabD} />
      {config.view.grid && <FloorGrid slabW={layout.slabW} slabD={layout.slabD} />}
      <WalkwayLayer
        walkways={config.walkways}
        slabW={layout.slabW}
        slabD={layout.slabD}
        active={walkwayActive}
        onAdd={onAddWalkway}
        onRemove={onRemoveWalkway}
      />
      <RoomsLayer
        layout={layout}
        rooms={config.rooms}
        view={config.view}
        wallHeight={config.wallHeight}
        selectedId={selectedId}
        roomDragEnabled={roomDragEnabled}
        onSelect={onSelect}
        onPlace={onPlace}
      />
      {editMode && selectedRoom && selectedRoom.px != null && selectedFp && (
        <EditGizmo
          room={selectedRoom}
          footprint={selectedFp}
          onSetRot={onSetRot}
          onSetShape={onSetShape}
          onSetDoor={onSetDoor}
        />
      )}
      <NorthArrow slabW={layout.slabW} slabD={layout.slabD} />
      <CameraRig
        handlesRef={handlesRef}
        lockIso={config.view.lockIso}
        onSnapIso={onSnapIso}
        onReady={onReady}
      />
    </>
  )
}
