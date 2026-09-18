import type { DadosLC } from '../types/fechamento'
import { calcularTotalLC, formatarMoeda } from '../lib/calculations'
import CampoMoeda from './CampoMoeda'
import Secao from './Secao'

interface Props {
  value: DadosLC
  onChange: (value: DadosLC) => void
  defaultAberto?: boolean
}

export default function LCForm({ value, onChange, defaultAberto }: Props) {
  const set = <K extends keyof DadosLC>(key: K, v: number) => onChange({ ...value, [key]: v })
  const total = calcularTotalLC(value)

  return (
    <Secao titulo="LC" resumo={`Total: ${formatarMoeda(total)}`} defaultAberto={defaultAberto}>
      <div className="grid grid-cols-2 gap-3">
        <CampoMoeda
          label="Dinheiro de abertura"
          value={value.dinheiroAbertura}
          onChange={(v) => set('dinheiroAbertura', v)}
          somavel={false}
          helper="Não entra no total"
        />
        <CampoMoeda
          label="Dinheiro / fechamento"
          value={value.dinheiroFechamento}
          onChange={(v) => set('dinheiroFechamento', v)}
        />
        <CampoMoeda label="PIX" value={value.pix} onChange={(v) => set('pix', v)} />
        <CampoMoeda label="Débito" value={value.debito} onChange={(v) => set('debito', v)} />
        <CampoMoeda label="Crédito" value={value.credito} onChange={(v) => set('credito', v)} />
        <CampoMoeda
          label="Consumo da loja"
          value={value.consumoLoja}
          onChange={(v) => set('consumoLoja', v)}
        />
        <CampoMoeda label="A prazo" value={value.aPrazo} onChange={(v) => set('aPrazo', v)} />
        <CampoMoeda label="Ticket" value={value.ticket} onChange={(v) => set('ticket', v)} />
      </div>
      <div className="flex justify-between items-center pt-1 text-sm">
        <span className="text-gray-400">Total LC</span>
        <span className="font-semibold text-gray-900">{formatarMoeda(total)}</span>
      </div>
    </Secao>
  )
}
