import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useThree, ThreeEvent } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { Walkway } from '../types'
import { PALETTE, uid, DEFAULT_WALK_W } from '../constants'

const MIN_LEN = 3
const snap = (v: number) => Math.round(v)
type Vec2 = [number, number]

// Catmull-Rom sampling through the path points (straight for two points).
function samplePath(pts: Vec2[], seg = 12): Vec2[] {
  if (pts.length <= 2) return pts.slice()
  const out: Vec2[] = []
  const n = pts.length
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2 >= n ? n - 1 : i + 2]
    for (let s = 0; s < seg; s++) {
      const t = s / seg
      const t2 = t * t
      const t3 = t2 * t
      const x =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
      const z =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      out.push([x, z])
    }
  }
  out.push(pts[n - 1])
  return out
}

// Stadium ribbon outline (rounded caps) along a sampled centreline, world (x,z).
function ribbonOutline(center: Vec2[], width: number, capSeg = 8): Vec2[] {
  const n = center.length
  if (n < 2) return []
  const hw = Math.max(width / 2, 0.1)
  const tan = (i: number): Vec2 => {
    const a = center[Math.max(0, i - 1)]
    const b = center[Math.min(n - 1, i + 1)]
    const tx = b[0] - a[0]
    const tz = b[1] - a[1]
    const L = Math.hypot(tx, tz) || 1
    return [tx / L, tz / L]
  }
  const T = center.map((_, i) => tan(i))
  const N: Vec2[] = T.map((t) => [-t[1], t[0]])
  const left: Vec2[] = center.map((c, i) => [c[0] + N[i][0] * hw, c[1] + N[i][1] * hw])
  const right: Vec2[] = center.map((c, i) => [c[0] - N[i][0] * hw, c[1] - N[i][1] * hw])
  const out: Vec2[] = []
  for (const p of left) out.push(p)
  // end cap: left -> right sweeping through +tangent
  const eC = center[n - 1]
  for (let s = 1; s < capSeg; s++) {
    const a = (Math.PI * s) / capSeg
    out.push([
      eC[0] + (Math.cos(a) * N[n - 1][0] + Math.sin(a) * T[n - 1][0]) * hw,
      eC[1] + (Math.cos(a) * N[n - 1][1] + Math.sin(a) * T[n - 1][1]) * hw,
    ])
  }
  for (let i = n - 1; i >= 0; i--) out.push(right[i])
  // start cap: right -> left sweeping through -tangent
  const sC = center[0]
  for (let s = 1; s < capSeg; s++) {
    const a = (Math.PI * s) / capSeg
    out.push([
      sC[0] + (-Math.cos(a) * N[0][0] - Math.sin(a) * T[0][0]) * hw,
      sC[1] + (-Math.cos(a) * N[0][1] - Math.sin(a) * T[0][1]) * hw,
    ])
  }
  return out
}

interface Props {
  walkways: Walkway[]
  slabW: number
  slabD: number
  active: boolean
  selectedId: string | null
  onAdd: (w: Walkway) => void
  onSelect: (id: string | null) => void
}

function WalkSeg({
  wk,
  active,
  selected,
  onSelect,
}: {
  wk: Walkway
  active: boolean
  selected: boolean
  onSelect: (id: string | null) => void
}) {
  const center = useMemo(() => samplePath(wk.points as Vec2[]), [wk.points])
  const geo = useMemo(() => {
    const outline = ribbonOutline(center, wk.width)
    const shape = new THREE.Shape()
    if (outline.length) {
      shape.moveTo(outline[0][0], outline[0][1])
      for (let i = 1; i < outline.length; i++) shape.lineTo(outline[i][0], outline[i][1])
      shape.closePath()
    }
    return new THREE.ShapeGeometry(shape)
  }, [center, wk.width])
  useEffect(() => () => geo.dispose(), [geo])
  const centerLine = useMemo(
    () => center.map(([x, z]) => [x, 0.06, z] as [number, number, number]),
    [center]
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
                onSelect(wk.id)
              }
            : undefined
        }
        onPointerOver={active ? () => (document.body.style.cursor = 'pointer') : undefined}
        onPointerOut={active ? () => (document.body.style.cursor = 'default') : undefined}
      >
        <meshBasicMaterial
          color={PALETTE.accent}
          transparent
          opacity={selected ? 0.24 : 0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      {selected ? (
        <Line points={centerLine} color={PALETTE.accent} lineWidth={2.4} />
      ) : (
        <Line points={centerLine} color={PALETTE.accent} lineWidth={1.4} dashed dashSize={2.2} gapSize={1.6} />
      )}
    </group>
  )
}

function GhostSeg({ seg }: { seg: Vec2[] }) {
  const outline = useMemo(
    () =>
      [...ribbonOutline(seg, DEFAULT_WALK_W), ribbonOutline(seg, DEFAULT_WALK_W)[0]].map(
        ([x, z]) => [x, 0.07, z] as [number, number, number]
      ),
    [seg]
  )
  return (
    <group>
      <Line points={outline} color={PALETTE.accent} lineWidth={1.6} dashed dashSize={1.6} gapSize={1.1} />
      <Line
        points={seg.map(([x, z]) => [x, 0.08, z] as [number, number, number])}
        color={PALETTE.accent}
        lineWidth={1}
      />
    </group>
  )
}

export default function WalkwayLayer({
  walkways,
  slabW,
  slabD,
  active,
  selectedId,
  onAdd,
  onSelect,
}: Props) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const drawRef = useRef({ drawing: false, sx: 0, sz: 0 })
  const [ghost, setGhost] = useState<Vec2[] | null>(null)
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const cbRef = useRef(onAdd)
  cbRef.current = onAdd

  const startDraw = (e: ThreeEvent<PointerEvent>) => {
    if (!active) return
    e.stopPropagation()
    onSelect(null) // clicking empty base deselects + begins a new draw
    drawRef.current = { drawing: true, sx: e.point.x, sz: e.point.z }
    setGhost([
      [e.point.x, e.point.z],
      [e.point.x, e.point.z],
    ])
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
        setGhost([
          [d.sx, d.sz],
          [pt.x, pt.z],
        ])
      }
    }
    const onUp = () => {
      if (!drawRef.current.drawing) return
      drawRef.current.drawing = false
      setGhost((g) => {
        if (g && Math.hypot(g[1][0] - g[0][0], g[1][1] - g[0][1]) >= MIN_LEN) {
          cbRef.current({
            id: uid(),
            points: [
              [snap(g[0][0]), snap(g[0][1])],
              [snap(g[1][0]), snap(g[1][1])],
            ],
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
        <WalkSeg
          key={wk.id}
          wk={wk}
          active={active}
          selected={selectedId === wk.id}
          onSelect={onSelect}
        />
      ))}

      {ghost && Math.hypot(ghost[1][0] - ghost[0][0], ghost[1][1] - ghost[0][1]) > 0.5 && (
        <GhostSeg seg={ghost} />
      )}

      {active && (
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={startDraw}>
          <planeGeometry args={[slabW * 1.8, slabD * 1.8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}
