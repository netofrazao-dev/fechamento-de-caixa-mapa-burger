import { Plus, Trash2 } from 'lucide-react'
import type { ConsumoItem, Funcionario } from '../types/fechamento'
import { normalizarNome } from '../lib/vales'
import { formatarMoeda } from '../lib/calculations'
import { somarValores } from '../lib/vales'
import CampoMoeda from './CampoMoeda'

interface Props {
  value: ConsumoItem[]
  onChange: (value: ConsumoItem[]) => void
  placeholderPessoa?: string
  /** Quando informado, a pessoa é escolhida numa lista (consumo de funcionários). */
  funcionarios?: Funcionario[]
  /** Trava a lista (ex.: acerto do mês fechado). */
  travado?: boolean
}

export default function ListaConsumo({ value, onChange, placeholderPessoa = 'Pessoa', funcionarios, travado }: Props) {
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
            {funcionarios ? (
              <SeletorPessoa
                item={it}
                funcionarios={funcionarios}
                rotulo={`${placeholderPessoa} da linha ${i + 1}`}
                classe={campo}
                disabled={travado}
                onEscolher={(f) => onChange(value.map((x, idx) => (idx === i ? { ...x, pessoa: f.nome, funcionarioId: f.id } : x)))}
              />
            ) : (
              <input
                type="text"
                maxLength={80}
                placeholder={placeholderPessoa}
                aria-label={`${placeholderPessoa} da linha ${i + 1}`}
                className={campo}
                value={it.pessoa}
                onChange={(e) => atualizar(i, 'pessoa', e.target.value)}
              />
            )}
            <input
              type="text"
              maxLength={120}
              disabled={travado}
              placeholder="O que consumiu"
              aria-label={`Item da linha ${i + 1}`}
              className={campo}
              value={it.item}
              onChange={(e) => atualizar(i, 'item', e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 items-center">
            <div className="flex-1">
              <CampoMoeda compacto disabled={travado} ariaLabel={`Valor da linha ${i + 1}`} value={it.valor} onChange={(v) => atualizar(i, 'valor', v)} />
            </div>
            <button
              type="button"
              disabled={travado}
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
          disabled={travado}
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

/** Escolha do funcionário numa lista; mostra o nome antigo quando não bate com o cadastro. */
function SeletorPessoa({
  item,
  funcionarios,
  rotulo,
  classe,
  disabled,
  onEscolher,
}: {
  item: ConsumoItem
  funcionarios: Funcionario[]
  rotulo: string
  classe: string
  disabled?: boolean
  onEscolher: (f: Funcionario) => void
}) {
  const porId = item.funcionarioId ? funcionarios.find((f) => f.id === item.funcionarioId) : undefined
  const porNome = !porId && item.pessoa ? funcionarios.find((f) => normalizarNome(f.nome) === normalizarNome(item.pessoa)) : undefined
  const atual = porId ?? porNome
  const ativos = funcionarios.filter((f) => f.ativo || f.id === atual?.id)
  const nomeSolto = !atual && item.pessoa.trim() ? item.pessoa.trim() : null
  return (
    <select
      aria-label={rotulo}
      disabled={disabled}
      className={`${classe} ${nomeSolto ? 'border-amber-400 dark:border-amber-700' : ''}`}
      value={atual?.id ?? (nomeSolto ? '__solto' : '')}
      onChange={(e) => {
        const f = funcionarios.find((x) => x.id === e.target.value)
        if (f) onEscolher(f)
      }}
    >
      <option value="" disabled>
        Quem consumiu?
      </option>
      {nomeSolto && (
        <option value="__solto" disabled>
          "{nomeSolto}" (escolha da lista)
        </option>
      )}
      {ativos.map((f) => (
        <option key={f.id} value={f.id}>
          {f.nome}
        </option>
      ))}
    </select>
  )
}
