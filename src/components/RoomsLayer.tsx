import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import { Layout, RoomFootprint } from '../layout'
import { Room, ViewToggles } from '../types'
import { ANIM_RATE, roomNo } from '../constants'
import { makeLabelTexture, LabelContent, LABEL_W, LABEL_H } from '../labelSprite'
import RoomCell from './RoomCell'

const LABEL_OFFSET = 2.4
const DRAG_LIFT = 7

interface Props {
  layout: Layout
  rooms: Room[]
  view: ViewToggles
  wallHeight: number
  selectedId: string | null
  roomDragEnabled: boolean
  onSelect: (id: string) => void
  onPlace: (id: string, px: number, pz: number) => void
}

const SNAP = 1 // ft

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
  roomDragEnabled,
  onSelect,
  onPlace,
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
  const fpRef = useRef(layout.footprints)
  fpRef.current = layout.footprints
  const cbRef = useRef({ onSelect, onPlace })
  cbRef.current = { onSelect, onPlace }

  const [draggingId, setDraggingId] = useState<string | null>(null)

  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])

  // Low "plan" wall height so the layout stays readable from the iso view.
  const renderWallH = Math.max(2, Math.min(wallHeight * 0.3, 4.5))

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
      const drag = dragRef.current
      if (!drag.id) return
      if (!drag.active) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) return
        drag.active = true
        setDraggingId(drag.id)
      }
      const rect = gl.domElement.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera)
      if (raycaster.ray.intersectPlane(floorPlane, point)) {
        drag.x = point.x
        drag.z = point.z
      }
      document.body.style.cursor = 'grabbing'
    }

    const onUp = () => {
      const drag = dragRef.current
      if (drag.id && drag.active) {
        const px = Math.round(drag.x / SNAP) * SNAP
        const pz = Math.round(drag.z / SNAP) * SNAP
        cbRef.current.onPlace(drag.id, px, pz)
      }
      dragRef.current = { id: null, active: false, sx: 0, sy: 0, x: 0, z: 0 }
      setDraggingId(null)
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
        const highlight = room.flagship || selectedId === room.id || isDragging
        return (
          <group key={room.id}>
            <RoomCell
              target={fp}
              height={renderWallH}
              highlight={highlight}
              wireframe={view.wireframe}
              dragging={isDragging}
              interactive={roomDragEnabled}
              dragRef={dragRef}
              onPointerDownBlock={beginDrag}
            />
            {view.labels && (
              <RoomLabel
                target={fp}
                height={renderWallH}
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
