import { Line } from '@react-three/drei'
import { PALETTE } from '../constants'

interface Props {
  slabW: number
  slabD: number
}

const THICK = 0.4

export default function FloorSlab({ slabW, slabD }: Props) {
  const hw = slabW / 2
  const hd = slabD / 2
  const outline: [number, number, number][] = [
    [-hw, 0.02, -hd],
    [hw, 0.02, -hd],
    [hw, 0.02, hd],
    [-hw, 0.02, hd],
    [-hw, 0.02, -hd],
  ]
  return (
    <group>
      <mesh position={[0, -THICK / 2, 0]}>
        <boxGeometry args={[slabW, THICK, slabD]} />
        <meshBasicMaterial
          color={PALETTE.slab}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <Line points={outline} color={PALETTE.line} lineWidth={1.5} />
    </group>
  )
}
