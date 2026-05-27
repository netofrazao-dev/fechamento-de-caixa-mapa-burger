'use client'

// ui.tsx — primitivos de UI reutilizáveis do sistema

import { forwardRef, useCallback } from 'react'
import type { StatusCaixa }        from '@/lib/types'
import { STATUS_CONFIG, brl }      from '@/lib/utils'

// ─── Card ─────────────────────────────────────────────────────

interface CardProps {
  children:  React.ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`
      bg-white dark:bg-zinc-900
      border border-zinc-200 dark:border-zinc-800
      rounded-2xl overflow-hidden shadow-sm
      ${className}
    `}>
      {children}
    </div>
  )
}

// ─── CardHeader ───────────────────────────────────────────────

interface CardHeaderProps {
  icon:       React.ReactNode
  iconColor:  string           // ex: 'bg-emerald-500/10'
  title:      string
  subtitle?:  string
  right?:     React.ReactNode  // slot opcional direita
}

export function CardHeader({ icon, iconColor, title, subtitle, right }: CardHeaderProps) {
  return (
    <div className="
      flex items-center justify-between gap-3
      px-4 sm:px-5 py-3.5
      border-b border-zinc-200 dark:border-zinc-800
      bg-zinc-50 dark:bg-zinc-800/50
    ">
      <div className="flex items-center gap-2.5">
        <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${iconColor}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-none">
            {title}
          </p>
          {subtitle && (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}

// ─── ValueRow — linha label + valor ──────────────────────────

interface ValueRowProps {
  label:      string
  value:      string
  valueClass?: string
  onlyDisplay?: boolean  // exibe badge "só exibe"
  bold?:      boolean
  noBorder?:  boolean
}

export function ValueRow({
  label, value, valueClass = '', onlyDisplay, bold, noBorder,
}: ValueRowProps) {
  return (
    <div className={`
      flex items-center justify-between py-2.5
      ${noBorder ? '' : 'border-b border-zinc-100 dark:border-zinc-800 last:border-0'}
    `}>
      <span className={`text-sm ${bold ? 'font-medium text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'}`}>
        {label}
        {onlyDisplay && (
          <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded
            bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400">
            só exibe
          </span>
        )}
      </span>
      <span className={`text-sm font-medium tabular-nums ${valueClass || (bold ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300')}`}>
        {value}
      </span>
    </div>
  )
}

// ─── CardTotal — barra de total colorida ─────────────────────

interface CardTotalProps {
  label:      string
  value:      number
  colorClass: string   // ex: 'text-emerald-700 dark:text-emerald-400'
  bgClass:    string   // ex: 'bg-emerald-50 dark:bg-emerald-500/10'
}

export function CardTotal({ label, value, colorClass, bgClass }: CardTotalProps) {
  return (
    <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg mx-4 sm:mx-5 mb-4 ${bgClass}`}>
      <span className={`text-sm font-semibold ${colorClass}`}>{label}</span>
      <span className={`text-sm font-bold tabular-nums ${colorClass}`}>{brl(value)}</span>
    </div>
  )
}

// ─── StatusBadge ─────────────────────────────────────────────

export function StatusBadge({ status }: { status: StatusCaixa }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ─── SoloDisplayField — campo "só exibe" ─────────────────────

interface SoloDisplayFieldProps {
  label:    string
  children: React.ReactNode
}

export function SoloDisplayField({ label, children }: SoloDisplayFieldProps) {
  return (
    <div className="
      sm:col-span-2 rounded-xl
      border border-dashed border-zinc-300 dark:border-zinc-700
      bg-zinc-50 dark:bg-zinc-800/40
      p-3.5
    ">
      <div className="flex items-center justify-between mb-2.5">
        <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</label>
        <span className="
          inline-flex items-center gap-1 px-2 py-0.5 rounded-md
          text-[10px] font-medium uppercase tracking-wide
          bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400
        ">
          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          Não entra no total
        </span>
      </div>
      {children}
    </div>
  )
}

// ─── CurrencyInput ────────────────────────────────────────────

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function applyMask(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits ? formatBRL(Number(digits) / 100) : ''
}

function parseMask(masked: string): number {
  return Number(masked.replace(/\D/g, '')) / 100
}

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value?:           number
  onChange?:        (value: number) => void
  label?:           string
  error?:           string
  wrapperClassName?: string
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, label, error, id, disabled, wrapperClassName = '', className = '', ...rest }, ref) => {
    const displayValue = value ? formatBRL(value) : ''
    const inputId      = id ?? `ci-${Math.random().toString(36).slice(2, 7)}`

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const masked = applyMask(e.target.value)
      e.target.value = masked
      onChange?.(parseMask(masked))
    }, [onChange])

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      const allowed = ['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight','Home','End']
      if (allowed.includes(e.key)) return
      if ((e.ctrlKey || e.metaKey) && 'acvx'.includes(e.key.toLowerCase())) return
      if (!/\d/.test(e.key)) e.preventDefault()
    }, [])

    const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      const len = e.target.value.length
      requestAnimationFrame(() => e.target.setSelectionRange(len, len))
    }, [])

    return (
      <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </label>
        )}
        <div className={`
          relative flex items-center
          h-12 sm:h-11 rounded-xl sm:rounded-lg
          bg-zinc-50 dark:bg-zinc-800 border
          transition-all duration-150
          focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500/50
          ${error
            ? 'border-red-400/60 focus-within:ring-red-400/20'
            : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}>
          <span className="pl-3.5 pr-1.5 text-sm font-medium text-zinc-400 dark:text-zinc-500 select-none">
            R$
          </span>
          <input
            {...rest}
            ref={ref}
            id={inputId}
            type="text"
            inputMode="numeric"
            disabled={disabled}
            placeholder="0,00"
            value={displayValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            className={`
              flex-1 h-full bg-transparent outline-none
              text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400
              pr-3.5
              ${disabled ? 'cursor-not-allowed' : ''}
              ${className}
            `}
          />
        </div>
        {error && (
          <p className="flex items-center gap-1 text-xs text-red-500">
            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
      </div>
    )
  }
)

CurrencyInput.displayName = 'CurrencyInput'

// ─── Skeleton ─────────────────────────────────────────────────

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800 ${className}`} />
  )
}

// ─── Toast ────────────────────────────────────────────────────

import type { Toast as ToastType } from '@/lib/types'

interface ToastProps {
  toast:    ToastType | null
  onClose?: () => void
}

export function Toast({ toast, onClose }: ToastProps) {
  if (!toast) return null
  const ok = toast.type === 'success'

  return (
    <div className="
      fixed bottom-0 sm:bottom-5 left-0 sm:left-auto right-0 sm:right-5
      z-50 p-4 sm:p-0
      w-full sm:max-w-sm
    ">
      <div className={`
        flex items-start gap-3 p-4 rounded-xl sm:rounded-xl shadow-lg border
        bg-white dark:bg-zinc-900
        ${ok
          ? 'border-emerald-200 dark:border-emerald-500/30'
          : 'border-red-200 dark:border-red-500/30'
        }
      `}>
        <div className={`
          flex items-center justify-center w-8 h-8 rounded-lg shrink-0
          ${ok
            ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            : 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400'
          }
        `}>
          {ok
            ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          }
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{toast.title}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{toast.message}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar notificação"
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md
            text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  )
}