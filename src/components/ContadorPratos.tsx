import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { criarPrato, listarPratos } from '../lib/pratoService'
import { normalizarNome } from '../lib/vales'
import { mensagemErro } from '../lib/erros'
import type { MarmitaItem, Prato } from '../types/fechamento'

interface Props {
  value: MarmitaItem[]
  onChange: (value: MarmitaItem[]) => void
}

export default function ContadorPratos({ value, onChange }: Props) {
  const [pratos, setPratos] = useState<Prato[]>([])
  const [novoNome, setNovoNome] = useState('')
  const [mostrarNovo, setMostrarNovo] = useState(false)
  const [falhou, setFalhou] = useState(false)
  const [erroNovo, setErroNovo] = useState<string | null>(null)
  const [adicionando, setAdicionando] = useState(false)

  // Busca a lista (sem mexer no estado antes da resposta chegar).
  function carregar() {
    return listarPratos()
      .then((lista) => {
        setPratos(lista)
        setFalhou(false)
      })
      .catch(() => setFalhou(true))
  }

  useEffect(() => {
    carregar()
  }, [])

  // Pratos já contados que não estão na lista (desativados ou de fechamentos antigos)
  const lista: { chave: string; nome: string }[] = [
    ...pratos.map((p) => ({ chave: p.id, nome: p.nome })),
    ...value
      .filter((v) => !pratos.some((p) => p.nome === v.prato))
      .map((v) => ({ chave: `extra-${v.prato}`, nome: v.prato })),
  ]

  function quantidadeDe(nome: string): number {
    return value.find((v) => v.prato === nome)?.quantidade ?? 0
  }

  function ajustar(nome: string, delta: number) {
    const nova = Math.max(0, quantidadeDe(nome) + delta)
    // mantém a ordem original dos pratos já contados
    const existe = value.some((v) => v.prato === nome)
    const atualizado = existe
      ? value.map((v) => (v.prato === nome ? { ...v, quantidade: nova } : v))
      : [...value, { prato: nome, quantidade: nova }]
    onChange(atualizado.filter((v) => v.quantidade > 0))
  }

  async function adicionarPrato() {
    const nome = novoNome.trim().replace(/\s+/g, ' ')
    if (!nome || adicionando) return
    setErroNovo(null)
    const existente = pratos.find((p) => normalizarNome(p.nome) === normalizarNome(nome))
    if (existente) {
      setErroNovo(`"${existente.nome}" já está na lista.`)
      return
    }
    setAdicionando(true)
    try {
      const criado = await criarPrato(nome)
      setPratos((prev) => [...prev, criado].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
      setNovoNome('')
      setMostrarNovo(false)
    } catch (e) {
      setErroNovo(mensagemErro(e, 'Não consegui cadastrar o prato.'))
    } finally {
      setAdicionando(false)
    }
  }

  const total = value.reduce((acc, v) => acc + v.quantidade, 0)

  return (
    <div className="space-y-2">
      {falhou && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          <span>Não consegui carregar a lista de pratos (confira a internet).</span>
          <button type="button" onClick={carregar} className="shrink-0 font-semibold underline">
            Tentar de novo
          </button>
        </div>
      )}
      {lista.map((p) => {
        const qtd = quantidadeDe(p.nome)
        return (
          <div
            key={p.chave}
            className={`flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 ${
              qtd > 0 ? 'bg-gray-100 dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50'
            }`}
          >
            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{p.nome}</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => ajustar(p.nome, -1)}
                disabled={qtd === 0}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-30"
                aria-label={`Diminuir ${p.nome}`}
              >
                <Minus size={16} />
              </button>
              <span className="w-8 text-center text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100" aria-live="polite">
                {qtd}
              </span>
              <button
                type="button"
                onClick={() => ajustar(p.nome, 1)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-900 dark:bg-gray-600 text-white"
                aria-label={`Aumentar ${p.nome}`}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        )
      })}

      {lista.length === 0 && !falhou && (
        <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum prato cadastrado ainda.</p>
      )}

      {!mostrarNovo ? (
        <button
          type="button"
          onClick={() => setMostrarNovo(true)}
          className="flex items-center gap-1 text-sm font-medium text-gray-900 dark:text-gray-100 hover:underline"
        >
          <Plus size={15} /> Novo prato
        </button>
      ) : (
        <div className="space-y-1">
          <div className="flex gap-1.5">
            <input
              autoFocus
              type="text"
              maxLength={60}
              placeholder="Nome do prato"
              aria-label="Nome do novo prato"
              className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-gray-500"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  adicionarPrato()
                }
                if (e.key === 'Escape') setMostrarNovo(false)
              }}
            />
            <button
              type="button"
              onClick={adicionarPrato}
              disabled={adicionando}
              className="shrink-0 rounded-lg bg-gray-900 dark:bg-gray-700 px-3 text-xs font-medium text-white disabled:opacity-50"
            >
              {adicionando ? '...' : 'Adicionar'}
            </button>
          </div>
          {erroNovo && <p className="text-xs text-red-600 dark:text-red-400">{erroNovo}</p>}
        </div>
      )}

      <div className="flex justify-between items-center pt-2 mt-1 text-sm border-t border-gray-100 dark:border-gray-800">
        <span className="text-gray-500 dark:text-gray-400">Total de marmitas</span>
        <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{total}</span>
      </div>
    </div>
  )
}
