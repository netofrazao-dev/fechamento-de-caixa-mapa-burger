import type { Sangria, TipoSangria, Vale } from '../types/fechamento'
import { formatarMoeda } from '../lib/calculations'
import { resumoSangrias, TIPOS_SANGRIA, tipoDaSangria } from '../lib/sangrias'
import ListaValorMotivo from './ListaValorMotivo'
import ValesNaSangria from './ValesNaSangria'

interface Props {
  value: Sangria[]
  onChange: (value: Sangria[]) => void
  /** Dia do relatório (data dos vales lançados aqui). */
  data: string
  /** Vales do dia (vêm da tabela de vales; null = carregando). */
  vales: Vale[] | null
  erroVales?: string | null
  onValesMudou: () => void
}

/**
 * Sangrias do relatório em quatro grupos: Compras ($), Pagamentos e Vales
 * (saem do dinheiro do caixa e entram no total) e PIX (pago no PIX do patrão:
 * fica só registrado, fora do total de sangrias).
 */
export default function SangriasRelatorio({ value, onChange, data, vales, erroVales, onValesMudou }: Props) {
  const resumo = resumoSangrias(value, vales ?? [])

  function trocarGrupo(tipo: TipoSangria, lista: Sangria[]) {
    // Mantém os grupos sempre na mesma ordem: compras, pagamentos, PIX.
    const novos = TIPOS_SANGRIA.flatMap((t) =>
      t.tipo === tipo ? lista.map((s) => ({ ...s, tipo })) : value.filter((s) => tipoDaSangria(s) === t.tipo),
    )
    onChange(novos)
  }

  return (
    <div className="space-y-4">
      {TIPOS_SANGRIA.map((t) => {
        const lista = value.filter((s) => tipoDaSangria(s) === t.tipo)
        const blocoVales = t.tipo === 'pix' && (
          <div key="vales" className="rounded-xl p-3 space-y-2 bg-gray-50 dark:bg-gray-800/60">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Vales</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Vale de funcionário tirado do dinheiro do caixa. Entra no total de sangrias e já vai para os vales do mês da pessoa.
              </p>
            </div>
            <ValesNaSangria data={data} vales={vales} erroCarregar={erroVales} onMudou={onValesMudou} />
          </div>
        )
        return [
          blocoVales,
          <div
            key={t.tipo}
            className={`rounded-xl p-3 space-y-2 ${
              t.saiDoCaixa ? 'bg-gray-50 dark:bg-gray-800/60' : 'bg-blue-50 dark:bg-blue-950/30'
            }`}
          >
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.rotulo}</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{t.ajuda}</p>
            </div>
            <ListaValorMotivo
              value={lista}
              onChange={(l) => trocarGrupo(t.tipo, l)}
              textoAdicionar={t.textoAdicionar}
              placeholderMotivo={t.placeholderMotivo}
              nomeLinha={t.nomeLinha}
            />
          </div>,
        ]
      })}

      {(value.length > 0 || resumo.vales.length > 0) && (
        <dl className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm space-y-1" aria-label="Totais das sangrias">
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-gray-900 dark:text-gray-100">Total de sangrias (saiu do caixa)</dt>
            <dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatarMoeda(resumo.totalSangrias)}</dd>
          </div>
          {resumo.pix.length > 0 && (
            <div className="flex justify-between gap-3 text-blue-800 dark:text-blue-300">
              <dt>Pago no PIX (não entra no total)</dt>
              <dd className="tabular-nums">{formatarMoeda(resumo.totalPix)}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  )
}
