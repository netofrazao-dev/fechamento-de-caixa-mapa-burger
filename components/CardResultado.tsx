'use client'

import { useState } from 'react'
import { useFormContext, useWatch, Controller } from 'react-hook-form'
import CurrencyInput from '@/components/ui/CurrencyInput'
import {
  calcularTotalLC,
  calcularTotalBrandy,
  calcularResultados,
  brl,
  brlSinal,
  corDiferenca,
  STATUS_CONFIG,
} from '@/lib/utils'
import type { LCFields }     from '@/components/CardLC'
import type { BrandyFields } from '@/components/CardBrandy'

// ─── Tipo completo do formulário ──────────────────────────────
export interface ResultadoFields {
  total_lc_sistema: number
  ajuste_manual:    number
}

type FullFormFields = LCFields & BrandyFields & ResultadoFields

// ─── Linha de resultado ───────────────────────────────────────
function ResultRow({
  label, value, variant = 'default', sublabel,
}: {
  label:     string
  value:     number
  variant?:  'default' | 'total' | 'diff' | 'final'
  sublabel?: string
}) {
  const prefix = (variant === 'diff' || variant === 'final') && value > 0 ? '+' : ''
  const valueColor =
    variant === 'diff' || variant === 'final'
      ? corDiferenca(value)
      : variant === 'total'
      ? 'text-zinc-900 dark:text-zinc-100'
      : 'text-zinc-700 dark:text-zinc-300'

  return (
    <div className={`
      flex items-center justify-between py-3 px-4 rounded-lg
      ${variant === 'final' ? 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700' : ''}
      ${variant === 'total' ? 'bg-zinc-50 dark:bg-zinc-800/50' : ''}
    `}>
      <div>
        <p className={`text-sm ${variant === 'final' || variant === 'total' ? 'font-medium text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'}`}>
          {label}
        </p>
        {sublabel && <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{sublabel}</p>}
      </div>
      <p className={`text-sm font-semibold tabular-nums ${valueColor}`}>
        {prefix}{brl(value)}
      </p>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────
export default function CardResultado() {
  const [ajusteSign, setAjusteSign] = useState<'add' | 'remove'>('add')

  const { control, formState: { errors } } = useFormContext<FullFormFields>()

  const [
    dinFech, pix_lc, deb_lc, cred_lc, cons_lc, ap_lc, tick_lc,
    pix_b, deb_b, cred_b, credOn_b,
    dinheiroBrandy, totalLCSistema, ajusteManual,
  ] = useWatch({
    control,
    name: [
      'dinheiro_fechamento_lc', 'pix_lc', 'debito_lc', 'credito_lc',
      'consumo_loja_lc', 'a_prazo_lc', 'ticket_lc',
      'pix_brandy', 'debito_brandy', 'credito_brandy', 'credito_online_brandy',
      'dinheiro_brandy', 'total_lc_sistema', 'ajuste_manual',
    ],
  }).map(v => v ?? 0)

  const totalLC = calcularTotalLC({
    dinheiro_fechamento_lc: dinFech, pix_lc, debito_lc: deb_lc,
    credito_lc: cred_lc, consumo_loja_lc: cons_lc, a_prazo_lc: ap_lc, ticket_lc: tick_lc,
  })
  const totalBrandy = calcularTotalBrandy({
    pix_brandy: pix_b, debito_brandy: deb_b,
    credito_brandy: cred_b, credito_online_brandy: credOn_b,
  })

  const ajusteEfetivo = ajusteSign === 'add' ? ajusteManual : -ajusteManual
  const { totalCaixa, totalSistema, diferenca, diferencaFinal, status } =
    calcularResultados(totalLC, totalBrandy, totalLCSistema, dinheiroBrandy, ajusteEfetivo)

  const cfg = STATUS_CONFIG[status]

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">

      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-700">
          <svg className="w-4 h-4 text-zinc-600 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-none">Resultado Final</h2>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">Consolidado do fechamento</p>
        </div>
      </div>

      <div className="p-5 space-y-2">

        {/* Totais */}
        <ResultRow label="Total caixa"   value={totalCaixa}   variant="total" sublabel="LC + Brandy" />
        <ResultRow label="Total sistema" value={totalSistema} variant="total" sublabel="Sistema + Dinheiro Brandy" />

        <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />

        <ResultRow label="Diferença original" value={diferenca} variant="diff" sublabel="Caixa − Sistema" />

        {/* Total LC sistema */}
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

        {/* Ajuste manual */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Ajuste manual</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">Corrige diferenças pontuais</p>
            </div>
            <div className="flex items-center rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 text-xs font-medium">
              <button type="button" onClick={() => setAjusteSign('add')}
                className={`px-3 h-8 transition-all ${ajusteSign === 'add' ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}>
                + Adicionar
              </button>
              <button type="button" onClick={() => setAjusteSign('remove')}
                className={`px-3 h-8 transition-all border-l border-zinc-200 dark:border-zinc-700 ${ajusteSign === 'remove' ? 'bg-red-500 text-white' : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}>
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
          {ajusteManual > 0 && (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              Efeito:&nbsp;
              <span className={ajusteSign === 'add' ? 'text-emerald-500' : 'text-red-500'}>
                {ajusteSign === 'add' ? '+' : '−'}{brl(ajusteManual)}&nbsp;na diferença final
              </span>
            </p>
          )}
        </div>

        {/* Diferença final */}
        <ResultRow label="Diferença final" value={diferencaFinal} variant="final" sublabel="Diferença + Ajuste manual" />
      </div>

      {/* Status */}
      <div className={`mx-5 mb-5 rounded-xl border p-4 transition-all duration-300 ${cfg.card}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${cfg.icon} transition-all duration-300`}>
              <span className={cfg.text}>{
                status === 'CAIXA FECHOU'
                  ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  : status === 'SOBROU DINHEIRO'
                  ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
                  : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
              }</span>
            </div>
            <div>
              <p className={`text-xs font-medium uppercase tracking-widest ${cfg.text} opacity-70`}>Status</p>
              <p className={`text-base font-bold ${cfg.text} leading-tight`}>{cfg.label}</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-xl font-bold tabular-nums ${cfg.text}`}>{brlSinal(diferencaFinal)}</p>
            <p className={`text-[11px] ${cfg.text} opacity-60`}>diferença final</p>
          </div>
        </div>
      </div>
    </div>
  )
}