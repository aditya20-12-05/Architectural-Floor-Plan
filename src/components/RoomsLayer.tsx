import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { Layout, RoomFootprint } from '../layout'
import { Room, ViewToggles } from '../types'
import { PALETTE, ANIM_RATE, roomNo } from '../constants'
import { makeLabelTexture, LabelContent, LABEL_W, LABEL_H } from '../labelSprite'

const LABEL_OFFSET = 2.4 // world units above the roof
const DRAG_LIFT = 7 // how high a picked-up block floats

interface Props {
  layout: Layout
  rooms: Room[]
  view: ViewToggles
  wallHeight: number
  selectedId: string | null
  onSelect: (id: string) => void
  onSwap: (a: string, b: string) => void
}

interface DragState {
  id: string | null
  active: boolean
  sx: number
  sy: number
  x: number
  z: number
}

export default function RoomsLayer({
  layout,
  rooms,
  view,
  wallHeight,
  selectedId,
  onSelect,
  onSwap,
}: Props) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null

  const fpById = useMemo(() => {
    const m = new Map<string, RoomFootprint>()
    for (const f of layout.footprints) m.set(f.id, f)
    return m
  }, [layout])

  // --- block drag-to-move ---------------------------------------------------
  const dragRef = useRef<DragState>({ id: null, active: false, sx: 0, sy: 0, x: 0, z: 0 })
  const dropRef = useRef<string | null>(null)
  const fpRef = useRef(layout.footprints)
  fpRef.current = layout.footprints
  const cbRef = useRef({ onSelect, onSwap })
  cbRef.current = { onSelect, onSwap }

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropId, setDropId] = useState<string | null>(null)

  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])

  const beginDrag = useCallback(
    (id: string, e: ThreeEvent<PointerEvent>) => {
      const ne = e.nativeEvent
      dragRef.current = { id, active: false, sx: ne.clientX, sy: ne.clientY, x: 0, z: 0 }
      if (controls) controls.enabled = false
      cbRef.current.onSelect(id)
    },
    [controls]
  )

  useEffect(() => {
    const point = new THREE.Vector3()

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d.id) return
      if (!d.active) {
        if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return
        d.active = true
        setDraggingId(d.id)
      }
      const rect = gl.domElement.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera)
      if (raycaster.ray.intersectPlane(floorPlane, point)) {
        d.x = point.x
        d.z = point.z
      }
      // drop target = a different block whose footprint contains the cursor
      let target: string | null = null
      for (const f of fpRef.current) {
        if (f.id === d.id) continue
        if (Math.abs(d.x - f.cx) <= f.w / 2 && Math.abs(d.z - f.cz) <= f.d / 2) {
          target = f.id
          break
        }
      }
      if (dropRef.current !== target) {
        dropRef.current = target
        setDropId(target)
      }
      document.body.style.cursor = 'grabbing'
    }

    const onUp = () => {
      const d = dragRef.current
      if (d.id && d.active && dropRef.current && dropRef.current !== d.id) {
        cbRef.current.onSwap(d.id, dropRef.current)
      }
      dragRef.current = { id: null, active: false, sx: 0, sy: 0, x: 0, z: 0 }
      dropRef.current = null
      setDraggingId(null)
      setDropId(null)
      if (controls) controls.enabled = true
      document.body.style.cursor = 'default'
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [camera, gl, controls, raycaster, floorPlane])

  return (
    <group>
      {rooms.map((room, i) => {
        const fp = fpById.get(room.id)
        if (!fp) return null
        const isDragging = draggingId === room.id
        const isDrop = dropId === room.id
        const highlight = room.flagship || selectedId === room.id || isDragging || isDrop
        return (
          <group key={room.id}>
            <RoomBox
              target={fp}
              height={wallHeight}
              edgeColor={highlight ? PALETTE.accent : PALETTE.line}
              edgeWidth={isDragging ? 2.8 : highlight ? 2.2 : 1}
              wireframe={view.wireframe}
              dragging={isDragging}
              dragRef={dragRef}
              onPointerDownBlock={beginDrag}
            />
            {view.labels && (
              <RoomLabel
                target={fp}
                height={wallHeight}
                dragging={isDragging}
                dragRef={dragRef}
                content={{
                  number: view.roomNumbers ? roomNo(i) : undefined,
                  name: room.name,
                  area: `${Math.round(room.area)} SF`,
                  highlight,
                }}
              />
            )}
          </group>
        )
      })}
    </group>
  )
}

function damp(current: number, target: number, dt: number, rate = ANIM_RATE): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-rate * dt))
}

// 12 box edges as 24 points (unit footprint in x/z, real height in y), centred.
function buildEdges(height: number): [number, number, number][] {
  const h = height / 2
  const c: [number, number, number][] = [
    [-0.5, -h, -0.5],
    [0.5, -h, -0.5],
    [0.5, -h, 0.5],
    [-0.5, -h, 0.5],
    [-0.5, h, -0.5],
    [0.5, h, -0.5],
    [0.5, h, 0.5],
    [-0.5, h, 0.5],
  ]
  const e = (a: number, b: number): [number, number, number][] => [c[a], c[b]]
  return [
    ...e(0, 1), ...e(1, 2), ...e(2, 3), ...e(3, 0),
    ...e(4, 5), ...e(5, 6), ...e(6, 7), ...e(7, 4),
    ...e(0, 4), ...e(1, 5), ...e(2, 6), ...e(3, 7),
  ]
}

interface BoxProps {
  target: RoomFootprint
  height: number
  edgeColor: string
  edgeWidth: number
  wireframe: boolean
  dragging: boolean
  dragRef: React.MutableRefObject<DragState>
  onPointerDownBlock: (id: string, e: ThreeEvent<PointerEvent>) => void
}

function RoomBox({
  target,
  height,
  edgeColor,
  edgeWidth,
  wireframe,
  dragging,
  dragRef,
  onPointerDownBlock,
}: BoxProps) {
  const groupRef = useRef<THREE.Group>(null)
  const edges = useMemo(() => buildEdges(height), [height])

  useLayoutEffect(() => {
    const g = groupRef.current
    if (!g) return
    g.position.set(target.cx, height / 2, target.cz)
    g.scale.set(Math.max(target.w, 1e-3), 1, Math.max(target.d, 1e-3))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((_, dt) => {
    const g = groupRef.current
    if (!g) return
    const drag = dragRef.current
    const followingCursor = dragging && drag.active
    const tx = followingCursor ? drag.x : target.cx
    const tz = followingCursor ? drag.z : target.cz
    const ty = followingCursor ? height / 2 + DRAG_LIFT : height / 2
    const rate = followingCursor ? 24 : ANIM_RATE
    g.position.x = damp(g.position.x, tx, dt, rate)
    g.position.z = damp(g.position.z, tz, dt, rate)
    g.position.y = damp(g.position.y, ty, dt, rate)
    g.scale.x = damp(g.scale.x, Math.max(target.w, 1e-3), dt)
    g.scale.z = damp(g.scale.z, Math.max(target.d, 1e-3), dt)
  })

  return (
    <group ref={groupRef} renderOrder={dragging ? 20 : 0}>
      <mesh
        onPointerDown={(e) => {
          e.stopPropagation()
          onPointerDownBlock(target.id, e)
        }}
        onPointerOver={() => {
          if (!dragRef.current.id) document.body.style.cursor = 'grab'
        }}
        onPointerOut={() => {
          if (!dragRef.current.id) document.body.style.cursor = 'default'
        }}
      >
        <boxGeometry args={[1, height, 1]} />
        <meshBasicMaterial
          color={PALETTE.slab}
          transparent={wireframe}
          opacity={wireframe ? 0 : 1}
          depthWrite={!wireframe}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <Line points={edges} segments color={edgeColor} lineWidth={edgeWidth} />
    </group>
  )
}

interface LabelProps {
  target: RoomFootprint
  height: number
  dragging: boolean
  dragRef: React.MutableRefObject<DragState>
  content: LabelContent
}

function RoomLabel({ target, height, dragging, dragRef, content }: LabelProps) {
  const ref = useRef<THREE.Sprite>(null)
  const tex = useMemo(
    () => makeLabelTexture(content),
    [content.number, content.name, content.area, content.highlight]
  )
  useEffect(() => () => tex.dispose(), [tex])

  useLayoutEffect(() => {
    const s = ref.current
    if (!s) return
    s.position.set(target.cx, height + LABEL_OFFSET, target.cz)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((_, dt) => {
    const s = ref.current
    if (!s) return
    const drag = dragRef.current
    const following = dragging && drag.active
    const tx = following ? drag.x : target.cx
    const tz = following ? drag.z : target.cz
    const ty = (following ? height + DRAG_LIFT : height) + LABEL_OFFSET
    const rate = following ? 24 : ANIM_RATE
    s.position.x = damp(s.position.x, tx, dt, rate)
    s.position.z = damp(s.position.z, tz, dt, rate)
    s.position.y = damp(s.position.y, ty, dt, rate)
  })

  return (
    <sprite ref={ref} scale={[LABEL_W, LABEL_H, 1]} renderOrder={10}>
      <spriteMaterial map={tex} transparent depthWrite={false} />
    </sprite>
  )
}
