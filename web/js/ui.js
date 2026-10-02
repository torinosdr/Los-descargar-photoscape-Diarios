/* Componentes de interfaz reutilizables (sin dependencias). */
(function (N) {
  const P = {
    home: '<path d="M3 11 12 3l9 8M5 10v10h14V10"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .6 3.2 2.2 3.5 5.2"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>', cart: '<path d="M3 4h2l2.5 11h10L20 7H6.5"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>', contact: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="12" cy="10" r="2.6"/><path d="M7 17c.8-2 2.7-3 5-3s4.2 1 5 3"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>', phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    megaphone: '<path d="M3 11v3a1 1 0 0 0 1 1h3l8 4V6L7 10H4a1 1 0 0 0-1 1zM18 9a4 4 0 0 1 0 6"/>', chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>', plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    expand: '<path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6"/>', chevup: '<path d="m6 15 6-6 6 6"/>', cols: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    wallet: '<path d="M4 7a2 2 0 0 1 2-2h12v4M4 7v10a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2zM16 14h2"/>', check: '<path d="m5 12 5 5 9-10"/>', arrowup: '<path d="M7 17 17 7M9 7h8v8"/>', arrowdown: '<path d="M7 7l10 10M17 9v8H9"/>',
    store: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"/>', shield: '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6zM9 12l2 2 4-4"/>',
    bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/>', note: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5"/>', ticket: '<path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 0 0-6V6H3zM13 6v12"/>', box: '<path d="m3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>', logout: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>', palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.4-2-.7-1.2 0-2.5 1.4-2.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/>'
  };
  N.icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;
  N.chip = (cls, text, plain) => `<span class="chip ${cls}${plain ? ' plain' : ''}">${N.esc(text)}</span>`;
  const ST = { active: 'ok', inactive: '', blocked: 'danger', paid: 'ok', partial: 'warn', pending: 'info', overdue: 'danger' };
  N.statusChip = (k) => N.chip(ST[k] || '', N.t('st.' + k));
  N.el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
  N.toast = (msg) => { const e = N.el(`<div class="toast" role="status">${N.esc(msg)}</div>`); document.body.append(e); setTimeout(() => e.remove(), 1800); };
  N.lsGet = (k, d) => { try { const v = localStorage.getItem('nexo.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  N.lsSet = (k, v) => { try { localStorage.setItem('nexo.' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };

  /* ---------- Tabla densa: búsqueda, filtros, orden, columnas, densidad, acciones por fila ---------- */
  N.table = function (cfg) {
    const st = Object.assign({ q: '', filter: null, sort: cfg.sort || null, dir: 1, hidden: N.lsGet('cols.' + cfg.id, cfg.cols.filter((c) => c.hidden).map((c) => c.key)), sel: null }, {});
    const root = N.el('<div></div>');
    function visibleRows() {
      let r = cfg.rows.slice();
      if (st.filter) r = r.filter(cfg.filters.find((f) => f.key === st.filter).fn);
      if (st.q) { const q = st.q.toLowerCase(); r = r.filter((x) => cfg.text(x).toLowerCase().includes(q)); }
      if (st.sort) { const c = cfg.cols.find((c) => c.key === st.sort); r.sort((a, b) => { const x = c.value(a), y = c.value(b); return (x > y ? 1 : x < y ? -1 : 0) * st.dir; }); }
      return r;
    }
    function draw() {
      const rows = visibleRows(), cols = cfg.cols.filter((c) => !st.hidden.includes(c.key));
      root.innerHTML = `
      <div class="toolbar">
        <label class="tsearch">${N.icon('search')}<input type="search" placeholder="${N.esc(N.t('tbl.search'))}" value="${N.esc(st.q)}" aria-label="${N.esc(N.t('tbl.search'))}"></label>
        ${(cfg.filters || []).map((f) => `<button class="fchip" data-f="${f.key}" aria-pressed="${st.filter === f.key}">${N.esc(N.t(f.label))}</button>`).join('')}
        <span class="grow"></span>
        <button class="btn sm" data-act="cols">${N.icon('cols')}${N.t('tbl.columns')}</button>
        <select class="select" data-act="dens" aria-label="${N.esc(N.t('tbl.density'))}">${['compact', 'normal', 'comfortable'].map((d) => `<option value="${d}" ${N.state.density === d ? 'selected' : ''}>${N.t('dens.' + d)}</option>`).join('')}</select>
        <button class="btn sm" data-act="export">${N.icon('download')}${N.t('tbl.export')}</button>
        ${cfg.newLabel ? `<button class="btn primary sm" data-act="new">${N.icon('plus')}${N.t(cfg.newLabel)}</button>` : ''}
      </div>
      <div class="tablewrap"><table class="t"><thead><tr>${cols.map((c) => `<th class="${c.align || ''}" data-sort="${c.key}" aria-sort="${st.sort === c.key ? (st.dir > 0 ? 'ascending' : 'descending') : 'none'}">${N.t(c.label)}${st.sort === c.key ? (st.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}<th></th></tr></thead>
      <tbody>${rows.map((r) => `<tr tabindex="0" data-id="${N.esc(cfg.id_of(r))}" aria-selected="${st.sel === cfg.id_of(r)}">${cols.map((c) => `<td class="${c.align || ''}">${c.render(r)}</td>`).join('')}<td><div class="rowact">${(cfg.actions || []).map((a) => `<button class="icon-btn" title="${N.esc(N.t(a.label))}" data-ract="${a.key}" aria-label="${N.esc(N.t(a.label))}">${N.icon(a.icon)}</button>`).join('')}</div></td></tr>`).join('')}</tbody></table>
      ${rows.length ? '' : `<div class="empty"><div class="ico">${N.icon('search')}</div><b>${N.t('tbl.none')}</b><button class="btn sm" data-act="clear">${N.t('tbl.clear')}</button></div>`}
      <div class="tfoot"><span>${rows.length} ${N.t('tbl.of')} ${cfg.rows.length} ${N.t('tbl.rows')}</span><span class="faint">${cfg.footer ? cfg.footer(rows) : ''}</span></div></div>`;
      const inp = root.querySelector('input[type=search]');
      inp.oninput = () => { st.q = inp.value; const pos = inp.selectionStart; draw(); const n = root.querySelector('input[type=search]'); n.focus(); n.setSelectionRange(pos, pos); };
      root.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { st.filter = st.filter === b.dataset.f ? null : b.dataset.f; draw(); });
      root.querySelectorAll('th[data-sort]').forEach((th) => th.onclick = () => { const k = th.dataset.sort; if (!cfg.cols.find((c) => c.key === k).value) return; st.dir = st.sort === k ? -st.dir : 1; st.sort = k; draw(); });
      root.querySelector('[data-act=dens]').onchange = (e) => N.setState({ density: e.target.value });
      root.querySelector('[data-act=cols]').onclick = (e) => openColumns(e.currentTarget);
      root.querySelector('[data-act=export]').onclick = () => exportCsv(rows, cols);
      const nw = root.querySelector('[data-act=new]'); if (nw) nw.onclick = () => (cfg.onNew ? cfg.onNew() : N.toast(N.t(cfg.newLabel) + ' · próximamente'));
      const cl = root.querySelector('[data-act=clear]'); if (cl) cl.onclick = () => { st.q = ''; st.filter = null; draw(); };
      root.querySelectorAll('tbody tr').forEach((tr) => {
        const open = () => { st.sel = tr.dataset.id; root.querySelectorAll('tbody tr').forEach((x) => x.setAttribute('aria-selected', x === tr)); cfg.onRow && cfg.onRow(rows.find((r) => cfg.id_of(r) === tr.dataset.id)); };
        tr.onclick = (e) => { if (!e.target.closest('[data-ract]')) open(); };
        tr.onkeydown = (e) => { if (e.key === 'Enter') open(); if (e.key === 'ArrowDown') tr.nextElementSibling && tr.nextElementSibling.focus(); if (e.key === 'ArrowUp') tr.previousElementSibling && tr.previousElementSibling.focus(); };
        tr.querySelectorAll('[data-ract]').forEach((b) => b.onclick = () => (cfg.onAction ? cfg.onAction(b.dataset.ract, rows.find((r) => cfg.id_of(r) === tr.dataset.id)) : N.toast(N.t(cfg.actions.find((a) => a.key === b.dataset.ract).label) + ' · ' + tr.dataset.id)));
      });
    }
    function openColumns(btn) {
      document.querySelectorAll('.menu').forEach((m) => m.remove());
      const m = N.el(`<div class="menu" role="menu">${cfg.cols.map((c) => `<label><input type="checkbox" data-k="${c.key}" ${st.hidden.includes(c.key) ? '' : 'checked'}> ${N.t(c.label)}</label>`).join('')}</div>`);
      const r = btn.getBoundingClientRect(); m.style.top = r.bottom + window.scrollY + 6 + 'px'; m.style.left = Math.max(8, r.right - 200) + 'px';
      document.body.append(m);
      m.onchange = (e) => { const k = e.target.dataset.k; st.hidden = e.target.checked ? st.hidden.filter((x) => x !== k) : st.hidden.concat(k); N.lsSet('cols.' + cfg.id, st.hidden); const q = m.innerHTML; draw(); };
      setTimeout(() => document.addEventListener('click', function h(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('click', h); } }), 0);
    }
    function exportCsv(rows, cols) {
      const csv = [cols.map((c) => N.t(c.label)), ...rows.map((r) => cols.map((c) => (c.csv ? c.csv(r) : c.value ? c.value(r) : '')))].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = cfg.id + '.csv'; a.click();
    }
    draw();
    return root;
  };

  /* ---------- Panel lateral (formularios y asistentes) ---------- */
  N.drawer = function ({ title, body, saveLabel = N.t('common.save'), onSave, wide }) {
    document.querySelectorAll('.dr-scrim').forEach((d) => d.remove());
    const el = N.el(`<div class="dr-scrim"><aside class="drawer ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${N.esc(title)}"><header><h2>${N.esc(title)}</h2><button class="icon-btn" data-x aria-label="${N.t('common.close')}">${N.icon('x')}</button></header><form novalidate><div class="dr-body">${body}</div><footer><button type="button" class="btn" data-x>${N.t('common.cancel')}</button>${onSave ? `<button class="btn primary" type="submit">${N.esc(saveLabel)}</button>` : ''}</footer></form></aside></div>`);
    const opener = document.activeElement;
    document.body.append(el);
    const close = () => { el.remove(); if (opener && opener.isConnected && opener.focus) opener.focus(); };
    el.querySelectorAll('[data-x]').forEach((b) => b.onclick = close);
    el.onclick = (e) => { if (e.target === el) close(); };
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') { const f = [...el.querySelectorAll('button,input,select,textarea,a[href]')].filter((x) => !x.disabled && !x.closest('[hidden]')); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    });
    const form = el.querySelector('form');
    form.onsubmit = (e) => {
      e.preventDefault();
      el.querySelectorAll('.err').forEach((x) => x.remove());
      const data = Object.fromEntries(new FormData(form).entries());
      const errs = onSave ? onSave(data, close) : null;
      if (errs) Object.entries(errs).forEach(([k, m]) => { const f = form.querySelector(`[name=${k}]`); if (f) f.closest('.field').append(N.el(`<small class="err" role="alert">${N.esc(m)}</small>`)); });
    };
    const first = form.querySelector('input,select'); first && first.focus();
    return { close, el, form };
  };
  N.field = (name, label, o = {}) => `<div class="field" ${o.hide ? 'hidden' : ''}><label for="f-${name}">${N.esc(label)}</label>${o.options ? `<select class="input" id="f-${name}" name="${name}">${o.options.map(([v, l]) => `<option value="${N.esc(v)}" ${String(o.value) === String(v) ? 'selected' : ''}>${N.esc(l)}</option>`).join('')}</select>` : `<input class="input ${o.num ? 'num' : ''}" id="f-${name}" name="${name}" type="${o.type || 'text'}" value="${N.esc(o.value ?? '')}" ${o.step ? `step="${o.step}"` : ''} ${o.min !== undefined ? `min="${o.min}"` : ''} ${o.placeholder ? `placeholder="${N.esc(o.placeholder)}"` : ''}>`}${o.hint ? `<small class="muted">${N.esc(o.hint)}</small>` : ''}</div>`;

  /* ---------- Paleta de búsqueda global (Ctrl/⌘ + K) ---------- */
  N.palette = {
    init() {
      this.root = N.el(`<div class="scrim" role="dialog" aria-modal="true" aria-label="${N.esc(N.t('search.hint'))}"><div class="palette"><input type="text" autocomplete="off" aria-label="${N.esc(N.t('search.hint'))}"><ul role="listbox"></ul></div></div>`);
      document.body.append(this.root);
      this.input = this.root.querySelector('input'); this.list = this.root.querySelector('ul'); this.idx = 0; this.items = [];
      this.root.onclick = (e) => { if (e.target === this.root) this.close(); };
      this.input.oninput = () => this.render();
      this.input.onkeydown = (e) => {
        if (e.key === 'Escape') this.close();
        if (e.key === 'ArrowDown') { this.idx = Math.min(this.idx + 1, this.items.length - 1); this.paint(); e.preventDefault(); }
        if (e.key === 'ArrowUp') { this.idx = Math.max(this.idx - 1, 0); this.paint(); e.preventDefault(); }
        if (e.key === 'Enter' && this.items[this.idx]) this.go(this.items[this.idx]);
      };
      document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); this.open(); } });
    },
    open() { this.opener = document.activeElement; this.input.placeholder = N.t('search.placeholder'); this.root.classList.add('open'); this.input.value = ''; this.render(); this.input.focus(); },
    close() { this.root.classList.remove('open'); if (this.opener && this.opener.isConnected && this.opener.focus) this.opener.focus(); },
    render() {
      const q = this.input.value.trim().toLowerCase(), D = N.data, m = (s) => !q || s.toLowerCase().includes(q);
      const groups = N.searchGlobal ? N.searchGlobal(q) : [];
      this.items = groups.flatMap((g) => g[1]); this.idx = 0;
      this.list.innerHTML = groups.length ? groups.map((g) => `<li class="grp" aria-hidden="true">${N.t(g[0])}</li>` + g[1].map((it) => `<li role="option" data-i="${this.items.indexOf(it)}">${N.icon(it.ico)}<div><b>${N.esc(it.title)}</b><div class="muted" style="font-size:12px">${N.esc(it.sub)}</div></div></li>`).join('')).join('') : `<li class="grp">${N.t('search.empty')}</li>`;
      this.list.querySelectorAll('[data-i]').forEach((li) => li.onclick = () => this.go(this.items[+li.dataset.i]));
      this.paint();
    },
    paint() { this.list.querySelectorAll('[data-i]').forEach((li) => li.setAttribute('aria-selected', +li.dataset.i === this.idx)); },
    go(it) { this.close(); location.hash = it.to; }
  };
})(window.Nexo);
