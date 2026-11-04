const fs = require('fs')
const { chromium } = require('playwright')
const { criarDb2, handle2 } = require('./simulacao.cjs')
const SHOTS = process.argv[2]
const BASE = process.env.BASE_URL || 'http://localhost:4173'
let falhas = 0
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) falhas++ }

// Mesma política da Vercel, trocando o Supabase real pela API simulada.
const vercel = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))
const CSP = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value
  .replace('https://*.supabase.co wss://*.supabase.co', 'http://supabase.test').replace('; upgrade-insecure-requests', '')

;(async () => {
  const db = criarDb2()
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR', timezoneId: 'America/Belem', acceptDownloads: true })
  await context.clock.setFixedTime(new Date('2026-11-03T15:15:00Z')) // 03/11/2026 12:15 (Belém): resultado igual em qualquer dia
  const page = await context.newPage()
  const erros = [], violacoesCsp = []
  page.on('pageerror', (e) => erros.push(e.message))
  page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violacoesCsp.push(m.text()) })

  await context.route(`${BASE}/**`, async (route) => {
    const resp = await route.fetch()
    const headers = { ...resp.headers() }
    if ((headers['content-type'] || '').includes('text/html')) headers['content-security-policy'] = CSP
    await route.fulfill({ response: resp, headers })
  })
  await context.route('http://supabase.test/**', async (route) => {
    const req = route.request(); const url = new URL(req.url())
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    const params = [...url.searchParams.entries()]
    let body = null; try { body = req.postData() ? JSON.parse(req.postData()) : null } catch { body = null }
    const wantsObject = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
    const r = handle2(db, req.method(), url.pathname, params, body, wantsObject)
    await route.fulfill({ status: r.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: r.body === null ? '' : JSON.stringify(r.body) })
  })
  const campo = (nome) => page.getByRole('textbox', { name: nome, exact: true })
  const texto = async () => (await page.locator('body').innerText()).replace(/ /g, ' ')
  const shot = (nome) => page.screenshot({ path: `${SHOTS}/${nome}.png`, fullPage: true })
  const esperarTexto = (t) => page.waitForFunction((x) => document.body.innerText.replace(/ /g, ' ').includes(x), t, { timeout: 10000 })

  console.log('1. Login')
  await page.goto(`${BASE}/novo`)
  await page.getByRole('button', { name: /Entrar/ }).waitFor()
  await shot('10-login')
  await page.getByLabel('E-mail').fill('dono@teste.com')
  await page.getByLabel('Senha', { exact: true }).fill('errada')
  await page.getByRole('button', { name: /Entrar/ }).click()
  await esperarTexto('E-mail ou senha incorretos')
  ok(true, 'senha errada: "E-mail ou senha incorretos"')
  await page.getByLabel('Senha', { exact: true }).fill('senha-forte-123')
  await page.getByRole('button', { name: /Entrar/ }).click()
  await page.getByRole('heading', { name: 'Fechamento do caixa' }).waitFor()
  ok(true, 'login certo abre o fechamento')

  console.log('2. Fechamento: vírgula, sem sangrias (ficam no relatório), avisos, salvar + PDF')
  // Digita e sai do campo; confere que o valor ficou (se não ficar, avisa no log e digita de novo).
  const preencher = async (loc, valor, formatado) => {
    for (let i = 0; i < 3; i++) {
      await loc.fill(valor)
      await loc.press('Tab')
      if ((await loc.inputValue()) === formatado) return
      console.log(`  ⚠ campo ficou "${await loc.inputValue()}" em vez de "${formatado}"; digitando de novo`)
    }
  }
  // Tocar dois campos de dinheiro em seguida (no mesmo instante) não pode fazer um roubar o foco do outro.
  const focoFicou = await page.evaluate(async () => {
    const [a, b] = [...document.querySelectorAll('input[inputmode="decimal"]')]
    let trocas = 0
    a.focus(); b.focus()
    const contar = () => trocas++
    document.addEventListener('focusin', contar, true)
    await new Promise((r) => setTimeout(r, 300))
    document.removeEventListener('focusin', contar, true)
    b.blur()
    return trocas === 0 && document.activeElement !== a
  })
  ok(focoFicou, 'campos de dinheiro tocados em seguida: o foco fica no último (sem vai e vem)')
  await preencher(campo('Dinheiro no fechamento'), '150,50', '150,50')
  await preencher(campo('PIX').first(), '200', '200,00')
  await esperarTexto('SOBROU DINHEIRO R$ 350,50')
  ok(true, 'resultado ao vivo no rodapé: SOBROU DINHEIRO R$ 350,50')
  ok(!(await texto()).includes('Sangrias') && (await page.getByRole('button', { name: 'Adicionar sangria' }).count()) === 0, 'fechamento não tem mais a parte de sangrias')
  ok((await texto()).includes('4. Conferência com o sistema'), 'seções renumeradas (4. Conferência)')
  await page.getByRole('button', { name: 'Salvar e gerar PDF' }).click()
  await page.getByText('Confira antes de salvar').waitFor()
  ok((await texto()).includes('Total LC Sistema" está zerado'), 'avisa Total LC Sistema zerado')
  await shot('11-fechamento-avisos')
  await page.getByRole('button', { name: 'Corrigir' }).click()
  await campo('Total LC Sistema').fill('350,50')
  await esperarTexto('CAIXA FECHOU')
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Salvar e gerar PDF' }).click()])
  ok(/^fechamento_\d{4}-\d{2}-\d{2}_manha\.pdf$/.test(pdf.suggestedFilename()), 'PDF do fechamento baixado: ' + pdf.suggestedFilename())
  await pdf.saveAs(`${SHOTS}/recibo-fechamento.pdf`)
  {
    const bruto = fs.readFileSync(`${SHOTS}/recibo-fechamento.pdf`).toString('latin1')
    const info = require('child_process').execSync(`pdfinfo ${SHOTS}/recibo-fechamento.pdf`).toString()
    const alturaMm = Number(/Page size:\s+[\d.]+ x ([\d.]+)/.exec(info)[1]) * 25.4 / 72
    ok(/Pages:\s+1\b/.test(info) && alturaMm < 200, `recibo: 1 página da altura do conteúdo (${Math.round(alturaMm)} mm, não 297)`)
    ok(/\(PIX +R\$ 200,00\) Tj/.test(bruto) && /\(Dinheiro fechamento +R\$ 150,50\) Tj/.test(bruto), 'recibo: nome e valor na mesma linha, separados por espaços')
  }
  await page.getByText('Fechamento salvo.').waitFor()
  const f = db.fechamentos[0]
  ok(f && f.dinheiro_fechamento === 150.5 && f.total_lc === 350.5 && f.status === 'fechou', 'gravado: 150,50 + 200 = 350,50, CAIXA FECHOU')
  ok(db.sangrias.length === 0, 'fechamento salvo sem sangrias')
  await shot('12-detalhe')

  console.log('2b. Fechamento antigo com sangrias: aviso para lançar no relatório')
  db.sangrias.push({ id: 'sg-antiga', fechamento_id: f.id, valor: 12, motivo: 'troco' })
  await page.goto(`${BASE}/fechamento/${f.id}/editar`)
  await esperarTexto('sangria(s) lançada(s) antes')
  ok((await texto()).includes('troco') && (await texto()).includes('Relatório do dia'), 'mostra a sangria antiga e onde lançar agora')
  await page.getByRole('button', { name: /Tirar do fechamento/ }).click()
  ok(!(await texto()).includes('lançada(s) antes'), '"Tirar do fechamento" some com o aviso')
  db.sangrias = []

  console.log('3. Fechamento duplicado na mesma data')
  await page.goto(`${BASE}/novo`)
  await campo('PIX').first().fill('10')
  await campo('Total LC Sistema').fill('10')
  await page.getByRole('button', { name: 'Salvar e gerar PDF' }).click()
  await page.getByText('Abrir o fechamento existente').waitFor()
  ok(db.fechamentos.length === 1, 'não duplica; oferece link para o existente')

  console.log('4. Histórico')
  await page.goto(`${BASE}/historico`)
  await esperarTexto('1 fechamento(s)')
  ok((await texto()).includes('sem fechamento no período'), 'mostra dias sem fechamento')
  await shot('13-historico')
  await page.goto(`${BASE}/historico?de=2026-11-10&ate=2026-11-01`)
  await esperarTexto('está depois da data')
  ok(true, 'período invertido: explica o erro')

  console.log('5. Mensal + PDF')
  await page.goto(`${BASE}/mensal?mes=${f.data.slice(0, 7)}`)
  await esperarTexto('Pratos mais vendidos').catch(() => {})
  await esperarTexto('Total do caixa')
  ok((await texto()).includes('R$ 350,50'), 'total do mês R$ 350,50')
  await shot('14-mensal')
  const [pdfMes] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF' }).click()])
  await pdfMes.saveAs(`${SHOTS}/mensal.pdf`)
  ok(pdfMes.suggestedFilename().startsWith('Mapa-Burger_relatorio-mensal_'), 'PDF mensal: ' + pdfMes.suggestedFilename())

  console.log('6. Relatório do dia: puxar do fechamento, salvar, duplicado')
  await page.goto(`${BASE}/relatorios/novo?data=${f.data}`)
  await page.getByRole('button', { name: /Puxar abertura/ }).click()
  await esperarTexto('Puxado do fechamento')
  ok(await campo('Fechamento do caixa').inputValue() === '150,50', 'fechamento do caixa preenchido com 150,50')
  await page.getByRole('button', { name: /^Sangrias/ }).click()
  await page.getByRole('button', { name: 'Adicionar sangria' }).click()
  await preencher(campo('Valor da linha 1'), '30', '30,00')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await esperarTexto('Toda sangria com valor precisa ter um motivo')
  ok(db.relatorios.length === 0, 'sangria sem motivo no relatório: não salva')
  await campo('Motivo da linha 1').fill('pagamento do gás')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await page.getByText('Relatório salvo.').waitFor()
  ok(db.relatorios.length === 1 && db.relatorios[0].fechamento_caixa === 150.5, 'relatório gravado')
  ok(db.relatorios[0].sangrias.length === 1 && db.relatorios[0].sangrias[0].motivo === 'pagamento do gás' && db.relatorios[0].sangrias[0].valor === 30,
    'sangria gravada no relatório com motivo')
  await shot('15-relatorio')
  const [pdfDia] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF WhatsApp', exact: true }).click()])
  await pdfDia.saveAs(`${SHOTS}/dia.pdf`)
  const textoDia = require('child_process').execSync(`pdftotext -layout ${SHOTS}/dia.pdf -`).toString()
  ok(/RETIRADAS \(SANGRIAS\)/.test(textoDia) && textoDia.includes('R$ 30,00'), 'PDF do dia: card de retiradas R$ 30,00')
  ok(textoDia.includes('pagamento do gás') && textoDia.includes('Retiradas do caixa (sangrias)') && textoDia.includes('Total retirado'),
    'PDF do dia: fechamento + sangrias do relatório (motivo e total)')
  ok(textoDia.includes('Caixa LC') && textoDia.includes('150,50'), 'PDF do dia: fechamento completo junto')
  await page.goto(`${BASE}/relatorios/novo?data=${f.data}`)
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await page.getByText('Abrir o relatório existente').waitFor()
  ok(db.relatorios.length === 1, 'segundo relatório na mesma data: bloqueado com link')

  console.log('7. Cadastros')
  await page.goto(`${BASE}/cadastros`)
  await page.getByLabel('Adicionar em Funcionários').fill('Carlos')
  await page.getByRole('button', { name: 'Adicionar' }).first().click()
  await page.getByText('Carlos').waitFor()
  await page.getByLabel('Adicionar em Funcionários').fill('  carlos ')
  await page.getByRole('button', { name: 'Adicionar' }).first().click()
  await esperarTexto('já está cadastrado')
  ok(db.funcionarios.filter((x) => x.nome.toLowerCase() === 'carlos').length === 1, 'não cadastra "carlos" duplicado')
  const linhaDiogo = page.locator('li', { hasText: 'Diogo' })
  await linhaDiogo.getByRole('button', { name: 'Desativar' }).click()
  await page.getByRole('button', { name: /Ver desativados/ }).waitFor()
  await shot('16-cadastros')
  await page.goto(`${BASE}/vales/novo`)
  await page.getByRole('button', { name: 'Carlos', exact: true }).waitFor()
  ok(await page.getByRole('button', { name: 'Diogo', exact: true }).count() === 0, 'Diogo desativado some do seletor de vales')

  console.log('7b. Produtos do estoque: adicionar, desativar, relatório')
  await page.goto(`${BASE}/cadastros#produtos-estoque`)
  const secaoProdutos = page.locator('#produtos-estoque')
  await secaoProdutos.getByText('Monster Azul').waitFor()
  await secaoProdutos.getByLabel('Adicionar em Produtos do estoque (bebidas)').fill('  Pepsi   Lata ')
  await secaoProdutos.getByRole('button', { name: 'Adicionar' }).click()
  await secaoProdutos.getByText('Pepsi Lata').waitFor()
  ok(db.produtos_estoque.at(-1).nome === 'Pepsi Lata', 'produto novo cadastrado (vai para o fim da lista)')
  await secaoProdutos.locator('li', { hasText: 'Monster Azul' }).getByRole('button', { name: 'Desativar' }).click()
  await secaoProdutos.getByRole('button', { name: /Ver desativados \(1\)/ }).waitFor()
  ok(db.produtos_estoque.find((p) => p.nome === 'Monster Azul').ativo === false, 'Monster Azul desativado')
  await page.goto(`${BASE}/relatorios/novo?data=2026-11-02`)
  await page.getByRole('button', { name: /Estoque quente/ }).click()
  await page.getByLabel('Quantidade de Pepsi Lata').waitFor()
  ok(await page.getByLabel('Quantidade de Monster Azul').count() === 0, 'relatório novo: desativado não aparece, novo aparece')
  await page.getByLabel('Quantidade de Pepsi Lata').fill('7')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await page.getByText('Relatório salvo.').waitFor().catch(() => {})
  await page.waitForURL(/\/relatorios\/(?!novo)/)
  const relNovo = db.relatorios.find((r) => r.data === '2026-11-02')
  ok(relNovo && relNovo.estoque_quente.itens.some((i) => i.produto === 'Pepsi Lata' && i.quantidade === 7), 'contagem do produto novo gravada')
  // Relatório antigo com contagem de um produto que foi desativado depois: não perde a contagem.
  relNovo.estoque_quente = { itens: [{ produto: 'Monster Azul', quantidade: 3 }, { produto: 'Coca KS', quantidade: 5 }] }
  await page.goto(`${BASE}/relatorios/${relNovo.id}`)
  await page.getByRole('button', { name: /Estoque quente/ }).click()
  await page.getByLabel('Quantidade de Monster Azul').waitFor()
  ok(await page.getByLabel('Quantidade de Monster Azul').inputValue() === '3' && (await texto()).includes('desativado'), 'relatório antigo mantém a contagem do produto desativado')
  await shot('16b-estoque')

  console.log('7b. Cópia de segurança')
  await page.goto(`${BASE}/cadastros`)
  const [copia] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar cópia completa agora' }).click()])
  await copia.saveAs(`${SHOTS}/copia.json`)
  const conteudo = JSON.parse(fs.readFileSync(`${SHOTS}/copia.json`, 'utf8'))
  ok(/^copia-mapa-burger_.*\.json$/.test(copia.suggestedFilename()), 'cópia baixada: ' + copia.suggestedFilename())
  ok(conteudo.fechamentos.length === 1 && conteudo.relatorios.length === 2 && conteudo.produtos_estoque?.length === 5 && conteudo.funcionarios.length >= 6 && conteudo.relatorios[0].imagem1 === undefined,
    'cópia tem fechamentos, relatórios (sem prints), funcionários e produtos do estoque')
  await esperarTexto('Cópia baixada:')
  ok((await texto()).includes('Última cópia baixada neste aparelho'), 'mostra quando foi a última cópia')
  const [auto] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Baixar cópia de/ }).click()])
  ok(auto.suggestedFilename().startsWith('copia-automatica-mapa-burger_'), 'baixa cópia automática: ' + auto.suggestedFilename())
  await shot('18-copias')

  console.log('8. Página inexistente')
  await page.goto(`${BASE}/nao-existe`)
  await page.getByText('Página não encontrada').waitFor()
  ok(true, '404 amigável')

  console.log('9. Excluir fechamento com confirmação na tela')
  await page.goto(`${BASE}/fechamento/${f.id}`)
  await page.getByRole('button', { name: 'Excluir fechamento' }).click()
  ok(db.fechamentos.length === 1, 'primeiro toque só pede confirmação')
  await page.getByRole('button', { name: 'Sim, excluir' }).click()
  await page.waitForURL(/\/historico/)
  ok(db.fechamentos.length === 0, 'fechamento excluído')

  console.log('10. Sem internet')
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await page.getByText(/Sem internet/).waitFor()
  ok(true, 'aviso de sem internet aparece')
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))

  console.log('11. Menu: tema e sair (apaga rascunhos do aparelho)')
  await page.evaluate(() => localStorage.setItem('mapa-burger-rascunho-teste', '{"dados":{},"salvoEm":"x"}'))
  await page.getByRole('button', { name: 'Menu da conta' }).click()
  await page.getByRole('menuitem', { name: /Tema escuro/ }).click()
  ok(await page.evaluate(() => document.documentElement.classList.contains('dark')), 'tema escuro aplicado')
  await page.goto(`${BASE}/novo`)
  await page.getByRole('heading', { name: 'Fechamento do caixa' }).waitFor()
  await shot('17-fechamento-escuro')
  await page.getByRole('button', { name: 'Menu da conta' }).click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await page.getByRole('button', { name: /Entrar/ }).waitFor()
  ok(await page.evaluate(() => localStorage.getItem('mapa-burger-rascunho-teste')) === null, 'saiu e apagou rascunhos do aparelho')

  console.log('12. Login válido, mas e-mail fora da lista de autorizados')
  await page.getByLabel('E-mail').fill('intruso@teste.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-forte-123')
  await page.getByRole('button', { name: /Entrar/ }).click()
  await page.getByText('Acesso não autorizado').waitFor()
  ok(await page.getByRole('navigation').count() === 0, 'não vê o sistema; só o aviso e "Sair"')

  ok(violacoesCsp.length === 0, 'nenhuma violação da política de segurança (CSP) ' + violacoesCsp.join(' | '))
  ok(erros.length === 0, 'nenhum erro de JavaScript ' + erros.join(' | '))
  await browser.close()
  console.log(falhas === 0 ? '\nTUDO OK' : `\n${falhas} FALHA(S)`)
  process.exit(falhas ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
