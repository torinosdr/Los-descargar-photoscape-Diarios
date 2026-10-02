/* Fase 10 · MercadoLibre (estructura y flujos locales), Anuncios internos y Auditoría.
   Replica la lógica de la migración 021 (ml_*, announcement_*, v_audit_log). No hay conexión real con MercadoLibre. */
(function (N) {
  const K = {
    'rail.mercadolibre': ['MercadoLibre', 'MercadoLibre', 'MercadoLibre'], 'rail.audit': ['Auditoría', 'Audit log', 'Auditoria'],
    'ml.sec.overview': ['Resumen', 'Overview', 'Resumo'], 'ml.sec.pubs': ['Publicaciones', 'Listings', 'Anúncios'], 'ml.sec.orders': ['Órdenes', 'Orders', 'Pedidos'], 'ml.sec.questions': ['Preguntas', 'Questions', 'Perguntas'], 'ml.sec.stock': ['Stock', 'Stock', 'Estoque'],
    'ml.notice': ['Estructura lista: todavía no hay conexión real con MercadoLibre. Las cuentas se conectan cuando se active la integración; mientras tanto podés preparar publicaciones y probar el circuito con órdenes de ejemplo.', 'Structure ready: there is no live MercadoLibre connection yet. Accounts connect once the integration is switched on; meanwhile you can prepare listings and try the flow with sample orders.', 'Estrutura pronta: ainda não há conexão real com o MercadoLibre. As contas se conectam quando a integração for ativada; enquanto isso você pode preparar anúncios e testar o fluxo com pedidos de exemplo.'],
    'ml.kpi.accounts': ['Cuentas conectadas', 'Connected accounts', 'Contas conectadas'], 'ml.kpi.active': ['Publicaciones activas', 'Active listings', 'Anúncios ativos'], 'ml.kpi.orders': ['Órdenes importadas', 'Imported orders', 'Pedidos importados'], 'ml.kpi.questions': ['Preguntas sin responder', 'Unanswered questions', 'Perguntas sem resposta'], 'ml.kpi.stock': ['Stock por sincronizar', 'Stock to sync', 'Estoque a sincronizar'],
    'ml.accounts': ['Cuentas', 'Accounts', 'Contas'], 'ml.add_account': ['Agregar cuenta', 'Add account', 'Adicionar conta'], 'ml.f.user': ['Usuario de MercadoLibre', 'MercadoLibre user', 'Usuário do MercadoLibre'], 'ml.f.nick': ['Apodo', 'Nickname', 'Apelido'], 'ml.f.site': ['Sitio', 'Site', 'Site'],
    'ml.acc.Pendiente': ['Pendiente de conexión', 'Awaiting connection', 'Aguardando conexão'], 'ml.acc.Conectada': ['Conectada', 'Connected', 'Conectada'], 'ml.acc.Error': ['Con error', 'Error', 'Com erro'], 'ml.acc.Desconectada': ['Desconectada', 'Disconnected', 'Desconectada'],
    'ml.disconnect': ['Desconectar', 'Disconnect', 'Desconectar'], 'ml.e.user': ['Indicá el usuario de MercadoLibre', 'Enter the MercadoLibre user', 'Informe o usuário do MercadoLibre'], 'ml.t.account': ['Cuenta agregada', 'Account added', 'Conta adicionada'], 'ml.t.disconnected': ['Cuenta desconectada; sus publicaciones activas quedaron pausadas', 'Account disconnected; its active listings were paused', 'Conta desconectada; os anúncios ativos foram pausados'],
    'ml.col.title': ['Publicación', 'Listing', 'Anúncio'], 'ml.col.account': ['Cuenta', 'Account', 'Conta'], 'ml.col.price': ['Precio', 'Price', 'Preço'], 'ml.col.stock': ['Stock publicado', 'Listed stock', 'Estoque anunciado'], 'ml.col.status': ['Estado', 'Status', 'Status'],
    'ml.pub.Preparado': ['Preparada', 'Prepared', 'Preparado'], 'ml.pub.Activa': ['Activa', 'Active', 'Ativo'], 'ml.pub.Pausada': ['Pausada', 'Paused', 'Pausado'], 'ml.pub.Cerrada': ['Cerrada', 'Closed', 'Encerrado'], 'ml.pub.Error': ['Con error', 'Error', 'Com erro'],
    'ml.prepare': ['Preparar publicación', 'Prepare listing', 'Preparar anúncio'], 'ml.f.product': ['Producto', 'Product', 'Produto'], 'ml.f.account': ['Cuenta', 'Account', 'Conta'], 'ml.f.title': ['Título (máx. 60)', 'Title (max 60)', 'Título (máx. 60)'], 'ml.f.price': ['Precio', 'Price', 'Preço'], 'ml.f.stock': ['Stock a publicar', 'Stock to list', 'Estoque a anunciar'], 'ml.no_account': ['Sin cuenta todavía', 'No account yet', 'Sem conta ainda'],
    'ml.e.product': ['Elegí un producto', 'Choose a product', 'Escolha um produto'], 'ml.e.dup': ['Ese producto ya tiene una publicación para esa cuenta', 'That product already has a listing for that account', 'Esse produto já tem um anúncio para essa conta'], 'ml.e.price': ['El precio no puede ser negativo', 'Price cannot be negative', 'O preço não pode ser negativo'],
    'ml.a.activate': ['Activar', 'Activate', 'Ativar'], 'ml.a.pause': ['Pausar', 'Pause', 'Pausar'], 'ml.a.close': ['Cerrar', 'Close', 'Encerrar'], 'ml.e.noconn': ['Conectá una cuenta de MercadoLibre antes de activar la publicación', 'Connect a MercadoLibre account before activating the listing', 'Conecte uma conta do MercadoLibre antes de ativar o anúncio'], 'ml.e.nostock': ['No se puede activar una publicación sin stock', 'A listing without stock cannot be activated', 'Não é possível ativar um anúncio sem estoque'], 'ml.e.prep_pause': ['Una publicación preparada se activa o se cierra', 'A prepared listing is activated or closed', 'Um anúncio preparado é ativado ou encerrado'],
    'ml.t.prepared': ['Publicación preparada', 'Listing prepared', 'Anúncio preparado'], 'ml.t.status': ['Publicación actualizada', 'Listing updated', 'Anúncio atualizado'],
    'ml.col.order': ['Orden ML', 'ML order', 'Pedido ML'], 'ml.col.buyer': ['Comprador', 'Buyer', 'Comprador'], 'ml.col.sale': ['Venta', 'Sale', 'Venda'], 'ml.col.total': ['Total', 'Total', 'Total'], 'ml.col.date': ['Fecha', 'Date', 'Data'], 'ml.import': ['Importar orden de ejemplo', 'Import sample order', 'Importar pedido de exemplo'],
    'ml.f.buyer': ['Apodo del comprador', 'Buyer nickname', 'Apelido do comprador'], 'ml.f.email': ['Email del comprador', 'Buyer email', 'E-mail do comprador'], 'ml.f.qty': ['Cantidad', 'Quantity', 'Quantidade'], 'ml.e.account': ['Elegí una cuenta', 'Choose an account', 'Escolha uma conta'], 'ml.e.buyer': ['Ingresá el comprador', 'Enter the buyer', 'Informe o comprador'], 'ml.e.qty': ['Cantidad inválida', 'Invalid quantity', 'Quantidade inválida'],
    'ml.t.order': ['Orden importada: venta, factura y cobro creados', 'Order imported: sale, invoice and payment created', 'Pedido importado: venda, fatura e recebimento criados'], 'ml.order_hint': ['Cada orden crea (o reutiliza) al cliente, la venta, la factura y el cobro con Mercado Pago.', 'Each order creates (or reuses) the customer, the sale, the invoice and the Mercado Pago payment.', 'Cada pedido cria (ou reutiliza) o cliente, a venda, a fatura e o recebimento via Mercado Pago.'],
    'ml.col.question': ['Pregunta', 'Question', 'Pergunta'], 'ml.col.item': ['Publicación', 'Listing', 'Anúncio'], 'ml.q.Sin responder': ['Sin responder', 'Unanswered', 'Sem resposta'], 'ml.q.Respondida': ['Respondida', 'Answered', 'Respondida'], 'ml.answer': ['Responder', 'Answer', 'Responder'], 'ml.f.answer': ['Respuesta', 'Answer', 'Resposta'], 'ml.e.answer': ['Escribí la respuesta', 'Write the answer', 'Escreva a resposta'], 'ml.e.answer_len': ['La respuesta supera los 2000 caracteres', 'The answer is over 2000 characters', 'A resposta passa de 2000 caracteres'], 'ml.t.answered': ['Pregunta respondida', 'Question answered', 'Pergunta respondida'],
    'ml.col.local': ['Stock local', 'Local stock', 'Estoque local'], 'ml.col.ml': ['En MercadoLibre', 'On MercadoLibre', 'No MercadoLibre'], 'ml.sync.Pendiente': ['Falta enviar', 'To send', 'A enviar'], 'ml.sync.Sincronizado': ['Sincronizado', 'In sync', 'Sincronizado'], 'ml.refresh': ['Comparar stock', 'Compare stock', 'Comparar estoque'], 'ml.t.refresh': ['Stock comparado', 'Stock compared', 'Estoque comparado'], 'ml.stock_hint': ['La comparación marca qué falta enviar; el envío lo hará la integración.', 'The comparison marks what is left to send; the integration will do the sending.', 'A comparação marca o que falta enviar; o envio será feito pela integração.'],
    'an.new': ['Nuevo anuncio', 'New announcement', 'Novo aviso'], 'an.Borrador': ['Borrador', 'Draft', 'Rascunho'], 'an.Publicado': ['Publicado', 'Published', 'Publicado'], 'an.Archivado': ['Archivado', 'Archived', 'Arquivado'],
    'an.sev.info': ['Información', 'Info', 'Informação'], 'an.sev.aviso': ['Aviso', 'Warning', 'Aviso'], 'an.sev.crítico': ['Crítico', 'Critical', 'Crítico'],
    'an.aud.Todos': ['Todo el equipo', 'Whole team', 'Toda a equipe'], 'an.aud.Usuarios seleccionados': ['Usuarios elegidos', 'Selected users', 'Usuários escolhidos'], 'an.aud.Clientes': ['Clientes', 'Customers', 'Clientes'],
    'an.col.title': ['Anuncio', 'Announcement', 'Aviso'], 'an.col.aud': ['Para', 'For', 'Para'], 'an.col.sev': ['Importancia', 'Importance', 'Importância'], 'an.col.status': ['Estado', 'Status', 'Status'], 'an.col.date': ['Fecha', 'Date', 'Data'], 'an.col.reads': ['Leído por', 'Read by', 'Lido por'],
    'an.f.title': ['Título', 'Title', 'Título'], 'an.f.message': ['Mensaje', 'Message', 'Mensagem'], 'an.f.aud': ['Destinatarios', 'Recipients', 'Destinatários'], 'an.f.sev': ['Importancia', 'Importance', 'Importância'], 'an.f.expires': ['Vence (opcional)', 'Expires (optional)', 'Vence (opcional)'], 'an.f.users': ['Usuarios', 'Users', 'Usuários'],
    'an.e.text': ['El anuncio necesita título y mensaje', 'The announcement needs a title and a message', 'O aviso precisa de título e mensagem'], 'an.e.users': ['Elegí al menos un usuario destinatario', 'Choose at least one recipient', 'Escolha ao menos um destinatário'],
    'an.a.publish': ['Publicar', 'Publish', 'Publicar'], 'an.a.archive': ['Archivar', 'Archive', 'Arquivar'], 'an.a.read': ['Marcar como leído', 'Mark as read', 'Marcar como lido'], 'an.t.created': ['Anuncio guardado como borrador', 'Announcement saved as draft', 'Aviso salvo como rascunho'], 'an.t.published': ['Anuncio publicado', 'Announcement published', 'Aviso publicado'], 'an.t.archived': ['Anuncio archivado', 'Announcement archived', 'Aviso arquivado'], 'an.t.read': ['Marcado como leído', 'Marked as read', 'Marcado como lido'],
    'an.mine': ['Para mí', 'For me', 'Para mim'], 'an.all': ['Todos los anuncios', 'All announcements', 'Todos os avisos'], 'an.unread': ['Sin leer', 'Unread', 'Não lidos'], 'an.none': ['No hay anuncios vigentes', 'No current announcements', 'Não há avisos vigentes'], 'an.ntf_sub': ['Anuncio del equipo', 'Team announcement', 'Aviso da equipe'], 'an.expires': ['Vence', 'Expires', 'Vence'],
    'au.col.when': ['Cuándo', 'When', 'Quando'], 'au.col.user': ['Usuario', 'User', 'Usuário'], 'au.col.action': ['Acción', 'Action', 'Ação'], 'au.col.entity': ['Registro', 'Record', 'Registro'], 'au.col.detail': ['Qué cambió', 'What changed', 'O que mudou'],
    'au.insert': ['Alta', 'Created', 'Criado'], 'au.update': ['Cambio', 'Changed', 'Alterado'], 'au.delete': ['Baja', 'Deleted', 'Excluído'],
    'au.e.customers': ['Cliente', 'Customer', 'Cliente'], 'au.e.sales': ['Venta', 'Sale', 'Venda'], 'au.e.products': ['Producto', 'Product', 'Produto'], 'au.e.ml_publications': ['Publicación ML', 'ML listing', 'Anúncio ML'], 'au.e.announcements': ['Anuncio', 'Announcement', 'Aviso'], 'au.e.ml_accounts': ['Cuenta ML', 'ML account', 'Conta ML'], 'au.e.price_lists': ['Lista de precios', 'Price list', 'Lista de preços'],
    'au.field': ['Campo', 'Field', 'Campo'], 'au.old': ['Antes', 'Before', 'Antes'], 'au.new': ['Después', 'After', 'Depois'], 'au.created_values': ['Datos al crearse', 'Values at creation', 'Dados na criação'], 'au.no_detail': ['Sin detalle', 'No detail', 'Sem detalhe'], 'au.history': ['Historial del registro', 'Record history', 'Histórico do registro'], 'au.hint': ['Solo quienes tienen permiso de auditoría ven esta bitácora.', 'Only people with audit permission see this log.', 'Só quem tem permissão de auditoria vê este registro.']
  };
  ['es-AR', 'en', 'pt-BR'].forEach((lg, i) => Object.keys(K).forEach((k) => (N.DICT[lg][k] = K[k][i])));

  const D = N.data, TODAY = '2026-10-01', ME = 'Ana Demo', R = (N.routes = N.routes || {}), t = (k) => N.t(k), esc = N.esc, money = (m) => N.money(m);
  const USERS = ['Ana Demo', 'Marcos Ríos', 'Vale Sosa', 'Carlos Vega'];
  const prod = (sku) => D.products2.find((p) => p.sku === sku);
  const stockOf = (p) => Object.values(p.stock).reduce((a, b) => a + b, 0) - (p.reserved || 0);
  const nid = (arr, pfx) => pfx + '-' + String(arr.length + 1).padStart(4, '0');
  const ok = (key) => { N.toast(t(key)); N.rerender(); };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /* ================= Auditoría (v_audit_log) ================= */
  const AU = (N.audit = {
    rows: [],
    log(action, entity, id, label, detail) { this.rows.unshift({ id: 'AUD-' + String(this.rows.length + 1).padStart(4, '0'), at: TODAY + 'T' + new Date().toTimeString().slice(0, 5), user: ME, action, entity, rid: id, label, detail: detail || {} }); },
    diff(a, b) { const d = {}; Object.keys(Object.assign({}, a, b)).forEach((k) => { if (k === 'updated_at') return; if (JSON.stringify((a || {})[k]) !== JSON.stringify((b || {})[k])) d[k] = { old: a && k in a ? a[k] : null, new: b && k in b ? b[k] : null }; }); return d; },
    forRecord(entity, id) { return this.rows.filter((r) => r.entity === entity && r.rid === id); }
  });
  [
    ['2026-10-01T09:12', 'Marcos Ríos', 'update', 'customers', 'CLI-0002', 'Distribuidora Norte', { credit_limit: { old: 200000000, new: 250000000 } }],
    ['2026-09-30T17:40', 'Ana Demo', 'update', 'customers', 'CLI-0006', 'Ferretería Central', { phone: { old: '+54 11 5555-0606', new: '+54 11 5555-0660' }, status: { old: 'prospect', new: 'active' } }],
    ['2026-09-30T11:05', 'Vale Sosa', 'insert', 'sales', 'VTA-0009', 'VTA-0009', { customer: { old: null, new: 'CLI-0009' }, status: { old: null, new: 'pendiente' } }],
    ['2026-09-29T15:22', 'Carlos Vega', 'update', 'products', 'SKU-004', 'Cable USB-C 2m', { sale_price: { old: 200000, new: 220000 } }],
    ['2026-09-29T10:10', 'Ana Demo', 'update', 'price_lists', 'PL-MAY', 'Lista mayorista', { discount_pct: { old: 8, new: 10 } }],
    ['2026-09-28T16:45', 'Marcos Ríos', 'delete', 'customers', 'CLI-0011', 'Cliente de prueba', { deleted_at: { old: null, new: '2026-09-28' } }],
    ['2026-09-26T12:00', 'Carlos Vega', 'update', 'sales', 'VTA-0004', 'VTA-0004', { status: { old: 'pendiente', new: 'preparacion' } }]
  ].reverse().forEach((r) => { AU.rows.unshift({ id: nid(AU.rows, 'AUD'), at: r[0], user: r[1], action: r[2], entity: r[3], rid: r[4], label: r[5], detail: r[6] }); });

  const detailChips = (r) => { const ks = Object.keys(r.detail); return ks.length ? ks.slice(0, 3).map((k) => `<span class="chip plain">${esc(k)}</span>`).join(' ') + (ks.length > 3 ? ` <small class="muted">+${ks.length - 3}</small>` : '') : '<span class="muted">—</span>'; };
  const fmtV = (v) => (v === null || v === undefined ? '—' : typeof v === 'number' && /_minor|limit|price|total|amount|cost/.test('') ? money(v) : String(v));
  function auditDetail(r) {
    const ks = Object.keys(r.detail), isIns = r.action === 'insert';
    const rows = ks.map((k) => `<tr><td class="mono">${esc(k)}</td>${isIns ? '' : `<td>${esc(fmtV(r.detail[k].old))}</td>`}<td><b>${esc(fmtV(r.detail[k].new))}</b></td></tr>`).join('');
    const hist = AU.forRecord(r.entity, r.rid);
    N.drawer({ title: t('au.e.' + r.entity) + ' · ' + r.label, saveLabel: t('common.close'), onSave(d, close) { close(); },
      body: `<div style="display:flex;gap:8px;flex-wrap:wrap">${actionChip(r.action)}${N.chip('', r.user, true)}</div><p class="muted">${N.date(r.at.slice(0, 10))} · ${r.at.slice(11, 16)}</p>
        ${ks.length ? `<table class="tbl" style="width:100%"><thead><tr><th>${t('au.field')}</th>${isIns ? '' : `<th>${t('au.old')}</th>`}<th>${t(isIns ? 'au.created_values' : 'au.new')}</th></tr></thead><tbody>${rows}</tbody></table>` : `<p class="muted">${t('au.no_detail')}</p>`}
        <h3 style="margin-top:18px">${t('au.history')}</h3>${hist.map((h) => `<div class="tl"><span class="dot">${N.icon(h.action === 'insert' ? 'plus' : h.action === 'delete' ? 'x' : 'edit')}</span><div style="flex:1"><b>${t('au.' + h.action)}</b> · ${esc(h.user)}<div class="muted">${N.date(h.at.slice(0, 10))} ${h.at.slice(11, 16)}</div></div></div>`).join('')}` });
  }
  const actionChip = (a) => N.chip({ insert: 'ok', update: 'info', delete: 'danger' }[a], t('au.' + a));
  R['auditoria/'] = (node) => {
    node.append(N.el(`<p class="muted" style="margin:0 0 12px">${t('au.hint')}</p>`));
    node.append(N.table({
      id: 'auditoria', rows: AU.rows.slice().sort((a, b) => b.at.localeCompare(a.at)), id_of: (r) => r.id, sort: null, text: (r) => [r.user, r.label, r.rid, t('au.e.' + r.entity), Object.keys(r.detail).join(' ')].join(' '),
      cols: [
        { key: 'at', label: 'au.col.when', value: (r) => r.at, render: (r) => N.date(r.at.slice(0, 10)) + ' <small class="muted">' + r.at.slice(11, 16) + '</small>' },
        { key: 'user', label: 'au.col.user', value: (r) => r.user, render: (r) => `<div class="who"><span class="av">${N.initials(r.user)}</span><div><b>${esc(r.user)}</b></div></div>` },
        { key: 'action', label: 'au.col.action', value: (r) => r.action, render: (r) => actionChip(r.action) },
        { key: 'entity', label: 'au.col.entity', value: (r) => r.label, render: (r) => `<b>${esc(r.label)}</b> <small class="muted">${esc(t('au.e.' + r.entity))}</small>` },
        { key: 'detail', label: 'au.col.detail', value: (r) => Object.keys(r.detail).join(','), render: detailChips }
      ],
      filters: ['insert', 'update', 'delete'].map((a) => ({ key: a, label: 'au.' + a, fn: (r) => r.action === a })),
      onRow: auditDetail
    }));
  };

  /* ================= MercadoLibre ================= */
  if (!D.mlAccounts) {
    D.mlAccounts = [
      { id: 'MLC-0001', user: '482910553', nick: 'NEXO_DISTRIBUIDORA', site: 'MLA', status: 'Conectada' },
      { id: 'MLC-0002', user: '771002834', nick: 'NEXO_OUTLET', site: 'MLA', status: 'Pendiente' }
    ];
    D.mlPubs = [
      { id: 'PUB-0001', sku: 'SKU-001', account: 'MLC-0001', title: 'Auriculares Pro inalámbricos', price: 2500000, stock: 7, status: 'Activa' },
      { id: 'PUB-0002', sku: 'SKU-005', account: 'MLC-0001', title: 'Soporte para notebook aluminio', price: 1190000, stock: 20, status: 'Activa' },
      { id: 'PUB-0003', sku: 'SKU-002', account: 'MLC-0001', title: 'Mouse inalámbrico ergonómico', price: 790000, stock: 8, status: 'Pausada' },
      { id: 'PUB-0004', sku: 'SKU-003', account: null, title: 'Teclado mecánico', price: 2100000, stock: 0, status: 'Preparado' }
    ];
    D.mlOrders = [];
    D.mlQuestions = [
      { id: 'Q-0001', pub: 'PUB-0001', text: '¿Tienen garantía oficial?', at: '2026-10-01T08:40', status: 'Sin responder', answer: '' },
      { id: 'Q-0002', pub: 'PUB-0002', text: '¿Sirve para notebooks de 17 pulgadas?', at: '2026-09-30T19:15', status: 'Sin responder', answer: '' },
      { id: 'Q-0003', pub: 'PUB-0001', text: '¿Hacen envíos a Mendoza?', at: '2026-09-28T13:02', status: 'Respondida', answer: 'Sí, enviamos a todo el país en 48 a 72 horas.' }
    ];
    D.mlSync = [];
  }
  const acc = (id) => D.mlAccounts.find((a) => a.id === id), pub = (id) => D.mlPubs.find((p) => p.id === id);
  const ML = (N.ml = {
    register(d) {
      if (!d.user.trim()) return { user: t('ml.e.user') };
      D.mlAccounts.push({ id: nid(D.mlAccounts, 'MLC'), user: d.user.trim(), nick: d.nick.trim() || null, site: d.site, status: 'Pendiente' });
      AU.log('insert', 'ml_accounts', D.mlAccounts[D.mlAccounts.length - 1].id, d.nick.trim() || d.user.trim(), { ml_user_id: { old: null, new: d.user.trim() } }); return null;
    },
    disconnect(a) { a.status = 'Desconectada'; D.mlPubs.filter((p) => p.account === a.id && p.status === 'Activa').forEach((p) => (p.status = 'Pausada')); AU.log('update', 'ml_accounts', a.id, a.nick || a.user, { status: { old: 'Conectada', new: 'Desconectada' } }); },
    prepare(d) {
      const p = prod(d.sku); if (!p) return { sku: t('ml.e.product') };
      const a = d.account || null;
      if (D.mlPubs.some((x) => x.sku === d.sku && x.status !== 'Cerrada' && (x.account || null) === a)) return { sku: t('ml.e.dup') };
      const price = d.price === '' ? p.price : Math.round(+d.price * 100); if (price < 0) return { price: t('ml.e.price') };
      const pb = { id: nid(D.mlPubs, 'PUB'), sku: p.sku, account: a, title: (d.title.trim() || p.name).slice(0, 60), price, stock: Math.max(d.stock === '' ? stockOf(p) : Math.round(+d.stock), 0), status: 'Preparado' };
      D.mlPubs.push(pb); AU.log('insert', 'ml_publications', pb.id, pb.title, { status: { old: null, new: 'Preparado' }, price: { old: null, new: price } }); return null;
    },
    setStatus(pb, to) {
      if (pb.status === 'Cerrada') return t('ml.e.noconn');
      if (to === 'Activa') { const a = acc(pb.account); if (!a || a.status !== 'Conectada') return t('ml.e.noconn'); if (pb.stock <= 0) return t('ml.e.nostock'); }
      else if (pb.status === 'Preparado' && to === 'Pausada') return t('ml.e.prep_pause');
      AU.log('update', 'ml_publications', pb.id, pb.title, { status: { old: pb.status, new: to } }); pb.status = to; return null;
    },
    importOrder(d) {
      const e = {}; if (!d.account) e.account = t('ml.e.account'); if (!d.buyer.trim()) e.buyer = t('ml.e.buyer'); const q = Math.round(+d.qty); if (!(q > 0)) e.qty = t('ml.e.qty');
      if (Object.keys(e).length) return e;
      const p = prod(d.sku), price = (D.mlPubs.find((x) => x.sku === d.sku && x.account === d.account) || { price: p.price }).price;
      const email = d.email.trim(); let c = email && D.customers.find((x) => (x.email || '').toLowerCase() === email.toLowerCase());
      if (!c) { c = { id: 'CLI-' + String(D.customers.length + 1).padStart(4, '0'), name: d.buyer.trim(), type: 'B2C', status: 'active', balance: 0, wallet: 0, last: TODAY, owner: ME, email: email || '', phone: '', total: 0, group: 'G1', limit: null, terms: 0, taxId: '', source: 'MercadoLibre', timeline: [['sale', 'MercadoLibre', TODAY]] }; D.customers.unshift(c); AU.log('insert', 'customers', c.id, c.name, { source: { old: null, new: 'MercadoLibre' } }); }
      const total = q * price, ref = 'ML-' + (2001 + D.mlOrders.length), saleId = 'VTA-' + String(D.sales.length + 1).padStart(4, '0'), inv = 'INV-' + String(D.invoices.length + 1).padStart(4, '0');
      D.invoices.push({ id: inv, customer: c.name, date: TODAY, due: TODAY, total, paid: total, open: 0 });
      D.sales.push({ id: saleId, customer: c.id, date: TODAY, due: TODAY, status: 'pagado', reserved: false, invoice: inv, items: [{ sku: p.sku, desc: p.name, qty: q, price, returned: 0 }], discount: 0, shipping: 0, source: 'MercadoLibre', ref, history: [[TODAY, 'MercadoLibre ' + ref]] });
      D.payments.unshift({ id: 'PAG-' + String(D.payments.length + 1).padStart(4, '0'), customer: c.id, date: TODAY, method: 'mp', ref, amount: total, alloc: [[inv, total]], wallet: 0 });
      D.mlOrders.unshift({ id: ref, account: d.account, buyer: d.buyer.trim(), email, sale: saleId, total, at: TODAY });
      AU.log('insert', 'sales', saleId, saleId, { source: { old: null, new: 'MercadoLibre' }, total: { old: null, new: total } }); return null;
    },
    answer(q, text) {
      if (!text.trim()) return { answer: t('ml.e.answer') }; if (text.length > 2000) return { answer: t('ml.e.answer_len') };
      q.answer = text.trim(); q.status = 'Respondida'; return null;
    },
    refresh() {
      let n = 0;
      D.mlSync = D.mlPubs.filter((p) => p.status !== 'Cerrada').map((p) => { const local = Math.max(stockOf(prod(p.sku)), 0); if (local !== p.stock) n++; return { pub: p.id, local, ml: p.stock, status: local === p.stock ? 'Sincronizado' : 'Pendiente' }; });
      return n;
    },
    overview() { return { accounts: D.mlAccounts.filter((a) => a.status === 'Conectada').length, active: D.mlPubs.filter((p) => p.status === 'Activa').length, orders: D.mlOrders.length, questions: D.mlQuestions.filter((q) => q.status === 'Sin responder').length, stock: D.mlSync.filter((s) => s.status === 'Pendiente').length }; }
  });
  ML.refresh();

  const accChip = (s) => N.chip({ Conectada: 'ok', Pendiente: 'warn', Error: 'danger', Desconectada: '' }[s], t('ml.acc.' + s));
  const pubChip = (s) => N.chip({ Preparado: 'info', Activa: 'ok', Pausada: 'warn', Cerrada: '', Error: 'danger' }[s], t('ml.pub.' + s));
  const accName = (id) => { const a = acc(id); return a ? a.nick || a.user : t('ml.no_account'); };
  let section = 'overview';
  const SECS = ['overview', 'pubs', 'orders', 'questions', 'stock'];

  function accountForm() {
    N.drawer({ title: t('ml.add_account'), body: `${N.field('user', t('ml.f.user'))}${N.field('nick', t('ml.f.nick'))}${N.field('site', t('ml.f.site'), { options: [['MLA', 'Argentina (MLA)'], ['MLB', 'Brasil (MLB)'], ['MLM', 'México (MLM)'], ['MLC', 'Chile (MLC)']] })}`,
      onSave(d, close) { const e = ML.register(d); if (e) return e; close(); ok('ml.t.account'); } });
  }
  function prepareForm() {
    N.drawer({ title: t('ml.prepare'), body: `${N.field('sku', t('ml.f.product'), { options: D.products2.map((p) => [p.sku, p.name + ' · ' + p.sku]) })}${N.field('account', t('ml.f.account'), { options: [['', t('ml.no_account')]].concat(D.mlAccounts.map((a) => [a.id, a.nick || a.user])) })}${N.field('title', t('ml.f.title'), { maxlength: 60 })}<div class="row2">${N.field('price', t('ml.f.price'), { type: 'number', min: 0, step: '0.01' })}${N.field('stock', t('ml.f.stock'), { type: 'number', min: 0 })}</div>`,
      onSave(d, close) { const e = ML.prepare(d); if (e) return e; close(); ok('ml.t.prepared'); } });
  }
  function orderForm() {
    const conn = D.mlAccounts.filter((a) => a.status === 'Conectada');
    N.drawer({ title: t('ml.import'), body: `<p class="muted">${t('ml.order_hint')}</p>${N.field('account', t('ml.f.account'), { options: [['', '—']].concat(conn.map((a) => [a.id, a.nick || a.user])) })}<div class="row2">${N.field('buyer', t('ml.f.buyer'))}${N.field('email', t('ml.f.email'), { type: 'email' })}</div><div class="row2">${N.field('sku', t('ml.f.product'), { options: D.products2.map((p) => [p.sku, p.name]) })}${N.field('qty', t('ml.f.qty'), { type: 'number', min: 1, value: 1 })}</div>`,
      onSave(d, close) { const e = ML.importOrder(d); if (e) return e; close(); ok('ml.t.order'); } });
  }
  function answerForm(q) {
    N.drawer({ title: t('ml.answer'), saveLabel: t('ml.answer'), body: `<p><b>${esc(q.text)}</b></p><small class="muted">${esc((pub(q.pub) || {}).title || '')}</small><div class="field" style="margin-top:12px"><label for="f-answer">${t('ml.f.answer')}</label><textarea class="input" id="f-answer" name="answer" rows="5" maxlength="2100"></textarea></div>`,
      onSave(d, close) { const e = ML.answer(q, d.answer); if (e) return e; close(); ok('ml.t.answered'); } });
  }

  R['mercadolibre/'] = (node) => {
    const o = ML.overview();
    node.append(N.el(`<div class="card" style="margin-bottom:16px;border-left:3px solid var(--accent-strong)"><small class="muted">${t('ml.notice')}</small></div>`));
    node.append(N.el(`<div class="seg-row" role="tablist" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">${SECS.map((k) => `<button type="button" class="seg" role="tab" data-sec="${k}" aria-pressed="${k === section}" style="flex-direction:row;padding:8px 14px">${t('ml.sec.' + k)}${k === 'questions' && o.questions ? ` <span class="chip warn">${o.questions}</span>` : ''}${k === 'stock' && o.stock ? ` <span class="chip warn">${o.stock}</span>` : ''}</button>`).join('')}</div>`));
    node.querySelector('.seg-row').onclick = (e) => { const b = e.target.closest('[data-sec]'); if (b) { section = b.dataset.sec; N.rerender(); } };
    SEC[section](node, o);
  };
  const SEC = {
    overview(node, o) {
      node.append(N.el(`<div class="mini" style="margin-bottom:16px">${[['accounts', o.accounts], ['active', o.active], ['orders', o.orders], ['questions', o.questions], ['stock', o.stock]].map(([k, v]) => `<div class="card"><div class="muted">${t('ml.kpi.' + k)}</div><div class="v num" data-kpi="${k}">${v}</div></div>`).join('')}</div>`));
      node.append(N.table({
        id: 'ml-cuentas', rows: D.mlAccounts, id_of: (r) => r.id, sort: null, text: (r) => [r.nick, r.user, r.site].join(' '),
        cols: [
          { key: 'nick', label: 'ml.accounts', value: (r) => r.nick || r.user, render: (r) => `<div class="who"><span class="av">${N.initials(r.nick || r.user)}</span><div><b>${esc(r.nick || r.user)}</b><small class="mono">${esc(r.user)}</small></div></div>` },
          { key: 'site', label: 'ml.f.site', value: (r) => r.site, render: (r) => esc(r.site) },
          { key: 'status', label: 'ml.col.status', value: (r) => r.status, render: (r) => accChip(r.status) },
          { key: 'act', label: 'ml.disconnect', hidden: false, value: () => '', render: (r) => (r.status === 'Conectada' ? `<button type="button" class="btn sm danger" data-disc="${r.id}">${t('ml.disconnect')}</button>` : '') }
        ],
        newLabel: 'ml.add_account', onNew: accountForm, onRow: () => {}
      }));
      node.addEventListener('click', (e) => { const b = e.target.closest('[data-disc]'); if (b) { e.stopPropagation(); ML.disconnect(acc(b.dataset.disc)); ok('ml.t.disconnected'); } });
    },
    pubs(node) {
      node.append(N.table({
        id: 'ml-pubs', rows: D.mlPubs, id_of: (r) => r.id, sort: null, text: (r) => [r.title, r.sku, accName(r.account)].join(' '),
        cols: [
          { key: 'title', label: 'ml.col.title', value: (r) => r.title, render: (r) => `<b>${esc(r.title)}</b><small class="mono" style="display:block">${esc(r.sku)}</small>` },
          { key: 'account', label: 'ml.col.account', value: (r) => accName(r.account), render: (r) => esc(accName(r.account)) },
          { key: 'price', label: 'ml.col.price', align: 'r', value: (r) => r.price, render: (r) => `<span class="num">${money(r.price)}</span>` },
          { key: 'stock', label: 'ml.col.stock', align: 'r', value: (r) => r.stock, render: (r) => `<span class="num">${r.stock}</span>` },
          { key: 'status', label: 'ml.col.status', value: (r) => r.status, render: (r) => pubChip(r.status) }
        ],
        filters: ['Activa', 'Pausada', 'Preparado'].map((s) => ({ key: s, label: 'ml.pub.' + s, fn: (r) => r.status === s })),
        newLabel: 'ml.prepare', onNew: prepareForm, onRow: openPub
      }));
    },
    orders(node) {
      node.append(N.table({
        id: 'ml-orders', rows: D.mlOrders, id_of: (r) => r.id, sort: null, text: (r) => [r.id, r.buyer, r.sale].join(' '),
        cols: [
          { key: 'id', label: 'ml.col.order', value: (r) => r.id, render: (r) => `<b class="mono">${esc(r.id)}</b>` },
          { key: 'buyer', label: 'ml.col.buyer', value: (r) => r.buyer, render: (r) => esc(r.buyer) },
          { key: 'sale', label: 'ml.col.sale', value: (r) => r.sale, render: (r) => `<span class="mono">${esc(r.sale)}</span>` },
          { key: 'total', label: 'ml.col.total', align: 'r', value: (r) => r.total, render: (r) => `<b class="num">${money(r.total)}</b>` },
          { key: 'at', label: 'ml.col.date', value: (r) => r.at, render: (r) => N.date(r.at) }
        ],
        newLabel: 'ml.import', onNew: orderForm, onRow: () => {}
      }));
    },
    questions(node) {
      node.append(N.table({
        id: 'ml-questions', rows: D.mlQuestions, id_of: (r) => r.id, sort: 'at', text: (r) => [r.text, r.answer].join(' '),
        cols: [
          { key: 'at', label: 'ml.col.date', value: (r) => r.at, render: (r) => N.date(r.at.slice(0, 10)) },
          { key: 'text', label: 'ml.col.question', value: (r) => r.text, render: (r) => `<b>${esc(r.text)}</b>${r.answer ? `<small class="muted" style="display:block">↳ ${esc(r.answer)}</small>` : ''}` },
          { key: 'pub', label: 'ml.col.item', value: (r) => (pub(r.pub) || {}).title || '', render: (r) => esc((pub(r.pub) || {}).title || '—') },
          { key: 'status', label: 'ml.col.status', value: (r) => r.status, render: (r) => N.chip(r.status === 'Respondida' ? 'ok' : 'warn', t('ml.q.' + r.status)) },
          { key: 'act', label: 'ml.answer', value: () => '', render: (r) => (r.status === 'Sin responder' ? `<button type="button" class="btn sm primary" data-ans="${r.id}">${t('ml.answer')}</button>` : '') }
        ],
        filters: [{ key: 'p', label: 'ml.q.Sin responder', fn: (r) => r.status === 'Sin responder' }],
        onRow: () => {}
      }));
      node.addEventListener('click', (e) => { const b = e.target.closest('[data-ans]'); if (b) { e.stopPropagation(); answerForm(D.mlQuestions.find((q) => q.id === b.dataset.ans)); } });
    },
    stock(node) {
      node.append(N.el(`<div class="card" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><small class="muted">${t('ml.stock_hint')}</small><button type="button" class="btn sm primary" id="ml-refresh">${t('ml.refresh')}</button></div>`));
      node.querySelector('#ml-refresh').onclick = () => { ML.refresh(); ok('ml.t.refresh'); };
      node.append(N.table({
        id: 'ml-stock', rows: D.mlSync, id_of: (r) => r.pub, sort: null, text: (r) => (pub(r.pub) || {}).title || '',
        cols: [
          { key: 'pub', label: 'ml.col.title', value: (r) => (pub(r.pub) || {}).title, render: (r) => `<b>${esc((pub(r.pub) || {}).title)}</b><small class="mono" style="display:block">${esc((pub(r.pub) || {}).sku)}</small>` },
          { key: 'local', label: 'ml.col.local', align: 'r', value: (r) => r.local, render: (r) => `<span class="num">${r.local}</span>` },
          { key: 'ml', label: 'ml.col.ml', align: 'r', value: (r) => r.ml, render: (r) => `<span class="num">${r.ml}</span>` },
          { key: 'status', label: 'ml.col.status', value: (r) => r.status, render: (r) => N.chip(r.status === 'Sincronizado' ? 'ok' : 'warn', t('ml.sync.' + r.status)) }
        ],
        filters: [{ key: 'p', label: 'ml.sync.Pendiente', fn: (r) => r.status === 'Pendiente' }], onRow: () => {}
      }));
    }
  };
  function openPub(pb) {
    const acts = pb.status === 'Cerrada' ? '' : [pb.status !== 'Activa' ? ['Activa', 'ml.a.activate', 'primary'] : null, pb.status === 'Activa' ? ['Pausada', 'ml.a.pause', ''] : null, ['Cerrada', 'ml.a.close', 'danger']].filter(Boolean).map(([to, l, c]) => `<button type="button" class="btn sm ${c}" data-to="${to}">${t(l)}</button>`).join('');
    const dr = N.drawer({ title: pb.title, saveLabel: t('common.close'), onSave(d, close) { close(); },
      body: `<div style="display:flex;gap:8px;flex-wrap:wrap">${pubChip(pb.status)}${N.chip('', accName(pb.account), true)}</div><p><span class="num">${money(pb.price)}</span> · ${t('ml.col.stock')}: <b>${pb.stock}</b></p><div id="acts" style="display:flex;gap:8px;margin-top:14px">${acts}</div>` });
    dr.el.querySelector('#acts').onclick = (e) => { const b = e.target.closest('[data-to]'); if (!b) return; const err = ML.setStatus(pb, b.dataset.to); if (err) { dr.el.querySelector('#acts').append(N.el(`<small class="err" role="alert">${esc(err)}</small>`)); return; } dr.close(); ok('ml.t.status'); };
  }

  /* ================= Anuncios ================= */
  if (!D.announcements) {
    D.announcements = [
      { id: 'ANU-0001', title: 'Inventario de fin de mes', message: 'El jueves 2 se hace el conteo físico en ambos depósitos. No se despachan pedidos entre las 14 y las 18.', audience: 'Todos', users: [], severity: 'aviso', status: 'Publicado', at: '2026-09-30', expires: '2026-10-03', readBy: ['Marcos Ríos'] },
      { id: 'ANU-0002', title: 'Nueva lista de precios mayorista', message: 'Desde hoy rige la lista mayorista con escalas. Revisá Clientes › Precios antes de cotizar.', audience: 'Todos', users: [], severity: 'info', status: 'Publicado', at: '2026-09-29', expires: null, readBy: ['Marcos Ríos', 'Vale Sosa'] },
      { id: 'ANU-0003', title: 'Capacitación de MercadoLibre', message: 'Borrador: coordinar fecha con el equipo comercial.', audience: 'Usuarios seleccionados', users: ['Vale Sosa', 'Carlos Vega'], severity: 'info', status: 'Borrador', at: '2026-10-01', expires: null, readBy: [] }
    ];
  }
  const AN = (N.announcements = {
    recipients(a) { return a.audience === 'Todos' ? USERS : a.audience === 'Usuarios seleccionados' ? a.users : []; },
    create(d) {
      if (!d.title.trim() || !d.message.trim()) return { title: t('an.e.text') };
      const users = d.aud === 'Usuarios seleccionados' ? Object.keys(d).filter((k) => k.startsWith('u_')).map((k) => d[k]) : [];
      if (d.aud === 'Usuarios seleccionados' && !users.length) return { aud: t('an.e.users') };
      D.announcements.unshift({ id: nid(D.announcements, 'ANU'), title: d.title.trim(), message: d.message.trim(), audience: d.aud, users, severity: d.sev, status: 'Borrador', at: TODAY, expires: d.expires || null, readBy: [] });
      AU.log('insert', 'announcements', D.announcements[0].id, d.title.trim(), { status: { old: null, new: 'Borrador' } }); return null;
    },
    publish(a) {
      if (a.status !== 'Borrador') return 0;
      a.status = 'Publicado'; a.at = TODAY; const rec = this.recipients(a);
      if (rec.includes(ME)) N.notif.items.unshift({ id: 'anu-' + a.id, type: 'anuncio', ref: a.id, title: a.title, sub: 'an.ntf_sub', count: 1, to: '#/anuncios', read: false });
      AU.log('update', 'announcements', a.id, a.title, { status: { old: 'Borrador', new: 'Publicado' } }); return rec.length;
    },
    archive(a) { AU.log('update', 'announcements', a.id, a.title, { status: { old: a.status, new: 'Archivado' } }); a.status = 'Archivado'; },
    read(a) { if (!a.readBy.includes(ME)) a.readBy.push(ME); const n = N.notif.items.find((x) => x.ref === a.id); if (n) n.read = true; },
    live(a) { return a.status === 'Publicado' && (!a.expires || a.expires >= TODAY); },
    mine(a) { return this.live(a) && this.recipients(a).includes(ME); },
    unread() { return D.announcements.filter((a) => this.mine(a) && !a.readBy.includes(ME)).length; }
  });
  // Los anuncios publicados que me llegan y no leí aparecen en la campana desde el arranque.
  D.announcements.filter((a) => AN.mine(a) && !a.readBy.includes(ME)).forEach((a) => N.notif.items.push({ id: 'anu-' + a.id, type: 'anuncio', ref: a.id, title: a.title, sub: 'an.ntf_sub', count: 1, to: '#/anuncios', read: false }));

  const sevChip = (s) => N.chip({ info: 'info', aviso: 'warn', 'crítico': 'danger' }[s], t('an.sev.' + s));
  const anChip = (s) => N.chip({ Borrador: '', Publicado: 'ok', Archivado: '' }[s], t('an.' + s));
  function annForm() {
    const dr = N.drawer({ title: t('an.new'), body: `${N.field('title', t('an.f.title'))}<div class="field"><label for="f-message">${t('an.f.message')}</label><textarea class="input" id="f-message" name="message" rows="4"></textarea></div><div class="row2">${N.field('aud', t('an.f.aud'), { options: ['Todos', 'Usuarios seleccionados'].map((x) => [x, t('an.aud.' + x)]) })}${N.field('sev', t('an.f.sev'), { options: ['info', 'aviso', 'crítico'].map((x) => [x, t('an.sev.' + x)]) })}</div>
      <div class="field" id="usr" hidden><label>${t('an.f.users')}</label><div class="chips-wrap">${USERS.map((u) => `<label class="chip plain" style="cursor:pointer"><input type="checkbox" name="u_${u}" value="${esc(u)}"> ${esc(u)}</label>`).join('')}</div></div>${N.field('expires', t('an.f.expires'), { type: 'date' })}`,
      onSave(d, close) { const e = AN.create(d); if (e) return e; close(); ok('an.t.created'); } });
    const sel = dr.el.querySelector('#f-aud'); sel.onchange = () => { dr.el.querySelector('#usr').hidden = sel.value !== 'Usuarios seleccionados'; };
  }
  function openAnn(a) {
    const dr = N.drawer({ title: a.title, saveLabel: t('common.close'), onSave(d, close) { close(); },
      body: `<div style="display:flex;gap:8px;flex-wrap:wrap">${anChip(a.status)}${sevChip(a.severity)}${N.chip('', t('an.aud.' + a.audience), true)}</div><p style="white-space:pre-wrap">${esc(a.message)}</p><p class="muted">${N.date(a.at)}${a.expires ? ' · ' + t('an.expires') + ' ' + N.date(a.expires) : ''}</p>
        <div id="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">${a.status === 'Borrador' ? `<button type="button" class="btn sm primary" data-a="publish">${t('an.a.publish')}</button>` : ''}${AN.mine(a) && !a.readBy.includes(ME) ? `<button type="button" class="btn sm" data-a="read">${t('an.a.read')}</button>` : ''}${a.status !== 'Archivado' ? `<button type="button" class="btn sm danger" data-a="archive">${t('an.a.archive')}</button>` : ''}</div>` });
    dr.el.querySelector('#acts').onclick = (e) => { const b = e.target.closest('[data-a]'); if (!b) return; AN[b.dataset.a](a); dr.close(); ok('an.t.' + { publish: 'published', archive: 'archived', read: 'read' }[b.dataset.a]); };
  }
  let annView = 'mine';
  R['anuncios/'] = (node) => {
    const un = AN.unread();
    node.append(N.el(`<div class="seg-row" role="tablist" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">${['mine', 'all'].map((k) => `<button type="button" class="seg" role="tab" data-v="${k}" aria-pressed="${k === annView}" style="flex-direction:row;padding:8px 14px">${t('an.' + k)}${k === 'mine' && un ? ` <span class="chip warn">${un}</span>` : ''}</button>`).join('')}</div>`));
    node.querySelector('.seg-row').onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { annView = b.dataset.v; N.rerender(); } };
    if (annView === 'mine') {
      const list = D.announcements.filter((a) => AN.mine(a));
      node.append(N.el(`<div class="ann-list">${list.map((a) => `<button type="button" class="card ann ${a.readBy.includes(ME) ? '' : 'unread'}" data-ann="${a.id}"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>${esc(a.title)}</b>${sevChip(a.severity)}${a.readBy.includes(ME) ? '' : N.chip('info', t('an.unread'))}<small class="muted" style="margin-left:auto">${N.date(a.at)}</small></div><p class="muted" style="margin:6px 0 0">${esc(a.message)}</p></button>`).join('') || `<p class="muted">${t('an.none')}</p>`}</div>`));
      node.querySelector('.ann-list').onclick = (e) => { const b = e.target.closest('[data-ann]'); if (b) openAnn(D.announcements.find((a) => a.id === b.dataset.ann)); };
      node.append(N.el(`<div style="margin-top:16px"><button type="button" class="btn sm primary" id="an-new">${N.icon('plus')}${t('an.new')}</button></div>`));
      node.querySelector('#an-new').onclick = annForm;
    } else {
      node.append(N.table({
        id: 'anuncios', rows: D.announcements, id_of: (r) => r.id, sort: 'at', text: (r) => [r.title, r.message].join(' '),
        cols: [
          { key: 'title', label: 'an.col.title', value: (r) => r.title, render: (r) => `<b>${esc(r.title)}</b>` },
          { key: 'aud', label: 'an.col.aud', value: (r) => r.audience, render: (r) => esc(t('an.aud.' + r.audience)) },
          { key: 'sev', label: 'an.col.sev', value: (r) => r.severity, render: (r) => sevChip(r.severity) },
          { key: 'status', label: 'an.col.status', value: (r) => r.status, render: (r) => anChip(r.status) },
          { key: 'reads', label: 'an.col.reads', align: 'r', value: (r) => r.readBy.length, render: (r) => `<span class="num">${r.readBy.length}/${AN.recipients(r).length}</span>` },
          { key: 'at', label: 'an.col.date', value: (r) => r.at, render: (r) => N.date(r.at) }
        ],
        filters: ['Borrador', 'Publicado', 'Archivado'].map((s) => ({ key: s, label: 'an.' + s, fn: (r) => r.status === s })),
        newLabel: 'an.new', onNew: annForm, onRow: openAnn
      }));
    }
  };
})(window.Nexo);
