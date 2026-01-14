export default function Settlement() {
  return (
    <div style={{ height: 'calc(100vh - 64px)' }}>
      <iframe
        title="settlement"
        src="/static/settlement.html?embedded=1"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  )
}
