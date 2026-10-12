import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { criarFuncionario, listarFuncionarios } from '../lib/funcionarioService'
import type { Funcionario } from '../types/fechamento'

interface Props {
  value: string[]
  onChange: (value: string[]) => void
  /** Se true, só um funcionário pode ficar selecionado por vez. */
  unico?: boolean
}

export default function SeletorFuncionarios({ value, onChange, unico }: Props) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [novoNome, setNovoNome] = useState('')
  const [mostrarNovo, setMostrarNovo] = useState(false)
  const [falhou, setFalhou] = useState(false)

  function carregar() {
    setFalhou(false)
    listarFuncionarios()
      .then(setFuncionarios)
      .catch(() => setFalhou(true))
  }

  useEffect(() => {
    carregar()
  }, [])

  // Nomes já selecionados que não estão na lista (ex.: pessoa removida, ou lista que não carregou)
  const extras = value.filter((v) => !funcionarios.some((f) => f.nome === v))

  function toggle(nome: string) {
    if (unico) {
      onChange(value.includes(nome) ? [] : [nome])
      return
    }
    onChange(value.includes(nome) ? value.filter((n) => n !== nome) : [...value, nome])
  }

  async function adicionarNovo() {
    const nome = novoNome.trim()
    if (!nome) return
    let nomeFinal = nome
    try {
      const criado = await criarFuncionario(nome)
      nomeFinal = criado.nome
      setFuncionarios((prev) => [...prev, criado].sort((a, b) => a.nome.localeCompare(b.nome)))
    } catch {
      // se já existir (nome único) ou der erro, ainda assim seleciona pelo nome digitado
    }
    onChange(unico ? [nomeFinal] : [...value, nomeFinal])
    setNovoNome('')
    setMostrarNovo(false)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {falhou && (
        <div className="w-full flex items-center justify-between gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          <span>Não consegui carregar a lista de funcionários (confira a internet ou se o banco está atualizado).</span>
          <button type="button" onClick={carregar} className="shrink-0 font-semibold underline">
            Tentar de novo
          </button>
        </div>
      )}
      {extras.map((nome) => (
        <button
          key={`extra-${nome}`}
          type="button"
          onClick={() => toggle(nome)}
          className="rounded-full px-3 py-1.5 text-sm font-medium bg-gray-900 dark:bg-gray-700 text-white"
        >
          {nome}
        </button>
      ))}
      {funcionarios.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => toggle(f.nome)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            value.includes(f.nome)
              ? 'bg-gray-900 dark:bg-gray-700 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
          }`}
        >
          {f.nome}
        </button>
      ))}

      {!mostrarNovo && (
        <button
          type="button"
          onClick={() => setMostrarNovo(true)}
          className="rounded-full px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500 flex items-center gap-1"
        >
          <Plus size={14} /> Pessoa
        </button>
      )}

      {mostrarNovo && (
        <div className="flex gap-1.5 w-full mt-1">
          <input
            autoFocus
            type="text"
            placeholder="Nome"
            className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-gray-400"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                adicionarNovo()
              }
            }}
          />
          <button
            type="button"
            onClick={adicionarNovo}
            className="shrink-0 rounded-lg bg-gray-900 dark:bg-gray-700 px-3 text-xs font-medium text-white"
          >
            Adicionar
          </button>
        </div>
      )}
    </div>
  )
}
