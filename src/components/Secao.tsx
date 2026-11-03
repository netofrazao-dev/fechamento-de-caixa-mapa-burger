import { useId, useState, type ReactNode } from 'react'
import { AlertCircle, ChevronDown } from 'lucide-react'

interface Props {
  titulo: string
  resumo?: string
  /** Texto curto explicando o que vai nesta seção (aparece aberto). */
  ajuda?: string
  /** Destaca a seção (ex.: falta preencher algo obrigatório). */
  alerta?: boolean
  defaultAberto?: boolean
  children: ReactNode
}

export default function Secao({ titulo, resumo, ajuda, alerta, defaultAberto = false, children }: Props) {
  const [aberto, setAberto] = useState(defaultAberto)
  const id = useId()

  return (
    <section
      className={`rounded-2xl bg-white dark:bg-gray-900 shadow-sm overflow-hidden ${
        alerta ? 'ring-1 ring-red-300 dark:ring-red-800' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls={id}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
            {titulo}
            {alerta && <AlertCircle size={15} className="text-red-500 shrink-0" aria-label="Precisa de atenção" />}
          </h2>
          {resumo && !aberto && (
            <p className={`text-xs mt-0.5 truncate ${alerta ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
              {resumo}
            </p>
          )}
        </div>
        <ChevronDown
          size={18}
          className={`text-gray-400 dark:text-gray-500 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`}
        />
      </button>
      {aberto && (
        <div id={id} className="px-4 pb-4 space-y-3">
          {ajuda && <p className="text-xs text-gray-400 dark:text-gray-500 -mt-1">{ajuda}</p>}
          {children}
        </div>
      )}
    </section>
  )
}
