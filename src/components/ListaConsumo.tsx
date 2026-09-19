import { Trash2 } from 'lucide-react'
import type { ConsumoItem } from '../types/fechamento'
import { formatarMoeda } from '../lib/calculations'

interface Props {
  value: ConsumoItem[]
  onChange: (value: ConsumoItem[]) => void
  placeholderPessoa?: string
}

export default function ListaConsumo({ value, onChange, placeholderPessoa = 'Pessoa' }: Props) {
  const adicionar = () => onChange([...value, { pessoa: '', item: '', valor: 0 }])
  const remover = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const atualizar = (i: number, campo: keyof ConsumoItem, v: string | number) =>
    onChange(value.map((it, idx) => (idx === i ? { ...it, [campo]: v } : it)))

  const total = value.reduce((acc, it) => acc + (it.valor || 0), 0)

  return (
    <div className="space-y-2">
      {value.map((it, i) => (
        <div key={i} className="rounded-xl bg-gray-50 dark:bg-gray-800 p-2.5 space-y-1.5">
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder={placeholderPessoa}
              className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm outline-none focus:border-gray-400"
              value={it.pessoa}
              onChange={(e) => atualizar(i, 'pessoa', e.target.value)}
            />
            <input
              type="text"
              placeholder="Item"
              className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm outline-none focus:border-gray-400"
              value={it.item}
              onChange={(e) => atualizar(i, 'item', e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 items-center">
            <div className="flex items-center flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <span className="pl-2 text-gray-400 dark:text-gray-500 text-xs">R$</span>
              <input
                type="number"
                step="0.01"
                className="w-full px-2 py-1.5 text-sm outline-none"
                value={Number.isNaN(it.valor) ? '' : it.valor}
                onChange={(e) => atualizar(i, 'valor', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                onFocus={(e) => e.target.select()}
              />
            </div>
            <button
              type="button"
              onClick={() => remover(i)}
              className="shrink-0 p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500"
              aria-label="Remover"
            >
              <Trash2 size={15} />
            </button>
          </div>
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
