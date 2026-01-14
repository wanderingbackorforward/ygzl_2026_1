export default function SettlementVideo() {
  return (
    <div style={{ height: 'calc(100vh - 64px)' }}>
      <iframe
        title="settlement-video"
        src="/static/settlement_video.html?embedded=1"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  )
}
