import { Trash2 } from 'lucide-react'
import type { Sangria } from '../types/fechamento'
import { formatarMoeda } from '../lib/calculations'

interface Props {
  value: Sangria[]
  onChange: (value: Sangria[]) => void
}

export default function ListaValorMotivo({ value, onChange }: Props) {
  const adicionar = () => onChange([...value, { valor: 0, motivo: '' }])
  const remover = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const atualizar = (i: number, campo: keyof Sangria, v: string | number) =>
    onChange(value.map((s, idx) => (idx === i ? { ...s, [campo]: v } : s)))

  const total = value.reduce((acc, s) => acc + (s.valor || 0), 0)

  return (
    <div className="space-y-2">
      {value.map((s, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            type="number"
            step="0.01"
            placeholder="Valor"
            className="w-24 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-2 text-sm outline-none focus:border-gray-400"
            value={Number.isNaN(s.valor) ? '' : s.valor}
            onChange={(e) => atualizar(i, 'valor', e.target.value === '' ? 0 : parseFloat(e.target.value))}
          />
          <input
            type="text"
            placeholder="Motivo"
            className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-2 text-sm outline-none focus:border-gray-400"
            value={s.motivo}
            onChange={(e) => atualizar(i, 'motivo', e.target.value)}
          />
          <button
            type="button"
            onClick={() => remover(i)}
            className="shrink-0 p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500"
            aria-label="Remover"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button type="button" onClick={adicionar} className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:underline">
          + Adicionar
        </button>
        {value.length > 0 && <span className="text-sm text-gray-400 dark:text-gray-500">Total: {formatarMoeda(total)}</span>}
      </div>
    </div>
  )
}
