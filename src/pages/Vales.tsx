import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileDown,
  History,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  RotateCcw,
  Sheet,
  Trash2,
} from 'lucide-react'
import {
  buscarFechamentoDoMes,
  excluirVale,
  fecharMesVales,
  listarHistoricoDoMes,
  listarValesDoMes,
  mensagemDeErro,
  reabrirMesVales,
  restaurarVale,
} from '../lib/valeService'
import { formatarMoeda } from '../lib/calculations'
import type { GrupoValesPdf } from '../lib/pdf'
import { carregarPdf } from '../lib/pdfSobDemanda'
import { baixarArquivo } from '../lib/arquivos'
import AbasPessoal from '../components/AbasPessoal'
import { mesLocal } from '../lib/datas'
import {
  agruparPorFuncionario,
  descreverHistorico,
  gerarCsvVales,
  mesValido,
  nomeMes,
  paraCentavos,
  rotuloMes,
  somarMeses,
  totalDosGrupos,
  type GrupoFuncionario,
} from '../lib/vales'
import type { HistoricoVale, MesValesFechado, Vale } from '../types/fechamento'

function formatarDia(iso: string): string {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function paraPdf(grupos: GrupoFuncionario[]): GrupoValesPdf[] {
  return grupos.map((g) => ({
    funcionario: g.funcionario,
    total: g.total,
    quantidade: g.quantidade,
    vales: g.vales.map((v) => ({ data: v.data, valor: v.valor, observacao: v.observacao })),
  }))
}


interface DadosMes {
  mes: string
  vales: Vale[]
  fechamento: MesValesFechado | null
}

const caixa = 'rounded-2xl bg-white dark:bg-gray-900 shadow-sm'
const botaoEscuro =
  'rounded-xl bg-gray-900 dark:bg-gray-700 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40'
const botaoClaro =
  'rounded-xl bg-gray-100 dark:bg-gray-800 px-3.5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-40'
const campoTexto =
  'w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-400'

export default function Vales() {
  const [searchParams, setSearchParams] = useSearchParams()
  const mesUrl = searchParams.get('mes')
  const mes = mesUrl && mesValido(mesUrl) ? mesUrl : mesLocal()

  const [dados, setDados] = useState<DadosMes | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  const [excluindo, setExcluindo] = useState<{ id: string; motivo: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [painelFechar, setPainelFechar] = useState(false)
  const [obsFechamento, setObsFechamento] = useState('')
  const [painelReabrir, setPainelReabrir] = useState(false)
  const [motivoReabrir, setMotivoReabrir] = useState('')
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false)
  const [historico, setHistorico] = useState<{ mes: string; itens: HistoricoVale[] } | null>(null)
  const [mostrarHistorico, setMostrarHistorico] = useState(false)

  // Só a última busca pode mexer na tela (evita mostrar vales de outro mês
  // quando a pessoa troca de mês rápido ou uma resposta chega atrasada).
  const ultimaBusca = useRef(0)

  const carregar = useCallback(async (mesAlvo: string) => {
    const minhaBusca = ++ultimaBusca.current
    setCarregando(true)
    setErro(null)
    try {
      const [vales, fechamento] = await Promise.all([listarValesDoMes(mesAlvo), buscarFechamentoDoMes(mesAlvo)])
      if (minhaBusca !== ultimaBusca.current) return
      setDados({ mes: mesAlvo, vales, fechamento })
    } catch (e) {
      if (minhaBusca !== ultimaBusca.current) return
      setDados(null) // nunca deixa na tela dados de outro mês
      setErro(mensagemDeErro(e, 'Erro ao carregar vales.'))
    } finally {
      if (minhaBusca === ultimaBusca.current) setCarregando(false)
    }
  }, [])

  const carregarHistorico = useCallback(async (mesAlvo: string) => {
    try {
      const itens = await listarHistoricoDoMes(mesAlvo)
      setHistorico({ mes: mesAlvo, itens })
    } catch (e) {
      setHistorico({ mes: mesAlvo, itens: [] })
      setAviso(mensagemDeErro(e, 'Erro ao carregar o histórico.'))
    }
  }, [])

  useEffect(() => {
    carregar(mes)
  }, [mes, carregar])

  useEffect(() => {
    if (mostrarHistorico) carregarHistorico(mes)
  }, [mostrarHistorico, mes, carregarHistorico])

  /** Depois de mudar algo: recarrega o histórico se estiver aberto, senão descarta. */
  function atualizarHistorico() {
    if (mostrarHistorico) carregarHistorico(mes)
    else setHistorico(null)
  }

  function trocarMes(novo: string) {
    if (!mesValido(novo)) return
    setExcluindo(null)
    setPainelFechar(false)
    setPainelReabrir(false)
    setAviso(null)
    setSearchParams({ mes: novo }, { replace: true })
  }

  // Dados só valem se forem do mês que está na tela
  const dadosDoMes = dados && dados.mes === mes ? dados : null
  const vales = useMemo(() => dadosDoMes?.vales ?? [], [dadosDoMes])
  const fechamento = dadosDoMes?.fechamento ?? null
  const fechado = Boolean(fechamento)

  const grupos = useMemo(() => agruparPorFuncionario(vales), [vales])
  const excluidos = useMemo(() => vales.filter((v) => v.excluidoEm), [vales])
  const totalGeral = totalDosGrupos(grupos)
  const quantidadeAtivos = vales.length - excluidos.length

  // Conferência: o que foi gravado no fechamento bate com os vales de agora?
  const divergencias = useMemo(() => {
    if (!fechamento) return []
    const atuais = new Map(grupos.map((g) => [g.funcionarioId ?? g.chave, g]))
    const problemas: string[] = []
    for (const r of fechamento.resumo) {
      const g = atuais.get(r.funcionarioId ?? '')
      if (!g || paraCentavos(g.total) !== paraCentavos(r.total)) {
        problemas.push(`${r.funcionario}: fechado com ${formatarMoeda(r.total)}, hoje ${formatarMoeda(g?.total ?? 0)}`)
      }
      atuais.delete(r.funcionarioId ?? '')
    }
    for (const g of atuais.values()) {
      problemas.push(`${g.funcionario}: não estava no fechamento, hoje ${formatarMoeda(g.total)}`)
    }
    return problemas
  }, [fechamento, grupos])

  function substituirVale(atualizado: Vale) {
    setDados((d) => (d ? { ...d, vales: d.vales.map((v) => (v.id === atualizado.id ? atualizado : v)) } : d))
  }

  function alternar(chave: string) {
    setAbertos((prev) => {
      const novo = new Set(prev)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })
  }

  async function confirmarExclusao() {
    if (!excluindo || ocupado) return
    if (!excluindo.motivo.trim()) {
      setAviso('Escreva o motivo da exclusão (ex.: lançado em dobro, valor errado).')
      return
    }
    setOcupado(true)
    setAviso(null)
    try {
      substituirVale(await excluirVale(excluindo.id, excluindo.motivo))
      setExcluindo(null)
      atualizarHistorico()
    } catch (e) {
      setAviso(mensagemDeErro(e, 'Erro ao excluir vale.'))
      carregar(mes)
    } finally {
      setOcupado(false)
    }
  }

  async function restaurar(v: Vale) {
    if (ocupado) return
    setOcupado(true)
    setAviso(null)
    try {
      substituirVale(await restaurarVale(v.id))
      atualizarHistorico()
    } catch (e) {
      setAviso(mensagemDeErro(e, 'Erro ao restaurar vale.'))
      carregar(mes)
    } finally {
      setOcupado(false)
    }
  }

  async function fecharMes() {
    if (ocupado) return
    setOcupado(true)
    setAviso(null)
    try {
      const f = await fecharMesVales(mes, obsFechamento)
      setDados((d) => (d && d.mes === mes ? { ...d, fechamento: f } : d))
      setPainelFechar(false)
      setObsFechamento('')
      atualizarHistorico()
      carregar(mes) // confere de novo com o banco
    } catch (e) {
      setAviso(mensagemDeErro(e, 'Erro ao fechar o mês.'))
    } finally {
      setOcupado(false)
    }
  }

  async function reabrirMes() {
    if (ocupado) return
    if (!motivoReabrir.trim()) {
      setAviso('Escreva o motivo para reabrir o mês.')
      return
    }
    setOcupado(true)
    setAviso(null)
    try {
      await reabrirMesVales(mes, motivoReabrir)
      setPainelReabrir(false)
      setMotivoReabrir('')
      atualizarHistorico()
      carregar(mes)
    } catch (e) {
      setAviso(mensagemDeErro(e, 'Erro ao reabrir o mês.'))
    } finally {
      setOcupado(false)
    }
  }

  async function exportarPdf(somente?: GrupoFuncionario) {
    let pdf: Awaited<ReturnType<typeof carregarPdf>>
    try {
      pdf = await carregarPdf()
    } catch (e) {
      setAviso(mensagemDeErro(e, 'Não consegui gerar o PDF (sem internet?).'))
      return
    }
    pdf.gerarPdfValesMensal({
      mes,
      grupos: paraPdf(somente ? [somente] : grupos),
      fechadoEm: fechamento?.fechadoEm ?? null,
      somenteExtratos: Boolean(somente),
    })
  }

  function exportarCsv() {
    baixarArquivo(gerarCsvVales(mes, vales), `vales_${mes}.csv`, 'text/csv;charset=utf-8')
  }

  const historicoDoMes = historico && historico.mes === mes ? historico.itens : null

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-24">
      <AbasPessoal mes={mes} />
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Vales</h1>
        {fechado ? (
          <span className="flex items-center gap-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 px-3.5 py-2 text-sm font-medium text-gray-400">
            <Lock size={14} /> Mês fechado
          </span>
        ) : (
          <Link to={`/vales/novo?mes=${mes}`} className={`flex items-center gap-1.5 ${botaoEscuro}`}>
            <Plus size={16} /> Novo vale
          </Link>
        )}
      </header>

      {/* Mês */}
      <section className={`${caixa} p-3 flex items-center gap-2`}>
        <button
          type="button"
          onClick={() => trocarMes(somarMeses(mes, -1))}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <label className="flex-1 flex flex-col items-center">
          <span className="sr-only">Mês</span>
          <input
            type="month"
            className="w-full max-w-[12rem] text-center rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-400"
            value={mes}
            onChange={(e) => trocarMes(e.target.value)}
          />
          <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {nomeMes(mes).charAt(0).toUpperCase() + nomeMes(mes).slice(1)}
          </span>
        </label>
        <button
          type="button"
          onClick={() => trocarMes(somarMeses(mes, 1))}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Próximo mês"
        >
          <ChevronRight size={18} />
        </button>
      </section>

      {erro && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-400 space-y-2">
          <p>{erro}</p>
          <button type="button" onClick={() => carregar(mes)} className="font-semibold underline">
            Tentar de novo
          </button>
        </div>
      )}
      {aviso && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex justify-between gap-2">
          <span>{aviso}</span>
          <button type="button" onClick={() => setAviso(null)} className="shrink-0 font-semibold" aria-label="Fechar aviso">
            ✕
          </button>
        </div>
      )}
      {carregando && !dadosDoMes && <p className="text-sm text-gray-400 dark:text-gray-500">Carregando...</p>}

      {dadosDoMes && (
        <>
          {/* Total do mês */}
          <div className="rounded-2xl bg-gray-900 dark:bg-gray-800 text-white p-4 space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-gray-400">Total a descontar em {rotuloMes(mes)}</p>
                <p className="text-2xl font-bold tabular-nums">{formatarMoeda(totalGeral)}</p>
              </div>
              <p className="text-xs text-gray-400 text-right">
                {quantidadeAtivos} vale(s) · {grupos.length} funcionário(s)
                {carregando && <span className="block">atualizando...</span>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={grupos.length === 0}
                onClick={() => exportarPdf()}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                <FileDown size={14} /> PDF com assinaturas
              </button>
              <button
                type="button"
                disabled={grupos.length === 0}
                onClick={exportarCsv}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                <Sheet size={14} /> Planilha
              </button>
            </div>
          </div>

          {/* Situação do mês: aberto / fechado */}
          <section className={`${caixa} p-4 space-y-3`}>
            {fechamento ? (
              <>
                <div className="flex items-start gap-2">
                  <Lock size={16} className="mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      Mês fechado em {formatarDataHora(fechamento.fechadoEm)}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400">
                      Total fechado: {formatarMoeda(fechamento.total)} em {fechamento.quantidade} vale(s). Os vales deste
                      mês estão travados.
                    </p>
                    {fechamento.observacao && (
                      <p className="text-gray-500 dark:text-gray-400">Obs.: {fechamento.observacao}</p>
                    )}
                  </div>
                </div>
                {divergencias.length > 0 && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-400 space-y-1">
                    <p className="font-semibold flex items-center gap-1">
                      <AlertTriangle size={14} /> Os valores de hoje não batem com o fechamento:
                    </p>
                    {divergencias.map((d) => (
                      <p key={d}>{d}</p>
                    ))}
                  </div>
                )}
                {!painelReabrir ? (
                  <button
                    type="button"
                    onClick={() => setPainelReabrir(true)}
                    className={`flex items-center gap-1.5 ${botaoClaro}`}
                  >
                    <LockOpen size={14} /> Reabrir mês
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Reabrir libera lançar, editar e excluir vales deste mês. Fica registrado no histórico.
                    </p>
                    <input
                      autoFocus
                      type="text"
                      maxLength={300}
                      placeholder="Motivo (obrigatório). Ex: faltou lançar um vale"
                      className={campoTexto}
                      value={motivoReabrir}
                      onChange={(e) => setMotivoReabrir(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setPainelReabrir(false)} className={`flex-1 ${botaoClaro}`}>
                        Cancelar
                      </button>
                      <button type="button" disabled={ocupado} onClick={reabrirMes} className={`flex-1 ${botaoEscuro}`}>
                        Reabrir
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-start gap-2">
                  <LockOpen size={16} className="mt-0.5 text-gray-400 shrink-0" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Mês em aberto. Depois de descontar os vales na folha, feche o mês para travar os valores.
                  </p>
                </div>
                {!painelFechar ? (
                  <button
                    type="button"
                    disabled={quantidadeAtivos === 0}
                    onClick={() => setPainelFechar(true)}
                    className={`flex items-center gap-1.5 ${botaoClaro}`}
                  >
                    <Lock size={14} /> Fechar mês
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-sm space-y-1">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        Confira antes de fechar {rotuloMes(mes)}:
                      </p>
                      {grupos.map((g) => (
                        <div key={g.chave} className="flex justify-between text-gray-600 dark:text-gray-300">
                          <span>{g.funcionario}</span>
                          <span className="tabular-nums">{formatarMoeda(g.total)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-1">
                        <span>Total</span>
                        <span className="tabular-nums">{formatarMoeda(totalGeral)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Depois de fechado, ninguém consegue lançar, editar ou excluir vales deste mês (dá para reabrir,
                      com motivo).
                    </p>
                    <input
                      type="text"
                      maxLength={300}
                      placeholder="Observação (opcional). Ex: descontado na folha de 05/11"
                      className={campoTexto}
                      value={obsFechamento}
                      onChange={(e) => setObsFechamento(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setPainelFechar(false)} className={`flex-1 ${botaoClaro}`}>
                        Cancelar
                      </button>
                      <button type="button" disabled={ocupado} onClick={fecharMes} className={`flex-1 ${botaoEscuro}`}>
                        {ocupado ? 'Fechando...' : 'Fechar mês'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {grupos.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum vale registrado em {rotuloMes(mes)}.</p>
          )}

          {/* Por funcionário */}
          <div className="space-y-2">
            {grupos.map((g) => {
              const aberto = abertos.has(g.chave)
              return (
                <section key={g.chave} className={`${caixa} overflow-hidden`}>
                  <button
                    type="button"
                    onClick={() => alternar(g.chave)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                    aria-expanded={aberto}
                  >
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{g.funcionario}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{g.quantidade} vale(s)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatarMoeda(g.total)}</span>
                      <ChevronDown
                        size={18}
                        className={`text-gray-400 dark:text-gray-500 transition-transform ${aberto ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </button>

                  {aberto && (
                    <div className="px-4 pb-3 border-t border-gray-100 dark:border-gray-800 pt-2">
                      {g.vales.map((v) => (
                        <div key={v.id} className="py-1.5">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="w-12 shrink-0 text-gray-500 dark:text-gray-400 tabular-nums">
                              {formatarDia(v.data)}
                            </span>
                            <span className="flex-1 min-w-0 truncate text-gray-400 dark:text-gray-500 text-xs">
                              {v.observacao || ''}
                            </span>
                            <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">
                              {formatarMoeda(v.valor)}
                            </span>
                            {!fechado && (
                              <>
                                <Link
                                  to={`/vales/${v.id}/editar?mes=${mes}`}
                                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                  aria-label={`Editar vale de ${formatarMoeda(v.valor)} de ${g.funcionario}`}
                                >
                                  <Pencil size={15} />
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAviso(null)
                                    setExcluindo(excluindo?.id === v.id ? null : { id: v.id, motivo: '' })
                                  }}
                                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500"
                                  aria-label={`Excluir vale de ${formatarMoeda(v.valor)} de ${g.funcionario}`}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                          {excluindo?.id === v.id && (
                            <div className="mt-2 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 space-y-2">
                              <p className="text-xs text-red-700 dark:text-red-400">
                                Excluir o vale de {formatarMoeda(v.valor)} de {g.funcionario} ({formatarDia(v.data)})? Ele
                                sai do total, mas fica guardado e pode ser restaurado.
                              </p>
                              <input
                                autoFocus
                                type="text"
                                maxLength={300}
                                placeholder="Motivo (obrigatório). Ex: lançado em dobro"
                                className={campoTexto}
                                value={excluindo.motivo}
                                onChange={(e) => setExcluindo({ id: v.id, motivo: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') confirmarExclusao()
                                }}
                              />
                              <div className="flex gap-2">
                                <button type="button" onClick={() => setExcluindo(null)} className={`flex-1 ${botaoClaro}`}>
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  disabled={ocupado}
                                  onClick={confirmarExclusao}
                                  className="flex-1 rounded-xl bg-red-600 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"
                                >
                                  Excluir
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => exportarPdf(g)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                        >
                          <FileDown size={14} /> Extrato de {g.funcionario} (PDF)
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )
            })}
          </div>

          {/* Excluídos */}
          {excluidos.length > 0 && (
            <section className={`${caixa} overflow-hidden`}>
              <button
                type="button"
                onClick={() => setMostrarExcluidos((m) => !m)}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-sm text-gray-500 dark:text-gray-400"
                aria-expanded={mostrarExcluidos}
              >
                <span>Vales excluídos neste mês ({excluidos.length})</span>
                <ChevronDown size={16} className={`transition-transform ${mostrarExcluidos ? 'rotate-180' : ''}`} />
              </button>
              {mostrarExcluidos && (
                <div className="px-4 pb-3 border-t border-gray-100 dark:border-gray-800 pt-2 space-y-2">
                  {excluidos.map((v) => (
                    <div key={v.id} className="flex items-center gap-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-500 dark:text-gray-400 line-through">
                          {formatarDia(v.data)} · {v.funcionario} · {formatarMoeda(v.valor)}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                          Motivo: {v.motivoExclusao ?? '-'}
                          {v.excluidoEm ? ` · ${formatarDataHora(v.excluidoEm)}` : ''}
                        </p>
                      </div>
                      {!fechado && (
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => restaurar(v)}
                          className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-40"
                        >
                          <RotateCcw size={13} /> Restaurar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Histórico */}
          <section className={`${caixa} overflow-hidden`}>
            <button
              type="button"
              onClick={() => setMostrarHistorico((m) => !m)}
              className="w-full flex items-center justify-between px-4 py-3 text-left text-sm text-gray-500 dark:text-gray-400"
              aria-expanded={mostrarHistorico}
            >
              <span className="flex items-center gap-1.5">
                <History size={15} /> Histórico de alterações
              </span>
              <ChevronDown size={16} className={`transition-transform ${mostrarHistorico ? 'rotate-180' : ''}`} />
            </button>
            {mostrarHistorico && (
              <div className="px-4 pb-3 border-t border-gray-100 dark:border-gray-800 pt-2 space-y-2">
                {!historicoDoMes && <p className="text-xs text-gray-400">Carregando...</p>}
                {historicoDoMes?.length === 0 && (
                  <p className="text-xs text-gray-400">Nenhuma alteração registrada neste mês.</p>
                )}
                {historicoDoMes?.map((h) => {
                  const { titulo, descricao } = descreverHistorico(h)
                  return (
                    <div key={h.id} className="text-xs">
                      <p className="text-gray-700 dark:text-gray-300">
                        <span className="font-semibold">{titulo}</span>
                        <span className="text-gray-400"> · {formatarDataHora(h.registradoEm)}</span>
                      </p>
                      <p className="text-gray-500 dark:text-gray-400">{descricao}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

