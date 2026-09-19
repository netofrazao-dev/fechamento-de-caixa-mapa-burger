import { useState } from 'react'
import { Plus } from 'lucide-react'

interface Props {
  label: string
  value: number
  onChange: (value: number) => void
  helper?: string
  disabled?: boolean
  /** Mostra o botão de soma rápida (digitar comprovante a comprovante). Padrão: true. */
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
  const [somando, setSomando] = useState(false)
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
    if (e.key === 'Escape') {
      setSomando(false)
      setSomaRapida('')
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">{label}</span>
      <div className="flex items-stretch rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus-within:border-gray-400 transition-colors">
        <span className="pl-2.5 flex items-center text-gray-400 dark:text-gray-500 text-sm">R$</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          disabled={disabled}
          className="w-full min-w-0 px-2 py-2 text-sm outline-none disabled:bg-transparent disabled:text-gray-400 dark:text-gray-500"
          value={Number.isNaN(value) ? '' : value}
          onChange={(e) => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
          onFocus={(e) => e.target.select()}
        />
        {somavel && !disabled && (
          <button
            type="button"
            onClick={() => setSomando((s) => !s)}
            title="Somar comprovantes"
            className={`px-2 flex items-center border-l ${
              somando ? 'bg-gray-900 dark:bg-gray-700 text-white border-gray-900' : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300'
            }`}
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {somando && (
        <div className="flex gap-1.5 -mt-0.5">
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="Valor do comprovante"
            className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-xs outline-none focus:border-gray-400"
            value={somaRapida}
            onChange={(e) => setSomaRapida(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            onClick={adicionar}
            className="shrink-0 rounded-lg bg-gray-900 dark:bg-gray-700 px-3 text-xs font-medium text-white"
          >
            Somar
          </button>
        </div>
      )}

      {helper && <span className="text-[11px] text-gray-400 dark:text-gray-500">{helper}</span>}
    </div>
  )
}
