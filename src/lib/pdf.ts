import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ConsumoItem, Fechamento, RelatorioDiario, Sangria, StatusFechamento } from '../types/fechamento'
import { agregarVendasPorPrato, formatarMoeda, STATUS_LABEL, totalMarmitas } from './calculations'
import { semAcento } from './texto'
import { LOGO_MAPA_BURGER_PNG } from './brand'
import { compartilharOuBaixar, type ResultadoEntrega } from './arquivos'
import { formasDePagamento, resumoDoMes, situacaoDoCaixa, type ItemPagamento } from './relatorioResumo'

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
    r.linhaValor('Total retirado', somaCentavos(rel.sangrias.map((s) => s.valor)))
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

function somaCentavos(valores: number[]): number {
  return valores.reduce((acc, v) => acc + Math.round(v * 100), 0) / 100
}

function situacaoTexto(diferenca: number): string {
  return diferenca > 0.005 ? 'Sobrou' : diferenca < -0.005 ? 'Faltou' : 'Fechou'
}

/** Textos que mudam entre o relatório do mês e o da semana. */
interface TextosPeriodo {
  titulo: string
  subtitulo: string
  prefixo: string // "NO MÊS" / "NA SEMANA"
  resumo: string // "Resumo do mês"
  dinheiro: string // "Como o dinheiro entrou no mês"
  rodape: string
  arquivo: string
  periodoFrase: 'o mês' | 'a semana'
  colunaAtual: string // "Este mês"
  colunaAnterior: string // "Mês anterior"
  valesNo: string // "no mês"
}

/** PDF da semana: mesmo formato do mensal, com os dias de segunda a domingo. */
export async function gerarPdfSemanal(params: Omit<Parameters<typeof gerarPdfMensal>[0], 'mes' | 'periodo'> & {
  inicio: string // segunda-feira YYYY-MM-DD
  fim: string
}): Promise<ResultadoEntrega> {
  const { inicio, fim, ...resto } = params
  const br = (iso: string) => iso.split('-').reverse().join('/')
  return gerarPdfMensal({
    ...resto,
    mes: inicio.slice(0, 7),
    periodo: {
      titulo: 'Relatório da semana',
      subtitulo: `Segunda ${br(inicio)} a domingo ${br(fim)}`,
      prefixo: 'NA SEMANA',
      resumo: 'Resumo da semana',
      dinheiro: 'Como o dinheiro entrou na semana',
      rodape: `Mapa Burger — Relatório da semana ${br(inicio).slice(0, 5)} a ${br(fim)}`,
      arquivo: `Mapa-Burger_relatorio-semanal_${br(inicio).replace(/\//g, '-')}.pdf`,
      periodoFrase: 'a semana',
      colunaAtual: 'Esta semana',
      colunaAnterior: 'Semana passada',
      valesNo: 'na semana',
    },
  })
}

/** PDF do mês: resumo em linguagem simples, formas de pagamento, dia a dia e pratos. */
export async function gerarPdfMensal(params: {
  mes: string // YYYY-MM
  /** Quando informado, troca os textos (usado pelo relatório semanal). */
  periodo?: TextosPeriodo
  linhas: LinhaRelatorioMensal[]
  vendasPorPrato?: [string, number][]
  diasSemFechamento?: string[]
  totalVales?: number | null
  compartilhar?: boolean
  /** Vendas de cada dia (null = sem fechamento) + médias, para o gráfico de colunas. */
  grafico?: {
    dias: { data: string; vendas: number | null; diferenca?: number }[]
    mediaAtual: number
    mediaAnterior?: number | null
    rotuloAnterior?: string
    rotuloMedia?: string
  }
  /** Comparação com o mês anterior, já formatada: [indicador, este mês, mês anterior, variação]. */
  comparacao?: { titulo: string; frase: string; linhas: [string, string, string, string][] } | null
}): Promise<ResultadoEntrega> {
  const { mes, linhas, vendasPorPrato = [], diasSemFechamento = [], totalVales, compartilhar, grafico, comparacao } = params
  const [ano, m] = mes.split('-')
  const mesLabel = `${m}/${ano}`
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margem = 16
  const larguraUtil = 210 - margem * 2
  const nomeMes = NOMES_MES[Number(m) - 1] ?? m
  const textos: TextosPeriodo = params.periodo ?? {
    titulo: 'Relatório do mês',
    subtitulo: `${nomeMes.charAt(0).toUpperCase()}${nomeMes.slice(1)} de ${ano}`,
    prefixo: 'NO MÊS',
    resumo: 'Resumo do mês',
    dinheiro: 'Como o dinheiro entrou no mês',
    rodape: `Mapa Burger — Relatório do mês ${mesLabel}`,
    arquivo: `Mapa-Burger_relatorio-mensal_${m}-${ano}.pdf`,
    periodoFrase: 'o mês',
    colunaAtual: 'Este mês',
    colunaAnterior: 'Mês anterior',
    valesNo: 'no mês',
  }
  let y = cabecalhoComLogo(doc, margem, textos.titulo, textos.subtitulo)

  const quebra = criarQuebra(doc)
  const garantir = (altura: number) => {
    y = quebra(altura, y)
  }

  const fechamentos = linhas.flatMap((l) => [l.manha, l.noite].filter(Boolean) as Fechamento[])
  const totalCaixa = somaCentavos(linhas.map((l) => l.totalCaixaDia))
  const totalSistema = somaCentavos(linhas.map((l) => l.totalSistemaDia))
  const totalDiferenca = somaCentavos(linhas.map((l) => l.diferencaFinalDia))
  const totalMarmitasMes = vendasPorPrato.reduce((acc, [, q]) => acc + q, 0)

  // Resultado do mês
  const situacao = situacaoDoCaixa(totalDiferenca)
  y = faixaSituacao(doc, margem, y, larguraUtil, linhas.length ? `${textos.prefixo}: ${situacao.titulo}` : 'SEM FECHAMENTOS NO PERÍODO', linhas.length ? situacao.status : null)

  // Cards
  const cards = [
    { label: 'Vendas no caixa', valor: formatarMoeda(totalCaixa) },
    { label: 'Registrado no sistema', valor: formatarMoeda(totalSistema) },
    { label: 'Dias com fechamento', valor: String(linhas.length) },
    { label: 'Marmitas vendidas', valor: String(totalMarmitasMes) },
  ]
  const larguraCard = (larguraUtil - 3 * 4) / 4
  cards.forEach((c, i) =>
    desenharCardResumo(doc, { x: margem + i * (larguraCard + 4), y, largura: larguraCard, altura: 18, label: c.label, valor: c.valor }),
  )
  y += 24

  // Resumo em frases
  y = tituloSecaoPdf(doc, textos.resumo, y, margem, larguraUtil)
  const frases = resumoDoMes({ dias: linhas, diasSemFechamento: diasSemFechamento.length, totalMarmitas: totalMarmitasMes, periodo: textos.periodoFrase })
  if (totalVales != null && totalVales > 0) frases.push(`Vales (adiantamentos de salário) ${textos.valesNo}: ${formatarMoeda(totalVales)}.`)
  y = listaComMarcadores(doc, frases, margem, y + 1, larguraUtil, quebra)
  y += 3

  // Comparação com o mês anterior
  if (comparacao) {
    garantir(55)
    y = tituloSecaoPdf(doc, comparacao.titulo, y, margem, larguraUtil)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(60)
    const frase = doc.splitTextToSize(comparacao.frase, larguraUtil)
    doc.text(frase, margem, y)
    doc.setTextColor(0)
    y += frase.length * 4.6 + 1
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      head: [[
        'Indicador',
        { content: textos.colunaAtual, styles: { halign: 'right' } },
        { content: textos.colunaAnterior, styles: { halign: 'right' } },
        { content: 'Variação', styles: { halign: 'right' } },
      ]],
      body: comparacao.linhas,
      styles: { fontSize: 9.5, cellPadding: 1.6 },
      headStyles: { fillColor: [60, 60, 64] },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 3) return
        const t = String(data.cell.raw ?? '')
        const menorEhMelhor = data.row.index === 3 // dias que faltou
        if (t.startsWith('+')) data.cell.styles.textColor = menorEhMelhor ? COR_STATUS.faltou : COR_STATUS.fechou
        else if (t.startsWith('-')) data.cell.styles.textColor = menorEhMelhor ? COR_STATUS.fechou : COR_STATUS.faltou
      },
    })
    y = finalY(doc) + 6
  }

  // Gráfico: vendas por dia
  if (grafico && grafico.dias.some((d) => (d.vendas ?? 0) > 0)) {
    garantir(68)
    y = tituloSecaoPdf(doc, 'Vendas por dia', y, margem, larguraUtil)
    y = desenharColunas(doc, grafico, margem, y + 1, larguraUtil, 48)
    y += 4
    if (grafico.dias.some((d) => d.diferenca !== undefined && Math.abs(d.diferenca) >= 0.005)) {
      garantir(56)
      y = tituloSecaoPdf(doc, 'Sobra e falta por dia', y, margem, larguraUtil)
      y = desenharSobraFalta(doc, grafico.dias, margem, y + 1, larguraUtil, 38)
      y += 4
    }
  }

  // Formas de pagamento
  const pagamentos = formasDePagamento(fechamentos)
  if (pagamentos.length > 0) {
    garantir(16 + pagamentos.length * 7.5)
    y = tituloSecaoPdf(doc, textos.dinheiro, y, margem, larguraUtil)
    y = desenharBarras(doc, pagamentos, margem, y, larguraUtil)
    y += 4
  }

  // Dia a dia
  if (linhas.length > 0) {
    garantir(30)
    y = tituloSecaoPdf(doc, 'Dia a dia', y, margem, larguraUtil)
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      head: [[
        'Dia',
        { content: 'Vendas no caixa', styles: { halign: 'right' } },
        { content: 'No sistema', styles: { halign: 'right' } },
        { content: 'Diferença', styles: { halign: 'right' } },
        'Resultado',
      ]],
      body: linhas.map((l) => [
        `${formatarData(l.data).slice(0, 5)} ${DIAS_CURTOS[diaSemanaNumero(l.data)]}`,
        formatarMoeda(l.totalCaixaDia),
        formatarMoeda(l.totalSistemaDia),
        formatarMoeda(l.diferencaFinalDia),
        situacaoTexto(l.diferencaFinalDia),
      ]),
      styles: { fontSize: 9, cellPadding: 1.6 },
      headStyles: { fillColor: COR_ESCURO },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      didParseCell: (data) => {
        if (data.section === 'body' && (data.column.index === 3 || data.column.index === 4)) {
          const status = statusPorDiferenca(linhas[data.row.index]?.diferencaFinalDia ?? 0)
          data.cell.styles.textColor = COR_STATUS[status]
          if (data.column.index === 4) data.cell.styles.fontStyle = 'bold'
        }
      },
      foot: [[
        'TOTAL',
        { content: formatarMoeda(totalCaixa), styles: { halign: 'right' } },
        { content: formatarMoeda(totalSistema), styles: { halign: 'right' } },
        { content: formatarMoeda(totalDiferenca), styles: { halign: 'right' } },
        situacaoTexto(totalDiferenca),
      ]],
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    })
    y = finalY(doc) + 6
  }

  // Pratos
  if (vendasPorPrato.length > 0) {
    garantir(30)
    y = tituloSecaoPdf(doc, 'Marmitas vendidas por prato', y, margem, larguraUtil)
    y = tabelaPratos(doc, vendasPorPrato, margem, y)
  }

  if (diasSemFechamento.length > 0) {
    garantir(20)
    y = tituloSecaoPdf(doc, 'Dias sem fechamento registrado', y, margem, larguraUtil)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    const texto = diasSemFechamento.map((d) => formatarData(d).slice(0, 5)).join(', ')
    const linhasTexto = doc.splitTextToSize(texto, larguraUtil)
    y += 1
    doc.text(linhasTexto, margem, y)
    y += linhasTexto.length * 4.6
  }

  rodapePaginas(doc, margem, textos.rodape)
  return entregarPdf(doc, textos.arquivo, compartilhar)
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

// ------------------------------------------------------------
// Peças de layout compartilhadas pelos PDFs para os patrões
// ------------------------------------------------------------

const NOMES_MES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function diaSemanaNumero(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d).getDay()
}

async function entregarPdf(doc: jsPDF, nome: string, compartilhar?: boolean): Promise<ResultadoEntrega> {
  if (compartilhar) return compartilharOuBaixar(doc.output('blob'), nome, nome.replace(/\.pdf$/, '').replace(/_/g, ' '))
  doc.save(nome)
  return 'baixado'
}

/** Logo + título + subtítulo + linha laranja. Devolve o y logo abaixo. */
function cabecalhoComLogo(doc: jsPDF, margem: number, titulo: string, subtitulo: string): number {
  let y = 14
  try {
    doc.addImage(LOGO_MAPA_BURGER_PNG, 'PNG', margem, y, 15, 15)
  } catch {
    // segue sem logo
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...COR_ESCURO)
  doc.text(`Mapa Burger — ${titulo}`, margem + 19, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(100)
  doc.text(subtitulo, margem + 19, y + 13)
  doc.setTextColor(0)
  y += 19
  doc.setDrawColor(...COR_ACCENT)
  doc.setLineWidth(0.9)
  doc.line(margem, y, 210 - margem, y)
  return y + 6
}

/** Faixa colorida com o resultado (verde/azul/vermelho; cinza sem dados). */
function faixaSituacao(
  doc: jsPDF,
  margem: number,
  y: number,
  largura: number,
  titulo: string,
  status: StatusFechamento | null,
  frase?: string,
): number {
  const cor: [number, number, number] = status ? COR_STATUS[status] : [120, 120, 125]
  const linhasFrase = frase ? doc.splitTextToSize(frase, largura - 10) : []
  const altura = 11 + (linhasFrase.length ? linhasFrase.length * 4.6 + 1.5 : 0)
  doc.setFillColor(...cor)
  doc.roundedRect(margem, y, largura, altura, 2.5, 2.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(titulo, 105, y + 7.6, { align: 'center' })
  if (linhasFrase.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(linhasFrase, 105, y + 13.2, { align: 'center' })
  }
  doc.setTextColor(0)
  return y + altura + 5
}

/** "37%"; valores pequenos mas não zerados aparecem como "<1%" (e não "0%"). */
function porcentagem(parte: number, total: number): string {
  const pct = (parte / (total || 1)) * 100
  return parte > 0 && pct < 0.5 ? '<1%' : `${Math.round(pct)}%`
}

/** Barras horizontais: rótulo, barra, valor e porcentagem do total. */
function desenharBarras(doc: jsPDF, itens: ItemPagamento[], x: number, y: number, largura: number): number {
  const total = itens.reduce((a, i) => a + i.valor, 0) || 1
  const maior = itens[0]?.valor || 1
  const lRotulo = 46
  const lValor = 30
  const lPct = 13
  const lBarra = largura - lRotulo - lValor - lPct - 4
  for (const item of itens) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(40)
    doc.text(item.rotulo, x, y + 3.8)
    doc.setFillColor(238, 238, 240)
    doc.roundedRect(x + lRotulo, y, lBarra, 5, 1.2, 1.2, 'F')
    doc.setFillColor(...COR_ACCENT)
    doc.roundedRect(x + lRotulo, y, Math.max(1.5, (lBarra * item.valor) / maior), 5, 1.2, 1.2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.text(formatarMoeda(item.valor), x + lRotulo + lBarra + 2 + lValor, y + 3.8, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(130)
    doc.text(porcentagem(item.valor, total), x + largura, y + 3.8, { align: 'right' })
    y += 7.5
  }
  doc.setDrawColor(225)
  doc.setLineWidth(0.2)
  doc.line(x, y - 1.5, x + largura, y - 1.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20)
  doc.text('Total', x, y + 3)
  doc.text(formatarMoeda(somaCentavos(itens.map((i) => i.valor))), x + lRotulo + lBarra + 2 + lValor, y + 3, { align: 'right' })
  doc.setTextColor(0)
  return y + 7
}

/**
 * Gráfico de colunas (vendas de cada dia), uma cor só, com linhas de média
 * do mês e do mês anterior e legenda embaixo. Devolve o y abaixo do gráfico.
 */
function desenharColunas(
  doc: jsPDF,
  g: { dias: { data: string; vendas: number | null }[]; mediaAtual: number; mediaAnterior?: number | null; rotuloAnterior?: string; rotuloMedia?: string },
  x: number,
  y: number,
  largura: number,
  altura: number,
): number {
  const esq = 14
  const base = 6
  const larguraPlot = largura - esq
  const alturaPlot = altura - base
  const maximo = Math.max(...g.dias.map((d) => d.vendas ?? 0), g.mediaAtual, g.mediaAnterior ?? 0)
  const bruto = maximo / 3 || 1
  const mag = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) ?? 10 * mag
  const topo = Math.ceil(maximo / passo) * passo || passo
  const yv = (v: number) => y + alturaPlot - (v / topo) * alturaPlot
  const rotulo = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(Math.round(v)))

  // grade
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  for (let v = 0; v <= topo + 0.001; v += passo) {
    doc.setDrawColor(v === 0 ? 200 : 232)
    doc.setLineWidth(v === 0 ? 0.3 : 0.15)
    doc.line(x + esq, yv(v), x + largura, yv(v))
    doc.setTextColor(150)
    doc.text(rotulo(v), x + esq - 1.5, yv(v) + 1, { align: 'right' })
  }

  // colunas
  const slot = larguraPlot / Math.max(g.dias.length, 1)
  const larguraBarra = Math.min(8, Math.max(0.8, slot - 0.8)) // no máximo 8 mm, mesmo com poucos dias
  g.dias.forEach((d, i) => {
    const xb = x + esq + slot * i + (slot - larguraBarra) / 2
    if (d.vendas && d.vendas > 0) {
      const h = Math.max(0.4, yv(0) - yv(d.vendas))
      doc.setFillColor(...COR_ACCENT)
      doc.roundedRect(xb, yv(0) - h, larguraBarra, h, Math.min(0.6, larguraBarra / 2), Math.min(0.6, larguraBarra / 2), 'F')
      doc.rect(xb, yv(0) - Math.min(h, 0.8), larguraBarra, Math.min(h, 0.8), 'F') // base reta
    } else if (d.vendas === null) {
      doc.setDrawColor(190)
      doc.setLineWidth(0.3)
      doc.line(xb + larguraBarra / 2, yv(0) - 1.2, xb + larguraBarra / 2, yv(0))
    }
    const dia = Number(d.data.slice(8, 10))
    const poucos = g.dias.length <= 7
    if (poucos || dia === 1 || dia % 5 === 0) {
      doc.setTextColor(150)
      doc.setFontSize(7)
      const rotulo = poucos ? `${DIAS_CURTOS[diaSemanaNumero(d.data)]} ${dia}` : String(dia)
      doc.text(rotulo, x + esq + slot * i + slot / 2, y + altura - 1.5, { align: 'center' })
    }
  })

  // médias
  const linhaMedia = (v: number, cor: number, padrao: number[]) => {
    doc.setDrawColor(cor)
    doc.setLineWidth(0.35)
    doc.setLineDashPattern(padrao, 0)
    doc.line(x + esq, yv(v), x + largura, yv(v))
    doc.setLineDashPattern([], 0)
  }
  if (g.mediaAnterior) linhaMedia(g.mediaAnterior, 150, [0.6, 1])
  if (g.mediaAtual > 0) linhaMedia(g.mediaAtual, 40, [2, 1.2])

  // legenda
  let ly = y + altura + 4.5
  let lx = x + esq
  doc.setFontSize(8)
  doc.setTextColor(90)
  doc.setFillColor(...COR_ACCENT)
  doc.rect(lx, ly - 2.4, 2.6, 2.6, 'F')
  doc.text('Vendas do dia', lx + 4, ly)
  lx += 30
  if (g.mediaAtual > 0) {
    linhaMediaLegenda(doc, lx, ly - 1, 40, [2, 1.2])
    doc.text(`${g.rotuloMedia ?? 'Média do mês'} ${formatarMoeda(g.mediaAtual)}`, lx + 8, ly)
    lx += 58
  }
  if (g.mediaAnterior) {
    linhaMediaLegenda(doc, lx, ly - 1, 150, [0.6, 1])
    const ant = g.rotuloAnterior ?? 'mês anterior'
    doc.text(`Média ${/^semana/.test(ant) ? 'da' : 'de'} ${ant} ${formatarMoeda(g.mediaAnterior)}`, lx + 8, ly)
  }
  doc.setTextColor(0)
  ly += 3
  return ly
}

/** Sobra (azul, para cima) e falta (vermelho, para baixo) de cada dia. */
function desenharSobraFalta(
  doc: jsPDF,
  dias: { data: string; vendas: number | null; diferenca?: number }[],
  x: number,
  y: number,
  largura: number,
  altura: number,
): number {
  const esq = 14
  const base = 6
  const larguraPlot = largura - esq
  const alturaPlot = altura - base
  const maior = Math.max(...dias.map((d) => Math.abs(d.diferenca ?? 0)), 1)
  const meio = y + alturaPlot / 2
  const yv = (v: number) => meio - (v / maior) * (alturaPlot / 2)
  const AZUL: [number, number, number] = [42, 120, 214]
  const VERMELHO: [number, number, number] = [227, 73, 72]
  const fmt = (v: number) => {
    const a = Math.abs(v)
    return `${v < 0 ? '-' : v > 0 ? '+' : ''}${a >= 1000 ? `${(a / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : Math.round(a)}`
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  for (const v of [maior, 0, -maior]) {
    doc.setDrawColor(v === 0 ? 190 : 232)
    doc.setLineWidth(v === 0 ? 0.3 : 0.15)
    doc.line(x + esq, yv(v), x + largura, yv(v))
    doc.setTextColor(150)
    doc.text(v === 0 ? '0' : fmt(v), x + esq - 1.5, yv(v) + 1, { align: 'right' })
  }
  const slot = larguraPlot / Math.max(dias.length, 1)
  const barra = Math.min(6.4, Math.max(0.8, slot - 0.8))
  const poucos = dias.length <= 7
  dias.forEach((d, i) => {
    const xb = x + esq + slot * i + (slot - barra) / 2
    const v = d.diferenca
    if (v !== undefined && d.vendas !== null && Math.abs(v) >= 0.005) {
      const h = Math.max(0.4, Math.abs(yv(v) - meio))
      doc.setFillColor(...(v > 0 ? AZUL : VERMELHO))
      doc.rect(xb, v > 0 ? meio - h : meio, barra, h, 'F')
    } else if (v !== undefined && d.vendas !== null) {
      doc.setFillColor(22, 130, 70)
      doc.circle(xb + barra / 2, meio, 0.6, 'F')
    }
    const dia = Number(d.data.slice(8, 10))
    if (poucos || dia === 1 || dia % 5 === 0) {
      doc.setTextColor(150)
      doc.setFontSize(7)
      doc.text(poucos ? `${DIAS_CURTOS[diaSemanaNumero(d.data)]} ${dia}` : String(dia), x + esq + slot * i + slot / 2, y + altura - 1.5, { align: 'center' })
    }
  })
  const ly = y + altura + 4.5
  let lx = x + esq
  doc.setFontSize(8)
  doc.setTextColor(90)
  for (const [cor, texto] of [[AZUL, 'Sobrou'], [VERMELHO, 'Faltou']] as const) {
    doc.setFillColor(...cor)
    doc.rect(lx, ly - 2.4, 2.6, 2.6, 'F')
    doc.text(texto, lx + 4, ly)
    lx += 22
  }
  doc.setFillColor(22, 130, 70)
  doc.circle(lx + 1.3, ly - 1.1, 0.9, 'F')
  doc.text('Fechou certinho', lx + 4, ly)
  doc.setTextColor(0)
  return ly + 3
}

function linhaMediaLegenda(doc: jsPDF, x: number, y: number, cor: number, padrao: number[]) {
  doc.setDrawColor(cor)
  doc.setLineWidth(0.4)
  doc.setLineDashPattern(padrao, 0)
  doc.line(x, y, x + 6, y)
  doc.setLineDashPattern([], 0)
}

/** Lista com marcadores, quebrando linha e página quando precisa. */
function listaComMarcadores(
  doc: jsPDF,
  itens: string[],
  x: number,
  y: number,
  largura: number,
  quebra: (altura: number, y: number) => number,
): number {
  let atual = y
  for (const item of itens) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(30)
    const linhas = doc.splitTextToSize(item, largura - 5)
    atual = quebra(linhas.length * 4.8 + 1.5, atual)
    doc.setFillColor(...COR_ACCENT)
    doc.circle(x + 1.2, atual - 1.2, 0.8, 'F')
    doc.text(linhas, x + 4.5, atual)
    atual += linhas.length * 4.8 + 1.5
  }
  doc.setTextColor(0)
  return atual
}

/** Função de quebra de página: devolve o y a usar (18 se pulou de página). */
function criarQuebra(doc: jsPDF) {
  return (altura: number, yAtual: number) => {
    if (yAtual + altura > 278) {
      doc.addPage()
      return 18
    }
    return yAtual
  }
}

function tabelaPratos(doc: jsPDF, vendas: [string, number][], margem: number, y: number): number {
  const total = vendas.reduce((a, [, q]) => a + q, 0) || 1
  autoTable(doc, {
    startY: y,
    margin: { left: margem, right: margem },
    head: [['Prato', { content: 'Quantidade', styles: { halign: 'right' } }, { content: '% do total', styles: { halign: 'right' } }]],
    body: vendas.map(([prato, qtd]) => [prato, String(qtd), porcentagem(qtd, total)]),
    foot: [['TOTAL', { content: String(total), styles: { halign: 'right' } }, { content: '100%', styles: { halign: 'right' } }]],
    styles: { fontSize: 9.5, cellPadding: 1.6 },
    headStyles: { fillColor: [60, 60, 64] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
  })
  return finalY(doc) + 6
}

function rodapePaginas(doc: jsPDF, margem: number, texto: string) {
  const total = doc.getNumberOfPages()
  const gerado = `Gerado em ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setDrawColor(230)
    doc.setLineWidth(0.2)
    doc.line(margem, 287, 210 - margem, 287)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(140)
    doc.text(texto, margem, 291.5)
    doc.text(`${gerado} · página ${p} de ${total}`, 210 - margem, 291.5, { align: 'right' })
    doc.setTextColor(0)
  }
}

function mesmasSangrias(a: Sangria[], b: Sangria[]): boolean {
  const chave = (l: Sangria[]) =>
    l.map((s) => `${Math.round(s.valor * 100)}|${s.motivo.trim().toLowerCase()}`).sort().join(';')
  return chave(a) === chave(b)
}

/**
 * PDF do dia para os patrões (e WhatsApp): página 1 com o resumo em
 * linguagem simples; depois os detalhes para conferência e, por fim,
 * os prints anexados (cada um numa página).
 */
export async function gerarPdfWhatsApp(params: {
  relatorio: RelatorioDiario
  fechamentos: Fechamento[]
  imagens?: (string | null | undefined)[]
  compartilhar?: boolean
}): Promise<ResultadoEntrega> {
  const { relatorio: rel, fechamentos, imagens = [], compartilhar } = params
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margem = 16
  const larguraUtil = 210 - margem * 2
  const dataLonga = `${DIAS_SEMANA[diaSemanaNumero(rel.data)]}, ${formatarData(rel.data)}`
  let y = cabecalhoComLogo(doc, margem, 'Relatório do dia', dataLonga)

  const quebra = criarQuebra(doc)
  const garantir = (altura: number) => {
    y = quebra(altura, y)
  }

  // ---------- Página 1: resumo ----------
  const totalCaixa = somaCentavos(fechamentos.map((f) => f.resultado.totalCaixa))
  const totalSistema = somaCentavos(fechamentos.map((f) => f.resultado.totalSistema))
  const diferenca = somaCentavos(fechamentos.map((f) => f.resultado.diferencaFinal))
  const ajuste = somaCentavos(fechamentos.map((f) => f.resultado.ajusteAplicado))
  // As sangrias agora são lançadas no relatório; fechamentos antigos podem ter as suas.
  const sangriasDoFechamento = fechamentos.flatMap((f) => f.sangrias)
  const sangrias = rel.sangrias.length > 0 ? rel.sangrias : sangriasDoFechamento
  const totalSangrias = somaCentavos(sangrias.map((s) => s.valor))
  const marmitas = fechamentos.reduce((acc, f) => acc + totalMarmitas(f.marmitas), 0)

  if (fechamentos.length === 0) {
    y = faixaSituacao(doc, margem, y, larguraUtil, 'SEM FECHAMENTO DE CAIXA', null, 'O fechamento de caixa deste dia não foi salvo no sistema.')
  } else {
    const s = situacaoDoCaixa(diferenca, ajuste)
    y = faixaSituacao(doc, margem, y, larguraUtil, s.titulo, s.status, s.frase)
  }

  const cards = [
    { label: 'Vendas no caixa', valor: formatarMoeda(totalCaixa) },
    { label: 'Registrado no sistema', valor: formatarMoeda(totalSistema) },
    { label: 'Marmitas vendidas', valor: String(marmitas || rel.quantidadeVendida || 0) },
    { label: 'Retiradas (sangrias)', valor: formatarMoeda(totalSangrias) },
  ]
  const larguraCard = (larguraUtil - 3 * 4) / 4
  cards.forEach((c, i) =>
    desenharCardResumo(doc, { x: margem + i * (larguraCard + 4), y, largura: larguraCard, altura: 18, label: c.label, valor: c.valor }),
  )
  y += 24

  const pagamentos = formasDePagamento(fechamentos)
  if (pagamentos.length > 0) {
    y = tituloSecaoPdf(doc, 'Como o dinheiro entrou', y, margem, larguraUtil)
    y = desenharBarras(doc, pagamentos, margem, y, larguraUtil)
    const dinheiroBrendi = somaCentavos(fechamentos.map((f) => f.brendi.dinheiro))
    if (dinheiroBrendi > 0) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.setTextColor(120)
      doc.text(
        doc.splitTextToSize(
          `O dinheiro recebido pelo Brendi (${formatarMoeda(dinheiroBrendi)}) não está nas vendas do caixa: ele entra só na conferência com o sistema.`,
          larguraUtil,
        ),
        margem,
        y,
      )
      doc.setTextColor(0)
      y += 9
    } else {
      y += 2
    }
  }

  // Destaques do dia
  const destaques: string[] = []
  if (sangrias.length > 0) {
    destaques.push(
      `Retiradas do caixa (sangrias): ${formatarMoeda(totalSangrias)} — ` +
        sangrias.map((s) => `${s.motivo || 'sem motivo'} (${formatarMoeda(s.valor)})`).join('; ') + '.',
    )
  }
  for (const f of fechamentos) {
    if (f.ajuste.tipo && f.resultado.ajusteAplicado !== 0) {
      destaques.push(`Ajuste manual no caixa: ${f.resultado.ajusteAplicado > 0 ? '+' : '-'}${formatarMoeda(Math.abs(f.resultado.ajusteAplicado))}.`)
    }
    if (f.observacoes.trim()) destaques.push(`Observação do caixa: ${f.observacoes.trim()}`)
  }
  if (rel.estragou.length > 0) destaques.push(`Perdas (estragou): ${rel.estragou.join('; ')}.`)
  const consumoFunc = somaCentavos(rel.consumoLojaMensal.map((c) => c.valor))
  const consumoMoto = somaCentavos(rel.consumoLojaMotoboys.map((c) => c.valor))
  const cortesias = somaCentavos(rel.cortesiaClientes.map((c) => c.valor))
  const partesConsumo = [
    consumoFunc > 0 ? `funcionários ${formatarMoeda(consumoFunc)}` : '',
    consumoMoto > 0 ? `motoboys ${formatarMoeda(consumoMoto)}` : '',
    cortesias > 0 ? `cortesias a clientes ${formatarMoeda(cortesias)}` : '',
  ].filter(Boolean)
  if (partesConsumo.length) destaques.push(`Consumo e cortesias: ${partesConsumo.join(' · ')} (detalhes na página seguinte).`)
  if (rel.funcionariosQueComeram.length > 0) destaques.push(`Funcionários que comeram na loja: ${rel.funcionariosQueComeram.join(', ')}.`)
  if (destaques.length === 0) destaques.push('Nenhuma ocorrência fora do normal registrada.')

  garantir(20)
  y = tituloSecaoPdf(doc, 'Destaques do dia', y, margem, larguraUtil)
  y = listaComMarcadores(doc, destaques, margem, y + 1, larguraUtil, quebra)
  y += 3

  const vendasPorPrato = agregarVendasPorPrato(fechamentos)
  if (vendasPorPrato.length > 0) {
    garantir(22 + vendasPorPrato.length * 6)
    y = tituloSecaoPdf(doc, 'Marmitas vendidas por prato', y, margem, larguraUtil)
    y = tabelaPratos(doc, vendasPorPrato, margem, y)
  }

  // ---------- Detalhes para conferência ----------
  doc.addPage()
  y = 18
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...COR_ESCURO)
  doc.text('Detalhes para conferência', margem, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(`${formatarData(rel.data)} · valores zerados não aparecem`, 210 - margem, y, { align: 'right' })
  doc.setTextColor(0)
  y += 6

  const linha = (rotulo: string, valor: number): [string, string] => [rotulo, formatarMoeda(valor)]
  const semZero = (linhas: { r: string; v: number }[]) => linhas.filter((l) => l.v !== 0).map((l) => linha(l.r, l.v))

  fechamentos.forEach((f) => {
    const sufixo = fechamentos.length > 1 ? ` — ${TURNO_LABEL[f.turno]}` : ''
    garantir(60)
    y = tituloSecaoPdf(doc, `Conferência do caixa${sufixo}`, y, margem, larguraUtil)
    const conf: [string, string][] = [
      linha('Vendas no caixa (Caixa LC + Brendi)', f.resultado.totalCaixa),
      linha('Total no sistema do LC (computador)', f.totalLCSistema),
      linha('+ Brendi (cartões e PIX)', f.resultado.totalBrendi),
      linha('+ Dinheiro recebido pelo Brendi', f.brendi.dinheiro),
      linha('= Total registrado no sistema', f.resultado.totalSistema),
      linha('Diferença (caixa - sistema)', f.resultado.diferencaOriginal),
    ]
    if (f.ajuste.tipo && f.resultado.ajusteAplicado !== 0) conf.push(linha('Ajuste manual', f.resultado.ajusteAplicado))
    conf.push([`Diferença final — ${STATUS_LABEL[f.resultado.status]}`, formatarMoeda(f.resultado.diferencaFinal)])
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      theme: 'plain',
      body: conf,
      styles: { fontSize: 9.5, cellPadding: { top: 1.2, bottom: 1.2, left: 2, right: 2 } },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data) => {
        const ultima = data.row.index === conf.length - 1
        if (data.row.index === 0 || data.row.index === 4 || ultima) data.cell.styles.fontStyle = 'bold'
        if (data.row.index % 2 === 1) data.cell.styles.fillColor = [248, 248, 249]
        if (ultima) {
          data.cell.styles.textColor = COR_STATUS[f.resultado.status]
          data.cell.styles.fillColor = [242, 242, 244]
        }
      },
    })
    y = finalY(doc) + 5

    // LC e Brendi lado a lado
    garantir(60)
    const meia = (larguraUtil - 6) / 2
    const lc = semZero([
      { r: 'Dinheiro', v: f.lc.dinheiroFechamento },
      { r: 'PIX', v: f.lc.pix },
      { r: 'Cartão de débito', v: f.lc.debito },
      { r: 'Cartão de crédito', v: f.lc.credito },
      { r: 'Ticket', v: f.lc.ticket },
      { r: 'Consumo da loja', v: f.lc.consumoLoja },
      { r: 'A prazo', v: f.lc.aPrazo },
    ])
    const brendi = semZero([
      { r: 'PIX', v: f.brendi.pix },
      { r: 'Cartão de débito', v: f.brendi.debito },
      { r: 'Cartão de crédito', v: f.brendi.credito },
      { r: 'Crédito online', v: f.brendi.creditoOnline },
    ])
    const inicio = y
    const tabelaLado = (titulo: string, corpo: [string, string][], total: number, esquerda: number, extra?: string) => {
      autoTable(doc, {
        startY: inicio,
        margin: { left: esquerda, right: 210 - esquerda - meia },
        tableWidth: meia,
        head: [[titulo, { content: '', styles: { halign: 'right' } }]],
        body: corpo.length ? corpo : [['(sem valores)', '']],
        foot: [[`Total ${titulo}`, { content: formatarMoeda(total), styles: { halign: 'right' } }]],
        styles: { fontSize: 9, cellPadding: 1.4 },
        headStyles: { fillColor: [60, 60, 64] },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right' } },
      })
      let fim = finalY(doc)
      if (extra) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.setTextColor(120)
        const l = doc.splitTextToSize(extra, meia)
        doc.text(l, esquerda, fim + 4)
        doc.setTextColor(0)
        fim += 3 + l.length * 3.6
      }
      return fim
    }
    const fimLc = tabelaLado(
      'Caixa LC',
      lc,
      f.resultado.totalLC,
      margem,
      f.lc.dinheiroAbertura ? `Troco de abertura: ${formatarMoeda(f.lc.dinheiroAbertura)} (não entra no total).` : undefined,
    )
    const fimBrendi = tabelaLado(
      'Brendi',
      brendi,
      f.resultado.totalBrendi,
      margem + meia + 6,
      f.brendi.dinheiro ? `Dinheiro do Brendi: ${formatarMoeda(f.brendi.dinheiro)} (vai só para o sistema).` : undefined,
    )
    y = Math.max(fimLc, fimBrendi) + 6

    if (f.sangrias.length > 0) {
      garantir(25)
      autoTable(doc, {
        startY: y,
        margin: { left: margem, right: margem },
        head: [['Retirada do caixa (sangria) — motivo', { content: 'Valor', styles: { halign: 'right' } }]],
        body: f.sangrias.map((s) => [s.motivo || '—', formatarMoeda(s.valor)]),
        foot: [['Total retirado', { content: formatarMoeda(somaCentavos(f.sangrias.map((s) => s.valor))), styles: { halign: 'right' } }]],
        styles: { fontSize: 9, cellPadding: 1.4 },
        headStyles: { fillColor: [90, 90, 95] },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right' } },
      })
      y = finalY(doc) + 6
    }
  })

  // Relatório escrito
  const consumo = [
    ...rel.consumoLojaMensal.map((c) => ['Funcionário', c] as const),
    ...rel.consumoLojaMotoboys.map((c) => ['Motoboy', c] as const),
    ...rel.cortesiaClientes.map((c) => ['Cortesia', c] as const),
  ]
  if (consumo.length > 0) {
    garantir(30)
    y = tituloSecaoPdf(doc, 'Consumo e cortesias', y, margem, larguraUtil)
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      head: [['Tipo', 'Quem', 'O que', { content: 'Valor', styles: { halign: 'right' } }]],
      body: consumo.map(([tipo, c]: readonly [string, ConsumoItem]) => [tipo, c.pessoa || '—', c.item || '—', formatarMoeda(c.valor)]),
      foot: [['Total', '', '', { content: formatarMoeda(somaCentavos(consumo.map(([, c]) => c.valor))), styles: { halign: 'right' } }]],
      styles: { fontSize: 9, cellPadding: 1.4 },
      headStyles: { fillColor: [90, 90, 95] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 3: { halign: 'right' } },
    })
    y = finalY(doc) + 6
  }

  if (rel.sangrias.length > 0 && !mesmasSangrias(rel.sangrias, sangriasDoFechamento)) {
    garantir(25)
    y = tituloSecaoPdf(doc, 'Retiradas do caixa (sangrias)', y, margem, larguraUtil)
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      head: [['Motivo', { content: 'Valor', styles: { halign: 'right' } }]],
      body: rel.sangrias.map((s) => [s.motivo || '—', formatarMoeda(s.valor)]),
      foot: [['Total retirado', { content: formatarMoeda(somaCentavos(rel.sangrias.map((s) => s.valor))), styles: { halign: 'right' } }]],
      styles: { fontSize: 9, cellPadding: 1.4 },
      headStyles: { fillColor: [90, 90, 95] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } },
    })
    y = finalY(doc) + 6
  }

  const contagem: string[] = []
  if (rel.aberturaCaixa || rel.fechamentoCaixa) {
    contagem.push(`Dinheiro contado no relatório: abertura ${formatarMoeda(rel.aberturaCaixa)} · fechamento ${formatarMoeda(rel.fechamentoCaixa)}.`)
  }
  if (rel.quantidadeVendida) contagem.push(`Quantidade vendida anotada no relatório: ${rel.quantidadeVendida}.`)
  if (contagem.length) {
    garantir(15)
    y = listaComMarcadores(doc, contagem, margem, y + 2, larguraUtil, quebra) + 2
  }

  const estoque = rel.estoqueQuente.itens.filter((i) => i.quantidade > 0)
  if (estoque.length > 0) {
    garantir(25)
    y = tituloSecaoPdf(doc, 'Estoque de bebidas (contagem)', y, margem, larguraUtil)
    const pares: string[][] = []
    for (let i = 0; i < estoque.length; i += 2) {
      const a = estoque[i]
      const b = estoque[i + 1]
      pares.push([a.produto, String(a.quantidade), b?.produto ?? '', b ? String(b.quantidade) : ''])
    }
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      head: [['Produto', { content: 'Qtd.', styles: { halign: 'right' } }, 'Produto', { content: 'Qtd.', styles: { halign: 'right' } }]],
      body: pares,
      styles: { fontSize: 9, cellPadding: 1.4 },
      headStyles: { fillColor: [90, 90, 95] },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 3: { halign: 'right', fontStyle: 'bold' } },
    })
    y = finalY(doc) + 6
  }

  // ---------- Anexos (prints) ----------
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
    const alturaDisp = 297 - margemAnexo * 2 - 18
    const escala = Math.min(larguraDisp / largura, alturaDisp / altura, 1)
    const wFinal = largura * escala
    const hFinal = altura * escala
    const xFinal = (210 - wFinal) / 2
    const formato = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
    doc.addImage(dataUrl, formato, xFinal, margemAnexo + 10, wFinal, hFinal)
  }

  rodapePaginas(doc, margem, `Mapa Burger — Relatório do dia ${formatarData(rel.data)}`)
  const [a, m, d] = rel.data.split('-')
  return entregarPdf(doc, `Mapa-Burger_relatorio-do-dia_${d}-${m}-${a}.pdf`, compartilhar)
}

// ============================================================
// PDF mensal de Vales — resumo do mês + extrato por funcionário
// com linha de assinatura (comprovante do adiantamento salarial).
// ============================================================

export interface GrupoValesPdf {
  funcionario: string
  total: number
  quantidade: number
  vales: { data: string; valor: number; observacao: string }[]
}

function agoraFormatado(): string {
  return new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function cabecalhoVales(doc: jsPDF, titulo: string, subtitulo: string, margem: number): number {
  doc.setFillColor(...COR_ACCENT)
  doc.rect(margem, 12, 2.2, 13, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...COR_ESCURO)
  doc.text('MAPA BURGER', margem + 5, 17)
  doc.setFontSize(11)
  doc.text(titulo, margem + 5, 23)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(110)
  doc.text(subtitulo, 210 - margem, 17, { align: 'right' })
  doc.setTextColor(0)
  return 32
}

/**
 * Gera o PDF dos vales do mês.
 * - Página 1: total por funcionário (o que descontar na folha).
 * - Uma página por funcionário: cada vale, total e assinatura.
 * Com `somenteExtratos`, gera só as páginas por funcionário (ex.: um funcionário só).
 */
export function gerarPdfValesMensal(params: {
  mes: string // YYYY-MM
  grupos: GrupoValesPdf[]
  fechadoEm?: string | null
  somenteExtratos?: boolean
}): void {
  const { mes, grupos, fechadoEm, somenteExtratos } = params
  const [ano, m] = mes.split('-')
  const mesLabel = `${m}/${ano}`
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margem = 14
  const situacao = fechadoEm
    ? `Mês FECHADO em ${new Date(fechadoEm).toLocaleDateString('pt-BR')}`
    : 'Mês em aberto (valores podem mudar)'
  const subtitulo = `Gerado em ${agoraFormatado()}`

  const totalMesCentavos = grupos.reduce((acc, g) => acc + Math.round(g.total * 100), 0)
  const qtdMes = grupos.reduce((acc, g) => acc + g.quantidade, 0)

  if (!somenteExtratos) {
    let y = cabecalhoVales(doc, `Vales (adiantamento salarial) — ${mesLabel}`, subtitulo, margem)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(situacao, margem, y)
    y += 4

    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      head: [[
        'Funcionário',
        { content: 'Qtd. de vales', styles: { halign: 'center' } },
        { content: 'Total a descontar', styles: { halign: 'right' } },
      ]],
      body: grupos.map((g) => [g.funcionario, String(g.quantidade), formatarMoeda(g.total)]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: COR_ESCURO },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right', fontStyle: 'bold' } },
      foot: [[
        'TOTAL GERAL',
        { content: String(qtdMes), styles: { halign: 'center' } },
        { content: formatarMoeda(totalMesCentavos / 100), styles: { halign: 'right' } },
      ]],
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    })
  }

  grupos.forEach((g, i) => {
    if (!somenteExtratos || i > 0) doc.addPage()
    let y = cabecalhoVales(doc, `Extrato de vales — ${mesLabel}`, subtitulo, margem)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(g.funcionario, margem, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(situacao, 210 - margem, y, { align: 'right' })
    y += 4

    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      head: [['Data', { content: 'Valor', styles: { halign: 'right' } }, 'Observação']],
      body: g.vales.map((v) => [formatarData(v.data), formatarMoeda(v.valor), v.observacao || '-']),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [90, 90, 95] },
      columnStyles: { 0: { cellWidth: 28 }, 1: { halign: 'right', cellWidth: 32 } },
      foot: [[
        `${g.quantidade} vale(s)`,
        { content: formatarMoeda(g.total), styles: { halign: 'right' } },
        'TOTAL A DESCONTAR',
      ]],
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    })

    y = finalY(doc) + 12
    if (y > 240) {
      doc.addPage()
      y = 30
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    const declaracao =
      `Declaro que recebi os valores acima, no total de ${formatarMoeda(g.total)}, a título de ` +
      `adiantamento salarial (vale) referente a ${mesLabel}, e autorizo o desconto desse valor no meu salário.`
    const linhas = doc.splitTextToSize(declaracao, 210 - margem * 2)
    doc.text(linhas, margem, y)
    y += linhas.length * 4.6 + 22

    doc.setDrawColor(60)
    doc.setLineWidth(0.3)
    doc.line(margem, y, margem + 95, y)
    doc.line(210 - margem - 50, y, 210 - margem, y)
    doc.setFontSize(8.5)
    doc.setTextColor(90)
    doc.text(`Assinatura — ${g.funcionario}`, margem, y + 4.5)
    doc.text('Data', 210 - margem - 50, y + 4.5)
    doc.setTextColor(0)
  })

  // Rodapé com página em todas as folhas
  const totalPaginas = doc.getNumberOfPages()
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p)
    doc.setDrawColor(230)
    doc.setLineWidth(0.2)
    doc.line(margem, 289, 210 - margem, 289)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(140)
    doc.text(`Mapa Burger — Vales ${mesLabel}`, margem, 293.5)
    doc.text(`${p} / ${totalPaginas}`, 210 - margem, 293.5, { align: 'right' })
    doc.setTextColor(0)
  }

  const sufixo = somenteExtratos && grupos.length === 1 ? `_${slugify(grupos[0].funcionario)}` : ''
  doc.save(`vales_${mes}${sufixo}.pdf`)
}

// ============================================================
// PDF do Acerto do mês — resumo + uma página por funcionário
// (vales + consumo) com declaração e assinatura.
// ============================================================

export interface LinhaAcertoPdf {
  funcionario: string
  totalVales: number
  totalConsumo: number
  total: number
  vales: { data: string; valor: number; observacao: string }[]
  consumo: { data: string; item: string; valor: number }[]
}

export async function gerarPdfAcerto(params: {
  mes: string // YYYY-MM
  linhas: LinhaAcertoPdf[]
  fechadoEm?: string | null
  somenteExtratos?: boolean
  compartilhar?: boolean
}): Promise<ResultadoEntrega> {
  const { mes, linhas, fechadoEm, somenteExtratos, compartilhar } = params
  const [ano, m] = mes.split('-')
  const mesLabel = `${m}/${ano}`
  const nomeMes = NOMES_MES[Number(m) - 1] ?? m
  const mesExtenso = `${nomeMes.charAt(0).toUpperCase()}${nomeMes.slice(1)} de ${ano}`
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margem = 16
  const larguraUtil = 210 - margem * 2
  const situacao = fechadoEm
    ? `Acerto FECHADO em ${new Date(fechadoEm).toLocaleDateString('pt-BR')}`
    : 'Acerto em aberto (os valores ainda podem mudar)'

  const totalVales = somaCentavos(linhas.map((l) => l.totalVales))
  const totalConsumo = somaCentavos(linhas.map((l) => l.totalConsumo))
  const total = somaCentavos(linhas.map((l) => l.total))

  if (!somenteExtratos) {
    let y = cabecalhoComLogo(doc, margem, 'Acerto do mês', `${mesExtenso} · vales + consumo na loja`)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(90)
    doc.text(situacao, margem, y)
    doc.setTextColor(0)
    y += 5
    const cards = [
      { label: 'Total a descontar', valor: formatarMoeda(total), destaque: true },
      { label: 'Vales', valor: formatarMoeda(totalVales) },
      { label: 'Consumo na loja', valor: formatarMoeda(totalConsumo) },
      { label: 'Funcionários', valor: String(linhas.length) },
    ]
    const larguraCard = (larguraUtil - 3 * 4) / 4
    cards.forEach((c, i) =>
      desenharCardResumo(doc, { x: margem + i * (larguraCard + 4), y, largura: larguraCard, altura: 18, label: c.label, valor: c.valor, destaque: c.destaque }),
    )
    y += 24
    y = tituloSecaoPdf(doc, 'Quanto descontar de cada um', y, margem, larguraUtil)
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      head: [[
        'Funcionário',
        { content: 'Vales', styles: { halign: 'right' } },
        { content: 'Consumo', styles: { halign: 'right' } },
        { content: 'Total a descontar', styles: { halign: 'right' } },
      ]],
      body: linhas.map((l) => [l.funcionario, formatarMoeda(l.totalVales), formatarMoeda(l.totalConsumo), formatarMoeda(l.total)]),
      foot: [[
        'TOTAL',
        { content: formatarMoeda(totalVales), styles: { halign: 'right' } },
        { content: formatarMoeda(totalConsumo), styles: { halign: 'right' } },
        { content: formatarMoeda(total), styles: { halign: 'right' } },
      ]],
      styles: { fontSize: 10, cellPadding: 2 },
      headStyles: { fillColor: COR_ESCURO },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
    })
    y = finalY(doc) + 6
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8.5)
    doc.setTextColor(120)
    doc.text(
      doc.splitTextToSize(
        'Vales = adiantamentos de salário. Consumo na loja = o que o funcionário consumiu e foi anotado no relatório do dia. ' +
          'Nas páginas seguintes, o detalhe de cada funcionário com espaço para assinatura.',
        larguraUtil,
      ),
      margem,
      y,
    )
    doc.setTextColor(0)
  }

  linhas.forEach((l, i) => {
    if (!somenteExtratos || i > 0) doc.addPage()
    let y = cabecalhoComLogo(doc, margem, 'Acerto do mês', mesExtenso)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...COR_ESCURO)
    doc.text(l.funcionario, margem, y + 1)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text(situacao, 210 - margem, y + 1, { align: 'right' })
    doc.setTextColor(0)
    y += 7

    const tabela = (titulo: string, cabecalho: string[], corpo: string[][], totalTabela: number) => {
      autoTable(doc, {
        startY: y,
        margin: { left: margem, right: margem },
        head: [[...cabecalho.slice(0, -1), { content: cabecalho[cabecalho.length - 1], styles: { halign: 'right' } }]],
        body: corpo.length ? corpo : [['—', 'Nenhum lançamento', '']],
        foot: [[{ content: `Total ${titulo}`, colSpan: 2 }, { content: formatarMoeda(totalTabela), styles: { halign: 'right' } }]],
        styles: { fontSize: 9.5, cellPadding: 1.6 },
        headStyles: { fillColor: [60, 60, 64] },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 26 }, 2: { halign: 'right', cellWidth: 32 } },
      })
      y = finalY(doc) + 5
    }
    tabela(
      'de vales',
      ['Data', 'Vale (adiantamento)', 'Valor'],
      l.vales.map((v) => [formatarData(v.data), v.observacao || 'Vale', formatarMoeda(v.valor)]),
      l.totalVales,
    )
    tabela(
      'de consumo',
      ['Data', 'Consumo na loja', 'Valor'],
      l.consumo.map((c) => [formatarData(c.data), c.item || 'Consumo', formatarMoeda(c.valor)]),
      l.totalConsumo,
    )

    if (y > 225) {
      doc.addPage()
      y = 20
    }
    doc.setFillColor(...COR_ACCENT)
    doc.roundedRect(margem, y, larguraUtil, 12, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('TOTAL A DESCONTAR', margem + 5, y + 7.8)
    doc.text(formatarMoeda(l.total), 210 - margem - 5, y + 7.8, { align: 'right' })
    doc.setTextColor(0)
    y += 20

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    const declaracao =
      `Declaro que recebi os vales (adiantamentos de salário) e fiz o consumo na loja listados acima, ` +
      `referentes a ${mesLabel}, no total de ${formatarMoeda(l.total)}, e autorizo o desconto desse valor no meu salário.`
    const linhasTexto = doc.splitTextToSize(declaracao, larguraUtil)
    doc.text(linhasTexto, margem, y)
    y += linhasTexto.length * 4.6 + 22
    doc.setDrawColor(60)
    doc.setLineWidth(0.3)
    doc.line(margem, y, margem + 95, y)
    doc.line(210 - margem - 50, y, 210 - margem, y)
    doc.setFontSize(8.5)
    doc.setTextColor(90)
    doc.text(`Assinatura — ${l.funcionario}`, margem, y + 4.5)
    doc.text('Data', 210 - margem - 50, y + 4.5)
    doc.setTextColor(0)
  })

  rodapePaginas(doc, margem, `Mapa Burger — Acerto do mês ${mesLabel}`)
  const sufixo = somenteExtratos && linhas.length === 1 ? `_${slugify(linhas[0].funcionario)}` : ''
  return entregarPdf(doc, `Mapa-Burger_acerto_${m}-${ano}${sufixo}.pdf`, compartilhar)
}
