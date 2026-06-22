import { Layout } from '../layout'
import { FloorConfig } from '../types'
import { ThreeHandles } from '../cameraApi'
import { PALETTE } from '../constants'
import FloorSlab from './FloorSlab'
import FloorGrid from './FloorGrid'
import RoomsLayer from './RoomsLayer'
import NorthArrow from './NorthArrow'
import CameraRig from './CameraRig'

interface Props {
  layout: Layout
  config: FloorConfig
  selectedId: string | null
  onSelect: (id: string) => void
  onSwap: (a: string, b: string) => void
  handlesRef: React.MutableRefObject<ThreeHandles | null>
  onSnapIso: () => void
  onReady: () => void
}

export default function Scene({
  layout,
  config,
  selectedId,
  onSelect,
  onSwap,
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
      <RoomsLayer
        layout={layout}
        rooms={config.rooms}
        view={config.view}
        wallHeight={config.wallHeight}
        selectedId={selectedId}
        onSelect={onSelect}
        onSwap={onSwap}
      />
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
