export default function Overview() {
  return (
    <div style={{ height: 'calc(100vh - 64px)' }}>
      <iframe
        title="overview"
        src="/static/overview.html?embedded=1"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  )
}
