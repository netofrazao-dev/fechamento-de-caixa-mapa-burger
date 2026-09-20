import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { criarPrato, listarPratos } from '../lib/pratoService'
import type { MarmitaItem, Prato } from '../types/fechamento'

interface Props {
  value: MarmitaItem[]
  onChange: (value: MarmitaItem[]) => void
}

export default function ContadorPratos({ value, onChange }: Props) {
  const [pratos, setPratos] = useState<Prato[]>([])
  const [novoNome, setNovoNome] = useState('')
  const [mostrarNovo, setMostrarNovo] = useState(false)

  useEffect(() => {
    listarPratos()
      .then(setPratos)
      .catch(() => {
        /* silencioso: se a tabela ainda não existir, só não mostra sugestões */
      })
  }, [])

  function quantidadeDe(nome: string): number {
    return value.find((v) => v.prato === nome)?.quantidade ?? 0
  }

  function ajustar(nome: string, delta: number) {
    const nova = Math.max(0, quantidadeDe(nome) + delta)
    const semEsse = value.filter((v) => v.prato !== nome)
    onChange(nova > 0 ? [...semEsse, { prato: nome, quantidade: nova }] : semEsse)
  }

  async function adicionarPrato() {
    const nome = novoNome.trim()
    if (!nome) return
    try {
      const criado = await criarPrato(nome)
      setPratos((prev) => [...prev, criado].sort((a, b) => a.nome.localeCompare(b.nome)))
    } catch {
      setPratos((prev) => [...prev, { id: nome, nome }].sort((a, b) => a.nome.localeCompare(b.nome)))
    }
    setNovoNome('')
    setMostrarNovo(false)
  }

  const total = value.reduce((acc, v) => acc + v.quantidade, 0)

  return (
    <div className="space-y-2">
      {pratos.map((p) => {
        const qtd = quantidadeDe(p.nome)
        return (
          <div
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2"
          >
            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{p.nome}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => ajustar(p.nome, -1)}
                disabled={qtd === 0}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-30"
                aria-label={`Diminuir ${p.nome}`}
              >
                <Minus size={14} />
              </button>
              <span className="w-6 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">{qtd}</span>
              <button
                type="button"
                onClick={() => ajustar(p.nome, 1)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-900 dark:bg-gray-700 text-white"
                aria-label={`Aumentar ${p.nome}`}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        )
      })}

      {pratos.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum prato cadastrado ainda.</p>
      )}

      {!mostrarNovo ? (
        <button
          type="button"
          onClick={() => setMostrarNovo(true)}
          className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:underline"
        >
          + Novo prato
        </button>
      ) : (
        <div className="flex gap-1.5">
          <input
            autoFocus
            type="text"
            placeholder="Nome do prato"
            className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-sm outline-none focus:border-gray-400"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                adicionarPrato()
              }
            }}
          />
          <button
            type="button"
            onClick={adicionarPrato}
            className="shrink-0 rounded-lg bg-gray-900 dark:bg-gray-700 px-3 text-xs font-medium text-white"
          >
            Adicionar
          </button>
        </div>
      )}

      <div className="flex justify-between items-center pt-2 mt-1 text-sm border-t border-gray-100 dark:border-gray-800">
        <span className="text-gray-400 dark:text-gray-500">Total de marmitas</span>
        <span className="font-semibold text-gray-900 dark:text-gray-100">{total}</span>
      </div>
    </div>
  )
}
