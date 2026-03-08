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
            className={`flex items-center gap-2 rounded px-3 py-2 text-sm transition-all ${
              isActive
                ? 'bg-white/10 text-cyan-200 ring-1 ring-cyan-500/50'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-300'
            }`}
            onClick={() => onChange(role)}
            title={config.description}
          >
            <span className="text-base leading-none">{config.icon}</span>
            <span>{config.label}</span>
          </button>
        )
      })}
    </div>
  )
}
