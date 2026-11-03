const { chromium } = require('playwright')
const { criarDb2: criarDb, handle2: handle, uid } = require('./simulacao.cjs')
const SHOTS = process.argv[2]
const BASE = process.env.BASE_URL || 'http://localhost:4173'
let falhas = 0
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) falhas++ }

;(async () => {
  const db = criarDb()
  const neto = db.funcionarios.find((f) => f.nome === 'Neto')
  const pam = db.funcionarios.find((f) => f.nome === 'Pâmela')
  const seed = (f, data, valor, obs = null) => db.vales.push({ id: uid(), funcionario: f.nome, funcionario_id: f.id, data, valor,
    observacao: obs, created_at: `${data}T12:00:00Z`, updated_at: null, excluido_em: null, motivo_exclusao: null })
  seed(pam, '2026-10-02', 50, 'remédio'); seed(pam, '2026-10-05', 30.5); seed(neto, '2026-10-03', 100)
  seed(neto, '2026-09-10', 77)

  const hooks = (method, tabela, params) => {
    const ini = params.find(([k, v]) => k === 'data' && v.startsWith('gte.'))?.[1]
    if (tabela === 'vales' && ini === 'gte.2026-08-01') return { status: 500, body: { message: 'servidor caiu', code: 'XX000' } }
    if (tabela === 'vales' && ini === 'gte.2026-07-01') return { status: 400, body: { message: 'column vales.excluido_em does not exist', code: '42703' } }
  }

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  await page.clock.setFixedTime(new Date('2026-11-03T15:15:00Z')) // 03/11/2026 12:15: resultado igual em qualquer dia
  const erros = []
  page.on('pageerror', (e) => erros.push(e.message))
  await page.route('http://supabase.test/**', async (route) => {
    const req = route.request(); const url = new URL(req.url())
    const params = [...url.searchParams.entries()]
    const ini = params.find(([k, v]) => k === 'data' && v.startsWith('gte.'))?.[1]
    if (ini === 'gte.2026-09-01' && url.pathname.endsWith('/vales')) await new Promise((r) => setTimeout(r, 1500)) // setembro lento
    const body = req.postData() ? JSON.parse(req.postData()) : null
    const wantsObject = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
    const r = handle(db, req.method(), url.pathname, params, body, wantsObject, hooks)
    await route.fulfill({ status: r.status, contentType: 'application/json', body: r.body === null ? '' : JSON.stringify(r.body) })
  })
  const texto = async () => (await page.locator('body').innerText()).replace(/\u00a0/g, ' ')
  const shot = (nome) => page.screenshot({ path: `${SHOTS}/${nome}.png`, fullPage: true })

  console.log('0. Login')
  await page.goto(`${BASE}/vales?mes=2026-10`)
  await page.getByLabel('E-mail').fill('dono@teste.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-forte-123')
  await page.getByRole('button', { name: /Entrar/ }).click()
  console.log('1. Lista de outubro')
  await page.getByText('Total a descontar em 10/2026').waitFor()
  ok((await texto()).includes('R$ 180,50'), 'total do mês R$ 180,50')
  ok((await texto()).includes('3 vale(s) · 2 funcionário(s)'), '3 vales, 2 funcionários')
  await page.getByRole('button', { name: /Pâmela/ }).click()
  await shot('01-lista')

  console.log('2. Excluir exige motivo; vale vai para "excluídos" e pode voltar')
  await page.getByRole('button', { name: /Excluir vale de R\$\s50,00 de Pâmela/ }).click()
  await page.getByRole('button', { name: 'Excluir', exact: true }).click()
  ok((await texto()).includes('Escreva o motivo da exclusão'), 'sem motivo: pede motivo')
  await page.getByPlaceholder(/Motivo \(obrigatório\)/).fill('lançado em dobro')
  await page.getByRole('button', { name: 'Excluir', exact: true }).click()
  await page.getByText('Vales excluídos neste mês (1)').waitFor()
  ok((await texto()).includes('R$ 130,50'), 'total caiu para R$ 130,50')
  ok(db.vales.find((v) => v.valor === 50).excluido_em !== null, 'no banco: marcado como excluído (não apagado)')
  await page.getByText('Vales excluídos neste mês (1)').click()
  await shot('02-excluido')
  await page.getByRole('button', { name: /Restaurar/ }).click()
  await page.waitForFunction(() => document.body.innerText.replace(/\u00a0/g, ' ').includes('R$ 180,50'))
  ok(true, 'restaurado: total volta a R$ 180,50')

  console.log('3. Histórico')
  await page.getByRole('button', { name: /Histórico de alterações/ }).click()
  await page.getByText('Vale restaurado').waitFor()
  ok((await texto()).includes('Motivo: lançado em dobro'), 'histórico mostra exclusão com motivo')

  console.log('4. Fechar mês trava tudo')
  await page.getByRole('button', { name: 'Fechar mês' }).click()
  await page.getByPlaceholder(/Observação \(opcional\)/).fill('descontado na folha de 05/11')
  await shot('03-confirmar-fechamento')
  await page.getByRole('button', { name: 'Fechar mês' }).last().click()
  await page.getByText(/Mês fechado em/).waitFor()
  ok(await page.getByRole('link', { name: /Novo vale/ }).count() === 0, 'botão "Novo vale" some')
  ok(await page.getByRole('button', { name: /Excluir vale/ }).count() === 0, 'lixeiras somem')
  ok(!(await texto()).includes('não batem'), 'fechamento confere com os vales')
  await shot('04-mes-fechado')

  console.log('5. Trocar de mês rápido não mistura dados (setembro demora 1,5s)')
  await page.getByRole('button', { name: 'Mês anterior' }).click() // setembro (lento)
  await page.getByRole('button', { name: 'Próximo mês' }).click()   // volta a outubro
  await page.waitForTimeout(2200)
  const t5 = await texto()
  ok(t5.includes('10/2026') && t5.includes('R$ 180,50') && !t5.includes('R$ 77,00'), 'continua mostrando outubro, sem os R$ 77 de setembro')

  console.log('6. Erro ao carregar não deixa dados do mês anterior na tela')
  await page.goto(`${BASE}/vales?mes=2026-10`); await page.getByText('R$ 180,50').first().waitFor()
  await page.locator('input[type=month]').fill('2026-08')
  await page.getByText(/Erro ao carregar os vales/).waitFor()
  const t6 = await texto()
  ok(!t6.includes('R$ 180,50') && !t6.includes('Pâmela'), 'nenhum vale de outubro aparece em agosto')
  ok(t6.includes('Tentar de novo'), 'oferece "Tentar de novo"')

  console.log('7. Banco sem migração: mensagem clara')
  await page.locator('input[type=month]').fill('2026-07')
  await page.getByText(/migration_vales_v2\.sql/).waitFor()
  ok(true, 'pede para rodar migration_vales_v2.sql')

  console.log('8. Novo vale: lançar outro, repetido, valor alto')
  await page.goto(`${BASE}/vales/novo?mes=2026-11`)
  await page.getByRole('button', { name: 'Neto', exact: true }).click()
  await page.getByText(/Neto ainda não pegou vale em 11\/2026/).waitFor()
  ok(true, 'mostra que Neto ainda não pegou vale no mês')
  await page.getByRole('textbox', { name: 'Valor do vale', exact: true }).fill('20')
  await page.getByRole('button', { name: 'Salvar e lançar outro' }).click()
  await page.getByText(/Vale de R\$\s20,00 para Neto salvo/).waitFor()
  ok(true, 'confirmação "salvo" depois de lançar outro')
  await page.getByRole('button', { name: 'Neto', exact: true }).click()
  await page.getByText(/Neto já pegou R\$\s20,00 em 1 vale/).waitFor()
  ok(true, 'mostra quanto Neto já pegou no mês')
  await page.getByRole('textbox', { name: 'Valor do vale', exact: true }).fill('20')
  await page.getByRole('button', { name: 'Salvar e lançar outro' }).click()
  await page.getByText('Confira antes de salvar').waitFor()
  ok((await texto()).includes('lançamento repetido'), 'avisa vale repetido')
  ok(db.vales.filter((v) => v.data.startsWith('2026-11')).length === 1, 'não salvou o repetido sem confirmar')
  await shot('05-aviso-repetido')
  await page.getByRole('textbox', { name: 'Valor do vale', exact: true }).fill('2000')
  ok(!(await texto()).includes('Confira antes de salvar'), 'mudar o valor desfaz a confirmação antiga')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await page.getByText(/Valor alto/).waitFor()
  ok(true, 'avisa valor alto')
  await page.getByRole('button', { name: 'Está certo, salvar' }).click()
  await page.waitForURL(/\/vales\?mes=2026-11/)
  await page.getByText('R$ 2.020,00').first().waitFor()
  ok(true, 'confirmado: salvou e voltou para a lista (total R$ 2.020,00)')

  console.log('9. Duplo toque não duplica')
  await page.goto(`${BASE}/vales/novo?mes=2026-11`)
  await page.getByRole('button', { name: 'Diogo', exact: true }).click()
  await page.getByRole('textbox', { name: 'Valor do vale', exact: true }).fill('15')
  const antes = db.vales.length
  await page.getByRole('button', { name: 'Salvar', exact: true }).dblclick()
  await page.waitForURL(/\/vales\?mes=2026-11/)
  ok(db.vales.length === antes + 1, 'apenas 1 vale criado com toque duplo')

  console.log('10. Mês fechado bloqueia no formulário')
  await page.goto(`${BASE}/vales/novo?mes=2026-10`)
  await page.locator('input[type=date]').fill('2026-10-20')
  await page.getByText(/já foi fechado/).first().waitFor()
  ok(await page.getByRole('button', { name: 'Salvar', exact: true }).isDisabled(), 'botão salvar desabilitado em mês fechado')
  await shot('06-novo-mes-fechado')

  console.log('11. Nome digitado de outro jeito usa o cadastro existente')
  await page.goto(`${BASE}/vales/novo?mes=2026-11`)
  await page.getByRole('button', { name: /Pessoa/ }).click()
  await page.getByPlaceholder('Nome').fill('  pamela ')
  await page.getByRole('button', { name: 'Adicionar' }).click()
  ok(db.funcionarios.filter((f) => norm(f.nome) === 'pamela').length === 1, 'não criou "pamela" duplicada')
  ok(await page.getByRole('button', { name: 'Pâmela', exact: true }).evaluate((b) => b.className.includes('bg-gray-900')), 'selecionou "Pâmela" do cadastro')

  console.log('12. Reabrir exige motivo')
  await page.goto(`${BASE}/vales?mes=2026-10`)
  await page.getByRole('button', { name: /Reabrir mês/ }).click()
  await page.getByRole('button', { name: 'Reabrir', exact: true }).click()
  ok((await texto()).includes('Escreva o motivo para reabrir'), 'sem motivo: recusa')
  await page.getByPlaceholder(/Motivo \(obrigatório\)/).fill('faltou lançar vale')
  await page.getByRole('button', { name: 'Reabrir', exact: true }).click()
  await page.getByRole('link', { name: /Novo vale/ }).waitFor()
  ok(true, 'mês reaberto')

  console.log('13. PDF e planilha')
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /PDF com assinaturas/ }).click()])
  ok(pdf.suggestedFilename() === 'vales_2026-10.pdf', 'PDF: ' + pdf.suggestedFilename())
  await pdf.saveAs(`${SHOTS}/vales_2026-10.pdf`)
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Planilha/ }).click()])
  await csv.saveAs(`${SHOTS}/vales_2026-10.csv`)
  ok(csv.suggestedFilename() === 'vales_2026-10.csv', 'planilha: ' + csv.suggestedFilename())

  ok(erros.length === 0, 'nenhum erro de JavaScript na página ' + (erros.join(' | ')))
  await browser.close()
  console.log(falhas === 0 ? '\nTUDO OK' : `\n${falhas} FALHA(S)`)
  process.exit(falhas ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
function norm(t) { return (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toLowerCase() }
