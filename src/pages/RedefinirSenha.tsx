import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react'
import { lerLinkDeRecuperacao, useAuth } from '../lib/auth'

/** Força simples da senha, só pra orientar (o mínimo exigido é 8 caracteres). */
function forca(senha: string): { nivel: 0 | 1 | 2 | 3; texto: string } {
  if (senha.length < 8) return { nivel: 0, texto: 'Muito curta (mínimo 8)' }
  let pontos = 0
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++
  if (/\d/.test(senha)) pontos++
  if (/[^A-Za-z0-9]/.test(senha) || senha.length >= 12) pontos++
  return pontos >= 2 ? { nivel: 3, texto: 'Boa' } : pontos === 1 ? { nivel: 2, texto: 'Razoável' } : { nivel: 1, texto: 'Fraca' }
}

/**
 * Tela aberta pelo link do e-mail "Esqueci minha senha".
 * Lê o token do endereço, apaga-o da barra (pra não ficar no histórico)
 * e deixa a pessoa escolher a senha nova.
 */
export default function RedefinirSenha() {
  const { sessao, carregando, entrarComLinkDeRecuperacao, trocarSenha } = useAuth()
  const [estado, setEstado] = useState<'lendo' | 'pronto' | 'invalido' | 'concluido'>('lendo')
  const [erroLink, setErroLink] = useState<string | null>(null)
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [ver, setVer] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const processado = useRef(false)

  useEffect(() => {
    if (processado.current || carregando) return
    processado.current = true
    const link = lerLinkDeRecuperacao(window.location.hash)
    // Tira o token do endereço na hora.
    if (window.location.hash) window.history.replaceState(null, '', '/redefinir-senha')
    if (link.tipo === 'erro') {
      setErroLink(link.erro ?? 'Link inválido.')
      setEstado('invalido')
      return
    }
    if (link.tipo === 'recuperacao' && link.accessToken && link.refreshToken) {
      entrarComLinkDeRecuperacao(link.accessToken, link.refreshToken)
        .then(() => setEstado('pronto'))
        .catch((e) => {
          setErroLink(e instanceof Error ? e.message : 'Link inválido.')
          setEstado('invalido')
        })
      return
    }
    // Sem token: só dá pra trocar a senha se já estiver logado.
    if (sessao) setEstado('pronto')
    else {
      setErroLink('Abra esta tela pelo link que chegou no seu e-mail.')
      setEstado('invalido')
    }
  }, [carregando, sessao, entrarComLinkDeRecuperacao])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (salvando) return
    setErro(null)
    if (senha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (senha !== confirmacao) {
      setErro('As duas senhas não são iguais.')
      return
    }
    setSalvando(true)
    try {
      await trocarSenha(senha)
      setSenha('')
      setConfirmacao('')
      setEstado('concluido')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar a senha.')
    } finally {
      setSalvando(false)
    }
  }

  const f = forca(senha)
  const corForca = ['bg-red-500', 'bg-red-500', 'bg-amber-500', 'bg-green-600'][f.nivel]
  const campo =
    'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-3 text-base outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-800'

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/logo.png" alt="" className="w-16 h-16 rounded-full object-cover shadow-sm" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Criar senha nova</h1>
        </div>

        <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-5 space-y-4">
          {estado === 'lendo' && <p className="text-sm text-gray-500">Conferindo o link...</p>}

          {estado === 'invalido' && (
            <>
              <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 px-3.5 py-3 text-sm text-red-700 dark:text-red-400">
                {erroLink}
              </p>
              <a href="/" className="block text-center rounded-xl bg-gray-900 dark:bg-gray-700 py-3 text-sm font-semibold text-white">
                Ir para o login
              </a>
            </>
          )}

          {estado === 'concluido' && (
            <>
              <p role="status" className="flex items-start gap-2 rounded-xl bg-green-50 dark:bg-green-950/40 px-3.5 py-3 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 size={18} className="shrink-0" /> Senha alterada! Use a senha nova da próxima vez que entrar.
              </p>
              <a href="/hoje" className="block text-center rounded-xl bg-gray-900 dark:bg-gray-700 py-3 text-sm font-semibold text-white">
                Ir para o sistema
              </a>
            </>
          )}

          {estado === 'pronto' && (
            <form onSubmit={salvar} className="space-y-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="senha-nova" className="text-[13px] font-medium text-gray-600 dark:text-gray-300">
                  Senha nova
                </label>
                <div className="relative">
                  <input
                    id="senha-nova"
                    aria-describedby={senha ? 'forca-senha' : undefined}
                    type={ver ? 'text' : 'password'}
                    autoComplete="new-password"
                    autoFocus
                    className={`${campo} pr-11`}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setVer((v) => !v)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 text-gray-400"
                    aria-label={ver ? 'Esconder senha' : 'Mostrar senha'}
                  >
                    {ver ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {senha && (
                  <div id="forca-senha" className="flex items-center gap-2" aria-live="polite">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className={`h-full ${corForca}`} style={{ width: `${(f.nivel / 3) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">Força: {f.texto}</span>
                  </div>
                )}
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Repita a senha nova</span>
                <input
                  type={ver ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={campo}
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                />
              </label>
              {erro && (
                <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-400">
                  {erro}
                </p>
              )}
              <button
                type="submit"
                disabled={salvando}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 dark:bg-gray-700 py-3 text-base font-semibold text-white disabled:opacity-50"
              >
                <KeyRound size={16} /> {salvando ? 'Salvando...' : 'Salvar senha nova'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
