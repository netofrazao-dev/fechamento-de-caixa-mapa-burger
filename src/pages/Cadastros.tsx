import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { mensagemErro } from '../lib/erros'
import { normalizarNome } from '../lib/vales'
import { atualizarFuncionario, criarFuncionario, listarFuncionarios } from '../lib/funcionarioService'
import { atualizarPrato, criarPrato, listarPratos } from '../lib/pratoService'

interface ItemCadastro {
  id: string
  nome: string
  ativo: boolean
}

interface ServicoCadastro {
  listar: () => Promise<ItemCadastro[]>
  criar: (nome: string) => Promise<ItemCadastro>
  atualizar: (id: string, campos: { nome?: string; ativo?: boolean }) => Promise<ItemCadastro>
}

const servicoFuncionarios: ServicoCadastro = {
  listar: () => listarFuncionarios({ incluirInativos: true }),
  criar: criarFuncionario,
  atualizar: atualizarFuncionario,
}
const servicoPratos: ServicoCadastro = {
  listar: () => listarPratos({ incluirInativos: true }),
  criar: criarPrato,
  atualizar: atualizarPrato,
}

const caixa = 'rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-3'
const campo =
  'w-full min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-500'

function ListaCadastro({
  titulo,
  explicacao,
  rotuloInativo,
  servico,
}: {
  titulo: string
  explicacao: string
  rotuloInativo: string
  servico: ServicoCadastro
}) {
  const [itens, setItens] = useState<ItemCadastro[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [novo, setNovo] = useState('')
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [verInativos, setVerInativos] = useState(false)

  const carregar = useCallback(() => {
    servico
      .listar()
      .then((l) => setItens(l))
      .catch((e) => setErro(mensagemErro(e, `Erro ao carregar ${titulo.toLowerCase()}.`)))
  }, [servico, titulo])

  useEffect(() => {
    carregar()
  }, [carregar])

  function nomeRepetido(nome: string, ignorarId?: string) {
    return itens?.find((i) => i.id !== ignorarId && normalizarNome(i.nome) === normalizarNome(nome))
  }

  async function executar(acao: () => Promise<void>) {
    if (ocupado) return
    setOcupado(true)
    setErro(null)
    try {
      await acao()
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível salvar.'))
    } finally {
      setOcupado(false)
    }
  }

  function adicionar(e: FormEvent) {
    e.preventDefault()
    const nome = novo.trim().replace(/\s+/g, ' ')
    if (!nome) return
    const repetido = nomeRepetido(nome)
    if (repetido) {
      setErro(
        repetido.ativo
          ? `"${repetido.nome}" já está cadastrado.`
          : `"${repetido.nome}" já existe, mas está desativado. Use "Reativar" na lista de desativados.`,
      )
      if (!repetido.ativo) setVerInativos(true)
      return
    }
    executar(async () => {
      const criado = await servico.criar(nome)
      setItens((l) => [...(l ?? []), criado].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
      setNovo('')
    })
  }

  function salvarNome() {
    if (!editando) return
    const nome = editando.nome.trim().replace(/\s+/g, ' ')
    if (!nome) return
    if (nomeRepetido(nome, editando.id)) {
      setErro(`Já existe "${nome}".`)
      return
    }
    executar(async () => {
      const atualizado = await servico.atualizar(editando.id, { nome })
      setItens((l) => (l ?? []).map((i) => (i.id === atualizado.id ? atualizado : i)))
      setEditando(null)
    })
  }

  function alternarAtivo(item: ItemCadastro) {
    executar(async () => {
      const atualizado = await servico.atualizar(item.id, { ativo: !item.ativo })
      setItens((l) => (l ?? []).map((i) => (i.id === atualizado.id ? atualizado : i)))
    })
  }

  const ativos = (itens ?? []).filter((i) => i.ativo)
  const inativos = (itens ?? []).filter((i) => !i.ativo)

  function linha(item: ItemCadastro) {
    const emEdicao = editando?.id === item.id
    return (
      <li key={item.id} className="flex items-center gap-2 py-1.5">
        {emEdicao ? (
          <>
            <input
              autoFocus
              maxLength={80}
              aria-label={`Novo nome para ${item.nome}`}
              className={campo}
              value={editando.nome}
              onChange={(e) => setEditando({ id: item.id, nome: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') salvarNome()
                if (e.key === 'Escape') setEditando(null)
              }}
            />
            <button type="button" onClick={salvarNome} disabled={ocupado} className="p-2 text-green-600" aria-label="Salvar nome">
              <Check size={18} />
            </button>
            <button type="button" onClick={() => setEditando(null)} className="p-2 text-gray-400" aria-label="Cancelar">
              <X size={18} />
            </button>
          </>
        ) : (
          <>
            <span className={`flex-1 text-sm ${item.ativo ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 line-through'}`}>
              {item.nome}
            </span>
            {item.ativo && (
              <button
                type="button"
                onClick={() => setEditando({ id: item.id, nome: item.nome })}
                className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                aria-label={`Renomear ${item.nome}`}
              >
                <Pencil size={15} />
              </button>
            )}
            <button
              type="button"
              disabled={ocupado}
              onClick={() => alternarAtivo(item)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-50"
            >
              {item.ativo ? 'Desativar' : 'Reativar'}
            </button>
          </>
        )}
      </li>
    )
  }

  return (
    <section className={caixa}>
      <div>
        <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">{titulo}</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{explicacao}</p>
      </div>

      {erro && (
        <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {erro}
        </p>
      )}
      {!itens && !erro && <p className="text-sm text-gray-400">Carregando...</p>}

      {itens && (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {ativos.map(linha)}
          {ativos.length === 0 && <li className="py-2 text-sm text-gray-400">Nenhum cadastrado.</li>}
        </ul>
      )}

      <form onSubmit={adicionar} className="flex gap-2">
        <input
          maxLength={80}
          placeholder="Nome"
          aria-label={`Adicionar em ${titulo}`}
          className={campo}
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
        />
        <button
          type="submit"
          disabled={ocupado || !novo.trim()}
          className="shrink-0 flex items-center gap-1 rounded-lg bg-gray-900 dark:bg-gray-700 px-3 text-sm font-medium text-white disabled:opacity-40"
        >
          <Plus size={15} /> Adicionar
        </button>
      </form>

      {inativos.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setVerInativos((v) => !v)}
            className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:underline"
            aria-expanded={verInativos}
          >
            {verInativos ? 'Esconder' : 'Ver'} {rotuloInativo} ({inativos.length})
          </button>
          {verInativos && <ul className="divide-y divide-gray-100 dark:divide-gray-800 mt-1">{inativos.map(linha)}</ul>}
        </div>
      )}
    </section>
  )
}

function Conta() {
  const { email, trocarSenha, sair } = useAuth()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (senha.length < 8) {
      setMsg({ ok: false, texto: 'A senha precisa ter pelo menos 8 caracteres.' })
      return
    }
    if (senha !== confirmacao) {
      setMsg({ ok: false, texto: 'As duas senhas não são iguais.' })
      return
    }
    setSalvando(true)
    try {
      await trocarSenha(senha)
      setSenha('')
      setConfirmacao('')
      setMsg({ ok: true, texto: 'Senha alterada.' })
    } catch (err) {
      setMsg({ ok: false, texto: err instanceof Error ? err.message : 'Não foi possível trocar a senha.' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className={caixa}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Minha conta</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{email}</p>
        </div>
        <button
          type="button"
          onClick={sair}
          className="shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400"
        >
          Sair
        </button>
      </div>
      <form onSubmit={enviar} className="space-y-2">
        <p className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Trocar senha</p>
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Nova senha (mínimo 8 caracteres)"
          aria-label="Nova senha"
          className={campo}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Repita a nova senha"
          aria-label="Repita a nova senha"
          className={campo}
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
        />
        {msg && (
          <p role="status" className={`text-sm ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {msg.texto}
          </p>
        )}
        <button
          type="submit"
          disabled={salvando || !senha}
          className="rounded-lg bg-gray-900 dark:bg-gray-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {salvando ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>
    </section>
  )
}

export default function Cadastros() {
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-24">
      <header>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Cadastros e conta</h1>
      </header>
      <ListaCadastro
        titulo="Funcionários"
        explicacao="Aparecem nos vales e no relatório. Desativar tira da lista de seleção, mas mantém os vales e relatórios antigos."
        rotuloInativo="desativados"
        servico={servicoFuncionarios}
      />
      <ListaCadastro
        titulo="Pratos (marmitas)"
        explicacao="Aparecem no contador de marmitas do fechamento. Desativar tira do contador, sem mexer nos fechamentos antigos."
        rotuloInativo="desativados"
        servico={servicoPratos}
      />
      <Conta />
    </div>
  )
}
