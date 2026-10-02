/* Pantallas: Inicio, listas (Clientes, Facturas), estado "en construcción" y galería del sistema de diseño. */
(function (N) {
  const pages = (N.pages = {});

  pages.inicio = () => {
    const D = N.data, max = Math.max(...D.salesByMonth.map((m) => m[1]));
    const debtors = D.customers.filter((c) => c.balance).sort((a, b) => b.balance - a.balance).slice(0, 4), top = debtors.length ? debtors[0].balance : 1;
    const sumDebt = D.customers.reduce((s, c) => s + c.balance, 0), sumWallet = D.customers.reduce((s, c) => s + c.wallet, 0);
    return `<div class="grid g-4">
      <div class="card kpi hero"><div class="label">${N.t('kpi.sales')}</div><div class="value num">${N.money(2150000, { compact: true })}</div><span class="delta up">${N.icon('arrowup')} 15,3%</span></div>
      <div class="card kpi"><div class="label">${N.t('kpi.receivable')}</div><div class="value num">${N.money(sumDebt, { compact: true })}</div><span class="delta down">${N.icon('arrowup')} 4,1%</span></div>
      <div class="card kpi"><div class="label">${N.t('kpi.payable')}</div><div class="value num">${N.money(380000, { compact: true })}</div><span class="delta up">${N.icon('arrowdown')} 2,0%</span></div>
      <div class="card kpi"><div class="label">${N.t('kpi.wallet')}</div><div class="value num">${N.money(sumWallet, { compact: true })}</div><span class="chip plain">${D.customers.filter((c) => c.wallet).length} ${N.t('nav.clients').toLowerCase()}</span></div>
    </div>
    <div class="grid g-main" style="margin-top:16px">
      <div class="card"><h2>${N.t('card.sales_trend')}</h2><div class="bars">${D.salesByMonth.map((m, i) => `<div class="${i === D.salesByMonth.length - 1 ? 'cur' : ''}"><span class="num">${N.money(m[1] * 100000, { compact: true })}</span><i style="height:${(m[1] / max) * 100}%"></i>${m[0]}</div>`).join('')}</div></div>
      <div class="card"><h2>${N.t('card.top_debtors')}</h2>${debtors.map((c) => `<div class="bar-row"><div style="display:flex;justify-content:space-between"><a href="#/clientes/${c.id}" style="color:inherit;font-weight:700;text-decoration:none">${N.esc(c.name)}</a><span class="num">${N.money(c.balance, { compact: true })}</span></div><div class="track"><div class="fill" style="width:${(c.balance / top) * 100}%"></div></div></div>`).join('')}</div>
    </div>
    <div class="grid g-3" style="margin-top:16px">
      <div class="card"><h2>${N.t('card.tasks')}</h2>${D.tasks.map(([t, k]) => `<div class="tl"><span class="dot ${k}">${N.icon('check')}</span><span>${N.esc(t)}</span></div>`).join('')}</div>
      <div class="card"><h2>${N.t('card.activity')}</h2>${D.activity.map(([t, k]) => `<div class="tl"><span class="dot ${k}">${N.icon(k === 'ok' ? 'wallet' : 'receipt')}</span><span>${N.esc(t)}</span></div>`).join('')}</div>
      <div class="card"><h2>${N.t('card.low_stock')}</h2>${D.products.filter((p) => p.stock <= 2).map((p) => `<div class="tl"><span class="dot warn">${N.icon('box')}</span><div style="flex:1"><b>${N.esc(p.name)}</b><div class="muted mono">${p.sku}</div></div>${N.chip(p.stock ? 'warn' : 'danger', p.stock + ' u.')}</div>`).join('')}</div>
    </div>`;
  };

  pages.clientes = (node) => {
    const D = N.data;
    const tbl = N.table({
      id: 'clientes', rows: D.customers, id_of: (r) => r.id, sort: 'name',
      text: (r) => [r.id, r.name, r.email, r.phone, r.owner].join(' '),
      cols: [
        { key: 'name', label: 'col.name', value: (r) => r.name, render: (r) => `<div class="who"><span class="av">${N.initials(r.name)}</span><div><b>${N.esc(r.name)}</b><small class="mono">${r.id}</small></div></div>` },
        { key: 'type', label: 'col.type', value: (r) => r.type, render: (r) => N.chip(r.type === 'B2B' ? 'violet' : 'info', r.type, true) },
        { key: 'status', label: 'col.status', value: (r) => r.status, render: (r) => N.statusChip(r.status) },
        { key: 'balance', label: 'col.balance', align: 'r', value: (r) => r.balance, render: (r) => `<span class="num" style="color:${r.balance ? 'var(--danger)' : 'var(--muted)'}">${N.money(r.balance)}</span>` },
        { key: 'wallet', label: 'col.wallet', align: 'r', value: (r) => r.wallet, render: (r) => `<span class="num" style="color:${r.wallet ? 'var(--ok)' : 'var(--muted)'}">${N.money(r.wallet)}</span>` },
        { key: 'last', label: 'col.last', value: (r) => r.last, render: (r) => N.date(r.last) },
        { key: 'owner', label: 'col.owner', value: (r) => r.owner, render: (r) => N.esc(r.owner) },
        { key: 'email', label: 'col.email', hidden: true, value: (r) => r.email, render: (r) => N.esc(r.email) },
        { key: 'phone', label: 'col.phone', hidden: true, value: (r) => r.phone, render: (r) => N.esc(r.phone) }
      ],
      filters: [{ key: 'debt', label: 'f.debt', fn: (r) => r.balance > 0 }, { key: 'wallet', label: 'f.wallet', fn: (r) => r.wallet > 0 }, { key: 'b2b', label: 'f.b2b', fn: (r) => r.type === 'B2B' }, { key: 'b2c', label: 'f.b2c', fn: (r) => r.type === 'B2C' }],
      actions: [{ key: 'mail', label: 'c360.new_sale', icon: 'plus' }, { key: 'edit', label: 'tbl.new', icon: 'edit' }],
      newLabel: 'tbl.new', onRow: (r) => N.openC360(r),
      footer: (rows) => `${N.t('c360.debt')}: ${N.money(rows.reduce((s, r) => s + r.balance, 0))}`
    });
    node.append(tbl);
  };

  pages.cliente360 = (node, id) => {
    const c = N.data.customers.find((x) => x.id === id);
    if (c && N.api.enabled && !c._detail) return void N.api.loadCustomer(c).then(() => node.isConnected && N.rerender(), (e) => N.toast(e.message));
    node.append(c ? N.c360(c, { full: true }) : N.el(`<div class="empty">${N.t('search.empty')}</div>`));
  };

  const invStatus = (i) => (i.open === 0 ? 'paid' : i.due < '2026-10-01' ? 'overdue' : i.paid ? 'partial' : 'pending');
  pages.facturas = (node) => {
    node.append(N.table({
      id: 'facturas', rows: N.data.invoices, id_of: (r) => r.id, sort: 'date', text: (r) => r.id + ' ' + r.customer,
      cols: [
        { key: 'id', label: 'col.number', value: (r) => r.id, render: (r) => `<span class="mono">${r.id}</span>` },
        { key: 'customer', label: 'col.name', value: (r) => r.customer, render: (r) => `<b>${N.esc(r.customer)}</b>` },
        { key: 'date', label: 'col.date', value: (r) => r.date, render: (r) => N.date(r.date) },
        { key: 'due', label: 'col.due', value: (r) => r.due, render: (r) => N.date(r.due) },
        { key: 'status', label: 'col.status', value: (r) => (r.cancelled ? 'x' : invStatus(r)), render: (r) => (r.cancelled ? N.chip('danger', N.t('ss.cancelado')) : N.statusChip(invStatus(r))) },
        { key: 'total', label: 'col.total', align: 'r', value: (r) => r.total, render: (r) => `<span class="num">${N.money(r.total)}</span>` },
        { key: 'paid', label: 'col.paid', align: 'r', hidden: true, value: (r) => r.paid, render: (r) => `<span class="num">${N.money(r.paid)}</span>` },
        { key: 'open', label: 'col.open', align: 'r', value: (r) => r.open, render: (r) => `<span class="num" style="color:${r.open ? 'var(--danger)' : 'var(--muted)'}">${N.money(r.open)}</span>` }
      ],
      filters: [{ key: 'overdue', label: 'f.overdue', fn: (r) => invStatus(r) === 'overdue' }, { key: 'pending', label: 'f.pending', fn: (r) => r.open > 0 }, { key: 'paid', label: 'f.paid', fn: (r) => r.open === 0 }],
      actions: [{ key: 'pay', label: 'c360.register_payment', icon: 'wallet' }, { key: 'dl', label: 'tbl.export', icon: 'download' }],
      onAction: (k, r) => { if (k === 'pay') N.collectPayment(N.data.customers.find((c) => c.name === r.customer).id, r.id); else N.toast(N.t('tbl.export') + ' · ' + r.id); },
      footer: (rows) => `${N.t('col.open')}: ${N.money(rows.reduce((s, r) => s + r.open, 0))}`
    }));
  };

  pages.wip = (node, phase, icon) => node.append(N.el(`<div class="card"><div class="empty"><div class="ico">${N.icon(icon || 'box')}</div><b style="color:var(--text);font-size:16px">${N.t('wip.title')}</b><span>${N.t('wip.body')} ${N.t('wip.phase')} ${phase}.</span></div></div>`));

  pages.diseno = (node) => {
    const sw = ['bg', 'surface', 'surface-2', 'border', 'text', 'muted', 'accent', 'accent-soft', 'info', 'ok', 'warn', 'danger', 'violet'];
    node.append(N.el(`<div class="grid" style="gap:20px">
      <div class="card"><h2>Color</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px">${sw.map((s) => `<div><div style="height:48px;border-radius:12px;background:var(--${s});border:1px solid var(--border)"></div><div class="mono" style="margin-top:4px">--${s}</div></div>`).join('')}</div></div>
      <div class="card"><h2>Tipografía</h2><div style="font-size:34px;font-weight:800;letter-spacing:-.03em">Manrope 800 · Título</div><div style="font-size:15px;font-weight:700;margin-top:6px">Subtítulo 700 · 15 px</div><div style="margin-top:6px">Texto base 400 · 14 px. Importes alineados con <b class="num">1.234.567,89</b> y códigos <span class="mono">INV-0001</span>.</div></div>
      <div class="card"><h2>Botones y chips</h2><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><button class="btn primary">Primario</button><button class="btn">Secundario</button><button class="btn ghost">Fantasma</button><button class="btn danger">Peligro</button><button class="btn sm">Pequeño</button>${['active', 'paid', 'partial', 'pending', 'overdue', 'inactive', 'blocked'].map(N.statusChip).join('')}</div></div>
      <div class="card"><h2>Formulario</h2><div class="grid g-3"><div class="field"><label for="ds-1">Nombre</label><input id="ds-1" class="input" value="Juan Pérez"></div><div class="field"><label for="ds-2">Moneda</label><select id="ds-2" class="select"><option>ARS</option></select></div><div class="field"><label for="ds-3">Monto</label><input id="ds-3" class="input num" value="25.000,00"></div></div></div>
      <div class="card"><h2>Estado vacío</h2><div class="empty"><div class="ico">${N.icon('search')}</div><b style="color:var(--text)">Sin resultados</b></div></div></div>`));
  };
})(window.Nexo);
