import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ConsumoItem, Fechamento, RelatorioDiario } from '../types/fechamento'
import { formatarMoeda, STATUS_LABEL } from './calculations'
import { semAcento } from './texto'

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarDataHora(iso: string): string {
  if (!iso) return '-'
  const [data, hora] = iso.split('T')
  return `${formatarData(data)} ${hora ?? ''}`.trim()
}

const TURNO_LABEL: Record<'manha' | 'noite', string> = {
  manha: 'Manhã',
  noite: 'Noite',
}

function slugify(texto: string): string {
  return (texto || 'sem-titulo')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// ============================================================
// Recibo térmico (80mm) — usado pro fechamento de caixa e pro
// relatório diário. Sem acentos/cedilha (bugam na impressão
// térmica); layout mantido igual ao que já funciona.
// ============================================================

class ReciboTermico {
  doc: jsPDF
  y = 8
  margem = 4
  larguraMM = 80

  constructor() {
    this.doc = new jsPDF({ unit: 'mm', format: [this.larguraMM, 297] })
  }

  linha(texto: string, opts?: { negrito?: boolean; tamanho?: number; centro?: boolean }) {
    this.doc.setFont('helvetica', opts?.negrito ? 'bold' : 'normal')
    this.doc.setFontSize(opts?.tamanho ?? 9)
    const t = semAcento(texto)
    if (opts?.centro) {
      this.doc.text(t, this.larguraMM / 2, this.y, { align: 'center' })
    } else {
      this.doc.text(t, this.margem, this.y)
    }
    this.y += (opts?.tamanho ?? 9) / 2 + 1.6
  }

  linhaValor(label: string, valor: number) {
    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(9)
    this.doc.text(semAcento(label), this.margem, this.y)
    this.doc.text(formatarMoeda(valor), this.larguraMM - this.margem, this.y, { align: 'right' })
    this.y += 5.2
  }

  linhaTexto(label: string, texto: string) {
    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(9)
    this.doc.text(semAcento(label), this.margem, this.y)
    this.doc.text(semAcento(texto), this.larguraMM - this.margem, this.y, { align: 'right' })
    this.y += 5.2
  }

  paragrafo(texto: string) {
    const largura = this.larguraMM - this.margem * 2
    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(8.5)
    const linhas = this.doc.splitTextToSize(semAcento(texto), largura)
    this.doc.text(linhas, this.margem, this.y)
    this.y += linhas.length * 4
  }

  separador() {
    this.doc.setLineWidth(0.1)
    this.doc.line(this.margem, this.y, this.larguraMM - this.margem, this.y)
    this.y += 4
  }

  espaco(mm = 2) {
    this.y += mm
  }

  quebrarPaginaSeNecessario() {
    if (this.y > 280) {
      this.doc.addPage([this.larguraMM, 297])
      this.y = 8
    }
  }
}

/**
 * Recibo do fechamento de caixa, estilo cupom (80mm). Mesmo
 * layout de sempre — só sem acentos e com a contagem de marmitas.
 */
export function gerarPdfFechamento(f: Fechamento): void {
  const r = new ReciboTermico()

  r.linha('MAPA BURGER', { negrito: true, tamanho: 12, centro: true })
  r.linha('Fechamento de Caixa', { centro: true, tamanho: 9 })
  r.espaco(1)
  r.linha(`Data: ${formatarData(f.data)}  -  ${TURNO_LABEL[f.turno]}`, { centro: true })
  r.separador()

  r.linha('LC', { negrito: true })
  r.linhaValor('Dinheiro abertura', f.lc.dinheiroAbertura)
  r.linhaValor('Dinheiro fechamento', f.lc.dinheiroFechamento)
  r.linhaValor('PIX', f.lc.pix)
  r.linhaValor('Debito', f.lc.debito)
  r.linhaValor('Credito', f.lc.credito)
  r.linhaValor('Consumo loja', f.lc.consumoLoja)
  r.linhaValor('A prazo', f.lc.aPrazo)
  r.linhaValor('Ticket', f.lc.ticket)
  if (f.sangrias.length > 0) {
    const totalSangria = f.sangrias.reduce((acc, s) => acc + s.valor, 0)
    r.linhaValor('Sangria (total)', totalSangria)
  }
  r.espaco(1)
  r.linhaValor('TOTAL LC', f.resultado.totalLC)
  r.separador()

  r.linha('BRENDI', { negrito: true })
  r.linhaValor('PIX', f.brendi.pix)
  r.linhaValor('Debito', f.brendi.debito)
  r.linhaValor('Credito', f.brendi.credito)
  r.linhaValor('Credito Online', f.brendi.creditoOnline)
  r.linhaValor('Dinheiro', f.brendi.dinheiro)
  r.espaco(1)
  r.linhaValor('TOTAL BRENDI', f.resultado.totalBrendi)
  r.separador()

  r.linha('RESULTADO', { negrito: true })
  r.linhaValor('Total Caixa', f.resultado.totalCaixa)
  r.linhaValor('Total LC Sistema', f.totalLCSistema)
  r.linhaValor('Total Sistema', f.resultado.totalSistema)
  r.espaco(1)
  r.linhaValor('Diferenca', f.resultado.diferencaOriginal)
  if (f.ajuste.tipo) {
    r.linhaValor(`Ajuste (${f.ajuste.tipo === 'adicionar' ? '+' : '-'})`, f.resultado.ajusteAplicado)
  }
  r.espaco(1)
  r.linha(`DIFERENCA FINAL: ${formatarMoeda(f.resultado.diferencaFinal)}`, { negrito: true })
  r.espaco(1)
  r.linha(STATUS_LABEL[f.resultado.status], { negrito: true, centro: true, tamanho: 11 })
  r.separador()
  r.linhaTexto('Marmitas vendidas', String(f.marmitasVendidas ?? 0))

  if (f.observacoes) {
    r.separador()
    r.linha('Observacoes:', { negrito: true })
    r.paragrafo(f.observacoes)
  }

  r.doc.save(`fechamento_${f.data}_${f.turno}.pdf`)
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
export function gerarPdfMensal(params: { mesLabel: string; linhas: LinhaRelatorioMensal[] }): void {
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

// ============================================================
// Relatório diário escrito
// ============================================================

/** Recibo térmico (80mm, sem acento) do relatório diário — pra imprimir junto. */
export function imprimirRelatorioDiario(rel: RelatorioDiario): void {
  const r = new ReciboTermico()

  r.linha('MAPA BURGER', { negrito: true, tamanho: 12, centro: true })
  r.linha('Relatorio Diario', { centro: true, tamanho: 9 })
  r.espaco(1)
  r.linha(`Data: ${formatarData(rel.data)}`, { centro: true })
  r.separador()

  r.linhaValor('Abertura do caixa', rel.aberturaCaixa)
  r.linhaValor('Fechamento do caixa', rel.fechamentoCaixa)
  r.linhaTexto('Vendidas', String(rel.quantidadeVendida))
  r.separador()

  if (rel.estragou.length > 0) {
    r.linha('ESTRAGOU', { negrito: true })
    rel.estragou.forEach((item) => r.paragrafo(`- ${item}`))
    r.separador()
  }

  if (rel.funcionariosQueComeram.length > 0) {
    r.linha('FUNCIONARIOS QUE COMERAM', { negrito: true })
    r.paragrafo(rel.funcionariosQueComeram.join(', '))
    r.separador()
  }

  const listaConsumo = (titulo: string, itens: ConsumoItem[]) => {
    if (itens.length === 0) return
    r.linha(titulo, { negrito: true })
    itens.forEach((it) => r.linhaTexto(`${it.pessoa} (${it.item})`, formatarMoeda(it.valor)))
    r.separador()
  }
  listaConsumo('CONSUMO LOJA MENSAL', rel.consumoLojaMensal)
  listaConsumo('CONSUMO LOJA MOTOBOYS', rel.consumoLojaMotoboys)
  listaConsumo('CORTESIA CLIENTES', rel.cortesiaClientes)

  if (rel.sangrias.length > 0) {
    r.linha('SANGRIAS', { negrito: true })
    rel.sangrias.forEach((s) => r.linhaTexto(s.motivo, formatarMoeda(s.valor)))
    r.separador()
  }

  const listaEstoque = (titulo: string, snap: { dataHora: string; itens: { produto: string; quantidade: number }[] }) => {
    const itensComQtd = snap.itens.filter((i) => i.quantidade > 0)
    if (itensComQtd.length === 0 && !snap.dataHora) return
    r.quebrarPaginaSeNecessario()
    r.linha(titulo, { negrito: true })
    if (snap.dataHora) r.linha(formatarDataHora(snap.dataHora), { tamanho: 8 })
    itensComQtd.forEach((i) => r.linhaTexto(i.produto, String(i.quantidade)))
    r.separador()
  }
  listaEstoque('ESTOQUE INICIO', rel.estoqueInicio)
  listaEstoque('ESTOQUE FINAL', rel.estoqueFinal)

  if (rel.estoqueQuente.length > 0) {
    r.linha('ESTOQUE QUENTE', { negrito: true })
    rel.estoqueQuente.forEach((item) => r.paragrafo(`- ${item}`))
  }

  r.doc.save(`relatorio_diario_${rel.data}.pdf`)
}

// ============================================================
// PDF final consolidado (A4, com acentos, visual mais elaborado)
// — pra enviar pra alguém.
// ============================================================

function tituloSecaoPdf(doc: jsPDF, texto: string, y: number, margem: number, larguraUtil: number): number {
  doc.setFillColor(24, 24, 27)
  doc.rect(margem, y, larguraUtil, 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.text(texto.toUpperCase(), margem + 2.5, y + 5)
  doc.setTextColor(0, 0, 0)
  return y + 11
}

export function gerarPdfDiarioCompleto(params: { relatorio: RelatorioDiario; fechamentos: Fechamento[] }): void {
  const { relatorio: rel, fechamentos } = params
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margem = 16
  const larguraUtil = 210 - margem * 2
  let y = 18

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Mapa Burger', margem, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(110)
  doc.text(`Relatório do dia — ${formatarData(rel.data)}`, margem, y)
  doc.setTextColor(0)
  y += 8

  // --- Resumo do fechamento de caixa (manhã/noite) ---
  if (fechamentos.length > 0) {
    y = tituloSecaoPdf(doc, 'Fechamento de Caixa', y, margem, larguraUtil)
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      head: [['Turno', 'Total Caixa', 'Total Sistema', 'Diferença Final', 'Situação']],
      body: fechamentos.map((f) => [
        TURNO_LABEL[f.turno],
        formatarMoeda(f.resultado.totalCaixa),
        formatarMoeda(f.resultado.totalSistema),
        formatarMoeda(f.resultado.diferencaFinal),
        STATUS_LABEL[f.resultado.status],
      ]),
      styles: { fontSize: 9.5 },
      headStyles: { fillColor: [24, 24, 27] },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8
  }

  // --- Resumo do dia (abertura/fechamento/vendidas/marmitas) ---
  y = tituloSecaoPdf(doc, 'Resumo do Dia', y, margem, larguraUtil)
  const totalMarmitas = fechamentos.reduce((acc, f) => acc + (f.marmitasVendidas || 0), 0)
  autoTable(doc, {
    startY: y,
    margin: { left: margem, right: margem },
    body: [
      ['Abertura do caixa', formatarMoeda(rel.aberturaCaixa)],
      ['Fechamento do caixa', formatarMoeda(rel.fechamentoCaixa)],
      ['Quantidade vendida', String(rel.quantidadeVendida)],
      ['Marmitas vendidas', String(totalMarmitas)],
    ],
    styles: { fontSize: 9.5 },
    theme: 'plain',
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6

  const secaoLista = (titulo: string, itens: string[]) => {
    if (itens.length === 0) return
    if (y > 260) {
      doc.addPage()
      y = 18
    }
    y = tituloSecaoPdf(doc, titulo, y, margem, larguraUtil)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    itens.forEach((item) => {
      const linhas = doc.splitTextToSize(`•  ${item}`, larguraUtil)
      doc.text(linhas, margem, y)
      y += linhas.length * 5
    })
    y += 4
  }

  secaoLista('Estragou', rel.estragou)

  if (rel.funcionariosQueComeram.length > 0) {
    if (y > 260) {
      doc.addPage()
      y = 18
    }
    y = tituloSecaoPdf(doc, 'Funcionários que comeram', y, margem, larguraUtil)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(rel.funcionariosQueComeram.join(', '), margem, y)
    y += 9
  }

  const secaoConsumo = (titulo: string, itens: ConsumoItem[]) => {
    if (itens.length === 0) return
    if (y > 250) {
      doc.addPage()
      y = 18
    }
    y = tituloSecaoPdf(doc, titulo, y, margem, larguraUtil)
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      head: [['Pessoa', 'Item', 'Valor']],
      body: itens.map((it) => [it.pessoa, it.item, formatarMoeda(it.valor)]),
      styles: { fontSize: 9.5 },
      headStyles: { fillColor: [90, 90, 95] },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8
  }
  secaoConsumo('Consumo loja mensal', rel.consumoLojaMensal)
  secaoConsumo('Consumo loja motoboys', rel.consumoLojaMotoboys)
  secaoConsumo('Cortesia clientes', rel.cortesiaClientes)

  if (rel.sangrias.length > 0) {
    if (y > 250) {
      doc.addPage()
      y = 18
    }
    y = tituloSecaoPdf(doc, 'Sangrias', y, margem, larguraUtil)
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      head: [['Motivo', 'Valor']],
      body: rel.sangrias.map((s) => [s.motivo, formatarMoeda(s.valor)]),
      styles: { fontSize: 9.5 },
      headStyles: { fillColor: [90, 90, 95] },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8
  }

  const secaoEstoque = (titulo: string, snap: { dataHora: string; itens: { produto: string; quantidade: number }[] }) => {
    const itensComQtd = snap.itens.filter((i) => i.quantidade > 0)
    if (itensComQtd.length === 0) return
    if (y > 230) {
      doc.addPage()
      y = 18
    }
    y = tituloSecaoPdf(doc, titulo, y, margem, larguraUtil)
    if (snap.dataHora) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(120)
      doc.text(formatarDataHora(snap.dataHora), margem, y)
      doc.setTextColor(0)
      y += 5
    }
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      head: [['Produto', 'Quantidade']],
      body: itensComQtd.map((i) => [i.produto, String(i.quantidade)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [90, 90, 95] },
      columnStyles: { 1: { halign: 'right' } },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8
  }
  secaoEstoque('Estoque início', rel.estoqueInicio)
  secaoEstoque('Estoque final', rel.estoqueFinal)
  secaoLista('Estoque quente', rel.estoqueQuente)

  doc.save(`relatorio_completo_${rel.data}_${slugify('mapa-burger')}.pdf`)
}
