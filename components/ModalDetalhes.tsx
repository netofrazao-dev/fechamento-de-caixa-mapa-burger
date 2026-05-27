'use client'

import { useEffect, useRef } from 'react'

// ─── Tipos ────────────────────────────────────────────────────
export interface FechamentoDetalhe {
  id:              string
  created_at:      string
  data_fechamento: string

  // LC
  dinheiro_abertura_lc:   number
  dinheiro_fechamento_lc: number
  pix_lc:                 number
  debito_lc:              number
  credito_lc:             number
  consumo_loja_lc:        number
  a_prazo_lc:             number
  ticket_lc:              number
  sangria_lc:             number
  total_lc:               number

  // Brandy
  pix_brandy:            number
  debito_brandy:         number
  credito_brandy:        number
  credito_online_brandy: number
  dinheiro_brandy:       number
  total_brandy:          number

  // Resultado
  total_caixa:      number
  total_sistema:    number
  total_lc_sistema: number
  diferenca:        number
  ajuste_manual:    number
  diferenca_final:  number
  status:           'CAIXA FECHOU' | 'SOBROU DINHEIRO' | 'FALTOU DINHEIRO'

  observacoes: string | null
}

interface ModalDetalhesProps {
  fechamento: FechamentoDetalhe | null
  onClose:    () => void
}

// ─── Utilitários ──────────────────────────────────────────────
function brl(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function formatData(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatDataHora(iso: string) {
  const dt = new Date(iso)
  return dt.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function difSinal(v: number) {
  return (v > 0 ? '+' : '') + brl(v)
}

// ─── Config status ────────────────────────────────────────────
const STATUS_CFG = {
  'CAIXA FECHOU': {
    label:     'Caixa fechou',
    wrap:      'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25',
    text:      'text-emerald-700 dark:text-emerald-400',
    iconWrap:  'bg-emerald-100 dark:bg-emerald-500/20',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  'SOBROU DINHEIRO': {
    label:     'Sobrou dinheiro',
    wrap:      'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/25',
    text:      'text-blue-700 dark:text-blue-400',
    iconWrap:  'bg-blue-100 dark:bg-blue-500/20',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
  },
  'FALTOU DINHEIRO': {
    label:     'Faltou dinheiro',
    wrap:      'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/25',
    text:      'text-red-700 dark:text-red-400',
    iconWrap:  'bg-red-100 dark:bg-red-500/20',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
}

// ─── Sub-componentes ──────────────────────────────────────────

/** Linha de valor simples */
function Row({
  label, value, muted, highlight,
}: {
  label:      string
  value:      string
  muted?:     boolean
  highlight?: 'positive' | 'negative' | 'neutral'
}) {
  const valueColor =
    highlight === 'positive' ? 'text-blue-600 dark:text-blue-400' :
    highlight === 'negative' ? 'text-red-600 dark:text-red-400'   :
    highlight === 'neutral'  ? 'text-emerald-600 dark:text-emerald-400' :
    'text-zinc-800 dark:text-zinc-200'

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <span className={`text-sm ${muted ? 'text-zinc-400 dark:text-zinc-500 italic' : 'text-zinc-500 dark:text-zinc-400'}`}>
        {label}
        {muted && (
          <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 not-italic">
            só exibe
          </span>
        )}
      </span>
      <span className={`text-sm font-medium tabular-nums ${valueColor}`}>
        {value}
      </span>
    </div>
  )
}

/** Cabeçalho de seção */
function SectionHeader({
  icon, title, subtitle, accentColor,
}: {
  icon:         React.ReactNode
  title:        string
  subtitle?:    string
  accentColor:  string
}) {
  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50`}>
      <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${accentColor}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-none">{title}</p>
        {subtitle && <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────
export default function ModalDetalhes({ fechamento, onClose }: ModalDetalhesProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Fechar com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Travar scroll do body
  useEffect(() => {
    if (fechamento) document.body.style.overflow = 'hidden'
    return ()  => { document.body.style.overflow = '' }
  }, [fechamento])

  if (!fechamento) return null

  const f   = fechamento
  const cfg = STATUS_CFG[f.status]

  const difHighlight =
    f.diferenca_final < 0 ? 'negative' :
    f.diferenca_final > 0 ? 'positive' : 'neutral'

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      className="
        fixed inset-0 z-50
        bg-black/50 dark:bg-black/70
        backdrop-blur-sm
        flex items-end sm:items-center justify-center
        p-0 sm:p-4
        animate-in fade-in duration-150
      "
    >
      <div className="
        w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[88vh]
        bg-white dark:bg-zinc-900
        sm:rounded-2xl rounded-t-2xl
        shadow-2xl border border-zinc-200 dark:border-zinc-800
        flex flex-col
        animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-2 duration-200
        overflow-hidden
      ">

        {/* ── Cabeçalho fixo ──────────────────────────────── */}
        <div className="
          flex items-center justify-between gap-3
          px-5 py-4
          border-b border-zinc-200 dark:border-zinc-800
          bg-white dark:bg-zinc-900
          shrink-0
        ">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800">
              <svg className="w-4.5 h-4.5 text-zinc-600 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 leading-none">
                Fechamento — {formatData(f.data_fechamento)}
              </h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                Criado em {formatDataHora(f.created_at)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="
              flex items-center justify-center w-8 h-8 rounded-lg shrink-0
              text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200
              hover:bg-zinc-100 dark:hover:bg-zinc-800
              transition-all
            "
            aria-label="Fechar"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* ── Conteúdo scrollável ──────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Status destaque */}
          <div className={`mx-4 mt-4 rounded-xl border p-4 flex items-center justify-between gap-3 ${cfg.wrap}`}>
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${cfg.iconWrap}`}>
                <span className={cfg.text}>{cfg.icon}</span>
              </div>
              <div>
                <p className={`text-[10px] font-medium uppercase tracking-widest ${cfg.text} opacity-70`}>Status</p>
                <p className={`text-base font-bold ${cfg.text}`}>{cfg.label}</p>
              </div>
            </div>
            <p className={`text-xl font-bold tabular-nums ${cfg.text}`}>
              {difSinal(f.diferenca_final)}
            </p>
          </div>

          {/* Grid 2 colunas em sm+ */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* ── Card LC ─────────────────────────────────── */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <SectionHeader
                icon={
                  <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35" />
                  </svg>
                }
                title="Caixa LC"
                subtitle="Lanchonete Central"
                accentColor="bg-emerald-500/10"
              />
              <div className="px-4 py-1">
                <Row label="Din. abertura"   value={brl(f.dinheiro_abertura_lc)}   muted />
                <Row label="Dinheiro / Fech."value={brl(f.dinheiro_fechamento_lc)} />
                <Row label="PIX"             value={brl(f.pix_lc)}                 />
                <Row label="Débito"          value={brl(f.debito_lc)}              />
                <Row label="Crédito"         value={brl(f.credito_lc)}             />
                <Row label="Consumo loja"    value={brl(f.consumo_loja_lc)}        />
                <Row label="A prazo"         value={brl(f.a_prazo_lc)}             />
                <Row label="Ticket"          value={brl(f.ticket_lc)}              />
                <Row label="Sangria"         value={brl(f.sangria_lc)}             muted />
              </div>
              <div className="mx-4 mb-3 mt-1 flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2.5">
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Total LC</span>
                <span className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{brl(f.total_lc)}</span>
              </div>
            </div>

            {/* ── Card Brandy ──────────────────────────────── */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <SectionHeader
                icon={
                  <svg className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5" />
                  </svg>
                }
                title="Caixa Brandy"
                subtitle="Bar & Restaurante"
                accentColor="bg-violet-500/10"
              />
              <div className="px-4 py-1">
                <Row label="PIX"            value={brl(f.pix_brandy)}            />
                <Row label="Débito"         value={brl(f.debito_brandy)}         />
                <Row label="Crédito"        value={brl(f.credito_brandy)}        />
                <Row label="Crédito online" value={brl(f.credito_online_brandy)} />
                <Row label="Dinheiro"       value={brl(f.dinheiro_brandy)}       muted />
              </div>
              <div className="mx-4 mb-3 mt-1 flex items-center justify-between rounded-lg bg-violet-50 dark:bg-violet-500/10 px-3 py-2.5">
                <span className="text-sm font-semibold text-violet-700 dark:text-violet-400">Total Brandy</span>
                <span className="text-sm font-bold tabular-nums text-violet-700 dark:text-violet-400">{brl(f.total_brandy)}</span>
              </div>
            </div>

            {/* ── Resultado ────────────────────────────────── */}
            <div className="sm:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <SectionHeader
                icon={
                  <svg className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                }
                title="Resultado Final"
                subtitle="Consolidado do fechamento"
                accentColor="bg-zinc-200 dark:bg-zinc-700"
              />
              <div className="px-4 py-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <div>
                  <Row label="Total caixa"         value={brl(f.total_caixa)}   />
                  <Row label="Total LC sistema"     value={brl(f.total_lc_sistema)} />
                  <Row label="Total sistema"        value={brl(f.total_sistema)} />
                </div>
                <div>
                  <Row label="Diferença original"  value={difSinal(f.diferenca)}
                    highlight={f.diferenca < 0 ? 'negative' : f.diferenca > 0 ? 'positive' : 'neutral'} />
                  <Row label="Ajuste manual"        value={difSinal(f.ajuste_manual)}
                    highlight={f.ajuste_manual !== 0 ? (f.ajuste_manual > 0 ? 'positive' : 'negative') : undefined} />
                  <Row label="Diferença final"      value={difSinal(f.diferenca_final)}
                    highlight={difHighlight} />
                </div>
              </div>
            </div>

            {/* ── Observações ──────────────────────────────── */}
            {f.observacoes && (
              <div className="sm:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <SectionHeader
                  icon={
                    <svg className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                  }
                  title="Observações"
                  accentColor="bg-zinc-200 dark:bg-zinc-700"
                />
                <p className="px-4 py-3.5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
                  {f.observacoes}
                </p>
              </div>
            )}
          </div>

          {/* padding inferior para não colar no bottom */}
          <div className="h-2" />
        </div>

        {/* ── Rodapé fixo ─────────────────────────────────── */}
        <div className="
          shrink-0 px-5 py-3.5
          border-t border-zinc-200 dark:border-zinc-800
          bg-zinc-50 dark:bg-zinc-800/50
          flex items-center justify-between gap-3
        ">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
            ID: <span className="font-mono">{f.id}</span>
          </p>
          <button
            onClick={onClose}
            className="
              px-4 h-8 rounded-lg text-sm font-medium
              bg-zinc-200 dark:bg-zinc-700
              text-zinc-700 dark:text-zinc-200
              hover:bg-zinc-300 dark:hover:bg-zinc-600
              transition-all shrink-0
            "
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}