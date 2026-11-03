import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, ChevronLeft, ChevronRight, FileDown, FileText, Share2 } from 'lucide-react'
import AbasResumo from '../components/AbasResumo'
import GraficoVendasDia, { type DiaGrafico } from '../components/GraficoVendasDia'
import GraficoSobraFalta from '../components/graficos/GraficoSobraFalta'
import BarrasHorizontais from '../components/graficos/BarrasHorizontais'
import BarraResultados from '../components/graficos/BarraResultados'
import { CaixaErro } from '../components/Avisos'
import { listarFechamentos } from '../lib/fechamentoService'
import { listarRelatorios } from '../lib/relatorioService'
import { listarValesDoMes } from '../lib/valeService'
import { agregarVendasPorPrato, formatarMoeda } from '../lib/calculations'
import { formasDePagamento, resumoDoMes, statusPorDiferenca } from '../lib/relatorioResumo'
import { variacao, type Variacao } from '../lib/comparacao'
import { compararSemanas, diasDaSemana, fimDaSemana, fraseComparacaoSemana, rotuloSemana, semanaDe, somarSemanas } from '../lib/semana'
import { carregarPdf } from '../lib/pdfSobDemanda'
import { podeCompartilharArquivos } from '../lib/arquivos'
import { mensagemErro } from '../lib/erros'
import { somarValores } from '../lib/vales'
import { diaDaSemana, formatarDiaMes, hojeLocal } from '../lib/datas'
import type { Fechamento, RelatorioDiario } from '../types/fechamento'
import type { LinhaRelatorioMensal } from '../lib/pdf'

interface Dados {
  inicio: string
  fechamentos: Fechamento[]
  anterior: Fechamento[]
  relatorios: RelatorioDiario[]
  totalVales: number | null
}

function Selo({ v, menorEhMelhor }: { v: Variacao; menorEhMelhor?: boolean }) {
  if (v.sentido === 'sem-base') return <span className="text-[11px] text-gray-400">sem base</span>
  if (v.sentido === 'igual') return <span className="text-[11px] text-gray-500">= igual</span>
  const bom = menorEhMelhor ? v.sentido === 'caiu' : v.sentido === 'subiu'
  return (
    <span className={`text-[11px] font-semibold ${bom ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {v.sentido === 'subiu' ? '▲' : '▼'} {v.texto}
    </span>
  )
}

const caixa = 'rounded-2xl bg-white dark:bg-gray-900 shadow-sm'

export default function RelatorioSemanal() {
  const [params, setParams] = useSearchParams()
  const hoje = hojeLocal()
  const inicio = semanaDe(params.get('inicio'), hoje)
  const fim = fimDaSemana(inicio)
  const inicioAnt = somarSemanas(inicio, -1)

  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState<{ inicio: string; mensagem: string } | null>(null)
  const [erroPdf, setErroPdf] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    const meses = Array.from(new Set([inicio.slice(0, 7), fim.slice(0, 7)]))
    Promise.all([
      listarFechamentos({ dataInicio: inicio, dataFim: fim }),
      listarFechamentos({ dataInicio: inicioAnt, dataFim: fimDaSemana(inicioAnt) }).catch(() => [] as Fechamento[]),
      listarRelatorios({ dataInicio: inicio, dataFim: fim }).catch(() => [] as RelatorioDiario[]),
      Promise.all(meses.map((m) => listarValesDoMes(m)))
        .then((l) => somarValores(l.flat().filter((v) => !v.excluidoEm && v.data >= inicio && v.data <= fim).map((v) => v.valor)))
        .catch(() => null),
    ])
      .then(([fechamentos, anterior, relatorios, totalVales]) => {
        if (ativo) setDados({ inicio, fechamentos, anterior, relatorios, totalVales })
      })
      .catch((e) => ativo && setErro({ inicio, mensagem: mensagemErro(e, 'Erro ao carregar a semana.') }))
    return () => {
      ativo = false
    }
  }, [inicio, fim, inicioAnt])

  const atual = dados?.inicio === inicio ? dados : null
  const erroAtual = erro?.inicio === inicio ? erro.mensagem : null

  const linhas = useMemo<(LinhaRelatorioMensal & { id: string })[]>(() => {
    const porDia = new Map<string, Fechamento[]>()
    for (const f of atual?.fechamentos ?? []) porDia.set(f.data, [...(porDia.get(f.data) ?? []), f])
    return [...porDia.entries()]
      .map(([data, fs]) => ({
        data,
        id: fs[0].id,
        manha: fs.find((f) => f.turno === 'manha'),
        noite: fs.find((f) => f.turno === 'noite'),
        totalCaixaDia: somarValores(fs.map((f) => f.resultado.totalCaixa)),
        totalSistemaDia: somarValores(fs.map((f) => f.resultado.totalSistema)),
        diferencaFinalDia: somarValores(fs.map((f) => f.resultado.diferencaFinal)),
      }))
      .sort((a, b) => a.data.localeCompare(b.data))
  }, [atual])

  const dias = diasDaSemana(inicio)
  const porData = new Map(linhas.map((l) => [l.data, l]))
  const diasGrafico: DiaGrafico[] = dias.map((d) => {
    const l = porData.get(d)
    return {
      data: d,
      vendas: l ? l.totalCaixaDia : d <= hoje ? null : 0,
      diferenca: l?.diferencaFinalDia,
      status: l ? statusPorDiferenca(l.diferencaFinalDia) : undefined,
    }
  })
  const semFechamento = dias.filter((d) => d <= hoje && !porData.has(d))
  const vendasPorPrato = agregarVendasPorPrato(atual?.fechamentos ?? [])
  const totalMarmitas = vendasPorPrato.reduce((a, [, q]) => a + q, 0)
  const total = somarValores(linhas.map((l) => l.totalCaixaDia))
  const sistema = somarValores(linhas.map((l) => l.totalSistemaDia))
  const diferenca = somarValores(linhas.map((l) => l.diferencaFinalDia))
  const contagem = {
    fechou: linhas.filter((l) => statusPorDiferenca(l.diferencaFinalDia) === 'fechou').length,
    sobrou: linhas.filter((l) => statusPorDiferenca(l.diferencaFinalDia) === 'sobrou').length,
    faltou: linhas.filter((l) => statusPorDiferenca(l.diferencaFinalDia) === 'faltou').length,
  }
  const mediaDia = linhas.length ? Math.round((total / linhas.length) * 100) / 100 : 0
  const comparacao = atual ? compararSemanas({ inicio, fechamentos: atual.fechamentos, fechamentosAnterior: atual.anterior, hoje }) : null
  const relatorioPorData = new Map((atual?.relatorios ?? []).map((r) => [r.data, r]))

  function trocar(novo: string) {
    setParams({ inicio: novo }, { replace: true })
  }

  async function exportarPdf(compartilhar = false) {
    setErroPdf(null)
    try {
      const pdf = await carregarPdf()
      await pdf.gerarPdfSemanal({
        inicio,
        fim,
        linhas,
        vendasPorPrato,
        diasSemFechamento: semFechamento,
        totalVales: atual?.totalVales ?? null,
        compartilhar,
        grafico: {
          dias: diasGrafico,
          mediaAtual: mediaDia,
          mediaAnterior: comparacao?.mediaDiaAnteriorInteira || null,
          rotuloAnterior: 'semana passada',
          rotuloMedia: 'Média da semana',
        },
        comparacao:
          comparacao && comparacao.anterior.vendas > 0
            ? {
                titulo: 'Comparado com a semana passada',
                frase: fraseComparacaoSemana(comparacao),
                linhas: [
                  ['Vendas no caixa', formatarMoeda(comparacao.atual.vendas), formatarMoeda(comparacao.anterior.vendas), variacao(comparacao.atual.vendas, comparacao.anterior.vendas).texto],
                  ['Média por dia', formatarMoeda(comparacao.atual.mediaDia), formatarMoeda(comparacao.anterior.mediaDia), variacao(comparacao.atual.mediaDia, comparacao.anterior.mediaDia).texto],
                  ['Diferença (sobra/falta)', formatarMoeda(comparacao.atual.diferenca), formatarMoeda(comparacao.anterior.diferenca), ''],
                  ['Dias que faltou', String(comparacao.atual.diasFaltou), String(comparacao.anterior.diasFaltou), variacao(comparacao.atual.diasFaltou, comparacao.anterior.diasFaltou).texto],
                  ['Marmitas vendidas', String(comparacao.atual.marmitas), String(comparacao.anterior.marmitas), variacao(comparacao.atual.marmitas, comparacao.anterior.marmitas).texto],
                ],
              }
            : null,
      })
    } catch (e) {
      setErroPdf(mensagemErro(e, 'Não consegui gerar o PDF.'))
    }
  }

  const podeCompartilhar = podeCompartilharArquivos()
  const frases = resumoDoMes({ dias: linhas, diasSemFechamento: semFechamento.length, totalMarmitas, periodo: 'a semana' })

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-24">
      <AbasResumo />
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Relatório da semana</h1>
        <div className="flex gap-2">
          {podeCompartilhar && (
            <button type="button" disabled={!linhas.length} onClick={() => exportarPdf(true)} className="flex items-center gap-1.5 rounded-xl bg-green-600 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40">
              <Share2 size={16} /> Enviar
            </button>
          )}
          <button type="button" disabled={!linhas.length} onClick={() => exportarPdf()} className="flex items-center gap-1.5 rounded-xl bg-gray-900 dark:bg-gray-700 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40">
            <FileDown size={16} /> PDF
          </button>
        </div>
      </header>

      <section className={`${caixa} p-3 flex items-center gap-2`}>
        <button type="button" onClick={() => trocar(somarSemanas(inicio, -1))} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Semana anterior">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{rotuloSemana(inicio)}</p>
          <p className="text-xs text-gray-400">segunda a domingo{inicio <= hoje && hoje <= fim ? ' · semana atual' : ''}</p>
        </div>
        <button
          type="button"
          onClick={() => trocar(somarSemanas(inicio, 1))}
          disabled={somarSemanas(inicio, 1) > hoje}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
          aria-label="Próxima semana"
        >
          <ChevronRight size={18} />
        </button>
      </section>

      {erroAtual && <CaixaErro>{erroAtual}</CaixaErro>}
      {erroPdf && <CaixaErro>{erroPdf}</CaixaErro>}
      {!atual && !erroAtual && <p className="text-sm text-gray-400">Carregando...</p>}

      {atual && (
        <>
          <section className="rounded-2xl bg-gray-900 dark:bg-gray-800 text-white p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400">Vendas no caixa</p>
                <p className="text-xl font-bold tabular-nums">{formatarMoeda(total)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Sobra/falta da semana</p>
                <p className="text-xl font-bold tabular-nums">{formatarMoeda(diferenca)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Registrado no sistema</p>
                <p className="font-semibold tabular-nums">{formatarMoeda(sistema)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Marmitas vendidas</p>
                <p className="font-semibold tabular-nums">{totalMarmitas}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              {linhas.length} de 7 dia(s) com fechamento · média {formatarMoeda(mediaDia)} por dia
              {atual.totalVales ? ` · vales ${formatarMoeda(atual.totalVales)}` : ''}
            </p>
          </section>

          {linhas.length === 0 && <p className="text-sm text-gray-400">Nenhum fechamento nesta semana.</p>}

          {linhas.length > 0 && (
            <>
              <section className={`${caixa} p-4 space-y-2`}>
                <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Resumo</h2>
                <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300 list-disc pl-5">
                  {frases.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </section>

              {comparacao && (
                <section className={`${caixa} p-4 space-y-3`}>
                  <div>
                    <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Comparado com a semana passada</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{fraseComparacaoSemana(comparacao)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { r: 'Vendas', a: formatarMoeda(comparacao.atual.vendas), b: formatarMoeda(comparacao.anterior.vendas), v: variacao(comparacao.atual.vendas, comparacao.anterior.vendas) },
                      { r: 'Média por dia', a: formatarMoeda(comparacao.atual.mediaDia), b: formatarMoeda(comparacao.anterior.mediaDia), v: variacao(comparacao.atual.mediaDia, comparacao.anterior.mediaDia) },
                      { r: 'Marmitas', a: String(comparacao.atual.marmitas), b: String(comparacao.anterior.marmitas), v: variacao(comparacao.atual.marmitas, comparacao.anterior.marmitas) },
                      { r: 'Dias que faltou', a: String(comparacao.atual.diasFaltou), b: String(comparacao.anterior.diasFaltou), v: variacao(comparacao.atual.diasFaltou, comparacao.anterior.diasFaltou), menor: true },
                    ].map((k) => (
                      <div key={k.r} className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">{k.r}</p>
                        <p className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{k.a}</p>
                        <p className="text-[11px] text-gray-400 tabular-nums">antes {k.b}</p>
                        <Selo v={k.v} menorEhMelhor={k.menor} />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className={`${caixa} p-4 space-y-2`}>
                <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Vendas por dia</h2>
                <GraficoVendasDia
                  dias={diasGrafico}
                  mediaAtual={mediaDia}
                  mediaAnterior={comparacao?.mediaDiaAnteriorInteira || null}
                  rotuloAnterior="da semana passada"
                  rotuloMedia="Média da semana"
                />
              </section>

              <section className={`${caixa} p-4 space-y-3`}>
                <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Como o caixa fechou</h2>
                <BarraResultados {...contagem} />
                <GraficoSobraFalta dias={diasGrafico.map((d) => ({ data: d.data, diferenca: porData.has(d.data) ? (d.diferenca ?? null) : null }))} />
              </section>

              <section className={`${caixa} p-4 space-y-3`}>
                <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Como o dinheiro entrou</h2>
                <BarrasHorizontais itens={formasDePagamento(atual.fechamentos)} porcentagem total descricao="Vendas da semana por forma de pagamento" />
              </section>

              {vendasPorPrato.length > 0 && (
                <section className={`${caixa} p-4 space-y-3`}>
                  <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Marmitas por prato</h2>
                  <BarrasHorizontais
                    itens={vendasPorPrato.map(([prato, q]) => ({ rotulo: prato, valor: q }))}
                    formato="numero"
                    porcentagem
                    total
                    descricao="Marmitas vendidas na semana por prato"
                  />
                </section>
              )}
            </>
          )}

          {semFechamento.length > 0 && (
            <section className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200">
                <AlertCircle size={15} /> {semFechamento.length} dia(s) sem fechamento nesta semana
              </p>
              <div className="flex flex-wrap gap-1.5">
                {semFechamento.map((d) => (
                  <Link key={d} to={`/novo?data=${d}`} className="rounded-full bg-white/80 dark:bg-gray-900/60 px-2.5 py-1 text-xs font-medium text-amber-900 dark:text-amber-200">
                    {diaDaSemana(d).slice(0, 3)} {formatarDiaMes(d)}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {linhas.length > 0 && (
            <div className={`${caixa} overflow-hidden`}>
              <table className="w-full text-sm">
                <caption className="sr-only">Fechamentos da semana por dia</caption>
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[11px] uppercase">
                  <tr>
                    <th scope="col" className="text-left px-3 py-2">Dia</th>
                    <th scope="col" className="text-right px-3 py-2">Caixa</th>
                    <th scope="col" className="text-right px-3 py-2">Diferença</th>
                    <th scope="col" className="px-2 py-2"><span className="sr-only">Relatório</span></th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const st = statusPorDiferenca(l.diferencaFinalDia)
                    const rel = relatorioPorData.get(l.data)
                    return (
                      <tr key={l.data} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-2.5">
                          <Link to={`/fechamento/${l.id}`} className="font-medium">
                            {diaDaSemana(l.data).slice(0, 3)} {formatarDiaMes(l.data)}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatarMoeda(l.totalCaixaDia)}</td>
                        <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${st === 'fechou' ? 'text-green-600 dark:text-green-400' : st === 'sobrou' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatarMoeda(l.diferencaFinalDia)}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <Link
                            to={rel ? `/relatorios/${rel.id}` : `/relatorios/novo?data=${l.data}`}
                            className={`inline-block p-1 ${rel ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-600'}`}
                            aria-label={rel ? 'Ver relatório do dia' : 'Criar relatório do dia'}
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
                    <td className="px-3 py-2 text-right tabular-nums">{formatarMoeda(total)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatarMoeda(diferenca)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
