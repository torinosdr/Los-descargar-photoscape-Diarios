/* Estado, navegación (hash) y carcasa de la aplicación. */
(function (N) {
  N.state = { lang: N.lsGet('lang', 'es-AR'), currency: N.lsGet('currency', 'ARS'), theme: N.lsGet('theme', 'light'), density: N.lsGet('density', 'normal') };
  N.setState = (p) => { Object.assign(N.state, p); Object.keys(p).forEach((k) => N.lsSet(k, p[k])); applyState(); render(); };
  function applyState() { const d = document.documentElement; d.dataset.theme = N.state.theme; d.dataset.density = N.state.density; d.lang = N.state.lang.slice(0, 2); }

  // Módulos principales (máx. 6 subpestañas cada uno) y barra lateral de módulos secundarios.
  const MODULES = [
    { key: 'inicio', label: 'nav.home', tabs: [] },
    { key: 'clientes', label: 'nav.clients', phase: 4, tabs: [['lista', 'tab.list'], ['grupos', 'tab.groups'], ['b2b', 'tab.b2b'], ['billetera', 'tab.wallet'], ['segmentos', 'tab.segments'], ['precios', 'tab.pricing']] },
    { key: 'ventas', label: 'nav.sales', phase: 5, tabs: [['facturas', 'tab.invoices'], ['presupuestos', 'tab.quotes'], ['ventas', 'tab.sales'], ['cobranzas', 'tab.payments'], ['porcobrar', 'tab.receivable'], ['devoluciones', 'tab.returns']] },
    { key: 'compras', label: 'nav.purchases', phase: 6, tabs: [['ordenes', 'tab.orders'], ['proveedores', 'tab.suppliers'], ['porpagar', 'tab.payable'], ['gastos', 'tab.expenses'], ['inventario', 'tab.stock']] },
    { key: 'crm', label: 'nav.crm', phase: 7, tabs: [['leads', 'tab.leads'], ['embudo', 'tab.pipeline'], ['tickets', 'tab.tickets'], ['tareas', 'tab.tasks'], ['proyectos', 'tab.projects']] }
  ];
  const RAIL = [['contactos', 'rail.contacts', 'contact', 8], ['agenda', 'rail.agenda', 'calendar', 8], ['llamadas', 'rail.calls', 'phone', 8], ['anuncios', 'rail.announcements', 'megaphone', 10], ['mercadolibre', 'rail.mercadolibre', 'store', 10], ['informes', 'rail.reports', 'chart', 8], ['auditoria', 'rail.audit', 'shield', 10]];

  function route() { const p = (location.hash || '#/inicio').replace(/^#\//, '').split('/'); return { mod: p[0] || 'inicio', sub: p[1] || '' }; }

  function render() {
    if (N.api.blocked()) return;
    N.closeC360 && N.closeC360(true);
    const { mod, sub } = route();
    const M = MODULES.find((m) => m.key === mod), R = RAIL.find((r) => r[0] === mod);
    const isDesign = mod === 'diseno', is360 = mod === 'clientes' && /^CLI-/.test(sub);
    const title = isDesign ? N.t('design.title') : R ? N.t(R[1]) : M ? N.t(M.label) : N.t('nav.home');
    const subtab = M && M.tabs.length ? (M.tabs.find((t) => t[0] === sub) ? sub : M.tabs[0][0]) : '';
    const root = document.getElementById('app');
    const S = N.api.session, me = S ? { name: S.user.name, role: S.user.role_name } : { name: 'Ana Demo', role: N.t('user.role') };
    const routeKey = M && M.tabs.length ? mod + '/' + subtab : mod;
    const demo = N.api.enabled && !isDesign && !is360 && !N.api.connected.includes(routeKey);
    root.innerHTML = `
      <header class="topbar"><a class="brand" href="#/inicio" style="color:inherit;text-decoration:none"><span class="brand-mark">N</span>Nexo</a>
        <nav class="pillnav" aria-label="Principal">${MODULES.map((m) => `<a href="#/${m.key}" ${m.key === mod ? 'aria-current="page"' : ''}>${N.t(m.label).toUpperCase()}</a>`).join('')}</nav>
        <div class="tb-actions">
          <button class="search-btn" id="open-search" aria-label="${N.t('search.hint')}">${N.icon('search')}<span>${N.t('search.hint')}</span><kbd>Ctrl K</kbd></button>
          <select class="select" id="sel-lang" aria-label="${N.t('set.language')}">${N.LANGS.map(([c, n]) => `<option value="${c}" ${c === N.state.lang ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <select class="select" id="sel-cur" aria-label="${N.t('set.currency')}">${Object.keys(N.CURRENCIES).map((c) => `<option ${c === N.state.currency ? 'selected' : ''}>${c}</option>`).join('')}</select>
          <button class="icon-btn bell" id="bell" aria-label="${N.t('d.notifications')}" aria-haspopup="true">${N.icon('bell')}${N.notif && N.notif.unread() ? `<span class="badge">${N.notif.unread()}</span>` : ''}</button>
          <button class="icon-btn" id="theme" aria-label="${N.t('set.theme')}">${N.icon(N.state.theme === 'dark' ? 'sun' : 'moon')}</button>
          <a class="icon-btn" href="#/diseno" aria-label="${N.t('design.title')}" title="${N.t('design.title')}">${N.icon('palette')}</a>
          <span class="avatar" title="${N.esc(me.name)} · ${N.esc(me.role)}">${N.esc(N.initials(me.name))}</span>
          ${N.api.enabled ? `<button class="icon-btn" id="logout" aria-label="${N.t('auth.logout')}" title="${N.t('auth.logout')}">${N.icon('logout')}</button>` : ''}
        </div></header>
      <nav class="rail" aria-label="Módulos">${RAIL.map(([k, l, ic]) => `<a href="#/${k}" data-tip="${N.t(l)}" aria-label="${N.t(l)}" ${k === mod ? 'aria-current="page"' : ''}>${N.icon(ic)}</a>`).join('')}</nav>
      <main id="main">
        ${is360 ? '' : `<div class="page-head"><div><h1>${mod === 'inicio' ? N.t('home.title') + ', ' + N.esc(me.name.split(' ')[0]) : title}</h1>
          ${mod === 'inicio' ? `<div class="muted" style="margin-top:6px">${N.t('home.sub')}</div>` : ''}
          ${M && M.tabs.length ? `<div class="subtabs" role="tablist">${M.tabs.map(([k, l]) => `<a href="#/${mod}/${k}" ${k === subtab ? 'aria-current="page"' : ''}>${N.t(l)}</a>`).join('')}</div>` : ''}</div></div>`}
        ${demo ? `<div class="demo-note" role="note">${N.icon('shield')}${N.t(N.api.partial.includes(routeKey) ? 'api.partial' : 'api.demo')}</div>` : ''}
        <div id="page"></div></main>`;
    root.querySelector('#sel-lang').onchange = (e) => N.setState({ lang: e.target.value });
    root.querySelector('#sel-cur').onchange = (e) => N.setState({ currency: e.target.value });
    root.querySelector('#theme').onclick = () => N.setState({ theme: N.state.theme === 'dark' ? 'light' : 'dark' });
    root.querySelector('#open-search').onclick = () => N.palette.open();
    const lo = root.querySelector('#logout'); if (lo) lo.onclick = () => N.api.logout();
    root.querySelector('#bell').onclick = (e) => { e.stopPropagation(); N.notif.toggle(e.currentTarget); };
    const page = root.querySelector('#page'), P = N.pages;
    if (isDesign) P.diseno(page);
    else if (mod === 'inicio') page.innerHTML = P.inicio();
    else if (is360) P.cliente360(page, sub);
    else if (N.routes && N.routes[mod + '/' + subtab]) N.routes[mod + '/' + subtab](page);
    else if (mod === 'ventas' && subtab === 'facturas') P.facturas(page);
    else if (R) P.wip(page, R[3], R[2]);
    else if (M) P.wip(page, M.phase, mod === 'compras' ? 'cart' : mod === 'crm' ? 'target' : mod === 'ventas' ? 'receipt' : 'users');
    else page.innerHTML = P.inicio();
    document.title = title + ' · Nexo';
    if (N.palette.root) N.palette.input.placeholder = N.t('search.placeholder');
  }
  N.rerender = render;
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  document.addEventListener('DOMContentLoaded', () => { applyState(); N.palette.init(); N.api.start(render); });
})(window.Nexo);
