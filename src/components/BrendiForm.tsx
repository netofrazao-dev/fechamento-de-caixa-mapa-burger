import type { DadosBrendi } from '../types/fechamento'
import CampoMoeda from './CampoMoeda'

interface Props {
  value: DadosBrendi
  onChange: (value: DadosBrendi) => void
}

export default function BrendiForm({ value, onChange }: Props) {
  const set = <K extends keyof DadosBrendi>(key: K, v: number) => onChange({ ...value, [key]: v })

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Brendi</h2>
      <div className="grid grid-cols-2 gap-3">
        <CampoMoeda label="PIX" value={value.pix} onChange={(v) => set('pix', v)} />
        <CampoMoeda label="Débito" value={value.debito} onChange={(v) => set('debito', v)} />
        <CampoMoeda label="Crédito" value={value.credito} onChange={(v) => set('credito', v)} />
        <CampoMoeda
          label="Crédito Online"
          value={value.creditoOnline}
          onChange={(v) => set('creditoOnline', v)}
        />
        <CampoMoeda
          label="Dinheiro"
          value={value.dinheiro}
          onChange={(v) => set('dinheiro', v)}
          helper="Não entra no Total Brendi (entra no Total Sistema)"
        />
      </div>
    </section>
  )
}
