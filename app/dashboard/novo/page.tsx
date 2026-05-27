'use client'

// novo/page.tsx — Página de novo fechamento
// Reúne CardLC, CardBrandy, CardResultado e CampoObservacoes
// em um único formulário coeso.

import { useState } from 'react'
import { useForm, FormProvider, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'

import { supabase }    from '@/lib/supabase'
import type { FormValues, StatusCaixa } from '@/lib/types'
import {
  brl, brlSinal, formatData,
  calcularTotalLC, calcularTotalBrandy, calcularResultados,
  corDiferenca, STATUS_CONFIG,
} from '@/lib/utils'
import {
  Card, CardHeader, CardTotal,
  CurrencyInput, SoloDisplayField,
  Toast,
} from '@/components/ui'
import type { Toast as ToastType } from '@/lib/types'

// ─── Schema Zod ───────────────────────────────────────────────

const schema = z.object({
  data_fechamento:        z.string().min(1, 'Informe a data'),

  dinheiro_abertura_lc:   z.number().min(0),
  sangria_lc:             z.number().min(0),
  dinheiro_fechamento_lc: z.number().min(0),
  pix_lc:                 z.number().min(0),
  debito_lc:              z.number().min(0),
  credito_lc:             z.number().min(0),
  consumo_loja_lc:        z.number().min(0),
  a_prazo_lc:             z.number().min(0),
  ticket_lc:              z.number().min(0),

  dinheiro_brandy:        z.number().min(0),
  pix_brandy:             z.number().min(0),
  debito_brandy:          z.number().min(0),
  credito_brandy:         z.number().min(0),
  credito_online_brandy:  z.number().min(0),

  total_lc_sistema: z.number().min(0, 'Informe o total do sistema LC'),
  ajuste_manual:    z.number(),

  observacoes: z.string().max(600).optional(),
})

type Schema = z.infer<typeof schema>

const defaultValues: Schema = {
  data_fechamento:        new Date().toISOString().split('T')[0],
  dinheiro_abertura_lc:   0,
  sangria_lc:             0,
  dinheiro_fechamento_lc: 0,
  pix_lc:                 0,
  debito_lc:              0,
  credito_lc:             0,
  consumo_loja_lc:        0,
  a_prazo_lc:             0,
  ticket_lc:              0,
  dinheiro_brandy:        0,
  pix_brandy:             0,
  debito_brandy:          0,
  credito_brandy:         0,
  credito_online_brandy:  0,
  total_lc_sistema:       0,
  ajuste_manual:          0,
  observacoes:            '',
}

// ─── Hook de submissão ────────────────────────────────────────

function useSubmit() {
  const [loading, setLoading] = useState(false)
  const [toast,   setToast  ] = useState<ToastType | null>(null)
  const router = useRouter()

  const submit = async (data: Schema) => {
    setLoading(true)
    try {
      const totalLC     = calcularTotalLC(data)
      const totalBrandy = calcularTotalBrandy(data)
      const { totalCaixa, totalSistema, diferenca, diferencaFinal, status } =
        calcularResultados(totalLC, totalBrandy, data.total_lc_sistema, data.dinheiro_brandy, data.ajuste_manual)

      const { error } = await supabase.from('cash_closings').insert({
        ...data,
        total_lc:        totalLC,
        total_brandy:    totalBrandy,
        total_caixa:     totalCaixa,
        total_sistema:   totalSistema,
        diferenca,
        diferenca_final: diferencaFinal,
        status,
        observacoes:     data.observacoes?.trim() || null,
      })

      if (error) throw error

      setToast({ type: 'success', title: 'Fechamento salvo!', message: `${formatData(data.data_fechamento)} — ${status}` })
      setTimeout(() => router.push('/dashboard/historico'), 1800)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setToast({ type: 'error', title: 'Erro ao salvar', message: msg })
    } finally {
      setLoading(false)
    }
  }

  return { submit, loading, toast, fecharToast: () => setToast(null) }
}

// ─── Campo moeda com Controller (helper) ─────────────────────

function MoneyField({ name, label, control, errors }: {
  name:    keyof Schema
  label:   string
  control: any
  errors:  any
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <CurrencyInput
          label={label}
          value={field.value as number}
          onChange={field.onChange}
          error={errors[name]?.message}
        />
      )}
    />
  )
}

// ─── Card LC ─────────────────────────────────────────────────

function CardLC({ control, errors }: { control: any; errors: any }) {
  const values = useWatch({ control, name: [
    'dinheiro_fechamento_lc','pix_lc','debito_lc','credito_lc',
    'consumo_loja_lc','a_prazo_lc','ticket_lc','sangria_lc',
  ]})
  const [dinFech, pix, deb, cred, cons, ap, tick, sang] = values.map(v => v ?? 0)
  const total = calcularTotalLC({
    dinheiro_fechamento_lc: dinFech, pix_lc: pix, debito_lc: deb,
    credito_lc: cred, consumo_loja_lc: cons, a_prazo_lc: ap, ticket_lc: tick,
  })

  return (
    <Card>
      <CardHeader
        icon={<svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35" /></svg>}
        iconColor="bg-emerald-500/10"
        title="Caixa LC"
        subtitle="Lanchonete Central"
        right={<span className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{brl(total)}</span>}
      />
      <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <MoneyField name="dinheiro_fechamento_lc" label="Dinheiro / Fechamento" control={control} errors={errors} />
        <MoneyField name="pix_lc"                 label="PIX"                   control={control} errors={errors} />
        <MoneyField name="debito_lc"              label="Débito"                control={control} errors={errors} />
        <MoneyField name="credito_lc"             label="Crédito"               control={control} errors={errors} />
        <MoneyField name="consumo_loja_lc"        label="Consumo Loja"          control={control} errors={errors} />
        <MoneyField name="a_prazo_lc"             label="A Prazo"               control={control} errors={errors} />
        <MoneyField name="ticket_lc"              label="Ticket"                control={control} errors={errors} />

        <SoloDisplayField label="Dinheiro Abertura">
          <MoneyField name="dinheiro_abertura_lc" label="" control={control} errors={errors} />
        </SoloDisplayField>

        <SoloDisplayField label="Sangria">
          <MoneyField name="sangria_lc" label="" control={control} errors={errors} />
        </SoloDisplayField>
      </div>
      <CardTotal label="Total LC" value={total} colorClass="text-emerald-700 dark:text-emerald-400" bgClass="bg-emerald-50 dark:bg-emerald-500/10" />
    </Card>
  )
}

// ─── Card Brandy ──────────────────────────────────────────────

function CardBrandy({ control, errors }: { control: any; errors: any }) {
  const values = useWatch({ control, name: [
    'pix_brandy','debito_brandy','credito_brandy','credito_online_brandy','dinheiro_brandy',
  ]})
  const [pix, deb, cred, credOn, din] = values.map(v => v ?? 0)
  const total = calcularTotalBrandy({
    pix_brandy: pix, debito_brandy: deb, credito_brandy: cred, credito_online_brandy: credOn,
  })

  return (
    <Card>
      <CardHeader
        icon={<svg className="w-4 h-4 text-violet-500 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" /></svg>}
        iconColor="bg-violet-500/10"
        title="Caixa Brandy"
        subtitle="Bar & Restaurante"
        right={<span className="text-sm font-bold tabular-nums text-violet-600 dark:text-violet-400">{brl(total)}</span>}
      />
      <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <MoneyField name="pix_brandy"            label="PIX"             control={control} errors={errors} />
        <MoneyField name="debito_brandy"         label="Débito"          control={control} errors={errors} />
        <MoneyField name="credito_brandy"        label="Crédito"         control={control} errors={errors} />
        <MoneyField name="credito_online_brandy" label="Crédito Online"  control={control} errors={errors} />

        <SoloDisplayField label="Dinheiro">
          <MoneyField name="dinheiro_brandy" label="" control={control} errors={errors} />
        </SoloDisplayField>
      </div>
      <CardTotal label="Total Brandy" value={total} colorClass="text-violet-700 dark:text-violet-400" bgClass="bg-violet-50 dark:bg-violet-500/10" />
    </Card>
  )
}

// ─── Card Resultado ───────────────────────────────────────────

function CardResultado({ control, errors }: { control: any; errors: any }) {
  const [ajusteSign, setAjusteSign] = useState<'add' | 'sub'>('add')

const watched = useWatch({
  control,
  name: [
    'dinheiro_fechamento_lc',
    'pix_lc',
    'debito_lc',
    'credito_lc',
    'consumo_loja_lc',
    'a_prazo_lc',
    'ticket_lc',

    'pix_brandy',
    'debito_brandy',
    'credito_brandy',
    'credito_online_brandy',

    'dinheiro_brandy',
    'total_lc_sistema',
    'ajuste_manual',
  ],
})

const [
  dinheiroFechamentoLC,
  pixLC,
  debitoLC,
  creditoLC,
  consumoLojaLC,
  aPrazoLC,
  ticketLC,

  pixBrandy,
  debitoBrandy,
  creditoBrandy,
  creditoOnlineBrandy,

  dinBrandy,
  lcSist,
  ajuste,
] = watched.map(v => v ?? 0)

const totalLC = calcularTotalLC({
  dinheiro_fechamento_lc: dinheiroFechamentoLC,
  pix_lc: pixLC,
  debito_lc: debitoLC,
  credito_lc: creditoLC,
  consumo_loja_lc: consumoLojaLC,
  a_prazo_lc: aPrazoLC,
  ticket_lc: ticketLC,
})

const totalBrandy = calcularTotalBrandy({
  pix_brandy: pixBrandy,
  debito_brandy: debitoBrandy,
  credito_brandy: creditoBrandy,
  credito_online_brandy: creditoOnlineBrandy,
})
  const ajusteEfetivo = ajusteSign === 'add' ? (ajuste ?? 0) : -(ajuste ?? 0)

  const { totalCaixa, totalSistema, diferenca, diferencaFinal, status } =
    calcularResultados(totalLC, totalBrandy, lcSist, dinBrandy, ajusteEfetivo)

  const cfg = STATUS_CONFIG[status]

  const Row = ({ label, value, sub }: { label: string; value: number; sub?: string }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
        {sub && <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{sub}</p>}
      </div>
      <p className={`text-sm font-semibold tabular-nums ${corDiferenca(value)}`}>{brlSinal(value)}</p>
    </div>
  )

  return (
    <Card>
      <CardHeader
        icon={<svg className="w-4 h-4 text-zinc-600 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625z" /></svg>}
        iconColor="bg-zinc-200 dark:bg-zinc-700"
        title="Resultado Final"
        subtitle="Consolidado do fechamento"
      />
      <div className="p-4 sm:p-5 space-y-2">
        {/* Totais */}
        <div className="space-y-1">
          {[
            { label: 'Total Caixa',   value: totalCaixa,   sub: 'LC + Brandy' },
            { label: 'Total Sistema', value: totalSistema, sub: 'Sistema + Dinheiro Brandy' },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{r.label}</p>
                <p className="text-[11px] text-zinc-400">{r.sub}</p>
              </div>
              <p className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{brl(r.value)}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2">
          <Row label="Diferença original" value={diferenca} sub="Caixa − Sistema" />
        </div>

        {/* Campo total LC sistema */}
        <MoneyField name="total_lc_sistema" label="Total LC sistema" control={control} errors={errors} />

        {/* Ajuste manual */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Ajuste manual</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Corrige diferenças pontuais</p>
            </div>
            <div className="flex border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden text-xs font-medium shrink-0">
              {(['add', 'sub'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setAjusteSign(s)}
                  className={`px-3 h-8 transition-all ${
                    ajusteSign === s
                      ? s === 'add' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                      : 'bg-white dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                  } ${s === 'sub' ? 'border-l border-zinc-200 dark:border-zinc-700' : ''}`}
                >
                  {s === 'add' ? '+ Adicionar' : '− Remover'}
                </button>
              ))}
            </div>
          </div>
          <MoneyField name="ajuste_manual" label="" control={control} errors={errors} />
        </div>

        {/* Diferença final */}
        <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Diferença final</p>
            <p className="text-[11px] text-zinc-400">Diferença + Ajuste</p>
          </div>
          <p className={`text-base font-bold tabular-nums ${corDiferenca(diferencaFinal)}`}>
            {brlSinal(diferencaFinal)}
          </p>
        </div>
      </div>

      {/* Status */}
      <div className={`mx-4 sm:mx-5 mb-4 sm:mb-5 rounded-xl border p-4 flex items-center justify-between gap-3 ${cfg.card}`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cfg.icon}`}>
            <span className={cfg.text}>
              {status === 'CAIXA FECHOU'
                ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                : status === 'SOBROU DINHEIRO'
                ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
                : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
              }
            </span>
          </div>
          <div>
            <p className={`text-[10px] font-medium uppercase tracking-widest ${cfg.text} opacity-70`}>Status</p>
            <p className={`text-base font-bold ${cfg.text}`}>{cfg.label}</p>
          </div>
        </div>
        <p className={`text-xl font-bold tabular-nums ${cfg.text}`}>{brlSinal(diferencaFinal)}</p>
      </div>
    </Card>
  )
}

// ─── Campo Observações ────────────────────────────────────────

const SUGESTOES = [
  'Dinheiro rasgado', 'Troco convertido em PIX',
  'Valor não declarado', 'Erro operacional',
  'Ajuste manual realizado', 'Sangria não registrada',
]

function CardObservacoes({ register, watch, setValue, errors }: any) {
  const texto     = watch('observacoes') ?? ''
  const MAX       = 600
  const pct       = Math.min((texto.length / MAX) * 100, 100)
  const barColor  = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-500'

  function addSugestao(s: string) {
    const atual = texto.trim()
    setValue('observacoes', (atual + (atual ? '. ' : '') + s).slice(0, MAX), { shouldDirty: true })
  }

  return (
    <Card>
      <CardHeader
        icon={<svg className="w-4 h-4 text-zinc-600 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>}
        iconColor="bg-zinc-200 dark:bg-zinc-700"
        title="Observações"
        subtitle="Opcional — explique diferenças ou ajustes"
      />
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {SUGESTOES.map(s => (
            <button key={s} type="button" onClick={() => addSugestao(s)}
              disabled={texto.length >= MAX}
              className="
                inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium
                bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400
                border border-zinc-200 dark:border-zinc-700
                hover:bg-zinc-200 dark:hover:bg-zinc-700
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all active:scale-95
              "
            >
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" /></svg>
              {s}
            </button>
          ))}
        </div>
        <div className="relative">
          <textarea
            {...register('observacoes', { maxLength: { value: MAX, message: `Máximo ${MAX} caracteres` } })}
            rows={4}
            maxLength={MAX}
            placeholder="Descreva diferenças encontradas, ajustes realizados, ocorrências do dia..."
            className={`
              w-full px-4 py-3 rounded-xl resize-none text-sm
              bg-zinc-50 dark:bg-zinc-800 border outline-none transition-all
              text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600
              focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50
              ${errors.observacoes
                ? 'border-red-400/60'
                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
              }
            `}
          />
          {texto.length > 0 && (
            <button type="button" onClick={() => setValue('observacoes', '')}
              className="absolute top-3 right-3 w-5 h-5 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="h-0.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-200 ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between">
            <p className="text-[11px] text-zinc-400">{texto.length === 0 ? 'Campo opcional' : `${texto.length} caracteres`}</p>
            <p className={`text-[11px] font-medium tabular-nums ${pct >= 90 ? 'text-red-500' : pct >= 70 ? 'text-amber-500' : 'text-zinc-400'}`}>
              {texto.length} / {MAX}
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── Página principal ─────────────────────────────────────────

export default function NovoFechamentoPage() {
  const { submit, loading, toast, fecharToast } = useSubmit()

  const methods = useForm<Schema>({
    resolver:      zodResolver(schema),
    defaultValues,
    mode:          'onSubmit',
  })

  const { control, register, watch, setValue, handleSubmit, formState: { errors } } = methods

  return (
    <FormProvider {...methods}>
      <div className="space-y-5 max-w-5xl mx-auto">

        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Novo Fechamento</h1>
            <p className="text-sm text-zinc-400 mt-0.5">Preencha os dados do caixa do dia</p>
          </div>

          {/* Data */}
          <div>
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1">
              Data do fechamento
            </label>
            <input
              type="date"
              {...register('data_fechamento')}
              className="
                h-10 px-3 rounded-lg text-sm
                bg-white dark:bg-zinc-900
                border border-zinc-200 dark:border-zinc-700
                text-zinc-900 dark:text-zinc-100
                outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50
                transition-all
              "
            />
            {errors.data_fechamento && (
              <p className="text-xs text-red-500 mt-1">{errors.data_fechamento.message}</p>
            )}
          </div>
        </div>

        {/* Cards LC + Brandy lado a lado em lg */}
        <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <CardLC     control={control} errors={errors} />
            <CardBrandy control={control} errors={errors} />
          </div>

          <CardResultado   control={control} errors={errors} />
          <CardObservacoes register={register} watch={watch} setValue={setValue} errors={errors} />

          {/* Ações */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => methods.reset(defaultValues)}
              className="
                w-full sm:w-auto px-5 h-11 sm:h-10 rounded-xl sm:rounded-lg text-sm font-medium
                bg-zinc-100 dark:bg-zinc-800
                text-zinc-700 dark:text-zinc-300
                hover:bg-zinc-200 dark:hover:bg-zinc-700
                transition-all
              "
            >
              Limpar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="
                w-full sm:w-auto px-6 h-11 sm:h-10 rounded-xl sm:rounded-lg text-sm font-semibold
                bg-emerald-500 hover:bg-emerald-400 text-white
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all active:scale-[.98]
                flex items-center justify-center gap-2
              "
            >
              {loading
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Salvando...</>
                : 'Salvar Fechamento'
              }
            </button>
          </div>
        </form>
      </div>

      <Toast toast={toast} onClose={fecharToast} />
    </FormProvider>
  )
}