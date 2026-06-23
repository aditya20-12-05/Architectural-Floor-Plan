import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useThree, ThreeEvent } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { RoomFootprint } from '../layout'
import { Room } from '../types'
import { PALETTE } from '../constants'
import { Pt, normalizeShape, shapeByName } from '../shapes'

interface Props {
  room: Room
  footprint: RoomFootprint
  onSetRot: (id: string, rot: number) => void
  onSetShape: (id: string, points: Pt[]) => void
}

type DragMode = { kind: 'rotate' } | { kind: 'vertex'; index: number } | null

const Y = 0.6

// Transform handles for the selected, placed room: a rotate handle and a
// vertex handle on each polygon corner. Reshaping re-normalizes the polygon to
// unit area, so the room's sq ft stays constant (proportions change, not size).
export default function EditGizmo({ room, footprint, onSetRot, onSetShape }: Props) {
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

  const cbRef = useRef({ onSetRot, onSetShape })
  cbRef.current = { onSetRot, onSetShape }
  const stateRef = useRef({ cx, cz, rot, s, localPts, id: room.id })
  stateRef.current = { cx, cz, rot, s, localPts, id: room.id }

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
      <Line points={[[cx, Y, cz], [hx, Y, hz]]} color={PALETTE.accent} lineWidth={1} />
      <mesh position={[hx, Y, hz]} onPointerDown={start({ kind: 'rotate' })}>
        <sphereGeometry args={[2.6, 16, 16]} />
        <meshBasicMaterial color={PALETTE.accent} />
      </mesh>
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
