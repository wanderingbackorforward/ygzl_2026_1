export default function Temperature() {
  return (
    <div style={{ height: 'calc(100vh - 64px)' }}>
      <iframe
        title="temperature"
        src="/static/temperature.html?embedded=1"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  )
}
