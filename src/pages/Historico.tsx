import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, FileText, Plus } from 'lucide-react'
import { listarFechamentos } from '../lib/fechamentoService'
import { listarRelatorios } from '../lib/relatorioService'
import { formatarMoeda, STATUS_COLOR, STATUS_LABEL } from '../lib/calculations'
import { mensagemErro } from '../lib/erros'
import { somarValores, dataValida } from '../lib/vales'
import { CaixaErro } from '../components/Avisos'
import type { Fechamento, RelatorioDiario } from '../types/fechamento'
import {
  dataLocal,
  datasEntre,
  diaDaSemana,
  formatarDataBr,
  formatarDiaMes,
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

  const [dados, setDados] = useState<{ chave: string; fechamentos: Fechamento[]; relatorios: RelatorioDiario[] } | null>(null)
  const [erro, setErro] = useState<{ chave: string; mensagem: string } | null>(null)
  const chave = `${dataInicio}|${dataFim}`

  function mudarPeriodo(de: string, ate: string) {
    setParams({ de, ate }, { replace: true })
  }

  useEffect(() => {
    if (periodoInvalido) return
    let ativo = true
    Promise.all([listarFechamentos({ dataInicio, dataFim }), listarRelatorios({ dataInicio, dataFim })])
      .then(([fechamentos, relatorios]) => {
        if (ativo) setDados({ chave: `${dataInicio}|${dataFim}`, fechamentos, relatorios })
      })
      .catch((e) => {
        if (ativo) setErro({ chave: `${dataInicio}|${dataFim}`, mensagem: mensagemErro(e, 'Erro ao carregar o histórico.') })
      })
    return () => {
      ativo = false
    }
  }, [dataInicio, dataFim, periodoInvalido])

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
    const semFechamento = dataInicio <= ate ? datasEntre(dataInicio, ate).filter((d) => !comFechamento.has(d)) : []
    return {
      caixa: somarValores(fs.map((f) => f.resultado.totalCaixa)),
      diferenca: somarValores(fs.map((f) => f.resultado.diferencaFinal)),
      faltou: fs.filter((f) => f.resultado.status === 'faltou').length,
      sobrou: fs.filter((f) => f.resultado.status === 'sobrou').length,
      semFechamento,
    }
  }, [atual, dataInicio, dataFim])

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
      </section>

      {periodoInvalido && <CaixaErro>A data "De" está depois da data "Até". Ajuste o período.</CaixaErro>}
      {erroAtual && <CaixaErro>{erroAtual}</CaixaErro>}
      {carregando && <p className="text-sm text-gray-400 dark:text-gray-500">Carregando...</p>}

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

      {resumo && resumo.semFechamento.length > 0 && (
        <section className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200">
            <AlertCircle size={15} /> {resumo.semFechamento.length} dia(s) sem fechamento no período
          </p>
          <div className="flex flex-wrap gap-1.5">
            {resumo.semFechamento.slice(-31).map((d) => (
              <Link
                key={d}
                to={`/novo?data=${d}`}
                title={`Lançar fechamento de ${formatarDataBr(d)}`}
                className="rounded-full bg-white/80 dark:bg-gray-900/60 px-2.5 py-1 text-xs font-medium text-amber-900 dark:text-amber-200"
              >
                {formatarDiaMes(d)}
              </Link>
            ))}
          </div>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">Toque num dia para lançar o fechamento dele (se a loja abriu).</p>
        </section>
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
    </div>
  )
}
