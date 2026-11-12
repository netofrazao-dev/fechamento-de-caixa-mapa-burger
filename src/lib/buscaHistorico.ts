import type { Fechamento, RelatorioDiario, Vale } from '../types/fechamento'
import { infoTipoSangria, tipoDaSangria } from './sangrias'
import { normalizarNome } from './vales'

/** Um item do dia que pode ser encontrado pela busca do Histórico. */
export interface Achado {
  /** Onde está: "Sangria — Pagamentos", "Vale", "Observação do caixa"... */
  rotulo: string
  texto: string
  valor?: number
}

/** Tudo que dá para procurar num dia: fechamento(s), relatório e vales. */
export function itensDoDia(dia: { fechamentos: Fechamento[]; relatorio?: RelatorioDiario; vales: Vale[] }): Achado[] {
  const itens: Achado[] = []
  for (const f of dia.fechamentos) {
    if (f.observacoes.trim()) itens.push({ rotulo: 'Observação do caixa', texto: f.observacoes.trim() })
    if (f.suprimento > 0) itens.push({ rotulo: 'Suprimento', texto: f.suprimentoObs?.trim() || 'Suprimento', valor: f.suprimento })
    for (const s of f.sangrias) itens.push({ rotulo: 'Sangria (no fechamento)', texto: s.motivo || '—', valor: s.valor })
    // Dias antigos: marmitas contadas no fechamento (agora ficam no relatório).
    if (!dia.relatorio?.marmitas?.length) for (const m of f.marmitas) itens.push({ rotulo: 'Prato vendido', texto: `${m.prato} (${m.quantidade})` })
  }
  const r = dia.relatorio
  if (r) {
    for (const m of r.marmitas ?? []) itens.push({ rotulo: 'Prato vendido', texto: `${m.prato} (${m.quantidade})` })
    for (const s of r.sangrias) {
      itens.push({ rotulo: `Sangria — ${infoTipoSangria(tipoDaSangria(s)).rotulo}`, texto: s.motivo || '—', valor: s.valor })
    }
    const consumo = (rotulo: string, lista: RelatorioDiario['consumoLojaMensal']) =>
      lista.forEach((c) => itens.push({ rotulo, texto: [c.pessoa, c.item].filter((t) => t?.trim()).join(' — ') || '—', valor: c.valor }))
    consumo('Consumo de funcionário', r.consumoLojaMensal)
    consumo('Consumo de motoboy', r.consumoLojaMotoboys)
    consumo('Cortesia a cliente', r.cortesiaClientes)
    for (const e of r.estragou) itens.push({ rotulo: 'Estragou', texto: e })
    for (const p of r.funcionariosQueComeram) itens.push({ rotulo: 'Comeu na loja', texto: p })
  }
  for (const v of dia.vales) {
    if (v.excluidoEm) continue
    itens.push({ rotulo: 'Vale', texto: v.observacao ? `${v.funcionario} — ${v.observacao}` : v.funcionario, valor: v.valor })
  }
  return itens
}

/**
 * Itens que batem com a busca: todas as palavras precisam aparecer
 * (sem diferenciar maiúscula nem acento) no texto ou em onde está.
 * Ex.: "gás" acha "pagamento do gas"; "vale neto" acha os vales do Neto.
 */
export function buscarItens(itens: Achado[], termo: string): Achado[] {
  const palavras = normalizarNome(termo).split(' ').filter(Boolean)
  if (palavras.length === 0) return []
  return itens.filter((i) => {
    const alvo = normalizarNome(`${i.rotulo} ${i.texto}`)
    return palavras.every((p) => alvo.includes(p))
  })
}

export interface ResultadoBusca {
  data: string
  fechamento?: Fechamento
  relatorio?: RelatorioDiario
  achados: Achado[]
}

/** Dias do período com algo que bate com a busca (mais recentes primeiro). */
export function resultadosDaBusca(
  periodo: { fechamentos: Fechamento[]; relatorios: RelatorioDiario[]; vales: Vale[] },
  termo: string,
): ResultadoBusca[] {
  const datas = new Set([
    ...periodo.fechamentos.map((f) => f.data),
    ...periodo.relatorios.map((r) => r.data),
    ...periodo.vales.map((v) => v.data),
  ])
  const resultados: ResultadoBusca[] = []
  for (const data of datas) {
    const fechamentos = periodo.fechamentos.filter((f) => f.data === data)
    const relatorio = periodo.relatorios.find((r) => r.data === data)
    const vales = periodo.vales.filter((v) => v.data === data)
    const achados = buscarItens(itensDoDia({ fechamentos, relatorio, vales }), termo)
    if (achados.length > 0) resultados.push({ data, fechamento: fechamentos[0], relatorio, achados })
  }
  return resultados.sort((a, b) => b.data.localeCompare(a.data))
}
