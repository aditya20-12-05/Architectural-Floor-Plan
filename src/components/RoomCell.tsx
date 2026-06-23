import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { RoomFootprint } from '../layout'
import { PALETTE, ANIM_RATE, WALL_THICKNESS_FT, DOOR_WIDTH_FT } from '../constants'

const DRAG_LIFT = 7

type DragRef = React.MutableRefObject<{ id: string | null; active: boolean; x: number; z: number }>

interface Props {
  target: RoomFootprint
  height: number
  highlight: boolean
  wireframe: boolean
  dragging: boolean
  interactive: boolean
  dragRef: DragRef
  onPointerDownBlock: (id: string, e: ThreeEvent<PointerEvent>) => void
}

function damp(c: number, t: number, dt: number, rate = ANIM_RATE): number {
  return THREE.MathUtils.lerp(c, t, 1 - Math.exp(-rate * dt))
}

// A walled room: poché (filled) walls of real thickness, a door opening on the
// corridor-facing wall, and a door swing arc. Walls rebuild on size change;
// position animates (so drag / re-flow stay smooth).
export default function RoomCell({
  target,
  height,
  highlight,
  wireframe,
  dragging,
  interactive,
  dragRef,
  onPointerDownBlock,
}: Props) {
  const groupRef = useRef<THREE.Group>(null)

  useLayoutEffect(() => {
    groupRef.current?.position.set(target.cx, 0, target.cz)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((_, dt) => {
    const g = groupRef.current
    if (!g) return
    const drag = dragRef.current
    const follow = dragging && drag.active
    const tx = follow ? drag.x : target.cx
    const tz = follow ? drag.z : target.cz
    const ty = follow ? DRAG_LIFT : 0
    const rate = follow ? 24 : ANIM_RATE
    g.position.x = damp(g.position.x, tx, dt, rate)
    g.position.z = damp(g.position.z, tz, dt, rate)
    g.position.y = damp(g.position.y, ty, dt, rate)
  })

  const w = Math.max(target.w, 0.4)
  const d = Math.max(target.d, 0.4)
  const H = Math.max(height, 1)
  const Tw = WALL_THICKNESS_FT
  const Dw = Math.min(DOOR_WIDTH_FT, w * 0.55)
  const doorZ = target.corridorSide === 'minZ' ? -d / 2 : d / 2
  const otherZ = -doorZ
  const into = target.corridorSide === 'minZ' ? 1 : -1
  const segLen = Math.max((w - Dw) / 2, 0.02)
  const wallColor = highlight ? PALETTE.accent : PALETTE.line

  const swing = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = []
    const hingeX = -Dw / 2
    const N = 12
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * (Math.PI / 2)
      pts.push([hingeX + Math.cos(a) * Dw, 0.07, doorZ + into * Math.sin(a) * Dw])
    }
    pts.push([hingeX, 0.07, doorZ + into * Dw]) // open leaf tip
    pts.push([hingeX, 0.07, doorZ]) // back to hinge
    return pts
  }, [Dw, doorZ, into])

  const wallMat = (
    <meshBasicMaterial
      color={wallColor}
      transparent={wireframe}
      opacity={wireframe ? 0.16 : 1}
      polygonOffset
      polygonOffsetFactor={1}
      polygonOffsetUnits={1}
    />
  )

  return (
    <group ref={groupRef}>
      {/* interior floor + pointer hit area */}
      <mesh
        position={[0, 0.03, 0]}
        onPointerDown={
          interactive
            ? (e) => {
                e.stopPropagation()
                onPointerDownBlock(target.id, e)
              }
            : undefined
        }
        onPointerOver={
          interactive
            ? () => {
                if (!dragRef.current.id) document.body.style.cursor = 'grab'
              }
            : undefined
        }
        onPointerOut={
          interactive
            ? () => {
                if (!dragRef.current.id) document.body.style.cursor = 'default'
              }
            : undefined
        }
      >
        <boxGeometry args={[Math.max(w - Tw, 0.1), 0.06, Math.max(d - Tw, 0.1)]} />
        <meshBasicMaterial
          color={highlight ? '#f7e6dd' : PALETTE.slab}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>

      {/* side walls */}
      <mesh position={[-w / 2, H / 2, 0]}>
        <boxGeometry args={[Tw, H, d]} />
        {wallMat}
      </mesh>
      <mesh position={[w / 2, H / 2, 0]}>
        <boxGeometry args={[Tw, H, d]} />
        {wallMat}
      </mesh>

      {/* solid far wall */}
      <mesh position={[0, H / 2, otherZ]}>
        <boxGeometry args={[w, H, Tw]} />
        {wallMat}
      </mesh>

      {/* corridor wall, split for the door opening */}
      <mesh position={[-(w + Dw) / 4, H / 2, doorZ]}>
        <boxGeometry args={[segLen, H, Tw]} />
        {wallMat}
      </mesh>
      <mesh position={[(w + Dw) / 4, H / 2, doorZ]}>
        <boxGeometry args={[segLen, H, Tw]} />
        {wallMat}
      </mesh>

      {/* door swing */}
      <Line points={swing} color={highlight ? PALETTE.accent : PALETTE.cyan} lineWidth={1} />
    </group>
  )
}
