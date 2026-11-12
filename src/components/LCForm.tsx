import type { DadosLC } from '../types/fechamento'
import { calcularTotalLC, formatarMoeda } from '../lib/calculations'
import CampoMoeda from './CampoMoeda'
import Secao from './Secao'

interface Props {
  value: DadosLC
  onChange: (value: DadosLC) => void
  defaultAberto?: boolean
  /** Suprimento: dinheiro colocado no caixa durante o dia (só informativo, como a abertura). */
  suprimento: number
  suprimentoObs: string
  onSuprimentoChange: (valor: number, observacao: string) => void
}

export default function LCForm({ value, onChange, defaultAberto, suprimento, suprimentoObs, onSuprimentoChange }: Props) {
  const faltaObs = suprimento > 0 && !suprimentoObs.trim()
  const set = <K extends keyof DadosLC>(key: K, v: number) => onChange({ ...value, [key]: v })
  const total = calcularTotalLC(value)

  return (
    <Secao
      titulo="1. Caixa LC"
      resumo={`Total LC: ${formatarMoeda(total)}${suprimento > 0 ? ` · suprimento ${formatarMoeda(suprimento)}` : ''}`}
      alerta={faltaObs}
      defaultAberto={defaultAberto}
      ajuda="O que foi apurado no caixa da LC. Use o + ao lado do campo para somar comprovantes um a um."
    >
      <div className="grid grid-cols-2 gap-3">
        <CampoMoeda
          label="Dinheiro de abertura"
          value={value.dinheiroAbertura}
          onChange={(v) => set('dinheiroAbertura', v)}
          somavel={false}
          helper="Troco do início do dia. Não entra no total."
        />
        <CampoMoeda
          label="Suprimento"
          value={suprimento}
          onChange={(v) => onSuprimentoChange(v, suprimentoObs)}
          somavel={false}
          helper="Dinheiro colocado no caixa durante o dia. Não entra no total."
        />
        {suprimento > 0 && (
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Observação do suprimento</span>
            <input
              type="text"
              maxLength={300}
              placeholder="De onde veio o dinheiro (obrigatório)"
              aria-invalid={faltaObs}
              className={`w-full min-w-0 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-500 ${
                faltaObs ? 'border-red-400 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'
              }`}
              value={suprimentoObs}
              onChange={(e) => onSuprimentoChange(suprimento, e.target.value)}
            />
            {faltaObs && <span className="text-[11px] text-red-600 dark:text-red-400">Escreva de onde veio o suprimento.</span>}
          </label>
        )}
        <CampoMoeda
          label="Dinheiro no fechamento"
          value={value.dinheiroFechamento}
          onChange={(v) => set('dinheiroFechamento', v)}
          helper="Dinheiro contado na gaveta."
        />
        <CampoMoeda label="PIX" value={value.pix} onChange={(v) => set('pix', v)} />
        <CampoMoeda label="Débito" value={value.debito} onChange={(v) => set('debito', v)} />
        <CampoMoeda label="Crédito" value={value.credito} onChange={(v) => set('credito', v)} />
        <CampoMoeda label="Consumo da loja" value={value.consumoLoja} onChange={(v) => set('consumoLoja', v)} />
        <CampoMoeda label="A prazo" value={value.aPrazo} onChange={(v) => set('aPrazo', v)} />
        <CampoMoeda label="Ticket" value={value.ticket} onChange={(v) => set('ticket', v)} />
      </div>
      <div className="flex justify-between items-center pt-1 text-sm">
        <span className="text-gray-400 dark:text-gray-500">Total LC</span>
        <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatarMoeda(total)}</span>
      </div>
    </Secao>
  )
}
