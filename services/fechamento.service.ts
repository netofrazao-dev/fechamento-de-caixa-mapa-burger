import { supabase } from '@/lib/supabase'

import {
  calcularTotalLC,
  calcularTotalBrandy,
  calcularResultados,
} from '@/lib/utils'

// ============================================================
// Tipos
// ============================================================

export interface FechamentoInput {
  // Meta
  data_fechamento: string

  // LC
  dinheiro_abertura_lc: number
  dinheiro_fechamento_lc: number
  pix_lc: number
  debito_lc: number
  credito_lc: number
  consumo_loja_lc: number
  a_prazo_lc: number
  ticket_lc: number
  sangria_lc: number

  // Brandy
  pix_brandy: number
  debito_brandy: number
  credito_brandy: number
  credito_online_brandy: number
  dinheiro_brandy: number

  // Sistema
  total_lc_sistema: number
  ajuste_manual: number

  // Texto
  observacoes?: string
}

export interface FechamentoPayload extends FechamentoInput {
  created_at: string

  total_lc: number
  total_brandy: number
  total_caixa: number
  total_sistema: number
  diferenca: number
  diferenca_final: number
  status: string
}

export type ToastType = 'success' | 'error'

export interface ToastMessage {
  type: ToastType
  title: string
  message: string
}

export interface InsertResult {
  success: boolean
  toast: ToastMessage
  data?: FechamentoPayload
}

// ============================================================
// Função principal
// ============================================================

export async function inserirFechamento(
  input: FechamentoInput,
  opts?: {
    onLoadingStart?: () => void
    onLoadingEnd?: () => void
    onToast?: (toast: ToastMessage) => void
  },
): Promise<InsertResult> {

  opts?.onLoadingStart?.()

  try {

    // ─────────────────────────────────────────────
    // Totais LC
    // ─────────────────────────────────────────────

    const totalLC = calcularTotalLC({
      dinheiro_fechamento_lc: input.dinheiro_fechamento_lc,
      pix_lc: input.pix_lc,
      debito_lc: input.debito_lc,
      credito_lc: input.credito_lc,
      consumo_loja_lc: input.consumo_loja_lc,
      a_prazo_lc: input.a_prazo_lc,
      ticket_lc: input.ticket_lc,
    })

    // ─────────────────────────────────────────────
    // Totais Brandy
    // ─────────────────────────────────────────────

    const totalBrandy = calcularTotalBrandy({
      pix_brandy: input.pix_brandy,
      debito_brandy: input.debito_brandy,
      credito_brandy: input.credito_brandy,
      credito_online_brandy: input.credito_online_brandy,
    })

    // ─────────────────────────────────────────────
    // Resultado final
    // ─────────────────────────────────────────────

    const {
      totalCaixa,
      totalSistema,
      diferenca,
      diferencaFinal,
      status,
    } = calcularResultados(
      totalLC,
      totalBrandy,
      input.total_lc_sistema,
      input.dinheiro_brandy,
      input.ajuste_manual,
    )

    // ─────────────────────────────────────────────
    // Payload
    // ─────────────────────────────────────────────

    const payload: FechamentoPayload = {
      ...input,

      created_at: new Date().toISOString(),

      total_lc: totalLC,
      total_brandy: totalBrandy,
      total_caixa: totalCaixa,
      total_sistema: totalSistema,
      diferenca,
      diferenca_final: diferencaFinal,
      status,

      observacoes: input.observacoes?.trim() || '',
    }

    // ─────────────────────────────────────────────
    // Insert Supabase
    // ─────────────────────────────────────────────

    const { data, error } = await supabase
      .from('cash_closings')
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    const toast: ToastMessage = {
      type: 'success',
      title: 'Fechamento salvo!',
      message: `${formatarData(input.data_fechamento)} — ${status}`,
    }

    opts?.onToast?.(toast)
    opts?.onLoadingEnd?.()

    return {
      success: true,
      toast,
      data: data as FechamentoPayload,
    }

  } catch (err) {

    const toast: ToastMessage = {
      type: 'error',
      title: 'Erro ao salvar',
      message: extrairMensagemErro(err),
    }

    opts?.onToast?.(toast)
    opts?.onLoadingEnd?.()

    console.error('[inserirFechamento]', err)

    return {
      success: false,
      toast,
    }
  }
}

// ============================================================
// Helpers
// ============================================================

function extrairMensagemErro(err: unknown): string {

  if (err instanceof Error) {
    return err.message
  }

  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>

    if (typeof e.message === 'string') {
      return e.message
    }
  }

  return 'Erro desconhecido.'
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}