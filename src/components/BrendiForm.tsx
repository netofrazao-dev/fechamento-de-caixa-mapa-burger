import type { DadosBrendi } from '../types/fechamento'
import { calcularTotalBrendi, formatarMoeda } from '../lib/calculations'
import CampoMoeda from './CampoMoeda'
import Secao from './Secao'

interface Props {
  value: DadosBrendi
  onChange: (value: DadosBrendi) => void
  defaultAberto?: boolean
}

export default function BrendiForm({ value, onChange, defaultAberto }: Props) {
  const set = <K extends keyof DadosBrendi>(key: K, v: number) => onChange({ ...value, [key]: v })
  const total = calcularTotalBrendi(value)

  return (
    <Secao titulo="Brendi" resumo={`Total: ${formatarMoeda(total)}`} defaultAberto={defaultAberto}>
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
          helper="Não entra no total Brendi"
        />
      </div>
      <div className="flex justify-between items-center pt-1 text-sm">
        <span className="text-gray-400">Total Brendi</span>
        <span className="font-semibold text-gray-900">{formatarMoeda(total)}</span>
      </div>
    </Secao>
  )
}
