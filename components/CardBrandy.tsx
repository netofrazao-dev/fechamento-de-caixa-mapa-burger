'use client'

import { useEffect } from 'react'
import { useFormContext, useWatch, Controller } from 'react-hook-form'
import CurrencyInput from '@/components/ui/CurrencyInput'

// ─── Tipos ────────────────────────────────────────────────────
export interface BrandyFields {
  pix_brandy:            number
  debito_brandy:         number
  credito_brandy:        number
  credito_online_brandy: number
  dinheiro_brandy:       number
  total_brandy:          number
}

// ─── Utilitário ───────────────────────────────────────────────
function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

// ─── Campos que entram no cálculo ────────────────────────────
const fields: {
  name: keyof Omit<BrandyFields, 'total_brandy' | 'dinheiro_brandy'>
  label: string
}[] = [
  { name: 'pix_brandy',            label: 'PIX'            },
  { name: 'debito_brandy',         label: 'Débito'         },
  { name: 'credito_brandy',        label: 'Crédito'        },
  { name: 'credito_online_brandy', label: 'Crédito Online' },
]

// ─── Componente ───────────────────────────────────────────────
export default function CardBrandy() {
  const { control, setValue, formState: { errors } } = useFormContext<BrandyFields>()

  const [pix, debito, credito, creditoOnline, dinheiro] = useWatch({
    control,
    name: [
      'pix_brandy',
      'debito_brandy',
      'credito_brandy',
      'credito_online_brandy',
      'dinheiro_brandy',
    ],
  })

  // Recalcula total — dinheiro NÃO entra
  useEffect(() => {
    const total =
      (pix           ?? 0) +
      (debito        ?? 0) +
      (credito       ?? 0) +
      (creditoOnline ?? 0)

    setValue('total_brandy', Number(total.toFixed(2)), { shouldDirty: false })
  }, [pix, debito, credito, creditoOnline, setValue])

  const totalBrandy =
    (pix           ?? 0) +
    (debito        ?? 0) +
    (credito       ?? 0) +
    (creditoOnline ?? 0)

  return (
    <div className="
      bg-white dark:bg-zinc-900
      border border-zinc-200 dark:border-zinc-800
      rounded-2xl overflow-hidden shadow-sm
    ">

      {/* ── Header ────────────────────────────────────────── */}
      <div className="
        flex items-center justify-between gap-3
        px-5 py-4
        border-b border-zinc-200 dark:border-zinc-800
        bg-zinc-50 dark:bg-zinc-800/50
      ">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10">
            <svg className="w-4 h-4 text-violet-500 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21a48.31 48.31 0 01-8.135-.687c-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-none">
              Caixa Brandy
            </h2>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
              Bar & Restaurante
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-0.5 uppercase tracking-wide">
            Total
          </p>
          <p className="text-base font-semibold text-violet-600 dark:text-violet-400 tabular-nums">
            {formatBRL(totalBrandy)}
          </p>
        </div>
      </div>

      {/* ── Campos ────────────────────────────────────────── */}
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
        {fields.map(({ name, label }) => (
          <Controller
            key={name}
            name={name}
            control={control}
            defaultValue={0}
            render={({ field }) => (
              <CurrencyInput
                label={label}
                value={field.value}
                onChange={field.onChange}
                error={(errors as Record<string, { message?: string }>)[name]?.message}
              />
            )}
          />
        ))}

        {/* Dinheiro — apenas exibição, col dupla */}
        <div className="sm:col-span-2">
          <Controller
            name="dinheiro_brandy"
            control={control}
            defaultValue={0}
            render={({ field }) => (
              <div className="
                rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700
                bg-zinc-50 dark:bg-zinc-800/40 p-3.5
              ">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Dinheiro
                  </label>
                  <span className="
                    inline-flex items-center gap-1 px-2 py-0.5 rounded-md
                    text-[10px] font-medium uppercase tracking-wide
                    bg-amber-100 text-amber-700
                    dark:bg-amber-500/10 dark:text-amber-400
                  ">
                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    Não entra no total
                  </span>
                </div>
                <CurrencyInput
                  value={field.value}
                  onChange={field.onChange}
                  error={(errors.dinheiro_brandy as { message?: string } | undefined)?.message}
                />
              </div>
            )}
          />
        </div>
      </div>

      {/* ── Rodapé ────────────────────────────────────────── */}
      <div className="
        px-5 py-4
        border-t border-zinc-200 dark:border-zinc-800
        bg-violet-50 dark:bg-violet-500/5
        flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3
      ">
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          Dinheiro registrado:&nbsp;
          <span className="font-medium text-amber-600 dark:text-amber-400 tabular-nums">
            {formatBRL(dinheiro ?? 0)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Total Brandy</span>
          <span className="text-lg font-bold tabular-nums text-violet-700 dark:text-violet-400">
            {formatBRL(totalBrandy)}
          </span>
        </div>
      </div>
    </div>
  )
}