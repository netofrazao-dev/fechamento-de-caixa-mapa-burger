import { useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { FileText, History, Moon, PlusSquare, ScrollText, Sun } from 'lucide-react'
import NovoFechamento from './pages/NovoFechamento'
import Historico from './pages/Historico'
import FechamentoDetalhe from './pages/FechamentoDetalhe'
import RelatorioMensal from './pages/RelatorioMensal'
import Relatorios from './pages/Relatorios'
import RelatorioForm from './pages/RelatorioForm'
import { aplicarTema, lerTemaSalvo } from './lib/theme'

const abas = [
  { to: '/novo', label: 'Novo', icon: PlusSquare },
  { to: '/historico', label: 'Histórico', icon: History },
  { to: '/mensal', label: 'Mensal', icon: FileText },
  { to: '/relatorios', label: 'Relatórios', icon: ScrollText },
]

export default function App() {
  const [escuro, setEscuro] = useState(() => lerTemaSalvo() === 'dark')

  function alternarTema() {
    const novo = escuro ? 'light' : 'dark'
    aplicarTema(novo)
    setEscuro(novo === 'dark')
  }

  return (
    <div className="min-h-screen pb-16">
      <Routes>
        <Route path="/" element={<Navigate to="/novo" replace />} />
        <Route path="/novo" element={<NovoFechamento />} />
        <Route path="/historico" element={<Historico />} />
        <Route path="/mensal" element={<RelatorioMensal />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/relatorios/novo" element={<RelatorioForm />} />
        <Route path="/relatorios/:id" element={<RelatorioForm />} />
        <Route path="/fechamento/:id" element={<FechamentoDetalhe />} />
      </Routes>

      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex max-w-2xl mx-auto">
        {abas.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
              }`
            }
          >
            <Icon size={19} />
            {label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={alternarTema}
          className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-gray-400 dark:text-gray-500"
        >
          {escuro ? <Sun size={19} /> : <Moon size={19} />}
          {escuro ? 'Claro' : 'Escuro'}
        </button>
      </nav>
    </div>
  )
}
