/**
 * Regras dos vales (adiantamento de salário).
 * Tudo aqui é puro (sem banco, sem tela) e tem teste em vales.test.ts.
 *
 * Dinheiro é sempre somado em CENTAVOS inteiros, pra nunca aparecer
 * R$ 0,30000000000000004 num total que vai ser descontado do salário.
 */
import type { HistoricoVale, Vale, ValeInput } from '../types/fechamento'

/** Acima disso o app pede confirmação (provável erro de digitação). */
export const VALOR_ALTO_VALE = 1000
/** Limite duro: nenhum vale passa disso. */
export const VALOR_MAXIMO_VALE = 100_000
export const OBSERVACAO_MAX = 300
export const NOME_MAX = 80

// ─── Dinheiro ─────────────────────────────────────────────────

export function paraCentavos(valor: number): number {
  return Math.round(valor * 100)
}

export function deCentavos(centavos: number): number {
  return centavos / 100
}

/** Soma exata (em centavos) de uma lista de valores em reais. */
export function somarValores(valores: number[]): number {
  return deCentavos(valores.reduce((acc, v) => acc + paraCentavos(Number.isFinite(v) ? v : 0), 0))
}

function temNoMaximoDuasCasas(valor: number): boolean {
  return Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6
}

// ─── Nomes ────────────────────────────────────────────────────

/** "  Pâmela  Silva " -> "pamela silva" (mesma regra do banco: normalizar_nome). */
export function normalizarNome(nome: string): string {
  return (nome ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/** Tira espaços sobrando, sem mexer em acento/maiúscula. */
export function limparNome(nome: string): string {
  return (nome ?? '').trim().replace(/\s+/g, ' ')
}

/** Chave que identifica a pessoa: o id do cadastro ou, sem ele, o nome normalizado. */
export function chaveFuncionario(v: Pick<Vale, 'funcionarioId' | 'funcionario'>): string {
  return v.funcionarioId ? `id:${v.funcionarioId}` : `nome:${normalizarNome(v.funcionario)}`
}

// ─── Datas ────────────────────────────────────────────────────

/** Confere se é uma data real no formato YYYY-MM-DD (31/02 não passa). */
export function dataValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso ?? '')) return false
  const [ano, mes, dia] = iso.split('-').map(Number)
  const d = new Date(ano, mes - 1, dia)
  return d.getFullYear() === ano && d.getMonth() === mes - 1 && d.getDate() === dia && ano >= 2000
}

/** Confere se é um mês no formato YYYY-MM. */
export function mesValido(mes: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(mes ?? '')) return false
  const m = Number(mes.slice(5, 7))
  return m >= 1 && m <= 12 && Number(mes.slice(0, 4)) >= 2000
}

/** "2026-10" -> "10/2026" */
export function rotuloMes(mes: string): string {
  const [ano, m] = mes.split('-')
  return `${m}/${ano}`
}

const NOMES_MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** "2026-10" -> "outubro de 2026" */
export function nomeMes(mes: string): string {
  const [ano, m] = mes.split('-')
  return `${NOMES_MESES[Number(m) - 1] ?? m} de ${ano}`
}

/** Soma (ou subtrai) meses de um YYYY-MM. */
export function somarMeses(mes: string, delta: number): string {
  const [ano, m] = mes.split('-').map(Number)
  const d = new Date(ano, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Diferença em dias entre duas datas YYYY-MM-DD (b - a). */
function diasEntre(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number)
  const [yb, mb, db] = b.split('-').map(Number)
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000)
}

// ─── Agrupamento ──────────────────────────────────────────────

export interface GrupoFuncionario {
  chave: string
  funcionarioId: string | null
  funcionario: string
  total: number
  quantidade: number
  vales: Vale[]
}

/**
 * Agrupa por pessoa (pelo cadastro, não pelo texto digitado), soma em
 * centavos e ordena: pessoas por nome, vales por data e hora de lançamento.
 * Vales excluídos são ignorados.
 */
export function agruparPorFuncionario(vales: Vale[]): GrupoFuncionario[] {
  const mapa = new Map<string, { grupo: GrupoFuncionario; centavos: number }>()
  for (const v of vales) {
    if (v.excluidoEm) continue
    const chave = chaveFuncionario(v)
    let item = mapa.get(chave)
    if (!item) {
      item = {
        grupo: {
          chave,
          funcionarioId: v.funcionarioId,
          funcionario: v.funcionario,
          total: 0,
          quantidade: 0,
          vales: [],
        },
        centavos: 0,
      }
      mapa.set(chave, item)
    }
    item.centavos += paraCentavos(v.valor)
    item.grupo.vales.push(v)
  }

  return Array.from(mapa.values())
    .map(({ grupo, centavos }) => ({
      ...grupo,
      total: deCentavos(centavos),
      quantidade: grupo.vales.length,
      vales: [...grupo.vales].sort(
        (a, b) => a.data.localeCompare(b.data) || a.createdAt.localeCompare(b.createdAt),
      ),
    }))
    .sort((a, b) => a.funcionario.localeCompare(b.funcionario, 'pt-BR', { sensitivity: 'base' }))
}

export function totalDosGrupos(grupos: GrupoFuncionario[]): number {
  return somarValores(grupos.map((g) => g.total))
}

// ─── Validação (impede salvar) ────────────────────────────────

export function validarVale(input: ValeInput): string[] {
  const erros: string[] = []
  const nome = limparNome(input.funcionario)

  if (!nome) erros.push('Selecione o funcionário.')
  else if (nome.length > NOME_MAX) erros.push(`O nome do funcionário passa de ${NOME_MAX} letras.`)

  if (!dataValida(input.data)) erros.push('Informe uma data válida.')

  if (!Number.isFinite(input.valor) || input.valor <= 0) {
    erros.push('Informe o valor do vale (maior que zero).')
  } else if (!temNoMaximoDuasCasas(input.valor)) {
    erros.push('O valor só pode ter centavos (2 casas depois da vírgula).')
  } else if (input.valor > VALOR_MAXIMO_VALE) {
    erros.push('Valor muito alto para um vale. Confira o que foi digitado.')
  }

  if ((input.observacao ?? '').trim().length > OBSERVACAO_MAX) {
    erros.push(`A observação passa de ${OBSERVACAO_MAX} letras.`)
  }

  return erros
}

// ─── Avisos (pede confirmação antes de salvar) ────────────────

export interface ContextoAviso {
  /** Hoje, YYYY-MM-DD (fuso local). */
  hoje: string
  /** Vales já lançados no mês da data do vale (pode incluir excluídos). */
  existentes: Vale[]
  /** Id do vale sendo editado, pra não se comparar consigo mesmo. */
  idEditando?: string
}

export function avisosVale(input: ValeInput, ctx: ContextoAviso): string[] {
  const avisos: string[] = []
  if (validarVale(input).length > 0) return avisos

  const nome = normalizarNome(input.funcionario)
  const centavos = paraCentavos(input.valor)

  const repetido = ctx.existentes.find(
    (v) =>
      !v.excluidoEm &&
      v.id !== ctx.idEditando &&
      normalizarNome(v.funcionario) === nome &&
      v.data === input.data &&
      paraCentavos(v.valor) === centavos,
  )
  if (repetido) {
    avisos.push(
      `Já existe um vale de ${formatarReais(input.valor)} para ${repetido.funcionario} nesse mesmo dia. ` +
        'Não é lançamento repetido?',
    )
  }

  if (input.valor >= VALOR_ALTO_VALE) {
    avisos.push(`Valor alto: ${formatarReais(input.valor)}. Confira se não sobrou um zero.`)
  }

  const dias = diasEntre(ctx.hoje, input.data)
  if (dias > 0) {
    avisos.push('A data do vale está no futuro.')
  } else if (input.data.slice(0, 7) !== ctx.hoje.slice(0, 7)) {
    avisos.push(
      `O vale vai entrar no mês ${rotuloMes(input.data.slice(0, 7))}, não no mês atual. ` +
        'Ele será descontado na folha daquele mês.',
    )
  }

  return avisos
}

function formatarReais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Planilha (CSV para Excel/Google Planilhas em português) ──

function celulaCsv(texto: string): string {
  // Evita que o Excel interprete o texto como fórmula.
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto
  return /[;"\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro
}

function numeroCsv(valor: number): string {
  return valor.toFixed(2).replace('.', ',')
}

function dataBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

/** Planilha com o resumo por funcionário e todos os vales do mês. */
export function gerarCsvVales(mes: string, vales: Vale[]): string {
  const grupos = agruparPorFuncionario(vales)
  const linhas: string[] = []
  linhas.push(`Vales de ${rotuloMes(mes)}`)
  linhas.push('')
  linhas.push('Funcionário;Quantidade;Total a descontar (R$)')
  for (const g of grupos) {
    linhas.push([celulaCsv(g.funcionario), String(g.quantidade), numeroCsv(g.total)].join(';'))
  }
  linhas.push(['TOTAL', String(grupos.reduce((a, g) => a + g.quantidade, 0)), numeroCsv(totalDosGrupos(grupos))].join(';'))
  linhas.push('')
  linhas.push('Data;Funcionário;Valor (R$);Observação')
  for (const g of grupos) {
    for (const v of g.vales) {
      linhas.push([dataBr(v.data), celulaCsv(g.funcionario), numeroCsv(v.valor), celulaCsv(v.observacao || '')].join(';'))
    }
  }
  // BOM pra o Excel abrir com acentos certos.
  return '﻿' + linhas.join('\r\n') + '\r\n'
}

// ─── Histórico em texto ───────────────────────────────────────

const ROTULO_OPERACAO: Record<HistoricoVale['operacao'], string> = {
  criado: 'Vale lançado',
  alterado: 'Vale alterado',
  excluido: 'Vale excluído',
  restaurado: 'Vale restaurado',
  mes_fechado: 'Mês fechado',
  mes_reaberto: 'Mês reaberto',
}

function texto(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

function resumoVale(d: Record<string, unknown> | null): string {
  if (!d) return ''
  const valor = Number(d.valor)
  const data = texto(d.data)
  return `${texto(d.funcionario)} — ${Number.isFinite(valor) ? formatarReais(valor) : '?'}${data ? ` em ${dataBr(data)}` : ''}`
}

/** Transforma uma linha do histórico em título + descrição legíveis. */
export function descreverHistorico(h: HistoricoVale): { titulo: string; descricao: string } {
  const titulo = ROTULO_OPERACAO[h.operacao] ?? h.operacao

  if (h.operacao === 'mes_fechado') {
    const total = Number(h.depois?.total)
    return {
      titulo,
      descricao:
        `Total ${Number.isFinite(total) ? formatarReais(total) : '?'} em ${texto(h.depois?.quantidade)} vale(s)` +
        (h.detalhe ? ` — ${h.detalhe}` : ''),
    }
  }
  if (h.operacao === 'mes_reaberto') {
    return { titulo, descricao: `Motivo: ${h.detalhe ?? '-'}` }
  }
  if (h.operacao === 'alterado' && h.antes && h.depois) {
    const mudancas: string[] = []
    if (texto(h.antes.funcionario) !== texto(h.depois.funcionario)) {
      mudancas.push(`funcionário ${texto(h.antes.funcionario)} → ${texto(h.depois.funcionario)}`)
    }
    if (Number(h.antes.valor) !== Number(h.depois.valor)) {
      mudancas.push(`valor ${formatarReais(Number(h.antes.valor))} → ${formatarReais(Number(h.depois.valor))}`)
    }
    if (texto(h.antes.data) !== texto(h.depois.data)) {
      mudancas.push(`data ${dataBr(texto(h.antes.data))} → ${dataBr(texto(h.depois.data))}`)
    }
    if (texto(h.antes.observacao) !== texto(h.depois.observacao)) {
      mudancas.push(`observação "${texto(h.antes.observacao) || '-'}" → "${texto(h.depois.observacao) || '-'}"`)
    }
    return {
      titulo,
      descricao: `${resumoVale(h.antes)}${mudancas.length ? ` · ${mudancas.join('; ')}` : ''}${h.detalhe ? ` (${h.detalhe})` : ''}`,
    }
  }
  if (h.operacao === 'excluido') {
    return { titulo, descricao: `${resumoVale(h.depois)} · Motivo: ${h.detalhe ?? '-'}` }
  }
  return { titulo, descricao: resumoVale(h.depois ?? h.antes) }
}
