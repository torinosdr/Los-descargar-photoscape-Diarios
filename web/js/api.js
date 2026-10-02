/* Conexión con el servidor (/api). Si la página se abre como archivo o el servidor no responde, la interfaz
   sigue funcionando con los datos de ejemplo de mock.js. Con servidor: pide login, mantiene la sesión
   (access token en memoria + refresh token en cookie httpOnly) y carga los datos reales de Clientes,
   Ventas y Cobranzas con la misma forma que usan las pantallas. */
(function (N) {
  const L = {
    'es-AR': { 'auth.title': 'Iniciar sesión', 'auth.sub': 'Ingresá con tu cuenta de Nexo', 'auth.email': 'Email', 'auth.password': 'Contraseña', 'auth.submit': 'Ingresar', 'auth.logout': 'Cerrar sesión', 'auth.loading': 'Cargando…', 'auth.expired': 'La sesión expiró. Volvé a iniciar sesión', 'auth.required': 'Completá email y contraseña', 'api.offline': 'No se pudo conectar con el servidor', 'api.demo': 'Datos de demostración: este módulo todavía no está conectado al servidor', 'api.price_note': 'El precio final lo calcula el servidor (lista, escalas y reglas)', 'meth.otro': 'Otro', 'form.cancel_reason': 'Motivo de la anulación', 'det.tax': 'Impuestos', 'api.partial': 'Clientes, ventas, cobranzas y saldos son datos reales; tickets, tareas, compras y embudo todavía son de demostración' },
    en: { 'auth.title': 'Sign in', 'auth.sub': 'Use your Nexo account', 'auth.email': 'Email', 'auth.password': 'Password', 'auth.submit': 'Sign in', 'auth.logout': 'Sign out', 'auth.loading': 'Loading…', 'auth.expired': 'Your session expired. Please sign in again', 'auth.required': 'Enter email and password', 'api.offline': 'Could not reach the server', 'api.demo': 'Demo data: this module is not connected to the server yet', 'api.price_note': 'The server sets the final price (price list, tiers and rules)', 'meth.otro': 'Other', 'form.cancel_reason': 'Cancellation reason', 'det.tax': 'Taxes', 'api.partial': 'Customers, sales, payments and balances are live; tickets, tasks, purchases and pipeline are still demo data' },
    'pt-BR': { 'auth.title': 'Entrar', 'auth.sub': 'Use sua conta Nexo', 'auth.email': 'E-mail', 'auth.password': 'Senha', 'auth.submit': 'Entrar', 'auth.logout': 'Sair', 'auth.loading': 'Carregando…', 'auth.expired': 'A sessão expirou. Entre novamente', 'auth.required': 'Informe e-mail e senha', 'api.offline': 'Não foi possível conectar ao servidor', 'api.demo': 'Dados de demonstração: este módulo ainda não está conectado ao servidor', 'api.price_note': 'O preço final é calculado pelo servidor (lista, faixas e regras)', 'meth.otro': 'Outro', 'form.cancel_reason': 'Motivo do cancelamento', 'det.tax': 'Impostos', 'api.partial': 'Clientes, vendas, recebimentos e saldos são dados reais; tickets, tarefas, compras e funil ainda são de demonstração' }
  };
  Object.keys(L).forEach((k) => Object.assign(N.DICT[k], L[k]));

  const api = (N.api = { enabled: false, session: null, token: null });
  // Pantallas que ya leen y escriben en el servidor (el resto muestra el aviso de datos de demostración).
  api.connected = ['clientes/lista', 'clientes/billetera', 'ventas/facturas', 'ventas/ventas', 'ventas/cobranzas', 'ventas/porcobrar'];

  api.partial = ['inicio'];
  class ApiError extends Error { constructor(status, body) { super((body && body.message) || 'Error'); this.status = status; this.body = body || {}; } }

  async function raw(method, path, body) {
    const res = await fetch('/api' + path, {
      method, credentials: 'same-origin',
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(api.token ? { authorization: 'Bearer ' + api.token } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const txt = await res.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = { message: txt }; }
    if (!res.ok) throw new ApiError(res.status, data);
    return data;
  }

  let refreshing = null;
  async function refresh() {
    // Una sola renovación a la vez aunque varias peticiones reciban 401 juntas.
    refreshing = refreshing || raw('POST', '/auth/refresh').then((r) => { setSession(r); return true; }, () => false).finally(() => { refreshing = null; });
    return refreshing;
  }
  function setSession(r) { api.token = r.access_token; api.session = r.session; }

  api.req = async (method, path, body) => {
    try { return await raw(method, path, body); } catch (e) {
      if (e.status !== 401 || path.startsWith('/auth/')) throw e;
      if (await refresh()) return raw(method, path, body);
      api.token = null; api.session = null; showLogin(N.t('auth.expired'));
      throw e;
    }
  };
  api.get = (p) => api.req('GET', p);
  api.post = (p, b) => api.req('POST', p, b || {});
  api.patch = (p, b) => api.req('PATCH', p, b);

  /* ---------- Adaptadores: filas del servidor → forma de N.data ---------- */
  const CST = { Activo: 'active', Inactivo: 'inactive', Bloqueado: 'blocked' };
  const SST = { 'Pendiente de Pago': 'pendiente', 'Pago Parcial': 'parcial', Pagado: 'pagado', 'En Preparación': 'preparacion', Enviado: 'enviado', Entregado: 'entregado', Completado: 'completado', Cancelado: 'cancelado', Devuelto: 'devuelto' };
  const METH = { Efectivo: 'efectivo', Transferencia: 'transferencia', 'Tarjeta de crédito': 'tarjeta', 'Tarjeta de débito': 'tarjeta', Cheque: 'cheque', 'Mercado Pago': 'mp', Billetera: 'billetera' };
  api.METHOD_OUT = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta de crédito', cheque: 'Cheque', mp: 'Mercado Pago', otro: 'Otro' };
  const day = (v) => (v ? String(v).slice(0, 10) : '');
  const recent = (iso) => !!iso && Date.now() - new Date(iso).getTime() < 30 * 864e5;

  const mapCustomer = (r) => ({
    id: r.number, uuid: r.id, name: r.name, type: r.type, person: r.person_type, status: CST[r.status] || 'inactive',
    balance: r.receivable_open_minor, overdue: r.receivable_overdue_minor, wallet: r.wallet_balance_minor, last: day(r.last_sale_at),
    owner: r.owner_name || '—', ownerId: r.owner_id, email: r.email || '', phone: r.phone || '', total: r.sales_total_minor,
    group: r.group_id, limit: r.credit_limit_minor, terms: r.payment_terms_days, taxId: r.tax_id || '',
    firstName: r.first_name || '', lastName: r.last_name || '', company: r.company_name || '', new: recent(r.created_at), timeline: []
  });
  const mapSale = (r) => ({
    id: r.number, uuid: r.id, customer: r.customer_number, date: day(r.sold_at), due: day(r.due_date), status: SST[r.status] || 'pendiente',
    reserved: r.reserved, invoice: r.invoice_number, items: r.items.map((i) => ({ uuid: i.id, sku: i.sku, desc: i.description, qty: i.quantity, price: i.unit_price_minor, disc: i.discount_minor, returned: i.quantity_returned })),
    discount: r.discount_minor, shipping: r.shipping_minor, tax: r.tax_minor, total: r.total_minor, history: [], cancelReason: r.cancel_reason
  });
  const mapHistory = (h) => h.map((x) => [day(x.at), x.title + (x.amount_minor ? ' · ' + N.money(x.amount_minor) : '')]);
  const TL = { venta: 'sale', factura: 'sale', presupuesto: 'sale', pago: 'payment', billetera: 'payment' };
  const mapTimeline = (t) => t.map((x) => [TL[x.kind] || 'note', x.title + (x.detail ? ' · ' + x.detail : ''), day(x.occurred_at)]);

  api.hydrate = async () => {
    const [customers, groups, users, invoices, sales, payments, products, warehouses] = await Promise.all(
      ['/customers', '/customer-groups', '/users', '/invoices', '/sales', '/payments', '/products', '/warehouses'].map((p) => api.get(p).catch((e) => (e.status === 403 ? [] : Promise.reject(e)))));
    const D = N.data;
    D.customers = customers.map(mapCustomer);
    D.groups = groups.map((g) => ({ id: g.id, name: g.name, desc: g.description || '', b2b: g.is_b2b, list: g.price_list_name || '—' }));
    D.users = users;
    D.owners = users.map((u) => u.name);
    D.invoices = invoices.map((i) => ({ id: i.number, uuid: i.id, arId: i.receivable_id, customer: i.customer_name, customerId: i.customer_number, date: day(i.issue_date), due: day(i.due_date), total: i.total_minor, paid: i.paid_minor + i.credited_minor, open: i.status === 'Anulada' ? 0 : i.open_minor, cancelled: i.status === 'Anulada' }));
    D.sales = sales.map(mapSale);
    D.payments = payments.map((p) => ({ id: p.number, uuid: p.id, customer: p.customer_number, date: day(p.paid_at), method: METH[p.method] || 'otro', ref: p.reference || '', amount: p.amount_minor, alloc: p.allocations.map((a) => [a.invoice_number || a.sale_number || '—', a.amount_minor]), wallet: p.to_wallet_minor }));
    D.warehouses = warehouses.map((w) => [w.code, w.name]);
    D.products2 = products.map((p) => ({ uuid: p.id, sku: p.sku, name: p.name, min: p.stock_min, stock: Object.fromEntries(warehouses.map((w) => [w.code, (p.stock || {})[w.code] || 0])), reserved: p.reserved, cost: p.purchase_price_minor, price: p.sale_price_minor }));
    D.products = products.filter((p) => p.track_stock).map((p) => ({ sku: p.sku, name: p.name, stock: p.available }));
    D.quotes = []; D.returns = [];
  };

  // Detalle con historial (venta) o línea de tiempo (cliente), pedido al abrir.
  api.loadSale = async (s) => { const r = await api.get('/sales/' + s.uuid); Object.assign(s, mapSale(r), { history: mapHistory(r.history) }); return s; };
  api.loadCustomer = async (c) => { const r = await api.get('/customers/' + c.uuid); Object.assign(c, mapCustomer(r), { timeline: mapTimeline(r.timeline), _detail: true }); return c; };

  /* ---------- Envío de formularios: deshabilita, muestra errores por campo y refresca los datos ---------- */
  api.submit = async (run, { okMsg, fields = {}, close } = {}) => {
    const form = document.querySelector('.dr-scrim form'), btn = form && form.querySelector('[type=submit]');
    if (btn) btn.disabled = true;
    try {
      const out = await run();
      if (close) close();
      await api.reload();
      if (okMsg) N.toast(typeof okMsg === 'function' ? okMsg(out) : okMsg);
      return out;
    } catch (e) {
      if (e instanceof ApiError && form) {
        form.querySelectorAll('.err').forEach((x) => x.remove());
        Object.entries(e.body.fields || {}).forEach(([k, m]) => {
          const f = form.querySelector(`[name="${fields[k] || k}"]`);
          if (f && f.closest('.field')) f.closest('.field').append(N.el(`<small class="err" role="alert">${N.esc(m)}</small>`));
        });
        // al deshabilitar el botón el foco se pierde: lo llevamos al primer campo con error (o al formulario)
        const bad = form.querySelector('.field:has(.err) input, .field:has(.err) select');
        setTimeout(() => (bad || form.querySelector('input,select') || form).focus(), 0);
      }
      if (!(e instanceof ApiError && e.status === 401)) N.toast(e instanceof ApiError ? e.message : N.t('api.offline'));
      return null;
    } finally { if (btn && btn.isConnected) btn.disabled = false; }
  };
  api.reload = async () => { await api.hydrate(); N.closeC360 && N.closeC360(true); N.rerender(); };

  // Precio calculado por el servidor para una línea del formulario de venta.
  api.reprice = async (form, i, note, upd) => {
    const D = N.data, c = D.customers.find((x) => x.id === form.customer.value), p = D.products2.find((x) => x.sku === form.querySelector('#f-p' + i).value);
    if (!c || !p) return;
    const qty = Math.max(1, +form.querySelector('#f-q' + i).value || 1);
    try {
      const r = await api.get(`/price?customer_id=${c.uuid}&product_id=${p.uuid}&quantity=${qty}`);
      if (r.hidden) { N.toast(N.t('pr.note.hidden')); form.querySelector('#f-p' + i).value = ''; form.querySelector('#f-pr' + i).value = ''; }
      else form.querySelector('#f-pr' + i).value = r.unit_price_minor / 100;
      note.textContent = [(r.applied || []).map((a) => a.name || a.rule || '').filter(Boolean).join(' · '), N.t('api.price_note')].filter(Boolean).join(' — ');
      upd();
    } catch (e) { /* el precio se recalcula igual al guardar */ }
  };

  /* ---------- Login ---------- */
  let onReady = null;
  function showLogin(msg) {
    N.closeC360 && N.closeC360(true);
    document.querySelectorAll('.dr-scrim,.menu').forEach((x) => x.remove());
    const root = document.getElementById('app');
    root.innerHTML = `<main class="login-wrap"><form class="card login" novalidate>
      <div class="brand" style="margin-bottom:18px"><span class="brand-mark">N</span>Nexo</div>
      <h1 style="font-size:22px;margin:0 0 4px">${N.t('auth.title')}</h1><p class="muted" style="margin:0 0 18px">${N.t('auth.sub')}</p>
      ${N.field('email', N.t('auth.email'), { type: 'email' })}${N.field('password', N.t('auth.password'), { type: 'password' })}
      <div class="err-box" role="alert" ${msg ? '' : 'hidden'}>${N.esc(msg || '')}</div>
      <button class="btn primary" type="submit" style="width:100%;justify-content:center;margin-top:8px">${N.t('auth.submit')}</button></form></main>`;
    document.title = N.t('auth.title') + ' · Nexo';
    const f = root.querySelector('form'), box = f.querySelector('.err-box');
    f.querySelector('#f-email').autocomplete = 'username';
    f.querySelector('#f-password').autocomplete = 'current-password';
    f.querySelector('#f-email').focus();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const email = f.email.value.trim(), password = f.password.value;
      const fail = (m) => { box.hidden = false; box.textContent = m; };
      if (!email || !password) return fail(N.t('auth.required'));
      const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = N.t('auth.loading');
      try {
        setSession(await raw('POST', '/auth/login', { email, password }));
        await api.hydrate();
        onReady();
      } catch (err) {
        fail(err instanceof ApiError ? err.message : N.t('api.offline'));
        btn.disabled = false; btn.textContent = N.t('auth.submit');
      }
    };
  }
  api.showLogin = showLogin;
  api.blocked = () => api.enabled && !api.session;

  api.logout = async () => {
    try { await raw('POST', '/auth/logout'); } catch (e) { /* igual se cierra localmente */ }
    api.token = null; api.session = null; location.hash = '#/inicio'; showLogin();
  };

  // Arranque: decide entre modo servidor y modo demostración.
  api.start = async (render) => {
    onReady = render;
    if (location.protocol === 'file:') return render();
    try { const r = await fetch('/api/health'); if (!r.ok) throw new Error(); } catch (e) { return render(); }
    api.enabled = true;
    if (await refresh()) {
      try { await api.hydrate(); return render(); } catch (e) { /* cae al login */ }
    }
    showLogin();
  };
})(window.Nexo);
