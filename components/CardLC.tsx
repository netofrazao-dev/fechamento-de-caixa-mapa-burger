'use client'

import { useEffect } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import CurrencyInput from '@/components/ui/CurrencyInput'

// ─── Tipos ────────────────────────────────────────────────────
export interface LCFields {
  dinheiro_lc: number
  pix_lc: number
  debito_lc: number
  credito_lc: number
  consumo_loja_lc: number
  a_prazo_lc: number
  tickets_lc: number
  sangria_lc: number
  total_lc: number
}

// ─── Utilitário ───────────────────────────────────────────────
function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

// ─── Campos do formulário ─────────────────────────────────────
const fields: {
  name: keyof Omit<LCFields, 'total_lc' | 'sangria_lc'>
  label: string
}[] = [
  { name: 'dinheiro_lc',    label: 'Dinheiro / Fechamento' },
  { name: 'pix_lc',         label: 'PIX'                   },
  { name: 'debito_lc',      label: 'Débito'                },
  { name: 'credito_lc',     label: 'Crédito'               },
  { name: 'consumo_loja_lc',label: 'Consumo Loja'          },
  { name: 'a_prazo_lc',     label: 'A Prazo'               },
  { name: 'tickets_lc',     label: 'Tickets'               },
]

// ─── Componente ───────────────────────────────────────────────
export default function CardLC() {
  const { control, setValue, formState: { errors } } = useFormContext<LCFields>()

  // Observa todos os campos que entram no cálculo
  const [
    dinheiro,
    pix,
    debito,
    credito,
    consumo,
    aPrazo,
    tickets,
    sangria,
  ] = useWatch({
    control,
    name: [
      'dinheiro_lc',
      'pix_lc',
      'debito_lc',
      'credito_lc',
      'consumo_loja_lc',
      'a_prazo_lc',
      'tickets_lc',
      'sangria_lc',
    ],
  })

  // Recalcula total sempre que um campo muda
  useEffect(() => {
    const total =
      (dinheiro  ?? 0) +
      (pix       ?? 0) +
      (debito    ?? 0) +
      (credito   ?? 0) +
      (consumo   ?? 0) +
      (aPrazo    ?? 0) +
      (tickets   ?? 0)
      // sangria NÃO entra no total

    setValue('total_lc', Number(total.toFixed(2)), { shouldDirty: false })
  }, [dinheiro, pix, debito, credito, consumo, aPrazo, tickets, setValue])

  const totalLC =
    (dinheiro ?? 0) +
    (pix      ?? 0) +
    (debito   ?? 0) +
    (credito  ?? 0) +
    (consumo  ?? 0) +
    (aPrazo   ?? 0) +
    (tickets  ?? 0)

  return (
    <div className="
      bg-white dark:bg-zinc-900
      border border-zinc-200 dark:border-zinc-800
      rounded-2xl overflow-hidden
      shadow-sm
    ">

      {/* ── Header ────────────────────────────────────────── */}
      <div className="
        flex items-center justify-between gap-3
        px-5 py-4
        border-b border-zinc-200 dark:border-zinc-800
        bg-zinc-50 dark:bg-zinc-800/50
      ">
        <div className="flex items-center gap-2.5">
          {/* Ícone */}
          <div className="
            flex items-center justify-center w-8 h-8 rounded-lg
            bg-emerald-500/10 dark:bg-emerald-500/10
          ">
            <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-none">
              Caixa LC
            </h2>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
              Lanchonete Central
            </p>
          </div>
        </div>

        {/* Badge total */}
        <div className="text-right">
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-0.5 uppercase tracking-wide">
            Total
          </p>
          <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatBRL(totalLC)}
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

        {/* Sangria — ocupa coluna dupla em sm */}
        <div className="sm:col-span-2">
          <Controller
            name="sangria_lc"
            control={control}
            defaultValue={0}
            render={({ field }) => (
              <div className="
                relative
                rounded-lg overflow-hidden
                border border-dashed border-zinc-300 dark:border-zinc-700
                bg-zinc-50 dark:bg-zinc-800/40
                p-3.5
              ">
                {/* Label + badge informativo */}
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Sangria
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

                {/* Input desabilitado visualmente mas editável */}
                <CurrencyInput
                  value={field.value}
                  onChange={field.onChange}
                  error={(errors.sangria_lc as { message?: string } | undefined)?.message}
                />
              </div>
            )}
          />
        </div>
      </div>

      {/* ── Rodapé com total detalhado ─────────────────────── */}
      <div className="
        px-5 py-4
        border-t border-zinc-200 dark:border-zinc-800
        bg-emerald-50 dark:bg-emerald-500/5
        flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3
      ">
        {/* Sangria info */}
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          Sangria registrada:&nbsp;
          <span className="font-medium text-amber-600 dark:text-amber-400 tabular-nums">
            {formatBRL(sangria ?? 0)}
          </span>
        </div>

        {/* Total LC */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Total LC</span>
          <span className="
            text-lg font-bold tabular-nums
            text-emerald-700 dark:text-emerald-400
          ">
            {formatBRL(totalLC)}
          </span>
        </div>
      </div>
    </div>
  )
}