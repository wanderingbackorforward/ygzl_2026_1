export default function Cover() {
  const coverSrc = '/static/cover.html?embedded=1&v=20260119_2'
  return (
    <div style={{
      height: 'calc(100vh - 64px)',
      overflow: 'hidden'
    }}>
      <iframe
        title="cover"
        src={coverSrc}
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
