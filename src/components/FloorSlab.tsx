import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { PALETTE } from '../constants'
import { Pt } from '../shapes'

// The floor plate, drawn from its (possibly non-rectangular) outline polygon.
export default function FloorSlab({ slabPoly }: { slabPoly: Pt[] }) {
  const valid = Array.isArray(slabPoly) && slabPoly.length >= 3
  const geo = useMemo(() => {
    const shape = new THREE.Shape()
    if (valid) {
      shape.moveTo(slabPoly[0][0], slabPoly[0][1])
      for (let i = 1; i < slabPoly.length; i++) shape.lineTo(slabPoly[i][0], slabPoly[i][1])
      shape.closePath()
    }
    return new THREE.ShapeGeometry(shape)
  }, [slabPoly, valid])
  useEffect(() => () => geo.dispose(), [geo])

  const outline = useMemo(
    () =>
      valid
        ? [...slabPoly, slabPoly[0]].map(([x, z]) => [x, 0.02, z] as [number, number, number])
        : [],
    [slabPoly, valid]
  )

  if (!valid) return null

  return (
    <group>
      <mesh geometry={geo} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial
          color={PALETTE.slab}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <Line points={outline} color={PALETTE.line} lineWidth={1.5} />
    </group>
  )
}
