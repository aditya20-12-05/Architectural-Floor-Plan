import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { GRID_FT } from '../constants'

interface Props {
  slabW: number
  slabD: number
}

// Faint rectangular grid drawn just above the slab top (white @ 12%).
export default function FloorGrid({ slabW, slabD }: Props) {
  const geom = useMemo(() => {
    const hw = slabW / 2
    const hd = slabD / 2
    const y = 0.03
    const pts: number[] = []
    const startX = Math.ceil(-hw / GRID_FT) * GRID_FT
    for (let x = startX; x <= hw + 1e-6; x += GRID_FT) {
      pts.push(x, y, -hd, x, y, hd)
    }
    const startZ = Math.ceil(-hd / GRID_FT) * GRID_FT
    for (let z = startZ; z <= hd + 1e-6; z += GRID_FT) {
      pts.push(-hw, y, z, hw, y, z)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [slabW, slabD])

  useEffect(() => () => geom.dispose(), [geom])

  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color="#0e3a5c" transparent opacity={0.1} />
    </lineSegments>
  )
}
