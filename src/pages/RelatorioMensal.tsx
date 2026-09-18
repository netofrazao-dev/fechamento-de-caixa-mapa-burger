import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarFechamentos } from '../lib/fechamentoService'
import { formatarMoeda } from '../lib/calculations'
import { gerarPdfMensal, type LinhaRelatorioMensal } from '../lib/pdf'
import type { Fechamento } from '../types/fechamento'

function mesAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [ano, m] = mes.split('-').map(Number)
  const inicio = `${ano}-${String(m).padStart(2, '0')}-01`
  const ultimoDia = new Date(ano, m, 0).getDate()
  const fim = `${ano}-${String(m).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
  return { inicio, fim }
}

function formatarData(iso: string): string {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}

function agruparPorDia(fechamentos: Fechamento[]): LinhaRelatorioMensal[] {
  const porDia = new Map<string, LinhaRelatorioMensal>()
  for (const f of fechamentos) {
    const atual = porDia.get(f.data) ?? {
      data: f.data,
      totalCaixaDia: 0,
      totalSistemaDia: 0,
      diferencaFinalDia: 0,
    }
    if (f.turno === 'manha') atual.manha = f
    if (f.turno === 'noite') atual.noite = f
    atual.totalCaixaDia += f.resultado.totalCaixa
    atual.totalSistemaDia += f.resultado.totalSistema
    atual.diferencaFinalDia += f.resultado.diferencaFinal
    porDia.set(f.data, atual)
  }
  return Array.from(porDia.values()).sort((a, b) => a.data.localeCompare(b.data))
}

export default function RelatorioMensal() {
  const [mes, setMes] = useState(mesAtual())
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const { inicio, fim } = limitesDoMes(mes)
    let ativo = true
    setCarregando(true)
    setErro(null)
    listarFechamentos({ dataInicio: inicio, dataFim: fim })
      .then((r) => {
        if (ativo) setFechamentos(r)
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : 'Erro ao carregar relatório.')
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [mes])

  const linhas = useMemo(() => agruparPorDia(fechamentos), [fechamentos])

  const totais = useMemo(
    () => ({
      caixa: linhas.reduce((acc, l) => acc + l.totalCaixaDia, 0),
      sistema: linhas.reduce((acc, l) => acc + l.totalSistemaDia, 0),
      diferenca: linhas.reduce((acc, l) => acc + l.diferencaFinalDia, 0),
    }),
    [linhas],
  )

  const mesLabel = useMemo(() => {
    const [ano, m] = mes.split('-')
    return `${m}/${ano}`
  }, [mes])

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Relatório Mensal</h1>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between gap-3">
        <label className="flex flex-col gap-1 flex-1">
          <span className="text-sm font-medium text-gray-700">Mês</span>
          <input
            type="month"
            className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-gray-900"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={linhas.length === 0}
          onClick={() => gerarPdfMensal({ mesLabel, linhas })}
          className="rounded-lg bg-gray-900 px-4 py-2 text-white text-sm font-semibold disabled:opacity-40 self-end"
        >
          Exportar PDF
        </button>
      </section>

      {erro && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}
      {carregando && <p className="text-sm text-gray-400">Carregando...</p>}
      {!carregando && linhas.length === 0 && (
        <p className="text-sm text-gray-400">Nenhum fechamento nesse mês.</p>
      )}

      {linhas.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Dia</th>
                <th className="text-right px-3 py-2">Caixa</th>
                <th className="text-right px-3 py-2">Sistema</th>
                <th className="text-right px-3 py-2">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.data} className="border-t border-gray-100">
                  <td className="px-3 py-2">{formatarData(l.data)}</td>
                  <td className="px-3 py-2 text-right">{formatarMoeda(l.totalCaixaDia)}</td>
                  <td className="px-3 py-2 text-right">{formatarMoeda(l.totalSistemaDia)}</td>
                  <td
                    className={`px-3 py-2 text-right font-medium ${
                      Math.abs(l.diferencaFinalDia) < 0.005
                        ? 'text-green-600'
                        : l.diferencaFinalDia > 0
                          ? 'text-blue-600'
                          : 'text-red-600'
                    }`}
                  >
                    {formatarMoeda(l.diferencaFinalDia)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold border-t border-gray-200">
              <tr>
                <td className="px-3 py-2">Total do mês</td>
                <td className="px-3 py-2 text-right">{formatarMoeda(totais.caixa)}</td>
                <td className="px-3 py-2 text-right">{formatarMoeda(totais.sistema)}</td>
                <td className="px-3 py-2 text-right">{formatarMoeda(totais.diferenca)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Clique num dia no <Link to="/historico" className="underline">histórico</Link> para ver o
        fechamento completo de manhã/noite.
      </p>
    </div>
  )
}
