// Login da cozinha (iPhone): só lança o que estragou; aparece sozinho no relatório do dia do dono.
const fs = require('fs')
const { chromium } = require('playwright')
const { criarDb2, handle2 } = require('./simulacao.cjs')
const SHOTS = process.argv[2], BASE = process.env.BASE_URL || 'http://localhost:4173'
let falhas = 0
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) falhas++ }
const vercel = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))
const CSP = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value
  .replace('https://*.supabase.co wss://*.supabase.co', 'http://supabase.test').replace('; upgrade-insecure-requests', '')
const DIA = '2026-11-03'

;(async () => {
  const db = criarDb2()
  const browser = await chromium.launch()
  const erros = []

  async function aparelho(nome, viewport, email) {
    const context = await browser.newContext({ viewport, locale: 'pt-BR', timezoneId: 'America/Belem', isMobile: viewport.width < 500, hasTouch: viewport.width < 500 })
    await context.clock.setFixedTime(new Date('2026-11-03T15:15:00Z'))
    const page = await context.newPage()
    page.on('pageerror', (e) => erros.push(`${nome}: ${e.message}`))
    await context.route(`${BASE}/**`, async (route) => {
      const resp = await route.fetch(); const headers = { ...resp.headers() }
      if ((headers['content-type'] || '').includes('text/html')) headers['content-security-policy'] = CSP
      await route.fulfill({ response: resp, headers })
    })
    await context.route('http://supabase.test/**', async (route) => {
      const req = route.request(); const url = new URL(req.url())
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
      let body = null; try { body = req.postData() ? JSON.parse(req.postData()) : null } catch {}
      // Cada pedido com o login de quem fez (o banco simulado aplica as regras da cozinha).
      const token = (req.headers()['authorization'] || '').replace(/^Bearer /, '')
      try { const e = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).email; if (e) db.sessaoEmail = e } catch {}
      const r = handle2(db, req.method(), url.pathname, [...url.searchParams.entries()], body, (req.headers()['accept'] || '').includes('vnd.pgrst.object'))
      await route.fulfill({ status: r.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: r.body === null ? '' : JSON.stringify(r.body) })
    })
    const esperar = (t, timeout = 15000) => page.waitForFunction((x) => document.body.innerText.replace(/ /g, ' ').includes(x), t, { timeout })
    const texto = async () => (await page.locator('body').innerText()).replace(/ /g, ' ')
    await page.goto(`${BASE}/hoje`)
    await page.getByLabel('E-mail').fill(email); await page.getByLabel('Senha', { exact: true }).fill('senha-forte-123')
    await page.getByRole('button', { name: /Entrar/ }).click()
    return { page, esperar, texto, shot: (n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true }) }
  }

  console.log('1. Cozinha entra no iPhone e só vê a tela de estragos')
  const coz = await aparelho('cozinha', { width: 390, height: 844 }, 'cozinha@teste.com')
  await coz.page.getByRole('heading', { name: 'O que estragou hoje' }).waitFor()
  ok(await coz.page.getByRole('link', { name: 'Fechar' }).count() === 0 && await coz.page.getByRole('link', { name: 'Vales' }).count() === 0,
    'sem menu do sistema (caixa, vales, relatórios)')
  await coz.page.goto(`${BASE}/vales`)
  await coz.page.getByRole('heading', { name: 'O que estragou hoje' }).waitFor()
  ok(true, 'abrir outro endereço (ex.: /vales) continua só na tela da cozinha')

  const campo = coz.page.getByPlaceholder('Ex: 2 pães, 400g de arroz')
  for (const item of ['2 pães', '1 alface', '400g de arroz']) {
    await campo.fill(item)
    await coz.page.getByRole('button', { name: 'Adicionar' }).click()
    await coz.esperar(`Anotado: ${item}`)
  }
  await coz.page.getByRole('button', { name: 'Apagar 1 alface' }).click()
  await coz.page.waitForFunction(() => !document.body.innerText.includes('1 alface'))
  ok(db.estragos_cozinha.length === 2 && db.estragos_cozinha.every((e) => e.usuario === 'cozinha@teste.com' && e.nome === 'Maria' && e.data === DIA),
    'cozinha lança e apaga; fica registrado quem lançou e o dia')
  await coz.shot('50-cozinha-iphone')

  console.log('2. Dono vê na tela Hoje e o relatório já vem com os estragos')
  const pc = await aparelho('PC', { width: 1280, height: 900 }, 'dono@teste.com')
  await pc.esperar('A cozinha lançou 2 item(ns)')
  ok(true, 'Hoje: "A cozinha lançou 2 item(ns) que estragou hoje"')
  await pc.page.goto(`${BASE}/relatorios/novo`)
  await pc.page.getByLabel('Chegou da cozinha').waitFor()
  ok((await pc.page.getByLabel('Chegou da cozinha').innerText()).includes('2 pães, 400g de arroz'), 'relatório: aviso "Chegou da cozinha: 2 pães, 400g de arroz"')
  await pc.esperar('2 item(ns)')
  await pc.page.getByRole('button', { name: /^Estragou/ }).click()
  const valores = await pc.page.getByPlaceholder('Ex: 400g de arroz').evaluateAll((els) => els.map((e) => e.value))
  ok(valores.join('|') === '2 pães|400g de arroz', 'itens da cozinha já estão na lista do Estragou: ' + valores.join(', '))
  ok((await pc.texto()).includes('Lançado pela cozinha hoje: 2 pães (Maria'), 'mostra quem lançou e a hora')
  await pc.page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await pc.esperar('Relatório salvo.')
  const rel = db.relatorios[0]
  ok(rel && rel.estragou.join('|') === '2 pães|400g de arroz', 'relatório salvo com o que a cozinha lançou')
  await new Promise((r) => setTimeout(r, 500))
  ok(db.estragos_cozinha.every((e) => e.importado_em), 'estragos marcados como já no relatório')

  console.log('3. Depois de entrar no relatório, a cozinha não apaga mais; o que lançar depois entra também')
  await coz.page.reload()
  await coz.esperar('já está no relatório')
  ok(await coz.page.getByRole('button', { name: 'Apagar 2 pães' }).count() === 0, 'cozinha vê "✓ já está no relatório" e não pode mais apagar')
  await campo.fill('3 ovos')
  await coz.page.getByRole('button', { name: 'Adicionar' }).click()
  await coz.esperar('Anotado: 3 ovos')
  await pc.page.reload()
  await pc.page.getByLabel('Chegou da cozinha').waitFor()
  await pc.esperar('Ainda não salvo')
  await pc.page.getByRole('button', { name: 'Salvar', exact: true }).click()
  // (depois de recarregar, a mensagem "Relatório salvo." do salvamento anterior continua na tela: espera o banco)
  for (let i = 0; i < 100 && db.relatorios[0].estragou.length < 3; i++) await new Promise((r) => setTimeout(r, 100))
  ok(db.relatorios.length === 1 && db.relatorios[0].estragou.join('|') === '2 pães|400g de arroz|3 ovos', 'item lançado depois entra no mesmo relatório (sem duplicar os de antes)')

  ok(erros.length === 0, 'sem erros de JavaScript: ' + (erros.join(' | ') || 'nenhum'))
  await browser.close()
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK')
  process.exit(falhas ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
