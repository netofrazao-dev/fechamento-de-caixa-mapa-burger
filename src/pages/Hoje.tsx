import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  DatabaseBackup,
  FileText,
  PencilLine,
  PlusSquare,
  Smartphone,
  Wallet,
} from 'lucide-react'
import { listarFechamentos } from '../lib/fechamentoService'
import { listarRelatorios } from '../lib/relatorioService'
import { listarValesDoMes } from '../lib/valeService'
import { buscarAcerto } from '../lib/acertoService'
import { copiaAtrasada as calcularCopiaAtrasada, ultimaCopiaBaixada } from '../lib/copiaService'
import { formatarMoeda, STATUS_COLOR, STATUS_LABEL } from '../lib/calculations'
import { compararMeses, variacao } from '../lib/comparacao'
import GraficoVendasDia from '../components/GraficoVendasDia'
import { statusPorDiferenca } from '../lib/relatorioResumo'
import { useInstalarApp } from '../lib/instalar'
import { listarDiasLojaFechada, marcarLojaFechada, semDiasFechados, type DiaLojaFechada } from '../lib/lojaFechadaService'
import { mensagemErro } from '../lib/erros'
import { caixaDoRascunho, listarRascunhosAbertos, rascunhosDoAparelho, type RascunhoAberto } from '../lib/rascunhosAbertos'
import { formatarHoraRascunho } from '../lib/draft'
import { useAtualizacaoAutomatica, veioDaAtualizacao } from '../lib/useAtualizarAoVoltar'
import { nomeMes, rotuloMes, somarMeses, somarValores } from '../lib/vales'
import { datasEntre, diaAnterior, diaDaSemana, formatarDataBr, formatarDiaMes, hojeLocal, limitesDoMes } from '../lib/datas'
import type { AcertoFechado, Fechamento, RelatorioDiario, Vale } from '../types/fechamento'

interface Dados {
  fechamentos: Fechamento[]
  fechamentosAnterior: Fechamento[]
  relatorios: RelatorioDiario[]
  vales: Vale[] | null
  valesAnterior: Vale[] | null
  acertoAnterior: AcertoFechado | null | 'indisponivel'
  fechados: DiaLojaFechada[]
}

function saudacao(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

const caixa = 'rounded-2xl bg-white dark:bg-gray-900 shadow-sm'

export default function Hoje() {
  const instalar = useInstalarApp()
  const [dados, setDados] = useState<Dados | null>(null)
  const [falhou, setFalhou] = useState(false)
  // Muda quando a pessoa toca em "Tentar de novo" (busca outra vez).
  const [tentativa, setTentativa] = useState(0)
  // Atualiza sozinha ao voltar para a tela (o que foi feito no outro aparelho aparece).
  const versaoAuto = useAtualizacaoAutomatica(120_000)
  const vistaAuto = useRef(versaoAuto)
  const [rascunhos, setRascunhos] = useState<RascunhoAberto[]>(() => rascunhosDoAparelho())
  useEffect(() => {
    let ativo = true
    listarRascunhosAbertos().then((l) => ativo && setRascunhos(l))
    return () => {
      ativo = false
    }
  }, [tentativa, versaoAuto])
  const [marcando, setMarcando] = useState(false)
  const [erroMarcar, setErroMarcar] = useState<string | null>(null)

  /** "Ontem ficou sem fechamento" → a loja não abriu (folga, feriado). */
  async function marcarFechada(data: string) {
    if (marcando) return
    setMarcando(true)
    setErroMarcar(null)
    try {
      await marcarLojaFechada(data)
      setTentativa((t) => t + 1)
    } catch (e) {
      setErroMarcar(mensagemErro(e, 'Não consegui marcar a loja fechada.'))
    } finally {
      setMarcando(false)
    }
  }

  const hoje = hojeLocal()
  const mes = hoje.slice(0, 7)
  const mesAnterior = somarMeses(mes, -1)
  const ontem = diaAnterior(hoje)

  useEffect(() => {
    let ativo = true
    const automatica = veioDaAtualizacao(vistaAuto, versaoAuto)
    const atualLim = limitesDoMes(mes)
    const antLim = limitesDoMes(mesAnterior)
    Promise.allSettled([
      listarFechamentos({ dataInicio: atualLim.inicio, dataFim: atualLim.fim }),
      listarFechamentos({ dataInicio: antLim.inicio, dataFim: antLim.fim }),
      listarRelatorios({ dataInicio: antLim.inicio, dataFim: atualLim.fim }),
      listarValesDoMes(mes),
      listarValesDoMes(mesAnterior),
      buscarAcerto(mesAnterior),
      listarDiasLojaFechada(antLim.inicio, atualLim.fim),
    ]).then((r) => {
      if (!ativo) return
      // Atualização automática que falhou (internet instável): a tela fica como estava.
      if (automatica && r.some((x) => x.status === 'rejected')) return
      const ok = <T,>(i: number, padrao: T): T => (r[i].status === 'fulfilled' ? (r[i] as PromiseFulfilledResult<T>).value : padrao)
      if (r[0].status === 'rejected' || r[2].status === 'rejected') setFalhou(true)
      setDados({
        fechamentos: ok<Fechamento[]>(0, []),
        fechamentosAnterior: ok<Fechamento[]>(1, []),
        relatorios: ok<RelatorioDiario[]>(2, []),
        vales: ok<Vale[] | null>(3, null),
        valesAnterior: ok<Vale[] | null>(4, null),
        acertoAnterior: r[5].status === 'fulfilled' ? (r[5] as PromiseFulfilledResult<AcertoFechado | null>).value : 'indisponivel',
        fechados: ok<DiaLojaFechada[]>(6, []),
      })
    })
    return () => {
      ativo = false
    }
  }, [mes, mesAnterior, tentativa, versaoAuto])

  const todosFechamentos = useMemo(() => (dados ? [...dados.fechamentosAnterior, ...dados.fechamentos] : []), [dados])
  const fechamentoHoje = todosFechamentos.find((f) => f.data === hoje)
  const fechamentoOntem = todosFechamentos.find((f) => f.data === ontem)
  const relatorioHoje = dados?.relatorios.find((r) => r.data === hoje)

  // Começou e ainda não salvou: mostra "em andamento" (rascunho deste aparelho ou de outro).
  const fechamentoEmAndamento = fechamentoHoje
    ? undefined
    : rascunhos.find((r) => r.tipo === 'fechamento' && !r.edicao && r.data === hoje)
  const relatorioEmAndamento = relatorioHoje
    ? undefined
    : rascunhos.find((r) => r.tipo === 'relatorio' && !r.edicao && r.data === hoje)
  const fechamentoComAlteracoes =
    fechamentoHoje && rascunhos.some((r) => r.tipo === 'fechamento' && r.edicao && r.registroId === fechamentoHoje.id)
  const relatorioComAlteracoes =
    relatorioHoje && rascunhos.some((r) => r.tipo === 'relatorio' && r.edicao && r.registroId === relatorioHoje.id)
  const relatorioOntem = dados?.relatorios.find((r) => r.data === ontem)

  const comparacao = useMemo(
    () => (dados ? compararMeses({ mes, fechamentos: dados.fechamentos, fechamentosAnterior: dados.fechamentosAnterior, hoje }) : null),
    [dados, mes, hoje],
  )
  const diasSemFechamento = useMemo(() => {
    if (!dados) return []
    const { inicio } = limitesDoMes(mes)
    const com = new Set(dados.fechamentos.map((f) => f.data))
    // até ontem (o de hoje ainda pode ser feito); dias de loja fechada não contam
    return inicio <= ontem && ontem.slice(0, 7) === mes
      ? semDiasFechados(datasEntre(inicio, ontem).filter((d) => !com.has(d)), dados.fechados)
      : []
  }, [dados, mes, ontem])

  const totalValesMes = dados?.vales ? somarValores(dados.vales.filter((v) => !v.excluidoEm).map((v) => v.valor)) : null
  const qtdValesMes = dados?.vales?.filter((v) => !v.excluidoEm).length ?? 0
  const temValesAnterior = (dados?.valesAnterior ?? []).some((v) => !v.excluidoEm)
  const acertoAnteriorAberto = dados && dados.acertoAnterior === null && temValesAnterior
  const ultimaCopia = ultimaCopiaBaixada()
  const copiaAtrasada = calcularCopiaAtrasada()

  const nomeAnterior = nomeMes(mesAnterior).split(' de ')[0]
  const ultimos7 = useMemo(() => {
    const lista: string[] = [hoje]
    while (lista.length < 7) lista.unshift(diaAnterior(lista[0]))
    const porDia = new Map<string, Fechamento[]>()
    for (const f of todosFechamentos) porDia.set(f.data, [...(porDia.get(f.data) ?? []), f])
    return lista.map((d) => {
      const fs = porDia.get(d)
      const dif = fs ? somarValores(fs.map((f) => f.resultado.diferencaFinal)) : undefined
      return {
        data: d,
        vendas: fs ? somarValores(fs.map((f) => f.resultado.totalCaixa)) : d === hoje ? 0 : null,
        diferenca: dif,
        status: dif !== undefined ? statusPorDiferenca(dif) : undefined,
      }
    })
  }, [todosFechamentos, hoje])
  const comVenda7 = ultimos7.filter((d) => (d.vendas ?? 0) > 0)
  const media7 = comVenda7.length ? Math.round((somarValores(comVenda7.map((d) => d.vendas ?? 0)) / comVenda7.length) * 100) / 100 : 0
  const vVendas = comparacao ? variacao(comparacao.atual.vendas, comparacao.anterior.vendas) : null

  const ontemLojaFechada = Boolean(dados?.fechados.some((f) => f.data === ontem))
  const pendencias: { texto: string; link: string; acao: string; lojaFechada?: string }[] = []
  if (dados && !fechamentoOntem && !ontemLojaFechada) {
    pendencias.push({ texto: `Ontem (${formatarDiaMes(ontem)}) ficou sem fechamento de caixa.`, link: `/novo?data=${ontem}`, acao: 'Lançar', lojaFechada: ontem })
  }
  if (dados && fechamentoOntem && !relatorioOntem) pendencias.push({ texto: `Ontem (${formatarDiaMes(ontem)}) ficou sem relatório do dia.`, link: `/relatorios/novo?data=${ontem}`, acao: 'Criar' })
  if (diasSemFechamento.length > 1) pendencias.push({ texto: `${diasSemFechamento.length} dias sem fechamento em ${rotuloMes(mes)}.`, link: `/mensal?mes=${mes}`, acao: 'Ver' })
  if (acertoAnteriorAberto) pendencias.push({ texto: `O acerto de ${nomeAnterior} (vales + consumo) ainda está aberto. Feche depois de descontar na folha.`, link: `/acerto?mes=${mesAnterior}`, acao: 'Abrir' })

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-24">
      <header>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {saudacao()}!
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {diaDaSemana(hoje).charAt(0).toUpperCase() + diaDaSemana(hoje).slice(1)}, {formatarDataBr(hoje)}
        </p>
      </header>

      {falhou && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-400 space-y-2">
          <p>Não consegui carregar os dados agora (sem internet?). Os atalhos abaixo continuam funcionando.</p>
          <button
            type="button"
            onClick={() => {
              setFalhou(false)
              setDados(null)
              setTentativa((t) => t + 1)
            }}
            className="font-semibold underline"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {/* Hoje */}
      <div className="grid grid-cols-2 gap-2">
        {fechamentoHoje ? (
          <Link to={`/fechamento/${fechamentoHoje.id}`} className={`${caixa} p-4 space-y-1.5`}>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
              <CheckCircle2 size={14} /> Fechamento feito
            </p>
            <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatarMoeda(fechamentoHoje.resultado.totalCaixa)}</p>
            <span className={`inline-block text-[10px] font-semibold rounded-full border px-2 py-0.5 ${STATUS_COLOR[fechamentoHoje.resultado.status]}`}>
              {STATUS_LABEL[fechamentoHoje.resultado.status]}
            </span>
            {fechamentoComAlteracoes && <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Alterações não salvas</p>}
          </Link>
        ) : fechamentoEmAndamento ? (
          <Link
            to={fechamentoEmAndamento.link}
            className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-1.5"
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
              <PencilLine size={14} /> Fechamento em andamento
            </p>
            <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatarMoeda(caixaDoRascunho(fechamentoEmAndamento.dados))}</p>
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              Caixa até agora · salvo {formatarHoraRascunho(fechamentoEmAndamento.salvoEm)}. Toque para continuar.
            </p>
          </Link>
        ) : (
          <Link to="/novo" className="rounded-2xl bg-gray-900 dark:bg-gray-700 text-white p-4 space-y-1.5 shadow-sm">
            <PlusSquare size={20} />
            <p className="font-semibold leading-tight">Fazer o fechamento de hoje</p>
            <p className="text-[11px] text-gray-300">{!dados ? 'Carregando...' : falhou ? 'Não consegui conferir agora' : 'Ainda não foi feito'}</p>
          </Link>
        )}
        {relatorioHoje ? (
          <Link to={`/relatorios/${relatorioHoje.id}`} className={`${caixa} p-4 space-y-1.5`}>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
              <CheckCircle2 size={14} /> Relatório feito
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">{relatorioHoje.quantidadeVendida} vendidas</p>
            {relatorioComAlteracoes ? (
              <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Alterações não salvas</p>
            ) : (
              <p className="text-[11px] text-gray-400">Toque para abrir ou enviar o PDF</p>
            )}
          </Link>
        ) : relatorioEmAndamento ? (
          <Link
            to={relatorioEmAndamento.link}
            className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-1.5"
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
              <PencilLine size={14} /> Relatório em andamento
            </p>
            <p className="font-semibold leading-tight text-gray-800 dark:text-gray-200">Relatório do dia</p>
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              Salvo {formatarHoraRascunho(relatorioEmAndamento.salvoEm)}. Toque para continuar.
            </p>
          </Link>
        ) : (
          <Link to={`/relatorios/novo?data=${hoje}`} className={`${caixa} p-4 space-y-1.5 border border-dashed border-gray-300 dark:border-gray-700`}>
            <FileText size={20} className="text-gray-500" />
            <p className="font-semibold leading-tight text-gray-800 dark:text-gray-200">Relatório do dia</p>
            <p className="text-[11px] text-gray-400">{!dados ? 'Carregando...' : falhou ? 'Não consegui conferir agora' : 'Ainda não foi feito'}</p>
          </Link>
        )}
      </div>

      {/* Pendências */}
      {pendencias.length > 0 && (
        <section className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200">
            <AlertCircle size={15} /> Precisa de atenção
          </p>
          <ul className="space-y-2">
            {pendencias.map((p) => (
              <li key={p.texto} className="flex items-center justify-between gap-3 text-sm text-amber-900 dark:text-amber-200">
                <span>{p.texto}</span>
                <span className="shrink-0 flex gap-1.5">
                  {p.lojaFechada && (
                    <button
                      type="button"
                      disabled={marcando}
                      onClick={() => marcarFechada(p.lojaFechada!)}
                      className="rounded-lg bg-white/80 dark:bg-gray-900/60 px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                      title="A loja não abriu nesse dia (folga, feriado)"
                    >
                      Loja fechada
                    </button>
                  )}
                  <Link to={p.link} className="rounded-lg bg-white/80 dark:bg-gray-900/60 px-2.5 py-1 text-xs font-semibold">
                    {p.acao}
                  </Link>
                </span>
              </li>
            ))}
            {erroMarcar && <li role="alert" className="text-xs text-red-700 dark:text-red-400">{erroMarcar}</li>}
          </ul>
        </section>
      )}

      {/* Mês até agora */}
      {dados && comparacao && (
        <Link to={`/mensal?mes=${mes}`} className={`${caixa} p-4 block space-y-2`}>
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
              {nomeMes(mes).split(' de ')[0].charAt(0).toUpperCase() + nomeMes(mes).split(' de ')[0].slice(1)} até agora
            </p>
            <ChevronRight size={18} className="text-gray-400" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Vendas</p>
              <p className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatarMoeda(comparacao.atual.vendas)}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Média/dia</p>
              <p className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatarMoeda(comparacao.atual.mediaDia)}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Sobra/falta</p>
              <p
                className={`font-semibold tabular-nums ${
                  Math.abs(comparacao.atual.diferenca) < 0.005
                    ? 'text-green-600 dark:text-green-400'
                    : comparacao.atual.diferenca > 0
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-red-600 dark:text-red-400'
                }`}
              >
                {formatarMoeda(comparacao.atual.diferenca)}
              </p>
            </div>
          </div>
          {vVendas && vVendas.sentido !== 'sem-base' && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <span
                className={`font-semibold ${
                  vVendas.sentido === 'subiu' ? 'text-green-600 dark:text-green-400' : vVendas.sentido === 'caiu' ? 'text-red-600 dark:text-red-400' : ''
                }`}
              >
                {vVendas.sentido === 'subiu' ? '▲' : vVendas.sentido === 'caiu' ? '▼' : '='} {vVendas.texto}
              </span>{' '}
              em vendas comparado aos mesmos dias de {nomeAnterior}.
            </p>
          )}
        </Link>
      )}

      {/* Últimos 7 dias */}
      {dados && ultimos7.some((d) => (d.vendas ?? 0) > 0) && (
        <Link to="/semanal" className={`${caixa} p-4 block space-y-1`}>
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Últimos 7 dias</p>
            <span className="flex items-center text-xs text-gray-400">
              ver semana <ChevronRight size={16} />
            </span>
          </div>
          <GraficoVendasDia dias={ultimos7} mediaAtual={media7} rotuloMedia="Média dos 7 dias" />
        </Link>
      )}

      {/* Vales */}
      {totalValesMes !== null && (
        <Link to={`/vales?mes=${mes}`} className={`${caixa} p-4 flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3">
            <Wallet size={20} className="text-gray-500" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Vales de {nomeMes(mes).split(' de ')[0]}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{qtdValesMes} vale(s) · ver acerto do mês</p>
            </div>
          </div>
          <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatarMoeda(totalValesMes)}</span>
        </Link>
      )}

      {/* Lembretes */}
      {copiaAtrasada && (
        <Link to="/cadastros" className={`${caixa} p-4 flex items-center gap-3`}>
          <DatabaseBackup size={20} className="text-gray-500 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-gray-900 dark:text-gray-100">Baixar cópia de segurança</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {ultimaCopia ? 'Faz mais de 30 dias desde a última cópia baixada neste aparelho.' : 'Nenhuma cópia baixada neste aparelho ainda.'} Leva 10 segundos.
            </p>
          </div>
        </Link>
      )}

      {(instalar.podeInstalar || instalar.instrucaoIPhone) && (
        <section className={`${caixa} p-4 flex items-start gap-3`}>
          <Smartphone size={20} className="text-gray-500 shrink-0 mt-0.5" />
          <div className="text-sm flex-1">
            <p className="font-semibold text-gray-900 dark:text-gray-100">Instale o app no celular</p>
            {instalar.podeInstalar ? (
              <>
                <p className="text-xs text-gray-500 dark:text-gray-400">Fica com ícone na tela inicial e abre em tela cheia.</p>
                <button
                  type="button"
                  onClick={() => instalar.instalar()}
                  className="mt-2 rounded-lg bg-gray-900 dark:bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Instalar agora
                </button>
              </>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No iPhone: toque em <strong>Compartilhar</strong> (quadrado com seta) e depois em <strong>Adicionar à Tela de Início</strong>.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
