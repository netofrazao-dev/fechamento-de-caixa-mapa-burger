import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
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
  const [mostrarObs, setMostrarObs] = useState(false)
  return (
    <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-4">
      <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Conferência</h2>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
        <Linha label="Total LC" valor={resultado.totalLC} />
        <Linha label="Total Brendi" valor={resultado.totalBrendi} />
        <Linha label="Total Caixa" valor={resultado.totalCaixa} destaque />
        <Linha label="Total Sistema" valor={resultado.totalSistema} destaque />
      </div>

      <CampoMoeda
        label="Total LC Sistema (do computador do LC)"
        value={totalLCSistema}
        onChange={onTotalLCSistemaChange}
        somavel={false}
      />

      <div className="flex justify-between items-center text-sm px-1">
        <span className="text-gray-400 dark:text-gray-500">Diferença original</span>
        <span className="font-medium text-gray-700 dark:text-gray-300">{formatarMoeda(resultado.diferencaOriginal)}</span>
      </div>

      <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3">
        <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Ajuste manual</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onAjusteChange({ ...ajuste, tipo: ajuste.tipo === 'adicionar' ? null : 'adicionar' })}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${
              ajuste.tipo === 'adicionar'
                ? 'bg-green-600 text-white'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          >
            <Plus size={14} /> Adicionar
          </button>
          <button
            type="button"
            onClick={() => onAjusteChange({ ...ajuste, tipo: ajuste.tipo === 'remover' ? null : 'remover' })}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${
              ajuste.tipo === 'remover'
                ? 'bg-red-600 text-white'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          >
            <Minus size={14} /> Remover
          </button>
        </div>
        {ajuste.tipo && (
          <CampoMoeda
            label="Valor do ajuste"
            value={ajuste.valor}
            onChange={(v) => onAjusteChange({ ...ajuste, valor: v })}
            somavel={false}
          />
        )}
      </div>

      {(ajuste.tipo || observacoes || mostrarObs) && (
        <label className="flex flex-col gap-1 border-t border-gray-100 dark:border-gray-800 pt-3">
          <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Observações</span>
          <textarea
            autoFocus={mostrarObs && !observacoes}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm outline-none focus:border-gray-400"
            rows={2}
            placeholder="Explique o motivo do ajuste, se houver."
            value={observacoes}
            onChange={(e) => onObservacoesChange(e.target.value)}
          />
        </label>
      )}
      {!ajuste.tipo && !observacoes && !mostrarObs && (
        <button
          type="button"
          onClick={() => setMostrarObs(true)}
          className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300 hover:underline"
        >
          + Adicionar observação
        </button>
      )}

      <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
        <div className="flex justify-between items-center text-sm px-1">
          <span className="text-gray-400 dark:text-gray-500">Diferença final</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{formatarMoeda(resultado.diferencaFinal)}</span>
        </div>
        <div
          className={`rounded-xl px-4 py-3 text-center font-semibold ${STATUS_COLOR[resultado.status]}`}
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
      <span className="text-[11px] text-gray-400 dark:text-gray-500">{label}</span>
      <span className={destaque ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}>
        {formatarMoeda(valor)}
      </span>
    </div>
  )
}
