import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Plus } from 'lucide-react'
import { listarRelatorios } from '../lib/relatorioService'
import type { RelatorioDiario } from '../types/fechamento'

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export default function Relatorios() {
  const [relatorios, setRelatorios] = useState<RelatorioDiario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    listarRelatorios()
      .then(setRelatorios)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar relatórios.'))
      .finally(() => setCarregando(false))
  }, [])

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-24">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Relatórios</h1>
        <Link
          to="/relatorios/novo"
          className="flex items-center gap-1.5 rounded-xl bg-gray-900 dark:bg-gray-700 px-3.5 py-2 text-sm font-medium text-white"
        >
          <Plus size={16} /> Novo
        </Link>
      </header>

      {erro && <div className="rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-400">{erro}</div>}
      {carregando && <p className="text-sm text-gray-400 dark:text-gray-500">Carregando...</p>}
      {!carregando && relatorios.length === 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-8 text-center space-y-2">
          <FileText className="mx-auto text-gray-300 dark:text-gray-600" size={28} />
          <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum relatório criado ainda.</p>
        </div>
      )}

      <div className="space-y-2">
        {relatorios.map((r) => (
          <Link
            key={r.id}
            to={`/relatorios/${r.id}`}
            className="block rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 hover:shadow transition"
          >
            <p className="font-semibold text-gray-900 dark:text-gray-100">{formatarData(r.data)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {r.quantidadeVendida} vendidas · {r.funcionariosQueComeram.length} funcionário(s) comeram
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
