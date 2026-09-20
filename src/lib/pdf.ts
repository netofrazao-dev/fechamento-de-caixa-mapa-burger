import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ConsumoItem, Fechamento, MarmitaItem, RelatorioDiario, StatusFechamento } from '../types/fechamento'
import { formatarMoeda, STATUS_LABEL, totalMarmitas } from './calculations'
import { semAcento } from './texto'
import { LOGO_MAPA_BURGER_PNG } from './brand'

const COR_ACCENT: [number, number, number] = [237, 137, 33] // laranja da marca
const COR_HEADER_SECAO: [number, number, number] = [24, 24, 27]
const COR_STATUS: Record<StatusFechamento, [number, number, number]> = {
  fechou: [22, 130, 80],
  sobrou: [37, 99, 220],
  faltou: [214, 45, 45],
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
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

  quebrarPaginaSeNecessario(limite = 280) {
    if (this.y > limite) {
      this.doc.addPage([this.larguraMM, 297])
      this.y = 8
    }
  }

  salvar(nomeArquivo: string) {
    this.doc.save(nomeArquivo)
  }
}

/** Soma as vendas de cada prato entre vários fechamentos (manhã+noite), do maior pro menor. */
function agregarVendasPorPrato(fechamentos: Fechamento[]): [string, number][] {
  const mapa = new Map<string, number>()
  fechamentos.forEach((f) => {
    f.marmitas.forEach((m: MarmitaItem) => {
      mapa.set(m.prato, (mapa.get(m.prato) ?? 0) + m.quantidade)
    })
  })
  return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1])
}

/** Escreve o bloco completo de um fechamento (LC, Brendi, Resultado) no recibo. */
function escreverFechamento(r: ReciboTermico, f: Fechamento) {
  r.linha(`Fechamento - ${TURNO_LABEL[f.turno]}`, { negrito: true, centro: true })
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
  r.linhaTexto('Marmitas vendidas', String(totalMarmitas(f.marmitas)))
  f.marmitas.forEach((m) => r.linhaTexto(`  ${m.prato}`, String(m.quantidade)))

  if (f.observacoes) {
    r.separador()
    r.linha('Observacoes:', { negrito: true })
    r.paragrafo(f.observacoes)
  }
}

/** Escreve o bloco completo do relatório diário escrito no recibo. */
function escreverRelatorio(r: ReciboTermico, rel: RelatorioDiario) {
  r.linha('RELATORIO DIARIO', { negrito: true, centro: true })
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

  const itensEstoque = rel.estoqueQuente.itens.filter((i) => i.quantidade > 0)
  if (itensEstoque.length > 0) {
    r.linha('ESTOQUE QUENTE', { negrito: true })
    itensEstoque.forEach((i) => r.linhaTexto(i.produto, String(i.quantidade)))
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
  r.linha(`Data: ${formatarData(f.data)}`, { centro: true })
  r.separador()
  escreverFechamento(r, f)
  r.salvar(`fechamento_${f.data}_${f.turno}.pdf`)
}

/**
 * Impressão combinada (80mm): fechamento(s) de caixa do dia
 * (manhã/noite, o que existir) + relatório diário completo,
 * tudo num único recibo, sem acentos.
 */
export function imprimirDiaCompleto(params: { relatorio: RelatorioDiario; fechamentos: Fechamento[] }): void {
  const { relatorio, fechamentos } = params
  const r = new ReciboTermico()

  r.linha('MAPA BURGER', { negrito: true, tamanho: 12, centro: true })
  r.linha('Relatorio do Dia', { centro: true, tamanho: 9 })
  r.espaco(1)
  r.linha(`Data: ${formatarData(relatorio.data)}`, { centro: true })
  r.separador()

  if (fechamentos.length === 0) {
    r.linha('(nenhum fechamento de caixa salvo para esta data)', { tamanho: 8 })
    r.separador()
  }

  fechamentos.forEach((f) => {
    r.quebrarPaginaSeNecessario(250)
    escreverFechamento(r, f)
    r.espaco(2)
  })

  const vendasPorPratoDia = agregarVendasPorPrato(fechamentos)
  if (vendasPorPratoDia.length > 0) {
    r.quebrarPaginaSeNecessario(250)
    r.linha('VENDAS POR PRATO', { negrito: true })
    vendasPorPratoDia.forEach(([prato, qtd]) => r.linhaTexto(prato, String(qtd)))
    r.separador()
  }

  r.quebrarPaginaSeNecessario(250)
  escreverRelatorio(r, relatorio)

  r.salvar(`relatorio_dia_completo_${relatorio.data}.pdf`)
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
// PDF final consolidado (A4, com acentos, visual mais elaborado)
// — fechamento(s) de caixa DETALHADOS + relatório diário
// completo, pra mandar pro contador.
// ============================================================

function tituloSecaoPdf(doc: jsPDF, texto: string, y: number, margem: number, larguraUtil: number): number {
  doc.setFillColor(...COR_ACCENT)
  doc.rect(margem, y, 2.2, 8, 'F')
  doc.setFillColor(...COR_HEADER_SECAO)
  doc.rect(margem + 2.2, y, larguraUtil - 2.2, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(texto.toUpperCase(), margem + 5, y + 5.6)
  doc.setTextColor(0, 0, 0)
  return y + 13
}

function subtituloPdf(doc: jsPDF, texto: string, y: number, margem: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(50)
  doc.text(texto, margem, y)
  doc.setTextColor(0)
  return y + 6
}

/** Selo colorido de status (FECHOU/SOBROU/FALTOU) desenhado no PDF. */
function seloStatusPdf(doc: jsPDF, status: StatusFechamento, x: number, y: number): number {
  const texto = STATUS_LABEL[status]
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  const largura = doc.getTextWidth(texto) + 6
  const [r, g, b] = COR_STATUS[status]
  doc.setFillColor(r, g, b)
  doc.roundedRect(x, y, largura, 6.5, 1.5, 1.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.text(texto, x + 3, y + 4.5)
  doc.setTextColor(0, 0, 0)
  return largura
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function finalY(doc: any): number {
  return doc.lastAutoTable.finalY
}

/** Descobre as dimensões (px) de uma imagem a partir do seu data URL. */
function dimensoesImagem(dataUrl: string): Promise<{ largura: number; altura: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ largura: img.naturalWidth, altura: img.naturalHeight })
    img.onerror = reject
    img.src = dataUrl
  })
}

/**
 * PDF final pra enviar no WhatsApp (A4, com acentos, visual mais
 * elaborado): fechamento(s) de caixa DETALHADOS + relatório diário
 * completo + (opcional) os prints anexados como páginas extras —
 * tudo num arquivo só. As imagens já vêm como data URL (base64),
 * pois ficam salvas junto com o relatório.
 */
export async function gerarPdfWhatsApp(params: {
  relatorio: RelatorioDiario
  fechamentos: Fechamento[]
  imagens?: (string | null | undefined)[]
}): Promise<void> {
  const { relatorio: rel, fechamentos, imagens = [] } = params
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margem = 16
  const larguraUtil = 210 - margem * 2
  let y = 16

  const quebrarSeNecessario = (limite = 255) => {
    if (y > limite) {
      doc.addPage()
      y = 18
    }
  }

  // --- Cabeçalho, com a logo do restaurante ---
  const logoTam = 16
  doc.addImage(LOGO_MAPA_BURGER_PNG, 'PNG', margem, y, logoTam, logoTam)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(19)
  doc.setTextColor(20)
  doc.text('Mapa Burger', margem + logoTam + 5, y + 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(110)
  doc.text(`Relatório completo do dia — ${formatarData(rel.data)}`, margem + logoTam + 5, y + 14.5)
  doc.setTextColor(0)
  y += logoTam + 4

  doc.setFillColor(...COR_ACCENT)
  doc.rect(margem, y, larguraUtil, 1, 'F')
  y += 8

  // --- Resumo do dia em destaque ---
  const totalCaixaDia = fechamentos.reduce((acc, f) => acc + f.resultado.totalCaixa, 0)
  const totalSistemaDia = fechamentos.reduce((acc, f) => acc + f.resultado.totalSistema, 0)
  const diferencaFinalDia = fechamentos.reduce((acc, f) => acc + f.resultado.diferencaFinal, 0)
  const totalMarmitasDia = fechamentos.reduce((acc, f) => acc + totalMarmitas(f.marmitas), 0)
  const statusDia: StatusFechamento =
    Math.abs(diferencaFinalDia) < 0.005 ? 'fechou' : diferencaFinalDia > 0 ? 'sobrou' : 'faltou'

  if (fechamentos.length > 0) {
    seloStatusPdf(doc, statusDia, 210 - margem - 32, 16 + 2)
  }

  const alturaResumo = 26
  doc.setDrawColor(225)
  doc.setLineWidth(0.3)
  doc.roundedRect(margem, y, larguraUtil, alturaResumo, 2, 2)

  const colunas = [
    { label: 'TOTAL CAIXA', valor: formatarMoeda(totalCaixaDia) },
    { label: 'TOTAL SISTEMA', valor: formatarMoeda(totalSistemaDia) },
    { label: 'DIFERENÇA', valor: formatarMoeda(diferencaFinalDia) },
    { label: 'VENDIDAS / MARMITAS', valor: `${rel.quantidadeVendida} / ${totalMarmitasDia}` },
  ]
  const larguraColuna = larguraUtil / colunas.length
  colunas.forEach((c, i) => {
    const cx = margem + larguraColuna * i + larguraColuna / 2
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(140)
    doc.text(c.label, cx, y + 9, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(20)
    doc.text(c.valor, cx, y + 18, { align: 'center' })
    if (i > 0) {
      doc.setDrawColor(230)
      doc.line(margem + larguraColuna * i, y + 5, margem + larguraColuna * i, y + alturaResumo - 5)
    }
  })
  doc.setTextColor(0)
  y += alturaResumo + 10

  // --- Fechamento de caixa, detalhado, por turno ---
  if (fechamentos.length === 0) {
    y = tituloSecaoPdf(doc, 'Fechamento de Caixa', y, margem, larguraUtil)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9.5)
    doc.setTextColor(130)
    doc.text('Nenhum fechamento de caixa salvo para esta data.', margem, y)
    doc.setTextColor(0)
    y += 8
  }

  fechamentos.forEach((f) => {
    quebrarSeNecessario(230)
    y = tituloSecaoPdf(doc, `Fechamento de Caixa — ${TURNO_LABEL[f.turno]}`, y, margem, larguraUtil)

    y = subtituloPdf(doc, 'LC', y, margem)
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      theme: 'striped',
      alternateRowStyles: { fillColor: [248, 248, 249] },
      styles: { fontSize: 9.5, cellPadding: 1 },
      body: [
        ['Dinheiro abertura', formatarMoeda(f.lc.dinheiroAbertura)],
        ['Dinheiro fechamento', formatarMoeda(f.lc.dinheiroFechamento)],
        ['PIX', formatarMoeda(f.lc.pix)],
        ['Débito', formatarMoeda(f.lc.debito)],
        ['Crédito', formatarMoeda(f.lc.credito)],
        ['Consumo loja', formatarMoeda(f.lc.consumoLoja)],
        ['A prazo', formatarMoeda(f.lc.aPrazo)],
        ['Ticket', formatarMoeda(f.lc.ticket)],
        ['Total LC', formatarMoeda(f.resultado.totalLC)],
      ],
      columnStyles: { 1: { halign: 'right' } },
    })
    y = finalY(doc) + 4

    if (f.sangrias.length > 0) {
      quebrarSeNecessario(230)
      y = subtituloPdf(doc, 'Sangrias', y, margem)
      autoTable(doc, {
        startY: y,
        margin: { left: margem, right: margem },
        head: [['Motivo', 'Valor']],
        body: f.sangrias.map((s) => [s.motivo, formatarMoeda(s.valor)]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [60, 60, 64] },
        columnStyles: { 1: { halign: 'right' } },
      })
      y = finalY(doc) + 4
    }

    quebrarSeNecessario(230)
    y = subtituloPdf(doc, 'Brendi', y, margem)
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      theme: 'striped',
      alternateRowStyles: { fillColor: [248, 248, 249] },
      styles: { fontSize: 9.5, cellPadding: 1 },
      body: [
        ['PIX', formatarMoeda(f.brendi.pix)],
        ['Débito', formatarMoeda(f.brendi.debito)],
        ['Crédito', formatarMoeda(f.brendi.credito)],
        ['Crédito Online', formatarMoeda(f.brendi.creditoOnline)],
        ['Dinheiro', formatarMoeda(f.brendi.dinheiro)],
        ['Total Brendi', formatarMoeda(f.resultado.totalBrendi)],
      ],
      columnStyles: { 1: { halign: 'right' } },
    })
    y = finalY(doc) + 4

    quebrarSeNecessario(230)
    y = subtituloPdf(doc, 'Resultado', y, margem)
    const linhasResultado: [string, string][] = [
      ['Total Caixa', formatarMoeda(f.resultado.totalCaixa)],
      ['Total LC Sistema', formatarMoeda(f.totalLCSistema)],
      ['Total Sistema', formatarMoeda(f.resultado.totalSistema)],
      ['Diferença original', formatarMoeda(f.resultado.diferencaOriginal)],
    ]
    if (f.ajuste.tipo) {
      linhasResultado.push([
        `Ajuste (${f.ajuste.tipo === 'adicionar' ? 'adicionado' : 'removido'})`,
        formatarMoeda(f.resultado.ajusteAplicado),
      ])
    }
    linhasResultado.push(['Diferença final', formatarMoeda(f.resultado.diferencaFinal)])
    linhasResultado.push(['Situação', STATUS_LABEL[f.resultado.status]])
    linhasResultado.push(['Marmitas vendidas', String(totalMarmitas(f.marmitas))])
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      theme: 'striped',
      alternateRowStyles: { fillColor: [248, 248, 249] },
      styles: { fontSize: 9.5, cellPadding: 1, fontStyle: 'bold' },
      body: linhasResultado,
      columnStyles: { 1: { halign: 'right' } },
    })
    y = finalY(doc) + 4

    if (f.observacoes) {
      quebrarSeNecessario(240)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      const linhas = doc.splitTextToSize(`Observações: ${f.observacoes}`, larguraUtil)
      doc.text(linhas, margem, y)
      y += linhas.length * 4.5 + 4
    }

    y += 4
  })

  // --- Vendas por prato (agregado do dia, ajuda a ver o que vende mais) ---
  const vendasPorPratoDia = agregarVendasPorPrato(fechamentos)
  if (vendasPorPratoDia.length > 0) {
    quebrarSeNecessario(230)
    y = tituloSecaoPdf(doc, 'Vendas por Prato', y, margem, larguraUtil)
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      head: [['Prato', 'Quantidade']],
      body: vendasPorPratoDia.map(([prato, qtd]) => [prato, String(qtd)]),
      styles: { fontSize: 9.5 },
      headStyles: { fillColor: [60, 60, 64] },
      columnStyles: { 1: { halign: 'right' } },
    })
    y = finalY(doc) + 8
  }

  // --- Resumo do relatório escrito ---
  quebrarSeNecessario(230)
  y = tituloSecaoPdf(doc, 'Resumo do Dia (Relatório)', y, margem, larguraUtil)
  autoTable(doc, {
    startY: y,
    margin: { left: margem, right: margem },
    theme: 'striped',
      alternateRowStyles: { fillColor: [248, 248, 249] },
    styles: { fontSize: 9.5, cellPadding: 1 },
    body: [
      ['Abertura do caixa', formatarMoeda(rel.aberturaCaixa)],
      ['Fechamento do caixa', formatarMoeda(rel.fechamentoCaixa)],
      ['Quantidade vendida', String(rel.quantidadeVendida)],
    ],
    columnStyles: { 1: { halign: 'right' } },
  })
  y = finalY(doc) + 6

  const secaoLista = (titulo: string, itens: string[]) => {
    if (itens.length === 0) return
    quebrarSeNecessario(255)
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
    quebrarSeNecessario(255)
    y = tituloSecaoPdf(doc, 'Funcionários que comeram', y, margem, larguraUtil)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(rel.funcionariosQueComeram.join(', '), margem, y)
    y += 9
  }

  const secaoConsumo = (titulo: string, itens: ConsumoItem[]) => {
    if (itens.length === 0) return
    quebrarSeNecessario(245)
    y = tituloSecaoPdf(doc, titulo, y, margem, larguraUtil)
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      head: [['Pessoa', 'Item', 'Valor']],
      body: itens.map((it) => [it.pessoa, it.item, formatarMoeda(it.valor)]),
      styles: { fontSize: 9.5 },
      headStyles: { fillColor: [60, 60, 64] },
    })
    y = finalY(doc) + 8
  }
  secaoConsumo('Consumo loja mensal', rel.consumoLojaMensal)
  secaoConsumo('Consumo loja motoboys', rel.consumoLojaMotoboys)
  secaoConsumo('Cortesia clientes', rel.cortesiaClientes)

  if (rel.sangrias.length > 0) {
    quebrarSeNecessario(245)
    y = tituloSecaoPdf(doc, 'Sangrias (relatório)', y, margem, larguraUtil)
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      head: [['Motivo', 'Valor']],
      body: rel.sangrias.map((s) => [s.motivo, formatarMoeda(s.valor)]),
      styles: { fontSize: 9.5 },
      headStyles: { fillColor: [60, 60, 64] },
    })
    y = finalY(doc) + 8
  }

  const itensEstoque = rel.estoqueQuente.itens.filter((i) => i.quantidade > 0)
  if (itensEstoque.length > 0) {
    quebrarSeNecessario(230)
    y = tituloSecaoPdf(doc, 'Estoque quente', y, margem, larguraUtil)
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      head: [['Produto', 'Quantidade']],
      body: itensEstoque.map((i) => [i.produto, String(i.quantidade)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [60, 60, 64] },
      columnStyles: { 1: { halign: 'right' } },
    })
  }

  // --- Anexos (prints enviados junto, cada um em sua própria página) ---
  let indiceAnexo = 0
  for (const dataUrl of imagens) {
    if (!dataUrl) continue
    indiceAnexo += 1
    const { largura, altura } = await dimensoesImagem(dataUrl)
    doc.addPage()
    const margemAnexo = 14
    doc.setFillColor(...COR_ACCENT)
    doc.rect(margemAnexo, margemAnexo, 2.2, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(20)
    doc.text(`Anexo ${indiceAnexo}`, margemAnexo + 5, margemAnexo + 4.8)
    doc.setTextColor(0)
    const larguraDisp = 210 - margemAnexo * 2
    const alturaDisp = 297 - margemAnexo * 2 - 14
    const escala = Math.min(larguraDisp / largura, alturaDisp / altura, 1)
    const wFinal = largura * escala
    const hFinal = altura * escala
    const xFinal = (210 - wFinal) / 2
    const formato = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
    doc.addImage(dataUrl, formato, xFinal, margemAnexo + 10, wFinal, hFinal)
  }

  // --- Rodapé (marca + página) em todas as páginas ---
  const totalPaginas = doc.getNumberOfPages()
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p)
    doc.setDrawColor(230)
    doc.setLineWidth(0.2)
    doc.line(margem, 289, 210 - margem, 289)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(140)
    doc.text(`Mapa Burger — Relatório do dia ${formatarData(rel.data)}`, margem, 293.5)
    doc.text(`${p} / ${totalPaginas}`, 210 - margem, 293.5, { align: 'right' })
    doc.setTextColor(0)
  }

  doc.save(`relatorio_whatsapp_${rel.data}_${slugify('mapa-burger')}.pdf`)
}
