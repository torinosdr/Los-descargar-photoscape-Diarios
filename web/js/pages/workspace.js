/* Fase 8 · Barra lateral: Contactos, Agenda, Llamadas e Informes.
   Replica v_contacts, calendar_event_create, call_log y las vistas de informes de la migración 019. */
(function (N) {
  const K = {
    'w.contact': ['Contacto', 'Contact', 'Contato'], 'w.org': ['Organización', 'Organization', 'Organização'], 'w.source': ['Origen', 'Source', 'Origem'], 'w.src_customer': ['Cliente', 'Customer', 'Cliente'], 'w.src_lead': ['Lead', 'Lead', 'Lead'],
    'w.f.customers': ['Clientes', 'Customers', 'Clientes'], 'w.f.leads': ['Leads', 'Leads', 'Leads'],
    'w.week': ['Semana del', 'Week of', 'Semana de'], 'w.prev': ['Anterior', 'Previous', 'Anterior'], 'w.next': ['Siguiente', 'Next', 'Próxima'], 'w.today': ['Hoy', 'Today', 'Hoje'], 'w.new_event': ['Nuevo evento', 'New event', 'Novo evento'], 'w.free': ['Libre', 'Free', 'Livre'],
    'w.ev.cita': ['Cita', 'Appointment', 'Compromisso'], 'w.ev.reunion': ['Reunión', 'Meeting', 'Reunião'], 'w.ev.llamada': ['Llamada', 'Call', 'Ligação'], 'w.ev.recordatorio': ['Recordatorio', 'Reminder', 'Lembrete'],
    'w.ev.programada': ['Programada', 'Scheduled', 'Agendado'], 'w.ev.completada': ['Completada', 'Completed', 'Concluído'], 'w.ev.cancelada': ['Cancelada', 'Cancelled', 'Cancelado'],
    'w.f.title': ['Título', 'Title', 'Título'], 'w.f.type': ['Tipo', 'Type', 'Tipo'], 'w.f.date': ['Fecha', 'Date', 'Data'], 'w.f.from': ['Desde', 'From', 'De'], 'w.f.to': ['Hasta', 'To', 'Até'], 'w.f.customer': ['Cliente (opcional)', 'Customer (optional)', 'Cliente (opcional)'], 'w.f.location': ['Lugar', 'Location', 'Local'],
    'w.e.title': ['Ingresá el título', 'Enter a title', 'Informe o título'], 'w.e.end': ['Debe terminar después de empezar', 'Must end after it starts', 'Deve terminar depois de começar'], 'w.e.overlap': ['Ya tenés un evento en ese horario', 'You already have an event at that time', 'Você já tem um evento nesse horário'], 'w.e.date': ['Elegí la fecha', 'Choose a date', 'Escolha a data'],
    'w.a.complete': ['Marcar completada', 'Mark completed', 'Marcar concluído'], 'w.a.cancel': ['Cancelar evento', 'Cancel event', 'Cancelar evento'], 'w.t.event': ['Evento creado', 'Event created', 'Evento criado'], 'w.t.event_status': ['Evento actualizado', 'Event updated', 'Evento atualizado'], 'w.task_due': ['Vence tarea', 'Task due', 'Tarefa vence'],
    'w.call.in': ['Entrante', 'Incoming', 'Recebida'], 'w.call.out': ['Saliente', 'Outgoing', 'Realizada'], 'w.new_call': ['Registrar llamada', 'Log a call', 'Registrar ligação'], 'w.col.when': ['Fecha', 'Date', 'Data'], 'w.col.dir': ['Sentido', 'Direction', 'Sentido'], 'w.col.subject': ['Asunto', 'Subject', 'Assunto'], 'w.col.who': ['Con', 'With', 'Com'], 'w.col.dur': ['Duración', 'Duration', 'Duração'], 'w.col.outcome': ['Resultado', 'Outcome', 'Resultado'],
    'w.f.dir': ['Sentido', 'Direction', 'Sentido'], 'w.f.with': ['Cliente o lead', 'Customer or lead', 'Cliente ou lead'], 'w.f.subject': ['Asunto', 'Subject', 'Assunto'], 'w.f.minutes': ['Duración (min)', 'Duration (min)', 'Duração (min)'], 'w.f.outcome': ['Resultado', 'Outcome', 'Resultado'], 'w.f.notes': ['Notas', 'Notes', 'Notas'],
    'w.e.with': ['Elegí un cliente o un lead', 'Choose a customer or a lead', 'Escolha um cliente ou lead'], 'w.e.subject': ['Ingresá el asunto', 'Enter a subject', 'Informe o assunto'], 'w.t.call': ['Llamada registrada', 'Call logged', 'Ligação registrada'], 'w.kpi.calls': ['Llamadas esta semana', 'Calls this week', 'Ligações esta semana'], 'w.kpi.minutes': ['Minutos hablados', 'Minutes on calls', 'Minutos em ligações'],
    'r.sales': ['Ventas por mes', 'Sales by month', 'Vendas por mês'], 'r.customers': ['Mejores clientes', 'Top customers', 'Melhores clientes'], 'r.products': ['Mejores productos', 'Top products', 'Melhores produtos'], 'r.cash': ['Flujo de caja', 'Cash flow', 'Fluxo de caixa'], 'r.aging': ['Antigüedad de deudas', 'Debt aging', 'Idade das dívidas'],
    'r.month': ['Mes', 'Month', 'Mês'], 'r.count': ['Ventas', 'Sales', 'Vendas'], 'r.total': ['Total', 'Total', 'Total'], 'r.avg': ['Ticket promedio', 'Average ticket', 'Ticket médio'], 'r.last': ['Última venta', 'Last sale', 'Última venda'], 'r.units': ['Unidades', 'Units', 'Unidades'], 'r.revenue': ['Ingresos', 'Revenue', 'Receita'], 'r.cost': ['Costo', 'Cost', 'Custo'], 'r.margin': ['Margen', 'Margin', 'Margem'],
    'r.cash_in': ['Cobrado', 'Collected', 'Recebido'], 'r.supplier_out': ['Pagado a proveedores', 'Paid to suppliers', 'Pago a fornecedores'], 'r.expenses_out': ['Gastos pagados', 'Expenses paid', 'Despesas pagas'], 'r.net': ['Neto', 'Net', 'Líquido'],
    'r.bucket': ['Tramo', 'Bucket', 'Faixa'], 'r.receivable': ['Por cobrar', 'Receivable', 'A receber'], 'r.payable': ['Por pagar', 'Payable', 'A pagar'], 'r.customer': ['Cliente', 'Customer', 'Cliente'], 'r.product': ['Producto', 'Product', 'Produto']
  };
  ['es-AR', 'en', 'pt-BR'].forEach((lg, i) => Object.keys(K).forEach((k) => (N.DICT[lg][k] = K[k][i])));

  const D = N.data, TODAY = '2026-10-01', ME = 'Ana Demo', R = (N.routes = N.routes || {}), t = (k) => N.t(k), esc = N.esc, money = (m) => N.money(m), M = () => N.metrics;
  const ok = (key) => { N.toast(t(key)); N.rerender(); };
  const cust = (id) => D.customers.find((c) => c.id === id), lead = (id) => D.leads.find((l) => l.id === id);
  const nextId = (arr, pfx) => pfx + '-' + String(arr.length + 1).padStart(4, '0');
  const who = (name, sub) => `<div class="who"><span class="av">${N.initials(name)}</span><div><b>${esc(name)}</b>${sub ? `<small class="mono">${esc(sub)}</small>` : ''}</div></div>`;
  const monthLabel = (m) => { const x = N.date(m + '-15', { month: 'long', year: 'numeric' }); return x.charAt(0).toUpperCase() + x.slice(1); };
  const addDays = (iso, d) => { const x = new Date(iso + 'T12:00:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
  const mondayOf = (iso) => { const d = new Date(iso + 'T12:00:00'), w = (d.getDay() + 6) % 7; return addDays(iso, -w); };

  if (!D.events) {
    const ev = (id, title, type, day, from, to, customer, location, status) => ({ id, title, type, start: day + 'T' + from, end: day + 'T' + to, customer, location, status: status || 'programada' });
    D.events = [
      ev('EVT-0001', 'Reunión de equipo comercial', 'reunion', '2026-09-28', '09:00', '10:00', null, 'Oficina'),
      ev('EVT-0002', 'Demo para Hernán Paz', 'cita', '2026-09-29', '15:00', '16:00', null, 'Videollamada'),
      ev('EVT-0003', 'Cobranza Ferretería Central', 'llamada', '2026-09-30', '11:00', '11:30', 'CLI-0006', null, 'completada'),
      ev('EVT-0004', 'Visita a Distribuidora Norte', 'cita', '2026-10-01', '10:00', '11:30', 'CLI-0002', 'Córdoba'),
      ev('EVT-0005', 'Revisión de stock mensual', 'reunion', '2026-10-01', '16:00', '17:00', null, 'Depósito'),
      ev('EVT-0006', 'Enviar propuesta a Vera Eventos', 'recordatorio', '2026-10-02', '09:00', '09:15', null, null),
      ev('EVT-0007', 'Almuerzo con Mayorista Cuyo', 'cita', '2026-10-03', '13:00', '14:30', 'CLI-0010', 'Mendoza')
    ];
    D.calls = [
      { id: 'CAL-0001', at: '2026-09-30T11:00', dir: 'out', subject: 'Reclamo de saldo vencido', customer: 'CLI-0006', lead: null, minutes: 14, outcome: 'Promete pagar el viernes', user: 'Ana Demo', notes: '' },
      { id: 'CAL-0002', at: '2026-09-29T16:20', dir: 'in', subject: 'Consulta por el pedido', customer: 'CLI-0002', lead: null, minutes: 6, outcome: 'Se abrió un ticket', user: 'Vale Sosa', notes: '' },
      { id: 'CAL-0003', at: '2026-09-29T10:05', dir: 'out', subject: 'Primer contacto', customer: null, lead: 'LED-0002', minutes: 9, outcome: 'Pidió catálogo', user: 'Vale Sosa', notes: '' },
      { id: 'CAL-0004', at: '2026-09-28T12:40', dir: 'out', subject: 'Seguimiento de propuesta', customer: null, lead: 'LED-0004', minutes: 18, outcome: 'Va a responder esta semana', user: 'Ana Demo', notes: '' },
      { id: 'CAL-0005', at: '2026-09-25T09:30', dir: 'in', subject: 'Cambio de dirección de entrega', customer: 'CLI-0008', lead: null, minutes: 4, outcome: 'Actualizado', user: 'Carlos Vega', notes: '' }
    ];
  }

  /* ================= Contactos ================= */
  const contacts = () => D.customers.map((c) => ({ id: c.id, name: c.name, org: c.type === 'B2B' ? c.name : '', email: c.email, phone: c.phone, source: 'customer', to: '#/clientes/' + c.id }))
    .concat(D.leads.filter((l) => !['ganado', 'perdido'].includes(l.status)).map((l) => ({ id: l.id, name: l.name, org: l.company || '', email: l.email, phone: l.phone, source: 'lead', to: '#/crm/leads' })));
  R['contactos/'] = (node) => node.append(N.table({
    id: 'contactos', rows: contacts(), id_of: (r) => r.id, sort: 'name', text: (r) => [r.id, r.name, r.org, r.email, r.phone].join(' '),
    cols: [
      { key: 'name', label: 'w.contact', value: (r) => r.name, render: (r) => who(r.name, r.id) },
      { key: 'org', label: 'w.org', value: (r) => r.org, render: (r) => esc(r.org || '—') },
      { key: 'email', label: 'col.email', value: (r) => r.email || '', render: (r) => esc(r.email || '—') },
      { key: 'phone', label: 'col.phone', value: (r) => r.phone || '', render: (r) => esc(r.phone || '—') },
      { key: 'source', label: 'w.source', value: (r) => r.source, render: (r) => N.chip(r.source === 'lead' ? 'warn' : 'info', t('w.src_' + r.source)) }
    ],
    filters: [{ key: 'c', label: 'w.f.customers', fn: (r) => r.source === 'customer' }, { key: 'l', label: 'w.f.leads', fn: (r) => r.source === 'lead' }],
    onRow: (r) => { location.hash = r.to; }
  }));

  /* ================= Agenda ================= */
  let weekOff = 0;
  const evChip = (s) => N.chip({ programada: 'info', completada: 'ok', cancelada: '' }[s], t('w.ev.' + s));
  const time = (iso) => iso.slice(11, 16);
  const overlaps = (a, b) => a.start < b.end && a.end > b.start;
  const evOps = {
    create(d) {
      if (!d.title.trim()) return { title: t('w.e.title') };
      if (!d.date) return { date: t('w.e.date') };
      const ev = { id: nextId(D.events, 'EVT'), title: d.title.trim(), type: d.type, start: d.date + 'T' + d.from, end: d.date + 'T' + d.to, customer: d.customer || null, location: d.location || null, status: 'programada' };
      if (ev.end <= ev.start) return { to: t('w.e.end') };
      if (D.events.some((x) => x.status === 'programada' && overlaps(x, ev))) return { from: t('w.e.overlap') };
      D.events.push(ev); return null;
    }
  };
  function eventForm(day) {
    N.drawer({ title: t('w.new_event'), body: `${N.field('title', t('w.f.title'))}<div class="row2">${N.field('type', t('w.f.type'), { options: ['cita', 'reunion', 'llamada', 'recordatorio'].map((x) => [x, t('w.ev.' + x)]) })}${N.field('date', t('w.f.date'), { type: 'date', value: day || TODAY })}</div><div class="row2">${N.field('from', t('w.f.from'), { type: 'time', value: '09:00' })}${N.field('to', t('w.f.to'), { type: 'time', value: '10:00' })}</div>${N.field('customer', t('w.f.customer'), { options: [['', '—']].concat(D.customers.map((c) => [c.id, c.name])) })}${N.field('location', t('w.f.location'))}`,
      onSave(d, close) { const e = evOps.create(d); if (e) return e; close(); ok('w.t.event'); } });
  }
  function openEvent(e) {
    const dr = N.drawer({ title: e.title, body: `<div style="display:flex;gap:8px;flex-wrap:wrap">${evChip(e.status)}${N.chip('', t('w.ev.' + e.type), true)}</div><p>${N.date(e.start.slice(0, 10))} · ${time(e.start)}–${time(e.end)}</p>${e.customer ? `<p>${esc((cust(e.customer) || {}).name)}</p>` : ''}${e.location ? `<p class="muted">${esc(e.location)}</p>` : ''}
      <div id="acts" style="display:flex;gap:8px;margin-top:14px">${e.status === 'programada' ? `<button type="button" class="btn sm primary" data-st="completada">${t('w.a.complete')}</button><button type="button" class="btn sm danger" data-st="cancelada">${t('w.a.cancel')}</button>` : ''}</div>` });
    const a = dr.el.querySelector('#acts'); if (a) a.onclick = (ev) => { const b = ev.target.closest('[data-st]'); if (!b) return; e.status = b.dataset.st; dr.close(); ok('w.t.event_status'); };
  }
  R['agenda/'] = (node) => {
    const mon = addDays(mondayOf(TODAY), weekOff * 7), days = [...Array(7)].map((_, i) => addDays(mon, i));
    node.append(N.el(`<div class="card" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><b>${t('w.week')} ${N.date(mon)}</b><div style="display:flex;gap:8px"><button class="btn sm" id="wk-prev">${t('w.prev')}</button><button class="btn sm" id="wk-today">${t('w.today')}</button><button class="btn sm" id="wk-next">${t('w.next')}</button><button class="btn sm primary" id="wk-new">${N.icon('plus')}${t('w.new_event')}</button></div></div>`));
    const grid = N.el(`<div class="week">${days.map((d) => {
      const evs = D.events.filter((e) => e.start.startsWith(d)).sort((a, b) => a.start.localeCompare(b.start)), tasks = D.tasks.filter((x) => x.due === d && x.assignee === ME && x.status !== 'completada');
      return `<section class="day ${d === TODAY ? 'today' : ''}" data-day="${d}"><header><b>${N.date(d, { weekday: 'short', day: 'numeric' })}</b></header>${evs.map((e) => `<button type="button" class="ev ${e.status}" data-ev="${e.id}"><b>${time(e.start)}</b> ${esc(e.title)}</button>`).join('')}${tasks.map((x) => `<div class="ev task">${N.icon('check')} ${esc(x.title)}</div>`).join('')}${evs.length + tasks.length ? '' : `<small class="muted">${t('w.free')}</small>`}</section>`;
    }).join('')}</div>`);
    node.append(grid);
    node.querySelector('#wk-prev').onclick = () => { weekOff--; N.rerender(); }; node.querySelector('#wk-next').onclick = () => { weekOff++; N.rerender(); };
    node.querySelector('#wk-today').onclick = () => { weekOff = 0; N.rerender(); }; node.querySelector('#wk-new').onclick = () => eventForm(days.includes(TODAY) ? TODAY : mon);
    grid.addEventListener('click', (e) => { const b = e.target.closest('[data-ev]'); if (b) openEvent(D.events.find((x) => x.id === b.dataset.ev)); });
  };

  /* ================= Llamadas ================= */
  const withName = (c) => (c.customer ? (cust(c.customer) || {}).name : (lead(c.lead) || {}).name) || '—';
  function callForm() {
    const opts = [['', '—']].concat(D.customers.map((c) => ['c:' + c.id, c.name]), D.leads.map((l) => ['l:' + l.id, l.name + ' (lead)']));
    N.drawer({ title: t('w.new_call'), body: `<div class="row2">${N.field('dir', t('w.f.dir'), { options: [['out', t('w.call.out')], ['in', t('w.call.in')]] })}${N.field('minutes', t('w.f.minutes'), { type: 'number', min: 0, num: true, value: 0 })}</div>${N.field('who', t('w.f.with'), { options: opts })}${N.field('subject', t('w.f.subject'))}${N.field('outcome', t('w.f.outcome'))}${N.field('notes', t('w.f.notes'))}`,
      onSave(d, close) { const e = {}; if (!d.who) e.who = t('w.e.with'); if (!d.subject.trim()) e.subject = t('w.e.subject'); if (Object.keys(e).length) return e;
        D.calls.unshift({ id: nextId(D.calls, 'CAL'), at: TODAY + 'T12:00', dir: d.dir, subject: d.subject.trim(), customer: d.who[0] === 'c' ? d.who.slice(2) : null, lead: d.who[0] === 'l' ? d.who.slice(2) : null, minutes: Math.max(0, Math.round(+d.minutes || 0)), outcome: d.outcome, user: ME, notes: d.notes }); close(); ok('w.t.call'); } });
  }
  R['llamadas/'] = (node) => {
    const week = D.calls.filter((c) => c.at.slice(0, 10) >= mondayOf(TODAY));
    node.append(N.el(`<div class="mini" style="margin-bottom:16px"><div class="card"><div class="muted">${t('w.kpi.calls')}</div><div class="v num">${week.length}</div></div><div class="card"><div class="muted">${t('w.kpi.minutes')}</div><div class="v num">${week.reduce((a, c) => a + c.minutes, 0)}</div></div></div>`));
    node.append(N.table({
      id: 'llamadas', rows: D.calls, id_of: (r) => r.id, sort: 'at', text: (r) => [r.subject, withName(r), r.outcome, r.user].join(' '),
      cols: [
        { key: 'at', label: 'w.col.when', value: (r) => r.at, render: (r) => N.date(r.at.slice(0, 10)) + ' <small class="muted">' + time(r.at) + '</small>' },
        { key: 'dir', label: 'w.col.dir', value: (r) => r.dir, render: (r) => N.chip(r.dir === 'in' ? 'info' : 'violet', t('w.call.' + r.dir)) },
        { key: 'subject', label: 'w.col.subject', value: (r) => r.subject, render: (r) => `<b>${esc(r.subject)}</b>` },
        { key: 'who', label: 'w.col.who', value: withName, render: (r) => esc(withName(r)) + (r.lead ? ' ' + N.chip('warn', 'lead', true) : '') },
        { key: 'minutes', label: 'w.col.dur', align: 'r', value: (r) => r.minutes, render: (r) => `<span class="num">${r.minutes} min</span>` },
        { key: 'outcome', label: 'w.col.outcome', value: (r) => r.outcome || '', render: (r) => esc(r.outcome || '—') },
        { key: 'user', label: 'crm.col.owner', hidden: true, value: (r) => r.user, render: (r) => esc(r.user) }
      ],
      filters: [{ key: 'in', label: 'w.call.in', fn: (r) => r.dir === 'in' }, { key: 'out', label: 'w.call.out', fn: (r) => r.dir === 'out' }],
      newLabel: 'w.new_call', onNew: callForm, onRow: () => {}
    }));
  };

  /* ================= Informes ================= */
  let report = 'sales';
  const REPORTS = ['sales', 'customers', 'products', 'cash', 'aging'];
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const sMonth = (m) => M().liveSales().filter((s) => s.date.startsWith(m));
  const allMonths = () => [...new Set(D.sales.map((s) => s.date.slice(0, 7)).concat(D.payments.map((p) => p.date.slice(0, 7)), D.supPayments.map((p) => p.date.slice(0, 7)), D.expenses.map((e) => e.date.slice(0, 7))))].sort().reverse();
  const bucket = (days) => (days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4);
  const daysLate = (due) => Math.round((new Date(TODAY) - new Date(due)) / 864e5);
  const BK = ['aging.current', 'aging.d1', 'aging.d31', 'aging.d61', 'aging.d90'];
  const mCol = { key: 'month', label: 'r.month', value: (r) => r.month, render: (r) => `<b>${monthLabel(r.month)}</b>` };
  const num = (key, label, fn, o) => Object.assign({ key, label, align: 'r', value: fn, render: (r) => `<span class="num">${money(fn(r))}</span>` }, o || {});
  const REP = {
    sales() {
      const rows = [...new Set(D.sales.map((s) => s.date.slice(0, 7)))].sort().reverse().map((m) => ({ month: m, count: sMonth(m).length, total: sum(sMonth(m).map(M().saleTotal)) }));
      return { id: 'inf-ventas', rows, id_of: (r) => r.month, sort: 'month', cols: [mCol, { key: 'count', label: 'r.count', align: 'r', value: (r) => r.count, render: (r) => r.count }, num('total', 'r.total', (r) => r.total, { render: (r) => `<b class="num">${money(r.total)}</b>` }), num('avg', 'r.avg', (r) => (r.count ? Math.round(r.total / r.count) : 0))] };
    },
    customers() {
      const by = {}; M().liveSales().forEach((s) => { const b = (by[s.customer] = by[s.customer] || { id: s.customer, count: 0, total: 0, last: '' }); b.count++; b.total += M().saleTotal(s); if (s.date > b.last) b.last = s.date; });
      const rows = Object.values(by).sort((a, b) => b.total - a.total);
      return { id: 'inf-clientes', rows, id_of: (r) => r.id, sort: null, cols: [{ key: 'c', label: 'r.customer', value: (r) => (cust(r.id) || {}).name, render: (r) => who((cust(r.id) || {}).name || r.id, r.id) }, { key: 'count', label: 'r.count', align: 'r', value: (r) => r.count, render: (r) => r.count }, num('total', 'r.total', (r) => r.total, { render: (r) => `<b class="num">${money(r.total)}</b>` }), { key: 'last', label: 'r.last', value: (r) => r.last, render: (r) => N.date(r.last) }] };
    },
    products() {
      const by = {}; M().liveSales().forEach((s) => s.items.forEach((i) => { const p = D.products2.find((x) => x.sku === i.sku), b = (by[i.sku] = by[i.sku] || { sku: i.sku, name: i.desc, units: 0, revenue: 0, cost: 0 }), u = i.qty - (i.returned || 0); b.units += u; b.revenue += u * i.price - (i.disc || 0); b.cost += u * (p ? p.cost : 0); }));
      const rows = Object.values(by).sort((a, b) => b.revenue - a.revenue);
      return { id: 'inf-productos', rows, id_of: (r) => r.sku, sort: null, cols: [{ key: 'p', label: 'r.product', value: (r) => r.name, render: (r) => who(r.name, r.sku) }, { key: 'units', label: 'r.units', align: 'r', value: (r) => r.units, render: (r) => r.units }, num('revenue', 'r.revenue', (r) => r.revenue), num('cost', 'r.cost', (r) => r.cost), { key: 'margin', label: 'r.margin', align: 'r', value: (r) => (r.revenue ? Math.round(((r.revenue - r.cost) / r.revenue) * 100) : 0), render: (r) => { const m = r.revenue ? Math.round(((r.revenue - r.cost) / r.revenue) * 100) : 0; return `<b class="num" style="color:${m < 0 ? 'var(--danger)' : 'inherit'}">${m}%</b>`; } }] };
    },
    cash() {
      const rows = allMonths().map((m) => { const inn = sum(D.payments.filter((p) => p.date.startsWith(m)).map((p) => p.amount)), sup = sum(D.supPayments.filter((p) => p.date.startsWith(m)).map((p) => p.amount)), exp = sum(D.expenses.filter((e) => e.status === 'pagado' && e.date.startsWith(m)).map((e) => e.amount)); return { month: m, inn, sup, exp, net: inn - sup - exp }; });
      return { id: 'inf-caja', rows, id_of: (r) => r.month, sort: 'month', cols: [mCol, num('inn', 'r.cash_in', (r) => r.inn), num('sup', 'r.supplier_out', (r) => r.sup), num('exp', 'r.expenses_out', (r) => r.exp), num('net', 'r.net', (r) => r.net, { render: (r) => `<b class="num" style="color:${r.net < 0 ? 'var(--danger)' : 'var(--ok)'}">${money(r.net)}</b>` })] };
    },
    aging() {
      const rec = [0, 0, 0, 0, 0], pay = [0, 0, 0, 0, 0];
      M().receivable().forEach((i) => (rec[bucket(daysLate(i.due))] += i.open)); M().payable().forEach((x) => (pay[bucket(daysLate(x.p.due))] += x.open));
      const rows = BK.map((k, i) => ({ k, rec: rec[i], pay: pay[i] }));
      return { id: 'inf-antiguedad', rows, id_of: (r) => r.k, sort: null, cols: [{ key: 'k', label: 'r.bucket', value: (r) => BK.indexOf(r.k), render: (r) => `<b>${t(r.k)}</b>` }, num('rec', 'r.receivable', (r) => r.rec), num('pay', 'r.payable', (r) => r.pay)] };
    }
  };
  R['informes/'] = (node) => {
    node.append(N.el(`<div class="seg-row" role="tablist" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">${REPORTS.map((k) => `<button type="button" class="seg" role="tab" data-rep="${k}" aria-pressed="${k === report}" style="flex-direction:row;padding:8px 14px">${t('r.' + k)}</button>`).join('')}</div>`));
    node.querySelector('.seg-row').onclick = (e) => { const b = e.target.closest('[data-rep]'); if (b) { report = b.dataset.rep; N.rerender(); } };
    const cfg = REP[report]();
    if (report === 'sales' || report === 'cash') {
      const key = report === 'sales' ? 'total' : 'net', rows = cfg.rows.slice().reverse(), max = Math.max(...rows.map((r) => Math.abs(r[key])), 1);
      node.append(N.el(`<div class="card" style="margin-bottom:16px"><h2>${t('r.' + report)}</h2><div class="bars">${rows.map((r) => `<div><span class="num">${money(r[key])}</span><i style="height:${Math.max((Math.abs(r[key]) / max) * 100, 2)}%;${r[key] < 0 ? 'background:var(--danger)' : 'background:var(--accent)'}"></i><span>${N.date(r.month + '-15', { month: 'short' })}</span></div>`).join('')}</div></div>`));
    }
    node.append(N.table(Object.assign({ text: (r) => JSON.stringify(r) }, cfg)));
  };
})(window.Nexo);
