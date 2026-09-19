import { Trash2 } from 'lucide-react'

interface Props {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
}

export default function ListaLivre({ value, onChange, placeholder }: Props) {
  const adicionar = () => onChange([...value, ''])
  const remover = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const atualizar = (i: number, texto: string) =>
    onChange(value.map((v, idx) => (idx === i ? texto : v)))

  return (
    <div className="space-y-2">
      {value.map((texto, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            type="text"
            placeholder={placeholder}
            className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-2 text-sm outline-none focus:border-gray-400"
            value={texto}
            onChange={(e) => atualizar(i, e.target.value)}
          />
          <button
            type="button"
            onClick={() => remover(i)}
            className="shrink-0 p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500"
            aria-label="Remover"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button type="button" onClick={adicionar} className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:underline">
        + Adicionar
      </button>
    </div>
  )
}
