export default function Tickets() {
  return (
    <div style={{ height: 'calc(100vh - 64px)' }}>
      <iframe
        title="工单"
        src="/static/tickets.html"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  )
}
