import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronDown, FileDown, FileText, History, Pencil } from 'lucide-react'
import { buscarFechamentoPorId, excluirFechamento } from '../lib/fechamentoService'
import { buscarIdRelatorioPorData } from '../lib/relatorioService'
import { listarAuditoria } from '../lib/auditoriaService'
import { mudancasFechamento, ROTULO_OPERACAO_AUDITORIA } from '../lib/auditoria'
import { formatarMoeda, STATUS_COLOR, STATUS_LABEL, totalMarmitas } from '../lib/calculations'
import { carregarPdf, DICA_PAPEL_80MM } from '../lib/pdfSobDemanda'
import { mensagemErro } from '../lib/erros'
import { diaDaSemana, formatarDataBr, formatarDataHora } from '../lib/datas'
import { somarValores } from '../lib/vales'
import { BotaoExcluir, CaixaErro } from '../components/Avisos'
import BarrasHorizontais from '../components/graficos/BarrasHorizontais'
import { formasDePagamento } from '../lib/relatorioResumo'
import type { Fechamento, RegistroAuditoria } from '../types/fechamento'

export default function FechamentoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const salvo = (location.state as { salvo?: string } | null)?.salvo

  const [f, setF] = useState<Fechamento | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [dica, setDica] = useState<string | null>(null)
  const [relatorioId, setRelatorioId] = useState<string | null | undefined>(undefined)
  const [auditoria, setAuditoria] = useState<RegistroAuditoria[] | null>(null)
  const [verAuditoria, setVerAuditoria] = useState(false)

  useEffect(() => {
    if (!id) return
    let ativo = true
    buscarFechamentoPorId(id)
      .then((fech) => {
        if (!ativo) return
        setF(fech)
        buscarIdRelatorioPorData(fech.data)
          .then((r) => ativo && setRelatorioId(r))
          .catch(() => ativo && setRelatorioId(null))
      })
      .catch((e) => ativo && setErro(mensagemErro(e, 'Erro ao carregar o fechamento.')))
    return () => {
      ativo = false
    }
  }, [id])

  useEffect(() => {
    if (!verAuditoria || !id || auditoria) return
    listarAuditoria('fechamentos', id)
      .then(setAuditoria)
      .catch(() => setAuditoria([]))
  }, [verAuditoria, id, auditoria])

  async function baixarPdf() {
    if (!f) return
    setAviso(null)
    try {
      const pdf = await carregarPdf()
      pdf.gerarPdfFechamento(f)
      setDica(DICA_PAPEL_80MM)
    } catch (e) {
      setAviso(mensagemErro(e, 'Não consegui gerar o PDF.'))
    }
  }

  if (erro) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-3">
        <Link to="/historico" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
          ← Voltar ao histórico
        </Link>
        <CaixaErro>{erro}</CaixaErro>
      </div>
    )
  }
  if (!f) return <div className="max-w-2xl mx-auto p-4 text-sm text-gray-400 dark:text-gray-500">Carregando...</div>

  const totalSangrias = somarValores(f.sangrias.map((s) => s.valor))
  const corDiferenca =
    f.resultado.status === 'fechou'
      ? 'text-green-600 dark:text-green-400'
      : f.resultado.status === 'sobrou'
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-red-600 dark:text-red-400'

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-24">
      <Link to="/historico" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
        ← Voltar ao histórico
      </Link>

      {salvo && (
        <div role="status" className="flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-950/40 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 size={16} className="shrink-0" /> {salvo}
        </div>
      )}

      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatarDataBr(f.data)}</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500">{diaDaSemana(f.data)}</p>
        </div>
        <span className={`text-xs font-semibold rounded-full border px-2.5 py-1 shrink-0 ${STATUS_COLOR[f.resultado.status]}`}>
          {STATUS_LABEL[f.resultado.status]}
        </span>
      </header>

      {/* Resumo */}
      <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">Caixa</p>
          <p className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatarMoeda(f.resultado.totalCaixa)}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">Sistema</p>
          <p className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatarMoeda(f.resultado.totalSistema)}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">Diferença</p>
          <p className={`font-bold tabular-nums ${corDiferenca}`}>{formatarMoeda(f.resultado.diferencaFinal)}</p>
        </div>
      </section>

      {/* Ações */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={baixarPdf}
          className="flex flex-col items-center gap-1 rounded-xl bg-gray-900 dark:bg-gray-700 py-2.5 text-xs font-semibold text-white"
        >
          <FileDown size={18} /> PDF (impressão)
        </button>
        <Link
          to={`/fechamento/${f.id}/editar`}
          className="flex flex-col items-center gap-1 rounded-xl bg-white dark:bg-gray-900 shadow-sm py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300"
        >
          <Pencil size={18} /> Editar
        </Link>
        <Link
          to={relatorioId ? `/relatorios/${relatorioId}` : `/relatorios/novo?data=${f.data}`}
          className="flex flex-col items-center gap-1 rounded-xl bg-white dark:bg-gray-900 shadow-sm py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300"
        >
          <FileText size={18} /> {relatorioId ? 'Relatório do dia' : 'Criar relatório'}
        </Link>
      </div>
      {dica && (
        <p role="status" className="rounded-xl bg-blue-50 dark:bg-blue-950/40 px-3.5 py-2.5 text-xs text-blue-900 dark:text-blue-200">
          {dica}
        </p>
      )}
      {aviso && <CaixaErro>{aviso}</CaixaErro>}

      <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-2">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Como o dinheiro entrou</h2>
        <BarrasHorizontais itens={formasDePagamento([f])} porcentagem total rotuloTotal="Total do caixa" descricao="Vendas do dia por forma de pagamento" />
      </section>

      <Bloco titulo="Caixa LC">
        <Linha label="Dinheiro abertura" valor={f.lc.dinheiroAbertura} nota="não entra no total" />
        <Linha label="Dinheiro fechamento" valor={f.lc.dinheiroFechamento} />
        <Linha label="PIX" valor={f.lc.pix} />
        <Linha label="Débito" valor={f.lc.debito} />
        <Linha label="Crédito" valor={f.lc.credito} />
        <Linha label="Consumo loja" valor={f.lc.consumoLoja} />
        <Linha label="A prazo" valor={f.lc.aPrazo} />
        <Linha label="Ticket" valor={f.lc.ticket} />
        <Linha label="Total LC" valor={f.resultado.totalLC} destaque />
      </Bloco>

      {f.sangrias.length > 0 && (
        <Bloco titulo={`Sangrias · ${formatarMoeda(totalSangrias)}`}>
          {f.sangrias.map((s, i) => (
            <div key={s.id ?? i} className="flex justify-between gap-3 text-sm py-1">
              <span className="text-gray-600 dark:text-gray-300">{s.motivo || '—'}</span>
              <span className="tabular-nums text-gray-900 dark:text-gray-100">{formatarMoeda(s.valor)}</span>
            </div>
          ))}
        </Bloco>
      )}

      <Bloco titulo="Brendi">
        <Linha label="PIX" valor={f.brendi.pix} />
        <Linha label="Débito" valor={f.brendi.debito} />
        <Linha label="Crédito" valor={f.brendi.credito} />
        <Linha label="Crédito Online" valor={f.brendi.creditoOnline} />
        <Linha label="Dinheiro" valor={f.brendi.dinheiro} nota="só no Total Sistema" />
        <Linha label="Total Brendi" valor={f.resultado.totalBrendi} destaque />
      </Bloco>

      <Bloco titulo="Conferência">
        <Linha label="Total Caixa (LC + Brendi)" valor={f.resultado.totalCaixa} destaque />
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
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{f.observacoes}</p>
          </div>
        )}
      </Bloco>

      <Bloco titulo={`Marmitas vendidas · ${totalMarmitas(f.marmitas)}`}>
        {f.marmitas.length === 0 && <p className="text-sm text-gray-400">Nenhuma marmita registrada.</p>}
        {[...f.marmitas]
          .sort((a, b) => b.quantidade - a.quantidade)
          .map((m) => (
            <div key={m.prato} className="flex justify-between text-sm py-1">
              <span className="text-gray-600 dark:text-gray-300">{m.prato}</span>
              <span className="tabular-nums text-gray-900 dark:text-gray-100">{m.quantidade}</span>
            </div>
          ))}
      </Bloco>

      {/* Histórico de alterações */}
      <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setVerAuditoria((v) => !v)}
          aria-expanded={verAuditoria}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
        >
          <span className="flex items-center gap-1.5">
            <History size={15} /> Histórico de alterações
          </span>
          <ChevronDown size={16} className={`transition-transform ${verAuditoria ? 'rotate-180' : ''}`} />
        </button>
        {verAuditoria && (
          <div className="px-4 pb-3 border-t border-gray-100 dark:border-gray-800 pt-2 space-y-2 text-xs">
            <p className="text-gray-400">Salvo pela primeira vez em {formatarDataHora(f.createdAt)}.</p>
            {!auditoria && <p className="text-gray-400">Carregando...</p>}
            {auditoria?.length === 0 && <p className="text-gray-400">Nenhuma alteração registrada.</p>}
            {auditoria?.map((r) => {
              const mudancas = mudancasFechamento(r)
              return (
                <div key={r.id}>
                  <p className="text-gray-700 dark:text-gray-300">
                    <span className="font-semibold">{ROTULO_OPERACAO_AUDITORIA[r.operacao]}</span>
                    <span className="text-gray-400"> · {formatarDataHora(r.registradoEm)}</span>
                    {r.usuario && <span className="text-gray-400"> · {r.usuario}</span>}
                  </p>
                  {mudancas.map((m) => (
                    <p key={m} className="text-gray-500 dark:text-gray-400 pl-2">
                      {m}
                    </p>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="pt-2 flex">
        <BotaoExcluir
          rotulo="Excluir fechamento"
          descricao={`Excluir o fechamento de ${formatarDataBr(f.data)}? Ele some do histórico e dos relatórios (fica só uma cópia na auditoria).`}
          onExcluir={async () => {
            try {
              await excluirFechamento(f.id)
            } catch (e) {
              throw new Error(mensagemErro(e, 'Não foi possível excluir.'))
            }
            navigate('/historico', { replace: true })
          }}
        />
      </div>
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-0.5">
      <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">{titulo}</h2>
      {children}
    </section>
  )
}

function Linha({ label, valor, destaque, nota }: { label: string; valor: number; destaque?: boolean; nota?: string }) {
  return (
    <div className={`flex justify-between gap-3 text-sm py-1 ${destaque ? 'border-t border-gray-100 dark:border-gray-800 mt-1 pt-2' : ''}`}>
      <span className="text-gray-500 dark:text-gray-400">
        {label}
        {nota && <span className="text-[11px] text-gray-400 dark:text-gray-500"> ({nota})</span>}
      </span>
      <span className={`tabular-nums ${destaque ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
        {formatarMoeda(valor)}
      </span>
    </div>
  )
}
