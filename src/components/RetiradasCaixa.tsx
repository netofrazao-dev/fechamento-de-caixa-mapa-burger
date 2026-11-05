import { formatarMoeda } from '../lib/calculations'
import type { RetiradasPeriodo } from '../lib/sangrias'
import BarrasHorizontais from './graficos/BarrasHorizontais'

/**
 * Quanto saiu do dinheiro do caixa no período (compras, pagamentos e vales),
 * com as compras no PIX do patrão à parte (não saem do caixa).
 */
export default function RetiradasCaixa({ retiradas, periodo }: { retiradas: RetiradasPeriodo; periodo: 'mês' | 'semana' }) {
  if (retiradas.total <= 0 && retiradas.pix <= 0) return null
  return (
    <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-3" aria-label="Retiradas do caixa">
      <div>
        <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Retiradas do caixa (sangrias)</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          O que saiu do dinheiro do caixa n{periodo === 'mês' ? 'o mês' : 'a semana'}, pelos relatórios do dia e pelos vales.
        </p>
      </div>
      {retiradas.total > 0 && (
        <BarrasHorizontais
          itens={[
            { rotulo: 'Compras ($)', valor: retiradas.compras },
            { rotulo: 'Pagamentos', valor: retiradas.pagamentos },
            { rotulo: 'Vales', valor: retiradas.vales },
          ]}
          porcentagem
          total
          rotuloTotal="Total retirado do caixa"
          descricao={`Retiradas do caixa n${periodo === 'mês' ? 'o mês' : 'a semana'} por tipo`}
        />
      )}
      {retiradas.pix > 0 && (
        <p className="flex justify-between gap-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-sm text-blue-900 dark:text-blue-200">
          <span>Compras no PIX do patrão (fora do total)</span>
          <span className="tabular-nums font-semibold">{formatarMoeda(retiradas.pix)}</span>
        </p>
      )}
    </section>
  )
}
