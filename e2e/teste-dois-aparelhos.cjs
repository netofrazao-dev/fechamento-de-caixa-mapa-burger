// PC e celular mexendo no mesmo relatório/fechamento ao mesmo tempo (o uso do dia a dia):
// o que um preenche aparece no outro, e salvar num não apaga o que o outro fez.
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
const CHAVE_REL = `mapa-burger-rascunho-relatorio-do-dia-${DIA}`
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

;(async () => {
  const db = criarDb2()
  const browser = await chromium.launch()
  const erros = []

  async function aparelho(nome, viewport) {
    const context = await browser.newContext({ viewport, locale: 'pt-BR', timezoneId: 'America/Belem', acceptDownloads: true })
    await context.clock.setFixedTime(new Date('2026-11-03T15:15:00Z')) // 03/11/2026 12:15 (Belém)
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
      const r = handle2(db, req.method(), url.pathname, [...url.searchParams.entries()], body, (req.headers()['accept'] || '').includes('vnd.pgrst.object'))
      await route.fulfill({ status: r.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: r.body === null ? '' : JSON.stringify(r.body) })
    })
    const texto = async () => (await page.locator('body').innerText()).replace(/ /g, ' ')
    const esperar = (t, timeout = 15000) => page.waitForFunction((x) => document.body.innerText.replace(/ /g, ' ').includes(x), t, { timeout })
    const campo = (n) => page.getByRole('textbox', { name: n, exact: true })
    const preencher = async (loc, v) => { await loc.fill(v); await loc.press('Tab') }
    const abrir = async (titulo) => {
      const b = page.getByRole('button', { name: new RegExp('^' + titulo) })
      if ((await b.getAttribute('aria-expanded')) !== 'true') await b.click()
    }
    const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true })
    await page.goto(`${BASE}/hoje`)
    await page.getByLabel('E-mail').fill('dono@teste.com'); await page.getByLabel('Senha', { exact: true }).fill('senha-forte-123')
    await page.getByRole('button', { name: /Entrar/ }).click()
    await page.waitForURL(/\/hoje/)
    return { page, texto, esperar, campo, preencher, abrir, shot }
  }

  /** Espera algo acontecer no banco simulado (o envio para a nuvem leva ~1,5 s). */
  async function noBanco(cond, msg, timeout = 15000) {
    const ate = Date.now() + timeout
    while (Date.now() < ate) { if (cond()) return true; await new Promise((r) => setTimeout(r, 100)) }
    console.log('    (esperou demais: ' + msg + ')')
    return false
  }
  const rascunhoRel = () => db.rascunhos.find((r) => r.chave === CHAVE_REL)?.dados

  const pc = await aparelho('PC', { width: 1280, height: 900 })
  const cel = await aparelho('celular', { width: 390, height: 844 })

  console.log('1. Relatório novo aberto no PC e no celular')
  await pc.page.goto(`${BASE}/relatorios/novo`)
  await pc.page.getByRole('heading', { name: 'Novo relatório do dia' }).waitFor()
  await pc.abrir('Estragou')
  await pc.page.getByRole('button', { name: /Adicionar/ }).first().click()
  await pc.page.getByPlaceholder('Ex: 400g de arroz').fill('2 pães')
  ok(await noBanco(() => rascunhoRel()?.conteudo?.estragou?.includes('2 pães'), 'PC mandar o rascunho'), 'PC: o que foi digitado vai para a nuvem sozinho (sem salvar)')

  await cel.page.goto(`${BASE}/relatorios/novo`)
  await cel.page.getByRole('heading', { name: 'Novo relatório do dia' }).waitFor()
  await cel.esperar('1 item(ns)')
  ok(true, 'celular: abre o relatório do dia já com o que o PC preencheu')
  await cel.abrir('Estoque quente')
  await cel.preencher(cel.page.getByLabel('Quantidade de Coca KS'), '12')
  await cel.abrir('Anexos')
  await cel.page.getByLabel('Escolher Print 1 da galeria').setInputFiles({ name: 'print.png', mimeType: 'image/png', buffer: PNG })
  await cel.page.getByRole('img', { name: 'Print 1' }).waitFor()
  ok(await noBanco(() => {
    const d = rascunhoRel()
    return d?.conteudo?.estoqueQuente?.itens?.some((i) => i.produto === 'Coca KS' && i.quantidade === 12) && String(d?.conteudo?.imagem1).startsWith('foto:')
  }, 'celular mandar estoque e foto'), 'celular: estoque e foto vão para a nuvem (a foto vai à parte, uma vez só)')
  ok(db.rascunhos.some((r) => r.chave.startsWith('mapa-burger-foto-') && r.dados.imagem.startsWith('data:image/jpeg')), 'foto guardada à parte na nuvem')

  await pc.esperar('Chegou do outro aparelho')
  const aviso = await pc.page.getByLabel('Chegou do outro aparelho').innerText()
  ok(aviso.includes('Estoque') && aviso.includes('Print 1'), 'PC: aviso "Chegou do outro aparelho: Estoque, Print 1" sem recarregar a página')
  await pc.abrir('Estoque quente')
  ok(await pc.page.getByLabel('Quantidade de Coca KS').inputValue() === '12', 'PC: estoque contado no celular aparece no PC')
  await pc.abrir('Anexos')
  ok((await pc.page.getByRole('img', { name: 'Print 1' }).getAttribute('src')).startsWith('data:image/jpeg'), 'PC: foto tirada no celular aparece no PC (entra no PDF do WhatsApp gerado no PC)')
  ok((await pc.texto()).includes('Ainda não salvo · o outro aparelho já vê'), 'PC: rodapé avisa que ainda não foi salvo, mas o outro aparelho já vê')
  await pc.shot('40-pc-recebeu-do-celular')

  await pc.abrir('Sangrias')
  await pc.page.getByRole('button', { name: 'Adicionar compra', exact: true }).click()
  await pc.preencher(pc.campo('Valor da compra 1'), '12,50')
  await pc.campo('Motivo da compra 1').fill('pão')
  await noBanco(() => rascunhoRel()?.conteudo?.sangrias?.some((s) => s.motivo === 'pão'), 'PC mandar a sangria')

  console.log('2. O celular salva; o PC continua e salva por cima sem apagar nada')
  await cel.page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await cel.esperar('Relatório salvo.')
  const rel = db.relatorios[0]
  ok(db.relatorios.length === 1 && rel.estragou.includes('2 pães') && rel.estoque_quente.itens.some((i) => i.produto === 'Coca KS' && i.quantidade === 12) &&
    String(rel.imagem1).startsWith('data:image/jpeg') && rel.sangrias.some((s) => s.motivo === 'pão' && s.valor === 12.5),
  'celular salvou tudo junto: o que veio do PC (estragou, sangria) + estoque e foto')
  ok(!rascunhoRel() && !db.rascunhos.some((r) => r.chave.startsWith('mapa-burger-foto-')), 'depois de salvar, o rascunho e a cópia da foto saem da nuvem')

  await pc.page.getByRole('heading', { name: 'Relatório de 03/11/2026' }).waitFor({ timeout: 15000 })
  await pc.esperar('Tudo salvo')
  ok(true, 'PC: percebe sozinho que o celular salvou ("Tudo salvo")')
  await pc.page.getByRole('button', { name: /Adicionar/ }).first().click()
  await pc.page.getByPlaceholder('Ex: 400g de arroz').nth(1).fill('1 alface')
  await pc.page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await pc.esperar('Relatório salvo.')
  const rel2 = db.relatorios[0]
  ok(db.relatorios.length === 1 && rel2.estragou.join('|') === '2 pães|1 alface' && rel2.estoque_quente.itens.some((i) => i.produto === 'Coca KS' && i.quantidade === 12) &&
    String(rel2.imagem1).startsWith('data:image/jpeg'),
  'PC salvou por cima: estoque e foto do celular continuam (nada apagado), um relatório só')
  ok(pc.page.url().endsWith(`/relatorios/${rel2.id}`) && cel.page.url().endsWith(`/relatorios/${rel2.id}`), 'os dois agora estão no relatório salvo')

  console.log('3. Os dois salvando quase juntos, cada um mexendo numa coisa')
  await cel.abrir('Estoque quente')
  await cel.preencher(cel.page.getByLabel('Quantidade de Coca KS'), '15')
  await cel.page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await pc.abrir('Funcionários que comeram')
  await pc.page.getByRole('button', { name: 'Neto', exact: true }).click()
  await pc.page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await cel.esperar('Relatório salvo.')
  await pc.esperar('Relatório salvo.')
  await noBanco(() => db.relatorios[0].funcionarios_que_comeram.includes('Neto') && db.relatorios[0].estoque_quente.itens.some((i) => i.quantidade === 15), 'as duas mudanças')
  const rel3 = db.relatorios[0]
  ok(rel3.funcionarios_que_comeram.includes('Neto') && rel3.estoque_quente.itens.some((i) => i.produto === 'Coca KS' && i.quantidade === 15) && rel3.estragou.length === 2,
    'banco ficou com as duas mudanças (estoque do celular + funcionário do PC), sem um desfazer o outro')
  await cel.abrir('Funcionários que comeram')
  ok(await cel.page.getByRole('button', { name: 'Neto', exact: true, pressed: true }).waitFor({ timeout: 15000 }).then(() => true, () => false),
    'celular: funcionário marcado no PC aparece no celular sozinho (sem recarregar)')
  await cel.esperar('Tudo salvo')
  await cel.shot('41-celular-sincronizado')

  console.log('3b. Marmitas contadas no relatório, no PC e no celular ao mesmo tempo (somam)')
  await cel.abrir('Marmitas vendidas')
  await pc.abrir('Marmitas vendidas')
  for (let i = 0; i < 3; i++) await cel.page.getByRole('button', { name: 'Aumentar Estrogonofe' }).click()
  for (let i = 0; i < 2; i++) await pc.page.getByRole('button', { name: 'Aumentar Estrogonofe' }).click()
  await cel.page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await cel.esperar('Relatório salvo.')
  await pc.page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await pc.esperar('Relatório salvo.')
  ok(await noBanco(() => db.relatorios[0].marmitas?.some((m) => m.prato === 'Estrogonofe' && m.quantidade === 5) && db.relatorios[0].quantidade_vendida === 5, 'marmitas somadas'),
    'banco: 3 marmitas contadas no celular + 2 no PC = 5 (as contagens somam)')
  ok(await cel.page.getByText('Total de marmitas').locator('..').getByText('5', { exact: true }).waitFor({ timeout: 15000 }).then(() => true, () => false),
    'celular: total de marmitas atualiza para 5 sozinho')

  console.log('4. Fechamento: valores no PC e suprimento no celular')
  await pc.page.goto(`${BASE}/novo`)
  await pc.page.getByRole('heading', { name: 'Fechamento do caixa' }).waitFor()
  await pc.preencher(pc.campo('Dinheiro no fechamento'), '150,50')
  await pc.preencher(pc.campo('Total LC Sistema'), '150,50')
  await noBanco(() => db.rascunhos.find((r) => r.chave === `mapa-burger-rascunho-fechamento-do-dia-${DIA}`)?.dados?.conteudo?.lc?.dinheiroFechamento === 150.5, 'PC mandar o fechamento')
  await cel.page.goto(`${BASE}/novo`)
  await cel.page.getByRole('heading', { name: 'Fechamento do caixa' }).waitFor()
  await cel.page.waitForFunction(() => [...document.querySelectorAll('input')].some((i) => i.value === '150,50'), null, { timeout: 15000 })
  ok(true, 'celular: abre o fechamento do dia com os valores que o PC digitou')
  ok(await cel.page.getByRole('button', { name: /Marmitas vendidas/ }).count() === 0, 'fechamento não tem mais o contador de marmitas (fica no relatório)')
  await cel.preencher(cel.campo('Suprimento'), '30')
  await cel.page.getByLabel('Observação do suprimento').fill('troco trazido pelo patrão')
  await pc.esperar('Chegou do outro aparelho')
  await pc.page.waitForFunction(() => document.querySelector('[aria-label="Chegou do outro aparelho"]')?.textContent?.includes('Observação do suprimento'), null, { timeout: 15000 })
  ok(await pc.page.getByLabel('Observação do suprimento').inputValue() === 'troco trazido pelo patrão', 'PC: suprimento e observação lançados no celular chegam no PC')
  const [pdf] = await Promise.all([pc.page.waitForEvent('download', { timeout: 20000 }), pc.page.getByRole('button', { name: 'Salvar e gerar PDF' }).click()])
  ok(/fechamento_2026-11-03/.test(pdf.suggestedFilename()), 'PC salva o fechamento e baixa o recibo')
  await pc.esperar('Fechamento salvo.')
  const f = db.fechamentos.find((x) => x.data === DIA)
  ok(f && f.dinheiro_fechamento === 150.5 && f.suprimento === 30 && f.suprimento_obs === 'troco trazido pelo patrão' && f.total_lc === 150.5,
    'fechamento salvo com os valores do PC e o suprimento do celular (suprimento não entra no total)')
  await cel.page.getByRole('heading', { name: 'Fechamento de 03/11/2026' }).waitFor({ timeout: 15000 })
  ok(true, 'celular: percebe que o PC salvou o fechamento do dia')

  console.log('5. Relatório do celular mostra o fechamento feito no PC (atualiza sozinho)')
  await cel.page.goto(`${BASE}/relatorios/${rel3.id}`)
  await cel.esperar('Vem do fechamento do caixa deste dia')
  const dia = (await cel.page.getByLabel('Dados do fechamento do dia').innerText()).replace(/ /g, ' ')
  ok(/Fechamento\s*R\$ 150,50/.test(dia) && /Suprimento\s*R\$ 30,00/.test(dia) && dia.includes('troco trazido pelo patrão'),
    'relatório mostra o fechamento e o suprimento salvos no outro aparelho')

  console.log('6. Rascunho da versão antiga do sistema não se perde')
  await pc.page.evaluate(() => {
    localStorage.setItem('mapa-burger-rascunho-relatorio-novo-2026-11-02', JSON.stringify({ dados: { data: '2026-11-02', estragou: ['do rascunho antigo'] }, salvoEm: '2026-11-02T22:00:00.000Z' }))
    localStorage.setItem('mapa-burger-rascunho-fechamento', JSON.stringify({ dados: { data: '2026-11-02', lc: { pix: 33 }, marmitas: [] }, salvoEm: '2026-11-02T22:00:00.000Z' }))
  })
  await pc.page.goto(`${BASE}/relatorios/novo?data=2026-11-02`)
  await pc.esperar('Rascunho restaurado')
  await pc.esperar('1 item(ns)')
  ok(await pc.page.waitForFunction(() => localStorage.getItem('mapa-burger-rascunho-relatorio-novo-2026-11-02') === null &&
    JSON.parse(localStorage.getItem('mapa-burger-rascunho-relatorio-do-dia-2026-11-02') || 'null')?.conteudo?.estragou?.[0] === 'do rascunho antigo', null, { timeout: 10000 })
    .then(() => true, () => false),
  'relatório: rascunho antigo (antes da sincronia) passa para o rascunho novo do dia')
  ok(await noBanco(() => db.rascunhos.some((r) => r.chave === 'mapa-burger-rascunho-relatorio-do-dia-2026-11-02'), 'rascunho antigo ir para a nuvem'),
    'e já vai para a nuvem (o outro aparelho vê)')
  await pc.page.goto(`${BASE}/novo?data=2026-11-02`)
  await pc.esperar('Rascunho restaurado')
  ok(await pc.campo('PIX').first().inputValue() === '33,00' && await pc.page.evaluate(() => localStorage.getItem('mapa-burger-rascunho-fechamento') === null),
    'fechamento: rascunho antigo do dia também é aproveitado')

  console.log('7. Relatório novo: trocar a data leva junto o que foi preenchido')
  await pc.page.goto(`${BASE}/relatorios/novo?data=2026-11-02`)
  await pc.esperar('1 item(ns)')
  await pc.page.locator('input[type="date"]').fill('2026-11-01')
  await pc.page.waitForURL(/data=2026-11-01/)
  await pc.esperar('1 item(ns)')
  ok(await noBanco(() => db.rascunhos.find((r) => r.chave === 'mapa-burger-rascunho-relatorio-do-dia-2026-11-01')?.dados?.conteudo?.estragou?.[0] === 'do rascunho antigo' &&
    !db.rascunhos.some((r) => r.chave === 'mapa-burger-rascunho-relatorio-do-dia-2026-11-02'), 'rascunho mudar de dia'),
  'o que foi preenchido foi para o dia 01/11 (e saiu do dia 02/11, sem ficar duplicado)')
  ok(await pc.page.locator('input[type="date"]').inputValue() === '2026-11-01', 'a data do formulário é a nova')

  ok(erros.length === 0, 'sem erros de JavaScript: ' + (erros.join(' | ') || 'nenhum'))
  await browser.close()
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK')
  process.exit(falhas ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
