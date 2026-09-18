import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Fechamento, Relatorio } from '../types/fechamento'
import { formatarMoeda, STATUS_LABEL } from './calculations'

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

const TURNO_LABEL: Record<'manha' | 'noite', string> = {
  manha: 'Manhã',
  noite: 'Noite',
}

/**
 * Gera um PDF simples, estilo recibo (80mm de largura), com só o
 * necessário: valores de LC e Brendi, totais e resultado final.
 */
export function gerarPdfFechamento(f: Fechamento): void {
  const larguraMM = 80
  const doc = new jsPDF({ unit: 'mm', format: [larguraMM, 200] })
  let y = 8
  const margem = 4
  const largura = larguraMM - margem * 2

  const linha = (texto: string, opts?: { negrito?: boolean; tamanho?: number; centro?: boolean }) => {
    doc.setFont('helvetica', opts?.negrito ? 'bold' : 'normal')
    doc.setFontSize(opts?.tamanho ?? 9)
    if (opts?.centro) {
      doc.text(texto, larguraMM / 2, y, { align: 'center' })
    } else {
      doc.text(texto, margem, y)
    }
    y += (opts?.tamanho ?? 9) / 2 + 1.6
  }

  const linhaValor = (label: string, valor: number) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(label, margem, y)
    doc.text(formatarMoeda(valor), larguraMM - margem, y, { align: 'right' })
    y += 5.2
  }

  const separador = () => {
    doc.setLineWidth(0.1)
    doc.line(margem, y, larguraMM - margem, y)
    y += 4
  }

  linha('MAPA BURGER', { negrito: true, tamanho: 12, centro: true })
  linha('Fechamento de Caixa', { centro: true, tamanho: 9 })
  y += 1
  linha(`Data: ${formatarData(f.data)}  -  ${TURNO_LABEL[f.turno]}`, { centro: true })
  separador()

  linha('LC', { negrito: true })
  linhaValor('Dinheiro abertura', f.lc.dinheiroAbertura)
  linhaValor('Dinheiro fechamento', f.lc.dinheiroFechamento)
  linhaValor('PIX', f.lc.pix)
  linhaValor('Débito', f.lc.debito)
  linhaValor('Crédito', f.lc.credito)
  linhaValor('Consumo loja', f.lc.consumoLoja)
  linhaValor('A prazo', f.lc.aPrazo)
  linhaValor('Ticket', f.lc.ticket)
  if (f.sangrias.length > 0) {
    const totalSangria = f.sangrias.reduce((acc, s) => acc + s.valor, 0)
    linhaValor('Sangria (total)', totalSangria)
  }
  y += 1
  linhaValor('TOTAL LC', f.resultado.totalLC)
  separador()

  linha('BRENDI', { negrito: true })
  linhaValor('PIX', f.brendi.pix)
  linhaValor('Débito', f.brendi.debito)
  linhaValor('Crédito', f.brendi.credito)
  linhaValor('Crédito Online', f.brendi.creditoOnline)
  linhaValor('Dinheiro', f.brendi.dinheiro)
  y += 1
  linhaValor('TOTAL BRENDI', f.resultado.totalBrendi)
  separador()

  linha('RESULTADO', { negrito: true })
  linhaValor('Total Caixa', f.resultado.totalCaixa)
  linhaValor('Total LC Sistema', f.totalLCSistema)
  linhaValor('Total Sistema', f.resultado.totalSistema)
  y += 1
  linhaValor('Diferença', f.resultado.diferencaOriginal)
  if (f.ajuste.tipo) {
    linhaValor(
      `Ajuste (${f.ajuste.tipo === 'adicionar' ? '+' : '-'})`,
      f.resultado.ajusteAplicado,
    )
  }
  y += 1
  linha(`DIFERENÇA FINAL: ${formatarMoeda(f.resultado.diferencaFinal)}`, { negrito: true })
  y += 1
  linha(STATUS_LABEL[f.resultado.status], { negrito: true, centro: true, tamanho: 11 })

  if (f.observacoes) {
    separador()
    linha('Observações:', { negrito: true })
    const linhasObs = doc.splitTextToSize(f.observacoes, largura)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text(linhasObs, margem, y)
    y += linhasObs.length * 4
  }

  doc.save(`fechamento_${f.data}_${f.turno}.pdf`)
}

export interface LinhaRelatorioMensal {
  data: string
  manha?: Fechamento
  noite?: Fechamento
  totalCaixaDia: number
  totalSistemaDia: number
  diferencaFinalDia: number
}

/** Gera o PDF resumido do mês: uma linha por dia + totais do mês. */
export function gerarPdfMensal(params: {
  mesLabel: string
  linhas: LinhaRelatorioMensal[]
}): void {
  const { mesLabel, linhas } = params
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('MAPA BURGER', 14, 16)
  doc.setFontSize(11)
  doc.text(`Relatório Mensal de Fechamento — ${mesLabel}`, 14, 23)

  const totalMesCaixa = linhas.reduce((acc, l) => acc + l.totalCaixaDia, 0)
  const totalMesSistema = linhas.reduce((acc, l) => acc + l.totalSistemaDia, 0)
  const totalMesDiferenca = linhas.reduce((acc, l) => acc + l.diferencaFinalDia, 0)

  autoTable(doc, {
    startY: 28,
    head: [['Data', 'Total Caixa', 'Total Sistema', 'Diferença', 'Situação']],
    body: linhas.map((l) => [
      formatarData(l.data),
      formatarMoeda(l.totalCaixaDia),
      formatarMoeda(l.totalSistemaDia),
      formatarMoeda(l.diferencaFinalDia),
      l.diferencaFinalDia > 0.005 ? 'Sobrou' : l.diferencaFinalDia < -0.005 ? 'Faltou' : 'Fechou',
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 30, 30] },
    foot: [
      [
        'TOTAL DO MÊS',
        formatarMoeda(totalMesCaixa),
        formatarMoeda(totalMesSistema),
        formatarMoeda(totalMesDiferenca),
        totalMesDiferenca > 0.005 ? 'Sobrou' : totalMesDiferenca < -0.005 ? 'Faltou' : 'Fechou',
      ],
    ],
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
  })

  doc.save(`relatorio_mensal_${mesLabel.replace('/', '-')}.pdf`)
}

/** Gera um PDF simples (A4) a partir de um relatório livre. */
export function gerarPdfRelatorio(r: Relatorio): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margem = 16
  let y = 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(r.titulo || 'Relatório', margem, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(formatarData(r.data), margem, y)
  doc.setTextColor(0)
  y += 8

  doc.setLineWidth(0.2)
  doc.line(margem, y, 210 - margem, y)
  y += 8

  for (const item of r.itens) {
    if (y > 270) {
      doc.addPage()
      y = 20
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(item.label || '(sem título)', margem, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const linhas = doc.splitTextToSize(item.valor || '-', 210 - margem * 2)
    doc.text(linhas, margem, y)
    y += linhas.length * 5 + 6
  }

  doc.save(`relatorio_${r.data}_${slugify(r.titulo)}.pdf`)
}

function slugify(texto: string): string {
  return (texto || 'sem-titulo')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
