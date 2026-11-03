import { useId, useState } from 'react'
import { formatarMoeda } from '../../lib/calculations'

export interface DiaSobraFalta {
  data: string
  /** null = sem fechamento */
  diferenca: number | null
}

const L = 360
const A = 150
const M = { topo: 10, dir: 8, base: 20, esq: 34 }
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function rotuloValor(v: number): string {
  const a = Math.abs(v)
  return `${v < 0 ? '-' : v > 0 ? '+' : ''}${a >= 1000 ? `${(a / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : Math.round(a)}`
}

/**
 * Sobra (azul, para cima) e falta (vermelho, para baixo) de cada dia,
 * a partir da linha do zero. Dia que fechou certinho fica marcado no zero.
 */
export default function GraficoSobraFalta({ dias }: { dias: DiaSobraFalta[] }) {
  const id = useId()
  const [ativo, setAtivo] = useState<number | null>(null)
  const maior = Math.max(...dias.map((d) => Math.abs(d.diferenca ?? 0)), 1)
  const larg = L - M.esq - M.dir
  const alt = A - M.topo - M.base
  const slot = larg / Math.max(dias.length, 1)
  const barra = Math.min(24, Math.max(3, slot - 2))
  const meio = M.topo + alt / 2
  const y = (v: number) => meio - (v / maior) * (alt / 2)
  const poucos = dias.length <= 7
  const d = ativo !== null ? dias[ativo] : null

  return (
    <figure className="relative" aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className="sr-only">
        Sobra e falta de dinheiro em cada dia: colunas para cima são sobra, para baixo são falta.
      </figcaption>
      <svg viewBox={`0 0 ${L} ${A}`} className="w-full h-auto select-none">
        {[maior, 0, -maior].map((v) => (
          <g key={v}>
            <line x1={M.esq} x2={L - M.dir} y1={y(v)} y2={y(v)} className="stroke-gray-200 dark:stroke-gray-800" strokeWidth={v === 0 ? 1 : 0.6} />
            <text x={M.esq - 4} y={y(v) + 3} textAnchor="end" fontSize={8} className="fill-gray-400 dark:fill-gray-500">
              {v === 0 ? '0' : rotuloValor(v)}
            </text>
          </g>
        ))}
        {dias.map((dia, i) => {
          const x = M.esq + slot * i + (slot - barra) / 2
          const v = dia.diferenca
          const n = Number(dia.data.slice(8, 10))
          const rotulo = poucos ? `${DIAS_CURTOS[new Date(`${dia.data}T12:00:00`).getDay()]} ${n}` : n === 1 || n % 5 === 0 ? String(n) : ''
          let marca = null
          if (v !== null && Math.abs(v) >= 0.005) {
            const h = Math.max(1.5, Math.abs(y(v) - meio))
            const r = Math.min(2, barra / 2, h)
            const cima = v > 0
            const topo = cima ? meio - h : meio + h
            const caminho = cima
              ? `M${x},${meio} V${topo + r} Q${x},${topo} ${x + r},${topo} H${x + barra - r} Q${x + barra},${topo} ${x + barra},${topo + r} V${meio} Z`
              : `M${x},${meio} V${topo - r} Q${x},${topo} ${x + r},${topo} H${x + barra - r} Q${x + barra},${topo} ${x + barra},${topo - r} V${meio} Z`
            marca = (
              <path
                d={caminho}
                className={cima ? 'fill-[#2a78d6] dark:fill-[#3987e5]' : 'fill-[#e34948] dark:fill-[#e66767]'}
                opacity={ativo === null || ativo === i ? 1 : 0.55}
              />
            )
          } else if (v !== null) {
            marca = <circle cx={x + barra / 2} cy={meio} r={2} className="fill-green-600 dark:fill-green-500" />
          }
          return (
            <g key={dia.data}>
              {marca}
              {rotulo && (
                <text x={M.esq + slot * i + slot / 2} y={A - 6} textAnchor="middle" fontSize={8} className="fill-gray-400 dark:fill-gray-500">
                  {rotulo}
                </text>
              )}
              <rect
                x={M.esq + slot * i}
                y={M.topo}
                width={slot}
                height={alt}
                fill="transparent"
                onMouseEnter={() => setAtivo(i)}
                onMouseLeave={() => setAtivo((a) => (a === i ? null : a))}
                onClick={() => setAtivo(i)}
              >
                <title>{`${dia.data.slice(8, 10)}/${dia.data.slice(5, 7)}: ${v === null ? 'sem fechamento' : formatarMoeda(v)}`}</title>
              </rect>
            </g>
          )
        })}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400 mt-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#2a78d6] dark:bg-[#3987e5]" /> Sobrou
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#e34948] dark:bg-[#e66767]" /> Faltou
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-green-600 dark:bg-green-500" /> Fechou certinho
        </span>
      </div>
      {d && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-gray-900 dark:bg-gray-100 px-2.5 py-1.5 text-[11px] leading-tight text-white dark:text-gray-900 shadow-lg whitespace-nowrap"
          style={{ left: `${Math.min(85, Math.max(15, ((M.esq + slot * (ativo ?? 0) + slot / 2) / L) * 100))}%` }}
        >
          <p className="font-semibold">
            {d.data.slice(8, 10)}/{d.data.slice(5, 7)} {DIAS_CURTOS[new Date(`${d.data}T12:00:00`).getDay()]}
          </p>
          <p className="tabular-nums">
            {d.diferenca === null
              ? 'Sem fechamento'
              : Math.abs(d.diferenca) < 0.005
                ? 'Fechou certinho'
                : `${d.diferenca > 0 ? 'Sobrou' : 'Faltou'} ${formatarMoeda(Math.abs(d.diferenca))}`}
          </p>
        </div>
      )}
    </figure>
  )
}
