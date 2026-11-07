import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Lock,
  LockOpen,
  Share2,
  Sheet,
  UserX,
} from 'lucide-react'
import AbasPessoal from '../components/AbasPessoal'
import BarrasEmpilhadas from '../components/graficos/BarrasEmpilhadas'
import { CaixaErro } from '../components/Avisos'
import { listarValesDoMes } from '../lib/valeService'
import { listarRelatorios } from '../lib/relatorioService'
import { listarFuncionarios } from '../lib/funcionarioService'
import { atribuirConsumo, buscarAcerto, fecharAcerto, reabrirAcerto } from '../lib/acertoService'
import { calcularAcerto, divergenciasAcerto, gerarCsvAcerto, type ConsumoDoMes, type LinhaAcerto } from '../lib/acerto'
import { formatarMoeda } from '../lib/calculations'
import { mensagemErro } from '../lib/erros'
import { useAtualizarAoVoltar } from '../lib/useAtualizarAoVoltar'
import { carregarPdf } from '../lib/pdfSobDemanda'
import { baixarArquivo, podeCompartilharArquivos } from '../lib/arquivos'
import { mesValido, nomeMes, rotuloMes, somarMeses } from '../lib/vales'
import { formatarDataHora, formatarDiaMes, limitesDoMes, mesLocal } from '../lib/datas'
import type { AcertoFechado, Funcionario, RelatorioDiario, Vale } from '../types/fechamento'

interface Dados {
  mes: string
  vales: Vale[]
  relatorios: RelatorioDiario[]
  funcionarios: Funcionario[]
  acerto: AcertoFechado | null
}

const caixa = 'rounded-2xl bg-white dark:bg-gray-900 shadow-sm'
const botaoEscuro = 'rounded-xl bg-gray-900 dark:bg-gray-700 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40'
const botaoClaro =
  'rounded-xl bg-gray-100 dark:bg-gray-800 px-3.5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-40'
const campo =
  'w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-500'

function paraPdf(linhas: LinhaAcerto[]) {
  return linhas.map((l) => ({
    funcionario: l.funcionario,
    totalVales: l.totalVales,
    totalConsumo: l.totalConsumo,
    total: l.total,
    vales: l.vales.map((v) => ({ data: v.data, valor: v.valor, observacao: v.observacao })),
    consumo: l.consumo.map((c) => ({ data: c.data, item: c.item, valor: c.valor })),
  }))
}

/** Linha de "consumo sem funcionário" com seletor pra corrigir. */
function CorrigirConsumo({
  consumo,
  funcionarios,
  aoCorrigir,
}: {
  consumo: ConsumoDoMes
  funcionarios: Funcionario[]
  aoCorrigir: () => void
}) {
  const [escolhido, setEscolhido] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    const f = funcionarios.find((x) => x.id === escolhido)
    if (!f) return
    setSalvando(true)
    setErro(null)
    try {
      await atribuirConsumo(consumo, f)
      aoCorrigir()
    } catch (e) {
      setErro(mensagemErro(e, 'Não consegui corrigir.'))
      setSalvando(false)
    }
  }

  return (
    <li className="py-2 space-y-1.5">
      <p className="text-sm text-gray-800 dark:text-gray-200">
        <span className="font-semibold">"{consumo.pessoa || 'sem nome'}"</span> · {consumo.item || 'consumo'} ·{' '}
        <span className="tabular-nums">{formatarMoeda(consumo.valor)}</span>{' '}
        <Link to={`/relatorios/${consumo.relatorioId}`} className="text-xs text-gray-500 underline">
          relatório de {formatarDiaMes(consumo.data)}
        </Link>
      </p>
      <div className="flex gap-2">
        <select
          aria-label={`Quem consumiu ${consumo.item}`}
          className={campo}
          value={escolhido}
          onChange={(e) => setEscolhido(e.target.value)}
        >
          <option value="">Quem foi? Escolha o funcionário</option>
          {funcionarios
            .filter((f) => f.ativo)
            .map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
        </select>
        <button type="button" disabled={!escolhido || salvando} onClick={salvar} className={`shrink-0 ${botaoEscuro}`}>
          {salvando ? '...' : 'Corrigir'}
        </button>
      </div>
      {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
    </li>
  )
}

export default function Acerto() {
  const [params, setParams] = useSearchParams()
  const mesUrl = params.get('mes')
  const mes = mesUrl && mesValido(mesUrl) ? mesUrl : mesLocal()

  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState<{ mes: string; mensagem: string } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  const [painel, setPainel] = useState<'fechar' | 'reabrir' | null>(null)
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const ultima = useRef(0)

  /** automatica = atualização ao voltar para a tela: se falhar, a tela fica como estava. */
  const carregar = useCallback(async (alvo: string, automatica = false) => {
    const minha = ++ultima.current
    const { inicio, fim } = limitesDoMes(alvo)
    try {
      const [vales, relatorios, funcionarios, acerto] = await Promise.all([
        listarValesDoMes(alvo),
        listarRelatorios({ dataInicio: inicio, dataFim: fim }),
        listarFuncionarios({ incluirInativos: true }),
        buscarAcerto(alvo),
      ])
      if (minha === ultima.current) {
        setDados({ mes: alvo, vales, relatorios, funcionarios, acerto })
        setErro(null)
      }
    } catch (e) {
      if (minha === ultima.current && !automatica) setErro({ mes: alvo, mensagem: mensagemErro(e, 'Erro ao carregar o acerto.') })
    }
  }, [])

  useEffect(() => {
    carregar(mes)
  }, [mes, carregar])

  // Vales e consumo lançados no outro aparelho aparecem ao voltar para a tela.
  useAtualizarAoVoltar(() => carregar(mes, true), 60_000)

  const atual = dados?.mes === mes ? dados : null
  const erroAtual = erro?.mes === mes ? erro.mensagem : null
  const resultado = useMemo(
    () => (atual ? calcularAcerto({ vales: atual.vales, relatorios: atual.relatorios, funcionarios: atual.funcionarios }) : null),
    [atual],
  )
  const acerto = atual?.acerto ?? null
  const divergencias = useMemo(
    () => (acerto && resultado ? divergenciasAcerto(acerto.resumo, resultado.linhas) : []),
    [acerto, resultado],
  )

  function trocarMes(novo: string) {
    if (!mesValido(novo)) return
    setPainel(null)
    setAviso(null)
    setParams({ mes: novo }, { replace: true })
  }

  function alternar(id: string) {
    setAbertos((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function executar(acao: () => Promise<void>) {
    if (ocupado) return
    setOcupado(true)
    setAviso(null)
    try {
      await acao()
      setPainel(null)
      setTexto('')
      await carregar(mes)
    } catch (e) {
      setAviso(mensagemErro(e, 'Não foi possível concluir.'))
    } finally {
      setOcupado(false)
    }
  }

  async function exportarPdf(opts: { compartilhar?: boolean; somente?: LinhaAcerto } = {}) {
    if (!resultado) return
    try {
      const pdf = await carregarPdf()
      await pdf.gerarPdfAcerto({
        mes,
        linhas: paraPdf(opts.somente ? [opts.somente] : resultado.linhas),
        fechadoEm: acerto?.fechadoEm ?? null,
        somenteExtratos: Boolean(opts.somente),
        compartilhar: opts.compartilhar,
      })
    } catch (e) {
      setAviso(mensagemErro(e, 'Não consegui gerar o PDF.'))
    }
  }

  const nome = nomeMes(mes)
  const pendentes = resultado?.semFuncionario.length ?? 0
  const podeCompartilhar = podeCompartilharArquivos()

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-24">
      <AbasPessoal mes={mes} />
      <header>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Acerto do mês</h1>
        <p className="text-xs text-gray-400 dark:text-gray-500">Vales + consumo na loja = quanto descontar do salário de cada um.</p>
      </header>

      <section className={`${caixa} p-3 flex items-center gap-2`}>
        <button type="button" onClick={() => trocarMes(somarMeses(mes, -1))} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Mês anterior">
          <ChevronLeft size={18} />
        </button>
        <label className="flex-1 flex flex-col items-center">
          <span className="sr-only">Mês</span>
          <input
            type="month"
            className="w-full max-w-[12rem] text-center rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-500"
            value={mes}
            onChange={(e) => trocarMes(e.target.value)}
          />
          <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">{nome.charAt(0).toUpperCase() + nome.slice(1)}</span>
        </label>
        <button type="button" onClick={() => trocarMes(somarMeses(mes, 1))} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Próximo mês">
          <ChevronRight size={18} />
        </button>
      </section>

      {erroAtual && (
        <CaixaErro>
          {erroAtual}{' '}
          <button type="button" onClick={() => carregar(mes)} className="font-semibold underline">
            Tentar de novo
          </button>
        </CaixaErro>
      )}
      {aviso && <CaixaErro>{aviso}</CaixaErro>}
      {!atual && !erroAtual && <p className="text-sm text-gray-400">Carregando...</p>}

      {atual && resultado && (
        <>
          {/* Total */}
          <section className="rounded-2xl bg-gray-900 dark:bg-gray-800 text-white p-4 space-y-3">
            <div>
              <p className="text-xs text-gray-400">Total a descontar em {rotuloMes(mes)}</p>
              <p className="text-3xl font-bold tabular-nums">{formatarMoeda(resultado.total)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Vales</p>
                <p className="font-semibold tabular-nums">{formatarMoeda(resultado.totalVales)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Consumo na loja</p>
                <p className="font-semibold tabular-nums">{formatarMoeda(resultado.totalConsumo)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {podeCompartilhar && (
                <button type="button" disabled={!resultado.linhas.length} onClick={() => exportarPdf({ compartilhar: true })} className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold disabled:opacity-40">
                  <Share2 size={14} /> Enviar PDF
                </button>
              )}
              <button type="button" disabled={!resultado.linhas.length} onClick={() => exportarPdf()} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold disabled:opacity-40">
                <FileDown size={14} /> PDF com assinaturas
              </button>
              <button
                type="button"
                disabled={!resultado.linhas.length}
                onClick={() => baixarArquivo(gerarCsvAcerto(rotuloMes(mes), resultado), `acerto_${mes}.csv`, 'text/csv;charset=utf-8')}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                <Sheet size={14} /> Planilha
              </button>
            </div>
          </section>

          {resultado.linhas.length > 0 && (
            <section className={`${caixa} p-4 space-y-3`}>
              <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Desconto de cada um</h2>
              <BarrasEmpilhadas
                series={['Vales', 'Consumo na loja']}
                linhas={[...resultado.linhas]
                  .sort((a, b) => b.total - a.total)
                  .map((l) => ({ rotulo: l.funcionario, valores: [l.totalVales, l.totalConsumo] }))}
                descricao="Total a descontar por funcionário, dividido em vales e consumo"
              />
            </section>
          )}

          {/* Consumo sem funcionário */}
          {pendentes > 0 && (
            <section className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 space-y-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200">
                <UserX size={16} /> {pendentes} consumo(s) sem funcionário identificado
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                O nome digitado no relatório não bate com ninguém do cadastro. Escolha quem foi: só dá para fechar o
                acerto depois de corrigir.
              </p>
              <ul className="divide-y divide-amber-200/60 dark:divide-amber-900/60">
                {resultado.semFuncionario.map((c) => (
                  <CorrigirConsumo
                    key={`${c.relatorioId}-${c.indice}`}
                    consumo={c}
                    funcionarios={atual.funcionarios}
                    aoCorrigir={() => carregar(mes)}
                  />
                ))}
              </ul>
            </section>
          )}

          {/* Situação */}
          <section className={`${caixa} p-4 space-y-3`}>
            {acerto ? (
              <>
                <div className="flex items-start gap-2 text-sm">
                  <Lock size={16} className="mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">Acerto fechado em {formatarDataHora(acerto.fechadoEm)}</p>
                    <p className="text-gray-500 dark:text-gray-400">
                      Total fechado: {formatarMoeda(acerto.total)}. Vales e consumo deste mês estão travados.
                      {acerto.usuario && ` Fechado por ${acerto.usuario}.`}
                    </p>
                    {acerto.observacao && <p className="text-gray-500 dark:text-gray-400">Obs.: {acerto.observacao}</p>}
                  </div>
                </div>
                {divergencias.length > 0 && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-400 space-y-1">
                    <p className="font-semibold flex items-center gap-1">
                      <AlertTriangle size={14} /> Os valores de hoje não batem com o acerto fechado:
                    </p>
                    {divergencias.map((d) => (
                      <p key={d}>{d}</p>
                    ))}
                  </div>
                )}
                {painel !== 'reabrir' ? (
                  <button type="button" onClick={() => setPainel('reabrir')} className={`flex items-center gap-1.5 ${botaoClaro}`}>
                    <LockOpen size={14} /> Reabrir acerto
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Reabre o acerto e os vales deste mês para correção. Fica registrado no histórico.
                    </p>
                    <input autoFocus maxLength={300} placeholder="Motivo (obrigatório)" className={campo} value={texto} onChange={(e) => setTexto(e.target.value)} />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setPainel(null)} className={`flex-1 ${botaoClaro}`}>
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={ocupado || !texto.trim()}
                        onClick={() => executar(() => reabrirAcerto(mes, texto))}
                        className={`flex-1 ${botaoEscuro}`}
                      >
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
                    Acerto em aberto. Depois de descontar na folha, feche o acerto: os vales e o consumo do mês ficam travados.
                  </p>
                </div>
                {painel !== 'fechar' ? (
                  <button
                    type="button"
                    disabled={!resultado.linhas.length || pendentes > 0}
                    onClick={() => setPainel('fechar')}
                    className={`flex items-center gap-1.5 ${botaoClaro}`}
                  >
                    <Lock size={14} /> Fechar acerto do mês
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-sm space-y-1">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">Confira antes de fechar {rotuloMes(mes)}:</p>
                      {resultado.linhas.map((l) => (
                        <div key={l.funcionarioId} className="flex justify-between text-gray-600 dark:text-gray-300">
                          <span>{l.funcionario}</span>
                          <span className="tabular-nums">{formatarMoeda(l.total)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-1">
                        <span>Total</span>
                        <span className="tabular-nums">{formatarMoeda(resultado.total)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Fechar também fecha o mês dos vales. Dá para reabrir depois, com motivo.
                    </p>
                    <input maxLength={300} placeholder="Observação (opcional). Ex: descontado na folha de 05/11" className={campo} value={texto} onChange={(e) => setTexto(e.target.value)} />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setPainel(null)} className={`flex-1 ${botaoClaro}`}>
                        Cancelar
                      </button>
                      <button type="button" disabled={ocupado} onClick={() => executar(async () => void (await fecharAcerto(mes, texto)))} className={`flex-1 ${botaoEscuro}`}>
                        {ocupado ? 'Fechando...' : 'Fechar acerto'}
                      </button>
                    </div>
                  </div>
                )}
                {pendentes > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">Corrija os consumos sem funcionário (acima) para poder fechar.</p>}
              </>
            )}
          </section>

          {resultado.linhas.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum vale ou consumo de funcionário em {rotuloMes(mes)}.</p>
          )}

          {/* Por funcionário */}
          <div className="space-y-2">
            {resultado.linhas.map((l) => {
              const aberto = abertos.has(l.funcionarioId)
              return (
                <section key={l.funcionarioId} className={`${caixa} overflow-hidden`}>
                  <button type="button" onClick={() => alternar(l.funcionarioId)} aria-expanded={aberto} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {l.funcionario}
                        {!l.ativo && <span className="ml-1.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-gray-500">desativado</span>}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                        Vales {formatarMoeda(l.totalVales)} ({l.vales.length}) · Consumo {formatarMoeda(l.totalConsumo)} ({l.consumo.length})
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatarMoeda(l.total)}</span>
                      <ChevronDown size={18} className={`text-gray-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {aberto && (
                    <div className="px-4 pb-3 border-t border-gray-100 dark:border-gray-800 pt-2 space-y-3 text-sm">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Vales</p>
                        {l.vales.length === 0 && <p className="text-xs text-gray-400">Nenhum vale.</p>}
                        {l.vales.map((v) => (
                          <div key={v.id} className="flex items-center gap-2 py-1">
                            <span className="w-12 shrink-0 text-gray-500 tabular-nums">{formatarDiaMes(v.data)}</span>
                            <span className="flex-1 min-w-0 truncate text-xs text-gray-400">{v.observacao}</span>
                            <span className="tabular-nums font-medium text-gray-900 dark:text-gray-100">{formatarMoeda(v.valor)}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Consumo na loja</p>
                        {l.consumo.length === 0 && <p className="text-xs text-gray-400">Nenhum consumo.</p>}
                        {l.consumo.map((c) => (
                          <Link key={`${c.relatorioId}-${c.indice}`} to={`/relatorios/${c.relatorioId}`} className="flex items-center gap-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                            <span className="w-12 shrink-0 text-gray-500 tabular-nums">{formatarDiaMes(c.data)}</span>
                            <span className="flex-1 min-w-0 truncate text-xs text-gray-500">{c.item}</span>
                            <span className="tabular-nums font-medium text-gray-900 dark:text-gray-100">{formatarMoeda(c.valor)}</span>
                          </Link>
                        ))}
                      </div>
                      <button type="button" onClick={() => exportarPdf({ somente: l })} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">
                        <FileDown size={14} /> Folha de assinatura de {l.funcionario} (PDF)
                      </button>
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
