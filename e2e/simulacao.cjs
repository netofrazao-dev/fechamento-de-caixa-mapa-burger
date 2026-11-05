// API falsa do Supabase (PostgREST + Auth) em memória, só para testar as telas.
const base = require('./simulacao-base.cjs')
const { uid } = base
const norm = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toLowerCase()

function filtrar(rows, params) {
  for (const [k, val] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue
    const i = val.indexOf('.'); const op = val.slice(0, i); const arg = val.slice(i + 1)
    rows = rows.filter((r) => {
      const x = r[k]
      if (op === 'eq') return String(x) === arg
      if (op === 'neq') return String(x) !== arg
      if (op === 'gte') return x >= arg
      if (op === 'lte') return x <= arg
      if (op === 'in') return arg.replace(/[()]/g, '').split(',').includes(String(x))
      if (op === 'is') return arg === 'null' ? x == null : true
      if (op === 'not' && arg === 'is.null') return x != null
      return true
    })
  }
  return rows
}

function jwt(email) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: 'u1', email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura`
}

function criarDb2() {
  const db = base.criarDb()
  db.fechamentos = []; db.sangrias = []; db.relatorios = []; db.pratos = []; db.rascunhos = []; db.dias_loja_fechada = []
  for (const nome of ['Estrogonofe', 'Frango Grelhado', 'Bife Acebolado']) db.pratos.push({ id: uid(), nome, ativo: true })
  db.produtos_estoque = ['Coca KS', 'Sprite 350ml', 'Monster Azul', 'Água S/G 330ml'].map((nome, i) => ({ id: uid(), nome, ativo: true, ordem: i + 1 }))
  db.funcionarios.forEach((f) => (f.ativo = true))
  db.usuarios = { 'dono@teste.com': 'senha-forte-123', 'intruso@teste.com': 'senha-forte-123' }
  db.autorizados = new Set(['dono@teste.com'])
  db.sessaoEmail = null
  return db
}

function handle2(db, method, path, params, body, wantsObject, hooks) {
  const responder = (rows, status = 200) => {
    if (wantsObject) return rows.length === 1 ? { status, body: rows[0] }
      : { status: 406, body: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }
    return { status, body: rows }
  }
  // --- Auth ---
  if (path.startsWith('/auth/v1/token')) {
    const { email, password } = body || {}
    if (db.usuarios[email] !== password) return { status: 400, body: { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials', code: 'invalid_credentials' } }
    db.sessaoEmail = email
    return { status: 200, body: { access_token: jwt(email), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r' + uid(), user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } } }
  }
  if (path.startsWith('/auth/v1/logout')) return { status: 204, body: null }
  if (path.startsWith('/auth/v1/recover')) { db.emailsRecuperacao = [...(db.emailsRecuperacao || []), body?.email]; return { status: 200, body: {} } }
  if (path.startsWith('/auth/v1/user') && method === 'PUT') {
    if ((body?.password || '').length < 8) return { status: 422, body: { msg: 'Password should be at least 8 characters', code: 'weak_password' } }
    db.usuarios[db.sessaoEmail] = body.password
    return { status: 200, body: { id: 'u1', email: db.sessaoEmail, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } }
  }
  if (path.startsWith('/auth/v1/user')) return { status: 200, body: { id: 'u1', email: db.sessaoEmail, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } }
  const t = path.replace(/^\/rest\/v1\//, '')
  if (t === 'rpc/usuario_autorizado') return { status: 200, body: db.autorizados.has(db.sessaoEmail) }
  const h = hooks?.(method, t, params); if (h) return h

  if (t === 'rascunhos') {
    if (method === 'GET') return responder(filtrar(db.rascunhos, params))
    if (method === 'POST') { db.rascunhos = db.rascunhos.filter((r) => r.chave !== body.chave); db.rascunhos.push(body); return { status: 201, body: null } }
    if (method === 'DELETE') { db.rascunhos = db.rascunhos.filter((r) => !filtrar([r], params).length); return { status: 204, body: null } }
  }
  if (t === 'auditoria') return responder([])
  if (t === 'acertos_mes') return responder(filtrar(db.acertos || [], params))
  if (t === 'rpc/fechar_acerto_mes' || t === 'rpc/reabrir_acerto_mes') {
    db.acertos = db.acertos || []
    const mes = body.p_mes, ini = mes, fim = mes.slice(0, 7) + '-31'
    if (t === 'rpc/reabrir_acerto_mes') {
      db.acertos = db.acertos.filter((a) => a.mes !== mes); db.fechados = db.fechados.filter((f) => f.mes !== mes)
      return { status: 204, body: null }
    }
    const res = (id) => db.funcionarios.find((f) => f.id === id)
    const porNome = (n) => db.funcionarios.find((f) => norm(f.nome) === norm(n))
    const linhas = new Map(); const sem = []
    for (const v of db.vales.filter((v) => !v.excluido_em && v.data >= ini && v.data <= fim)) {
      const l = linhas.get(v.funcionario_id) || { funcionario_id: v.funcionario_id, funcionario: res(v.funcionario_id)?.nome, vales: 0, qtd_vales: 0, consumo: 0, qtd_consumo: 0 }
      l.vales += v.valor; l.qtd_vales++; linhas.set(v.funcionario_id, l)
    }
    for (const r of db.relatorios.filter((r) => r.data >= ini && r.data <= fim)) for (const c of r.consumo_loja_mensal || []) {
      if (!(c.valor > 0)) continue
      const f = (c.funcionarioId && res(c.funcionarioId)) || porNome(c.pessoa)
      if (!f) { sem.push(c); continue }
      const l = linhas.get(f.id) || { funcionario_id: f.id, funcionario: f.nome, vales: 0, qtd_vales: 0, consumo: 0, qtd_consumo: 0 }
      l.consumo += c.valor; l.qtd_consumo++; linhas.set(f.id, l)
    }
    if (sem.length) return { status: 400, body: { code: 'P0001', hint: 'CONSUMO_SEM_FUNCIONARIO', message: `Há ${sem.length} consumo(s) sem funcionário identificado.` } }
    const resumo = [...linhas.values()].map((l) => ({ ...l, total: Math.round((l.vales + l.consumo) * 100) / 100 }))
    const linha = { mes, fechado_em: new Date().toISOString(), total: resumo.reduce((a, l) => a + l.total, 0), total_vales: resumo.reduce((a, l) => a + l.vales, 0), total_consumo: resumo.reduce((a, l) => a + l.consumo, 0), resumo, observacao: body.p_observacao, usuario: db.sessaoEmail }
    db.acertos.push(linha)
    if (!db.fechados.some((f) => f.mes === mes)) db.fechados.push({ mes, fechado_em: new Date().toISOString(), total: linha.total_vales, quantidade: 0, resumo: [], observacao: 'junto com o acerto' })
    return { status: 200, body: linha }
  }
  if (t === 'copias_seguranca') {
    const copia = { id: 7, criada_em: '2026-11-02T12:00:00Z', origem: 'automatica', tamanho_bytes: 1234, quantidades: { fechamentos: db.fechamentos.length, relatorios: db.relatorios.length, vales: db.vales.length } }
    const qs = Object.fromEntries(params)
    if ((qs.select || '').includes('dados')) return responder([{ dados: { sistema: 'Mapa Burger', fechamentos: db.fechamentos } }])
    return responder([copia])
  }
  if (t === 'produtos_estoque' && db.produtos_estoque) {
    const tabela = db.produtos_estoque
    if (method === 'GET') return responder([...tabela].sort((a, b) => a.ordem - b.ordem))
    if (method === 'POST') {
      if (tabela.some((p) => norm(p.nome) === norm(body.nome))) return { status: 409, body: { code: '23505', message: 'duplicate' } }
      const p = { id: uid(), nome: body.nome, ativo: true, ordem: Math.max(0, ...tabela.map((x) => x.ordem)) + 1 }; tabela.push(p); return responder([p], 201)
    }
    if (method === 'PATCH') { const alvo = filtrar(tabela, params); alvo.forEach((r) => Object.assign(r, body)); return responder(alvo) }
  }
  if (t === 'pratos' || (t === 'funcionarios' && method !== 'GET' && method !== 'POST')) {
    const tabela = db[t]
    if (method === 'GET') return responder([...tabela].sort((a, b) => a.nome.localeCompare(b.nome)))
    if (method === 'POST') {
      if (tabela.some((p) => norm(p.nome) === norm(body.nome))) return { status: 409, body: { code: '23505', message: 'duplicate' } }
      const p = { id: uid(), nome: body.nome, ativo: true }; tabela.push(p); return responder([p], 201)
    }
    if (method === 'PATCH') { const alvo = filtrar(tabela, params); alvo.forEach((r) => Object.assign(r, body)); return responder(alvo) }
  }
  if (t === 'dias_loja_fechada' && db.dias_loja_fechada) {
    if (method === 'GET') return responder(filtrar(db.dias_loja_fechada, params).sort((a, b) => a.data.localeCompare(b.data)))
    if (method === 'POST') {
      if (db.fechamentos.some((f) => f.data === body.data)) return { status: 400, body: { code: 'P0001', message: `O dia ${body.data.split('-').reverse().join('/')} já tem fechamento de caixa salvo; não dá para marcar como loja fechada.` } }
      if (db.dias_loja_fechada.some((d) => d.data === body.data)) return { status: 409, body: { code: '23505', message: 'duplicate key value violates unique constraint' } }
      const d = { id: uid(), data: body.data, motivo: body.motivo ?? null, marcado_em: new Date().toISOString(), usuario: db.sessaoEmail }
      db.dias_loja_fechada.push(d); return { status: 201, body: null }
    }
    if (method === 'DELETE') { db.dias_loja_fechada = db.dias_loja_fechada.filter((d) => !filtrar([d], params).length); return { status: 204, body: null } }
  }
  if (t === 'fechamentos') {
    const comSangrias = (f) => ({ ...f, sangrias: db.sangrias.filter((s) => s.fechamento_id === f.id) })
    if (method === 'GET' || method === 'HEAD') return responder(filtrar(db.fechamentos, params).sort((a, b) => b.data.localeCompare(a.data)).map(comSangrias))
    if (method === 'POST') {
      if (db.fechamentos.some((f) => f.data === body.data && f.turno === body.turno)) return { status: 409, body: { code: '23505', message: 'duplicate key value violates unique constraint' } }
      const f = { id: uid(), created_at: new Date().toISOString(), ...body }; db.fechamentos.push(f)
      if (db.dias_loja_fechada) db.dias_loja_fechada = db.dias_loja_fechada.filter((d) => d.data !== f.data) // gatilho da v9
      return responder([f], 201)
    }
    if (method === 'PATCH') { const alvo = filtrar(db.fechamentos, params); alvo.forEach((r) => Object.assign(r, body)); return responder(alvo) }
    if (method === 'DELETE') { const alvo = filtrar(db.fechamentos, params); db.fechamentos = db.fechamentos.filter((f) => !alvo.includes(f)); db.sangrias = db.sangrias.filter((s) => !alvo.some((f) => f.id === s.fechamento_id)); return responder(alvo) }
  }
  if (t === 'sangrias') {
    if (method === 'GET') return responder(filtrar(db.sangrias, params))
    if (method === 'POST') { const novas = (Array.isArray(body) ? body : [body]).map((s) => ({ id: uid(), ...s })); db.sangrias.push(...novas); return { status: 201, body: null } }
    if (method === 'DELETE') { const alvo = filtrar(db.sangrias, params); db.sangrias = db.sangrias.filter((s) => !alvo.includes(s)); return { status: 204, body: null } }
  }
  if (t === 'relatorios') {
    if (method === 'GET') {
      const sel = (Object.fromEntries(params).select || '*')
      const cols = sel === '*' ? null : sel.split(',').map((c) => c.trim())
      const proj = (r) => (cols ? Object.fromEntries(cols.map((c) => [c, r[c]])) : r)
      return responder(filtrar(db.relatorios, params).sort((a, b) => b.data.localeCompare(a.data)).map(proj))
    }
    if (method === 'POST') {
      if (db.relatorios.some((r) => r.data === body.data)) return { status: 409, body: { code: '23505', message: 'duplicate' } }
      const r = { id: uid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...body }; db.relatorios.push(r); return responder([r], 201)
    }
    if (method === 'PATCH') { const alvo = filtrar(db.relatorios, params); alvo.forEach((r) => Object.assign(r, body)); return responder(alvo) }
    if (method === 'DELETE') { const alvo = filtrar(db.relatorios, params); db.relatorios = db.relatorios.filter((r) => !alvo.includes(r)); return responder(alvo) }
  }
  return base.handle(db, method, path, params, body, wantsObject)
}
module.exports = { criarDb2, handle2, uid, jwt }
