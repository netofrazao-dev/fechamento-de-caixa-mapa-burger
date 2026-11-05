import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FileText, Plus, Search } from 'lucide-react'
import { listarFechamentos } from '../lib/fechamentoService'
import { listarRelatorios } from '../lib/relatorioService'
import { formatarMoeda, STATUS_COLOR, STATUS_LABEL } from '../lib/calculations'
import { mensagemErro } from '../lib/erros'
import { somarValores, dataValida } from '../lib/vales'
import { CaixaErro } from '../components/Avisos'
import GraficoVendasDia from '../components/GraficoVendasDia'
import GraficoSobraFalta from '../components/graficos/GraficoSobraFalta'
import BarraResultados from '../components/graficos/BarraResultados'
import { statusPorDiferenca } from '../lib/relatorioResumo'
import PainelDiasSemFechamento from '../components/PainelDiasSemFechamento'
import { listarDiasLojaFechada, semDiasFechados, type DiaLojaFechada } from '../lib/lojaFechadaService'
import type { Fechamento, RelatorioDiario, Vale } from '../types/fechamento'
import { listarValesDoPeriodo } from '../lib/valeService'
import { resultadosDaBusca } from '../lib/buscaHistorico'
import {
  dataLocal,
  datasEntre,
  diaDaSemana,
  formatarDataBr,
  hojeLocal as hoje,
  inicioDoMesLocal as inicioDoMes,
} from '../lib/datas'

interface DiaAgrupado {
  data: string
  fechamentos: Fechamento[]
  relatorio?: RelatorioDiario
}

function atalhos() {
  const agora = new Date()
  const mesPassadoInicio = new Date(agora.getFullYear(), agora.getMonth() - 1, 1)
  const mesPassadoFim = new Date(agora.getFullYear(), agora.getMonth(), 0)
  const seteDias = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 6)
  return [
    { rotulo: 'Últimos 7 dias', inicio: dataLocal(seteDias), fim: hoje() },
    { rotulo: 'Este mês', inicio: inicioDoMes(), fim: hoje() },
    { rotulo: 'Mês passado', inicio: dataLocal(mesPassadoInicio), fim: dataLocal(mesPassadoFim) },
  ]
}

export default function Historico() {
  const [params, setParams] = useSearchParams()
  const dataInicio = params.get('de') && dataValida(params.get('de')!) ? params.get('de')! : inicioDoMes()
  const dataFim = params.get('ate') && dataValida(params.get('ate')!) ? params.get('ate')! : hoje()
  const periodoInvalido = dataInicio > dataFim

  const [dados, setDados] = useState<{
    chave: string
    fechamentos: Fechamento[]
    relatorios: RelatorioDiario[]
    fechados: DiaLojaFechada[]
  } | null>(null)
  const [erro, setErro] = useState<{ chave: string; mensagem: string } | null>(null)
  // Muda quando a pessoa toca em "Tentar de novo" (busca outra vez).
  const [tentativa, setTentativa] = useState(0)
  const chave = `${dataInicio}|${dataFim}`

  // Busca por palavra (fica no endereço, então volta junto ao navegar).
  const busca = params.get('busca') ?? ''
  const termo = busca.trim()
  const buscaAtiva = termo.length >= 2

  function mudarPeriodo(de: string, ate: string) {
    setParams(busca ? { de, ate, busca } : { de, ate }, { replace: true })
  }

  function mudarBusca(texto: string) {
    setParams(texto ? { de: dataInicio, ate: dataFim, busca: texto } : { de: dataInicio, ate: dataFim }, { replace: true })
  }

  // Vales do período: só buscados quando há busca (para achar "vale do Neto", por exemplo).
  const [valesBusca, setValesBusca] = useState<{ chave: string; vales: Vale[]; falhou?: boolean } | null>(null)
  useEffect(() => {
    if (!buscaAtiva || dataInicio > dataFim) return
    let ativo = true
    const chaveBusca = `${dataInicio}|${dataFim}`
    listarValesDoPeriodo(dataInicio, dataFim)
      .then((vales) => ativo && setValesBusca({ chave: chaveBusca, vales }))
      .catch(() => ativo && setValesBusca({ chave: chaveBusca, vales: [], falhou: true }))
    return () => {
      ativo = false
    }
  }, [buscaAtiva, dataInicio, dataFim, tentativa])

  useEffect(() => {
    if (periodoInvalido) return
    let ativo = true
    Promise.all([
      listarFechamentos({ dataInicio, dataFim }),
      listarRelatorios({ dataInicio, dataFim }),
      // Dias de loja fechada são um extra: se falhar, a tela continua.
      listarDiasLojaFechada(dataInicio, dataFim).catch(() => [] as DiaLojaFechada[]),
    ])
      .then(([fechamentos, relatorios, fechados]) => {
        if (ativo) setDados({ chave: `${dataInicio}|${dataFim}`, fechamentos, relatorios, fechados })
      })
      .catch((e) => {
        if (ativo) setErro({ chave: `${dataInicio}|${dataFim}`, mensagem: mensagemErro(e, 'Erro ao carregar o histórico.') })
      })
    return () => {
      ativo = false
    }
  }, [dataInicio, dataFim, periodoInvalido, tentativa])

  const atual = dados?.chave === chave ? dados : null
  const erroAtual = erro?.chave === chave ? erro.mensagem : null
  const carregando = !periodoInvalido && !atual && !erroAtual

  const dias = useMemo<DiaAgrupado[]>(() => {
    if (!atual) return []
    const porDia = new Map<string, DiaAgrupado>()
    for (const f of atual.fechamentos) {
      const d = porDia.get(f.data) ?? { data: f.data, fechamentos: [] }
      d.fechamentos.push(f)
      porDia.set(f.data, d)
    }
    for (const r of atual.relatorios) {
      const d = porDia.get(r.data) ?? { data: r.data, fechamentos: [] }
      d.relatorio = r
      porDia.set(r.data, d)
    }
    return Array.from(porDia.values()).sort((a, b) => b.data.localeCompare(a.data))
  }, [atual])

  const resumo = useMemo(() => {
    if (!atual) return null
    const fs = atual.fechamentos
    const ate = dataFim < hoje() ? dataFim : hoje()
    const comFechamento = new Set(fs.map((f) => f.data))
    const semFechamento = semDiasFechados(
      dataInicio <= ate ? datasEntre(dataInicio, ate).filter((d) => !comFechamento.has(d)) : [],
      atual.fechados,
    )
    return {
      caixa: somarValores(fs.map((f) => f.resultado.totalCaixa)),
      diferenca: somarValores(fs.map((f) => f.resultado.diferencaFinal)),
      faltou: fs.filter((f) => f.resultado.status === 'faltou').length,
      sobrou: fs.filter((f) => f.resultado.status === 'sobrou').length,
      semFechamento,
    }
  }, [atual, dataInicio, dataFim])

  // Gráficos do período (até 62 dias, pra caber na tela)
  const graficoPeriodo = useMemo(() => {
    if (!atual || periodoInvalido) return null
    const datas = datasEntre(dataInicio, dataFim)
    if (datas.length > 62) return null
    const porDia = new Map<string, Fechamento[]>()
    for (const f of atual.fechamentos) porDia.set(f.data, [...(porDia.get(f.data) ?? []), f])
    const limite = hoje()
    return datas.map((d) => {
      const fs = porDia.get(d)
      const dif = fs ? somarValores(fs.map((f) => f.resultado.diferencaFinal)) : undefined
      return {
        data: d,
        vendas: fs ? somarValores(fs.map((f) => f.resultado.totalCaixa)) : d <= limite ? null : 0,
        diferenca: dif,
        status: dif !== undefined ? statusPorDiferenca(dif) : undefined,
      }
    })
  }, [atual, dataInicio, dataFim, periodoInvalido])
  // Resultado da busca: dias com algo que bate com o que foi digitado, mostrando onde achou.
  const valesDaBusca = valesBusca?.chave === chave ? valesBusca : null
  // (conta rápida: refeita a cada letra digitada, sem precisar de memorização)
  const resultados =
    buscaAtiva && atual
      ? resultadosDaBusca({ fechamentos: atual.fechamentos, relatorios: atual.relatorios, vales: valesDaBusca?.vales ?? [] }, termo)
      : null

  const comVenda = (graficoPeriodo ?? []).filter((d) => (d.vendas ?? 0) > 0)
  const mediaPeriodo = comVenda.length ? Math.round((somarValores(comVenda.map((d) => d.vendas ?? 0)) / comVenda.length) * 100) / 100 : 0

  const campoData =
    'rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-500'

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-24">
      <header>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Histórico</h1>
        <p className="text-xs text-gray-400 dark:text-gray-500">Fechamentos e relatórios por dia.</p>
      </header>

      <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {atalhos().map((a) => {
            const ativo = a.inicio === dataInicio && a.fim === dataFim
            return (
              <button
                key={a.rotulo}
                type="button"
                onClick={() => mudarPeriodo(a.inicio, a.fim)}
                aria-pressed={ativo}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  ativo ? 'bg-gray-900 dark:bg-gray-700 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}
              >
                {a.rotulo}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">De</span>
            <input type="date" className={campoData} value={dataInicio} onChange={(e) => e.target.value && mudarPeriodo(e.target.value, dataFim)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Até</span>
            <input type="date" className={campoData} value={dataFim} onChange={(e) => e.target.value && mudarPeriodo(dataInicio, e.target.value)} />
          </label>
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 focus-within:border-gray-500">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            type="search"
            value={busca}
            onChange={(e) => mudarBusca(e.target.value)}
            placeholder="Buscar: gás, Neto, troco, arroz..."
            aria-label="Buscar no período"
            className="flex-1 min-w-0 bg-transparent text-sm outline-none"
          />
        </label>
      </section>

      {periodoInvalido && <CaixaErro>A data "De" está depois da data "Até". Ajuste o período.</CaixaErro>}
      {erroAtual && (
        <CaixaErro
          onTentarDeNovo={() => {
            setErro(null)
            setTentativa((t) => t + 1)
          }}
        >
          {erroAtual}
        </CaixaErro>
      )}
      {carregando && <p className="text-sm text-gray-400 dark:text-gray-500">Carregando...</p>}

      {buscaAtiva && atual && resultados && (
        <section aria-label="Resultado da busca" className="space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {resultados.length > 0 ? `${resultados.length} dia(s) com “${termo}” no período` : `Nada com “${termo}” neste período.`}
            {buscaAtiva && !valesDaBusca && <span className="text-gray-400"> (procurando também nos vales...)</span>}
          </p>
          {valesDaBusca?.falhou && <p className="text-xs text-amber-700 dark:text-amber-400">Não consegui procurar nos vales agora (sem internet?).</p>}
          {resultados.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500">Dica: aumente o período (De / Até) para procurar em mais dias.</p>
          )}
          {resultados.map((r) => (
            <div key={r.data} className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-2">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {formatarDataBr(r.data)} <span className="text-xs font-normal text-gray-400">{diaDaSemana(r.data)}</span>
              </p>
              <ul className="space-y-1.5">
                {r.achados.map((a, i) => (
                  <li key={i} className="flex justify-between gap-3 text-sm">
                    <span className="min-w-0 text-gray-700 dark:text-gray-300">
                      <span className="block text-[11px] font-semibold text-gray-400 dark:text-gray-500">{a.rotulo}</span>
                      {a.texto}
                    </span>
                    {a.valor !== undefined && <span className="shrink-0 tabular-nums text-gray-900 dark:text-gray-100">{formatarMoeda(a.valor)}</span>}
                  </li>
                ))}
              </ul>
              <div className="flex gap-4 text-xs font-semibold">
                {r.fechamento && (
                  <Link to={`/fechamento/${r.fechamento.id}`} className="text-gray-600 dark:text-gray-300 underline">
                    Abrir fechamento
                  </Link>
                )}
                {r.relatorio && (
                  <Link to={`/relatorios/${r.relatorio.id}`} className="text-gray-600 dark:text-gray-300 underline">
                    Abrir relatório
                  </Link>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {!buscaAtiva && (
        <>
        {atual && resumo && (
          <section className="rounded-2xl bg-gray-900 dark:bg-gray-800 text-white p-4 space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400">Total do caixa no período</p>
                <p className="text-lg font-bold tabular-nums">{formatarMoeda(resumo.caixa)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Diferença somada</p>
                <p className="text-lg font-bold tabular-nums">{formatarMoeda(resumo.diferenca)}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              {atual.fechamentos.length} fechamento(s) · {resumo.faltou} com falta · {resumo.sobrou} com sobra
            </p>
          </section>
        )}

        {atual && graficoPeriodo && graficoPeriodo.some((d) => (d.vendas ?? 0) > 0) && (
          <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-3">
            <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Vendas no período</h2>
            <GraficoVendasDia dias={graficoPeriodo} mediaAtual={mediaPeriodo} rotuloMedia="Média do período" />
            <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 pt-2">Como o caixa fechou</h2>
            <BarraResultados
              fechou={graficoPeriodo.filter((d) => d.status === 'fechou').length}
              sobrou={graficoPeriodo.filter((d) => d.status === 'sobrou').length}
              faltou={graficoPeriodo.filter((d) => d.status === 'faltou').length}
            />
            <GraficoSobraFalta dias={graficoPeriodo.map((d) => ({ data: d.data, diferenca: d.diferenca ?? null }))} />
          </section>
        )}

        {atual && resumo && (
          <PainelDiasSemFechamento
            semFechamento={resumo.semFechamento}
            fechados={atual.fechados}
            contexto="no período"
            limite={31}
            onMudou={() => setTentativa((t) => t + 1)}
          />
        )}

        {atual && dias.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">Nada encontrado nesse período.</p>}

        <div className="space-y-2">
          {dias.map((dia) => (
            <div key={dia.data} className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-2">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {formatarDataBr(dia.data)} <span className="text-xs font-normal text-gray-400">{diaDaSemana(dia.data)}</span>
              </p>

              <div className="flex flex-wrap gap-2">
                {dia.fechamentos.length === 0 && (
                  <Link
                    to={`/novo?data=${dia.data}`}
                    className="flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400"
                  >
                    <Plus size={14} /> Lançar fechamento
                  </Link>
                )}
                {[...dia.fechamentos]
                  .sort((a, b) => a.turno.localeCompare(b.turno))
                  .map((f) => (
                    <Link
                      key={f.id}
                      to={`/fechamento/${f.id}`}
                      className="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {f.turno === 'manha' ? 'Caixa' : 'Noite'}
                      </span>
                      <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{formatarMoeda(f.resultado.totalCaixa)}</span>
                      <span className={`text-[10px] font-semibold rounded-full border px-2 py-0.5 ${STATUS_COLOR[f.resultado.status]}`}>
                        {STATUS_LABEL[f.resultado.status]}
                        {f.resultado.status !== 'fechou' && ` ${formatarMoeda(Math.abs(f.resultado.diferencaFinal))}`}
                      </span>
                    </Link>
                  ))}

                <Link
                  to={dia.relatorio ? `/relatorios/${dia.relatorio.id}` : `/relatorios/novo?data=${dia.data}`}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    dia.relatorio
                      ? 'bg-gray-900 dark:bg-gray-700 text-white'
                      : 'border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <FileText size={14} />
                  {dia.relatorio ? 'Relatório' : 'Criar relatório'}
                </Link>
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  )
}
