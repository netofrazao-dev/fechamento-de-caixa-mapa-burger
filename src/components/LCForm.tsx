import type { DadosLC } from '../types/fechamento'
import CampoMoeda from './CampoMoeda'

interface Props {
  value: DadosLC
  onChange: (value: DadosLC) => void
}

export default function LCForm({ value, onChange }: Props) {
  const set = <K extends keyof DadosLC>(key: K, v: number) => onChange({ ...value, [key]: v })

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">LC</h2>
      <div className="grid grid-cols-2 gap-3">
        <CampoMoeda
          label="Dinheiro de abertura"
          value={value.dinheiroAbertura}
          onChange={(v) => set('dinheiroAbertura', v)}
          helper="Informativo, não entra no total"
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
    </section>
  )
}
