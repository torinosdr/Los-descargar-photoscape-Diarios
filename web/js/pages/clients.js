/* Fase 4 · Clientes (lista con alta/edición, grupos, cuentas B2B, billetera, segmentos) e Inventario. */
(function (N) {
  const R = (N.routes = N.routes || {}), D = () => N.data;
  const used = (c) => N.data.invoices.filter((i) => i.customer === c.name).reduce((s, i) => s + i.open, 0);
  const groupName = (id) => (D().groups.find((g) => g.id === id) || {}).name || '—';

  /* ----- Alta / edición de cliente (mismas reglas que la base: B2C = persona física, empresa exige razón social) ----- */
  function customerForm(c) {
    const edit = !!c, b2b = edit ? c.type === 'B2B' : false;
    N.drawer({
      title: N.t(edit ? 'cust.edit' : 'cust.new'),
      body: `<div class="row2">${N.field('type', N.t('cust.type'), { value: edit ? c.type : 'B2C', options: [['B2C', 'B2C'], ['B2B', 'B2B']] })}${N.field('person', N.t('cust.person'), { value: b2b ? 'E' : 'F', options: [['F', N.t('cust.person_f')], ['E', N.t('cust.company')]] })}</div>
        ${N.field('name', N.t(b2b ? 'cust.companyname' : 'cust.first') + ' / ' + N.t('col.name'), { value: edit ? c.name : '' })}
        <div class="row2">${N.field('email', N.t('col.email'), { type: 'email', value: edit ? c.email : '' })}${N.field('phone', N.t('col.phone'), { value: edit ? c.phone : '' })}</div>
        <div class="row2">${N.field('taxId', N.t('cust.taxid'), { value: edit ? c.taxId : '' })}${N.field('group', N.t('cust.group'), { value: edit ? c.group : 'G1', options: (N.api.enabled ? [['', '—']] : []).concat(D().groups.map((g) => [g.id, g.name])) })}</div>
        ${N.api.enabled
          ? `<div class="row2">${N.field('owner', N.t('cust.owner'), { value: edit ? c.ownerId || '' : '', options: [['', '—']].concat(D().users.map((u) => [u.id, u.name])) })}${edit ? N.field('status', N.t('col.status'), { value: c.status, options: [['active', N.t('st.active')], ['inactive', N.t('st.inactive')], ['blocked', N.t('st.blocked')]] }) : ''}</div>`
          : N.field('owner', N.t('cust.owner'), { value: edit ? c.owner : D().owners[0], options: D().owners.map((o) => [o, o]) })}
        <div class="row2">${N.field('limit', N.t('cust.limit'), { type: 'number', min: 0, step: '0.01', num: true, value: edit && c.limit ? c.limit / 100 : '' })}${N.field('terms', N.t('cust.terms'), { type: 'number', min: 0, num: true, value: edit ? c.terms : 0 })}</div>`,
      onSave(d, close) {
        const e = {};
        if (!d.name.trim()) e.name = N.t('cust.err_name');
        if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) e.email = N.t('cust.err_email');
        if (d.type === 'B2C' && d.person === 'E') e.person = N.t('cust.b2c_person');
        if (Object.keys(e).length) return e;
        if (N.api.enabled) return saveCustomer(c, d, close);
        const row = { name: d.name.trim(), type: d.type, email: d.email, phone: d.phone, taxId: d.taxId, group: d.group, owner: d.owner, limit: d.limit ? Math.round(d.limit * 100) : null, terms: +d.terms || 0 };
        if (edit) Object.assign(c, row);
        else { const n = D().customers.length + 1; D().customers.unshift(Object.assign({ id: 'CLI-' + String(n).padStart(4, '0'), new: true, status: 'active', balance: 0, wallet: 0, last: '', total: 0, timeline: [] }, row)); }
        close(); N.toast(N.t('cust.saved')); N.rerender();
      }
    });
  }

  // Modo servidor: arma el cuerpo según las columnas de customers y deja que la API valide.
  const STATUS_OUT = { active: 'Activo', inactive: 'Inactivo', blocked: 'Bloqueado' };
  function saveCustomer(c, d, close) {
    const company = d.person === 'E', name = d.name.trim(), sp = name.indexOf(' ');
    const body = {
      customer_type: d.type, person_type: company ? 'Empresa' : 'Persona Física',
      company_name: company ? name : null,
      first_name: company ? null : (sp > 0 ? name.slice(0, sp) : name), last_name: company ? null : (sp > 0 ? name.slice(sp + 1) : null),
      email: d.email || null, phone: d.phone || null, tax_id: d.taxId || null, customer_group_id: d.group || null,
      assigned_user_id: d.owner || null, credit_limit_minor: d.limit ? Math.round(d.limit * 100) : null, payment_terms_days: +d.terms || 0
    };
    if (c && d.status) body.status = STATUS_OUT[d.status];
    N.api.submit(() => (c ? N.api.patch('/customers/' + c.uuid, body) : N.api.post('/customers', body)), {
      close, okMsg: N.t('cust.saved'),
      fields: { company_name: 'name', first_name: 'name', tax_id: 'taxId', customer_group_id: 'group', assigned_user_id: 'owner', credit_limit_minor: 'limit', payment_terms_days: 'terms', person_type: 'person', customer_type: 'type' }
    });
  }

  R['clientes/lista'] = (node) => {
    node.append(N.table({
      id: 'clientes', rows: D().customers, id_of: (r) => r.id, sort: 'name', text: (r) => [r.id, r.name, r.email, r.phone, r.owner, r.taxId].join(' '),
      cols: [
        { key: 'name', label: 'col.name', value: (r) => r.name, render: (r) => `<div class="who"><span class="av">${N.initials(r.name)}</span><div><b>${N.esc(r.name)}</b><small class="mono">${r.id}</small></div></div>` },
        { key: 'type', label: 'col.type', value: (r) => r.type, render: (r) => N.chip(r.type === 'B2B' ? 'violet' : 'info', r.type, true) },
        { key: 'group', label: 'cust.group', value: (r) => groupName(r.group), render: (r) => N.esc(groupName(r.group)) },
        { key: 'status', label: 'col.status', value: (r) => r.status, render: (r) => N.statusChip(r.status) },
        { key: 'balance', label: 'col.balance', align: 'r', value: (r) => r.balance, render: (r) => `<span class="num" style="color:${r.balance ? 'var(--danger)' : 'var(--muted)'}">${N.money(r.balance)}</span>` },
        { key: 'wallet', label: 'col.wallet', align: 'r', value: (r) => r.wallet, render: (r) => `<span class="num" style="color:${r.wallet ? 'var(--ok)' : 'var(--muted)'}">${N.money(r.wallet)}</span>` },
        { key: 'last', label: 'col.last', value: (r) => r.last, render: (r) => N.date(r.last) },
        { key: 'owner', label: 'col.owner', value: (r) => r.owner, render: (r) => N.esc(r.owner) },
        { key: 'email', label: 'col.email', hidden: true, value: (r) => r.email, render: (r) => N.esc(r.email) },
        { key: 'phone', label: 'col.phone', hidden: true, value: (r) => r.phone, render: (r) => N.esc(r.phone) },
        { key: 'taxId', label: 'cust.taxid', hidden: true, value: (r) => r.taxId, render: (r) => `<span class="mono">${N.esc(r.taxId || '—')}</span>` }
      ],
      filters: [{ key: 'debt', label: 'f.debt', fn: (r) => r.balance > 0 }, { key: 'wallet', label: 'f.wallet', fn: (r) => r.wallet > 0 }, { key: 'b2b', label: 'f.b2b', fn: (r) => r.type === 'B2B' }, { key: 'b2c', label: 'f.b2c', fn: (r) => r.type === 'B2C' }],
      actions: [{ key: 'edit', label: 'cust.edit', icon: 'edit' }, { key: 'full', label: 'c360.expand', icon: 'expand' }],
      newLabel: 'cust.new', onNew: () => customerForm(), onRow: (r) => N.openC360(r),
      onAction: (k, r) => (k === 'edit' ? customerForm(r) : (location.hash = '#/clientes/' + r.id)),
      footer: (rows) => `${N.t('c360.debt')}: ${N.money(rows.reduce((s, r) => s + r.balance, 0))}`
    }));
  };

  R['clientes/grupos'] = (node) => {
    node.append(N.el(`<div class="grid g-3">${D().groups.map((g) => { const m = D().customers.filter((c) => c.group === g.id); return `<div class="card"><h2>${N.esc(g.name)} ${N.chip(g.b2b ? 'violet' : 'info', N.t(g.b2b ? 'grp.b2b' : 'grp.retail'), true)}</h2><p class="muted" style="margin-bottom:14px">${N.esc(g.desc)}</p>
      <div class="kpi"><div class="value num">${m.length}</div><div class="label">${N.t('grp.members')} · ${N.t('grp.list')}: ${N.esc(g.list)}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">${m.slice(0, 5).map((c) => `<a class="chip plain" style="text-decoration:none" href="#/clientes/${c.id}">${N.esc(c.name)}</a>`).join('')}</div></div>`; }).join('')}</div>`));
  };

  R['clientes/b2b'] = (node) => {
    const rows = D().customers.filter((c) => c.type === 'B2B');
    const credit = (c) => { const u = c.balance, l = c.limit; return { u, l, avail: l == null ? null : l - u, over: l != null && u > l, pct: l ? Math.min(100, (u / l) * 100) : 0 }; };
    node.append(N.table({
      id: 'b2b', rows, id_of: (r) => r.id, sort: 'name', text: (r) => r.id + ' ' + r.name,
      cols: [
        { key: 'name', label: 'col.name', value: (r) => r.name, render: (r) => `<div class="who"><span class="av">${N.initials(r.name)}</span><div><b>${N.esc(r.name)}</b><small class="mono">${r.id}</small></div></div>` },
        { key: 'group', label: 'cust.group', value: (r) => groupName(r.group), render: (r) => N.esc(groupName(r.group)) },
        { key: 'limit', label: 'b2b.limit', align: 'r', value: (r) => r.limit || 0, render: (r) => `<span class="num">${r.limit ? N.money(r.limit) : '—'}</span>` },
        { key: 'used', label: 'b2b.used', align: 'r', value: (r) => r.balance, render: (r) => `<span class="num">${N.money(r.balance)}</span>` },
        { key: 'meter', label: 'b2b.credit', render: (r) => { const k = credit(r); return r.limit ? `<div class="meter ${k.over ? 'over' : k.pct > 80 ? 'warn' : ''}" title="${Math.round(k.pct)}%"><i style="width:${k.pct}%"></i></div>` : '—'; } },
        { key: 'avail', label: 'b2b.avail', align: 'r', value: (r) => credit(r).avail ?? 0, render: (r) => { const k = credit(r); return k.avail == null ? '—' : k.over ? N.chip('danger', N.t('b2b.over')) : `<span class="num">${N.money(k.avail)}</span>`; } },
        { key: 'terms', label: 'b2b.terms', align: 'r', value: (r) => r.terms, render: (r) => `${r.terms} ${N.t('b2b.days')}` },
        { key: 'subs', label: 'b2b.sub', align: 'r', value: (r) => (D().subaccounts[r.id] || []).length, render: (r) => (D().subaccounts[r.id] || []).length }
      ],
      filters: [{ key: 'over', label: 'b2b.over', fn: (r) => credit(r).over }],
      actions: [{ key: 'open', label: 'b2b.sub', icon: 'users' }], newLabel: 'cust.new', onNew: () => customerForm(),
      onRow: (r) => openB2b(r), onAction: (k, r) => openB2b(r)
    }));
  };
  function openB2b(c) {
    const subs = D().subaccounts[c.id] || [];
    N.drawer({ title: c.name, wide: true, body: `<div class="mini"><div class="card"><div class="muted">${N.t('b2b.limit')}</div><div class="v num">${c.limit ? N.money(c.limit) : '—'}</div></div><div class="card"><div class="muted">${N.t('b2b.used')}</div><div class="v num">${N.money(c.balance)}</div></div><div class="card"><div class="muted">${N.t('b2b.terms')}</div><div class="v">${c.terms} ${N.t('b2b.days')}</div></div></div>
      <h3 style="font-size:14px">${N.t('b2b.sub')}</h3>${subs.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>${N.t('col.name')}</th><th>${N.t('col.email')}</th><th class="r">${N.t('b2b.spend')}</th><th>${N.t('col.status')}</th></tr></thead><tbody>${subs.map(([n, e, l, s]) => `<tr><td><b>${N.esc(n)}</b></td><td>${N.esc(e)}</td><td class="r num">${N.money(l)}</td><td>${N.statusChip(s === 'Activo' ? 'active' : 'inactive')}</td></tr>`).join('')}</tbody></table></div>` : `<div class="muted">${N.t('b2b.nosub')}</div>`}` });
  }

  /* ----- Billetera: aplica saldo a la deuda más antigua (misma regla que wallet_apply_to_debt en la base) ----- */
  function plan(c) {
    let left = c.wallet; const out = [];
    D().invoices.filter((i) => i.customer === c.name && i.open > 0).sort((a, b) => a.due.localeCompare(b.due)).forEach((i) => { if (left <= 0) return; const a = Math.min(left, i.open); out.push([i, a]); left -= a; });
    return { out, applied: c.wallet - left };
  }
  function applyWallet(c) {
    const p = plan(c);
    if (!p.applied) return N.toast(N.t('wal.none'));
    N.drawer({ title: N.t('wal.apply') + ' · ' + c.name, saveLabel: N.t('wal.confirm'),
      body: `<p class="muted">${N.t('wal.preview')}</p><div class="cmp">${p.out.map(([i, a]) => `<div class="alloc"><span><b class="mono">${i.id}</b> <span class="muted">· ${N.t('col.due')} ${N.date(i.due)}</span></span><b class="num">${N.money(a)}</b></div>`).join('')}</div>
        <div class="mini"><div class="card"><div class="muted">${N.t('wal.after')}</div><div class="v num">${N.money(c.wallet - p.applied)}</div></div><div class="card"><div class="muted">${N.t('wal.debt_after')}</div><div class="v num">${N.money(c.balance - p.applied)}</div></div></div>`,
      onSave(_, close) { if (N.api.enabled) return void N.api.submit(() => N.api.post('/customers/' + c.uuid + '/wallet/apply'), { close, okMsg: (r) => N.t('wal.done') + ': ' + N.money(r.applied_minor) }); p.out.forEach(([i, a]) => { i.paid += a; i.open -= a; }); c.wallet -= p.applied; c.balance -= p.applied; close(); N.toast(N.t('wal.done') + ': ' + N.money(p.applied)); N.rerender(); } });
  }
  N.applyWallet = applyWallet;
  R['clientes/billetera'] = (node) => {
    const rows = D().customers.filter((c) => c.wallet > 0 || c.balance > 0);
    node.append(N.el(`<div class="grid g-3" style="margin-bottom:16px"><div class="card kpi"><div class="label">${N.t('wal.total')}</div><div class="value num">${N.money(D().customers.reduce((s, c) => s + c.wallet, 0))}</div></div><div class="card kpi"><div class="label">${N.t('kpi.receivable')}</div><div class="value num">${N.money(D().customers.reduce((s, c) => s + c.balance, 0))}</div></div></div>`));
    node.append(N.table({
      id: 'billetera', rows, id_of: (r) => r.id, sort: 'wallet', text: (r) => r.id + ' ' + r.name,
      cols: [
        { key: 'name', label: 'col.name', value: (r) => r.name, render: (r) => `<div class="who"><span class="av">${N.initials(r.name)}</span><div><b>${N.esc(r.name)}</b><small class="mono">${r.id}</small></div></div>` },
        { key: 'wallet', label: 'wal.balance', align: 'r', value: (r) => r.wallet, render: (r) => `<span class="num" style="color:${r.wallet ? 'var(--ok)' : 'var(--muted)'}">${N.money(r.wallet)}</span>` },
        { key: 'balance', label: 'c360.debt', align: 'r', value: (r) => r.balance, render: (r) => `<span class="num" style="color:${r.balance ? 'var(--danger)' : 'var(--muted)'}">${N.money(r.balance)}</span>` },
        { key: 'apply', label: 'wal.apply', align: 'r', render: (r) => (r.wallet && r.balance ? `<button class="btn primary sm" data-apply="${r.id}">${N.t('wal.apply')}</button>` : '') }
      ],
      filters: [{ key: 'both', label: 'wal.apply', fn: (r) => r.wallet > 0 && r.balance > 0 }], onRow: (r) => N.openC360(r)
    }));
    node.addEventListener('click', (e) => { const b = e.target.closest('[data-apply]'); if (b) { e.stopPropagation(); applyWallet(D().customers.find((c) => c.id === b.dataset.apply)); } }, true);
  };

  /* ----- Segmentos (mismas reglas que v_customer_segments) ----- */
  const SEG = {
    vip: (c, all) => { const s = all.map((x) => x.total).sort((a, b) => a - b); return c.total > 0 && s.indexOf(c.total) / (s.length - 1) >= 0.8; },
    con_deuda_vencida: (c) => D().invoices.some((i) => i.customer === c.name && i.open > 0 && i.due < '2026-10-01'),
    inactivo_90d: (c) => !!c.last && c.last < '2026-07-03',
    nuevo_30d: (c) => c.new === true,
    con_saldo_a_favor: (c) => c.wallet > 0,
    sin_compras: (c) => !c.last
  };
  R['clientes/segmentos'] = (node) => {
    const act = D().customers.filter((c) => c.status === 'active'), keys = Object.keys(SEG);
    let sel = N.segSel || keys[0];
    const holder = N.el('<div></div>');
    function draw() {
      holder.innerHTML = `<div class="grid g-3">${keys.map((k) => { const n = act.filter((c) => SEG[k](c, act)).length; return `<button class="card seg" data-k="${k}" aria-pressed="${k === sel}"><span class="muted" style="font-weight:700">${N.t('seg.' + k)}</span><span class="n num">${n}</span><span class="muted" style="font-size:12.5px">${N.t('seg.' + k + '_d')}</span></button>`; }).join('')}</div><div id="seglist" style="margin-top:16px"></div>`;
      holder.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { sel = N.segSel = b.dataset.k; draw(); }));
      holder.querySelector('#seglist').append(N.table({ id: 'seg-' + sel, rows: act.filter((c) => SEG[sel](c, act)), id_of: (r) => r.id, text: (r) => r.id + ' ' + r.name,
        cols: [{ key: 'name', label: 'col.name', value: (r) => r.name, render: (r) => `<div class="who"><span class="av">${N.initials(r.name)}</span><div><b>${N.esc(r.name)}</b><small class="mono">${r.id}</small></div></div>` },
          { key: 'total', label: 'c360.total_bought', align: 'r', value: (r) => r.total, render: (r) => `<span class="num">${N.money(r.total)}</span>` },
          { key: 'balance', label: 'col.balance', align: 'r', value: (r) => r.balance, render: (r) => `<span class="num">${N.money(r.balance)}</span>` },
          { key: 'last', label: 'col.last', value: (r) => r.last, render: (r) => N.date(r.last) }], onRow: (r) => N.openC360(r) }));
    }
    draw(); node.append(holder);
  };

  /* ----- Inventario (Compras) ----- */
  const avail = (p) => Object.values(p.stock).reduce((a, b) => a + b, 0) - p.reserved;
  const onHand = (p) => Object.values(p.stock).reduce((a, b) => a + b, 0);
  const state = (p) => (avail(p) <= 0 ? 'out' : avail(p) <= p.min ? 'low' : 'ok');
  const stChip = (p) => N.chip({ out: 'danger', low: 'warn', ok: 'ok' }[state(p)], N.t('inv.' + state(p)));
  function adjust(p) {
    N.drawer({ title: N.t('inv.adjust') + ' · ' + p.name, body: `${N.field('wh', N.t('inv.warehouse'), { options: D().warehouses.map(([c, n]) => [c, n + ' (' + p.stock[c] + ')']) })}${N.field('qty', N.t('inv.newqty'), { type: 'number', min: 0, step: '1', num: true, value: p.stock[D().warehouses[0][0]] })}${N.field('reason', N.t('inv.reason'), { placeholder: 'Conteo, rotura, reposición…' })}`,
      onSave(d, close) { const e = {}, q = Number(d.qty); if (!(q >= 0)) e.qty = N.t('inv.err_neg'); if (!d.reason.trim()) e.reason = N.t('inv.err_reason'); if (!e.qty && q < (p.reserved || 0) && d.wh === D().warehouses[0][0] && onHand(p) - p.stock[d.wh] + q < p.reserved) e.qty = N.t('inv.err_neg'); if (Object.keys(e).length) return e;
        const delta = q - p.stock[d.wh]; if (delta) { D().movements.unshift(['2026-10-01', p.sku, 'Ajuste', delta, d.wh, d.reason]); p.stock[d.wh] = q; } close(); N.toast(N.t('inv.done')); N.rerender(); } });
  }
  function transfer(p) {
    const w = D().warehouses.map(([c, n]) => [c, n]);
    N.drawer({ title: N.t('inv.transfer') + ' · ' + p.name, body: `<div class="row2">${N.field('from', N.t('inv.from'), { options: w, value: w[0][0] })}${N.field('to', N.t('inv.to'), { options: w, value: w[1][0] })}</div>${N.field('qty', N.t('inv.qty'), { type: 'number', min: 1, step: '1', num: true, value: 1 })}`,
      onSave(d, close) { const e = {}, q = Number(d.qty); if (d.from === d.to) e.to = N.t('inv.err_same'); if (!(q > 0)) e.qty = N.t('inv.err_qty'); else if (q > p.stock[d.from]) e.qty = N.t('inv.err_stock'); if (Object.keys(e).length) return e;
        p.stock[d.from] -= q; p.stock[d.to] += q; D().movements.unshift(['2026-10-01', p.sku, 'Transferencia', q, d.from + '→' + d.to, '']); close(); N.toast(N.t('inv.done')); N.rerender(); } });
  }
  R['compras/inventario'] = (node) => {
    const whCols = D().warehouses.map(([c, n]) => ({ key: 'w' + c, label: 'inv.warehouse', _n: n, align: 'r', value: (r) => r.stock[c], render: (r) => `<span class="num">${r.stock[c]}</span>` }));
    const tbl = N.table({
      id: 'inventario', rows: D().products2, id_of: (r) => r.sku, sort: 'name', text: (r) => r.sku + ' ' + r.name,
      cols: [
        { key: 'sku', label: 'inv.sku', value: (r) => r.sku, render: (r) => `<span class="mono">${r.sku}</span>` },
        { key: 'name', label: 'inv.product', value: (r) => r.name, render: (r) => `<b>${N.esc(r.name)}</b>` },
        { key: 'total', label: 'inv.total', align: 'r', value: onHand, render: (r) => `<span class="num">${onHand(r)}</span>` },
        { key: 'reserved', label: 'inv.reserved', align: 'r', value: (r) => r.reserved, render: (r) => `<span class="num muted">${r.reserved}</span>` },
        { key: 'avail', label: 'inv.available', align: 'r', value: avail, render: (r) => `<b class="num">${avail(r)}</b>` },
        { key: 'min', label: 'inv.min', align: 'r', hidden: true, value: (r) => r.min, render: (r) => `<span class="num">${r.min}</span>` },
        { key: 'state', label: 'inv.state', value: state, render: stChip }
      ].concat([]),
      filters: [{ key: 'low', label: 'inv.f_low', fn: (r) => state(r) === 'low' }, { key: 'out', label: 'inv.f_out', fn: (r) => state(r) === 'out' }],
      actions: [{ key: 'adj', label: 'inv.adjust', icon: 'edit' }, { key: 'tr', label: 'inv.transfer', icon: 'box' }],
      onAction: (k, r) => (k === 'adj' ? adjust(r) : transfer(r)), onRow: (r) => adjust(r),
      footer: (rows) => D().warehouses.map(([c, n]) => n + ': ' + rows.reduce((s, r) => s + r.stock[c], 0)).join(' · ')
    });
    node.append(tbl);
    node.append(N.el(`<div class="card" style="margin-top:16px"><h2>${N.t('inv.movements')}</h2><div class="tablewrap"><table class="t"><tbody>${D().movements.slice(0, 8).map(([d, sku, t, q, w, n]) => `<tr><td>${N.date(d)}</td><td class="mono">${sku}</td><td>${N.esc(t)}</td><td class="r num" style="color:${q < 0 ? 'var(--danger)' : 'var(--ok)'}">${q > 0 ? '+' : ''}${q}</td><td class="muted">${N.esc(w)}</td><td class="muted">${N.esc(n)}</td></tr>`).join('')}</tbody></table></div></div>`));
  };
})(window.Nexo);
