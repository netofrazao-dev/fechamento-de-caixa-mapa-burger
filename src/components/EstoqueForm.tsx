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
    onChange({ ...value, itens: novosItens })
  }

  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-medium text-gray-600">Data / hora da contagem</span>
        <input
          type="datetime-local"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
          value={value.dataHora}
          onChange={(e) => onChange({ ...value, dataHora: e.target.value })}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        {itens.map((item) => (
          <label key={item.produto} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5">
            <span className="text-xs text-gray-600 leading-tight">{item.produto}</span>
            <input
              type="number"
              min={0}
              className="w-14 rounded-md border border-gray-200 bg-white px-1.5 py-1 text-sm text-right outline-none focus:border-gray-400"
              value={Number.isNaN(item.quantidade) ? '' : item.quantidade}
              onChange={(e) => atualizarQtd(item.produto, e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
              onFocus={(e) => e.target.select()}
            />
          </label>
        ))}
      </div>
    </div>
  )
}
