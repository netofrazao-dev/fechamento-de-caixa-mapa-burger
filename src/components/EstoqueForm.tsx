import type { EstoqueSnapshot } from '../types/fechamento'
import { PRODUTOS_ESTOQUE_PADRAO } from '../lib/produtos'

interface Props {
  value: EstoqueSnapshot
  onChange: (value: EstoqueSnapshot) => void
}

export default function EstoqueForm({ value, onChange }: Props) {
  const itens =
    value.itens.length > 0
      ? value.itens
      : PRODUTOS_ESTOQUE_PADRAO.map((produto) => ({ produto, quantidade: 0 }))

  function atualizarQtd(produto: string, quantidade: number) {
    const existe = itens.some((i) => i.produto === produto)
    const novosItens = existe
      ? itens.map((i) => (i.produto === produto ? { ...i, quantidade } : i))
      : [...itens, { produto, quantidade }]
    onChange({ itens: novosItens })
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {itens.map((item) => (
        <label key={item.produto} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 px-2.5 py-1.5">
          <span className="text-xs text-gray-600 dark:text-gray-300 leading-tight">{item.produto}</span>
          <input
            type="number"
            min={0}
            className="w-14 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-1 text-sm text-right outline-none focus:border-gray-400"
            value={Number.isNaN(item.quantidade) ? '' : item.quantidade}
            onChange={(e) => atualizarQtd(item.produto, e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
            onFocus={(e) => e.target.select()}
          />
        </label>
      ))}
    </div>
  )
}
