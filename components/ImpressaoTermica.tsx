'use client'

import { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import type { FechamentoDetalhe } from '@/components/ModalDetalhes'

// ─── Props ────────────────────────────────────────────────────
interface ImpressaoTermicaProps {
  fechamento: FechamentoDetalhe
}

// ─── Utilitários ──────────────────────────────────────────────
const COLS = 32 // largura em caracteres para 58mm

function brl(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

function formatData(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatDataHora(iso: string): string {
  const dt = new Date(iso)
  return dt.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Linha label + valor alinhados nas extremidades */
function pad(label: string, value: string): string {
  const maxLabel = COLS - value.length - 1
  const l = label.length > maxLabel ? label.slice(0, maxLabel - 1) + '.' : label
  const spaces = COLS - l.length - value.length
  return l + ' '.repeat(Math.max(1, spaces)) + value
}

/** Linha centralizada */
function center(text: string): string {
  const spaces = Math.max(0, Math.floor((COLS - text.length) / 2))
  return ' '.repeat(spaces) + text
}

/** Linha separadora */
const SEP  = '-'.repeat(COLS)
const SEP2 = '='.repeat(COLS)

// ─── Componente do cupom (imprimível) ────────────────────────
function Cupom({ f }: { f: FechamentoDetalhe }) {
  const difFinal = f.diferenca_final
  const statusLabel =
    difFinal === 0 ? '*** CAIXA FECHOU ***' :
    difFinal > 0   ? '>>> SOBROU DINHEIRO' :
                     '<<< FALTOU DINHEIRO'

  return (
    <div className="cupom">
      {/* ── Cabeçalho ────────────────────────────── */}
      <p className="c">{center('MAPA BURGER')}</p>
      <p className="c">{center('FECHAMENTO DE CAIXA')}</p>
      <p className="sep">{SEP2}</p>
      <p>{center(formatData(f.data_fechamento))}</p>
      <p className="s">{center(formatDataHora(f.created_at))}</p>
      <p className="sep">{SEP}</p>

      {/* ── LC ───────────────────────────────────── */}
      <p className="sec">{center('[ CAIXA LC ]')}</p>
      <p className="sep">{SEP}</p>
      <p>{pad('Din. Abertura', brl(f.dinheiro_abertura_lc))}</p>
      <p className="sep">{'- '.repeat(COLS / 2)}</p>
      <p>{pad('Dinheiro/Fech.', brl(f.dinheiro_fechamento_lc))}</p>
      <p>{pad('PIX', brl(f.pix_lc))}</p>
      <p>{pad('Debito', brl(f.debito_lc))}</p>
      <p>{pad('Credito', brl(f.credito_lc))}</p>
      <p>{pad('Consumo Loja', brl(f.consumo_loja_lc))}</p>
      <p>{pad('A Prazo', brl(f.a_prazo_lc))}</p>
      <p>{pad('Ticket', brl(f.ticket_lc))}</p>
      <p className="sep">{'- '.repeat(COLS / 2)}</p>
      <p>{pad('Sangria (ref.)', brl(f.sangria_lc))}</p>
      <p className="sep">{SEP}</p>
      <p className="total">{pad('TOTAL LC', brl(f.total_lc))}</p>
      <p className="sep">{SEP}</p>

      {/* ── Brandy ───────────────────────────────── */}
      <p className="sec">{center('[ CAIXA BRANDY ]')}</p>
      <p className="sep">{SEP}</p>
      <p>{pad('PIX', brl(f.pix_brandy))}</p>
      <p>{pad('Debito', brl(f.debito_brandy))}</p>
      <p>{pad('Credito', brl(f.credito_brandy))}</p>
      <p>{pad('Credito Online', brl(f.credito_online_brandy))}</p>
      <p className="sep">{'- '.repeat(COLS / 2)}</p>
      <p>{pad('Dinheiro (ref.)', brl(f.dinheiro_brandy))}</p>
      <p className="sep">{SEP}</p>
      <p className="total">{pad('TOTAL BRANDY', brl(f.total_brandy))}</p>
      <p className="sep">{SEP}</p>

      {/* ── Resultados ───────────────────────────── */}
      <p className="sec">{center('[ RESULTADO ]')}</p>
      <p className="sep">{SEP}</p>
      <p>{pad('Total Caixa', brl(f.total_caixa))}</p>
      <p>{pad('Total LC Sistema', brl(f.total_lc_sistema))}</p>
      <p>{pad('Total Sistema', brl(f.total_sistema))}</p>
      <p className="sep">{'- '.repeat(COLS / 2)}</p>
      <p>{pad('Diferenca Orig.', (f.diferenca >= 0 ? '+' : '') + brl(f.diferenca))}</p>
      <p>{pad('Ajuste Manual', (f.ajuste_manual >= 0 ? '+' : '') + brl(f.ajuste_manual))}</p>
      <p className="sep">{SEP}</p>
      <p className="total">{pad('DIFERENCA FINAL', (difFinal >= 0 ? '+' : '') + brl(difFinal))}</p>
      <p className="sep">{SEP2}</p>

      {/* ── Status ───────────────────────────────── */}
      <p className="status">{center(statusLabel)}</p>
      <p className="sep">{SEP2}</p>

      {/* ── Observações ──────────────────────────── */}
      {f.observacoes && (
        <>
          <p className="sec">{center('[ OBSERVACOES ]')}</p>
          <p className="sep">{SEP}</p>
          <p className="obs">{f.observacoes}</p>
          <p className="sep">{SEP}</p>
        </>
      )}

      {/* ── Rodapé ───────────────────────────────── */}
      <p className="s">{center(formatDataHora(f.created_at))}</p>
      <p className="s">{center('ID: ' + f.id.slice(0, 16) + '...')}</p>
      <p className="sep">{SEP}</p>
      <p className="c">{center('* * *')}</p>
      <br />
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────
export default function ImpressaoTermica({ fechamento }: ImpressaoTermicaProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Fechamento_${fechamento.data_fechamento}`,
    pageStyle: `
      @page {
        size: 58mm auto;
        margin: 0;
      }
      @media print {
        html, body {
          width: 58mm;
          margin: 0;
          padding: 0;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .no-print {
          display: none !important;
        }
      }
    `,
  })

  return (
    <>
      {/* ── CSS do cupom ─────────────────────────────────── */}
      <style>{`
        .cupom {
          font-family: 'Courier New', Courier, monospace;
          font-size: 9.5px;
          line-height: 1.45;
          color: #000;
          background: #fff;
          width: 52mm;
          padding: 3mm 3mm 2mm;
          white-space: pre;
          word-break: break-all;
        }
        .cupom p {
          margin: 0;
          padding: 0;
          display: block;
        }
        .cupom .sep  { color: #000; opacity: 0.5; }
        .cupom .c    { font-weight: bold; }
        .cupom .sec  { font-weight: bold; letter-spacing: 0.5px; }
        .cupom .total{ font-weight: bold; font-size: 10px; }
        .cupom .status{
          font-weight: bold;
          font-size: 10.5px;
          letter-spacing: 0.5px;
        }
        .cupom .s    { font-size: 8px; opacity: 0.7; }
        .cupom .obs  {
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 8.5px;
        }

        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: #fff; }
          .cupom {
            width: 52mm;
            font-size: 9px;
          }
        }
      `}</style>

      {/* ── Botão imprimir ────────────────────────────────── */}
      <button
        onClick={handlePrint}
        className="
          no-print
          inline-flex items-center gap-2 px-4 h-9 rounded-lg
          text-sm font-medium
          bg-zinc-900 dark:bg-zinc-100
          text-white dark:text-zinc-900
          hover:bg-zinc-700 dark:hover:bg-zinc-300
          active:scale-[.98] transition-all
          shadow-sm
        "
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
        </svg>
        Imprimir cupom
      </button>

      {/* ── Preview do cupom (visível na tela) ────────────── */}
      <div className="no-print mt-4 overflow-x-auto">
        <div className="
          inline-block
          bg-white
          border border-zinc-200 dark:border-zinc-700
          rounded-xl
          shadow-inner
          p-3
        ">
          {/* Faixa de fita */}
          <div className="w-full h-1 bg-zinc-100 rounded-full mb-2" />
          <div ref={printRef}>
            <Cupom f={fechamento} />
          </div>
          <div className="w-full h-1 bg-zinc-100 rounded-full mt-2" />
        </div>
      </div>
    </>
  )
}