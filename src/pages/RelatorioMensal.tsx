import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ChevronLeft, ChevronRight, FileDown, FileText, Share2 } from 'lucide-react'
import { listarFechamentos } from '../lib/fechamentoService'
import { listarRelatorios } from '../lib/relatorioService'
import { listarValesDoMes } from '../lib/valeService'
import { agregarVendasPorPrato, formatarMoeda } from '../lib/calculations'
import type { LinhaRelatorioMensal } from '../lib/pdf'
import { carregarPdf } from '../lib/pdfSobDemanda'
import { podeCompartilharArquivos } from '../lib/arquivos'
import { mensagemErro } from '../lib/erros'
import { mesValido, nomeMes, rotuloMes, somarMeses, somarValores } from '../lib/vales'
import { CaixaErro } from '../components/Avisos'
import type { Fechamento, RelatorioDiario } from '../types/fechamento'
import { datasEntre, formatarDiaMes, hojeLocal, limitesDoMes, mesLocal } from '../lib/datas'
import { compararMeses, fraseComparacao, variacao, type Variacao } from '../lib/comparacao'
import GraficoVendasDia, { type DiaGrafico } from '../components/GraficoVendasDia'
import GraficoSobraFalta from '../components/graficos/GraficoSobraFalta'
import BarrasHorizontais from '../components/graficos/BarrasHorizontais'
import BarraResultados from '../components/graficos/BarraResultados'
import AbasResumo from '../components/AbasResumo'
import RetiradasCaixa from '../components/RetiradasCaixa'
import { retiradasDoPeriodo } from '../lib/sangrias'
import { formasDePagamento, statusPorDiferenca } from '../lib/relatorioResumo'

function agruparPorDia(fechamentos: Fechamento[]): (LinhaRelatorioMensal & { fechamentoId: string })[] {
  const porDia = new Map<string, Fechamento[]>()
  for (const f of fechamentos) porDia.set(f.data, [...(porDia.get(f.data) ?? []), f])
  return Array.from(porDia.entries())
    .map(([data, fs]) => ({
      data,
      fechamentoId: fs[0].id,
      manha: fs.find((f) => f.turno === 'manha'),
      noite: fs.find((f) => f.turno === 'noite'),
      totalCaixaDia: somarValores(fs.map((f) => f.resultado.totalCaixa)),
      totalSistemaDia: somarValores(fs.map((f) => f.resultado.totalSistema)),
      diferencaFinalDia: somarValores(fs.map((f) => f.resultado.diferencaFinal)),
    }))
    .sort((a, b) => a.data.localeCompare(b.data))
}

function corDiferenca(v: number): string {
  if (Math.abs(v) < 0.005) return 'text-green-600 dark:text-green-400'
  return v > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
}

interface DadosMes {
  mes: string
  fechamentos: Fechamento[]
  relatorios: RelatorioDiario[]
  totalVales: number | null
  fechamentosAnterior: Fechamento[]
}

/** Selo de variação: verde quando é bom, vermelho quando é ruim, cinza sem base. */
function SeloVariacao({ v, menorEhMelhor }: { v: Variacao; menorEhMelhor?: boolean }) {
  if (v.sentido === 'sem-base') return <span className="text-[11px] text-gray-400">sem base</span>
  if (v.sentido === 'igual') return <span className="text-[11px] text-gray-500">= igual</span>
  const bom = menorEhMelhor ? v.sentido === 'caiu' : v.sentido === 'subiu'
  return (
    <span className={`text-[11px] font-semibold ${bom ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {v.sentido === 'subiu' ? '▲' : '▼'} {v.texto}
    </span>
  )
}

export default function RelatorioMensal() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const mesUrl = params.get('mes')
  const mes = mesUrl && mesValido(mesUrl) ? mesUrl : mesLocal()

  const [dados, setDados] = useState<DadosMes | null>(null)
  const [erro, setErro] = useState<{ mes: string; mensagem: string } | null>(null)
  // Muda quando a pessoa toca em "Tentar de novo" (busca outra vez).
  const [tentativa, setTentativa] = useState(0)
  const [erroPdf, setErroPdf] = useState<string | null>(null)

  useEffect(() => {
    const { inicio, fim } = limitesDoMes(mes)
    let ativo = true
    Promise.all([
      listarFechamentos({ dataInicio: inicio, dataFim: fim }),
      listarRelatorios({ dataInicio: inicio, dataFim: fim }),
      // Vales são um extra: se der erro (ex.: banco antigo), o mensal continua.
      listarValesDoMes(mes)
        .then((vs) => somarValores(vs.filter((v) => !v.excluidoEm).map((v) => v.valor)))
        .catch(() => null),
      // Mês anterior, para comparar (se falhar, só não mostra a comparação).
      (() => {
        const ant = limitesDoMes(somarMeses(mes, -1))
        return listarFechamentos({ dataInicio: ant.inicio, dataFim: ant.fim }).catch(() => [] as Fechamento[])
      })(),
    ])
      .then(([fechamentos, relatorios, totalVales, fechamentosAnterior]) => {
        if (ativo) setDados({ mes, fechamentos, relatorios, totalVales, fechamentosAnterior })
      })
      .catch((e) => {
        if (ativo) setErro({ mes, mensagem: mensagemErro(e, 'Erro ao carregar o relatório do mês.') })
      })
    return () => {
      ativo = false
    }
  }, [mes, tentativa])

  const atual = dados?.mes === mes ? dados : null
  const erroAtual = erro?.mes === mes ? erro.mensagem : null

  const linhas = useMemo(() => agruparPorDia(atual?.fechamentos ?? []), [atual])
  const relatorioPorData = useMemo(() => new Map((atual?.relatorios ?? []).map((r) => [r.data, r])), [atual])
  const vendasPorPrato = useMemo(() => agregarVendasPorPrato(atual?.fechamentos ?? []), [atual])
  const retiradas = useMemo(
    () => (atual ? retiradasDoPeriodo({ relatorios: atual.relatorios, fechamentos: atual.fechamentos, totalVales: atual.totalVales }) : null),
    [atual],
  )

  const resumo = useMemo(() => {
    const { inicio, fim } = limitesDoMes(mes)
    const hoje = hojeLocal()
    const ate = fim < hoje ? fim : hoje
    const comFechamento = new Set(linhas.map((l) => l.data))
    return {
      caixa: somarValores(linhas.map((l) => l.totalCaixaDia)),
      sistema: somarValores(linhas.map((l) => l.totalSistemaDia)),
      diferenca: somarValores(linhas.map((l) => l.diferencaFinalDia)),
      faltou: linhas.filter((l) => l.diferencaFinalDia < -0.005),
      sobrou: linhas.filter((l) => l.diferencaFinalDia > 0.005).length,
      marmitas: vendasPorPrato.reduce((acc, [, q]) => acc + q, 0),
      semFechamento: inicio <= ate ? datasEntre(inicio, ate).filter((d) => !comFechamento.has(d)) : [],
    }
  }, [linhas, vendasPorPrato, mes])

  const nomeAnterior = nomeMes(somarMeses(mes, -1)).split(' de ')[0]
  const hoje = hojeLocal()
  const comparacao = useMemo(
    () => (atual ? compararMeses({ mes, fechamentos: atual.fechamentos, fechamentosAnterior: atual.fechamentosAnterior, hoje }) : null),
    [atual, mes, hoje],
  )
  const diasGrafico = useMemo<DiaGrafico[]>(() => {
    const { inicio, fim } = limitesDoMes(mes)
    const ate = fim < hoje ? fim : hoje
    const porData = new Map(linhas.map((l) => [l.data, l]))
    return datasEntre(inicio, fim).map((d) => {
      const l = porData.get(d)
      return {
        data: d,
        vendas: l ? l.totalCaixaDia : d <= ate ? null : 0,
        diferenca: l?.diferencaFinalDia,
        status: l ? (Math.abs(l.diferencaFinalDia) < 0.005 ? 'fechou' : l.diferencaFinalDia > 0 ? 'sobrou' : 'faltou') : undefined,
      }
    })
  }, [linhas, mes, hoje])

  function trocarMes(novo: string) {
    if (mesValido(novo)) setParams({ mes: novo }, { replace: true })
  }

  async function exportarPdf(compartilhar = false) {
    setErroPdf(null)
    try {
      const pdf = await carregarPdf()
      const mediaAtual = linhas.length ? Math.round((resumo.caixa / linhas.length) * 100) / 100 : 0
      await pdf.gerarPdfMensal({
        compartilhar,
        grafico: { dias: diasGrafico, mediaAtual, mediaAnterior: comparacao?.mediaDiaAnteriorMesInteiro || null, rotuloAnterior: nomeAnterior },
        comparacao:
          comparacao && comparacao.anterior.vendas > 0
            ? {
                titulo: `Comparado com ${nomeAnterior}`,
                frase: fraseComparacao(comparacao, nomeAnterior),
                linhas: [
                  ['Vendas no caixa', formatarMoeda(comparacao.atual.vendas), formatarMoeda(comparacao.anterior.vendas), variacao(comparacao.atual.vendas, comparacao.anterior.vendas).texto],
                  ['Média por dia', formatarMoeda(comparacao.atual.mediaDia), formatarMoeda(comparacao.anterior.mediaDia), variacao(comparacao.atual.mediaDia, comparacao.anterior.mediaDia).texto],
                  ['Diferença (sobra/falta)', formatarMoeda(comparacao.atual.diferenca), formatarMoeda(comparacao.anterior.diferenca), ''],
                  ['Dias que faltou', String(comparacao.atual.diasFaltou), String(comparacao.anterior.diasFaltou), variacao(comparacao.atual.diasFaltou, comparacao.anterior.diasFaltou).texto],
                  ['Marmitas vendidas', String(comparacao.atual.marmitas), String(comparacao.anterior.marmitas), variacao(comparacao.atual.marmitas, comparacao.anterior.marmitas).texto],
                ],
              }
            : null,
        mes,
        linhas,
        vendasPorPrato,
        diasSemFechamento: resumo.semFechamento,
        totalVales: atual?.totalVales ?? null,
        retiradas,
      })
    } catch (e) {
      setErroPdf(mensagemErro(e, 'Não consegui gerar o PDF.'))
    }
  }

  const podeCompartilhar = podeCompartilharArquivos()
  const nome = nomeMes(mes)

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-24">
      <AbasResumo />
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Relatório mensal</h1>
        <div className="flex gap-2">
          {podeCompartilhar && (
            <button
              type="button"
              disabled={linhas.length === 0}
              onClick={() => exportarPdf(true)}
              className="flex items-center gap-1.5 rounded-xl bg-green-600 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              <Share2 size={16} /> Enviar
            </button>
          )}
          <button
            type="button"
            disabled={linhas.length === 0}
            onClick={() => exportarPdf()}
            className="flex items-center gap-1.5 rounded-xl bg-gray-900 dark:bg-gray-700 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            <FileDown size={16} /> PDF
          </button>
        </div>
      </header>

      <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-3 flex items-center gap-2">
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
            className="w-full max-w-[12rem] text-center rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-500"
            value={mes}
            onChange={(e) => trocarMes(e.target.value)}
          />
          <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">{nome.charAt(0).toUpperCase() + nome.slice(1)}</span>
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
      {erroPdf && <CaixaErro>{erroPdf}</CaixaErro>}
      {!atual && !erroAtual && <p className="text-sm text-gray-400 dark:text-gray-500">Carregando...</p>}

      {atual && (
        <>
          <section className="rounded-2xl bg-gray-900 dark:bg-gray-800 text-white p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400">Total do caixa</p>
                <p className="text-xl font-bold tabular-nums">{formatarMoeda(resumo.caixa)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Diferença do mês</p>
                <p className="text-xl font-bold tabular-nums">{formatarMoeda(resumo.diferenca)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Total do sistema</p>
                <p className="font-semibold tabular-nums">{formatarMoeda(resumo.sistema)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Marmitas vendidas</p>
                <p className="font-semibold tabular-nums">{resumo.marmitas}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              {linhas.length} dia(s) com fechamento · {linhas.length - resumo.faltou.length - resumo.sobrou} fecharam ·{' '}
              {resumo.sobrou} sobrou · {resumo.faltou.length} faltou
            </p>
            {atual.totalVales !== null && (
              <Link to={`/vales?mes=${mes}`} className="block text-xs text-gray-300 underline">
                Vales (adiantamentos) do mês: {formatarMoeda(atual.totalVales)}
              </Link>
            )}
          </section>

          {comparacao && linhas.length > 0 && (
            <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-3">
              <div>
                <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Comparado com {nomeAnterior}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">{fraseComparacao(comparacao, nomeAnterior)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { rotulo: 'Vendas', atual: formatarMoeda(comparacao.atual.vendas), antes: formatarMoeda(comparacao.anterior.vendas), v: variacao(comparacao.atual.vendas, comparacao.anterior.vendas) },
                  { rotulo: 'Média por dia', atual: formatarMoeda(comparacao.atual.mediaDia), antes: formatarMoeda(comparacao.anterior.mediaDia), v: variacao(comparacao.atual.mediaDia, comparacao.anterior.mediaDia) },
                  { rotulo: 'Marmitas', atual: String(comparacao.atual.marmitas), antes: String(comparacao.anterior.marmitas), v: variacao(comparacao.atual.marmitas, comparacao.anterior.marmitas) },
                  { rotulo: 'Dias que faltou', atual: String(comparacao.atual.diasFaltou), antes: String(comparacao.anterior.diasFaltou), v: variacao(comparacao.atual.diasFaltou, comparacao.anterior.diasFaltou), menor: true },
                ].map((k) => (
                  <div key={k.rotulo} className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{k.rotulo}</p>
                    <p className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{k.atual}</p>
                    <p className="text-[11px] text-gray-400 tabular-nums">antes {k.antes}</p>
                    <SeloVariacao v={k.v} menorEhMelhor={k.menor} />
                  </div>
                ))}
              </div>
              {comparacao.ateDia && (
                <p className="text-[11px] text-gray-400">Mês em andamento: comparando os dias 1 a {comparacao.ateDia} dos dois meses.</p>
              )}
            </section>
          )}

          {linhas.length > 0 && (
            <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-2">
              <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Vendas por dia</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">Toque numa coluna para ver o valor do dia.</p>
              <GraficoVendasDia
                dias={diasGrafico}
                mediaAtual={resumo.caixa && linhas.length ? Math.round((resumo.caixa / linhas.length) * 100) / 100 : 0}
                mediaAnterior={comparacao?.mediaDiaAnteriorMesInteiro || null}
                rotuloAnterior={`de ${nomeAnterior}`}
              />
            </section>
          )}

          {linhas.length > 0 && (
            <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-3">
              <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Como o caixa fechou</h2>
              <BarraResultados
                fechou={linhas.filter((l) => statusPorDiferenca(l.diferencaFinalDia) === 'fechou').length}
                sobrou={linhas.filter((l) => statusPorDiferenca(l.diferencaFinalDia) === 'sobrou').length}
                faltou={linhas.filter((l) => statusPorDiferenca(l.diferencaFinalDia) === 'faltou').length}
              />
              <GraficoSobraFalta dias={diasGrafico.map((d) => ({ data: d.data, diferenca: d.diferenca ?? null }))} />
            </section>
          )}

          {linhas.length > 0 && (
            <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-3">
              <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Como o dinheiro entrou</h2>
              <BarrasHorizontais itens={formasDePagamento(atual.fechamentos)} porcentagem total descricao="Vendas do mês por forma de pagamento" />
            </section>
          )}

          {retiradas && <RetiradasCaixa retiradas={retiradas} periodo="mês" />}

          {resumo.semFechamento.length > 0 && (
            <section className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200">
                <AlertCircle size={15} /> {resumo.semFechamento.length} dia(s) sem fechamento em {rotuloMes(mes)}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {resumo.semFechamento.map((d) => (
                  <Link
                    key={d}
                    to={`/novo?data=${d}`}
                    className="rounded-full bg-white/80 dark:bg-gray-900/60 px-2.5 py-1 text-xs font-medium text-amber-900 dark:text-amber-200"
                  >
                    {formatarDiaMes(d)}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {linhas.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum fechamento em {rotuloMes(mes)}.</p>}

          {linhas.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <caption className="sr-only">Fechamentos por dia</caption>
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[11px] uppercase">
                  <tr>
                    <th scope="col" className="text-left px-3 py-2">Dia</th>
                    <th scope="col" className="text-right px-3 py-2">Caixa</th>
                    <th scope="col" className="text-right px-3 py-2 hidden sm:table-cell">Sistema</th>
                    <th scope="col" className="text-right px-3 py-2">Diferença</th>
                    <th scope="col" className="text-center px-2 py-2">
                      <span className="sr-only">Relatório</span>
                      <FileText size={13} className="inline" aria-hidden />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const rel = relatorioPorData.get(l.data)
                    return (
                      <tr
                        key={l.data}
                        className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer"
                        onClick={() => navigate(`/fechamento/${l.fechamentoId}`)}
                      >
                        <td className="px-3 py-2.5">
                          <Link to={`/fechamento/${l.fechamentoId}`} onClick={(e) => e.stopPropagation()} className="font-medium">
                            {formatarDiaMes(l.data)}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatarMoeda(l.totalCaixaDia)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums hidden sm:table-cell">{formatarMoeda(l.totalSistemaDia)}</td>
                        <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${corDiferenca(l.diferencaFinalDia)}`}>
                          {formatarMoeda(l.diferencaFinalDia)}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <Link
                            to={rel ? `/relatorios/${rel.id}` : `/relatorios/novo?data=${l.data}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`inline-block p-1 ${rel ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-600'}`}
                            aria-label={rel ? `Ver relatório de ${formatarDiaMes(l.data)}` : `Criar relatório de ${formatarDiaMes(l.data)}`}
                          >
                            <FileText size={16} />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-800 font-semibold border-t border-gray-200 dark:border-gray-700">
                  <tr>
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatarMoeda(resumo.caixa)}</td>
                    <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">{formatarMoeda(resumo.sistema)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${corDiferenca(resumo.diferenca)}`}>{formatarMoeda(resumo.diferenca)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {vendasPorPrato.length > 0 && (
            <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-2">
              <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Pratos mais vendidos</h2>
              <BarrasHorizontais
                itens={vendasPorPrato.map(([prato, q]) => ({ rotulo: prato, valor: q }))}
                formato="numero"
                porcentagem
                total
                descricao="Marmitas vendidas no mês por prato"
              />
            </section>
          )}
        </>
      )}
    </div>
  )
}
