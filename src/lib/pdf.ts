import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ConsumoItem, Fechamento, RelatorioDiario, StatusFechamento } from '../types/fechamento'
import { agregarVendasPorPrato, formatarMoeda, STATUS_LABEL, totalMarmitas } from './calculations'
import { semAcento } from './texto'
import { LOGO_MAPA_BURGER_PNG } from './brand'

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

const TURNO_LABEL: Record<'manha' | 'noite', string> = {
  manha: 'Manhã',
  noite: 'Noite',
}

const COR_ACCENT: [number, number, number] = [230, 126, 34]
const COR_ESCURO: [number, number, number] = [24, 24, 27]
const COR_STATUS: Record<StatusFechamento, [number, number, number]> = {
  fechou: [22, 130, 70],
  sobrou: [37, 99, 235],
  faltou: [205, 35, 35],
}

function slugify(texto: string): string {
  return (texto || 'sem-titulo')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function statusPorDiferenca(diferenca: number): StatusFechamento {
  if (Math.abs(diferenca) < 0.005) return 'fechou'
  return diferenca > 0 ? 'sobrou' : 'faltou'
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
  doc.setFillColor(...COR_ESCURO)
  doc.rect(margem, y, larguraUtil, 7.5, 'F')
  doc.setFillColor(...COR_ACCENT)
  doc.rect(margem, y, 2.2, 7.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.text(texto.toUpperCase(), margem + 5, y + 5.2)
  doc.setTextColor(0, 0, 0)
  return y + 11.5
}

function subtituloPdf(doc: jsPDF, texto: string, y: number, margem: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(60)
  doc.text(texto, margem, y)
  doc.setTextColor(0)
  return y + 6
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

/** Desenha um "card" de destaque com um número grande e um rótulo embaixo. */
function desenharCardResumo(
  doc: jsPDF,
  params: { x: number; y: number; largura: number; altura: number; label: string; valor: string; destaque?: boolean },
) {
  const { x, y, largura, altura, label, valor, destaque } = params
  doc.setFillColor(248, 248, 249)
  doc.roundedRect(x, y, largura, altura, 2, 2, 'F')
  doc.setDrawColor(230)
  doc.setLineWidth(0.2)
  doc.roundedRect(x, y, largura, altura, 2, 2, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  if (destaque) {
    doc.setTextColor(...COR_ACCENT)
  } else {
    doc.setTextColor(20)
  }
  doc.text(valor, x + largura / 2, y + altura / 2 - 1, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(120)
  doc.text(label.toUpperCase(), x + largura / 2, y + altura - 4, { align: 'center' })
  doc.setTextColor(0)
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

  // --- Cabeçalho com a logo ---
  try {
    doc.addImage(LOGO_MAPA_BURGER_PNG, 'PNG', margem, y, 16, 16)
  } catch {
    // se a logo falhar por algum motivo, segue sem ela
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Mapa Burger', margem + 20, y + 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(110)
  doc.text(`Relatório completo do dia — ${formatarData(rel.data)}`, margem + 20, y + 14.5)
  doc.setTextColor(0)
  y += 22
  doc.setDrawColor(...COR_ACCENT)
  doc.setLineWidth(1)
  doc.line(margem, y, 210 - margem, y)
  y += 8

  // --- Cards de resumo do dia ---
  const totalCaixaDia = fechamentos.reduce((acc, f) => acc + f.resultado.totalCaixa, 0)
  const totalSistemaDia = fechamentos.reduce((acc, f) => acc + f.resultado.totalSistema, 0)
  const diferencaFinalDia = fechamentos.reduce((acc, f) => acc + f.resultado.diferencaFinal, 0)
  const totalMarmitasDia = fechamentos.reduce((acc, f) => acc + totalMarmitas(f.marmitas), 0)

  const larguraCard = (larguraUtil - 3 * 4) / 4
  const alturaCard = 20
  const cards = [
    { label: 'Total Caixa', valor: formatarMoeda(totalCaixaDia) },
    { label: 'Total Sistema', valor: formatarMoeda(totalSistemaDia) },
    { label: 'Diferença', valor: formatarMoeda(diferencaFinalDia), destaque: true },
    { label: 'Marmitas vendidas', valor: String(totalMarmitasDia) },
  ]
  cards.forEach((card, i) => {
    desenharCardResumo(doc, {
      x: margem + i * (larguraCard + 4),
      y,
      largura: larguraCard,
      altura: alturaCard,
      label: card.label,
      valor: card.valor,
      destaque: card.destaque,
    })
  })
  y += alturaCard + 6

  if (fechamentos.length > 0) {
    const statusDia = statusPorDiferenca(diferencaFinalDia)
    const corStatus = COR_STATUS[statusDia]
    doc.setFillColor(...corStatus)
    doc.roundedRect(margem, y, larguraUtil, 9, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(255, 255, 255)
    doc.text(STATUS_LABEL[statusDia], 210 / 2, y + 6, { align: 'center' })
    doc.setTextColor(0)
    y += 15
  }

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
      styles: { fontSize: 9.5, cellPadding: 1.4 },
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
      didParseCell: (data) => {
        if (data.row.index === 8) data.cell.styles.fontStyle = 'bold'
      },
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
        headStyles: { fillColor: [140, 140, 145] },
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
      styles: { fontSize: 9.5, cellPadding: 1.4 },
      body: [
        ['PIX', formatarMoeda(f.brendi.pix)],
        ['Débito', formatarMoeda(f.brendi.debito)],
        ['Crédito', formatarMoeda(f.brendi.credito)],
        ['Crédito Online', formatarMoeda(f.brendi.creditoOnline)],
        ['Dinheiro', formatarMoeda(f.brendi.dinheiro)],
        ['Total Brendi', formatarMoeda(f.resultado.totalBrendi)],
      ],
      columnStyles: { 1: { halign: 'right' } },
      didParseCell: (data) => {
        if (data.row.index === 5) data.cell.styles.fontStyle = 'bold'
      },
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
      theme: 'plain',
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
    theme: 'plain',
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
      headStyles: { fillColor: [90, 90, 95] },
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
      headStyles: { fillColor: [90, 90, 95] },
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
      headStyles: { fillColor: [90, 90, 95] },
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

// ============================================================
// PDF mensal de Vales — por funcionário, com detalhe por dia
// ============================================================

export function gerarPdfValesMensal(params: {
  mesLabel: string
  totaisPorFuncionario: { funcionario: string; total: number }[]
  vales: { funcionario: string; data: string; valor: number; observacao: string }[]
}): void {
  const { mesLabel, totaisPorFuncionario, vales } = params
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margem = 14

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('MAPA BURGER', margem, 16)
  doc.setFontSize(11)
  doc.text(`Relatório Mensal de Vales — ${mesLabel}`, margem, 23)

  const totalMes = totaisPorFuncionario.reduce((acc, t) => acc + t.total, 0)

  autoTable(doc, {
    startY: 28,
    margin: { left: margem, right: margem },
    head: [['Funcionário', 'Total no mês']],
    body: totaisPorFuncionario.map((t) => [t.funcionario, formatarMoeda(t.total)]),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [30, 30, 30] },
    columnStyles: { 1: { halign: 'right' } },
    foot: [['TOTAL GERAL', formatarMoeda(totalMes)]],
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let y = (doc as any).lastAutoTable.finalY + 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Detalhamento', margem, y)
  y += 5

  autoTable(doc, {
    startY: y,
    margin: { left: margem, right: margem },
    head: [['Data', 'Funcionário', 'Valor', 'Observação']],
    body: vales.map((v) => [formatarData(v.data), v.funcionario, formatarMoeda(v.valor), v.observacao || '-']),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [90, 90, 95] },
    columnStyles: { 2: { halign: 'right' } },
  })

  doc.save(`vales_${mesLabel.replace('/', '-')}.pdf`)
}
