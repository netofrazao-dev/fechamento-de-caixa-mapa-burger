// utils.ts — formatação e cálculos do sistema

import type { StatusCaixa } from './types'

// ─── Formatação ───────────────────────────────────────────────

export function brl(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export const formatarBRL = brl

export function brlSinal(value: number): string {
  return (value > 0 ? '+' : '') + brl(value)
}

export function formatData(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function formatDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

// ─── Cálculos ─────────────────────────────────────────────────

function arredondar(v: number): number {
  return Math.round(v * 100) / 100
}

function somar(valores: number[]): number {
  return arredondar(
    valores.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0),
  )
}

export function calcularTotalLC(f: {
  dinheiro_fechamento_lc: number
  pix_lc:                 number
  debito_lc:              number
  credito_lc:             number
  consumo_loja_lc:        number
  a_prazo_lc:             number
  ticket_lc:              number
}): number {
  return somar([
    f.dinheiro_fechamento_lc,
    f.pix_lc,
    f.debito_lc,
    f.credito_lc,
    f.consumo_loja_lc,
    f.a_prazo_lc,
    f.ticket_lc,
  ])
}

export function calcularTotalBrandy(f: {
  pix_brandy:            number
  debito_brandy:         number
  credito_brandy:        number
  credito_online_brandy: number
}): number {
  return somar([
    f.pix_brandy,
    f.debito_brandy,
    f.credito_brandy,
    f.credito_online_brandy,
  ])
}

export function calcularResultados(
  totalLC:        number,
  totalBrandy:    number,
  totalLCSistema: number,
  dinheiroBrandy: number,
  ajusteManual:   number,
) {
  const totalCaixa   = arredondar(totalLC + totalBrandy)
  const totalSistema = somar([totalLCSistema, totalBrandy, dinheiroBrandy])
  const diferenca    = arredondar(totalCaixa - totalSistema)
  const diferencaFinal = arredondar(diferenca + ajusteManual)
  const status = calcularStatus(diferencaFinal)

  return { totalCaixa, totalSistema, diferenca, diferencaFinal, status }
}

export function calcularStatus(diferencaFinal: number): StatusCaixa {
  if (diferencaFinal === 0) return 'CAIXA FECHOU'
  if (diferencaFinal > 0)  return 'SOBROU DINHEIRO'
  return 'FALTOU DINHEIRO'
}

// ─── Classes de cor ───────────────────────────────────────────

export function corDiferenca(v: number): string {
  if (v < 0) return 'text-red-600 dark:text-red-400'
  if (v > 0) return 'text-blue-600 dark:text-blue-400'
  return 'text-emerald-600 dark:text-emerald-400'
}

export const STATUS_CONFIG = {
  'CAIXA FECHOU': {
    label:   'Caixa fechou',
    dot:     'bg-emerald-500',
    badge:   'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    card:    'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25',
    text:    'text-emerald-700 dark:text-emerald-400',
    icon:    'bg-emerald-100 dark:bg-emerald-500/20',
  },
  'SOBROU DINHEIRO': {
    label:   'Sobrou dinheiro',
    dot:     'bg-blue-500',
    badge:   'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',
    card:    'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/25',
    text:    'text-blue-700 dark:text-blue-400',
    icon:    'bg-blue-100 dark:bg-blue-500/20',
  },
  'FALTOU DINHEIRO': {
    label:   'Faltou dinheiro',
    dot:     'bg-red-500',
    badge:   'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400',
    card:    'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/25',
    text:    'text-red-700 dark:text-red-400',
    icon:    'bg-red-100 dark:bg-red-500/20',
  },
} as const
