import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useThree, ThreeEvent } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { Walkway } from '../types'
import { PALETTE, uid, DEFAULT_WALK_W } from '../constants'

const MIN_LEN = 3
const snap = (v: number) => Math.round(v)

interface Props {
  walkways: Walkway[]
  slabW: number
  slabD: number
  active: boolean
  onAdd: (w: Walkway) => void
  onRemove: (id: string) => void
}

interface Seg {
  x1: number
  z1: number
  x2: number
  z2: number
}

// Stadium ("capsule") outline in world XZ around the segment a->b.
function capsulePoints(s: Seg, width: number, segs = 14): [number, number][] {
  const dx = s.x2 - s.x1
  const dz = s.z2 - s.z1
  const L = Math.hypot(dx, dz) || 1
  const ux = dx / L
  const uz = dz / L
  const nx = -uz
  const nz = ux
  const hw = Math.max(width / 2, 0.1)
  const angN = Math.atan2(nz, nx)
  const pts: [number, number][] = []
  pts.push([s.x1 + nx * hw, s.z1 + nz * hw])
  pts.push([s.x2 + nx * hw, s.z2 + nz * hw])
  for (let i = 1; i < segs; i++) {
    const t = angN - Math.PI * (i / segs)
    pts.push([s.x2 + Math.cos(t) * hw, s.z2 + Math.sin(t) * hw])
  }
  pts.push([s.x2 - nx * hw, s.z2 - nz * hw])
  pts.push([s.x1 - nx * hw, s.z1 - nz * hw])
  for (let i = 1; i < segs; i++) {
    const t = angN + Math.PI - Math.PI * (i / segs)
    pts.push([s.x1 + Math.cos(t) * hw, s.z1 + Math.sin(t) * hw])
  }
  return pts
}

function WalkSeg({
  wk,
  active,
  onRemove,
}: {
  wk: Walkway
  active: boolean
  onRemove: (id: string) => void
}) {
  const pts = useMemo(() => capsulePoints(wk, wk.width), [wk])
  const geo = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1])
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [pts])
  useEffect(() => () => geo.dispose(), [geo])
  const outline = useMemo(
    () => [...pts, pts[0]].map(([x, z]) => [x, 0.05, z] as [number, number, number]),
    [pts]
  )
  return (
    <group>
      <mesh
        geometry={geo}
        position={[0, 0.04, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        onPointerDown={
          active
            ? (e) => {
                e.stopPropagation()
                onRemove(wk.id)
              }
            : undefined
        }
        onPointerOver={active ? () => (document.body.style.cursor = 'pointer') : undefined}
        onPointerOut={active ? () => (document.body.style.cursor = 'default') : undefined}
      >
        <meshBasicMaterial color={PALETTE.accent} transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>
      <Line points={outline} color={PALETTE.accent} lineWidth={1} transparent opacity={0.5} />
      {/* dashed centreline reads as a path */}
      <Line
        points={[
          [wk.x1, 0.06, wk.z1],
          [wk.x2, 0.06, wk.z2],
        ]}
        color={PALETTE.accent}
        lineWidth={1.4}
        dashed
        dashSize={2.2}
        gapSize={1.6}
      />
    </group>
  )
}

function GhostSeg({ seg }: { seg: Seg }) {
  const pts = useMemo(() => capsulePoints(seg, DEFAULT_WALK_W), [seg])
  const outline = useMemo(
    () => [...pts, pts[0]].map(([x, z]) => [x, 0.07, z] as [number, number, number]),
    [pts]
  )
  return (
    <group>
      <Line points={outline} color={PALETTE.accent} lineWidth={1.6} dashed dashSize={1.6} gapSize={1.1} />
      <Line
        points={[
          [seg.x1, 0.08, seg.z1],
          [seg.x2, 0.08, seg.z2],
        ]}
        color={PALETTE.accent}
        lineWidth={1}
      />
    </group>
  )
}

export default function WalkwayLayer({ walkways, slabW, slabD, active, onAdd, onRemove }: Props) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const drawRef = useRef({ drawing: false, sx: 0, sz: 0 })
  const [ghost, setGhost] = useState<Seg | null>(null)
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const cbRef = useRef(onAdd)
  cbRef.current = onAdd

  const startDraw = (e: ThreeEvent<PointerEvent>) => {
    if (!active) return
    e.stopPropagation()
    drawRef.current = { drawing: true, sx: e.point.x, sz: e.point.z }
    setGhost({ x1: e.point.x, z1: e.point.z, x2: e.point.x, z2: e.point.z })
  }

  useEffect(() => {
    if (!active) return
    const pt = new THREE.Vector3()
    const onMove = (e: PointerEvent) => {
      const d = drawRef.current
      if (!d.drawing) return
      const rect = gl.domElement.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera)
      if (raycaster.ray.intersectPlane(plane, pt)) {
        setGhost({ x1: d.sx, z1: d.sz, x2: pt.x, z2: pt.z })
      }
    }
    const onUp = () => {
      if (!drawRef.current.drawing) return
      drawRef.current.drawing = false
      setGhost((g) => {
        if (g && Math.hypot(g.x2 - g.x1, g.z2 - g.z1) >= MIN_LEN) {
          cbRef.current({
            id: uid(),
            x1: snap(g.x1),
            z1: snap(g.z1),
            x2: snap(g.x2),
            z2: snap(g.z2),
            width: DEFAULT_WALK_W,
          })
        }
        return null
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [active, camera, gl, raycaster, plane])

  return (
    <group>
      {walkways.map((wk) => (
        <WalkSeg key={wk.id} wk={wk} active={active} onRemove={onRemove} />
      ))}

      {ghost && Math.hypot(ghost.x2 - ghost.x1, ghost.z2 - ghost.z1) > 0.5 && <GhostSeg seg={ghost} />}

      {active && (
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={startDraw}>
          <planeGeometry args={[slabW * 1.8, slabD * 1.8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}
