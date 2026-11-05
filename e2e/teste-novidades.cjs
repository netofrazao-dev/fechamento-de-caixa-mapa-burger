const fs = require('fs')
const { execSync } = require('child_process')
const { chromium } = require('playwright')
const { criarDb2, handle2, uid } = require('./simulacao.cjs')
const SHOTS = process.argv[2], BASE = process.env.BASE_URL || 'http://localhost:4173'
let falhas = 0
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) falhas++ }
const vercel = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))
const CSP = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value
  .replace('https://*.supabase.co wss://*.supabase.co', 'http://supabase.test').replace('; upgrade-insecure-requests', '')

function fech(data, caixa, dif = 0, extra = {}) {
  return { id: uid(), created_at: new Date().toISOString(), data, turno: 'manha', dinheiro_abertura: 150, dinheiro_fechamento: caixa, pix_lc: 0, debito_lc: 0, credito_lc: 0, consumo_loja: 0, a_prazo: 0, ticket: 0,
    pix_brendi: 0, debito_brendi: 0, credito_brendi: 0, credito_online_brendi: 0, dinheiro_brendi: 0, total_lc: caixa, total_brendi: 0, total_caixa: caixa, total_lc_sistema: caixa - dif, total_sistema: caixa - dif,
    diferenca_original: dif, ajuste_tipo: null, ajuste_valor: 0, ajuste_aplicado: 0, diferenca_final: dif, status: dif === 0 ? 'fechou' : dif > 0 ? 'sobrou' : 'faltou', observacoes: null,
    marmitas: [{ prato: 'Estrogonofe', quantidade: 20 }], ...extra }
}
const vale = (f, data, valor) => ({ id: uid(), funcionario: f.nome, funcionario_id: f.id, data, valor, observacao: null, created_at: `${data}T12:00:00Z`, updated_at: null, excluido_em: null, motivo_exclusao: null })

;(async () => {
  const db = criarDb2()
  const neto = db.funcionarios.find((f) => f.nome === 'Neto'), pam = db.funcionarios.find((f) => f.nome === 'Pâmela')
  db.fechamentos.push(fech('2026-11-01', 4000), fech('2026-11-02', 4300, -10), fech('2026-10-01', 3800), fech('2026-10-02', 3900), fech('2026-10-15', 5000, 5))
  db.vales.push(vale(neto, '2026-11-01', 100), vale(pam, '2026-11-02', 50), vale(neto, '2026-10-10', 80))
  const rid = uid()
  db.relatorios.push({ id: rid, data: '2026-11-01', created_at: '', updated_at: '', abertura_caixa: 0, fechamento_caixa: 0, quantidade_vendida: 0, estragou: [], funcionarios_que_comeram: [],
    consumo_loja_mensal: [{ pessoa: 'Pâmela', item: 'Coca', valor: 6 }, { pessoa: 'Pamelinha', item: 'Água', valor: 3 }], consumo_loja_motoboys: [], cortesia_clientes: [], sangrias: [], estoque_quente: { itens: [] }, imagem1: null, imagem2: null })

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR', timezoneId: 'America/Belem', acceptDownloads: true })
  await context.clock.setFixedTime(new Date('2026-11-03T15:15:00Z')) // 03/11/2026 12:15 (Belém): resultado igual em qualquer dia
  const page = await context.newPage()
  const erros = [], csp = []
  page.on('pageerror', (e) => erros.push(e.message))
  page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text()) })
  await context.route(`${BASE}/**`, async (route) => {
    const resp = await route.fetch(); const headers = { ...resp.headers() }
    if ((headers['content-type'] || '').includes('text/html')) headers['content-security-policy'] = CSP
    await route.fulfill({ response: resp, headers })
  })
  await context.route('http://supabase.test/**', async (route) => {
    const req = route.request(); const url = new URL(req.url())
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    let body = null; try { body = req.postData() ? JSON.parse(req.postData()) : null } catch {}
    const r = handle2(db, req.method(), url.pathname, [...url.searchParams.entries()], body, (req.headers()['accept'] || '').includes('vnd.pgrst.object'))
    await route.fulfill({ status: r.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: r.body === null ? '' : JSON.stringify(r.body) })
  })
  const texto = async () => (await page.locator('body').innerText()).replace(/ /g, ' ')
  const esperar = (t) => page.waitForFunction((x) => document.body.innerText.replace(/ /g, ' ').includes(x), t, { timeout: 10000 })
  const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true })
  const pdfTexto = async (acao, nome) => {
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), acao()])
    await d.saveAs(`${SHOTS}/${nome}`)
    return { nome: d.suggestedFilename(), texto: execSync(`pdftotext -layout ${SHOTS}/${nome} -`).toString() }
  }

  console.log('1. Tela Hoje (início)')
  await page.goto(`${BASE}/`)
  await page.getByLabel('E-mail').fill('dono@teste.com'); await page.getByLabel('Senha', { exact: true }).fill('senha-forte-123')
  await page.getByRole('button', { name: /Entrar/ }).click()
  await esperar('Fazer o fechamento de hoje')
  ok(page.url().endsWith('/hoje'), 'depois do login abre a tela Hoje')
  await esperar('Precisa de atenção')
  const th = await texto()
  ok(th.includes('Ontem (02/11) ficou sem relatório'), 'avisa: ontem sem relatório')
  ok(th.includes('acerto de outubro'), 'avisa: acerto de outubro ainda aberto')
  ok(th.includes('Novembro até agora') && th.includes('R$ 8.300,00'), 'mês até agora: R$ 8.300,00')
  ok(/▲ \+8%/.test(th), 'compara com os mesmos dias de outubro: ▲ +8% (8.300 x 7.700)')
  ok(th.includes('Vales de novembro') && th.includes('R$ 150,00'), 'vales do mês: R$ 150,00')
  ok(th.includes('Baixar cópia de segurança'), 'lembra da cópia de segurança')
  await shot('20-hoje')

  console.log('2. Acerto do mês')
  await page.goto(`${BASE}/acerto?mes=2026-11`)
  await esperar('Total a descontar em 11/2026')
  ok((await texto()).includes('R$ 156,00'), 'total: vales 150 + consumo 6 = R$ 156,00 (Pamelinha fora)')
  ok((await texto()).includes('1 consumo(s) sem funcionário identificado'), 'aponta consumo com nome que não bate')
  ok(await page.getByRole('button', { name: 'Fechar acerto do mês' }).isDisabled(), 'não deixa fechar com pendência')
  ok(await page.getByRole('link', { name: 'Vales', exact: true }).last().evaluate((a) => a.className.includes('text-gray-900')), 'aba Vales do menu fica marcada no Acerto')
  await shot('21-acerto-pendente')
  await page.getByLabel('Quem consumiu Água').selectOption({ label: 'Pâmela' })
  await page.getByRole('button', { name: 'Corrigir' }).click()
  await esperar('R$ 159,00')
  ok(!(await texto()).includes('sem funcionário identificado'), 'corrigido: Água ligada à Pâmela, total R$ 159,00')
  ok(db.relatorios[0].consumo_loja_mensal[1].funcionarioId === pam.id, 'relatório gravou o id do funcionário')
  await page.getByRole('button', { name: /Pâmela/ }).click()
  await esperar('Coca')
  const pdf = await pdfTexto(() => page.getByRole('button', { name: 'PDF com assinaturas' }).click(), 'acerto.pdf')
  ok(pdf.nome === 'Mapa-Burger_acerto_11-2026.pdf', 'PDF: ' + pdf.nome)
  ok(pdf.texto.includes('TOTAL A DESCONTAR') && pdf.texto.includes('R$ 159,00') && /Pâmela[\s\S]*R\$ 59,00/.test(pdf.texto) && pdf.texto.includes('autorizo o desconto'), 'PDF com resumo, Pâmela R$ 59,00 e declaração para assinatura')
  await page.getByRole('button', { name: 'Fechar acerto do mês' }).click()
  await page.getByPlaceholder(/Observação/).fill('folha 05/12')
  await page.getByRole('button', { name: 'Fechar acerto', exact: true }).click()
  await esperar('Acerto fechado em')
  ok(db.acertos?.length === 1 && db.acertos[0].total === 159, 'acerto fechado com total R$ 159,00')
  await shot('22-acerto-fechado')

  console.log('3. Travas depois de fechar')
  await page.goto(`${BASE}/vales?mes=2026-11`)
  await esperar('Mês fechado')
  ok(true, 'mês dos vales fechou junto')
  await page.goto(`${BASE}/relatorios/${rid}`)
  await esperar('Vem do fechamento do caixa deste dia')
  {
    const dia = (await page.getByLabel('Dados do fechamento do dia').innerText()).replace(/\u00a0/g, ' ')
    ok(/Abertura\s*R\$ 150,00/.test(dia) && /Fechamento\s*R\$ 4\.000,00/.test(dia) && /Marmitas\s*20/.test(dia),
      'relatório pega abertura, fechamento e 20 marmitas do fechamento do dia')
  }
  await page.getByRole('button', { name: /Consumo de funcionários/ }).click()
  await esperar('acerto deste mês já foi fechado')
  ok(await page.getByLabel(/Funcionário da linha 1/).isDisabled(), 'consumo do relatório travado (seleção desativada)')
  ok(await page.getByLabel(/Funcionário da linha 1/).evaluate((s) => s.options[s.selectedIndex].text) === 'Pâmela', 'consumo mostra o funcionário escolhido na lista')
  await shot('23-relatorio-travado')

  console.log('4. Mensal com comparação e gráfico')
  await page.goto(`${BASE}/mensal?mes=2026-11`)
  await esperar('Comparado com outubro')
  ok((await texto()).includes('Vendas 8% maiores que no mesmo período de outubro'), 'frase de comparação')
  const barras = await page.locator('figure').first().locator('svg path').count()
  ok(barras === 2, `gráfico com 2 colunas (dias 1 e 2): ${barras}`)
  await page.locator('figure').first().locator('svg rect').nth(1).click()
  await esperar('Vendas R$ 4.300,00')
  ok(true, 'tocar na coluna mostra o valor do dia')
  await shot('24-mensal-grafico')
  const mpdf = await pdfTexto(() => page.getByRole('button', { name: 'PDF', exact: true }).click(), 'mensal.pdf')
  ok(mpdf.texto.includes('COMPARADO COM OUTUBRO') && mpdf.texto.includes('VENDAS POR DIA') && mpdf.texto.includes('Média do mês'), 'PDF mensal com comparação e gráfico')
  execSync(`pdftoppm -r 60 -png -f 1 -l 1 ${SHOTS}/mensal.pdf ${SHOTS}/mensal-pdf`)

  console.log('4b. Valor estranho no fechamento e "em andamento" na tela Hoje')
  {
    const campoN = (nome) => page.getByRole('textbox', { name: nome, exact: true })
    await page.goto(`${BASE}/novo`)
    await page.getByRole('heading', { name: 'Fechamento do caixa' }).waitFor()
    await campoN('Dinheiro no fechamento').fill('400000')
    await campoN('Dinheiro no fechamento').press('Tab')
    await campoN('Total LC Sistema').fill('400000')
    await campoN('Total LC Sistema').press('Tab')
    await page.waitForTimeout(300) // histórico dos últimos dias carregado
    await page.getByRole('button', { name: 'Salvar e gerar PDF' }).click()
    await page.getByText('Confira antes de salvar').waitFor()
    ok((await texto()).includes('Dinheiro no fechamento: R$ 400.000,00 é bem mais que o normal'), 'valor fora do normal (400.000 no dinheiro) pede confirmação antes de salvar')
    ok(db.fechamentos.every((f) => f.data !== '2026-11-03'), 'nada salvo sem confirmar')
    await page.getByRole('button', { name: 'Corrigir' }).click()

    // relatório começado e não salvo
    await page.goto(`${BASE}/relatorios/novo`)
    await page.getByRole('heading', { name: 'Novo relatório do dia' }).waitFor()
    await page.getByRole('button', { name: /^Estragou/ }).click()
    await page.getByRole('button', { name: /Adicionar/ }).first().click()
    await page.getByPlaceholder('Ex: 400g de arroz').fill('2 pães')
    await page.waitForTimeout(300)

    await page.goto(`${BASE}/hoje`)
    await esperar('Fechamento em andamento')
    const t = await texto()
    ok(t.includes('Fechamento em andamento') && t.includes('R$ 400.000,00') && t.includes('Toque para continuar'),
      'Hoje: fechamento começado aparece como "em andamento" com o caixa até agora')
    ok(t.includes('Relatório em andamento'), 'Hoje: relatório começado aparece como "em andamento"')
    await shot('25-hoje-em-andamento')
    await page.getByText('Relatório em andamento').click()
    await page.waitForURL(/\/relatorios\/novo/)
    await esperar('Rascunho restaurado')
    ok(true, 'tocar em "em andamento" continua o relatório de onde parou')

    await page.goto(`${BASE}/relatorios?mes=2026-11`)
    await esperar('Relatório de 03/11/2026 em andamento')
    ok(await page.getByRole('link', { name: 'Continuar' }).getAttribute('href') === '/relatorios/novo', 'Relatórios: rascunho visível com "Continuar"')
    await page.getByRole('button', { name: 'Descartar' }).click()
    await page.getByRole('button', { name: 'Sim, descartar' }).click()
    await page.waitForFunction(() => !document.body.innerText.includes('em andamento'))
    ok(await page.evaluate(() => localStorage.getItem('mapa-burger-rascunho-relatorio-novo')) === null, 'descartar apaga o rascunho do relatório')
  }

  console.log('5. App instalável')
  const manifesto = await page.evaluate(() => fetch('/manifest.webmanifest').then((r) => r.json()))
  ok(manifesto.short_name === 'Mapa Burger' && manifesto.start_url === '/hoje' && manifesto.icons.length === 3, 'manifesto do app')
  const sw = await page.evaluate(() => Promise.race([navigator.serviceWorker.ready.then((r) => r.active?.scriptURL || 'ok'), new Promise((r) => setTimeout(() => r('timeout'), 8000))]))
  ok(String(sw).endsWith('/sw.js'), 'service worker ativo: ' + sw)
  const supabaseNoCache = await page.evaluate(async () => (await caches.keys()).length > 0 && !(await Promise.all((await caches.keys()).map(async (k) => (await (await caches.open(k)).keys()).map((r) => r.url)))).flat().some((u) => u.includes('supabase')))
  ok(supabaseNoCache, 'cache do app não guarda nenhum dado do Supabase')

  ok(csp.length === 0, 'nenhuma violação de CSP ' + csp.join(' | '))
  ok(erros.length === 0, 'nenhum erro de JavaScript ' + erros.join(' | '))
  await browser.close()
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
