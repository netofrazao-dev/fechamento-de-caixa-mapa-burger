'use client'

import { useFormContext } from 'react-hook-form'

// ─── Constantes ───────────────────────────────────────────────
const MAX_CHARS = 600

// ─── Sugestões rápidas ────────────────────────────────────────
const SUGESTOES = [
  'Dinheiro rasgado',
  'Troco convertido em PIX',
  'Valor não declarado',
  'Erro operacional',
  'Ajuste manual realizado',
  'Sangria não registrada',
]

// ─── Tipo esperado no formulário ──────────────────────────────
export interface ObservacoesFields {
  observacoes: string
}

// ─── Componente ───────────────────────────────────────────────
export default function CampoObservacoes() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<ObservacoesFields>()

  const texto     = watch('observacoes') ?? ''
  const total     = texto.length
  const restante  = MAX_CHARS - total
  const percentual = Math.min((total / MAX_CHARS) * 100, 100)

  const corBarra =
    percentual >= 90 ? 'bg-red-500' :
    percentual >= 70 ? 'bg-amber-400' :
    'bg-emerald-500'

  function aplicarSugestao(sugestao: string) {
    const atual     = texto.trim()
    const separador = atual.length > 0 ? '. ' : ''
    const novo      = (atual + separador + sugestao).slice(0, MAX_CHARS)
    setValue('observacoes', novo, { shouldDirty: true, shouldValidate: true })
  }

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
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-none">
            Observações
          </h2>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
            Explique diferenças ou ajustes realizados
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">

        {/* ── Sugestões rápidas ────────────────────────────── */}
        <div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2 uppercase tracking-wide">
            Sugestões rápidas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SUGESTOES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => aplicarSugestao(s)}
                disabled={restante <= 0}
                className="
                  inline-flex items-center gap-1 px-2.5 py-1 rounded-lg
                  text-[11px] font-medium
                  bg-zinc-100 dark:bg-zinc-800
                  text-zinc-600 dark:text-zinc-400
                  border border-zinc-200 dark:border-zinc-700
                  hover:bg-zinc-200 dark:hover:bg-zinc-700
                  hover:text-zinc-900 dark:hover:text-zinc-200
                  hover:border-zinc-300 dark:hover:border-zinc-600
                  disabled:opacity-40 disabled:cursor-not-allowed
                  transition-all duration-100 active:scale-95
                "
              >
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
                </svg>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* ── Textarea ─────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="relative">
            <textarea
              {...register('observacoes', {
                maxLength: {
                  value: MAX_CHARS,
                  message: `Máximo de ${MAX_CHARS} caracteres permitidos`,
                },
              })}
              rows={5}
              maxLength={MAX_CHARS}
              placeholder="Descreva aqui qualquer observação relevante sobre o fechamento: diferenças encontradas, ajustes realizados, ocorrências do dia..."
              className={`
                w-full px-4 py-3 rounded-xl resize-none
                text-sm text-zinc-900 dark:text-zinc-100
                placeholder-zinc-400 dark:placeholder-zinc-600
                bg-zinc-50 dark:bg-zinc-800
                border outline-none
                transition-all duration-150
                focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50
                ${errors.observacoes
                  ? 'border-red-400/60 dark:border-red-500/40 focus:ring-red-400/20'
                  : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                }
              `}
            />

            {total > 0 && (
              <button
                type="button"
                onClick={() => setValue('observacoes', '', { shouldDirty: true })}
                className="
                  absolute top-3 right-3
                  flex items-center justify-center w-5 h-5 rounded-md
                  text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200
                  hover:bg-zinc-200 dark:hover:bg-zinc-700
                  transition-all
                "
                aria-label="Limpar texto"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>

          {errors.observacoes && (
            <p className="flex items-center gap-1.5 text-xs text-red-500">
              <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              {errors.observacoes.message as string}
            </p>
          )}

          {/* ── Barra + contador ─────────────────────────── */}
          <div className="space-y-1.5">
            <div className="h-0.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-200 ${corBarra}`}
                style={{ width: `${percentual}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {total === 0
                  ? 'Campo opcional'
                  : restante <= 50
                  ? `${restante} caracteres restantes`
                  : `${total} caracteres`}
              </p>
              <p className={`text-[11px] font-medium tabular-nums transition-colors ${
                percentual >= 90 ? 'text-red-500' :
                percentual >= 70 ? 'text-amber-500' :
                'text-zinc-400 dark:text-zinc-500'
              }`}>
                {total} / {MAX_CHARS}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}