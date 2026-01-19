export default function CoverLegacy() {
  const coverSrc = '/static/cover.html?embedded=1&v=20260119_2'
  return (
    <iframe
      title="cover"
      src={coverSrc}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        overflow: 'auto',
      }}
    />
  )
}

