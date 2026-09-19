import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { buscarFechamentoPorId } from '../lib/fechamentoService'
import { formatarMoeda, STATUS_COLOR, STATUS_LABEL } from '../lib/calculations'
import { gerarPdfFechamento } from '../lib/pdf'
import type { Fechamento } from '../types/fechamento'

const TURNO_LABEL: Record<'manha' | 'noite', string> = { manha: 'Manhã', noite: 'Noite' }

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export default function FechamentoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const [f, setF] = useState<Fechamento | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    buscarFechamentoPorId(id)
      .then(setF)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar fechamento.'))
  }, [id])

  if (erro) {
    return <div className="max-w-2xl mx-auto p-4 text-sm text-red-600">{erro}</div>
  }
  if (!f) {
    return <div className="max-w-2xl mx-auto p-4 text-sm text-gray-400 dark:text-gray-500">Carregando...</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <Link to="/historico" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
        ← Voltar ao histórico
      </Link>

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatarData(f.data)} — {TURNO_LABEL[f.turno]}
          </h1>
        </div>
        <span className={`text-xs font-semibold rounded-full border px-2.5 py-1 shrink-0 ${STATUS_COLOR[f.resultado.status]}`}>
          {STATUS_LABEL[f.resultado.status]}
        </span>
      </header>

      <Secao titulo="LC">
        <Linha label="Dinheiro abertura" valor={f.lc.dinheiroAbertura} />
        <Linha label="Dinheiro fechamento" valor={f.lc.dinheiroFechamento} />
        <Linha label="PIX" valor={f.lc.pix} />
        <Linha label="Débito" valor={f.lc.debito} />
        <Linha label="Crédito" valor={f.lc.credito} />
        <Linha label="Consumo loja" valor={f.lc.consumoLoja} />
        <Linha label="A prazo" valor={f.lc.aPrazo} />
        <Linha label="Ticket" valor={f.lc.ticket} />
        <Linha label="Total LC" valor={f.resultado.totalLC} destaque />
      </Secao>

      {f.sangrias.length > 0 && (
        <Secao titulo="Sangrias">
          {f.sangrias.map((s, i) => (
            <div key={s.id ?? i} className="flex justify-between text-sm py-1">
              <span className="text-gray-600 dark:text-gray-300">{s.motivo}</span>
              <span className="text-gray-900 dark:text-gray-100">{formatarMoeda(s.valor)}</span>
            </div>
          ))}
        </Secao>
      )}

      <Secao titulo="Brendi">
        <Linha label="PIX" valor={f.brendi.pix} />
        <Linha label="Débito" valor={f.brendi.debito} />
        <Linha label="Crédito" valor={f.brendi.credito} />
        <Linha label="Crédito Online" valor={f.brendi.creditoOnline} />
        <Linha label="Dinheiro" valor={f.brendi.dinheiro} />
        <Linha label="Total Brendi" valor={f.resultado.totalBrendi} destaque />
      </Secao>

      <Secao titulo="Resultado">
        <Linha label="Total Caixa" valor={f.resultado.totalCaixa} destaque />
        <div className="flex justify-between text-sm py-1">
          <span className="text-gray-500 dark:text-gray-400">Marmitas vendidas</span>
          <span className="text-gray-700 dark:text-gray-300">{f.marmitasVendidas}</span>
        </div>
        <Linha label="Total LC Sistema" valor={f.totalLCSistema} />
        <Linha label="Total Sistema" valor={f.resultado.totalSistema} destaque />
        <Linha label="Diferença original" valor={f.resultado.diferencaOriginal} />
        {f.ajuste.tipo && (
          <Linha
            label={`Ajuste (${f.ajuste.tipo === 'adicionar' ? 'adicionado' : 'removido'})`}
            valor={f.resultado.ajusteAplicado}
          />
        )}
        <Linha label="Diferença final" valor={f.resultado.diferencaFinal} destaque />
        {f.observacoes && (
          <div className="pt-2 text-sm">
            <p className="text-gray-400 dark:text-gray-500 text-xs">Observações</p>
            <p className="text-gray-700 dark:text-gray-300">{f.observacoes}</p>
          </div>
        )}
      </Secao>

      <button
        type="button"
        onClick={() => gerarPdfFechamento(f)}
        className="w-full rounded-xl bg-gray-900 dark:bg-gray-700 py-3 text-white text-sm font-semibold"
      >
        PDF para impressão
      </button>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-1">
      <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">{titulo}</h2>
      {children}
    </section>
  )
}

function Linha({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={destaque ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}>
        {formatarMoeda(valor)}
      </span>
    </div>
  )
}
