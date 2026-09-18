import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import NovoFechamento from './pages/NovoFechamento'
import Historico from './pages/Historico'
import FechamentoDetalhe from './pages/FechamentoDetalhe'
import RelatorioMensal from './pages/RelatorioMensal'

const linkClasse = ({ isActive }: { isActive: boolean }) =>
  `flex-1 text-center py-3 text-sm font-medium ${
    isActive ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400'
  }`

export default function App() {
  return (
    <div className="min-h-screen">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10 flex max-w-2xl mx-auto">
        <NavLink to="/novo" className={linkClasse}>
          Novo
        </NavLink>
        <NavLink to="/historico" className={linkClasse}>
          Histórico
        </NavLink>
        <NavLink to="/mensal" className={linkClasse}>
          Mensal
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/novo" replace />} />
        <Route path="/novo" element={<NovoFechamento />} />
        <Route path="/historico" element={<Historico />} />
        <Route path="/mensal" element={<RelatorioMensal />} />
        <Route path="/fechamento/:id" element={<FechamentoDetalhe />} />
      </Routes>
    </div>
  )
}
