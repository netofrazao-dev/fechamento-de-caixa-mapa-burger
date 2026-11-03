import { Plus, Trash2 } from 'lucide-react'
import type { Sangria } from '../types/fechamento'
import { formatarMoeda } from '../lib/calculations'
import { somarValores } from '../lib/vales'
import CampoMoeda from './CampoMoeda'

interface Props {
  value: Sangria[]
  onChange: (value: Sangria[]) => void
  placeholderMotivo?: string
  textoAdicionar?: string
}

/** Lista de valor + motivo (sangrias). Valor sem motivo fica marcado em vermelho. */
export default function ListaValorMotivo({
  value,
  onChange,
  placeholderMotivo = 'Motivo (obrigatório)',
  textoAdicionar = 'Adicionar sangria',
}: Props) {
  const adicionar = () => onChange([...value, { valor: 0, motivo: '' }])
  const remover = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const atualizar = (i: number, campo: keyof Sangria, v: string | number) =>
    onChange(value.map((s, idx) => (idx === i ? { ...s, [campo]: v } : s)))

  const total = somarValores(value.map((s) => s.valor))

  return (
    <div className="space-y-2">
      {value.map((s, i) => {
        const semMotivo = s.valor > 0 && !s.motivo.trim()
        return (
          <div key={i} className="space-y-1">
            <div className="flex gap-2 items-center">
              <div className="w-32 shrink-0">
                <CampoMoeda compacto ariaLabel={`Valor da linha ${i + 1}`} value={s.valor} onChange={(v) => atualizar(i, 'valor', v)} />
              </div>
              <input
                type="text"
                maxLength={200}
                placeholder={placeholderMotivo}
                aria-label={`Motivo da linha ${i + 1}`}
                aria-invalid={semMotivo}
                className={`flex-1 min-w-0 rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-gray-500 ${
                  semMotivo ? 'border-red-400 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'
                }`}
                value={s.motivo}
                onChange={(e) => atualizar(i, 'motivo', e.target.value)}
              />
              <button
                type="button"
                onClick={() => remover(i)}
                className="shrink-0 p-2 text-gray-400 dark:text-gray-500 hover:text-red-500"
                aria-label={`Remover linha ${i + 1}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
            {semMotivo && <p className="text-[11px] text-red-600 dark:text-red-400 pl-1">Escreva o motivo.</p>}
          </div>
        )
      })}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={adicionar}
          className="flex items-center gap-1 text-sm font-medium text-gray-900 dark:text-gray-100 hover:underline"
        >
          <Plus size={15} /> {textoAdicionar}
        </button>
        {value.length > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">Total: {formatarMoeda(total)}</span>
        )}
      </div>
    </div>
  )
}
