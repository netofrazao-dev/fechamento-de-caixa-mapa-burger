import { useEffect } from 'react'
import { AlertTriangle, CheckCircle2, CloudOff, History, Smartphone, X } from 'lucide-react'
import type { EstadoSincronia } from '../lib/sincronia'
import { formatarHoraRascunho } from '../lib/draft'

interface AvisosProps {
  estado: EstadoSincronia
  /** "relatório" ou "fechamento". */
  nome: string
  onFecharChegou: () => void
  onDescartar: () => void
}

/**
 * Avisos do topo do formulário: alterações deste aparelho restauradas, o que
 * chegou do outro aparelho e registro excluído em outro aparelho.
 */
export function AvisosSincronia({ estado, nome, onFecharChegou, onDescartar }: AvisosProps) {
  const chegou = estado.chegou
  useEffect(() => {
    if (!chegou) return
    const t = setTimeout(onFecharChegou, 20_000)
    return () => clearTimeout(t)
  }, [chegou, onFecharChegou])

  return (
    <>
      {estado.excluido && (
        <div role="alert" className="flex gap-2 rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            Este {nome} foi excluído em outro aparelho. Se você salvar, ele é criado de novo com o que está na tela.
          </span>
        </div>
      )}

      {estado.restaurado && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300">
          <span className="flex items-center gap-1.5">
            <History size={14} className="shrink-0" />
            Rascunho restaurado (salvo {formatarHoraRascunho(estado.restaurado.salvoEm)}) — continue de onde parou.
          </span>
          <button type="button" onClick={onDescartar} className="shrink-0 font-semibold underline">
            Descartar
          </button>
        </div>
      )}

      {chegou && (
        <div
          role="status"
          aria-label="Chegou do outro aparelho"
          className="flex items-start gap-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 px-4 py-2.5 text-xs text-sky-900 dark:text-sky-200"
        >
          <Smartphone size={14} className="shrink-0 mt-0.5" />
          <div className="flex-1 space-y-0.5">
            {chegou.campos.length > 0 && (
              <p>
                <strong>Chegou do outro aparelho:</strong> {chegou.campos.join(', ')}.
              </p>
            )}
            {chegou.conflitos.length > 0 && (
              <p className="text-amber-800 dark:text-amber-300">
                Mudado nos dois aparelhos ao mesmo tempo (ficou o deste, confira): {chegou.conflitos.join(', ')}.
              </p>
            )}
          </div>
          <button type="button" onClick={onFecharChegou} aria-label="Fechar aviso" className="shrink-0 -m-1 p-1">
            <X size={14} />
          </button>
        </div>
      )}
    </>
  )
}

/** Linha curta no rodapé: salvo, ainda não salvo (mas já no outro aparelho) ou sem internet. */
export function LinhaSincronia({ estado }: { estado: EstadoSincronia }) {
  if (!estado.pronto) return null
  if (!estado.online) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400" role="status">
        <CloudOff size={12} className="shrink-0" /> Sem internet · o que você preencher fica guardado neste aparelho
      </p>
    )
  }
  if (estado.pendente) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400" role="status">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
        {estado.enviando ? 'Enviando para o outro aparelho...' : 'Ainda não salvo · o outro aparelho já vê o que você preencheu'}
      </p>
    )
  }
  if (estado.banco) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-green-700 dark:text-green-400" role="status">
        <CheckCircle2 size={12} className="shrink-0" /> Tudo salvo
      </p>
    )
  }
  return null
}
