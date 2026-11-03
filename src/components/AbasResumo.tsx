import { NavLink } from 'react-router-dom'

/** Abas do topo dos resumos: semana e mês. */
export default function AbasResumo() {
  const aba = ({ isActive }: { isActive: boolean }) =>
    `flex-1 text-center rounded-lg py-2 text-sm font-semibold transition ${
      isActive ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
    }`
  return (
    <nav aria-label="Resumo por semana ou por mês" className="flex gap-1 rounded-xl bg-gray-200/70 dark:bg-gray-800 p-1">
      <NavLink to="/semanal" className={aba}>
        Semana
      </NavLink>
      <NavLink to="/mensal" className={aba}>
        Mês
      </NavLink>
    </nav>
  )
}
