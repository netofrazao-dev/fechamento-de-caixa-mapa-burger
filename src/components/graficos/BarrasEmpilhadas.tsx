import { formatarMoeda } from '../../lib/calculations'

export interface LinhaEmpilhada {
  rotulo: string
  /** Na mesma ordem das séries. */
  valores: number[]
}

interface Props {
  series: [string, string]
  linhas: LinhaEmpilhada[]
  descricao: string
}

// Duas séries (identidade): azul e laranja — par validado para daltonismo, claro e escuro.
const CORES = ['bg-[#2a78d6] dark:bg-[#3987e5]', 'bg-[#eb6834] dark:bg-[#d95926]']

/**
 * Barras horizontais empilhadas em 2 partes (ex.: vales + consumo), com
 * legenda e o total de cada linha escrito ao lado.
 */
export default function BarrasEmpilhadas({ series, linhas, descricao }: Props) {
  const totais = linhas.map((l) => l.valores.reduce((a, v) => a + v, 0))
  const maior = Math.max(...totais, 0) || 1
  return (
    <figure aria-label={descricao} className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
        {series.map((s, i) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`inline-block w-2.5 h-2.5 rounded-sm ${CORES[i]}`} /> {s}
          </span>
        ))}
      </div>
      {linhas.map((l, idx) => (
        <div
          key={l.rotulo}
          className="space-y-1"
          title={`${l.rotulo}: ${series.map((s, i) => `${s} ${formatarMoeda(l.valores[i] ?? 0)}`).join(' · ')}`}
        >
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-gray-700 dark:text-gray-300">{l.rotulo}</span>
            <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatarMoeda(totais[idx])}</span>
          </div>
          <div className="flex h-3 gap-[2px]" style={{ width: `${Math.max(2, (totais[idx] / maior) * 100)}%` }}>
            {l.valores.map((v, i) =>
              v > 0 ? (
                <div
                  key={i}
                  className={`h-full first:rounded-l-none last:rounded-r-[4px] ${CORES[i]}`}
                  style={{ flexGrow: v, flexBasis: 0 }}
                />
              ) : null,
            )}
          </div>
          <p className="text-[11px] text-gray-400 tabular-nums">
            {series.map((s, i) => `${s} ${formatarMoeda(l.valores[i] ?? 0)}`).join(' · ')}
          </p>
        </div>
      ))}
    </figure>
  )
}
