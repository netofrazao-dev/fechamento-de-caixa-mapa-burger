import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { excluirVale, listarVales } from '../lib/valeService'
import { formatarMoeda } from '../lib/calculations'
import { gerarPdfValesMensal } from '../lib/pdf'
import type { Vale } from '../types/fechamento'

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

function formatarDia(iso: string): string {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}

interface GrupoFuncionario {
  funcionario: string
  total: number
  vales: Vale[]
}

export default function Vales() {
  const [searchParams] = useSearchParams()
  const [mes, setMes] = useState(searchParams.get('mes') || mesAtual())
  const [vales, setVales] = useState<Vale[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [abertos, setAbertos] = useState<Set<string>>(new Set())

  async function carregar() {
    const { inicio, fim } = limitesDoMes(mes)
    setCarregando(true)
    setErro(null)
    try {
      setVales(await listarVales({ dataInicio: inicio, dataFim: fim }))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar vales.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes])

  const grupos = useMemo<GrupoFuncionario[]>(() => {
    const mapa = new Map<string, GrupoFuncionario>()
    for (const v of vales) {
      const g = mapa.get(v.funcionario) ?? { funcionario: v.funcionario, total: 0, vales: [] }
      g.total += v.valor
      g.vales.push(v)
      mapa.set(v.funcionario, g)
    }
    const lista = Array.from(mapa.values())
    lista.forEach((g) => g.vales.sort((a, b) => a.data.localeCompare(b.data)))
    return lista.sort((a, b) => a.funcionario.localeCompare(b.funcionario))
  }, [vales])

  const totalGeral = grupos.reduce((acc, g) => acc + g.total, 0)

  const mesLabel = useMemo(() => {
    const [ano, m] = mes.split('-')
    return `${m}/${ano}`
  }, [mes])

  function alternar(nome: string) {
    setAbertos((prev) => {
      const novo = new Set(prev)
      if (novo.has(nome)) novo.delete(nome)
      else novo.add(nome)
      return novo
    })
  }

  async function excluir(v: Vale) {
    if (!confirm(`Excluir o vale de ${formatarMoeda(v.valor)} de ${v.funcionario}?`)) return
    try {
      await excluirVale(v.id)
      setVales((prev) => prev.filter((x) => x.id !== v.id))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir vale.')
    }
  }

  function exportarPdf() {
    const ordenados = [...vales].sort(
      (a, b) => a.data.localeCompare(b.data) || a.funcionario.localeCompare(b.funcionario),
    )
    gerarPdfValesMensal({
      mesLabel,
      totaisPorFuncionario: grupos.map((g) => ({ funcionario: g.funcionario, total: g.total })),
      vales: ordenados,
    })
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-24">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Vales</h1>
        <Link
          to={`/vales/novo?mes=${mes}`}
          className="flex items-center gap-1.5 rounded-xl bg-gray-900 dark:bg-gray-700 px-3.5 py-2 text-sm font-medium text-white"
        >
          <Plus size={16} /> Novo vale
        </Link>
      </header>

      <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 flex items-center justify-between gap-3">
        <label className="flex flex-col gap-1 flex-1">
          <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Mês</span>
          <input
            type="month"
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-400"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={vales.length === 0}
          onClick={exportarPdf}
          className="rounded-xl bg-gray-900 dark:bg-gray-700 px-4 py-2.5 text-white text-sm font-semibold disabled:opacity-40 self-end"
        >
          Exportar PDF
        </button>
      </section>

      {erro && <div className="rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-400">{erro}</div>}
      {carregando && <p className="text-sm text-gray-400 dark:text-gray-500">Carregando...</p>}
      {!carregando && grupos.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum vale registrado nesse mês.</p>
      )}

      {grupos.length > 0 && (
        <div className="rounded-2xl bg-gray-900 dark:bg-gray-800 text-white p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Total de vales em {mesLabel}</p>
            <p className="text-2xl font-bold">{formatarMoeda(totalGeral)}</p>
          </div>
          <p className="text-xs text-gray-400">
            {vales.length} vale(s) · {grupos.length} funcionário(s)
          </p>
        </div>
      )}

      <div className="space-y-2">
        {grupos.map((g) => {
          const aberto = abertos.has(g.funcionario)
          return (
            <section key={g.funcionario} className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => alternar(g.funcionario)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left"
              >
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{g.funcionario}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{g.vales.length} vale(s)</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 dark:text-gray-100">{formatarMoeda(g.total)}</span>
                  <ChevronDown
                    size={18}
                    className={`text-gray-400 dark:text-gray-500 transition-transform ${aberto ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              {aberto && (
                <div className="px-4 pb-3 space-y-1 border-t border-gray-100 dark:border-gray-800 pt-2">
                  {g.vales.map((v) => (
                    <div key={v.id} className="flex items-center gap-2 py-1.5 text-sm">
                      <span className="w-12 shrink-0 text-gray-500 dark:text-gray-400">{formatarDia(v.data)}</span>
                      <span className="flex-1 min-w-0 truncate text-gray-400 dark:text-gray-500 text-xs">
                        {v.observacao || ''}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{formatarMoeda(v.valor)}</span>
                      <button
                        type="button"
                        onClick={() => excluir(v)}
                        className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500"
                        aria-label="Excluir vale"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
