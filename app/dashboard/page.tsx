// app/dashboard/page.tsx
// Página de exemplo usando o layout

export default function DashboardPage() {
  const cards = [
    { label: 'Total LC',     value: 'R$ 4.280,00', color: 'emerald' },
    { label: 'Total Brandy', value: 'R$ 3.150,00', color: 'blue'    },
    { label: 'Total Caixa',  value: 'R$ 7.430,00', color: 'violet'  },
    { label: 'Diferença',    value: 'R$ -12,50',   color: 'red'     },
  ]

  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    blue:    'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400',
    violet:  'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400',
    red:     'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
  }

  return (
    <div className="space-y-6">

      {/* Título */}
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Resumo do fechamento de hoje</p>
      </div>

      {/* Cards métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4"
          >
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{card.label}</p>
            <p className={`text-base font-semibold ${colorMap[card.color]}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabela últimos fechamentos */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Últimos fechamentos</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              {['Data', 'Total LC', 'Total Brandy', 'Diferença', 'Status'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {[
              { data: '21/05/2025', lc: 'R$ 4.280,00', brandy: 'R$ 3.150,00', dif: 'R$ -12,50', status: 'divergente' },
              { data: '20/05/2025', lc: 'R$ 5.100,00', brandy: 'R$ 2.980,00', dif: 'R$ 0,00',   status: 'aprovado'   },
              { data: '19/05/2025', lc: 'R$ 3.870,00', brandy: 'R$ 3.420,00', dif: 'R$ 0,00',   status: 'aprovado'   },
              { data: '18/05/2025', lc: 'R$ 4.560,00', brandy: 'R$ 3.100,00', dif: 'R$ 25,00',  status: 'conferido'  },
            ].map((row, i) => (
              <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.data}</td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.lc}</td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.brandy}</td>
                <td className={`px-4 py-3 font-medium ${row.dif === 'R$ 0,00' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                  {row.dif}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}

// ─── Badge de status ─────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    aprovado:   'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    conferido:  'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    divergente: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
    pendente:   'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium capitalize ${styles[status] ?? styles.pendente}`}>
      {status}
    </span>
  )
}