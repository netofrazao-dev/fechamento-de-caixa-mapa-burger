// Esqueci minha senha, relatório semanal (tela + PDF) e gráficos em cada tela.
const fs = require('fs')
const { execSync } = require('child_process')
const { chromium } = require('playwright')
const { criarDb2, handle2, uid, jwt } = require('./simulacao.cjs')
const SHOTS = process.argv[2], BASE = process.env.BASE_URL || 'http://localhost:4173'
let falhas = 0
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) falhas++ }
const vercel = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))
const CSP = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value
  .replace('https://*.supabase.co wss://*.supabase.co', 'http://supabase.test').replace('; upgrade-insecure-requests', '')

function fech(data, caixa, dif = 0) {
  return { id: uid(), created_at: '', data, turno: 'manha', dinheiro_abertura: 150, dinheiro_fechamento: caixa - 500, pix_lc: 300, debito_lc: 0, credito_lc: 200, consumo_loja: 0, a_prazo: 0, ticket: 0,
    pix_brendi: 0, debito_brendi: 0, credito_brendi: 0, credito_online_brendi: 0, dinheiro_brendi: 0, total_lc: caixa, total_brendi: 0, total_caixa: caixa, total_lc_sistema: caixa - dif, total_sistema: caixa - dif,
    diferenca_original: dif, ajuste_tipo: null, ajuste_valor: 0, ajuste_aplicado: 0, diferenca_final: dif, status: dif === 0 ? 'fechou' : dif > 0 ? 'sobrou' : 'faltou', observacoes: null,
    marmitas: [{ prato: 'Estrogonofe', quantidade: 20 }, { prato: 'Frango Grelhado', quantidade: 12 }] }
}

;(async () => {
  const db = criarDb2()
  const neto = db.funcionarios.find((f) => f.nome === 'Neto'), pam = db.funcionarios.find((f) => f.nome === 'Pâmela')
  // semana atual (seg 02/11 a dom 08/11) e a anterior (26/10 a 01/11)
  db.fechamentos.push(fech('2026-11-02', 4400, 12.5), fech('2026-11-03', 4000, -8), fech('2026-10-26', 4000), fech('2026-10-27', 3800, -5), fech('2026-10-30', 5200))
  for (const [f, d, v] of [[neto, '2026-11-02', 120], [pam, '2026-11-03', 60], [neto, '2026-11-03', 30]])
    db.vales.push({ id: uid(), funcionario: f.nome, funcionario_id: f.id, data: d, valor: v, observacao: null, created_at: `${d}T12:00:00Z`, updated_at: null, excluido_em: null, motivo_exclusao: null })
  db.relatorios.push({ id: uid(), data: '2026-11-02', created_at: '', updated_at: '', abertura_caixa: 0, fechamento_caixa: 0, quantidade_vendida: 0, estragou: [], funcionarios_que_comeram: [],
    consumo_loja_mensal: [{ pessoa: 'Pâmela', item: 'Coca', valor: 6, funcionarioId: pam.id }], consumo_loja_motoboys: [], cortesia_clientes: [], sangrias: [], estoque_quente: { itens: [] }, imagem1: null, imagem2: null })

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR', timezoneId: 'America/Belem', acceptDownloads: true })
  await context.clock.setFixedTime(new Date('2026-11-03T15:15:00Z'))
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

  console.log('1. Esqueci minha senha')
  await page.goto(`${BASE}/`)
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click()
  await page.getByLabel('E-mail').fill('dono@teste.com')
  await page.getByRole('button', { name: /Enviar link/ }).click()
  await esperar('Se esse e-mail estiver cadastrado')
  ok((db.emailsRecuperacao || []).includes('dono@teste.com'), 'pede o e-mail de redefinição ao Supabase')
  await shot('30-esqueci-senha')

  console.log('2. Link do e-mail: criar senha nova')
  db.sessaoEmail = 'dono@teste.com'
  await page.goto(`${BASE}/redefinir-senha#access_token=${jwt('dono@teste.com')}&expires_in=3600&refresh_token=r-123&token_type=bearer&type=recovery`)
  await page.getByText('Senha nova', { exact: true }).waitFor()
  ok(!page.url().includes('access_token'), 'token some da barra de endereço')
  await page.getByLabel('Senha nova', { exact: true }).fill('curta')
  await page.getByLabel('Repita a senha nova').fill('curta')
  await page.getByRole('button', { name: /Salvar senha nova/ }).click()
  await esperar('pelo menos 8 caracteres')
  ok(true, 'senha curta é recusada')
  await page.getByLabel('Senha nova', { exact: true }).fill('MapaBurger2026!')
  await page.getByLabel('Repita a senha nova').fill('MapaBurger2026!')
  await shot('31-senha-nova')
  await page.getByRole('button', { name: /Salvar senha nova/ }).click()
  await esperar('Senha alterada')
  ok(db.usuarios['dono@teste.com'] === 'MapaBurger2026!', 'senha nova gravada')
  await page.getByRole('link', { name: 'Ir para o sistema' }).click()
  await esperar('Fazer o fechamento de hoje').catch(() => {})
  await esperar('Últimos 7 dias')
  ok(true, 'entra no sistema depois de trocar a senha')
  const novaAba = await context.newPage()
  await novaAba.goto(`${BASE}/redefinir-senha#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`)
  await novaAba.getByText(/expirou/).waitFor()
  ok(true, 'link expirado mostra mensagem clara')
  await novaAba.close()

  console.log('3. Gráficos nas telas')
  ok((await page.locator('figure svg path').count()) >= 2, 'Hoje: gráfico dos últimos 7 dias')
  await shot('32-hoje-grafico')
  await page.goto(`${BASE}/historico?de=2026-10-26&ate=2026-11-03`)
  await esperar('Vendas no período')
  ok((await page.locator('figure').count()) >= 3, 'Histórico: vendas, resultado e sobra/falta do período')
  await page.goto(`${BASE}/vales?mes=2026-11`)
  await esperar('Quem pegou mais vale')
  ok((await texto()).includes('R$ 150,00'), 'Vales: barras por funcionário (Neto R$ 150,00)')
  await page.goto(`${BASE}/acerto?mes=2026-11`)
  await esperar('Desconto de cada um')
  ok((await texto()).includes('Vales R$ 60,00 · Consumo na loja R$ 6,00'), 'Acerto: barras vales + consumo por pessoa')
  await shot('33-acerto-grafico')
  await page.goto(`${BASE}/fechamento/${db.fechamentos[0].id}`)
  await page.getByRole('heading', { name: /como o dinheiro entrou/i }).waitFor()
  ok((await texto()).includes('PIX'), 'Detalhe do fechamento: formas de pagamento em barras')

  console.log('4. Relatório semanal')
  await page.goto(`${BASE}/semanal`)
  await esperar('Relatório da semana')
  // O título aparece antes dos números: espera os dados da semana carregarem antes de conferir.
  await esperar('maiores que os mesmos')
  const t = await texto()
  ok(t.includes('02/11 a 08/11/2026') && t.includes('semana atual'), 'abre na semana atual (seg 02/11 a dom 08/11)')
  ok(t.includes('R$ 8.400,00'), 'vendas da semana: R$ 8.400,00')
  ok(t.includes('Vendas 8% maiores que os mesmos 2 dia(s) da semana passada'), 'compara com os mesmos dias da semana passada')
  ok((await page.locator('figure svg path').count()) >= 4, 'gráficos: vendas por dia e sobra/falta')
  ok(await page.getByRole('link', { name: 'Resumos' }).evaluate((a) => a.className.includes('text-gray-900')), 'menu "Resumos" marcado')
  await shot('34-semanal')
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF', exact: true }).click()])
  await d.saveAs(`${SHOTS}/semanal.pdf`)
  const pdf = execSync(`pdftotext -layout ${SHOTS}/semanal.pdf -`).toString()
  ok(d.suggestedFilename() === 'Mapa-Burger_relatorio-semanal_02-11-2026.pdf', 'PDF: ' + d.suggestedFilename())
  ok(pdf.includes('Relatório da semana') && pdf.includes('COMPARADO COM A SEMANA PASSADA') && pdf.includes('VENDAS POR DIA') && pdf.includes('SOBRA E FALTA POR DIA'), 'PDF com comparação e gráficos')
  execSync(`pdftoppm -r 60 -png -f 1 -l 1 ${SHOTS}/semanal.pdf ${SHOTS}/semanal-pdf`)
  await page.getByRole('button', { name: 'Semana anterior' }).click()
  await esperar('26/10 a 01/11/2026')
  ok(await esperar('R$ 13.000,00').then(() => true, () => false), 'semana passada: R$ 13.000,00 (4.000 + 3.800 + 5.200)')
  await page.getByRole('link', { name: 'Mês', exact: true }).click()
  await esperar('Relatório mensal')
  ok(await esperar('Como o caixa fechou').then(() => true, () => false) && (await texto()).includes('Como o dinheiro entrou'), 'mensal também com formas de pagamento e resultado')

  ok(csp.length === 0, 'nenhuma violação de CSP ' + csp.join(' | '))
  ok(erros.length === 0, 'nenhum erro de JavaScript ' + erros.join(' | '))
  await browser.close()
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
