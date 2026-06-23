import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { Entrance } from '../layout'
import { PALETTE } from '../constants'

function makeText(text: string, color: string): THREE.CanvasTexture {
  const fs = 40
  const pad = 10
  const meas = document.createElement('canvas').getContext('2d')!
  meas.font = `700 ${fs}px 'Inter', system-ui, sans-serif`
  const w = Math.ceil(meas.measureText(text).width) + pad * 2
  const h = fs + pad * 2
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color
  ctx.font = `700 ${fs}px 'Inter', system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, h / 2 + 2)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

function Label({
  text,
  position,
  color = PALETTE.line,
  size = 2.6,
}: {
  text: string
  position: [number, number, number]
  color?: string
  size?: number
}) {
  const tex = useMemo(() => makeText(text, color), [text, color])
  useEffect(() => () => tex.dispose(), [tex])
  const aspect = tex.image ? tex.image.width / tex.image.height : 4
  return (
    <sprite position={position} scale={[size * aspect, size, 1]} renderOrder={12}>
      <spriteMaterial map={tex} transparent depthWrite={false} depthTest={false} />
    </sprite>
  )
}

// Main entrance + reception at one corridor end.
export default function EntranceLayer({ entrance }: { entrance: Entrance }) {
  const ex = entrance.x
  const Wc = entrance.width
  const dir = entrance.dir // inward x direction
  const H = 3
  const Tw = 0.5
  const y = 0.07
  const Dd = Math.min(Wc * 0.7, 9)
  const r = Dd / 2
  const jambLen = (Wc - Dd) / 2
  const navy = PALETTE.line

  const swing = (hingeZ: number, toCenter: number): [number, number, number][] => {
    const pts: [number, number, number][] = []
    const N = 10
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * (Math.PI / 2)
      pts.push([ex + dir * Math.sin(a) * r, y, hingeZ + toCenter * Math.cos(a) * r])
    }
    pts.push([ex + dir * r, y, hingeZ])
    pts.push([ex, y, hingeZ])
    return pts
  }

  return (
    <group>
      {/* jamb walls closing the corridor end except the doorway */}
      <mesh position={[ex, H / 2, -(Dd / 2 + jambLen / 2)]}>
        <boxGeometry args={[Tw, H, jambLen]} />
        <meshBasicMaterial color={navy} />
      </mesh>
      <mesh position={[ex, H / 2, Dd / 2 + jambLen / 2]}>
        <boxGeometry args={[Tw, H, jambLen]} />
        <meshBasicMaterial color={navy} />
      </mesh>

      {/* double-door swings */}
      <Line points={swing(-Dd / 2, 1)} color={PALETTE.cyan} lineWidth={1} />
      <Line points={swing(Dd / 2, -1)} color={PALETTE.cyan} lineWidth={1} />

      {/* inward arrow + label (outside the doors) */}
      <Line points={[[ex - dir * 9, y, 0], [ex - dir * 2.5, y, 0]]} color={navy} lineWidth={1.4} />
      <Line
        points={[
          [ex - dir * 5, y, -2.2],
          [ex - dir * 2.5, y, 0],
          [ex - dir * 5, y, 2.2],
        ]}
        color={navy}
        lineWidth={1.4}
      />
      <Label text="ENTRANCE" position={[ex - dir * 6.5, y, -4]} size={2.4} />

      {/* reception desk just inside */}
      <mesh position={[ex + dir * 9, 0.6, Wc / 2 - 3]}>
        <boxGeometry args={[8, 1.2, 2]} />
        <meshBasicMaterial color={navy} />
      </mesh>
      <Label text="RECEPTION" position={[ex + dir * 9, 1.9, Wc / 2 - 3]} color={PALETTE.cyan} size={1.9} />
    </group>
  )
}
