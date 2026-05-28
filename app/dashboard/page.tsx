import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-0.5">Bem-vindo ao sistema de fechamento de caixa</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/dashboard/novo"
          className="flex items-center gap-4 p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-emerald-500/50 dark:hover:border-emerald-500/30 transition-all group">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-all shrink-0">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Novo Fechamento</p>
            <p className="text-xs text-zinc-400 mt-0.5">Registrar fechamento do dia</p>
          </div>
        </Link>

        <Link href="/dashboard/historico"
          className="flex items-center gap-4 p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-zinc-400 dark:hover:border-zinc-600 transition-all group">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 transition-all shrink-0">
            <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Histórico</p>
            <p className="text-xs text-zinc-400 mt-0.5">Ver todos os fechamentos</p>
          </div>
        </Link>
      </div>
    </div>
  )
}