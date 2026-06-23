import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
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

interface WallSeg {
  pos: [number, number]
  len: number
  angle: number
}

function damp(c: number, t: number, dt: number, rate = ANIM_RATE): number {
  return THREE.MathUtils.lerp(c, t, 1 - Math.exp(-rate * dt))
}

function buildGeometry(local: [number, number][], doorEdge: number, Tw: number) {
  const shape = new THREE.Shape()
  shape.moveTo(local[0][0], local[0][1])
  for (let i = 1; i < local.length; i++) shape.lineTo(local[i][0], local[i][1])
  shape.closePath()
  const floor = new THREE.ShapeGeometry(shape)

  const walls: WallSeg[] = []
  const doorSegs: WallSeg[] = []
  let swing: [number, number, number][] = []
  const n = local.length
  const Dw = DOOR_WIDTH_FT

  for (let i = 0; i < n; i++) {
    const a = local[i]
    const b = local[(i + 1) % n]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const len = Math.hypot(dx, dz)
    if (len < 1e-3) continue
    const angle = Math.atan2(dz, dx)
    const mx = (a[0] + b[0]) / 2
    const mz = (a[1] + b[1]) / 2

    if (i === doorEdge && len > Dw + 1.5) {
      const ux = dx / len
      const uz = dz / len
      const seg = (len - Dw) / 2
      doorSegs.push({ pos: [a[0] + ux * (seg / 2), a[1] + uz * (seg / 2)], len: seg, angle })
      doorSegs.push({ pos: [b[0] - ux * (seg / 2), b[1] - uz * (seg / 2)], len: seg, angle })
      // door swing, hinged at the near jamb, sweeping inward
      const hx = a[0] + ux * seg
      const hz = a[1] + uz * seg
      let nx = -uz
      let nz = ux
      if (-mx * nx + -mz * nz < 0) {
        nx = -nx
        nz = -nz
      }
      const N = 10
      const pts: [number, number, number][] = []
      for (let k = 0; k <= N; k++) {
        const t = (k / N) * (Math.PI / 2)
        pts.push([hx + (ux * Math.cos(t) + nx * Math.sin(t)) * Dw, 0.07, hz + (uz * Math.cos(t) + nz * Math.sin(t)) * Dw])
      }
      pts.push([hx + nx * Dw, 0.07, hz + nz * Dw])
      pts.push([hx, 0.07, hz])
      swing = pts
    } else {
      walls.push({ pos: [mx, mz], len, angle })
    }
  }
  void Tw
  return { floor, walls, doorSegs, swing }
}

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
  const H = Math.max(height, 1)
  const Tw = WALL_THICKNESS_FT
  const wallColor = highlight ? PALETTE.accent : PALETTE.line

  // Local polygon (relative to the footprint centre); stable under pure moves.
  const cx = target.cx
  const cz = target.cz
  const local = target.poly.map(([x, z]) => [x - cx, z - cz] as [number, number])
  const localKey = local.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(';') + '|' + target.doorEdge

  const geo = useMemo(() => buildGeometry(local, target.doorEdge, Tw), [localKey])
  useEffect(() => () => geo.floor.dispose(), [geo])

  useLayoutEffect(() => {
    groupRef.current?.position.set(cx, 0, cz)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((_, dt) => {
    const g = groupRef.current
    if (!g) return
    const drag = dragRef.current
    const follow = dragging && drag.active
    const tx = follow ? drag.x : cx
    const tz = follow ? drag.z : cz
    const ty = follow ? DRAG_LIFT : 0
    const rate = follow ? 24 : ANIM_RATE
    g.position.x = damp(g.position.x, tx, dt, rate)
    g.position.z = damp(g.position.z, tz, dt, rate)
    g.position.y = damp(g.position.y, ty, dt, rate)
  })

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
      <mesh
        geometry={geo.floor}
        position={[0, 0.03, 0]}
        rotation={[Math.PI / 2, 0, 0]}
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
        <meshBasicMaterial
          color={highlight ? '#f7e6dd' : PALETTE.slab}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>

      {geo.walls.map((w, i) => (
        <mesh key={`w${i}`} position={[w.pos[0], H / 2, w.pos[1]]} rotation={[0, -w.angle, 0]}>
          <boxGeometry args={[w.len, H, Tw]} />
          {wallMat}
        </mesh>
      ))}
      {geo.doorSegs.map((w, i) => (
        <mesh key={`d${i}`} position={[w.pos[0], H / 2, w.pos[1]]} rotation={[0, -w.angle, 0]}>
          <boxGeometry args={[w.len, H, Tw]} />
          {wallMat}
        </mesh>
      ))}

      {geo.swing.length > 0 && (
        <Line points={geo.swing} color={highlight ? PALETTE.accent : PALETTE.cyan} lineWidth={1} />
      )}
    </group>
  )
}
