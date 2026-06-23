import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { PALETTE } from '../constants'

function ftIn(feet: number): string {
  let ft = Math.floor(feet)
  let inch = Math.round((feet - ft) * 12)
  if (inch === 12) {
    ft += 1
    inch = 0
  }
  return `${ft}'-${inch}"`
}

function makeDimTexture(text: string): THREE.CanvasTexture {
  const fs = 42
  const pad = 10
  const meas = document.createElement('canvas').getContext('2d')!
  meas.font = `600 ${fs}px 'JetBrains Mono', monospace`
  const w = Math.ceil(meas.measureText(text).width) + pad * 2
  const h = fs + pad * 2
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = PALETTE.line
  ctx.font = `600 ${fs}px 'JetBrains Mono', monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, h / 2 + 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function DimText({ text, position }: { text: string; position: [number, number, number] }) {
  const tex = useMemo(() => makeDimTexture(text), [text])
  useEffect(() => () => tex.dispose(), [tex])
  const aspect = tex.image ? tex.image.width / tex.image.height : 3
  const h = 3.4
  return (
    <sprite position={position} scale={[h * aspect, h, 1]} renderOrder={12}>
      <spriteMaterial map={tex} transparent depthWrite={false} depthTest={false} />
    </sprite>
  )
}

// Overall floor dimension strings on two edges (architectural read).
export default function Dimensions({ slabW, slabD }: { slabW: number; slabD: number }) {
  const y = 0.06
  const off = Math.max(7, Math.min(slabW, slabD) * 0.14)
  const tick = 1.6
  const hw = slabW / 2
  const hd = slabD / 2
  const zd = hd + off
  const xd = -hw - off
  const navy = PALETTE.line

  return (
    <group>
      {/* width dimension (front edge) */}
      <Line points={[[-hw, y, zd], [hw, y, zd]]} color={navy} lineWidth={1} />
      <Line points={[[-hw, y, zd - tick], [-hw, y, zd + tick]]} color={navy} lineWidth={1} />
      <Line points={[[hw, y, zd - tick], [hw, y, zd + tick]]} color={navy} lineWidth={1} />
      <Line points={[[-hw, y, hd], [-hw, y, zd]]} color={navy} lineWidth={0.6} />
      <Line points={[[hw, y, hd], [hw, y, zd]]} color={navy} lineWidth={0.6} />
      <DimText text={ftIn(slabW)} position={[0, y, zd]} />

      {/* depth dimension (left edge) */}
      <Line points={[[xd, y, -hd], [xd, y, hd]]} color={navy} lineWidth={1} />
      <Line points={[[xd - tick, y, -hd], [xd + tick, y, -hd]]} color={navy} lineWidth={1} />
      <Line points={[[xd - tick, y, hd], [xd + tick, y, hd]]} color={navy} lineWidth={1} />
      <Line points={[[-hw, y, -hd], [xd, y, -hd]]} color={navy} lineWidth={0.6} />
      <Line points={[[-hw, y, hd], [xd, y, hd]]} color={navy} lineWidth={0.6} />
      <DimText text={ftIn(slabD)} position={[xd, y, 0]} />
    </group>
  )
}
