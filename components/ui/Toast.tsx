'use client'

import { useEffect, useState } from 'react'
import type { ToastMessage } from '@/services/fechamento.service'

interface ToastProps {
  toast:    ToastMessage | null
  onClose?: () => void
}

export default function Toast({ toast, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (toast) {
      setVisible(true)
    } else {
      setVisible(false)
    }
  }, [toast])

  if (!toast) return null

  const isSuccess = toast.type === 'success'

  return (
    <div className={`
      fixed bottom-5 right-5 z-50 w-full max-w-sm
      transform transition-all duration-300 ease-out
      ${visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
    `}>
      <div className={`
        flex items-start gap-3 p-4 rounded-xl shadow-lg border
        ${isSuccess
          ? 'bg-white dark:bg-zinc-900 border-emerald-200 dark:border-emerald-500/30'
          : 'bg-white dark:bg-zinc-900 border-red-200 dark:border-red-500/30'
        }
      `}>

        {/* Ícone */}
        <div className={`
          flex items-center justify-center w-8 h-8 rounded-lg shrink-0
          ${isSuccess
            ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            : 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400'
          }
        `}>
          {isSuccess ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          )}
        </div>

        {/* Texto */}
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {toast.title}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
            {toast.message}
          </p>
        </div>

        {/* Fechar */}
        <button
          onClick={onClose}
          className="
            shrink-0 flex items-center justify-center w-6 h-6 rounded-md
            text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200
            hover:bg-zinc-100 dark:hover:bg-zinc-800
            transition-all
          "
          aria-label="Fechar notificação"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Barra de progresso do timer */}
      {isSuccess && (
        <div className="mt-1 h-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden mx-1">
          <div className="h-full bg-emerald-400 dark:bg-emerald-500 animate-[shrink_5s_linear_forwards]" />
        </div>
      )}
    </div>
  )
}