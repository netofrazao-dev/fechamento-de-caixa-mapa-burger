import { useState, type FormEvent } from 'react'
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { entrar, enviarRedefinicao } = useAuth()
  const [modo, setModo] = useState<'entrar' | 'esqueci'>('entrar')
  const [enviado, setEnviado] = useState(false)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  async function pedirRedefinicao(e: FormEvent) {
    e.preventDefault()
    if (entrando) return
    setErro(null)
    setEntrando(true)
    try {
      await enviarRedefinicao(email)
      setEnviado(true)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar o e-mail.')
    } finally {
      setEntrando(false)
    }
  }

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
          <img src="/logo-pequeno.jpg" alt="" className="w-20 h-20 rounded-full object-cover shadow-sm" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mapa Burger</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Fechamento de caixa</p>
          </div>
        </div>

        {modo === 'esqueci' ? (
          <form onSubmit={pedirRedefinicao} className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-5 space-y-4" noValidate>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Esqueci minha senha</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Digite o e-mail do seu login. Vamos mandar um link para você criar uma senha nova.
              </p>
            </div>
            {enviado ? (
              <p role="status" className="rounded-xl bg-green-50 dark:bg-green-950/40 px-3.5 py-3 text-sm text-green-700 dark:text-green-400">
                Pronto! Se esse e-mail estiver cadastrado, o link chega em alguns minutos. Confira também a caixa de spam.
                O link vale por pouco tempo e só funciona uma vez.
              </p>
            ) : (
              <>
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
                {erro && (
                  <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-400">
                    {erro}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={entrando || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 dark:bg-gray-700 py-3 text-base font-semibold text-white disabled:opacity-50"
                >
                  <Mail size={16} /> {entrando ? 'Enviando...' : 'Enviar link'}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setModo('entrar')
                setEnviado(false)
                setErro(null)
              }}
              className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400"
            >
              <ArrowLeft size={15} /> Voltar para o login
            </button>
          </form>
        ) : (
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
          <button
            type="button"
            onClick={() => {
              setModo('esqueci')
              setErro(null)
            }}
            className="w-full text-sm font-medium text-gray-500 dark:text-gray-400 hover:underline"
          >
            Esqueci minha senha
          </button>
        </form>
        )}

        <p className="text-center text-xs text-gray-400 dark:text-gray-500">Acesso restrito a pessoas autorizadas.</p>
      </div>
    </main>
  )
}
