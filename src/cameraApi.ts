import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

export interface ThreeHandles {
  gl: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControlsImpl | null
}

const DEFAULT_DIR = new THREE.Vector3(1, 0.82, 1.25).normalize()
const ISO_DIR = new THREE.Vector3(1, 1, 1).normalize()

export function isoDistance(slabW: number, slabD: number, height: number): number {
  return Math.max(slabW, slabD) * 1.6 + height * 2
}

export function defaultCameraPosition(
  slabW: number,
  slabD: number,
  height: number,
  iso = false
): [number, number, number] {
  const dist = isoDistance(slabW, slabD, height)
  const t = new THREE.Vector3(0, height * 0.25, 0)
  const p = t.clone().addScaledVector(iso ? ISO_DIR : DEFAULT_DIR, dist)
  return [p.x, p.y, p.z]
}

export function frameTopDown(handles: ThreeHandles, slabW: number, slabD: number): void {
  const { camera, controls } = handles
  const dist = Math.max(slabW, slabD) * 1.35 + 20
  const target = new THREE.Vector3(0, 0, 0)
  // Near-overhead with a slight tilt (avoids the gimbal at the exact pole).
  camera.position.set(0, dist, dist * 0.08)
  camera.up.set(0, 1, 0)
  camera.near = 0.1
  camera.far = dist * 6
  camera.updateProjectionMatrix()
  if (controls) {
    controls.target.copy(target)
    controls.update()
  } else {
    camera.lookAt(target)
  }
}

export function frameCamera(
  handles: ThreeHandles,
  slabW: number,
  slabD: number,
  height: number,
  iso: boolean
): void {
  const { camera, controls } = handles
  const dist = isoDistance(slabW, slabD, height)
  const target = new THREE.Vector3(0, height * 0.25, 0)
  const dir = iso ? ISO_DIR : DEFAULT_DIR
  camera.position.copy(target).addScaledVector(dir, dist)
  camera.near = 0.1
  camera.far = dist * 8
  camera.updateProjectionMatrix()
  if (controls) {
    controls.target.copy(target)
    controls.update()
  } else {
    camera.lookAt(target)
  }
}
