import { useId, useMemo, useState } from 'react'
import { formatarMoeda } from '../lib/calculations'
import type { StatusFechamento } from '../types/fechamento'

export interface DiaGrafico {
  data: string // YYYY-MM-DD
  vendas: number | null // null = sem fechamento
  diferenca?: number
  status?: StatusFechamento
}

interface Props {
  dias: DiaGrafico[]
  mediaAtual: number
  mediaAnterior?: number | null
  rotuloAnterior?: string
}

const L = 360 // largura do desenho (viewBox)
const A = 190 // altura do desenho
const M = { topo: 14, dir: 8, base: 22, esq: 34 }

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const RESULTADO: Record<StatusFechamento, string> = { fechou: 'Fechou certinho', sobrou: 'Sobrou', faltou: 'Faltou' }

function milhar(v: number): string {
  if (v >= 1000) return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return String(Math.round(v))
}

/** Escala "bonita" pro eixo: 0, passo, 2·passo… acima do máximo. */
function escala(maximo: number): { topo: number; passo: number } {
  if (maximo <= 0) return { topo: 1000, passo: 500 }
  const bruto = maximo / 3
  const mag = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) ?? 10 * mag
  return { topo: Math.ceil(maximo / passo) * passo, passo }
}

/**
 * Colunas: vendas de cada dia do mês (uma cor só), com linhas de média
 * deste mês e do mês anterior. Toque/passe o mouse numa coluna pra ver o valor.
 */
export default function GraficoVendasDia({ dias, mediaAtual, mediaAnterior, rotuloAnterior = 'mês anterior' }: Props) {
  const id = useId()
  const [ativo, setAtivo] = useState<number | null>(null)

  const { topo, passo } = useMemo(
    () => escala(Math.max(...dias.map((d) => d.vendas ?? 0), mediaAtual, mediaAnterior ?? 0)),
    [dias, mediaAtual, mediaAnterior],
  )
  const largPlot = L - M.esq - M.dir
  const altPlot = A - M.topo - M.base
  const slot = largPlot / Math.max(dias.length, 1)
  const larguraBarra = Math.max(3, slot - 2) // 2px de espaço entre colunas
  const y = (v: number) => M.topo + altPlot - (v / topo) * altPlot
  const linhasGrade = Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo)
  const diaAtivo = ativo !== null ? dias[ativo] : null

  // Posição do balão (em %), pra não sair da tela
  const xAtivoPct = ativo !== null ? ((M.esq + slot * ativo + slot / 2) / L) * 100 : 0

  return (
    <figure className="relative" aria-labelledby={`${id}-titulo`}>
      <figcaption id={`${id}-titulo`} className="sr-only">
        Vendas por dia no mês, com a média do mês{mediaAnterior ? ` e a média do ${rotuloAnterior}` : ''}.
      </figcaption>
      <svg viewBox={`0 0 ${L} ${A}`} className="w-full h-auto select-none" role="img" aria-hidden="false">
        {/* grade e eixo */}
        {linhasGrade.map((v) => (
          <g key={v}>
            <line x1={M.esq} x2={L - M.dir} y1={y(v)} y2={y(v)} className="stroke-gray-200 dark:stroke-gray-800" strokeWidth={v === 0 ? 1 : 0.6} />
            <text x={M.esq - 4} y={y(v) + 3} textAnchor="end" className="fill-gray-400 dark:fill-gray-500" fontSize={8}>
              {milhar(v)}
            </text>
          </g>
        ))}

        {/* colunas */}
        {dias.map((d, i) => {
          const x = M.esq + slot * i + (slot - larguraBarra) / 2
          const dia = Number(d.data.slice(8, 10))
          const mostrarRotulo = dia === 1 || dia % 5 === 0
          return (
            <g key={d.data}>
              {d.vendas !== null && d.vendas > 0 && (
                <path
                  d={(() => {
                    const h = Math.max(1, y(0) - y(d.vendas))
                    const r = Math.min(2, larguraBarra / 2, h)
                    const yt = y(0) - h
                    return `M${x},${y(0)} V${yt + r} Q${x},${yt} ${x + r},${yt} H${x + larguraBarra - r} Q${x + larguraBarra},${yt} ${x + larguraBarra},${yt + r} V${y(0)} Z`
                  })()}
                  className={ativo === i ? 'fill-[#b9481d] dark:fill-[#f08a5d]' : 'fill-[#eb6834] dark:fill-[#d95926]'}
                />
              )}
              {d.vendas === null && (
                <line x1={x + larguraBarra / 2} x2={x + larguraBarra / 2} y1={y(0) - 3} y2={y(0)} className="stroke-gray-300 dark:stroke-gray-700" strokeWidth={1} />
              )}
              {mostrarRotulo && (
                <text x={M.esq + slot * i + slot / 2} y={A - 8} textAnchor="middle" className="fill-gray-400 dark:fill-gray-500" fontSize={8}>
                  {dia}
                </text>
              )}
              {/* área de toque maior que a coluna */}
              <rect
                x={M.esq + slot * i}
                y={M.topo}
                width={slot}
                height={altPlot}
                fill="transparent"
                onMouseEnter={() => setAtivo(i)}
                onMouseLeave={() => setAtivo((a) => (a === i ? null : a))}
                // No celular o toque dispara "passar por cima" e "clique" juntos:
                // o clique só confirma a coluna (não alterna), senão o balão sumiria.
                onClick={() => setAtivo(i)}
              >
                <title>
                  {`${d.data.slice(8, 10)}/${d.data.slice(5, 7)}: ${d.vendas === null ? 'sem fechamento' : formatarMoeda(d.vendas)}`}
                </title>
              </rect>
            </g>
          )
        })}

        {/* linhas de média (rotuladas direto no gráfico) */}
        {mediaAnterior ? (
          <g>
            <line x1={M.esq} x2={L - M.dir} y1={y(mediaAnterior)} y2={y(mediaAnterior)} className="stroke-gray-400 dark:stroke-gray-500" strokeWidth={1} strokeDasharray="1.5 2.5" />
          </g>
        ) : null}
        {mediaAtual > 0 && (
          <line x1={M.esq} x2={L - M.dir} y1={y(mediaAtual)} y2={y(mediaAtual)} className="stroke-gray-800 dark:stroke-gray-200" strokeWidth={1.2} strokeDasharray="5 3" />
        )}
      </svg>

      {/* legenda das linhas */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400 mt-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#eb6834] dark:bg-[#d95926]" /> Vendas do dia
        </span>
        {mediaAtual > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-[1.5px] border-dashed border-gray-800 dark:border-gray-200" /> Média do mês {formatarMoeda(mediaAtual)}
          </span>
        )}
        {mediaAnterior ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-[1.5px] border-dotted border-gray-400" /> Média {rotuloAnterior} {formatarMoeda(mediaAnterior)}
          </span>
        ) : null}
      </div>

      {/* balão do dia tocado */}
      {diaAtivo && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-gray-900 dark:bg-gray-100 px-2.5 py-1.5 text-[11px] leading-tight text-white dark:text-gray-900 shadow-lg whitespace-nowrap"
          style={{ left: `${Math.min(85, Math.max(15, xAtivoPct))}%` }}
        >
          <p className="font-semibold">
            {diaAtivo.data.slice(8, 10)}/{diaAtivo.data.slice(5, 7)} {DIAS_CURTOS[new Date(`${diaAtivo.data}T12:00:00`).getDay()]}
          </p>
          {diaAtivo.vendas === null ? (
            <p>Sem fechamento</p>
          ) : (
            <>
              <p className="tabular-nums">Vendas {formatarMoeda(diaAtivo.vendas)}</p>
              {diaAtivo.status && (
                <p>
                  {RESULTADO[diaAtivo.status]}
                  {diaAtivo.status !== 'fechou' && diaAtivo.diferenca !== undefined && ` ${formatarMoeda(Math.abs(diaAtivo.diferenca))}`}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </figure>
  )
}
