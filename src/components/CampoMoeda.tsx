import { useState } from 'react'

interface Props {
  label: string
  value: number
  onChange: (value: number) => void
  helper?: string
  disabled?: boolean
  /** Mostra o campo de soma rápida (digitar comprovante a comprovante). Padrão: true. */
  somavel?: boolean
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export default function CampoMoeda({
  label,
  value,
  onChange,
  helper,
  disabled,
  somavel = true,
}: Props) {
  const [somaRapida, setSomaRapida] = useState('')

  function adicionar() {
    const parsed = parseFloat(somaRapida.replace(',', '.'))
    if (!Number.isNaN(parsed) && parsed !== 0) {
      onChange(round2((Number.isNaN(value) ? 0 : value) + parsed))
    }
    setSomaRapida('')
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      adicionar()
    }
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="flex items-center rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-gray-900">
        <span className="pl-3 text-gray-400 text-sm">R$</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          disabled={disabled}
          className="w-full rounded-lg px-2 py-2 outline-none disabled:bg-gray-100 disabled:text-gray-400"
          value={Number.isNaN(value) ? '' : value}
          onChange={(e) => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
          onFocus={(e) => e.target.select()}
        />
      </div>

      {somavel && !disabled && (
        <div className="flex gap-1">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="Somar comprovante"
            className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-gray-900"
            value={somaRapida}
            onChange={(e) => setSomaRapida(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            onClick={adicionar}
            className="shrink-0 rounded-lg bg-gray-100 px-3 text-xs font-medium text-gray-600 hover:bg-gray-200"
          >
            + Somar
          </button>
        </div>
      )}

      {helper && <span className="text-xs text-gray-400">{helper}</span>}
    </label>
  )
}
