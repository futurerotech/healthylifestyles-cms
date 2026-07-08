'use client'
import React from 'react'

/**
 * MaskedField — shows API keys as •••• in the admin UI.
 * The actual encryption/decryption happens in Payload hooks (crypto.ts).
 * This component just visualizes the masked state and handles re-entry.
 */
export const MaskedField: React.FC<{
  value?: string
  onChange?: (value: string) => void
  label?: string
}> = ({ value, onChange, label }) => {
  const isMasked = !value || value === '••••' || (value && value.startsWith('enc:'))
  const [editing, setEditing] = React.useState(false)

  if (isMasked && !editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#64748b' }}>
          ••••••••••••••••
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          style={{
            fontSize: '0.75rem',
            color: '#2563eb',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <input
      type="password"
      value={editing ? '' : value || ''}
      placeholder="Paste API key…"
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={() => setEditing(false)}
      style={{
        width: '100%',
        padding: '0.5rem 0.75rem',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        fontSize: '0.85rem',
        fontFamily: 'monospace',
      }}
    />
  )
}

export default MaskedField
