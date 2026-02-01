type GeoJSONLineString = {
  type: 'LineString'
  coordinates: number[][]
}

export type GeoJSONLineStringFeature = {
  type: 'Feature'
  geometry: GeoJSONLineString
  properties: Record<string, unknown>
}

function parseCoordinatesText(s: string): number[][] {
  const out: number[][] = []
  const parts = (s || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  for (const p of parts) {
    const xyz = p.split(',').map((x) => x.trim()).filter(Boolean)
    if (xyz.length < 2) continue
    const lon = Number(xyz[0])
    const lat = Number(xyz[1])
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
    out.push([lon, lat])
  }
  return out
}

function approxLengthM(coords: number[][]): number {
  if (coords.length < 2) return 0
  const lat0 = coords[0][1]
  const mPerDegLat = 111320
  const mPerDegLon = 111320 * Math.cos((lat0 * Math.PI) / 180)
  let total = 0
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i]
    const [lon2, lat2] = coords[i + 1]
    const dx = (lon2 - lon1) * mPerDegLon
    const dy = (lat2 - lat1) * mPerDegLat
    total += Math.hypot(dx, dy)
  }
  return total
}

function extractLineStrings(doc: Document): Array<{ name: string | null, coords: number[][] }> {
  const out: Array<{ name: string | null, coords: number[][] }> = []

  const placemarks = Array.from(doc.getElementsByTagName('Placemark'))
  if (placemarks.length) {
    for (const pm of placemarks) {
      const nameEl = pm.getElementsByTagName('name')[0]
      const name = nameEl?.textContent?.trim() || null
      const lines = Array.from(pm.getElementsByTagName('LineString'))
      for (const ls of lines) {
        const coordsEl = ls.getElementsByTagName('coordinates')[0]
        const coordsText = coordsEl?.textContent || ''
        const coords = parseCoordinatesText(coordsText)
        if (coords.length < 2) continue
        out.push({ name, coords })
      }
    }
    return out
  }

  const lines = Array.from(doc.getElementsByTagName('LineString'))
  for (const ls of lines) {
    const coordsEl = ls.getElementsByTagName('coordinates')[0]
    const coordsText = coordsEl?.textContent || ''
    const coords = parseCoordinatesText(coordsText)
    if (coords.length < 2) continue
    out.push({ name: null, coords })
  }
  return out
}

export function kmlToBestLineStringFeature(kmlText: string): GeoJSONLineStringFeature | null {
  const s = (kmlText || '').trim()
  if (!s) return null
  const doc = new DOMParser().parseFromString(s, 'application/xml')
  if (!doc || !doc.documentElement) return null
  if (doc.getElementsByTagName('parsererror').length) return null

  const items = extractLineStrings(doc)
  if (!items.length) return null

  const best = items
    .slice()
    .sort((a, b) => (b.coords.length - a.coords.length) || (approxLengthM(b.coords) - approxLengthM(a.coords)))[0]

  return {
    type: 'Feature',
    properties: best.name ? { name: best.name } : {},
    geometry: { type: 'LineString', coordinates: best.coords }
  }
}
