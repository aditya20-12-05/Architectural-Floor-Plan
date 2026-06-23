import { Line } from '@react-three/drei'
import { CorridorSeg } from '../layout'
import { PALETTE } from '../constants'

// Renders the circulation corridors: a faint floor tint plus a dashed centreline.
export default function CorridorLayer({ corridors }: { corridors: CorridorSeg[] }) {
  return (
    <group>
      {corridors.map((c, i) => {
        const halfX = c.axis === 'x' ? c.w / 2 : 0
        const halfZ = c.axis === 'z' ? c.d / 2 : 0
        const a: [number, number, number] = [c.cx - halfX, 0.05, c.cz - halfZ]
        const b: [number, number, number] = [c.cx + halfX, 0.05, c.cz + halfZ]
        return (
          <group key={i}>
            <mesh position={[c.cx, 0.02, c.cz]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[c.w, c.d]} />
              <meshBasicMaterial color={PALETTE.accent} transparent opacity={0.07} />
            </mesh>
            <Line
              points={[a, b]}
              color={PALETTE.cyan}
              lineWidth={1}
              dashed
              dashSize={2.4}
              gapSize={1.8}
            />
          </group>
        )
      })}
    </group>
  )
}
