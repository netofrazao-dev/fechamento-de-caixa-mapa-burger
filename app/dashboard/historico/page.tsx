'use client'
// app/dashboard/historico/page.tsx

import { useEffect, useState, useCallback, useRef } from 'react'
import { useReactToPrint }                           from 'react-to-print'
import { supabase }                                  from '@/lib/supabase'
import { brl, brlSinal, formatData, formatDataHora,
         corDiferenca, STATUS_CONFIG }               from '@/lib/utils'
import { Skeleton, StatusBadge }                     from '@/components/ui'
import type { Fechamento, FechamentoResumo,
              StatusCaixa }                          from '@/lib/types'

// ─── Filtros ──────────────────────────────────────────────────

const FILTROS: { label: string; value: 'TODOS' | StatusCaixa }[] = [
  { label: 'Todos',  value: 'TODOS'            },
  { label: 'Fechou', value: 'CAIXA FECHOU'     },
  { label: 'Sobrou', value: 'SOBROU DINHEIRO'  },
  { label: 'Faltou', value: 'FALTOU DINHEIRO'  },
]

// ─── Cupom térmico (58mm) ─────────────────────────────────────

const COLS = 40
const SEP  = '-'.repeat(COLS)
const SEP2 = '='.repeat(COLS)

function pad(l: string, v: string) {
  const max = COLS - v.length - 1
  const lb  = l.length > max ? l.slice(0, max - 1) + '.' : l
  return lb + ' '.repeat(Math.max(1, COLS - lb.length - v.length)) + v
}
function ctr(t: string) {
  return ' '.repeat(Math.max(0, Math.floor((COLS - t.length) / 2))) + t
}
function fmt2(n: number) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}
const ds = (v: number) => (v >= 0 ? '+' : '') + fmt2(v)

function CupomContent({ f }: { f: Fechamento }) {
  const df    = f.diferenca_final
  const stLbl = df === 0 ? '*** CAIXA FECHOU ***' : df > 0 ? '>>> SOBROU DINHEIRO' : '<<< FALTOU DINHEIRO'

  const lines = [
    { bold: true,  v: ctr('MAPA BURGER')           },
    { bold: true,  v: ctr('FECHAMENTO DE CAIXA')   },
    {              v: SEP2                          },
    {              v: ctr(formatData(f.data_fechamento)) },
    { small: true, v: ctr(formatDataHora(f.created_at)) },
    {              v: SEP                           },
    { bold: true,  v: ctr('[ CAIXA LC ]')          },
    {              v: SEP                           },
    {              v: pad('Din. Abertura',   fmt2(f.dinheiro_abertura_lc))   },
    {              v: '- '.repeat(COLS / 2)         },
    {              v: pad('Dinheiro/Fech.', fmt2(f.dinheiro_fechamento_lc)) },
    {              v: pad('PIX',            fmt2(f.pix_lc))                 },
    {              v: pad('Debito',         fmt2(f.debito_lc))              },
    {              v: pad('Credito',        fmt2(f.credito_lc))             },
    {              v: pad('Consumo Loja',   fmt2(f.consumo_loja_lc))        },
    {              v: pad('A Prazo',        fmt2(f.a_prazo_lc))             },
    {              v: pad('Ticket',         fmt2(f.ticket_lc))              },
    {              v: '- '.repeat(COLS / 2)         },
    {              v: pad('Sangria (ref.)', fmt2(f.sangria_lc))             },
    {              v: SEP                           },
    { bold: true,  v: pad('TOTAL LC',       fmt2(f.total_lc))              },
    {              v: SEP                           },
    { bold: true,  v: ctr('[ CAIXA BRANDY ]')       },
    {              v: SEP                           },
    {              v: pad('PIX',            fmt2(f.pix_brandy))             },
    {              v: pad('Debito',         fmt2(f.debito_brandy))          },
    {              v: pad('Credito',        fmt2(f.credito_brandy))         },
    {              v: pad('Credito Online', fmt2(f.credito_online_brandy))  },
    {              v: '- '.repeat(COLS / 2)         },
    {              v: pad('Dinheiro (ref.)',fmt2(f.dinheiro_brandy))        },
    {              v: SEP                           },
    { bold: true,  v: pad('TOTAL BRANDY',   fmt2(f.total_brandy))          },
    {              v: SEP                           },
    { bold: true,  v: ctr('[ RESULTADO ]') },
    {              v: SEP                           },
    {              v: pad('Total Caixa',    fmt2(f.total_caixa))            },
    {              v: pad('Total LC Sist.', fmt2(f.total_lc_sistema))       },
    {              v: pad('Total Sistema',  fmt2(f.total_sistema))          },
    {              v: '- '.repeat(COLS / 2)         },
    {              v: pad('Diferenca Orig.',ds(f.diferenca))                },
    {              v: pad('Ajuste Manual',  ds(f.ajuste_manual))            },
    {              v: SEP                           },
    { bold: true,  v: pad('DIFERENCA FINAL',ds(df))                        },
    {              v: SEP2                          },
    { bold: true,  v: ctr(stLbl)                   },
    {              v: SEP2                          },
    ...(f.observacoes ? [
      { bold: true,  v: ctr('[ OBSERVACOES ]') },
      {              v: SEP                    },
      { obs: true,   v: f.observacoes          },
      {              v: SEP                    },
    ] : []),
    { small: true, v: ctr(formatDataHora(f.created_at))           },
    { small: true, v: ctr('ID: ' + f.id.slice(0, 16) + '...')    },
    {              v: SEP                    },
    { bold: true,  v: ctr('* * *')          },
  ]

  return (
    <div style={{ fontFamily: "'Courier New', monospace", fontSize: '9.5px', lineHeight: 1.45, color: '#000', background: '#fff', width: '73mm', padding: '3mm 3mm 4mm', whiteSpace: 'pre' }}>
      {lines.map((l, i) => (
        <p key={i} style={{
          margin: 0,
          fontWeight: l.bold ? 700 : 400,
          fontSize: l.small ? '8px' : l.bold ? '10px' : '9.5px',
          whiteSpace: l.obs ? 'pre-wrap' : 'pre',
          wordBreak: l.obs ? 'break-word' : undefined,
          opacity: l.v.startsWith('-') ? 0.45 : 1,
        }}>
          {l.v}
        </p>
      ))}
    </div>
  )
}

// ─── Modal detalhes ───────────────────────────────────────────

function ModalDetalhes({ f, onClose }: { f: Fechamento; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Fechamento_${f.data_fechamento}`,
    pageStyle: `@page { size: 79mm auto; margin: 0; } @media print { html,body { width: 79mm; margin: 0; } .no-print { display: none !important; } }`,
  })

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, [onClose])

  function Row({ label, value, vc = '', muted = false }: { label: string; value: string; vc?: string; muted?: boolean }) {
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
        <span className={`text-sm ${muted ? 'text-zinc-400 italic' : 'text-zinc-500 dark:text-zinc-400'}`}>
          {label}
          {muted && <span className="ml-2 not-italic text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400">só exibe</span>}
        </span>
        <span className={`text-sm font-medium tabular-nums ${vc || 'text-zinc-800 dark:text-zinc-200'}`}>{value}</span>
      </div>
    )
  }

  const cfg = STATUS_CONFIG[f.status]

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[88vh] bg-white dark:bg-zinc-900 sm:rounded-2xl rounded-t-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden">

        {/* Handle mobile */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <svg className="w-4 h-4 text-zinc-600 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 leading-none">
                Fechamento — {formatData(f.data_fechamento)}
              </h2>
              <p className="text-xs text-zinc-400 mt-1">Criado em {formatDataHora(f.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="no-print inline-flex items-center gap-2 px-3 h-8 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" /></svg>
              Imprimir
            </button>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto">
          <div ref={printRef}>

            {/* Status */}
            <div className={`mx-4 mt-4 rounded-xl border p-4 flex items-center justify-between gap-3 ${cfg.card}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cfg.icon}`}>
                  <span className={cfg.text}>
                    {f.status === 'CAIXA FECHOU'    && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    {f.status === 'SOBROU DINHEIRO' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>}
                    {f.status === 'FALTOU DINHEIRO' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>}
                  </span>
                </div>
                <div>
                  <p className={`text-[10px] font-medium uppercase tracking-widest opacity-70 ${cfg.text}`}>Status</p>
                  <p className={`text-base font-bold ${cfg.text}`}>{cfg.label}</p>
                </div>
              </div>
              <p className={`text-xl font-bold tabular-nums ${cfg.text}`}>{brlSinal(f.diferenca_final)}</p>
            </div>

            {/* Grid de seções */}
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* LC */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                  <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18" /></svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-none">Caixa LC</p>
                    <p className="text-[10px] text-zinc-400">Lanchonete Central</p>
                  </div>
                </div>
                <div className="px-4 py-1">
                  <Row label="Din. abertura"    value={brl(f.dinheiro_abertura_lc)}   muted />
                  <Row label="Dinheiro / Fech." value={brl(f.dinheiro_fechamento_lc)} />
                  <Row label="PIX"              value={brl(f.pix_lc)}                 />
                  <Row label="Débito"           value={brl(f.debito_lc)}              />
                  <Row label="Crédito"          value={brl(f.credito_lc)}             />
                  <Row label="Consumo loja"     value={brl(f.consumo_loja_lc)}        />
                  <Row label="A prazo"          value={brl(f.a_prazo_lc)}             />
                  <Row label="Ticket"           value={brl(f.ticket_lc)}              />
                  <Row label="Sangria"          value={brl(f.sangria_lc)}             muted />
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg mx-3 mb-3 bg-emerald-50 dark:bg-emerald-500/10">
                  <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Total LC</span>
                  <span className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{brl(f.total_lc)}</span>
                </div>
              </div>

              {/* Brandy */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                  <div className="w-6 h-6 rounded-md bg-violet-500/10 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5" /></svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-none">Caixa Brandy</p>
                    <p className="text-[10px] text-zinc-400">Bar & Restaurante</p>
                  </div>
                </div>
                <div className="px-4 py-1">
                  <Row label="PIX"             value={brl(f.pix_brandy)}            />
                  <Row label="Débito"          value={brl(f.debito_brandy)}         />
                  <Row label="Crédito"         value={brl(f.credito_brandy)}        />
                  <Row label="Crédito online"  value={brl(f.credito_online_brandy)} />
                  <Row label="Dinheiro"        value={brl(f.dinheiro_brandy)}       muted />
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg mx-3 mb-3 bg-violet-50 dark:bg-violet-500/10">
                  <span className="text-sm font-semibold text-violet-700 dark:text-violet-400">Total Brandy</span>
                  <span className="text-sm font-bold tabular-nums text-violet-700 dark:text-violet-400">{brl(f.total_brandy)}</span>
                </div>
              </div>

              {/* Resultado */}
              <div className="sm:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Resultado Final</p>
                </div>
                <div className="px-4 py-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  <div>
                    <Row label="Total caixa"       value={brl(f.total_caixa)}    />
                    <Row label="Total LC sistema"  value={brl(f.total_lc_sistema)} />
                    <Row label="Total sistema"     value={brl(f.total_sistema)}  />
                  </div>
                  <div>
                    <Row label="Diferença original" value={brlSinal(f.diferenca)}       vc={corDiferenca(f.diferenca)}       />
                    <Row label="Ajuste manual"       value={brlSinal(f.ajuste_manual)}   vc={f.ajuste_manual !== 0 ? corDiferenca(f.ajuste_manual) : ''} />
                    <Row label="Diferença final"     value={brlSinal(f.diferenca_final)} vc={corDiferenca(f.diferenca_final)} />
                  </div>
                </div>
              </div>

              {/* Observações */}
              {f.observacoes && (
                <div className="sm:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Observações</p>
                  </div>
                  <p className="px-4 py-3.5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
                    {f.observacoes}
                  </p>
                </div>
              )}

              {/* Cupom */}
              <div className="sm:col-span-2 no-print">
                <div className="bg-white border border-zinc-200 dark:border-zinc-700 rounded-xl inline-block p-3 overflow-x-auto max-w-full">
                  <div className="w-full h-1 bg-zinc-100 rounded-full mb-2" />
                  <CupomContent f={f} />
                  <div className="w-full h-1 bg-zinc-100 rounded-full mt-2" />
                </div>
              </div>
            </div>
            <div className="h-2" />
          </div>
        </div>

        {/* Rodapé */}
        <div className="shrink-0 px-5 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-400 font-mono truncate">ID: {f.id}</p>
          <button onClick={onClose}
            className="px-4 h-8 rounded-lg text-sm font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-all shrink-0">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────

export default function HistoricoPage() {
  const [dados,   setDados  ] = useState<FechamentoResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [erro,    setErro   ] = useState<string | null>(null)
  const [busca,   setBusca  ] = useState('')
  const [filtro,  setFiltro ] = useState<'TODOS' | StatusCaixa>('TODOS')
  const [detalhe, setDetalhe] = useState<Fechamento | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setErro(null)
    supabase
      .from('cash_closings')
      .select('id,created_at,data_fechamento,total_caixa,total_sistema,diferenca_final,status,ajuste_manual,observacoes')
      .order('data_fechamento', { ascending: false })
      .then(({ data, error }) => {
        setLoading(false)
        if (error) { setErro('Não foi possível carregar os fechamentos.'); return }
        setDados((data as FechamentoResumo[]) ?? [])
      })
  }, [])

  useEffect(() => { load() }, [load])

  const abrirDetalhe = async (id: string) => {
    const { data } = await supabase
      .from('cash_closings')
      .select('*')
      .eq('id', id)
      .single()
    if (data) setDetalhe(data as Fechamento)
  }

  const filtrados = dados.filter(r => {
    const d = formatData(r.data_fechamento)
    return (busca === '' || d.includes(busca)) && (filtro === 'TODOS' || r.status === filtro)
  })

  const totalCaixa   = filtrados.reduce((s, r) => s + r.total_caixa,    0)
  const totalSistema = filtrados.reduce((s, r) => s + r.total_sistema,  0)
  const totalDif     = filtrados.reduce((s, r) => s + r.diferenca_final, 0)

  return (
    <>
      <div className="space-y-5 max-w-5xl mx-auto">

        {/* Título */}
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Histórico</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {loading ? 'Carregando...' : `${dados.length} fechamento${dados.length !== 1 ? 's' : ''} registrado${dados.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" /></svg>
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por data  ex: 21/05/2025..."
              className="w-full h-10 pl-9 pr-9 rounded-xl text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
            />
            {busca && <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>}
          </div>
          <div className="flex items-center overflow-x-auto gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 shrink-0">
            {FILTROS.map(f => (
              <button key={f.value} onClick={() => setFiltro(f.value)}
                className={`px-3 h-8 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${filtro === f.value ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={loading}
            className="inline-flex items-center gap-2 px-3 h-10 rounded-xl text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-all shrink-0">
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
            Atualizar
          </button>
        </div>

        {/* Erro */}
        {erro && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-sm text-red-600 dark:text-red-400">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
            {erro}
            <button onClick={load} className="ml-auto text-xs underline">Tentar novamente</button>
          </div>
        )}

        {/* Tabela desktop */}
        <div className="hidden sm:block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                {['Data','Total Caixa','Total Sistema','Diferença','Indicadores','Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-zinc-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {loading
                ? Array.from({length:5}).map((_,i) => <tr key={i}>{Array.from({length:6}).map((_,j) => <td key={j} className="px-4 py-3.5"><Skeleton className="h-4 w-full" /></td>)}</tr>)
                : filtrados.length === 0
                ? <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-400">Nenhum fechamento encontrado</td></tr>
                : filtrados.map(r => (
                    <tr key={r.id} onClick={() => abrirDetalhe(r.id)}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors">
                      <td className="px-4 py-3.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">{formatData(r.data_fechamento)}</td>
                      <td className="px-4 py-3.5 text-sm text-zinc-600 dark:text-zinc-300 tabular-nums">{brl(r.total_caixa)}</td>
                      <td className="px-4 py-3.5 text-sm text-zinc-600 dark:text-zinc-300 tabular-nums hidden md:table-cell">{brl(r.total_sistema)}</td>
                      <td className={`px-4 py-3.5 text-sm font-semibold tabular-nums ${corDiferenca(r.diferenca_final)}`}>{brlSinal(r.diferenca_final)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex gap-1.5">
                          {r.ajuste_manual !== 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400">Ajuste</span>}
                          {r.observacoes && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500">Obs</span>}
                          {!r.ajuste_manual && !r.observacoes && <span className="text-zinc-300 dark:text-zinc-700">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5"><StatusBadge status={r.status} /></td>
                    </tr>
                  ))
              }
            </tbody>
            {!loading && filtrados.length > 1 && (
              <tfoot>
                <tr className="border-t-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                  <td className="px-4 py-3 text-xs font-semibold text-zinc-400">{filtrados.length} registros</td>
                  <td className="px-4 py-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">{brl(totalCaixa)}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums hidden md:table-cell">{brl(totalSistema)}</td>
                  <td className={`px-4 py-3 text-xs font-semibold tabular-nums ${corDiferenca(totalDif)}`}>{brlSinal(totalDif)}</td>
                  <td className="hidden sm:table-cell" /><td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Cards mobile */}
        <div className="sm:hidden space-y-3">
          {loading
            ? Array.from({length:3}).map((_,i) => (
                <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between"><Skeleton className="w-24 h-4" /><Skeleton className="w-16 h-5 rounded-full" /></div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800"><Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
                </div>
              ))
            : filtrados.map(r => (
                <div key={r.id} onClick={() => abrirDetalhe(r.id)}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{formatData(r.data_fechamento)}</p>
                      <div className="flex gap-1 mt-1">
                        {r.ajuste_manual !== 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400">Ajuste</span>}
                        {r.observacoes && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500">Obs</span>}
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    <div><p className="text-[10px] text-zinc-400 mb-0.5">Caixa</p><p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">{brl(r.total_caixa)}</p></div>
                    <div><p className="text-[10px] text-zinc-400 mb-0.5">Sistema</p><p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">{brl(r.total_sistema)}</p></div>
                    <div><p className="text-[10px] text-zinc-400 mb-0.5">Dif.</p><p className={`text-xs font-bold tabular-nums ${corDiferenca(r.diferenca_final)}`}>{brlSinal(r.diferenca_final)}</p></div>
                  </div>
                </div>
              ))
          }
        </div>
      </div>

      {/* Modal */}
      {detalhe && <ModalDetalhes f={detalhe} onClose={() => setDetalhe(null)} />}
    </>
  )
}