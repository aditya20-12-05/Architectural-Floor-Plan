import { FloorConfig, Room, Category } from './types'

function room(
  id: string,
  name: string,
  area: number,
  category: Category,
  flagship = false
): Room {
  return { id, name, area, category, flagship }
}

// 20-room seed: a content / photography studio floor.
// Rooms sum to 3,600 sq ft; carpet 5,000 - walkable 1,400 = 3,600 → balanced.
export const SAMPLE_CONFIG: FloorConfig = {
  totalArea: 10000,
  carpetArea: 5000,
  walkableArea: 1400,
  wallHeight: 10,
  rooms: [
    room('r01', 'Green Screen', 300, 'Billable', true),
    room('r02', 'Photo Backdrop', 200, 'Billable'),
    room('r03', 'Private Jet Set', 200, 'Billable'),
    room('r04', 'Audio Booth', 100, 'Billable'),
    room('r05', 'Audio Booth', 100, 'Billable'),
    room('r06', 'Baby Shoot', 200, 'Billable'),
    room('r07', 'Baby Shoot', 200, 'Billable'),
    room('r08', 'Office Set', 200, 'Billable'),
    room('r09', 'Conference Set', 200, 'Billable'),
    room('r10', 'Product Photography', 50, 'Billable'),
    room('r11', 'Product Photography', 50, 'Billable'),
    room('r12', 'Dynamic Studio', 200, 'Billable'),
    room('r13', 'Dynamic Studio', 200, 'Billable'),
    room('r14', 'Education', 200, 'Billable'),
    room('r15', 'Cafeteria', 200, 'Internal'),
    room('r16', 'Pantry', 200, 'Internal'),
    room('r17', 'Dressing Room', 200, 'Internal'),
    room('r18', 'Dressing Room', 200, 'Internal'),
    room('r19', 'Team Office', 200, 'Internal'),
    room('r20', "Founder's Cabin", 200, 'Internal'),
  ],
  view: {
    labels: true,
    roomNumbers: true,
    grid: true,
    titleBlock: true,
    schedule: true,
    wireframe: false,
    lockIso: false,
  },
  title: {
    project: 'CONTENT STUDIO — L1',
    drawing: 'STUDIO FLOOR PLAN',
    scale: 'NTS',
    sheet: 'A-01',
  },
}
