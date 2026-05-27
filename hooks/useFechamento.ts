'use client'

import { useState, useCallback } from 'react'
import { inserirFechamento, type FechamentoInput, type ToastMessage } from '@/services/fechamento.service'

// ============================================================
// Hook
// ============================================================

export function useFechamento() {
  const [loading, setLoading] = useState(false)
  const [toast,   setToast  ] = useState<ToastMessage | null>(null)

  const salvar = useCallback(async (input: FechamentoInput) => {
    const result = await inserirFechamento(input, {
      onLoadingStart: () => setLoading(true),
      onLoadingEnd:   () => setLoading(false),
      onToast:        (t) => {
        setToast(t)
        // Remove o toast automaticamente após 5s
        setTimeout(() => setToast(null), 5000)
      },
    })

    return result
  }, [])

  const fecharToast = useCallback(() => setToast(null), [])

  return { salvar, loading, toast, fecharToast }
}