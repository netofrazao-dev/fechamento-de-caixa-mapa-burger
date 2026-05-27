'use client'

import { useState } from 'react'
import { useFormContext, useWatch, Controller } from 'react-hook-form'
import CurrencyInput from '@/components/ui/CurrencyInput'
import {
  calcularTotalCaixa,
  calcularTotalSistema,
  calcularDiferenca,
  calcularDiferencaFinal,
  calcularStatus,
  formatarBRL,
  type StatusCaixa,
} from '@/lib/utils'
import type { LCFields }     from '@/components/CardLC'
import type { BrandyFields } from '@/components/CardBrandy'

// ─── Tipo completo do formulário ──────────────────────────────
export interface ResultadoFields {
  total_lc_sistema: number
  ajuste_manual:    number
}

type FullFormFields = LCFields & BrandyFields & ResultadoFields

// ─── Configuração visual por status ──────────────────────────
const statusConfig: Record<
  StatusCaixa,
  {
    label:      string
    icon:       React.ReactNode
    container:  string
    text:       string
    badge:      string
    glow:       string
  }
> = {
  'CAIXA FECHOU': {
    label: 'Caixa fechou',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    container: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
    text:      'text-emerald-700 dark:text-emerald-400',
    badge:     'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
    glow:      'shadow-emerald-100 dark:shadow-emerald-900/30',
  },
  'SOBROU DINHEIRO': {
    label: 'Sobrou dinheiro',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
    container: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
    text:      'text-blue-700 dark:text-blue-400',
    badge:     'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300',
    glow:      'shadow-blue-100 dark:shadow-blue-900/30',
  },
  'FALTOU DINHEIRO': {
    label: 'Faltou dinheiro',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    container: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
    text:      'text-red-700 dark:text-red-400',
    badge:     'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300',
    glow:      'shadow-red-100 dark:shadow-red-900/30',
  },
}

// ─── Linha de resultado ───────────────────────────────────────
function ResultRow({
  label,
  value,
  variant = 'default',
  sublabel,
}: {
  label:    string
  value:    number
  variant?: 'default' | 'total' | 'diff' | 'final'
  sublabel?: string
}) {
  const isNeg = value < 0
  const isPos = value > 0

  const valueColor =
    variant === 'diff' || variant === 'final'
      ? isNeg
        ? 'text-red-600 dark:text-red-400'
        : isPos
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-emerald-600 dark:text-emerald-400'
      : variant === 'total'
      ? 'text-zinc-900 dark:text-zinc-100'
      : 'text-zinc-700 dark:text-zinc-300'

  const prefix = (variant === 'diff' || variant === 'final') && isPos ? '+' : ''

  return (
    <div className={`
      flex items-center justify-between py-3 px-4 rounded-lg
      ${variant === 'final'
        ? 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700'
        : variant === 'total'
        ? 'bg-zinc-50 dark:bg-zinc-800/50'
        : ''
      }
    `}>
      <div>
        <p className={`text-sm ${variant === 'final' || variant === 'total' ? 'font-medium text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'}`}>
          {label}
        </p>
        {sublabel && (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{sublabel}</p>
        )}
      </div>
      <p className={`text-sm font-semibold tabular-nums ${valueColor}`}>
        {prefix}{formatarBRL(value)}
      </p>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────
export default function CardResultado() {
  const [ajusteSign, setAjusteSign] = useState<'add' | 'remove'>('add')

  const { control, formState: { errors } } = useFormContext<FullFormFields>()

  const [
    totalLC,
    totalBrandy,
    dinheiroBrandy,
    totalLCSistema,
    ajusteManual,
  ] = useWatch({
    control,
    name: [
      'total_lc',
      'total_brandy',
      'dinheiro_brandy',
      'total_lc_sistema',
      'ajuste_manual',
    ],
  })

  // Cálculos derivados
  const totalCaixa   = calcularTotalCaixa(totalLC ?? 0, totalBrandy ?? 0)
  const totalSistema = calcularTotalSistema(totalLCSistema ?? 0, totalBrandy ?? 0, dinheiroBrandy ?? 0)
  const diferenca    = calcularDiferenca(totalCaixa, totalSistema)

  // Ajuste pode ser positivo ou negativo conforme o botão
  const ajusteEfetivo = ajusteSign === 'add' ? (ajusteManual ?? 0) : -(ajusteManual ?? 0)
  const diferencaFinal = calcularDiferencaFinal(diferenca, ajusteEfetivo)
  const status         = calcularStatus(diferencaFinal)
  const cfg            = statusConfig[status]

  return (
    <div className="
      bg-white dark:bg-zinc-900
      border border-zinc-200 dark:border-zinc-800
      rounded-2xl overflow-hidden shadow-sm
    ">

      {/* ── Header ────────────────────────────────────────── */}
      <div className="
        flex items-center gap-2.5 px-5 py-4
        border-b border-zinc-200 dark:border-zinc-800
        bg-zinc-50 dark:bg-zinc-800/50
      ">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-700">
          <svg className="w-4 h-4 text-zinc-600 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-none">
            Resultado Final
          </h2>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
            Consolidado do fechamento
          </p>
        </div>
      </div>

      <div className="p-5 space-y-2">

        {/* ── Totais ──────────────────────────────────────── */}
        <ResultRow label="Total caixa"   value={totalCaixa}   variant="total" sublabel="LC + Brandy" />
        <ResultRow label="Total sistema" value={totalSistema} variant="total" sublabel="Sistema + Dinheiro Brandy" />

        <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />

        <ResultRow label="Diferença original" value={diferenca} variant="diff" sublabel="Caixa − Sistema" />

        {/* ── Campo total LC sistema ───────────────────────── */}
        <div className="pt-1">
          <Controller
            name="total_lc_sistema"
            control={control}
            defaultValue={0}
            render={({ field }) => (
              <CurrencyInput
                label="Total LC sistema"
                value={field.value}
                onChange={field.onChange}
                error={(errors.total_lc_sistema as { message?: string } | undefined)?.message}
              />
            )}
          />
        </div>

        {/* ── Ajuste manual ────────────────────────────────── */}
        <div className="
          rounded-xl border border-zinc-200 dark:border-zinc-700
          bg-zinc-50 dark:bg-zinc-800/40 p-4 space-y-3
        ">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Ajuste manual</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                Corrige diferenças pontuais no fechamento
              </p>
            </div>

            {/* Toggle + / − */}
            <div className="flex items-center rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 text-xs font-medium">
              <button
                type="button"
                onClick={() => setAjusteSign('add')}
                className={`
                  px-3 h-8 transition-all
                  ${ajusteSign === 'add'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                  }
                `}
              >
                + Adicionar
              </button>
              <button
                type="button"
                onClick={() => setAjusteSign('remove')}
                className={`
                  px-3 h-8 transition-all border-l border-zinc-200 dark:border-zinc-700
                  ${ajusteSign === 'remove'
                    ? 'bg-red-500 text-white'
                    : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                  }
                `}
              >
                − Remover
              </button>
            </div>
          </div>

          <Controller
            name="ajuste_manual"
            control={control}
            defaultValue={0}
            render={({ field }) => (
              <CurrencyInput
                value={field.value}
                onChange={field.onChange}
                error={(errors.ajuste_manual as { message?: string } | undefined)?.message}
              />
            )}
          />

          {/* Preview do ajuste */}
          {(ajusteManual ?? 0) > 0 && (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              Efeito:&nbsp;
              <span className={ajusteSign === 'add' ? 'text-emerald-500' : 'text-red-500'}>
                {ajusteSign === 'add' ? '+' : '−'}{formatarBRL(ajusteManual ?? 0)}
                &nbsp;na diferença final
              </span>
            </p>
          )}
        </div>

        {/* ── Diferença final ──────────────────────────────── */}
        <ResultRow
          label="Diferença final"
          value={diferencaFinal}
          variant="final"
          sublabel="Diferença + Ajuste manual"
        />
      </div>

      {/* ── Status ───────────────────────────────────────── */}
      <div className={`
        mx-5 mb-5 rounded-xl border p-4
        shadow-lg
        ${cfg.container} ${cfg.glow}
        transition-all duration-300
      `}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`
              flex items-center justify-center w-9 h-9 rounded-lg
              ${cfg.badge}
              transition-all duration-300
            `}>
              <span className={cfg.text}>{cfg.icon}</span>
            </div>
            <div>
              <p className={`text-xs font-medium uppercase tracking-widest ${cfg.text} opacity-70`}>
                Status
              </p>
              <p className={`text-base font-bold ${cfg.text} leading-tight`}>
                {cfg.label}
              </p>
            </div>
          </div>

          {/* Valor destaque */}
          <div className="text-right">
            <p className={`text-xl font-bold tabular-nums ${cfg.text}`}>
              {diferencaFinal > 0 ? '+' : ''}{formatarBRL(diferencaFinal)}
            </p>
            <p className={`text-[11px] ${cfg.text} opacity-60`}>diferença final</p>
          </div>
        </div>
      </div>
    </div>
  )
}