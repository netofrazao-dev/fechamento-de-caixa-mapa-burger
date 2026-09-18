import type { Ajuste, ResultadoCalculado } from '../types/fechamento'
import { formatarMoeda, STATUS_COLOR, STATUS_LABEL } from '../lib/calculations'
import CampoMoeda from './CampoMoeda'

interface Props {
  resultado: ResultadoCalculado
  totalLCSistema: number
  onTotalLCSistemaChange: (v: number) => void
  ajuste: Ajuste
  onAjusteChange: (a: Ajuste) => void
  observacoes: string
  onObservacoesChange: (v: string) => void
}

export default function ResultadoCard({
  resultado,
  totalLCSistema,
  onTotalLCSistemaChange,
  ajuste,
  onAjusteChange,
  observacoes,
  onObservacoesChange,
}: Props) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Conferência</h2>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Linha label="Total LC (calculado)" valor={resultado.totalLC} />
        <Linha label="Total Brendi (calculado)" valor={resultado.totalBrendi} />
        <Linha label="Total Caixa" valor={resultado.totalCaixa} destaque />
      </div>

      <div className="border-t border-gray-100 pt-4">
        <CampoMoeda
          label="Total LC Sistema (digitado do computador do LC)"
          value={totalLCSistema}
          onChange={onTotalLCSistemaChange}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm border-t border-gray-100 pt-4">
        <Linha label="Total Sistema" valor={resultado.totalSistema} destaque />
        <Linha label="Diferença original" valor={resultado.diferencaOriginal} />
      </div>

      <div className="border-t border-gray-100 pt-4 space-y-3">
        <span className="text-sm font-medium text-gray-700">Ajuste manual</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onAjusteChange({ ...ajuste, tipo: ajuste.tipo === 'adicionar' ? null : 'adicionar' })}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium ${
              ajuste.tipo === 'adicionar'
                ? 'border-green-600 bg-green-50 text-green-700'
                : 'border-gray-300 text-gray-500'
            }`}
          >
            Adicionar
          </button>
          <button
            type="button"
            onClick={() => onAjusteChange({ ...ajuste, tipo: ajuste.tipo === 'remover' ? null : 'remover' })}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium ${
              ajuste.tipo === 'remover'
                ? 'border-red-600 bg-red-50 text-red-700'
                : 'border-gray-300 text-gray-500'
            }`}
          >
            Remover
          </button>
        </div>
        <CampoMoeda
          label="Valor do ajuste"
          value={ajuste.valor}
          onChange={(v) => onAjusteChange({ ...ajuste, valor: v })}
          disabled={!ajuste.tipo}
        />
      </div>

      <label className="flex flex-col gap-1 border-t border-gray-100 pt-4">
        <span className="text-sm font-medium text-gray-700">Observações</span>
        <textarea
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
          rows={3}
          placeholder="Ex: R$ 10 recebidos em PIX e lançados incorretamente."
          value={observacoes}
          onChange={(e) => onObservacoesChange(e.target.value)}
        />
      </label>

      <div className="border-t border-gray-100 pt-4 space-y-2">
        <Linha label="Diferença final" valor={resultado.diferencaFinal} destaque />
        <div
          className={`rounded-lg border px-4 py-3 text-center font-semibold ${STATUS_COLOR[resultado.status]}`}
        >
          {STATUS_LABEL[resultado.status]}
        </div>
      </div>
    </section>
  )
}

function Linha({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={destaque ? 'font-semibold text-gray-900' : 'text-gray-700'}>
        {formatarMoeda(valor)}
      </span>
    </div>
  )
}
