import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props {
  titulo: string
  resumo?: string
  defaultAberto?: boolean
  children: ReactNode
}

export default function Secao({ titulo, resumo, defaultAberto = false, children }: Props) {
  const [aberto, setAberto] = useState(defaultAberto)

  return (
    <section className="rounded-2xl bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <div>
          <h2 className="text-[15px] font-semibold text-gray-900">{titulo}</h2>
          {resumo && !aberto && <p className="text-xs text-gray-400 mt-0.5">{resumo}</p>}
        </div>
        <ChevronDown
          size={18}
          className={`text-gray-400 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`}
        />
      </button>
      {aberto && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </section>
  )
}
