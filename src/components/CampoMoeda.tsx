import { useId, useState } from 'react'
import { Plus } from 'lucide-react'
import { arredondarCentavos, lerMoeda, sanitizarDigitacao, textoFormatado, textoParaEdicao } from '../lib/moeda'

interface Props {
  label?: string
  value: number
  onChange: (value: number) => void
  helper?: string
  disabled?: boolean
  /** Mostra o botão de soma rápida (digitar comprovante a comprovante). Padrão: true. */
  somavel?: boolean
  /** Versão menor, sem rótulo visível (usada dentro de listas). */
  compacto?: boolean
  /** Nome lido por leitores de tela quando não há rótulo visível. */
  ariaLabel?: string
  placeholder?: string
}

/**
 * Campo de dinheiro no padrão brasileiro: aceita vírgula ou ponto,
 * mostra "1.234,56" quando não está editando, nunca aceita negativo
 * nem mais de 2 casas decimais. Campo vazio = R$ 0,00.
 */
export default function CampoMoeda({
  label,
  value,
  onChange,
  helper,
  disabled,
  somavel = true,
  compacto,
  ariaLabel,
  placeholder = '0,00',
}: Props) {
  const id = useId()
  const [editando, setEditando] = useState<string | null>(null)
  const [somando, setSomando] = useState(false)
  const [somaRapida, setSomaRapida] = useState('')

  const texto = editando ?? textoFormatado(value)

  function digitar(bruto: string) {
    const limpo = sanitizarDigitacao(bruto)
    setEditando(limpo)
    const n = lerMoeda(limpo)
    if (n !== null) onChange(n)
  }

  function adicionar() {
    const parcela = lerMoeda(somaRapida)
    if (parcela) onChange(arredondarCentavos((Number.isFinite(value) ? value : 0) + parcela))
    setSomaRapida('')
  }

  const mostrarSoma = somavel && !disabled && !compacto
  const altura = compacto ? 'py-1.5' : 'py-2'

  return (
    <div className="flex flex-col gap-1 min-w-0">
      {label && !compacto && (
        <label htmlFor={id} className="text-[13px] font-medium text-gray-600 dark:text-gray-300">
          {label}
        </label>
      )}
      <div className="flex items-stretch rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus-within:border-gray-500 dark:focus-within:border-gray-400 focus-within:ring-2 focus-within:ring-gray-200 dark:focus-within:ring-gray-800 transition">
        <span className="pl-2.5 flex items-center text-gray-400 dark:text-gray-500 text-sm select-none">R$</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="next"
          aria-label={compacto || !label ? (ariaLabel ?? label) : undefined}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full min-w-0 px-2 ${altura} text-sm text-right tabular-nums outline-none bg-transparent placeholder:text-gray-300 dark:placeholder:text-gray-600 disabled:text-gray-400`}
          value={texto}
          onFocus={(e) => {
            setEditando(textoParaEdicao(value))
            requestAnimationFrame(() => e.target.select())
          }}
          onBlur={() => setEditando(null)}
          onChange={(e) => digitar(e.target.value)}
        />
        {mostrarSoma && (
          <button
            type="button"
            onClick={() => setSomando((s) => !s)}
            title="Somar comprovantes um a um"
            aria-label={`Somar comprovantes em ${label ?? 'valor'}`}
            aria-pressed={somando}
            className={`px-2.5 flex items-center border-l rounded-r-lg ${
              somando
                ? 'bg-gray-900 dark:bg-gray-700 text-white border-gray-900 dark:border-gray-700'
                : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {somando && (
        <div className="flex gap-1.5">
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            placeholder="Valor do comprovante"
            aria-label="Valor do comprovante a somar"
            className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1.5 text-xs outline-none focus:border-gray-400"
            value={somaRapida}
            onChange={(e) => setSomaRapida(sanitizarDigitacao(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                adicionar()
              }
              if (e.key === 'Escape') {
                setSomando(false)
                setSomaRapida('')
              }
            }}
          />
          <button
            type="button"
            onClick={adicionar}
            className="shrink-0 rounded-lg bg-gray-900 dark:bg-gray-700 px-3 text-xs font-medium text-white"
          >
            Somar
          </button>
        </div>
      )}

      {helper && <span className="text-[11px] text-gray-400 dark:text-gray-500">{helper}</span>}
    </div>
  )
}
