import React from 'react'
import type { Role } from './types'
import { roleConfig } from './config'

interface RoleSwitcherProps {
  currentRole: Role
  onChange: (role: Role) => void
}

export default function RoleSwitcher({ currentRole, onChange }: RoleSwitcherProps) {
  const roles: Role[] = ['researcher', 'worker', 'reporter']

  return (
    <div className="flex gap-2">
      {roles.map(role => {
        const config = roleConfig[role]
        const isActive = currentRole === role

        return (
          <button
            key={role}
            type="button"
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-base font-semibold transition-all ${
              isActive
                ? 'bg-cyan-600 text-white ring-2 ring-cyan-400'
                : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
            onClick={() => onChange(role)}
            title={config.description}
          >
            <span className="text-lg leading-none">{config.icon}</span>
            <span>{config.label}</span>
          </button>
        )
      })}
    </div>
  )
}
