// API falsa do Supabase (PostgREST) em memória, imitando as regras do banco
// (mesmas da migração v2) só para testar as telas.
const norm = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toLowerCase()
let n = 0
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`

function criarDb() {
  const db = { funcionarios: [], vales: [], fechados: [], historico: [] }
  for (const nome of ['Neto', 'Pâmela', 'Oneide', 'Diogo', 'Luciano'])
    db.funcionarios.push({ id: uid(), nome, created_at: new Date().toISOString() })
  return db
}
function fechado(db, data) { return db.fechados.some((f) => f.mes === data.slice(0, 7) + '-01') }
function erroMesFechado(data) {
  return { status: 400, body: { code: 'P0001', hint: 'MES_FECHADO', details: null,
    message: `O mês ${data.slice(5, 7)}/${data.slice(0, 4)} já foi fechado (vales descontados na folha). Reabra o mês para alterar.` } }
}
function resolverFunc(db, nome) {
  let f = db.funcionarios.find((x) => norm(x.nome) === norm(nome))
  if (!f) { f = { id: uid(), nome: nome.trim().replace(/\s+/g, ' '), created_at: new Date().toISOString() }; db.funcionarios.push(f) }
  return f
}
function hist(db, operacao, antes, depois, detalhe, mesData) {
  db.historico.push({ id: db.historico.length + 1, registrado_em: new Date().toISOString(), operacao,
    vale_id: (depois || antes)?.id ?? null, mes: (mesData || (depois || antes).data).slice(0, 7) + '-01',
    antes, depois, detalhe: detalhe ?? null })
}
const comEmbed = (db, v) => ({ ...v, funcionarios: { nome: db.funcionarios.find((f) => f.id === v.funcionario_id)?.nome } })

function filtrar(rows, params) {
  for (const [k, val] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue
    const [op, ...rest] = val.split('.'); const arg = rest.join('.')
    rows = rows.filter((r) => {
      const x = r[k]
      if (op === 'eq') return String(x) === arg
      if (op === 'gte') return x >= arg
      if (op === 'lte') return x <= arg
      if (op === 'is') return arg === 'null' ? x == null : true
      if (op === 'not' && arg === 'is.null') return x != null
      return true
    })
  }
  return rows
}

function handle(db, method, path, params, body, wantsObject, hooks) {
  const tabela = path.replace(/^\/rest\/v1\//, '')
  const h = hooks?.(method, tabela, params); if (h) return h
  const responder = (rows) => {
    if (wantsObject) return rows.length === 1 ? { status: 200, body: rows[0] }
      : { status: 406, body: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: '', hint: null } }
    return { status: 200, body: rows }
  }
  if (tabela === 'funcionarios') {
    if (method === 'GET') return { status: 200, body: [...db.funcionarios].sort((a, b) => a.nome.localeCompare(b.nome)) }
    if (method === 'POST') {
      if (db.funcionarios.some((f) => norm(f.nome) === norm(body.nome))) return { status: 409, body: { code: '23505', message: 'duplicate' } }
      return responder([resolverFunc(db, body.nome)])
    }
  }
  if (tabela === 'vales') {
    if (method === 'GET') {
      const rows = filtrar(db.vales, params).sort((a, b) => a.data.localeCompare(b.data) || a.created_at.localeCompare(b.created_at))
      return responder(rows.map((v) => comEmbed(db, v)))
    }
    if (method === 'POST') {
      if (!(body.valor > 0)) return { status: 400, body: { code: '23514', message: 'O valor do vale precisa ser maior que zero.' } }
      if (fechado(db, body.data)) return erroMesFechado(body.data)
      const f = resolverFunc(db, body.funcionario)
      const v = { id: uid(), funcionario: f.nome, funcionario_id: f.id, data: body.data, valor: body.valor,
        observacao: body.observacao || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        excluido_em: null, motivo_exclusao: null }
      db.vales.push(v); hist(db, 'criado', null, { ...v })
      return responder([comEmbed(db, v)])
    }
    if (method === 'PATCH') {
      const alvo = filtrar(db.vales, params)
      for (const v of alvo) {
        const novo = { ...v, ...body }
        if (fechado(db, v.data)) return erroMesFechado(v.data)
        if (fechado(db, novo.data)) return erroMesFechado(novo.data)
        if (v.excluido_em && novo.excluido_em) return { status: 400, body: { code: 'P0001', message: 'Este vale foi excluído. Restaure-o antes de editar.' } }
        if (novo.excluido_em && !novo.motivo_exclusao) return { status: 400, body: { code: '23514', message: 'check' } }
        if (!novo.funcionario_id) { const f = resolverFunc(db, novo.funcionario); novo.funcionario_id = f.id; novo.funcionario = f.nome }
        const antes = { ...v }
        Object.assign(v, novo, { updated_at: new Date().toISOString() })
        const op = !antes.excluido_em && v.excluido_em ? 'excluido' : antes.excluido_em && !v.excluido_em ? 'restaurado' : 'alterado'
        hist(db, op, antes, { ...v }, op === 'excluido' ? v.motivo_exclusao : null)
      }
      return responder(alvo.map((v) => comEmbed(db, v)))
    }
  }
  if (tabela === 'vales_meses_fechados') return responder(filtrar(db.fechados, params))
  if (tabela === 'vales_historico')
    return responder(filtrar(db.historico, params).sort((a, b) => b.id - a.id))
  if (tabela === 'rpc/fechar_mes_vales') {
    const mes = body.p_mes
    if (db.fechados.some((f) => f.mes === mes)) return { status: 400, body: { code: 'P0001', hint: 'MES_FECHADO', message: 'já fechado' } }
    const ativos = db.vales.filter((v) => !v.excluido_em && v.data.slice(0, 7) === mes.slice(0, 7))
    const mapa = new Map()
    for (const v of ativos) { const g = mapa.get(v.funcionario_id) ?? { funcionario_id: v.funcionario_id, funcionario: v.funcionario, total: 0, quantidade: 0 }; g.total = Math.round(g.total * 100 + v.valor * 100) / 100; g.quantidade++; mapa.set(v.funcionario_id, g) }
    const linha = { mes, fechado_em: new Date().toISOString(), total: [...mapa.values()].reduce((a, g) => a + g.total, 0),
      quantidade: ativos.length, resumo: [...mapa.values()], observacao: body.p_observacao }
    db.fechados.push(linha); hist(db, 'mes_fechado', null, linha, linha.observacao, mes)
    return { status: 200, body: linha }
  }
  if (tabela === 'rpc/reabrir_mes_vales') {
    const i = db.fechados.findIndex((f) => f.mes === body.p_mes)
    const [linha] = db.fechados.splice(i, 1); hist(db, 'mes_reaberto', linha, null, body.p_motivo, body.p_mes)
    return { status: 204, body: null }
  }
  return { status: 404, body: { message: 'mock: rota não tratada ' + method + ' ' + tabela } }
}
module.exports = { criarDb, handle, uid }
