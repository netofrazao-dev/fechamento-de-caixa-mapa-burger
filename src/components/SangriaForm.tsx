import type { Sangria } from '../types/fechamento'
import { formatarMoeda } from '../lib/calculations'
import { somarValores } from '../lib/vales'
import ListaValorMotivo from './ListaValorMotivo'
import Secao from './Secao'

interface Props {
  value: Sangria[]
  onChange: (value: Sangria[]) => void
}

export default function SangriaForm({ value, onChange }: Props) {
  const total = somarValores(value.map((s) => s.valor))
  const pendente = value.some((s) => s.valor > 0 && !s.motivo.trim())
  const resumo =
    value.length > 0 ? `${value.length} · ${formatarMoeda(total)}${pendente ? ' · falta motivo' : ''}` : 'Nenhuma'

  return (
    <Secao titulo="4. Sangrias" resumo={resumo} alerta={pendente} defaultAberto={value.length > 0}>
      <p className="text-xs text-gray-400 dark:text-gray-500 -mt-1">
        Dinheiro retirado do caixa durante o dia. Só informativo: não entra no Total LC.
      </p>
      <ListaValorMotivo value={value} onChange={onChange} />
    </Secao>
  )
}
