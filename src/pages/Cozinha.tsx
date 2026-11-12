import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, LogOut, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { excluirEstrago, lancarEstrago, listarEstragosDoDia, type EstragoCozinha } from '../lib/estragoService'
import { useAtualizarAoVoltar } from '../lib/useAtualizarAoVoltar'
import { diaDaSemana, formatarDiaMes, hojeLocal } from '../lib/datas'
import { mensagemErro } from '../lib/erros'

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/**
 * Tela da cozinha: a única que o login da cozinha vê. Lança o que estragou
 * no dia; vai direto para a parte "Estragou" do relatório do dia.
 */
export default function Cozinha() {
  const { sair } = useAuth()
  const hoje = hojeLocal()
  const [lista, setLista] = useState<EstragoCozinha[] | null>(null)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [apagando, setApagando] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)
  const travado = useRef(false)
  const campo = useRef<HTMLInputElement>(null)

  // Atualiza ao voltar para o app (mostra o que já entrou no relatório).
  useAtualizarAoVoltar(() => setVersao((v) => v + 1), 60_000)
  useEffect(() => {
    let ativo = true
    listarEstragosDoDia(hoje)
      .then((l) => ativo && setLista(l))
      .catch((e) => ativo && setErro(mensagemErro(e, 'Não consegui carregar o que já foi lançado hoje.')))
    return () => {
      ativo = false
    }
  }, [hoje, versao])

  async function adicionar(e: FormEvent) {
    e.preventDefault()
    const t = texto.trim()
    if (!t || travado.current) return
    travado.current = true
    setOcupado(true)
    setErro(null)
    setOk(null)
    try {
      const novo = await lancarEstrago(hoje, t)
      setLista((l) => [...(l ?? []), novo])
      setTexto('')
      setOk(`Anotado: ${novo.texto}`)
      campo.current?.focus()
    } catch (err) {
      setErro(mensagemErro(err, 'Não consegui anotar. Tente de novo.'))
    } finally {
      travado.current = false
      setOcupado(false)
    }
  }

  async function apagar(item: EstragoCozinha) {
    if (apagando) return
    setApagando(item.id)
    setErro(null)
    setOk(null)
    try {
      await excluirEstrago(item.id)
      setLista((l) => (l ?? []).filter((x) => x.id !== item.id))
    } catch (err) {
      setErro(mensagemErro(err, 'Não consegui apagar.'))
      setVersao((v) => v + 1)
    } finally {
      setApagando(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="flex items-center gap-2 px-4 py-3 max-w-lg mx-auto">
        <img src="/logo-pequeno.jpg" alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
        <span className="font-bold text-gray-900 dark:text-gray-100 tracking-tight">Mapa Burger · Cozinha</span>
        <button
          type="button"
          onClick={sair}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-gray-500 dark:text-gray-400"
        >
          <LogOut size={16} /> Sair
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 pb-10 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">O que estragou hoje</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {diaDaSemana(hoje)}, {formatarDiaMes(hoje)} · vai direto para o relatório do dia.
          </p>
        </div>

        <form onSubmit={adicionar} className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quantidade e o que era</span>
            {/* text-base (16px): o iPhone não dá zoom ao tocar no campo */}
            <input
              ref={campo}
              type="text"
              maxLength={200}
              autoComplete="off"
              enterKeyHint="done"
              placeholder="Ex: 2 pães, 400g de arroz"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3.5 py-3 text-base outline-none focus:border-gray-500"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={ocupado || !texto.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 dark:bg-gray-700 py-3.5 text-base font-semibold text-white disabled:opacity-40"
          >
            <Plus size={18} /> {ocupado ? 'Anotando...' : 'Adicionar'}
          </button>
          {ok && (
            <p role="status" className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 size={15} /> {ok}
            </p>
          )}
          {erro && (
            <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-400">
              {erro}
            </p>
          )}
        </form>

        <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-2" aria-label="Lançados hoje">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Lançados hoje {lista && lista.length > 0 && `(${lista.length})`}</h2>
          {lista === null && !erro && <p className="text-sm text-gray-400">Carregando...</p>}
          {lista?.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">Nada lançado hoje.</p>}
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {lista?.map((e) => (
              <li key={e.id} className="flex items-center gap-2 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-base text-gray-900 dark:text-gray-100 break-words">{e.texto}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    às {hora(e.criadoEm)}
                    {e.importadoEm && <span className="text-green-700 dark:text-green-400"> · ✓ já está no relatório</span>}
                  </p>
                </div>
                {!e.importadoEm && (
                  <button
                    type="button"
                    disabled={apagando === e.id}
                    onClick={() => apagar(e)}
                    className="shrink-0 p-2.5 text-gray-400 hover:text-red-500 disabled:opacity-40"
                    aria-label={`Apagar ${e.texto}`}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
