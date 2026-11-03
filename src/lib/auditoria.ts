import type { RegistroAuditoria } from '../types/fechamento'
import { formatarMoeda } from './calculations'

/** Nomes legíveis dos campos de fechamento, pra descrever o que mudou. */
const CAMPOS_FECHAMENTO: Record<string, string> = {
  data: 'Data',
  dinheiro_abertura: 'Dinheiro abertura',
  dinheiro_fechamento: 'Dinheiro fechamento',
  pix_lc: 'PIX LC',
  debito_lc: 'Débito LC',
  credito_lc: 'Crédito LC',
  consumo_loja: 'Consumo loja',
  a_prazo: 'A prazo',
  ticket: 'Ticket',
  pix_brendi: 'PIX Brendi',
  debito_brendi: 'Débito Brendi',
  credito_brendi: 'Crédito Brendi',
  credito_online_brendi: 'Crédito online Brendi',
  dinheiro_brendi: 'Dinheiro Brendi',
  total_lc_sistema: 'Total LC Sistema',
  ajuste_tipo: 'Tipo de ajuste',
  ajuste_valor: 'Valor do ajuste',
  diferenca_final: 'Diferença final',
  observacoes: 'Observações',
  marmitas: 'Marmitas',
}

const CAMPOS_TEXTO = new Set(['data', 'ajuste_tipo', 'observacoes', 'marmitas'])

function valorLegivel(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (campo === 'marmitas' && Array.isArray(v)) {
    return v.map((m) => `${(m as { prato: string }).prato} ${(m as { quantidade: number }).quantidade}`).join(', ') || '—'
  }
  if (CAMPOS_TEXTO.has(campo)) return String(v)
  const n = Number(v)
  return Number.isFinite(n) ? formatarMoeda(n) : String(v)
}

/** Lista "Campo: antes → depois" do que mudou numa alteração de fechamento. */
export function mudancasFechamento(r: RegistroAuditoria): string[] {
  if (r.operacao !== 'update' || !r.antes || !r.depois) return []
  const mudancas: string[] = []
  for (const [campo, rotulo] of Object.entries(CAMPOS_FECHAMENTO)) {
    const a = r.antes[campo]
    const d = r.depois[campo]
    const igual = CAMPOS_TEXTO.has(campo) ? JSON.stringify(a ?? null) === JSON.stringify(d ?? null) : Number(a) === Number(d)
    if (!igual) mudancas.push(`${rotulo}: ${valorLegivel(campo, a)} → ${valorLegivel(campo, d)}`)
  }
  return mudancas
}

export const ROTULO_OPERACAO_AUDITORIA: Record<RegistroAuditoria['operacao'], string> = {
  insert: 'Criado',
  update: 'Alterado',
  delete: 'Excluído',
}
