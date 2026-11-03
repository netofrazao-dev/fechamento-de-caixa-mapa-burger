import { Plus, Trash2 } from 'lucide-react'
import type { ConsumoItem } from '../types/fechamento'
import { formatarMoeda } from '../lib/calculations'
import { somarValores } from '../lib/vales'
import CampoMoeda from './CampoMoeda'

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

  const total = somarValores(value.map((it) => it.valor))
  const campo =
    'flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm outline-none focus:border-gray-500'

  return (
    <div className="space-y-2">
      {value.map((it, i) => (
        <div key={i} className="rounded-xl bg-gray-50 dark:bg-gray-800 p-2.5 space-y-1.5">
          <div className="flex gap-1.5">
            <input
              type="text"
              maxLength={80}
              placeholder={placeholderPessoa}
              aria-label={`${placeholderPessoa} da linha ${i + 1}`}
              className={campo}
              value={it.pessoa}
              onChange={(e) => atualizar(i, 'pessoa', e.target.value)}
            />
            <input
              type="text"
              maxLength={120}
              placeholder="O que consumiu"
              aria-label={`Item da linha ${i + 1}`}
              className={campo}
              value={it.item}
              onChange={(e) => atualizar(i, 'item', e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 items-center">
            <div className="flex-1">
              <CampoMoeda compacto ariaLabel={`Valor da linha ${i + 1}`} value={it.valor} onChange={(v) => atualizar(i, 'valor', v)} />
            </div>
            <button
              type="button"
              onClick={() => remover(i)}
              className="shrink-0 p-2 text-gray-400 dark:text-gray-500 hover:text-red-500"
              aria-label={`Remover linha ${i + 1}`}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={adicionar}
          className="flex items-center gap-1 text-sm font-medium text-gray-900 dark:text-gray-100 hover:underline"
        >
          <Plus size={15} /> Adicionar
        </button>
        {value.length > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">Total: {formatarMoeda(total)}</span>
        )}
      </div>
    </div>
  )
}
