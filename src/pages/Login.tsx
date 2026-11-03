import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (entrando) return
    setErro(null)
    if (!email.trim() || !senha) {
      setErro('Preencha o e-mail e a senha.')
      return
    }
    setEntrando(true)
    try {
      await entrar(email, senha)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível entrar.')
      setSenha('')
    } finally {
      setEntrando(false)
    }
  }

  const campo =
    'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-3 text-base outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-800'

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/logo.png" alt="" className="w-20 h-20 rounded-full object-cover shadow-sm" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mapa Burger</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Fechamento de caixa</p>
          </div>
        </div>

        <form onSubmit={enviar} className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-5 space-y-4" noValidate>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">E-mail</span>
            <input
              type="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              className={campo}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Senha</span>
            <div className="relative">
              <input
                type={verSenha ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className={`${campo} pr-11`}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setVerSenha((v) => !v)}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                aria-label={verSenha ? 'Esconder senha' : 'Mostrar senha'}
              >
                {verSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {erro && (
            <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-400">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={entrando}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 dark:bg-gray-700 py-3 text-base font-semibold text-white disabled:opacity-50"
          >
            <Lock size={16} /> {entrando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          Acesso restrito. Esqueceu a senha? Peça para o responsável redefinir no Supabase.
        </p>
      </div>
    </main>
  )
}
