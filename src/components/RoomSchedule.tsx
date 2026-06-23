import { useState } from 'react'
import { Room } from '../types'
import { roomNo } from '../constants'

interface Props {
  rooms: Room[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function RoomSchedule({ rooms, selectedId, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const indexed = rooms.map((r, i) => ({ r, i }))
  const groups: [string, { r: Room; i: number }[]][] = [
    ['Billable', indexed.filter((o) => o.r.category === 'Billable')],
    ['Internal', indexed.filter((o) => o.r.category === 'Internal')],
  ]
  const total = rooms.reduce((s, r) => s + Math.max(0, r.area), 0)

  return (
    <div className={`schedule${collapsed ? ' collapsed' : ''}`}>
      <h4>
        <span>Room Schedule</span>
        <button
          className="sched-toggle"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '+' : '–'}
        </button>
      </h4>
      {!collapsed && (
        <table>
          <thead>
            <tr>
              <th className="num">No</th>
              <th>Name</th>
              <th className="num">Sq Ft</th>
            </tr>
          </thead>
          {groups.map(
            ([title, list]) =>
              list.length > 0 && (
                <tbody key={title}>
                  <tr>
                    <td colSpan={3}>
                      <div className="sched-group">{title}</div>
                    </td>
                  </tr>
                  {list.map(({ r, i }) => (
                    <tr
                      key={r.id}
                      className={`${r.flagship ? 'flagship' : ''} ${
                        selectedId === r.id ? 'selected' : ''
                      }`}
                      onClick={() => onSelect(r.id)}
                    >
                      <td className="num">{roomNo(i)}</td>
                      <td>{r.name}</td>
                      <td className="num">{Math.round(r.area)}</td>
                    </tr>
                  ))}
                </tbody>
              )
          )}
          <tfoot>
            <tr>
              <td className="num"></td>
              <td>Total</td>
              <td className="num">{Math.round(total).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}
