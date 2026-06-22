import { TitleBlockInfo } from '../types'

interface Props {
  title: TitleBlockInfo
}

export default function TitleBlock({ title }: Props) {
  return (
    <div className="title-block">
      <div className="tb-title">{title.project}</div>
      <div className="tb-row">
        <div className="tb-key">Drawing</div>
        <div className="tb-val">{title.drawing}</div>
      </div>
      <div className="tb-row">
        <div className="tb-key">Scale</div>
        <div className="tb-val">{title.scale}</div>
      </div>
      <div className="tb-row">
        <div className="tb-key">Sheet</div>
        <div className="tb-val">{title.sheet}</div>
      </div>
    </div>
  )
}
