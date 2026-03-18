export interface MonitoringPoint {
  id: string
  name: string
  x: number
  y: number
  z: number
  value?: number
  unit?: string
  status: 'normal' | 'warning' | 'danger'
  type: 'settlement' | 'temperature'
}

export interface CalibrationAnchor {
  id: string
  position: [number, number, number]
  target: [number, number, number]
}

export interface ViewpointData {
  position: [number, number, number]
  target: [number, number, number]
}

export type ModelId =
  | 'combined'
  | '004-051'
  | '052-100'
  | '101-152'
  | '153-180'
  | '181-end'
  | '9'
  | '10'
  | '9-10Ground'
  | '9-10Suidaobody'

export interface ModelDef {
  id: ModelId
  label: string
  paths: string[]
  isCombined: boolean
  sizeWarning?: boolean
}

export const MODEL_DEFS: ModelDef[] = [
  {
    id: 'combined',
    label: '组合视图 (地面+隧道+中心线)',
    paths: ['glb/9-10Ground.glb', 'glb/9-10Suidaobody.glb', 'glb/CenterLine.glb'],
    isCombined: true,
    sizeWarning: true,
  },
  { id: '004-051', label: '隧道段 004-051m', paths: ['glb/004-051.glb'], isCombined: false, sizeWarning: true },
  { id: '052-100', label: '隧道段 052-100m', paths: ['glb/052-100.glb'], isCombined: false, sizeWarning: true },
  { id: '101-152', label: '隧道段 101-152m', paths: ['glb/101-152.glb'], isCombined: false, sizeWarning: true },
  { id: '153-180', label: '隧道段 153-180m', paths: ['glb/153-180.glb'], isCombined: false },
  { id: '181-end', label: '隧道段 181m-终点', paths: ['glb/181-end.glb'], isCombined: false, sizeWarning: true },
  { id: '9', label: '地层 9', paths: ['glb/9.glb'], isCombined: false },
  { id: '10', label: '地层 10', paths: ['glb/10.glb'], isCombined: false },
  { id: '9-10Ground', label: '地面 9-10', paths: ['glb/9-10Ground.glb'], isCombined: false, sizeWarning: true },
  { id: '9-10Suidaobody', label: '隧道体 9-10', paths: ['glb/9-10Suidaobody.glb'], isCombined: false, sizeWarning: true },
]

// S1-S4 校准锚点：监测点坐标系 → Three.js 场景坐标系
export const CALIBRATION_ANCHORS: CalibrationAnchor[] = [
  { id: 'S1', position: [-2.5, 0.5, 8.0], target: [0, 0, 0] },
  { id: 'S2', position: [-2.5, 0.5, 4.0], target: [0, 0, 0] },
  { id: 'S3', position: [-2.5, 0.5, 0.0], target: [0, 0, 0] },
  { id: 'S4', position: [-2.5, 0.5, -4.0], target: [0, 0, 0] },
]
