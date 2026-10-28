import React from 'react'
import { TemperatureV2Cockpit } from '../components/temperature-v2'

/** Formal temperature page: V2 cockpit only (dashboard tab removed). */
export default function Temperature() {
  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
        <TemperatureV2Cockpit />
      </div>
    </div>
  )
}
