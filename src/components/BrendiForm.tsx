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
    <Secao
      titulo="2. Brendi"
      resumo={`Total Brendi: ${formatarMoeda(total)}`}
      defaultAberto={defaultAberto}
      ajuda="Vendas do Brendi (delivery). O dinheiro do Brendi entra só no Total Sistema."
    >
      <div className="grid grid-cols-2 gap-3">
        <CampoMoeda label="PIX" value={value.pix} onChange={(v) => set('pix', v)} />
        <CampoMoeda label="Débito" value={value.debito} onChange={(v) => set('debito', v)} />
        <CampoMoeda label="Crédito" value={value.credito} onChange={(v) => set('credito', v)} />
        <CampoMoeda label="Crédito Online" value={value.creditoOnline} onChange={(v) => set('creditoOnline', v)} />
        <CampoMoeda
          label="Dinheiro"
          value={value.dinheiro}
          onChange={(v) => set('dinheiro', v)}
          helper="Não entra no Total Brendi."
        />
      </div>
      <div className="flex justify-between items-center pt-1 text-sm">
        <span className="text-gray-400 dark:text-gray-500">Total Brendi</span>
        <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatarMoeda(total)}</span>
      </div>
    </Secao>
  )
}
