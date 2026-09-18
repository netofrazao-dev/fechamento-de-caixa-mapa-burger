import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { criarFuncionario, listarFuncionarios } from '../lib/funcionarioService'
import type { Funcionario } from '../types/fechamento'

interface Props {
  value: string[]
  onChange: (value: string[]) => void
}

export default function SeletorFuncionarios({ value, onChange }: Props) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [novoNome, setNovoNome] = useState('')
  const [mostrarNovo, setMostrarNovo] = useState(false)

  useEffect(() => {
    listarFuncionarios()
      .then(setFuncionarios)
      .catch(() => {
        /* silencioso: se a tabela ainda não existir, só não mostra sugestões */
      })
  }, [])

  function toggle(nome: string) {
    onChange(value.includes(nome) ? value.filter((n) => n !== nome) : [...value, nome])
  }

  async function adicionarNovo() {
    const nome = novoNome.trim()
    if (!nome) return
    try {
      const criado = await criarFuncionario(nome)
      setFuncionarios((prev) => [...prev, criado].sort((a, b) => a.nome.localeCompare(b.nome)))
      onChange([...value, criado.nome])
    } catch {
      // se já existir (nome único) ou der erro, ainda assim seleciona pelo nome digitado
      onChange([...value, nome])
    }
    setNovoNome('')
    setMostrarNovo(false)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {funcionarios.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => toggle(f.nome)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            value.includes(f.nome) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {f.nome}
        </button>
      ))}

      {!mostrarNovo && (
        <button
          type="button"
          onClick={() => setMostrarNovo(true)}
          className="rounded-full px-3 py-1.5 text-sm font-medium bg-white border border-dashed border-gray-300 text-gray-400 flex items-center gap-1"
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
            className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-gray-400"
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
            className="shrink-0 rounded-lg bg-gray-900 px-3 text-xs font-medium text-white"
          >
            Adicionar
          </button>
        </div>
      )}
    </div>
  )
}
