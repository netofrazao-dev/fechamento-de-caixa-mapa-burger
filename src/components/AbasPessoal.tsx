import { NavLink } from 'react-router-dom'

/** Abas do topo: lançamento de vales e acerto do mês (vales + consumo). */
export default function AbasPessoal({ mes }: { mes: string }) {
  const aba = ({ isActive }: { isActive: boolean }) =>
    `flex-1 text-center rounded-lg py-2 text-sm font-semibold transition ${
      isActive ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
    }`
  return (
    <nav aria-label="Vales e acerto" className="flex gap-1 rounded-xl bg-gray-200/70 dark:bg-gray-800 p-1">
      <NavLink to={`/vales?mes=${mes}`} end className={aba}>
        Vales
      </NavLink>
      <NavLink to={`/acerto?mes=${mes}`} className={aba}>
        Acerto do mês
      </NavLink>
    </nav>
  )
}
