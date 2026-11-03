import { formatarMoeda } from '../../lib/calculations'

export interface ItemBarra {
  rotulo: string
  valor: number
  /** Texto pequeno ao lado do rótulo (ex.: "3 vales"). */
  detalhe?: string
}

interface Props {
  itens: ItemBarra[]
  /** 'moeda' (padrão) ou 'numero'. */
  formato?: 'moeda' | 'numero'
  /** Mostra a % de cada item sobre o total. */
  porcentagem?: boolean
  /** Linha de total no fim. */
  total?: boolean
  rotuloTotal?: string
  descricao: string
}

const fmt = (v: number, f: 'moeda' | 'numero') => (f === 'moeda' ? formatarMoeda(v) : v.toLocaleString('pt-BR'))

function pct(parte: number, total: number): string {
  const p = (parte / (total || 1)) * 100
  return parte > 0 && p < 0.5 ? '<1%' : `${Math.round(p)}%`
}

/**
 * Barras horizontais de uma cor só (magnitude), maior primeiro.
 * Valores e rótulos em texto normal; a barra só mostra o tamanho.
 */
export default function BarrasHorizontais({ itens, formato = 'moeda', porcentagem, total, rotuloTotal = 'Total', descricao }: Props) {
  const lista = itens.filter((i) => i.valor > 0)
  const maior = Math.max(...lista.map((i) => i.valor), 0) || 1
  const soma = lista.reduce((a, i) => a + Math.round(i.valor * 100), 0) / 100
  if (lista.length === 0) return <p className="text-sm text-gray-400">Sem dados no período.</p>
  return (
    <figure aria-label={descricao} className="space-y-2.5">
      {lista.map((i) => (
        <div key={i.rotulo} className="space-y-1" title={`${i.rotulo}: ${fmt(i.valor, formato)}`}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-gray-700 dark:text-gray-300">
              {i.rotulo}
              {i.detalhe && <span className="text-xs text-gray-400"> · {i.detalhe}</span>}
            </span>
            <span className="shrink-0 tabular-nums">
              <span className="font-semibold text-gray-900 dark:text-gray-100">{fmt(i.valor, formato)}</span>
              {porcentagem && <span className="ml-1.5 text-xs text-gray-400">{pct(i.valor, soma)}</span>}
            </span>
          </div>
          <div className="h-2.5 rounded-r bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-r-[4px] bg-[#eb6834] dark:bg-[#d95926]"
              style={{ width: `${Math.max(1.5, (i.valor / maior) * 100)}%` }}
            />
          </div>
        </div>
      ))}
      {total && (
        <div className="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <span>{rotuloTotal}</span>
          <span className="tabular-nums">{fmt(soma, formato)}</span>
        </div>
      )}
    </figure>
  )
}
