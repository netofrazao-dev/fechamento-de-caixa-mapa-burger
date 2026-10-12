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
