import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { ThreeHandles } from '../cameraApi'

interface Props {
  handlesRef: React.MutableRefObject<ThreeHandles | null>
  lockIso: boolean
  onSnapIso: () => void
  onReady: () => void
}

export default function CameraRig({ handlesRef, lockIso, onSnapIso, onReady }: Props) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera

  // Keep the shared handles current so panel buttons / PNG export can reach
  // the renderer, scene, camera and controls from outside the Canvas.
  useEffect(() => {
    handlesRef.current = { gl, scene, camera, controls: controlsRef.current }
  })

  // Frame the plan on the FIRST rendered frame (not in a mount effect): by then
  // OrbitControls is live in the render loop, so the framing sticks. Doing it in
  // a mount effect runs too early and the controls can leave the view unaimed.
  const framedRef = useRef(false)
  useFrame(() => {
    if (framedRef.current || !controlsRef.current) return
    framedRef.current = true
    handlesRef.current = { gl, scene, camera, controls: controlsRef.current }
    onReady()
  })

  // Lock / unlock orbit; snap to isometric only when the user toggles lock on.
  const mounted = useRef(false)
  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    c.enableRotate = !lockIso
    if (mounted.current && lockIso) onSnapIso()
    mounted.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockIso])

  return (
    <OrbitControls
      ref={controlsRef as unknown as React.Ref<OrbitControlsImpl>}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={4000}
    />
  )
}
