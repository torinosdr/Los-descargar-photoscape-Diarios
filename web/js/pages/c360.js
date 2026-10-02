/* Ficha Customer 360: panel inferior (con "Expandir") y página completa. */
(function (N) {
  const bySale = (c) => N.data.invoices.filter((i) => i.customer === c.name);
  N.c360 = function (c, { full = false } = {}) {
    const inv = bySale(c), tabs = ['summary', 'sales', 'payments', 'wallet', 'tickets', 'notes'];
    const node = N.el(`<section class="c360 ${full ? 'full open' : ''}" aria-label="Customer 360 · ${N.esc(c.name)}">
      <div class="c360-grip"></div>
      <div class="c360-head"><div class="who"><span class="av" style="width:44px;height:44px;font-size:15px">${N.initials(c.name)}</span><div><div class="name">${N.esc(c.name)}</div><div class="muted mono">${c.id} · ${c.type} · ${N.esc(c.email)}</div></div></div>
        ${N.statusChip(c.status)}<span style="flex:1"></span>
        <button class="btn sm" data-a="pay">${N.icon('wallet')}${N.t('c360.register_payment')}</button>
        <button class="btn primary sm" data-a="sale">${N.icon('plus')}${N.t('c360.new_sale')}</button>
        ${full ? `<a class="btn sm" href="#/clientes">${N.t('c360.back')}</a>` : `<button class="btn sm" data-a="expand">${N.icon('expand')}${N.t('c360.expand')}</button><button class="icon-btn" data-a="close" aria-label="${N.t('c360.close')}">${N.icon('x')}</button>`}
      </div>
      <div class="c360-tabs" role="tablist">${tabs.map((k, i) => `<button role="tab" data-tab="${k}" aria-selected="${i === 0}">${N.t('c360.' + k)}</button>`).join('')}</div>
      <div class="c360-body"></div></section>`);
    const body = node.querySelector('.c360-body');
    const views = {
      summary: () => `<div class="mini">
          <div class="card"><div class="muted">${N.t('c360.total_bought')}</div><div class="v num">${N.money(c.total)}</div></div>
          <div class="card"><div class="muted">${N.t('c360.debt')}</div><div class="v num" style="color:${c.balance ? 'var(--danger)' : 'inherit'}">${N.money(c.balance)}</div></div>
          <div class="card"><div class="muted">${N.t('c360.wallet_bal')}</div><div class="v num" style="color:${c.wallet ? 'var(--ok)' : 'inherit'}">${N.money(c.wallet)}</div></div>
          <div class="card"><div class="muted">${N.t('c360.last_contact')}</div><div class="v">${N.date(c.last)}</div></div></div>
        ${c.wallet && c.balance ? `<div class="card" style="margin-top:12px;display:flex;align-items:center;gap:12px;justify-content:space-between"><span>${N.icon('wallet')} <b>${N.money(Math.min(c.wallet, c.balance))}</b> · ${N.esc(N.t('c360.apply_wallet'))}</span><button class="btn primary sm" data-a="apply">${N.t('c360.apply_wallet')}</button></div>` : ''}
        <h3 style="margin:18px 0 6px;font-size:14px">${N.t('c360.timeline')}</h3>
        <div class="timeline">${c.timeline.map(([k, txt, d]) => `<div class="tl"><span class="dot ${k === 'payment' ? 'ok' : k === 'sale' ? 'info' : ''}">${N.icon(k === 'payment' ? 'wallet' : k === 'sale' ? 'receipt' : 'note')}</span><div><b>${N.esc(txt)}</b><div class="muted" style="font-size:12px">${N.date(d)}</div></div></div>`).join('')}</div>`,
      sales: () => inv.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>${N.t('col.number')}</th><th>${N.t('col.date')}</th><th class="r">${N.t('col.total')}</th><th class="r">${N.t('col.open')}</th></tr></thead><tbody>${inv.map((i) => `<tr><td class="mono">${i.id}</td><td>${N.date(i.date)}</td><td class="r num">${N.money(i.total)}</td><td class="r num">${N.money(i.open)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${N.t('tbl.none')}</div>`,
      payments: () => `<div class="tablewrap"><table class="t"><tbody>${inv.filter((i) => i.paid).map((i) => `<tr><td class="mono">${i.id}</td><td>${N.date(i.date)}</td><td class="r num">${N.money(i.paid)}</td></tr>`).join('') || `<tr><td class="muted">—</td></tr>`}</tbody></table></div>`,
      wallet: () => `<div class="mini"><div class="card"><div class="muted">${N.t('c360.wallet_bal')}</div><div class="v num">${N.money(c.wallet)}</div></div></div><p class="muted" style="margin-top:12px">${N.t('money.note')}</p>`,
      tickets: () => `<div class="empty"><div class="ico">${N.icon('ticket')}</div>${N.t('c360.tickets')}: 0</div>`,
      notes: () => `<div class="empty"><div class="ico">${N.icon('note')}</div>${N.t('c360.notes')}: 0</div>`
    };
    const show = (k) => { node.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === k)); body.innerHTML = views[k](); };
    node.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => show(b.dataset.tab));
    node.onclick = (e) => { const a = e.target.closest('[data-a]'); if (!a) return; const k = a.dataset.a;
      if (k === 'apply') N.applyWallet(c); else if (k === 'pay' && N.collectPayment) N.collectPayment(c.id); else if (k === 'sale' && N.newDoc) N.newDoc('sale', { customer: c.id }); else if (k === 'expand') location.hash = '#/clientes/' + c.id; else if (k === 'close') N.closeC360(); else N.toast(a.textContent.trim() + ' · próximamente'); };
    show('summary');
    return node;
  };
  N.openC360 = (c) => {
    // Con servidor, la línea de tiempo se pide al abrir la ficha.
    if (N.api.enabled && !c._detail) return void N.api.loadCustomer(c).then(() => N.openC360(c), (e) => N.toast(e.message));
    N.closeC360(true); const n = N.c360(c); n.id = 'c360-panel'; document.body.append(n); requestAnimationFrame(() => n.classList.add('open')); };
  N.closeC360 = (now) => { const p = document.getElementById('c360-panel'); if (!p) return; if (now) p.remove(); else { p.classList.remove('open'); setTimeout(() => p.remove(), 300); } document.querySelectorAll('tr[aria-selected=true]').forEach((r) => r.setAttribute('aria-selected', 'false')); };
})(window.Nexo);
