import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Store, X } from 'lucide-react'
import { formatarDataBr, formatarDiaMes } from '../lib/datas'
import { desmarcarLojaFechada, marcarLojaFechada, type DiaLojaFechada } from '../lib/lojaFechadaService'
import { mensagemErro } from '../lib/erros'

interface Props {
  /** Dias sem fechamento (já sem os marcados como loja fechada). */
  semFechamento: string[]
  /** Dias marcados como loja fechada no período. */
  fechados: DiaLojaFechada[]
  /** Fim da frase do título: "no período", "em novembro de 2026", "nesta semana". */
  contexto: string
  /** Chamado depois de marcar ou desmarcar (para recarregar). */
  onMudou: () => void
  /** Mostra só os últimos N dias sem fechamento (períodos longos). */
  limite?: number
}

/**
 * Dias sem fechamento: tocando num dia dá para lançar o fechamento dele ou
 * marcar que a loja não abriu (folga, feriado). Os dias de loja fechada
 * aparecem à parte, com "desfazer".
 */
export default function PainelDiasSemFechamento({ semFechamento, fechados, contexto, onMudou, limite }: Props) {
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const visiveis = limite ? semFechamento.slice(-limite) : semFechamento
  const escolhido = selecionado && semFechamento.includes(selecionado) ? selecionado : null

  async function executar(acao: () => Promise<void>) {
    if (ocupado) return
    setOcupado(true)
    setErro(null)
    try {
      await acao()
      setSelecionado(null)
      onMudou()
    } catch (e) {
      setErro(mensagemErro(e, 'Não consegui salvar.'))
    } finally {
      setOcupado(false)
    }
  }

  if (semFechamento.length === 0 && fechados.length === 0) return null

  return (
    <div className="space-y-2">
      {semFechamento.length > 0 && (
        <section className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 space-y-2" aria-label="Dias sem fechamento">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200">
            <AlertCircle size={15} /> {semFechamento.length} dia(s) sem fechamento {contexto}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {visiveis.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={escolhido === d}
                onClick={() => setSelecionado(escolhido === d ? null : d)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  escolhido === d
                    ? 'bg-amber-900 text-white dark:bg-amber-200 dark:text-amber-950'
                    : 'bg-white/80 dark:bg-gray-900/60 text-amber-900 dark:text-amber-200'
                }`}
              >
                {formatarDiaMes(d)}
              </button>
            ))}
          </div>
          {escolhido ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                to={`/novo?data=${escolhido}`}
                className="rounded-lg bg-gray-900 dark:bg-gray-700 px-3 py-2 text-xs font-semibold text-white"
              >
                Lançar fechamento de {formatarDiaMes(escolhido)}
              </Link>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => executar(() => marcarLojaFechada(escolhido))}
                className="flex items-center gap-1.5 rounded-lg bg-white dark:bg-gray-900 px-3 py-2 text-xs font-semibold text-amber-900 dark:text-amber-200 disabled:opacity-50"
              >
                <Store size={14} /> {ocupado ? 'Salvando...' : `A loja não abriu em ${formatarDiaMes(escolhido)}`}
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
              Toque num dia para lançar o fechamento dele ou marcar que a loja não abriu (folga, feriado).
            </p>
          )}
          {erro && <p role="alert" className="text-xs text-red-700 dark:text-red-400">{erro}</p>}
        </section>
      )}

      {fechados.length > 0 && (
        <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-2" aria-label="Dias de loja fechada">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <Store size={15} /> Loja fechada em {fechados.length} dia(s)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {fechados.map((f) => (
              <span
                key={f.data}
                className="flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 pl-2.5 pr-1 py-0.5 text-xs text-gray-600 dark:text-gray-300"
                title={`Marcado ${f.usuario ? `por ${f.usuario} ` : ''}em ${formatarDataBr(f.marcadoEm.slice(0, 10))}`}
              >
                {formatarDiaMes(f.data)}
                {f.motivo && <span className="text-gray-400"> · {f.motivo}</span>}
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => executar(() => desmarcarLojaFechada(f.data))}
                  className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-40"
                  aria-label={`Desfazer loja fechada em ${formatarDiaMes(f.data)}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          {erro && semFechamento.length === 0 && <p role="alert" className="text-xs text-red-700 dark:text-red-400">{erro}</p>}
        </section>
      )}
    </div>
  )
}
