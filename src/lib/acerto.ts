/**
 * Acerto do mês por funcionário: vales + consumo da loja = total a descontar.
 * Mesmas regras do banco (calcular_acerto_mes na migração v7):
 * - vale excluído não conta;
 * - consumo é ligado ao funcionário pelo id escolhido na lista ou, nos
 *   lançamentos antigos, pelo nome (ignorando acento/maiúscula/espaços);
 * - consumo que não bate com ninguém fica em "sem funcionário" e impede fechar.
 * Somas sempre em centavos.
 */
import type { Funcionario, RelatorioDiario, Vale } from '../types/fechamento'
import { normalizarNome, paraCentavos } from './vales'

export interface ConsumoDoMes {
  relatorioId: string
  data: string
  /** Posição do item na lista do relatório (pra corrigir depois). */
  indice: number
  pessoa: string
  item: string
  valor: number
  funcionarioId: string | null
}

export interface LinhaAcerto {
  funcionarioId: string
  funcionario: string
  ativo: boolean
  vales: Vale[]
  consumo: ConsumoDoMes[]
  totalVales: number
  totalConsumo: number
  total: number
}

export interface ResultadoAcerto {
  linhas: LinhaAcerto[]
  semFuncionario: ConsumoDoMes[]
  totalVales: number
  totalConsumo: number
  total: number
}

/** Liga um nome/id ao cadastro. */
export function resolverFuncionario(
  funcionarios: Pick<Funcionario, 'id' | 'nome'>[],
  pessoa: string,
  funcionarioId?: string | null,
): string | null {
  if (funcionarioId && funcionarios.some((f) => f.id === funcionarioId)) return funcionarioId
  const alvo = normalizarNome(pessoa)
  if (!alvo) return null
  return funcionarios.find((f) => normalizarNome(f.nome) === alvo)?.id ?? null
}

/** Todos os consumos de funcionários (valor > 0) dos relatórios do mês. */
export function consumosDoMes(
  relatorios: Pick<RelatorioDiario, 'id' | 'data' | 'consumoLojaMensal'>[],
  funcionarios: Pick<Funcionario, 'id' | 'nome'>[],
): ConsumoDoMes[] {
  const lista: ConsumoDoMes[] = []
  for (const r of relatorios) {
    ;(r.consumoLojaMensal ?? []).forEach((c, indice) => {
      const valor = Number(c.valor)
      if (!Number.isFinite(valor) || paraCentavos(valor) <= 0) return
      lista.push({
        relatorioId: r.id,
        data: r.data,
        indice,
        pessoa: c.pessoa ?? '',
        item: c.item ?? '',
        valor: paraCentavos(valor) / 100,
        funcionarioId: resolverFuncionario(funcionarios, c.pessoa ?? '', c.funcionarioId),
      })
    })
  }
  return lista.sort((a, b) => a.data.localeCompare(b.data) || a.indice - b.indice)
}

export function calcularAcerto(params: {
  vales: Vale[]
  relatorios: Pick<RelatorioDiario, 'id' | 'data' | 'consumoLojaMensal'>[]
  funcionarios: Funcionario[]
}): ResultadoAcerto {
  const { vales, relatorios, funcionarios } = params
  const mapa = new Map<string, LinhaAcerto & { cv: number; cc: number }>()

  function linha(id: string): LinhaAcerto & { cv: number; cc: number } {
    let l = mapa.get(id)
    if (!l) {
      const f = funcionarios.find((x) => x.id === id)
      l = {
        funcionarioId: id,
        funcionario: f?.nome ?? '(funcionário removido)',
        ativo: f?.ativo ?? false,
        vales: [],
        consumo: [],
        totalVales: 0,
        totalConsumo: 0,
        total: 0,
        cv: 0,
        cc: 0,
      }
      mapa.set(id, l)
    }
    return l
  }

  for (const v of vales) {
    if (v.excluidoEm) continue
    const id = v.funcionarioId ?? resolverFuncionario(funcionarios, v.funcionario)
    if (!id) continue
    const l = linha(id)
    l.vales.push(v)
    l.cv += paraCentavos(v.valor)
  }

  const consumos = consumosDoMes(relatorios, funcionarios)
  const semFuncionario: ConsumoDoMes[] = []
  for (const c of consumos) {
    if (!c.funcionarioId) {
      semFuncionario.push(c)
      continue
    }
    const l = linha(c.funcionarioId)
    l.consumo.push(c)
    l.cc += paraCentavos(c.valor)
  }

  const linhas = Array.from(mapa.values())
    .filter((l) => l.cv + l.cc > 0)
    .map(({ cv, cc, ...l }) => ({
      ...l,
      vales: [...l.vales].sort((a, b) => a.data.localeCompare(b.data) || a.createdAt.localeCompare(b.createdAt)),
      totalVales: cv / 100,
      totalConsumo: cc / 100,
      total: (cv + cc) / 100,
    }))
    .sort((a, b) => a.funcionario.localeCompare(b.funcionario, 'pt-BR', { sensitivity: 'base' }))

  const cv = linhas.reduce((a, l) => a + paraCentavos(l.totalVales), 0)
  const cc = linhas.reduce((a, l) => a + paraCentavos(l.totalConsumo), 0)
  return { linhas, semFuncionario, totalVales: cv / 100, totalConsumo: cc / 100, total: (cv + cc) / 100 }
}

/** Diferenças entre o que foi fechado e o que os dados dizem hoje (deveria ser nenhuma). */
export function divergenciasAcerto(
  fechado: { funcionarioId: string | null; funcionario: string; total: number }[],
  atual: LinhaAcerto[],
): string[] {
  const problemas: string[] = []
  const restantes = new Map(atual.map((l) => [l.funcionarioId, l]))
  for (const r of fechado) {
    const l = r.funcionarioId ? restantes.get(r.funcionarioId) : undefined
    if (!l || paraCentavos(l.total) !== paraCentavos(r.total)) {
      problemas.push(`${r.funcionario}: fechado com ${r.total.toFixed(2).replace('.', ',')}, hoje ${(l?.total ?? 0).toFixed(2).replace('.', ',')}`)
    }
    if (r.funcionarioId) restantes.delete(r.funcionarioId)
  }
  for (const l of restantes.values()) problemas.push(`${l.funcionario}: não estava no acerto fechado`)
  return problemas
}

function celula(texto: string): string {
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto
  return /[;"\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro
}
const num = (v: number) => v.toFixed(2).replace('.', ',')
const dataBr = (iso: string) => iso.split('-').reverse().join('/')

/** Planilha (CSV para Excel em português) do acerto do mês. */
export function gerarCsvAcerto(mesRotulo: string, r: ResultadoAcerto): string {
  const l: string[] = [`Acerto do mês ${mesRotulo} (vales + consumo da loja)`, '']
  l.push('Funcionário;Vales (R$);Consumo (R$);Total a descontar (R$)')
  for (const x of r.linhas) l.push([celula(x.funcionario), num(x.totalVales), num(x.totalConsumo), num(x.total)].join(';'))
  l.push(['TOTAL', num(r.totalVales), num(r.totalConsumo), num(r.total)].join(';'), '')
  l.push('Funcionário;Tipo;Data;Descrição;Valor (R$)')
  for (const x of r.linhas) {
    for (const v of x.vales) l.push([celula(x.funcionario), 'Vale', dataBr(v.data), celula(v.observacao || ''), num(v.valor)].join(';'))
    for (const c of x.consumo) l.push([celula(x.funcionario), 'Consumo', dataBr(c.data), celula(c.item || ''), num(c.valor)].join(';'))
  }
  return '﻿' + l.join('\r\n') + '\r\n'
}
