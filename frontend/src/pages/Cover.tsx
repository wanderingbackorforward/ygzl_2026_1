export default function Cover() {
  return (
    <div style={{
      height: 'calc(100vh - 64px)',
      overflow: 'hidden'
    }}>
      <iframe
        title="cover"
        src="/static/cover.html?embedded=1"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          overflow: 'auto'
        }}
      />
    </div>
  )
}
