import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { listarFechamentos } from '../lib/fechamentoService'
import { listarRelatorios } from '../lib/relatorioService'
import { formatarMoeda, STATUS_COLOR, STATUS_LABEL } from '../lib/calculations'
import type { Fechamento, RelatorioDiario } from '../types/fechamento'

function inicioDoMes(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}
function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

const TURNO_LABEL: Record<'manha' | 'noite', string> = { manha: 'Manhã', noite: 'Noite' }

interface DiaAgrupado {
  data: string
  fechamentos: Fechamento[]
  relatorio?: RelatorioDiario
}

export default function Historico() {
  const [dataInicio, setDataInicio] = useState(inicioDoMes())
  const [dataFim, setDataFim] = useState(hoje())
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([])
  const [relatorios, setRelatorios] = useState<RelatorioDiario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro(null)
    Promise.all([
      listarFechamentos({ dataInicio, dataFim }),
      listarRelatorios({ dataInicio, dataFim }),
    ])
      .then(([f, r]) => {
        if (!ativo) return
        setFechamentos(f)
        setRelatorios(r)
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : 'Erro ao carregar histórico.')
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [dataInicio, dataFim])

  const dias = useMemo<DiaAgrupado[]>(() => {
    const porDia = new Map<string, DiaAgrupado>()
    for (const f of fechamentos) {
      const atual = porDia.get(f.data) ?? { data: f.data, fechamentos: [] }
      atual.fechamentos.push(f)
      porDia.set(f.data, atual)
    }
    for (const r of relatorios) {
      const atual = porDia.get(r.data) ?? { data: r.data, fechamentos: [] }
      atual.relatorio = r
      porDia.set(r.data, atual)
    }
    return Array.from(porDia.values()).sort((a, b) => b.data.localeCompare(a.data))
  }, [fechamentos, relatorios])

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Histórico</h1>
      </header>

      <section className="rounded-2xl bg-white shadow-sm p-4 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-600">De</span>
          <input
            type="date"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-600">Até</span>
          <input
            type="date"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </label>
      </section>

      {erro && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {carregando && <p className="text-sm text-gray-400">Carregando...</p>}
      {!carregando && dias.length === 0 && (
        <p className="text-sm text-gray-400">Nada encontrado nesse período.</p>
      )}

      <div className="space-y-2">
        {dias.map((dia) => (
          <div key={dia.data} className="rounded-2xl bg-white shadow-sm p-4 space-y-2">
            <p className="font-semibold text-gray-900">{formatarData(dia.data)}</p>

            <div className="flex flex-wrap gap-2">
              {dia.fechamentos
                .sort((a, b) => a.turno.localeCompare(b.turno))
                .map((f) => (
                  <Link
                    key={f.id}
                    to={`/fechamento/${f.id}`}
                    className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 hover:bg-gray-100 transition"
                  >
                    <span className="text-sm font-medium text-gray-700">{TURNO_LABEL[f.turno]}</span>
                    <span className="text-xs text-gray-400">{formatarMoeda(f.resultado.totalCaixa)}</span>
                    <span className={`text-[10px] font-semibold rounded-full border px-2 py-0.5 ${STATUS_COLOR[f.resultado.status]}`}>
                      {STATUS_LABEL[f.resultado.status]}
                    </span>
                  </Link>
                ))}

              <Link
                to={dia.relatorio ? `/relatorios/${dia.relatorio.id}` : `/relatorios/novo?data=${dia.data}`}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  dia.relatorio ? 'bg-gray-900 text-white' : 'bg-white border border-dashed border-gray-300 text-gray-400'
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
