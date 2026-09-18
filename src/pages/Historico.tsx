import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarFechamentos } from '../lib/fechamentoService'
import { formatarMoeda, STATUS_COLOR, STATUS_LABEL } from '../lib/calculations'
import type { Fechamento } from '../types/fechamento'

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

export default function Historico() {
  const [dataInicio, setDataInicio] = useState(inicioDoMes())
  const [dataFim, setDataFim] = useState(hoje())
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro(null)
    listarFechamentos({ dataInicio, dataFim })
      .then((r) => {
        if (ativo) setFechamentos(r)
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
      {!carregando && fechamentos.length === 0 && (
        <p className="text-sm text-gray-400">Nenhum fechamento encontrado nesse período.</p>
      )}

      <div className="space-y-2">
        {fechamentos.map((f) => (
          <Link
            key={f.id}
            to={`/fechamento/${f.id}`}
            className="block rounded-2xl bg-white shadow-sm p-4 hover:shadow transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">
                  {formatarData(f.data)} — {TURNO_LABEL[f.turno]}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Caixa {formatarMoeda(f.resultado.totalCaixa)} · Sistema{' '}
                  {formatarMoeda(f.resultado.totalSistema)}
                </p>
              </div>
              <span
                className={`text-[11px] font-semibold rounded-full border px-2.5 py-1 shrink-0 ${STATUS_COLOR[f.resultado.status]}`}
              >
                {STATUS_LABEL[f.resultado.status]}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
