import { Link, useLocation } from 'react-router-dom'

export default function Nav() {
  const { pathname } = useLocation()
  const Item = ({ to, icon, text }: { to: string, icon: string, text: string }) => (
    <li style={{ display: 'inline' }}>
      <Link to={to} style={{
        color: '#40aeff',
        textDecoration: 'none',
        padding: '8px 15px',
        borderRadius: 5,
        transition: 'all .3s ease',
        background: pathname === to ? 'rgba(64,174,255,.3)' : 'rgba(64,174,255,.1)'
      }}>
        <i className={icon} /> {text}
      </Link>
    </li>
  )
  return (
    <nav style={{ textAlign: 'center', marginBottom: 10, padding: 10, background: 'rgba(10,25,47,.8)', borderBottom: '1px solid rgba(64,174,255,.3)' }}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}>
        <Item to="/cover" icon="fas fa-home" text="封面" />
        <Item to="/settlement" icon="fas fa-chart-area" text="沉降" />
        <Item to="/temperature" icon="fas fa-thermometer-half" text="温度" />
        <Item to="/cracks" icon="fas fa-bug" text="裂缝" />
        <Item to="/vibration" icon="fas fa-wave-square" text="振动" />
        <Item to="/insar" icon="fas fa-satellite" text="InSAR" />
        <Item to="/overview" icon="fas fa-chart-line" text="数据总览" />
        <Item to="/three" icon="fas fa-cubes" text="3D模型" />
        <Item to="/settlement-video" icon="fas fa-video" text="沉降视频" />
        <Item to="/tickets" icon="fas fa-ticket-alt" text="工单" />
        <Item to="/metrics" icon="fas fa-tachometer-alt" text="指标引擎" />
      </ul>
    </nav>
  )
}
