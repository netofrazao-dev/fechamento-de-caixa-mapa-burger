import type { Sangria } from '../types/fechamento'
import { formatarMoeda } from '../lib/calculations'

interface Props {
  value: Sangria[]
  onChange: (value: Sangria[]) => void
}

export default function SangriaForm({ value, onChange }: Props) {
  const adicionar = () => onChange([...value, { valor: 0, motivo: '' }])
  const remover = (index: number) => onChange(value.filter((_, i) => i !== index))
  const atualizar = (index: number, campo: keyof Sangria, v: string | number) =>
    onChange(value.map((s, i) => (i === index ? { ...s, [campo]: v } : s)))

  const total = value.reduce((acc, s) => acc + (s.valor || 0), 0)

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Sangrias</h2>
        <span className="text-xs text-gray-400">Informativo — não entra no Total LC</span>
      </div>

      {value.length === 0 && <p className="text-sm text-gray-400">Nenhuma sangria registrada.</p>}

      <div className="space-y-2">
        {value.map((s, i) => (
          <div key={i} className="flex gap-2 items-start">
            <input
              type="number"
              step="0.01"
              placeholder="Valor"
              className="w-28 rounded-lg border border-gray-300 px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
              value={Number.isNaN(s.valor) ? '' : s.valor}
              onChange={(e) => atualizar(i, 'valor', e.target.value === '' ? 0 : parseFloat(e.target.value))}
            />
            <input
              type="text"
              placeholder="Motivo da sangria"
              className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
              value={s.motivo}
              onChange={(e) => atualizar(i, 'motivo', e.target.value)}
            />
            <button
              type="button"
              onClick={() => remover(i)}
              className="px-2 py-2 text-gray-400 hover:text-red-500 text-sm"
              aria-label="Remover sangria"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={adicionar}
          className="text-sm font-medium text-gray-900 hover:underline"
        >
          + Adicionar sangria
        </button>
        {value.length > 0 && (
          <span className="text-sm text-gray-500">Total: {formatarMoeda(total)}</span>
        )}
      </div>
    </section>
  )
}
