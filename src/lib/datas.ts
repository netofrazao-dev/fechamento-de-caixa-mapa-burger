/**
 * Datas sempre no fuso LOCAL do usuário. Usar `toISOString()` converte pra UTC
 * e, à noite (depois das 21h em Belém), "hoje" viraria "amanhã".
 */

export function dataLocal(d: Date = new Date()): string {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export function hojeLocal(): string {
  return dataLocal(new Date())
}

export function inicioDoMesLocal(d: Date = new Date()): string {
  return dataLocal(new Date(d.getFullYear(), d.getMonth(), 1))
}

/** Mês no formato YYYY-MM (valor do <input type="month">). */
export function mesLocal(d: Date = new Date()): string {
  return dataLocal(d).slice(0, 7)
}

/** Primeiro e último dia de um mês YYYY-MM. */
export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [ano, m] = mes.split('-').map(Number)
  const mm = String(m).padStart(2, '0')
  const ultimoDia = new Date(ano, m, 0).getDate()
  return { inicio: `${ano}-${mm}-01`, fim: `${ano}-${mm}-${String(ultimoDia).padStart(2, '0')}` }
}

/** "2026-10-05" -> "05/10/2026" */
export function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = (iso ?? '').split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso
}

/** "2026-10-05" -> "05/10" */
export function formatarDiaMes(iso: string): string {
  const [, mes, dia] = (iso ?? '').split('-')
  return mes && dia ? `${dia}/${mes}` : iso
}

const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

/** "2026-11-03" -> "terça-feira" */
export function diaDaSemana(iso: string): string {
  const [ano, mes, dia] = (iso ?? '').split('-').map(Number)
  if (!ano || !mes || !dia) return ''
  return DIAS_SEMANA[new Date(ano, mes - 1, dia).getDay()]
}

/** Todas as datas YYYY-MM-DD entre início e fim (inclusive). */
export function datasEntre(inicio: string, fim: string): string[] {
  const [ai, mi, di] = inicio.split('-').map(Number)
  const [af, mf, df] = fim.split('-').map(Number)
  const d = new Date(ai, mi - 1, di)
  const ultimo = new Date(af, mf - 1, df)
  const lista: string[] = []
  while (d <= ultimo && lista.length < 400) {
    lista.push(dataLocal(d))
    d.setDate(d.getDate() + 1)
  }
  return lista
}

/** Data/hora ISO -> "03/11/2026 14:05" (fuso local). */
export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Dia anterior de uma data YYYY-MM-DD ("2026-11-01" -> "2026-10-31"). */
export function diaAnterior(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  return dataLocal(new Date(a, m - 1, d - 1))
}

/** Soma (ou subtrai) dias de uma data YYYY-MM-DD ("2026-11-03", -45 -> "2026-09-19"). */
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  return dataLocal(new Date(a, m - 1, d + dias))
}
