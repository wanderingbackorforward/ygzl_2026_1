export default function Vibration() {
  return (
    <div style={{ height: 'calc(100vh - 64px)' }}>
      <iframe
        title="vibration"
        src="/static/vibration.html?embedded=1"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  )
}
