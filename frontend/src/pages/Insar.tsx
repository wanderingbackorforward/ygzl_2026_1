export default function Insar() {
  return (
    <div style={{ padding: 16, color: '#aaddff' }}>
      <h2 style={{ marginBottom: 10 }}><i className="fas fa-satellite" /> InSAR监测系统</h2>
      <a href="http://47.96.7.238:38089/mapLayer" target="_blank" rel="noreferrer" style={{
        display: 'inline-block',
        marginBottom: 12,
        color: '#40aeff',
        border: '1px solid rgba(64,174,255,.6)',
        borderRadius: 6,
        padding: '6px 12px',
        background: 'rgba(64,174,255,.1)',
        textDecoration: 'none'
      }}>
        <i className="fas fa-external-link-alt" /> 在新窗口打开 InSAR 监测地图
      </a>
      <div style={{
        position: 'relative',
        width: '100%',
        height: '70vh',
        border: '1px solid rgba(64,174,255,.3)',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 0 12px rgba(64,174,255,.15) inset',
        background: 'rgba(10,25,47,.6)'
      }}>
        <iframe
          title="insar-map"
          src="http://47.96.7.238:38089/mapLayer"
          allowFullScreen
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </div>
    </div>
  )
}
