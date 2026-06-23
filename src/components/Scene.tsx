import { Layout } from '../layout'
import { FloorConfig } from '../types'
import { ThreeHandles } from '../cameraApi'
import { PALETTE } from '../constants'
import FloorSlab from './FloorSlab'
import FloorGrid from './FloorGrid'
import CorridorLayer from './CorridorLayer'
import EntranceLayer from './EntranceLayer'
import Dimensions from './Dimensions'
import RoomsLayer from './RoomsLayer'
import NorthArrow from './NorthArrow'
import CameraRig from './CameraRig'

interface Props {
  layout: Layout
  config: FloorConfig
  selectedId: string | null
  onSelect: (id: string) => void
  onPlace: (id: string, px: number, pz: number, pw: number, pd: number) => void
  handlesRef: React.MutableRefObject<ThreeHandles | null>
  onSnapIso: () => void
  onReady: () => void
}

export default function Scene({
  layout,
  config,
  selectedId,
  onSelect,
  onPlace,
  handlesRef,
  onSnapIso,
  onReady,
}: Props) {
  return (
    <>
      <color attach="background" args={[PALETTE.bg]} />
      <ambientLight intensity={1} />
      <FloorSlab slabW={layout.slabW} slabD={layout.slabD} />
      {config.view.grid && <FloorGrid slabW={layout.slabW} slabD={layout.slabD} />}
      <CorridorLayer corridors={layout.corridors} />
      <EntranceLayer entrance={layout.entrance} />
      <RoomsLayer
        layout={layout}
        rooms={config.rooms}
        view={config.view}
        wallHeight={config.wallHeight}
        selectedId={selectedId}
        onSelect={onSelect}
        onPlace={onPlace}
      />
      <Dimensions slabW={layout.slabW} slabD={layout.slabD} />
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
