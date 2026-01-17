export default function TemperatureLegacy() {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <iframe
        title="temperature"
        src="/static/temperature.html?embedded=1"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  );
}

