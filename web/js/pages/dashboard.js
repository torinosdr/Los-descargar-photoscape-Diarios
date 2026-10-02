/* Fase 8 · Tablero de Inicio, notificaciones y búsqueda global.
   Replica la lógica de la migración 019 (v_dashboard, notifications_generate, search_global). */
(function (N) {
  const K = {
    'd.sales30': ['Ventas, últimos 30 días', 'Sales, last 30 days', 'Vendas, últimos 30 dias'], 'd.vs_prev': ['vs. 30 días previos', 'vs. previous 30 days', 'vs. 30 dias anteriores'],
    'd.overdue_amt': ['vencido', 'overdue', 'vencido'], 'd.open_tickets': ['Tickets abiertos', 'Open tickets', 'Tickets abertos'], 'd.overdue_tasks': ['Tareas vencidas', 'Overdue tasks', 'Tarefas vencidas'],
    'd.pipeline': ['Embudo de ventas', 'Sales pipeline', 'Funil de vendas'], 'd.low_stock': ['Stock bajo', 'Low stock', 'Estoque baixo'], 'd.overdue': ['vencidos', 'overdue', 'vencidos'],
    'd.sales_trend': ['Ventas por mes', 'Sales by month', 'Vendas por mês'], 'd.my_tasks': ['Mis tareas', 'My tasks', 'Minhas tarefas'], 'd.no_tasks': ['Sin tareas pendientes', 'No pending tasks', 'Sem tarefas pendentes'],
    'd.activity': ['Actividad reciente', 'Recent activity', 'Atividade recente'], 'd.open_leads': ['leads abiertos', 'open leads', 'leads abertos'], 'd.units_low': ['productos bajo el mínimo', 'products below minimum', 'produtos abaixo do mínimo'],
    'd.notifications': ['Notificaciones', 'Notifications', 'Notificações'], 'd.mark_all': ['Marcar todas como leídas', 'Mark all as read', 'Marcar todas como lidas'], 'd.no_notifs': ['Estás al día', "You're all caught up", 'Você está em dia'],
    'ntf.receivable': ['cuentas por cobrar vencidas', 'overdue receivables', 'contas a receber vencidas'], 'ntf.receivable_t': ['Deudas vencidas', 'Overdue debts', 'Dívidas vencidas'],
    'ntf.stock': ['productos bajo el mínimo', 'products below minimum', 'produtos abaixo do mínimo'], 'ntf.stock_t': ['Stock bajo', 'Low stock', 'Estoque baixo'],
    'ntf.tickets': ['tickets asignados a vos están vencidos', 'tickets assigned to you are overdue', 'tickets atribuídos a você estão vencidos'], 'ntf.tickets_t': ['Tickets vencidos', 'Overdue tickets', 'Tickets vencidos'],
    'ntf.tasks': ['tareas asignadas a vos están vencidas', 'tasks assigned to you are overdue', 'tarefas atribuídas a você estão vencidas'], 'ntf.tasks_t': ['Tareas vencidas', 'Overdue tasks', 'Tarefas vencidas'],
    'act.sale': ['Venta', 'Sale', 'Venda'], 'act.payment': ['Cobranza', 'Payment', 'Cobrança'], 'act.ticket': ['Ticket', 'Ticket', 'Ticket'], 'act.lead': ['Lead', 'Lead', 'Lead'],
    'search.cliente': ['Clientes', 'Customers', 'Clientes'], 'search.lead': ['Leads', 'Leads', 'Leads'], 'search.ticket': ['Tickets', 'Tickets', 'Tickets'], 'search.pedido': ['Ventas', 'Sales', 'Vendas'], 'search.factura': ['Facturas', 'Invoices', 'Faturas'],
    'search.presupuesto': ['Presupuestos', 'Quotes', 'Orçamentos'], 'search.producto': ['Productos', 'Products', 'Produtos'], 'search.proveedor': ['Proveedores', 'Suppliers', 'Fornecedores'], 'search.min': ['Escribí al menos 2 letras', 'Type at least 2 characters', 'Digite ao menos 2 caracteres']
  };
  ['es-AR', 'en', 'pt-BR'].forEach((lg, i) => Object.keys(K).forEach((k) => (N.DICT[lg][k] = K[k][i])));

  const D = N.data, TODAY = '2026-10-01', ME = 'Ana Demo', t = (k) => N.t(k), esc = N.esc, money = (m, o) => N.money(m, o);
  const addDays = (iso, d) => { const x = new Date(iso + 'T12:00:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
  const saleTotal = (s) => s.total != null ? s.total : s.items.reduce((a, i) => a + i.qty * i.price - (i.disc || 0), 0) - (s.discount || 0) + (s.shipping || 0);
  const purchaseTotal = (p) => p.items.reduce((a, i) => a + i.qty * i.cost, 0);
  const liveSales = () => D.sales.filter((s) => s.status !== 'cancelado');
  const stockOf = (p) => Object.values(p.stock).reduce((a, b) => a + b, 0) - (p.reserved || 0);

  /* ---------- Métricas compartidas (informes y tablero) ---------- */
  N.metrics = {
    saleTotal, purchaseTotal, liveSales, addDays, TODAY,
    salesBetween: (from, to) => liveSales().filter((s) => s.date > from && s.date <= to).reduce((a, s) => a + saleTotal(s), 0),
    receivable: () => D.invoices.filter((i) => !i.cancelled && i.open > 0),
    payable: () => D.purchases.filter((p) => p.status !== 'cancelado' && p.inv).map((p) => ({ p, open: purchaseTotal(p) - p.paid })).filter((x) => x.open > 0),
    lowStock: () => D.products2.filter((p) => stockOf(p) <= p.min),
    openTickets: () => D.tickets.filter((k) => !['resuelto', 'cerrado'].includes(k.status)),
    overdueTickets: () => D.tickets.filter((k) => k.due && k.due < TODAY && !['resuelto', 'cerrado'].includes(k.status)),
    overdueTasks: () => D.tasks.filter((x) => x.due && x.due < TODAY && x.status !== 'completada'),
    openLeads: () => D.leads.filter((l) => !['ganado', 'perdido'].includes(l.status))
  };

  /* ---------- Notificaciones ---------- */
  const NT = (N.notif = {
    items: [], seen: new Set(),
    unread() { return this.items.filter((n) => !n.read).length; },
    generate() {
      const M = N.metrics, add = (type, count, to) => { if (count > 0 && !this.seen.has(type)) { this.seen.add(type); this.items.push({ id: type, type, count, to, read: false }); } };
      add('receivable', M.receivable().filter((i) => i.due < TODAY).length, '#/ventas/porcobrar');
      add('stock', M.lowStock().length, '#/compras/inventario');
      add('tickets', M.overdueTickets().filter((k) => k.assignee === ME).length, '#/crm/tickets');
      add('tasks', M.overdueTasks().filter((x) => x.assignee === ME).length, '#/crm/tareas');
    },
    toggle(btn) {
      const old = document.querySelector('.notif-pop'); if (old) { old.remove(); return; }
      this.generate();
      const pop = N.el(`<div class="notif-pop" role="dialog" aria-label="${t('d.notifications')}"><header><b>${t('d.notifications')}</b><button type="button" class="btn sm" data-all>${t('d.mark_all')}</button></header>${
        this.items.map((n) => `<a href="${n.to}" class="ni ${n.read ? '' : 'unread'}" data-id="${n.id}"><span class="dot warn">${N.icon(n.type === 'anuncio' ? 'megaphone' : n.type === 'stock' ? 'box' : n.type === 'receivable' ? 'wallet' : n.type === 'tickets' ? 'ticket' : 'check')}</span><span><b>${n.title ? esc(n.title) : t('ntf.' + n.type + '_t')}</b><br><small class="muted">${n.title ? t(n.sub) : n.count + ' ' + t('ntf.' + n.type)}</small></span></a>`).join('') || `<p class="muted" style="padding:16px">${t('d.no_notifs')}</p>`}</div>`);
      document.body.append(pop);
      const close = () => { pop.remove(); document.removeEventListener('click', away); };
      const away = (e) => { if (!pop.contains(e.target)) close(); };
      setTimeout(() => document.addEventListener('click', away), 0);
      pop.querySelector('[data-all]').onclick = () => { this.items.forEach((n) => (n.read = true)); close(); N.rerender(); };
      pop.addEventListener('click', (e) => { const a = e.target.closest('.ni'); if (!a) return; const n = this.items.find((x) => x.id === a.dataset.id); if (n) n.read = true; close(); N.rerender(); });
    }
  });
  NT.generate();

  /* ---------- Búsqueda global ---------- */
  N.searchGlobal = (q) => {
    q = (q || '').trim().toLowerCase();
    const has = (s) => !q || String(s).toLowerCase().includes(q), lim = (a) => a.slice(0, 4);
    if (q.length === 1) return [];
    const num = /^[a-z]{0,4}-?\d+$/.test(q), G = [];
    const push = (k, items) => { if (items.length) G.push(['search.' + k, items]); };
    if (num || !q) {
      push('ticket', lim(D.tickets.filter((x) => has(x.id + ' ' + x.subject))).map((x) => ({ ico: 'ticket', title: x.id, sub: x.subject, to: '#/crm/tickets' })));
      push('pedido', lim(D.sales.filter((x) => has(x.id))).map((x) => ({ ico: 'cart', title: x.id, sub: (D.customers.find((c) => c.id === x.customer) || {}).name, to: '#/ventas/ventas' })));
      push('factura', lim(D.invoices.filter((x) => has(x.id))).map((x) => ({ ico: 'receipt', title: x.id, sub: x.customer + ' · ' + money(x.total), to: '#/ventas/facturas' })));
      push('presupuesto', lim(D.quotes.filter((x) => has(x.id))).map((x) => ({ ico: 'note', title: x.id, sub: (D.customers.find((c) => c.id === x.customer) || {}).name, to: '#/ventas/presupuestos' })));
    }
    if (!num || !q) {
      push('cliente', lim(D.customers.filter((c) => has(c.name + ' ' + c.id + ' ' + c.email))).map((c) => ({ ico: 'users', title: c.name, sub: c.id + ' · ' + c.email, to: '#/clientes/' + c.id })));
      push('lead', lim(D.leads.filter((l) => has(l.name + ' ' + (l.company || '') + ' ' + l.email))).map((l) => ({ ico: 'target', title: l.name, sub: l.id + (l.company ? ' · ' + l.company : ''), to: '#/crm/leads' })));
      push('producto', lim(D.products2.filter((p) => has(p.name + ' ' + p.sku))).map((p) => ({ ico: 'box', title: p.name, sub: p.sku + ' · stock ' + stockOf(p), to: '#/compras/inventario' })));
      push('proveedor', lim(D.suppliers.filter((s) => has(s.name + ' ' + s.email))).map((s) => ({ ico: 'cart', title: s.name, sub: s.id, to: '#/compras/proveedores' })));
    }
    return G;
  };

  /* ---------- Tablero ---------- */
  N.pages.inicio = () => {
    const M = N.metrics, cur = M.salesBetween(addDays(TODAY, -30), TODAY), prev = M.salesBetween(addDays(TODAY, -60), addDays(TODAY, -30));
    const delta = prev ? ((cur - prev) / prev) * 100 : null, rec = M.receivable(), recTotal = rec.reduce((a, i) => a + i.open, 0), recOver = rec.filter((i) => i.due < TODAY).reduce((a, i) => a + i.open, 0);
    const pay = M.payable().reduce((a, x) => a + x.open, 0), wallet = D.customers.reduce((a, c) => a + c.wallet, 0);
    const openT = M.openTickets(), overT = M.overdueTickets(), overTasks = M.overdueTasks(), leads = M.openLeads(), low = M.lowStock();
    const months = [...Array(6)].map((_, i) => { const d = new Date(TODAY + 'T12:00:00'); d.setMonth(d.getMonth() - (5 - i)); return d.toISOString().slice(0, 7); });
    const byMonth = months.map((m) => liveSales().filter((s) => s.date.startsWith(m)).reduce((a, s) => a + saleTotal(s), 0)), max = Math.max(...byMonth, 1);
    const debtors = D.customers.filter((c) => c.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 4), top = debtors.length ? debtors[0].balance : 1;
    const mine = D.tasks.filter((x) => x.assignee === ME && x.status !== 'completada').sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 5);
    const act = [].concat(
      D.payments.map((p) => ({ d: p.date, k: 'ok', ico: 'wallet', text: t('act.payment') + ' ' + p.id + ' · ' + money(p.amount) })),
      liveSales().map((s) => ({ d: s.date, k: 'info', ico: 'cart', text: t('act.sale') + ' ' + s.id + ' · ' + money(saleTotal(s)) })),
      D.leads.filter((l) => l.status === 'nuevo').map((l) => ({ d: TODAY, k: 'warn', ico: 'target', text: t('act.lead') + ' ' + l.name }))
    ).sort((a, b) => b.d.localeCompare(a.d)).slice(0, 5);
    const kpi = (cls, label, value, extra) => `<div class="card kpi ${cls}"><div class="label">${label}</div><div class="value num">${value}</div>${extra || ''}</div>`;
    const mini = (label, v, sub, href, bad) => `<a class="card mini-kpi" href="${href}"><span class="muted">${label}</span><b class="num" style="color:${bad ? 'var(--danger)' : 'inherit'}">${v}</b><small class="muted">${sub}</small></a>`;
    return `<div class="grid g-4">
      ${kpi('hero', t('d.sales30'), money(cur, { compact: true }), delta === null ? '' : `<span class="delta ${delta >= 0 ? 'up' : 'down'}">${N.icon(delta >= 0 ? 'arrowup' : 'arrowdown')} ${Math.abs(delta) > 999 ? '+999' : Math.abs(delta).toFixed(1).replace('.', ',')}% ${t('d.vs_prev')}</span>`)}
      ${kpi('', t('kpi.receivable'), money(recTotal, { compact: true }), recOver ? `<span class="chip danger">${money(recOver, { compact: true })} ${t('d.overdue_amt')}</span>` : '')}
      ${kpi('', t('kpi.payable'), money(pay, { compact: true }))}
      ${kpi('', t('kpi.wallet'), money(wallet, { compact: true }), `<span class="chip plain">${D.customers.filter((c) => c.wallet).length}</span>`)}
    </div>
    <div class="grid g-4" style="margin-top:16px">
      ${mini(t('d.open_tickets'), openT.length, overT.length + ' ' + t('d.overdue'), '#/crm/tickets', overT.length > 0)}
      ${mini(t('d.overdue_tasks'), overTasks.length, D.tasks.filter((x) => x.status !== 'completada').length + ' ' + t('crm.f.open').toLowerCase(), '#/crm/tareas', overTasks.length > 0)}
      ${mini(t('d.pipeline'), money(leads.reduce((a, l) => a + l.value, 0), { compact: true }), leads.length + ' ' + t('d.open_leads'), '#/crm/embudo')}
      ${mini(t('d.low_stock'), low.length, t('d.units_low'), '#/compras/inventario', low.length > 0)}
    </div>
    <div class="grid g-main" style="margin-top:16px">
      <div class="card"><h2>${t('d.sales_trend')}</h2><div class="bars">${byMonth.map((v, i) => `<div class="${i === 5 ? 'cur' : ''}"><span class="num">${v ? money(v, { compact: true }) : ''}</span><i style="height:${Math.max((v / max) * 100, 2)}%"></i><span>${N.date(months[i] + '-15', { month: 'short' })}</span></div>`).join('')}</div></div>
      <div class="card"><h2>${t('card.top_debtors')}</h2>${debtors.map((c) => `<div class="bar-row"><div style="display:flex;justify-content:space-between"><a href="#/clientes/${c.id}" style="color:inherit;font-weight:600">${esc(c.name)}</a><span class="num">${money(c.balance)}</span></div><div class="track"><div class="fill" style="width:${(c.balance / top) * 100}%"></div></div></div>`).join('') || '<p class="muted">—</p>'}</div>
    </div>
    <div class="grid g-3" style="margin-top:16px">
      <div class="card"><h2>${t('d.my_tasks')}</h2>${mine.map((x) => `<div class="tl"><span class="dot ${x.due && x.due < TODAY ? 'warn' : 'info'}">${N.icon('check')}</span><div style="flex:1"><b>${esc(x.title)}</b><br><small class="muted">${N.date(x.due)}</small></div></div>`).join('') || `<p class="muted">${t('d.no_tasks')}</p>`}</div>
      <div class="card"><h2>${t('d.activity')}</h2>${act.map((a) => `<div class="tl"><span class="dot ${a.k}">${N.icon(a.ico)}</span><div style="flex:1">${esc(a.text)}<br><small class="muted">${N.date(a.d)}</small></div></div>`).join('')}</div>
      <div class="card"><h2>${t('card.low_stock')}</h2>${low.map((p) => `<div class="tl"><span class="dot warn">${N.icon('box')}</span><div style="flex:1"><b>${esc(p.name)}</b><br><small class="muted">${p.sku} · stock ${stockOf(p)} / ${p.min}</small></div></div>`).join('') || '<p class="muted">—</p>'}</div>
    </div>`;
  };
})(window.Nexo);
