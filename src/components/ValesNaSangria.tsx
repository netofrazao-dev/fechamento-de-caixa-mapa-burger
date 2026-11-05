import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Plus, Trash2 } from 'lucide-react'
import type { Vale } from '../types/fechamento'
import { formatarMoeda } from '../lib/calculations'
import { criarVale, excluirVale, mensagemDeErro } from '../lib/valeService'
import { avisosVale, dataValida, somarValores } from '../lib/vales'
import { formatarDataBr, hojeLocal } from '../lib/datas'
import CampoMoeda from './CampoMoeda'
import SeletorFuncionarios from './SeletorFuncionarios'

interface Props {
  /** Dia do relatório: é a data do vale. */
  data: string
  /** Vales já lançados nesse dia (null = carregando). */
  vales: Vale[] | null
  erroCarregar?: string | null
  /** Chamado depois de lançar ou excluir (a tela atualiza na hora e confere de novo com o banco). */
  onMudou: (mudanca: { lancado?: Vale; excluidoId?: string }) => void
}

/**
 * Vales dentro das sangrias do relatório. O vale é tirado do dinheiro do caixa
 * (conta como sangria do dia) e é lançado na hora na tabela de vales, então já
 * aparece na tela Vales e no acerto do mês da pessoa — sem lançar duas vezes.
 */
export default function ValesNaSangria({ data, vales, erroCarregar, onMudou }: Props) {
  const [abrindo, setAbrindo] = useState(false)
  const [funcionario, setFuncionario] = useState<string[]>([])
  const [valor, setValor] = useState(0)
  const [observacao, setObservacao] = useState('')
  const [avisos, setAvisos] = useState<string[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [excluindo, setExcluindo] = useState<{ id: string; motivo: string } | null>(null)
  // Trava contra toque duplo (o estado do React só atualiza no próximo render).
  const travado = useRef(false)

  const lista = vales ?? []
  const total = somarValores(lista.map((v) => v.valor))
  const mes = data.slice(0, 7)

  function limparForm() {
    setFuncionario([])
    setValor(0)
    setObservacao('')
    setAvisos(null)
  }

  async function lancar(confirmado = false) {
    if (ocupado || travado.current) return
    setErro(null)
    setOk(null)
    const input = { funcionario: funcionario[0] ?? '', data, valor, observacao }
    if (!confirmado) {
      const a = avisosVale(input, { hoje: hojeLocal(), existentes: lista })
      if (a.length > 0) {
        setAvisos(a)
        return
      }
    }
    travado.current = true
    setOcupado(true)
    try {
      const v = await criarVale(input)
      setOk(`Vale de ${v.funcionario} (${formatarMoeda(v.valor)}) lançado. Já entrou nas sangrias e nos vales de ${v.funcionario}.`)
      limparForm()
      setAbrindo(false)
      onMudou({ lancado: v })
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não consegui lançar o vale.'))
      setAvisos(null)
    } finally {
      travado.current = false
      setOcupado(false)
    }
  }

  async function confirmarExclusao() {
    if (!excluindo || ocupado || travado.current) return
    setErro(null)
    setOk(null)
    travado.current = true
    setOcupado(true)
    try {
      const v = await excluirVale(excluindo.id, excluindo.motivo)
      setOk(`Vale de ${v.funcionario} excluído (fica no histórico dos vales).`)
      setExcluindo(null)
      onMudou({ excluidoId: v.id })
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não consegui excluir o vale.'))
    } finally {
      travado.current = false
      setOcupado(false)
    }
  }

  return (
    <div className="space-y-2">
      {erroCarregar && <p className="text-xs text-red-600 dark:text-red-400">{erroCarregar}</p>}
      {vales === null && !erroCarregar && <p className="text-xs text-gray-400 dark:text-gray-500">Carregando os vales do dia...</p>}

      {lista.length > 0 && (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700" aria-label="Vales do dia">
          {lista.map((v) => (
            <li key={v.id} className="py-1.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex-1 min-w-0 text-sm text-gray-800 dark:text-gray-200">
                  {v.funcionario}
                  {v.observacao && <span className="block text-[11px] text-gray-500 dark:text-gray-400 truncate">{v.observacao}</span>}
                </span>
                <span className="text-sm tabular-nums text-gray-900 dark:text-gray-100">{formatarMoeda(v.valor)}</span>
                <button
                  type="button"
                  onClick={() => setExcluindo(excluindo?.id === v.id ? null : { id: v.id, motivo: '' })}
                  className="shrink-0 p-2 text-gray-400 dark:text-gray-500 hover:text-red-500"
                  aria-label={`Excluir vale de ${v.funcionario}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              {excluindo?.id === v.id && (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    maxLength={300}
                    placeholder="Motivo da exclusão (obrigatório)"
                    aria-label={`Motivo para excluir o vale de ${v.funcionario}`}
                    className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm outline-none focus:border-gray-500"
                    value={excluindo.motivo}
                    onChange={(e) => setExcluindo({ id: v.id, motivo: e.target.value })}
                  />
                  <button
                    type="button"
                    disabled={ocupado || !excluindo.motivo.trim()}
                    onClick={confirmarExclusao}
                    className="shrink-0 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    Excluir
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {ok && (
        <p role="status" className="flex items-start gap-1.5 text-xs text-green-700 dark:text-green-400">
          <CheckCircle2 size={14} className="shrink-0 mt-px" /> {ok}
        </p>
      )}
      {erro && (
        <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          {erro}
        </p>
      )}

      {abrindo ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 space-y-3">
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Para quem?</p>
            <SeletorFuncionarios
              value={funcionario}
              onChange={(v) => {
                setFuncionario(v)
                setAvisos(null)
              }}
              unico
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CampoMoeda
              label="Valor do vale"
              value={valor}
              onChange={(v) => {
                setValor(v)
                setAvisos(null)
              }}
              somavel={false}
            />
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Observação</span>
              <input
                maxLength={300}
                placeholder="(opcional)"
                className="w-full min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2.5 py-2 text-sm outline-none focus:border-gray-500"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </label>
          </div>
          {avisos && (
            <div role="alert" className="rounded-lg bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              {avisos.map((a) => (
                <p key={a}>{a}</p>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={ocupado || !funcionario.length || !(valor > 0) || !dataValida(data)}
              onClick={() => lancar(Boolean(avisos))}
              className="flex-1 rounded-lg bg-gray-900 dark:bg-gray-700 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {ocupado ? 'Lançando...' : avisos ? 'Está certo, lançar vale' : 'Lançar vale'}
            </button>
            <button
              type="button"
              onClick={() => {
                limparForm()
                setAbrindo(false)
              }}
              className="shrink-0 rounded-lg px-3 text-sm font-medium text-gray-500 dark:text-gray-400"
            >
              Cancelar
            </button>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            O vale é lançado na hora, com a data {dataValida(data) ? formatarDataBr(data) : 'do relatório'}.
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => {
              setAbrindo(true)
              setOk(null)
            }}
            className="flex items-center gap-1 text-sm font-medium text-gray-900 dark:text-gray-100 hover:underline"
          >
            <Plus size={15} /> Lançar vale
          </button>
          {lista.length > 0 && (
            <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">Total: {formatarMoeda(total)}</span>
          )}
        </div>
      )}

      {dataValida(data) && (
        <Link to={`/vales?mes=${mes}`} className="inline-block text-xs font-medium text-gray-500 dark:text-gray-400 hover:underline">
          Ver os vales do mês de cada pessoa
        </Link>
      )}
    </div>
  )
}
