import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useThree, ThreeEvent } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { RoomFootprint } from '../layout'
import { Room } from '../types'
import { PALETTE, DOOR_WIDTH_FT } from '../constants'
import { Pt, normalizeShape, shapeByName } from '../shapes'

interface Props {
  room: Room
  footprint: RoomFootprint
  onSetRot: (id: string, rot: number) => void
  onSetShape: (id: string, points: Pt[]) => void
  onSetDoor: (id: string, doorEdge: number, doorT: number) => void
}

type DragMode =
  | { kind: 'rotate' }
  | { kind: 'vertex'; index: number }
  | { kind: 'door' }
  | null

const Y = 0.6

// Transform handles for the selected, placed room: rotate handle, a vertex
// handle on each corner (reshape, area kept), and a door handle that slides the
// doorway to whichever wall + position you drag it to.
export default function EditGizmo({ room, footprint, onSetRot, onSetShape, onSetDoor }: Props) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const dragRef = useRef<DragMode>(null)

  const cx = footprint.cx
  const cz = footprint.cz
  const rot = room.rot ?? 0
  const s = Math.sqrt(Math.max(room.area, 1))
  const localPts: Pt[] =
    room.shapePoints && room.shapePoints.length >= 3
      ? (room.shapePoints as Pt[])
      : shapeByName(room.shapeName).points

  const R = Math.max(footprint.maxX - footprint.minX, footprint.maxZ - footprint.minZ) / 2 + 5
  const hx = cx + Math.sin(rot) * R
  const hz = cz - Math.cos(rot) * R

  // current door position on its edge
  const n = footprint.poly.length
  const dA = footprint.poly[footprint.doorEdge % n]
  const dB = footprint.poly[(footprint.doorEdge + 1) % n]
  const doorX = dA[0] + (dB[0] - dA[0]) * footprint.doorT
  const doorZ = dA[1] + (dB[1] - dA[1]) * footprint.doorT
  const doorAngle = Math.atan2(dB[1] - dA[1], dB[0] - dA[0])

  const cbRef = useRef({ onSetRot, onSetShape, onSetDoor })
  cbRef.current = { onSetRot, onSetShape, onSetDoor }
  const stateRef = useRef({ cx, cz, rot, s, localPts, id: room.id, poly: footprint.poly })
  stateRef.current = { cx, cz, rot, s, localPts, id: room.id, poly: footprint.poly }

  useEffect(() => {
    const pt = new THREE.Vector3()
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const rect = gl.domElement.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera)
      if (!raycaster.ray.intersectPlane(plane, pt)) return
      const st = stateRef.current
      if (d.kind === 'rotate') {
        const snap = Math.PI / 12
        const ang = Math.round(Math.atan2(pt.x - st.cx, -(pt.z - st.cz)) / snap) * snap
        cbRef.current.onSetRot(st.id, ang)
      } else if (d.kind === 'door') {
        // pick the polygon edge nearest the cursor + parameter along it
        let best = 0
        let bestT = 0.5
        let bestDist = Infinity
        const poly = st.poly
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i]
          const b = poly[(i + 1) % poly.length]
          const ex = b[0] - a[0]
          const ez = b[1] - a[1]
          const len2 = ex * ex + ez * ez || 1
          let t = ((pt.x - a[0]) * ex + (pt.z - a[1]) * ez) / len2
          t = Math.min(1, Math.max(0, t))
          const dist = Math.hypot(pt.x - (a[0] + ex * t), pt.z - (a[1] + ez * t))
          if (dist < bestDist) {
            bestDist = dist
            best = i
            bestT = t
          }
        }
        cbRef.current.onSetDoor(st.id, best, bestT)
      } else {
        const c = Math.cos(-st.rot)
        const sn = Math.sin(-st.rot)
        const dx = pt.x - st.cx
        const dz = pt.z - st.cz
        const lx = (dx * c - dz * sn) / st.s
        const lz = (dx * sn + dz * c) / st.s
        const next = st.localPts.map((p, i) => (i === d.index ? ([lx, lz] as Pt) : p))
        cbRef.current.onSetShape(st.id, normalizeShape(next))
      }
    }
    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = null
        if (controls) controls.enabled = true
        document.body.style.cursor = 'default'
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [camera, gl, controls, raycaster, plane])

  const start = (m: DragMode) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    dragRef.current = m
    if (controls) controls.enabled = false
  }

  return (
    <group>
      {/* rotate handle */}
      <Line points={[[cx, Y, cz], [hx, Y, hz]]} color={PALETTE.accent} lineWidth={1} />
      <mesh position={[hx, Y, hz]} onPointerDown={start({ kind: 'rotate' })}>
        <sphereGeometry args={[2.6, 16, 16]} />
        <meshBasicMaterial color={PALETTE.accent} />
      </mesh>

      {/* door handle — drag to any wall / position */}
      <mesh
        position={[doorX, Y, doorZ]}
        rotation={[0, -doorAngle, 0]}
        onPointerDown={start({ kind: 'door' })}
        onPointerOver={() => (document.body.style.cursor = 'grab')}
        onPointerOut={() => (document.body.style.cursor = 'default')}
      >
        <boxGeometry args={[DOOR_WIDTH_FT, 1.8, 1.8]} />
        <meshBasicMaterial color={PALETTE.cyan} />
      </mesh>

      {/* vertex reshape handles */}
      {footprint.poly.map((v, i) => (
        <mesh key={i} position={[v[0], Y, v[1]]} onPointerDown={start({ kind: 'vertex', index: i })}>
          <boxGeometry args={[3, 3, 3]} />
          <meshBasicMaterial color={PALETTE.accent} />
        </mesh>
      ))}
      {footprint.poly.map((v, i) => (
        <mesh key={`o${i}`} position={[v[0], Y + 0.1, v[1]]}>
          <boxGeometry args={[3.6, 3.6, 3.6]} />
          <meshBasicMaterial color={PALETTE.white} wireframe />
        </mesh>
      ))}
    </group>
  )
}
