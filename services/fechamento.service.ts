import { supabase } from '@/lib/supabase'
import {
  calcularFechamento,
  type CamposLC,
  type CamposBrandy,
  type CamposResultado,
  type ResultadoFechamento,
} from '@/lib/utils'

// ============================================================
// Tipos
// ============================================================

export interface FechamentoInput {
  // Meta
  data_fechamento: string          // 'YYYY-MM-DD'

  // LC
  dinheiro_abertura_lc:   number   // só exibe, não entra em cálculo
  dinheiro_fechamento_lc: number
  pix_lc:                 number
  debito_lc:              number
  credito_lc:             number
  consumo_loja_lc:        number
  a_prazo_lc:             number
  ticket_lc:              number
  sangria_lc:             number   // só exibe, não entra em cálculo

  // Brandy
  pix_brandy:            number
  debito_brandy:         number
  credito_brandy:        number
  credito_online_brandy: number
  dinheiro_brandy:       number   // entra no totalSistema, não no totalBrandy

  // Sistema + ajuste
  total_lc_sistema: number
  ajuste_manual:    number        // positivo = adiciona, negativo = remove

  // Texto
  observacoes?: string
}

export interface FechamentoPayload extends FechamentoInput, ResultadoFechamento {
  created_at: string
}

export type ToastType = 'success' | 'error'

export interface ToastMessage {
  type:    ToastType
  title:   string
  message: string
}

export interface InsertResult {
  success: boolean
  toast:   ToastMessage
  data?:   FechamentoPayload
}

// ============================================================
// Função principal
// ============================================================

export async function inserirFechamento(
  input: FechamentoInput,
  opts?: {
    /** Callback chamado no início (loading = true) */
    onLoadingStart?: () => void
    /** Callback chamado ao fim (loading = false) */
    onLoadingEnd?: () => void
    /** Callback chamado com o toast de resultado */
    onToast?: (toast: ToastMessage) => void
  },
): Promise<InsertResult> {

  opts?.onLoadingStart?.()

  try {
    // ── 1. Montar objetos para calcularFechamento ────────────
    const camposLC: CamposLC = {
      dinheiro_abertura_lc:   input.dinheiro_abertura_lc,   // só exibe
      sangria_lc:             input.sangria_lc,             // só exibe
      dinheiro_fechamento_lc: input.dinheiro_fechamento_lc,
      pix_lc:                 input.pix_lc,
      debito_lc:              input.debito_lc,
      credito_lc:             input.credito_lc,
      consumo_loja_lc:        input.consumo_loja_lc,
      a_prazo_lc:             input.a_prazo_lc,
      ticket_lc:              input.ticket_lc,              // entra no totalLC
    }

    const camposBrandy: CamposBrandy = {
      dinheiro_brandy:       input.dinheiro_brandy,
      pix_brandy:            input.pix_brandy,
      debito_brandy:         input.debito_brandy,
      credito_brandy:        input.credito_brandy,
      credito_online_brandy: input.credito_online_brandy,
    }

    const camposResultado: CamposResultado = {
      total_lc_sistema: input.total_lc_sistema,
      ajuste_manual:    input.ajuste_manual,
    }

    // ── 2. Calcular todos os totais ──────────────────────────
    const resultado = calcularFechamento(camposLC, camposBrandy, camposResultado)

    // ── 3. Montar payload completo ───────────────────────────
    const payload: FechamentoPayload = {
      // meta
      data_fechamento:      input.data_fechamento,
      created_at:           new Date().toISOString(),

      // LC — campos exibição
      dinheiro_abertura_lc:   input.dinheiro_abertura_lc,
      sangria_lc:             input.sangria_lc,

      // LC — campos de cálculo
      dinheiro_fechamento_lc: input.dinheiro_fechamento_lc,
      pix_lc:                 input.pix_lc,
      debito_lc:              input.debito_lc,
      credito_lc:             input.credito_lc,
      consumo_loja_lc:        input.consumo_loja_lc,
      a_prazo_lc:             input.a_prazo_lc,
      ticket_lc:              input.ticket_lc,

      // Brandy
      pix_brandy:            input.pix_brandy,
      debito_brandy:         input.debito_brandy,
      credito_brandy:        input.credito_brandy,
      credito_online_brandy: input.credito_online_brandy,
      dinheiro_brandy:       input.dinheiro_brandy,

      // Sistema
      total_lc_sistema: input.total_lc_sistema,
      ajuste_manual:    input.ajuste_manual,

      // Calculados
      total_lc:        resultado.total_lc,
      total_brandy:    resultado.total_brandy,
      total_caixa:     resultado.total_caixa,
      total_sistema:   resultado.total_sistema,
      diferenca:       resultado.diferenca,
      diferenca_final: resultado.diferenca_final,
      status:          resultado.status,

      // Texto
      observacoes: input.observacoes?.trim() || undefined
    }

    // ── 4. Inserir no Supabase ───────────────────────────────
    const { data, error } = await supabase
      .from('cash_closings')
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    // ── 5. Sucesso ───────────────────────────────────────────
    const toast: ToastMessage = {
      type:    'success',
      title:   'Fechamento salvo!',
      message: `${formatarData(input.data_fechamento)} — Status: ${resultado.status}`,
    }

    opts?.onToast?.(toast)
    opts?.onLoadingEnd?.()

    return { success: true, toast, data: data as FechamentoPayload }

  } catch (err) {
    // ── 6. Tratamento de erro ────────────────────────────────
    const mensagem = extrairMensagemErro(err)

    const toast: ToastMessage = {
      type:    'error',
      title:   'Erro ao salvar',
      message: mensagem,
    }

    opts?.onToast?.(toast)
    opts?.onLoadingEnd?.()

    console.error('[inserirFechamento]', err)

    return { success: false, toast }
  }
}

// ============================================================
// Utilitários internos
// ============================================================

function extrairMensagemErro(err: unknown): string {
  if (err instanceof Error) return err.message

  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>
    if (typeof e.message === 'string') return e.message
    if (typeof e.details === 'string') return e.details
    if (typeof e.hint    === 'string') return e.hint
  }

  return 'Erro desconhecido. Tente novamente.'
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}