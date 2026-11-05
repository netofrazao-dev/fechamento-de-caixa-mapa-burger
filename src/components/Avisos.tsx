import { forwardRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'

/** Caixa vermelha de erro (com botão "Tentar de novo" quando dá pra repetir a busca). */
export function CaixaErro({ children, onTentarDeNovo }: { children: ReactNode; onTentarDeNovo?: () => void }) {
  return (
    <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-400 space-y-2">
      <div>{children}</div>
      {onTentarDeNovo && (
        <button type="button" onClick={onTentarDeNovo} className="font-semibold underline">
          Tentar de novo
        </button>
      )}
    </div>
  )
}

/** Avisos que pedem confirmação antes de salvar. */
export const PainelAvisos = forwardRef<
  HTMLDivElement,
  { avisos: string[]; onCorrigir: () => void; onConfirmar: () => void; ocupado?: boolean; textoConfirmar?: string }
>(function PainelAvisos({ avisos, onCorrigir, onConfirmar, ocupado, textoConfirmar = 'Está certo, salvar' }, ref) {
  return (
    <div
      ref={ref}
      role="alertdialog"
      aria-label="Confira antes de salvar"
      className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-3 scroll-mb-40"
    >
      <div className="flex items-center gap-2 font-semibold text-sm text-amber-900 dark:text-amber-200">
        <AlertTriangle size={16} /> Confira antes de salvar
      </div>
      <ul className="list-disc pl-5 space-y-1 text-sm text-amber-900 dark:text-amber-200">
        {avisos.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCorrigir}
          className="flex-1 rounded-xl bg-white dark:bg-gray-800 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300"
        >
          Corrigir
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={onConfirmar}
          className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {textoConfirmar}
        </button>
      </div>
    </div>
  )
})

/**
 * Botão "Excluir" que pede confirmação na própria tela
 * (em vez da janelinha do navegador, fácil de confirmar sem querer).
 */
export function BotaoExcluir({
  descricao,
  onExcluir,
  rotulo = 'Excluir',
}: {
  descricao: string
  onExcluir: () => Promise<void>
  rotulo?: string
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function executar() {
    setOcupado(true)
    setErro(null)
    try {
      await onExcluir()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir.')
      setOcupado(false)
    }
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600"
      >
        <Trash2 size={14} /> {rotulo}
      </button>
    )
  }
  return (
    <div className="w-full rounded-xl bg-red-50 dark:bg-red-950/30 p-3 space-y-2">
      <p className="text-sm text-red-700 dark:text-red-400">{descricao}</p>
      {erro && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{erro}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="flex-1 rounded-xl bg-white dark:bg-gray-800 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={executar}
          className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {ocupado ? 'Excluindo...' : 'Sim, excluir'}
        </button>
      </div>
    </div>
  )
}
