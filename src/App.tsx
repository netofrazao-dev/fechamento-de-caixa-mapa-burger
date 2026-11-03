import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import {
  BarChart3,
  History,
  Home,
  LogOut,
  Moon,
  PlusSquare,
  ScrollText,
  Settings,
  Smartphone,
  Sun,
  UserCircle2,
  Wallet,
  WifiOff,
} from 'lucide-react'
import { aplicarTema, lerTemaSalvo } from './lib/theme'
import { useAuth } from './lib/auth'
import { useOnline } from './lib/useOnline'
import { useInstalarApp } from './lib/instalar'
import { supabaseConfigurado } from './lib/supabase'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './pages/Login'
import RedefinirSenha from './pages/RedefinirSenha'

// Cada tela é baixada só quando é aberta (app abre mais rápido no celular).
const Hoje = lazy(() => import('./pages/Hoje'))
const NovoFechamento = lazy(() => import('./pages/NovoFechamento'))
const Historico = lazy(() => import('./pages/Historico'))
const FechamentoDetalhe = lazy(() => import('./pages/FechamentoDetalhe'))
const RelatorioMensal = lazy(() => import('./pages/RelatorioMensal'))
const RelatorioSemanal = lazy(() => import('./pages/RelatorioSemanal'))
const Relatorios = lazy(() => import('./pages/Relatorios'))
const RelatorioForm = lazy(() => import('./pages/RelatorioForm'))
const Vales = lazy(() => import('./pages/Vales'))
const NovoVale = lazy(() => import('./pages/NovoVale'))
const Cadastros = lazy(() => import('./pages/Cadastros'))
const Acerto = lazy(() => import('./pages/Acerto'))

const abas = [
  { to: '/hoje', label: 'Hoje', icon: Home },
  { to: '/novo', label: 'Fechar', icon: PlusSquare },
  { to: '/historico', label: 'Histórico', icon: History },
  { to: '/mensal', label: 'Resumos', icon: BarChart3 },
  { to: '/relatorios', label: 'Relatórios', icon: ScrollText },
  { to: '/vales', label: 'Vales', icon: Wallet },
]

function Carregando() {
  return (
    <div className="max-w-2xl mx-auto p-4 text-sm text-gray-400 dark:text-gray-500" role="status">
      Carregando...
    </div>
  )
}

function NaoEncontrado() {
  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-6 text-center space-y-3">
        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">Página não encontrada</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">O endereço pode estar errado ou o item foi removido.</p>
        <Link to="/hoje" className="inline-block rounded-xl bg-gray-900 dark:bg-gray-700 px-4 py-2.5 text-sm font-semibold text-white">
          Ir para o início
        </Link>
      </div>
    </div>
  )
}

function TelaAviso({ titulo, texto, acao }: { titulo: string; texto: string; acao?: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div role="alert" className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-6 space-y-3 text-center">
        <img src="/logo.png" alt="" className="w-14 h-14 rounded-full object-cover mx-auto" />
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{titulo}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{texto}</p>
        {acao}
      </div>
    </main>
  )
}

function MenuConta({ escuro, alternarTema }: { escuro: boolean; alternarTema: () => void }) {
  const { email, sair } = useAuth()
  const instalar = useInstalarApp()
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fecha ao tocar fora ou com Esc
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  const item = 'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label="Menu da conta"
        className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-gray-800"
      >
        <UserCircle2 size={24} />
      </button>
      {aberto && (
        <div role="menu" className="absolute right-0 mt-1 w-64 rounded-xl bg-white dark:bg-gray-900 shadow-lg ring-1 ring-black/5 dark:ring-white/10 p-1.5 z-30">
          <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 truncate" title={email ?? ''}>
            {email}
          </p>
          <Link to="/cadastros" role="menuitem" className={item} onClick={() => setAberto(false)}>
            <Settings size={16} /> Cadastros, cópias e conta
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              alternarTema()
              setAberto(false)
            }}
            className={item}
          >
            {escuro ? <Sun size={16} /> : <Moon size={16} />} {escuro ? 'Tema claro' : 'Tema escuro'}
          </button>
          {instalar.podeInstalar && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAberto(false)
                instalar.instalar()
              }}
              className={item}
            >
              <Smartphone size={16} /> Instalar app no celular
            </button>
          )}
          <button type="button" role="menuitem" onClick={sair} className={`${item} text-red-600 dark:text-red-400`}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      )}
    </div>
  )
}

function Sistema() {
  const [escuro, setEscuro] = useState(() => lerTemaSalvo() === 'dark')
  const online = useOnline()
  const { pathname } = useLocation()

  function alternarTema() {
    const novo = escuro ? 'light' : 'dark'
    aplicarTema(novo)
    setEscuro(novo === 'dark')
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="flex items-center gap-2 px-4 py-2 max-w-2xl mx-auto">
        <Link to="/hoje" className="flex items-center gap-2 min-w-0">
          <img src="/logo.png" alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
          <span className="font-bold text-gray-900 dark:text-gray-100 tracking-tight">Mapa Burger</span>
        </Link>
        <div className="ml-auto">
          <MenuConta escuro={escuro} alternarTema={alternarTema} />
        </div>
      </header>

      {!online && (
        <div role="status" className="max-w-2xl mx-auto px-4">
          <div className="flex items-center gap-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 px-3.5 py-2.5 text-sm text-amber-900 dark:text-amber-200">
            <WifiOff size={16} className="shrink-0" />
            Sem internet. Você pode continuar preenchendo (fica no rascunho), mas só dá para salvar quando a conexão voltar.
          </div>
        </div>
      )}

      <ErrorBoundary>
        <Suspense fallback={<Carregando />}>
          <Routes>
            <Route path="/" element={<Navigate to="/hoje" replace />} />
            <Route path="/hoje" element={<Hoje />} />
            <Route path="/novo" element={<NovoFechamento key="novo" />} />
            <Route path="/historico" element={<Historico />} />
            <Route path="/mensal" element={<RelatorioMensal />} />
            <Route path="/semanal" element={<RelatorioSemanal />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/relatorios/novo" element={<RelatorioForm key="novo" />} />
            <Route path="/relatorios/:id" element={<RelatorioForm key="editar" />} />
            <Route path="/fechamento/:id" element={<FechamentoDetalhe />} />
            <Route path="/fechamento/:id/editar" element={<NovoFechamento key="editar" />} />
            <Route path="/vales" element={<Vales />} />
            <Route path="/vales/novo" element={<NovoVale key="novo" />} />
            <Route path="/vales/:id/editar" element={<NovoVale key="editar" />} />
            <Route path="/cadastros" element={<Cadastros />} />
            <Route path="/acerto" element={<Acerto />} />
            <Route path="*" element={<NaoEncontrado />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>

      <nav
        aria-label="Navegação principal"
        className="fixed bottom-0 left-0 right-0 z-20 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex max-w-2xl mx-auto">
          {abas.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium ${
                  isActive || (to === '/vales' && pathname.startsWith('/acerto')) || (to === '/mensal' && pathname.startsWith('/semanal'))
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-400 dark:text-gray-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive || (to === '/vales' && pathname.startsWith('/acerto')) || (to === '/mensal' && pathname.startsWith('/semanal')) ? 2.4 : 1.8} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default function App() {
  const { carregando, sessao, autorizado, sair } = useAuth()
  const { pathname, hash } = useLocation()

  if (!supabaseConfigurado) {
    return (
      <TelaAviso
        titulo="Sistema não configurado"
        texto="Faltam as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (no arquivo .env ou nas configurações da Vercel)."
      />
    )
  }
  // Link do e-mail "Esqueci minha senha" (também se o Supabase mandar para a raiz do site).
  if (pathname === '/redefinir-senha' || /type=recovery|error_code=/.test(hash)) return <RedefinirSenha />
  if (carregando) return <Carregando />
  if (!sessao) return <Login />
  if (autorizado === false) {
    return (
      <TelaAviso
        titulo="Acesso não autorizado"
        texto="Seu login funciona, mas este e-mail não está na lista de pessoas autorizadas a usar o sistema. Peça ao responsável para incluir você."
        acao={
          <button type="button" onClick={sair} className="rounded-xl bg-gray-900 dark:bg-gray-700 px-4 py-2.5 text-sm font-semibold text-white">
            Sair
          </button>
        }
      />
    )
  }
  return <Sistema />
}
