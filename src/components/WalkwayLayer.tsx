import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useThree, ThreeEvent } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { Walkway } from '../types'
import { PALETTE, uid } from '../constants'

const SNAP = 1
const snap = (v: number) => Math.round(v / SNAP) * SNAP

interface Props {
  walkways: Walkway[]
  slabW: number
  slabD: number
  active: boolean
  onAdd: (w: Walkway) => void
  onRemove: (id: string) => void
}

function rectOutline(x: number, z: number, w: number, d: number): [number, number, number][] {
  const hw = w / 2
  const hd = d / 2
  return [
    [x - hw, 0.05, z - hd],
    [x + hw, 0.05, z - hd],
    [x + hw, 0.05, z + hd],
    [x - hw, 0.05, z + hd],
    [x - hw, 0.05, z - hd],
  ]
}

export default function WalkwayLayer({ walkways, slabW, slabD, active, onAdd, onRemove }: Props) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const drawRef = useRef({ drawing: false, sx: 0, sz: 0 })
  const [ghost, setGhost] = useState<{ x: number; z: number; w: number; d: number } | null>(null)
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const cbRef = useRef(onAdd)
  cbRef.current = onAdd

  const startDraw = (e: ThreeEvent<PointerEvent>) => {
    if (!active) return
    e.stopPropagation()
    drawRef.current = { drawing: true, sx: e.point.x, sz: e.point.z }
    setGhost({ x: e.point.x, z: e.point.z, w: 0, d: 0 })
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
        const cx = (d.sx + pt.x) / 2
        const cz = (d.sz + pt.z) / 2
        setGhost({ x: cx, z: cz, w: Math.abs(pt.x - d.sx), d: Math.abs(pt.z - d.sz) })
      }
    }
    const onUp = () => {
      if (!drawRef.current.drawing) return
      drawRef.current.drawing = false
      setGhost((g) => {
        if (g && g.w >= 2 && g.d >= 2) {
          cbRef.current({ id: uid(), x: snap(g.x), z: snap(g.z), w: snap(g.w), d: snap(g.d) })
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
        <group key={wk.id}>
          <mesh
            position={[wk.x, 0.03, wk.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerDown={
              active
                ? (e) => {
                    e.stopPropagation()
                    onRemove(wk.id)
                  }
                : undefined
            }
          >
            <planeGeometry args={[wk.w, wk.d]} />
            <meshBasicMaterial color={PALETTE.accent} transparent opacity={0.12} />
          </mesh>
          <Line points={rectOutline(wk.x, wk.z, wk.w, wk.d)} color={PALETTE.accent} lineWidth={1} />
        </group>
      ))}

      {ghost && (
        <group>
          <mesh position={[ghost.x, 0.04, ghost.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[Math.max(ghost.w, 0.01), Math.max(ghost.d, 0.01)]} />
            <meshBasicMaterial color={PALETTE.accent} transparent opacity={0.2} />
          </mesh>
          <Line
            points={rectOutline(ghost.x, ghost.z, ghost.w, ghost.d)}
            color={PALETTE.accent}
            lineWidth={1.6}
            dashed
            dashSize={1.5}
            gapSize={1}
          />
        </group>
      )}

      {active && (
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={startDraw}>
          <planeGeometry args={[slabW * 1.6, slabD * 1.6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}
