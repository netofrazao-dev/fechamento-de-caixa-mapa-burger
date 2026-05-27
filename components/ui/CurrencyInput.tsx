'use client'

import { forwardRef, useCallback } from 'react'

// ─── Utilitários ─────────────────────────────────────────────

/** Converte valor numérico em string formatada: 1234.56 → "1.234,56" */
function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/** Remove tudo que não for dígito, converte para número real: "1.234,56" → 1234.56 */
function parseBRL(masked: string): number {
  const digits = masked.replace(/\D/g, '')
  return Number(digits) / 100
}

/** Aplica a máscara a uma string de dígitos puros */
function applyMask(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return formatBRL(Number(digits) / 100)
}

// ─── Props ────────────────────────────────────────────────────
export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  /** Valor numérico controlado (ex: 1234.56) */
  value?: number
  /** Callback com o valor numérico real (sem formatação) */
  onChange?: (value: number) => void
  /** Exibe o prefixo "R$" dentro do campo. Padrão: true */
  showPrefix?: boolean
  /** Classes extras para o wrapper externo */
  wrapperClassName?: string
  /** Mensagem de erro */
  error?: string
  /** Label visível acima do campo */
  label?: string
}

// ─── Componente ───────────────────────────────────────────────
const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      value,
      onChange,
      showPrefix = true,
      wrapperClassName = '',
      className = '',
      error,
      label,
      id,
      disabled,
      placeholder = '0,00',
      ...rest
    },
    ref,
  ) => {
    // Valor exibido no input (string formatada)
    const displayValue = value !== undefined && value !== 0 ? formatBRL(value) : ''

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const masked = applyMask(e.target.value)
        const numeric = parseBRL(masked)
        onChange?.(numeric)

        // Atualiza o campo manualmente para manter o cursor no final
        e.target.value = masked
      },
      [onChange],
    )

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      // Permite: Backspace, Delete, Tab, Escape, Enter, setas, Ctrl/Cmd+A/C/V/X
      const allowed = [
        'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End',
      ]
      if (allowed.includes(e.key)) return
      if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) return
      // Bloqueia qualquer caractere não numérico
      if (!/\d/.test(e.key)) e.preventDefault()
    }, [])

    const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      // Move cursor para o final ao focar
      const len = e.target.value.length
      requestAnimationFrame(() => {
        e.target.setSelectionRange(len, len)
      })
    }, [])

    const inputId = id ?? `currency-${Math.random().toString(36).slice(2, 7)}`

    return (
      <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>

        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-zinc-300"
          >
            {label}
          </label>
        )}

        {/* Wrapper do input */}
        <div className={`
          relative flex items-center
          h-11 rounded-lg
          bg-zinc-800 border
          transition-all duration-150
          focus-within:ring-2 focus-within:ring-emerald-500/40 focus-within:border-emerald-500/60
          ${error
            ? 'border-red-500/60 focus-within:ring-red-500/30'
            : 'border-zinc-700 hover:border-zinc-600'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}>

          {/* Prefixo R$ */}
          {showPrefix && (
            <span className="pl-3.5 pr-1.5 text-sm font-medium text-zinc-500 select-none pointer-events-none">
              R$
            </span>
          )}

          <input
            {...rest}
            ref={ref}
            id={inputId}
            type="text"
            inputMode="numeric"
            disabled={disabled}
            placeholder={placeholder}
            value={displayValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            className={`
              flex-1 h-full bg-transparent outline-none
              text-sm text-white placeholder-zinc-600
              ${showPrefix ? 'pl-0 pr-3.5' : 'px-3.5'}
              ${disabled ? 'cursor-not-allowed' : ''}
              ${className}
            `}
          />
        </div>

        {/* Erro */}
        {error && (
          <p className="flex items-center gap-1 text-xs text-red-400">
            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
      </div>
    )
  },
)

CurrencyInput.displayName = 'CurrencyInput'

export default CurrencyInput