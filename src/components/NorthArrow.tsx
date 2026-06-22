import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { PALETTE } from '../constants'

interface Props {
  slabW: number
  slabD: number
}

function makeNTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, 128, 128)
  ctx.fillStyle = PALETTE.line
  ctx.font = "700 96px 'Inter', system-ui, sans-serif"
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('N', 64, 70)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

// Flat north symbol on the plan (points -Z = up-the-sheet), with a billboarded "N".
export default function NorthArrow({ slabW, slabD }: Props) {
  const L = Math.max(6, Math.min(slabW, slabD) * 0.16)
  const y = 0.08
  const R = L * 0.5
  const headLen = L * 0.3
  const headW = L * 0.16

  const tex = useMemo(() => makeNTexture(), [])
  useEffect(() => () => tex.dispose(), [tex])

  const headGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const verts = new Float32Array([
      0, y, -R - headLen, // tip (north)
      -headW, y, -R, // base left
      headW, y, -R, // base right
    ])
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3))
    return g
  }, [R, headLen, headW, y])
  useEffect(() => () => headGeom.dispose(), [headGeom])

  const ring = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = []
    const rr = R * 0.5
    for (let i = 0; i <= 36; i++) {
      const a = (i / 36) * Math.PI * 2
      pts.push([Math.cos(a) * rr, y, Math.sin(a) * rr])
    }
    return pts
  }, [R, y])

  const shaft: [number, number, number][] = [
    [0, y, R],
    [0, y, -R],
  ]

  const gx = slabW * 0.06
  const gz = -slabD / 2 - L * 0.7

  return (
    <group position={[gx, 0, gz]}>
      <Line points={shaft} color={PALETTE.line} lineWidth={2.4} />
      <Line points={ring} color={PALETTE.line} lineWidth={1.2} />
      <mesh geometry={headGeom}>
        <meshBasicMaterial color={PALETTE.line} side={THREE.DoubleSide} />
      </mesh>
      <sprite position={[0, 0.1, -R - headLen - L * 0.35]} scale={[L * 0.55, L * 0.55, 1]}>
        <spriteMaterial map={tex} transparent depthTest={false} depthWrite={false} />
      </sprite>
    </group>
  )
}
