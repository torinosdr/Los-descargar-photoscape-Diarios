/* Fase 6 · Compras: órdenes, proveedores, por pagar y gastos.
   La lógica replica las funciones SQL de la migración 017 (purchase_confirm, purchase_receive, purchase_register_invoice, supplier_payment_register…). */
(function (N) {
  const L = {
    'es-AR': { 'po.new': 'Nueva orden', 'sup.new': 'Nuevo proveedor', 'sp.pay': 'Pagar a proveedor', 'exp.new': 'Nuevo gasto', 'col.po': 'Orden', 'col.supplier': 'Proveedor', 'col.received': 'Recibido', 'col.pay_state': 'Pago', 'col.purchases': 'Compras', 'col.bought': 'Total comprado', 'col.payable': 'Deuda', 'col.last_buy': 'Última compra', 'col.terms': 'Plazo', 'col.category': 'Categoría', 'col.desc': 'Descripción', 'col.supinv': 'Factura proveedor',
      'ps.borrador': 'Borrador', 'ps.ordenado': 'Ordenado', 'ps.parcial': 'Recibido parcial', 'ps.total': 'Recibido total', 'ps.pagado': 'Pagado', 'ps.cancelado': 'Cancelado', 'pp.pendiente': 'Sin pagar', 'pp.parcial': 'Pago parcial', 'pp.pagado': 'Pagado', 'es.pendiente': 'Pendiente', 'es.pagado': 'Pagado',
      'pact.confirm': 'Confirmar orden', 'pact.receive': 'Recibir mercadería', 'pact.invoice': 'Registrar factura del proveedor', 'pact.pay': 'Pagar', 'pact.cancel': 'Cancelar orden', 'pact.expay': 'Marcar pagado',
      'pf.open': 'Por recibir', 'pf.unpaid': 'Con deuda', 'pf.pending': 'Pendientes', 'pf.overdue': 'Vencidas',
      'pform.supplier': 'Proveedor', 'pform.terms': 'Plazo de pago (días)', 'pform.cost': 'Costo', 'pform.name': 'Nombre', 'pform.email': 'Email', 'pform.taxid': 'CUIT', 'pform.invnum': 'Número de factura del proveedor', 'pform.receive_qty': 'Cantidad a recibir', 'pform.category': 'Categoría', 'pform.desc': 'Descripción', 'pform.paynow': 'Pagado con', 'pform.unpaid': 'Todavía sin pagar', 'pform.reason': 'Motivo',
      'perr.lines': 'Agregá al menos una línea con producto', 'perr.name': 'Ingresá el nombre', 'perr.invnum': 'Ingresá el número de factura', 'perr.nothing': 'No hay nada para recibir', 'perr.qty': 'Cantidad mayor a la pendiente', 'perr.amount': 'El importe debe ser mayor a cero', 'perr.over': 'No podés pagar más que la deuda con el proveedor', 'perr.reason': 'Indicá el motivo', 'perr.desc': 'Ingresá la descripción',
      'ptoast.created': 'Orden creada', 'ptoast.confirmed': 'Orden confirmada', 'ptoast.received': 'Mercadería recibida: el stock se actualizó', 'ptoast.invoiced': 'Factura registrada: se generó la deuda', 'ptoast.paid': 'Pago registrado', 'ptoast.cancelled': 'Orden cancelada', 'ptoast.supplier': 'Proveedor guardado', 'ptoast.expense': 'Gasto registrado', 'ptoast.expaid': 'Gasto marcado como pagado',
      'pdet.lines': 'Líneas', 'pdet.pending': 'Pendiente', 'pdet.cannot_cancel': 'Tiene pagos: no se puede cancelar', 'pdet.noinv': 'Sin factura del proveedor', 'pa.title': 'Antigüedad de lo que debés', 'pa.total': 'Total por pagar', 'month.expenses': 'Gastos del mes', 'exp.by_cat': 'Por categoría' },
    en: { 'po.new': 'New order', 'sup.new': 'New supplier', 'sp.pay': 'Pay supplier', 'exp.new': 'New expense', 'col.po': 'Order', 'col.supplier': 'Supplier', 'col.received': 'Received', 'col.pay_state': 'Payment', 'col.purchases': 'Purchases', 'col.bought': 'Total purchased', 'col.payable': 'Owed', 'col.last_buy': 'Last purchase', 'col.terms': 'Terms', 'col.category': 'Category', 'col.desc': 'Description', 'col.supinv': 'Supplier invoice',
      'ps.borrador': 'Draft', 'ps.ordenado': 'Ordered', 'ps.parcial': 'Partly received', 'ps.total': 'Fully received', 'ps.pagado': 'Paid', 'ps.cancelado': 'Cancelled', 'pp.pendiente': 'Unpaid', 'pp.parcial': 'Partly paid', 'pp.pagado': 'Paid', 'es.pendiente': 'Pending', 'es.pagado': 'Paid',
      'pact.confirm': 'Confirm order', 'pact.receive': 'Receive goods', 'pact.invoice': 'Record supplier invoice', 'pact.pay': 'Pay', 'pact.cancel': 'Cancel order', 'pact.expay': 'Mark paid',
      'pf.open': 'To receive', 'pf.unpaid': 'Owing', 'pf.pending': 'Pending', 'pf.overdue': 'Overdue',
      'pform.supplier': 'Supplier', 'pform.terms': 'Payment terms (days)', 'pform.cost': 'Cost', 'pform.name': 'Name', 'pform.email': 'Email', 'pform.taxid': 'Tax ID', 'pform.invnum': 'Supplier invoice number', 'pform.receive_qty': 'Quantity to receive', 'pform.category': 'Category', 'pform.desc': 'Description', 'pform.paynow': 'Paid with', 'pform.unpaid': 'Not paid yet', 'pform.reason': 'Reason',
      'perr.lines': 'Add at least one line with a product', 'perr.name': 'Enter a name', 'perr.invnum': 'Enter the invoice number', 'perr.nothing': 'Nothing to receive', 'perr.qty': 'More than pending', 'perr.amount': 'Amount must be greater than zero', 'perr.over': "You can't pay more than you owe the supplier", 'perr.reason': 'Enter a reason', 'perr.desc': 'Enter a description',
      'ptoast.created': 'Order created', 'ptoast.confirmed': 'Order confirmed', 'ptoast.received': 'Goods received: stock updated', 'ptoast.invoiced': 'Invoice recorded: payable created', 'ptoast.paid': 'Payment recorded', 'ptoast.cancelled': 'Order cancelled', 'ptoast.supplier': 'Supplier saved', 'ptoast.expense': 'Expense recorded', 'ptoast.expaid': 'Expense marked as paid',
      'pdet.lines': 'Lines', 'pdet.pending': 'Pending', 'pdet.cannot_cancel': 'It has payments: cannot cancel', 'pdet.noinv': 'No supplier invoice', 'pa.title': 'Aging of what you owe', 'pa.total': 'Total payable', 'month.expenses': 'Expenses this month', 'exp.by_cat': 'By category' },
    'pt-BR': { 'po.new': 'Novo pedido', 'sup.new': 'Novo fornecedor', 'sp.pay': 'Pagar fornecedor', 'exp.new': 'Nova despesa', 'col.po': 'Pedido', 'col.supplier': 'Fornecedor', 'col.received': 'Recebido', 'col.pay_state': 'Pagamento', 'col.purchases': 'Compras', 'col.bought': 'Total comprado', 'col.payable': 'Dívida', 'col.last_buy': 'Última compra', 'col.terms': 'Prazo', 'col.category': 'Categoria', 'col.desc': 'Descrição', 'col.supinv': 'Fatura do fornecedor',
      'ps.borrador': 'Rascunho', 'ps.ordenado': 'Pedido feito', 'ps.parcial': 'Recebido parcial', 'ps.total': 'Recebido total', 'ps.pagado': 'Pago', 'ps.cancelado': 'Cancelado', 'pp.pendiente': 'Sem pagar', 'pp.parcial': 'Pago parcial', 'pp.pagado': 'Pago', 'es.pendiente': 'Pendente', 'es.pagado': 'Pago',
      'pact.confirm': 'Confirmar pedido', 'pact.receive': 'Receber mercadoria', 'pact.invoice': 'Registrar fatura do fornecedor', 'pact.pay': 'Pagar', 'pact.cancel': 'Cancelar pedido', 'pact.expay': 'Marcar pago',
      'pf.open': 'A receber', 'pf.unpaid': 'Com dívida', 'pf.pending': 'Pendentes', 'pf.overdue': 'Vencidas',
      'pform.supplier': 'Fornecedor', 'pform.terms': 'Prazo de pagamento (dias)', 'pform.cost': 'Custo', 'pform.name': 'Nome', 'pform.email': 'E-mail', 'pform.taxid': 'CNPJ', 'pform.invnum': 'Número da fatura do fornecedor', 'pform.receive_qty': 'Quantidade a receber', 'pform.category': 'Categoria', 'pform.desc': 'Descrição', 'pform.paynow': 'Pago com', 'pform.unpaid': 'Ainda sem pagar', 'pform.reason': 'Motivo',
      'perr.lines': 'Adicione ao menos uma linha com produto', 'perr.name': 'Informe o nome', 'perr.invnum': 'Informe o número da fatura', 'perr.nothing': 'Nada para receber', 'perr.qty': 'Maior que o pendente', 'perr.amount': 'O valor deve ser maior que zero', 'perr.over': 'Você não pode pagar mais do que deve ao fornecedor', 'perr.reason': 'Informe o motivo', 'perr.desc': 'Informe a descrição',
      'ptoast.created': 'Pedido criado', 'ptoast.confirmed': 'Pedido confirmado', 'ptoast.received': 'Mercadoria recebida: estoque atualizado', 'ptoast.invoiced': 'Fatura registrada: dívida gerada', 'ptoast.paid': 'Pagamento registrado', 'ptoast.cancelled': 'Pedido cancelado', 'ptoast.supplier': 'Fornecedor salvo', 'ptoast.expense': 'Despesa registrada', 'ptoast.expaid': 'Despesa marcada como paga',
      'pdet.lines': 'Linhas', 'pdet.pending': 'Pendente', 'pdet.cannot_cancel': 'Tem pagamentos: não pode cancelar', 'pdet.noinv': 'Sem fatura do fornecedor', 'pa.title': 'Idade do que você deve', 'pa.total': 'Total a pagar', 'month.expenses': 'Despesas do mês', 'exp.by_cat': 'Por categoria' }
  };
  Object.keys(L).forEach((k) => Object.assign(N.DICT[k], L[k]));

  const D = N.data, TODAY = '2026-10-01', R = (N.routes = N.routes || {}), money = (m) => N.money(m);
  const addDays = (iso, d) => { const x = new Date(iso + 'T12:00:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
  const prod = (sku) => D.products2.find((p) => p.sku === sku), sup = (id) => D.suppliers.find((s) => s.id === id);
  const ok = (key) => { N.toast(N.t(key)); N.rerender(); };

  if (!D.suppliers) {
    D.suppliers = [
      { id: 'PRV-0001', name: 'Importadora Sur', email: 'ventas@sur.example', taxId: '30-70123456-7', terms: 30 },
      { id: 'PRV-0002', name: 'Tecno Mayorista', email: 'pedidos@tecnomay.example', taxId: '30-71234567-8', terms: 15 },
      { id: 'PRV-0003', name: 'Logística Andes', email: 'info@andes.example', taxId: '30-72345678-9', terms: 0 },
      { id: 'PRV-0004', name: 'Papelera del Plata', email: 'ventas@plata.example', taxId: '30-73456789-0', terms: 45 }
    ];
    const ln = (sku, qty, rec) => ({ sku, desc: prod(sku).name, qty, cost: prod(sku).cost, received: rec });
    D.purchases = [
      { id: 'OC-0001', supplier: 'PRV-0001', date: '2026-08-20', status: 'total', items: [ln('SKU-001', 20, 20)], inv: 'FA-0001-4410', due: '2026-09-19' },
      { id: 'OC-0002', supplier: 'PRV-0002', date: '2026-09-12', status: 'parcial', items: [ln('SKU-002', 30, 12), ln('SKU-003', 10, 10)], inv: 'FB-0003-221', due: '2026-09-27' },
      { id: 'OC-0003', supplier: 'PRV-0001', date: '2026-09-28', status: 'ordenado', items: [ln('SKU-005', 40, 0)], inv: null, due: null },
      { id: 'OC-0004', supplier: 'PRV-0004', date: '2026-09-30', status: 'borrador', items: [ln('SKU-004', 100, 0)], inv: null, due: null }
    ];
    D.purchases.forEach((p) => (p.paid = 0));
    D.purchases[0].paid = 20 * prod('SKU-001').cost; D.purchases[1].paid = 5000000;
    D.supPayments = [
      { id: 'PGP-0001', supplier: 'PRV-0001', date: '2026-09-10', method: 'transferencia', ref: 'T-9921', amount: D.purchases[0].paid, alloc: ['OC-0001'] },
      { id: 'PGP-0002', supplier: 'PRV-0002', date: '2026-09-20', method: 'transferencia', ref: 'T-9980', amount: 5000000, alloc: ['OC-0002'] }
    ];
    D.expCats = ['Servicios', 'Alquiler', 'Impuestos', 'Sueldos', 'Marketing', 'Otros'];
    D.expenses = [
      { id: 'GAS-0001', date: '2026-09-02', cat: 'Alquiler', desc: 'Alquiler depósito', amount: 18500000, status: 'pagado', method: 'transferencia' },
      { id: 'GAS-0002', date: '2026-09-05', cat: 'Servicios', desc: 'Internet y telefonía', amount: 2450000, status: 'pagado', method: 'transferencia' },
      { id: 'GAS-0003', date: '2026-09-15', cat: 'Marketing', desc: 'Publicidad en redes', amount: 3200000, status: 'pagado', method: 'tarjeta' },
      { id: 'GAS-0004', date: '2026-09-28', cat: 'Servicios', desc: 'Electricidad', amount: 1380000, status: 'pendiente', method: null },
      { id: 'GAS-0005', date: '2026-09-30', cat: 'Impuestos', desc: 'Ingresos brutos', amount: 4100000, status: 'pendiente', method: null }
    ];
  }
  const pTotal = (p) => p.items.reduce((a, i) => a + i.qty * i.cost, 0);
  const pOpen = (p) => (p.inv ? pTotal(p) - p.paid : 0);
  const recvPct = (p) => { const q = p.items.reduce((a, i) => a + i.qty, 0), r = p.items.reduce((a, i) => a + i.received, 0); return q ? Math.round((r / q) * 100) : 0; };
  const payState = (p) => (!p.inv || p.paid === 0 ? 'pendiente' : p.paid >= pTotal(p) ? 'pagado' : 'parcial');
  const psChip = (k) => N.chip({ borrador: '', ordenado: 'info', parcial: 'warn', total: 'violet', pagado: 'ok', cancelado: 'danger' }[k], N.t('ps.' + k));
  const ppChip = (k) => N.chip({ pendiente: 'danger', parcial: 'warn', pagado: 'ok' }[k], N.t('pp.' + k));
  const daysOver = (p) => (p.due && pOpen(p) > 0 ? Math.max(0, Math.round((new Date(TODAY) - new Date(p.due)) / 864e5)) : 0);
  const debtOf = (sid) => D.purchases.filter((p) => p.supplier === sid && p.status !== 'cancelado').reduce((a, p) => a + pOpen(p), 0);
  const nextId = (arr, pfx) => pfx + '-' + String(arr.length + 1).padStart(4, '0');
  const supName = (id) => (sup(id) || {}).name || id;

  const ops = {
    confirm(p) { p.status = 'ordenado'; },
    receive(p, qtys) { p.items.forEach((i, k) => { const q = qtys[k] || 0; if (q > 0) { i.received += q; const pr = prod(i.sku), w = Object.keys(pr.stock)[0]; pr.stock[w] += q; D.movements.unshift([TODAY, i.sku, 'Compra', q, w, 'Recepción ' + p.id]); } }); p.status = p.items.every((i) => i.received >= i.qty) ? 'total' : 'parcial'; syncPaid(p); },
    invoice(p, num) { p.inv = num; p.due = addDays(TODAY, sup(p.supplier).terms); },
    pay(supplierId, method, amount, first, ref) {
      let left = amount; const alloc = [];
      D.purchases.filter((p) => p.supplier === supplierId && pOpen(p) > 0 && p.status !== 'cancelado').sort((a, b) => (a.id === first ? -1 : b.id === first ? 1 : a.due.localeCompare(b.due))).forEach((p) => { if (left <= 0) return; const a = Math.min(left, pOpen(p)); p.paid += a; left -= a; alloc.push(p.id); syncPaid(p); });
      D.supPayments.unshift({ id: nextId(D.supPayments, 'PGP'), supplier: supplierId, date: TODAY, method, ref, amount, alloc });
    },
    cancel(p) { p.status = 'cancelado'; p.inv = null; p.due = null; }
  };
  function syncPaid(p) { if (p.status === 'total' && p.inv && p.paid >= pTotal(p)) p.status = 'pagado'; if (p.status === 'pagado' && p.paid < pTotal(p)) p.status = 'total'; }
  const who = (s) => `<div class="who"><span class="av">${N.initials(s.name)}</span><div><b>${N.esc(s.name)}</b><small class="mono">${s.id}</small></div></div>`;

  /* ----- Orden: alta ----- */
  function newPO() {
    const rows = [0, 1, 2].map((i) => `<div class="row3" ${i ? 'hidden' : ''}><div class="field"><label for="f-p${i}">${N.t('form.product')}</label><select class="input" id="f-p${i}" name="p${i}"><option value="">—</option>${D.products2.map((p) => `<option value="${p.sku}">${N.esc(p.name)}</option>`).join('')}</select></div><div class="field"><label for="f-q${i}">${N.t('form.qty')}</label><input class="input num" id="f-q${i}" name="q${i}" type="number" min="1" value="1"></div><div class="field"><label for="f-c${i}">${N.t('pform.cost')}</label><input class="input num" id="f-c${i}" name="c${i}" type="number" min="0" step="0.01"></div></div>`).join('');
    const dr = N.drawer({ title: N.t('po.new'), wide: true, body: `${N.field('supplier', N.t('pform.supplier'), { options: D.suppliers.map((s) => [s.id, s.name]) })}<div class="cmp">${rows}</div><button type="button" class="btn sm" id="addl">${N.icon('plus')}${N.t('form.addline')}</button><div class="alloc"><b>${N.t('form.total')}</b><b class="num" id="tot">—</b></div>`,
      onSave(d, close) { const items = []; for (let i = 0; i < 3; i++) { const p = prod(d['p' + i]); if (p && +d['q' + i] > 0) items.push({ sku: p.sku, desc: p.name, qty: +d['q' + i], cost: Math.round((+d['c' + i] || p.cost / 100) * 100), received: 0 }); } if (!items.length) return { p0: N.t('perr.lines') };
        D.purchases.unshift({ id: nextId(D.purchases, 'OC'), supplier: d.supplier, date: TODAY, status: 'borrador', items, inv: null, due: null, paid: 0 }); close(); ok('ptoast.created'); } });
    const f = dr.form; f.querySelector('#addl').onclick = () => { const h = f.querySelector('.row3[hidden]'); if (h) h.hidden = false; };
    const upd = () => { let t = 0; for (let i = 0; i < 3; i++) { const p = prod(f['p' + i].value); if (p) t += (+f['q' + i].value || 0) * Math.round((+f['c' + i].value || p.cost / 100) * 100); } f.querySelector('#tot').textContent = money(t); };
    for (let i = 0; i < 3; i++) f['p' + i].onchange = () => { const p = prod(f['p' + i].value); if (p) f['c' + i].value = p.cost / 100; upd(); };
    f.addEventListener('input', upd); upd();
  }

  /* ----- Orden: detalle y acciones ----- */
  function receiveForm(p) {
    const dr = N.drawer({ title: N.t('pact.receive') + ' · ' + p.id, saveLabel: N.t('pact.receive'), body: p.items.map((i, k) => `<div class="alloc"><span><b>${N.esc(i.desc)}</b><br><small class="muted">${N.t('pdet.pending')}: ${i.qty - i.received}</small></span><input class="input num" style="width:90px" name="r${k}" type="number" min="0" max="${i.qty - i.received}" value="${i.qty - i.received}" aria-label="${N.t('pform.receive_qty')}"></div>`).join(''),
      onSave(d, close) { const q = p.items.map((_, k) => +d['r' + k] || 0); if (q.some((x, k) => x > p.items[k].qty - p.items[k].received)) return { r0: N.t('perr.qty') }; if (!q.some((x) => x > 0)) return { r0: N.t('perr.nothing') }; ops.receive(p, q); close(); ok('ptoast.received'); } });
    return dr;
  }
  function invoiceForm(p) {
    N.drawer({ title: N.t('pact.invoice') + ' · ' + p.id, saveLabel: N.t('common.save'), body: `${N.field('num', N.t('pform.invnum'), { placeholder: 'FA-0001-00001234' })}<div class="alloc"><span>${N.t('form.total')}</span><b class="num">${money(pTotal(p))}</b></div><p class="muted">${N.t('col.terms')}: ${sup(p.supplier).terms} ${N.t('b2b.days')}</p>`,
      onSave(d, close) { if (!d.num.trim()) return { num: N.t('perr.invnum') }; ops.invoice(p, d.num.trim()); close(); ok('ptoast.invoiced'); } });
  }
  function openPO(p) {
    const A = [];
    if (p.status === 'borrador') A.push(['confirm', 'pact.confirm', 'primary']);
    if (['ordenado', 'parcial'].includes(p.status)) A.push(['receive', 'pact.receive', 'primary']);
    if (['ordenado', 'parcial', 'total', 'pagado'].includes(p.status) && !p.inv) A.push(['invoice', 'pact.invoice']);
    if (p.inv && pOpen(p) > 0) A.push(['pay', 'pact.pay', 'primary']);
    if (['borrador', 'ordenado', 'parcial'].includes(p.status) && p.paid === 0) A.push(['cancel', 'pact.cancel', 'danger']);
    const dr = N.drawer({ title: p.id + ' · ' + supName(p.supplier), wide: true, body: `<div style="display:flex;gap:8px;flex-wrap:wrap">${psChip(p.status)}${p.inv ? N.chip('', p.inv, true) + ppChip(payState(p)) : N.chip('warn', N.t('pdet.noinv'), true)}</div>
      <div class="mini"><div class="card"><div class="muted">${N.t('form.total')}</div><div class="v num">${money(pTotal(p))}</div></div><div class="card"><div class="muted">${N.t('col.received')}</div><div class="v">${recvPct(p)}%</div></div><div class="card"><div class="muted">${N.t('col.payable')}</div><div class="v num">${money(pOpen(p))}</div></div></div>
      <div class="tablewrap"><table class="t"><thead><tr><th>${N.t('pdet.lines')}</th><th class="r">${N.t('common.qty')}</th><th class="r">${N.t('col.received')}</th><th class="r">${N.t('pform.cost')}</th><th class="r">${N.t('col.total')}</th></tr></thead><tbody>${p.items.map((i) => `<tr><td>${N.esc(i.desc)}</td><td class="r num">${i.qty}</td><td class="r num">${i.received}</td><td class="r num">${money(i.cost)}</td><td class="r num">${money(i.qty * i.cost)}</td></tr>`).join('')}</tbody></table></div>
      ${p.paid > 0 ? `<p class="muted">${N.t('pdet.cannot_cancel')}</p>` : ''}<div id="acts" style="display:flex;gap:8px;flex-wrap:wrap">${A.map(([k, l, v]) => `<button type="button" class="btn sm ${v === 'primary' ? 'primary' : v === 'danger' ? 'danger' : ''}" data-op="${k}">${N.t(l)}</button>`).join('')}</div>` });
    dr.el.querySelector('#acts').onclick = (e) => { const b = e.target.closest('[data-op]'); if (!b) return; const op = b.dataset.op; dr.close();
      if (op === 'confirm') { ops.confirm(p); ok('ptoast.confirmed'); } else if (op === 'receive') receiveForm(p); else if (op === 'invoice') invoiceForm(p); else if (op === 'pay') payForm(p.supplier, p.id); else if (op === 'cancel') { ops.cancel(p); ok('ptoast.cancelled'); } };
  }
  function payForm(supplierId, first) {
    const dr = N.drawer({ title: N.t('sp.pay'), saveLabel: N.t('pact.pay'), body: `${N.field('supplier', N.t('pform.supplier'), { value: supplierId, options: D.suppliers.map((s) => [s.id, s.name + (debtOf(s.id) ? ' · ' + money(debtOf(s.id)) : '')]) })}<div class="row2">${N.field('method', N.t('form.method'), { options: [['transferencia', N.t('meth.transferencia')], ['efectivo', N.t('meth.efectivo')], ['cheque', N.t('meth.cheque')]] })}${N.field('amount', N.t('form.amount'), { type: 'number', min: 0, step: '0.01', num: true })}</div>${N.field('ref', N.t('col.ref'), {})}<div id="prev" class="cmp"></div>`,
      onSave(d, close) { const a = Math.round(+d.amount * 100); if (!(a > 0)) return { amount: N.t('perr.amount') }; if (a > debtOf(d.supplier)) return { amount: N.t('perr.over') }; ops.pay(d.supplier, d.method, a, first, d.ref || ''); close(); ok('ptoast.paid'); } });
    const f = dr.form, prev = () => { let left = Math.round(+f.amount.value * 100) || 0, h = ''; D.purchases.filter((p) => p.supplier === f.supplier.value && pOpen(p) > 0 && p.status !== 'cancelado').sort((a, b) => (a.id === first ? -1 : b.id === first ? 1 : a.due.localeCompare(b.due))).forEach((p) => { if (left <= 0) return; const a = Math.min(left, pOpen(p)); left -= a; h += `<div class="alloc"><span class="mono">${p.id} · ${p.inv}</span><b class="num">${money(a)}</b></div>`; }); f.querySelector('#prev').innerHTML = h; };
    f.addEventListener('input', prev); prev();
  }

  /* ----- Pantallas ----- */
  R['compras/ordenes'] = (node) => node.append(N.table({
    id: 'ordenes', rows: D.purchases, id_of: (r) => r.id, sort: 'date', text: (r) => r.id + ' ' + supName(r.supplier),
    cols: [
      { key: 'id', label: 'col.po', value: (r) => r.id, render: (r) => `<span class="mono">${r.id}</span>` },
      { key: 'supplier', label: 'col.supplier', value: (r) => supName(r.supplier), render: (r) => who(sup(r.supplier)) },
      { key: 'date', label: 'col.date', value: (r) => r.date, render: (r) => N.date(r.date) },
      { key: 'status', label: 'col.status', value: (r) => r.status, render: (r) => psChip(r.status) },
      { key: 'recv', label: 'col.received', align: 'r', value: recvPct, render: (r) => `<span class="num">${recvPct(r)}%</span>` },
      { key: 'pay', label: 'col.pay_state', value: payState, render: (r) => (r.inv ? ppChip(payState(r)) : '<span class="faint">—</span>') },
      { key: 'inv', label: 'col.supinv', hidden: true, value: (r) => r.inv || '', render: (r) => `<span class="mono">${N.esc(r.inv || '—')}</span>` },
      { key: 'total', label: 'col.total', align: 'r', value: pTotal, render: (r) => `<b class="num">${money(pTotal(r))}</b>` },
      { key: 'open', label: 'col.payable', align: 'r', value: pOpen, render: (r) => `<span class="num" style="color:${pOpen(r) ? 'var(--danger)' : 'var(--muted)'}">${money(pOpen(r))}</span>` }
    ],
    filters: [{ key: 'open', label: 'pf.open', fn: (r) => ['ordenado', 'parcial'].includes(r.status) }, { key: 'unpaid', label: 'pf.unpaid', fn: (r) => pOpen(r) > 0 }],
    actions: [{ key: 'open', label: 'pdet.lines', icon: 'expand' }], newLabel: 'po.new', onNew: newPO, onRow: openPO, onAction: (k, r) => openPO(r), footer: (rows) => money(rows.reduce((a, r) => a + pTotal(r), 0))
  }));

  function supplierForm() {
    N.drawer({ title: N.t('sup.new'), body: `${N.field('name', N.t('pform.name'))}<div class="row2">${N.field('email', N.t('pform.email'), { type: 'email' })}${N.field('taxId', N.t('pform.taxid'))}</div>${N.field('terms', N.t('pform.terms'), { type: 'number', min: 0, num: true, value: 30 })}`,
      onSave(d, close) { if (!d.name.trim()) return { name: N.t('perr.name') }; if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return { email: N.t('cust.err_email') }; D.suppliers.unshift({ id: nextId(D.suppliers, 'PRV'), name: d.name.trim(), email: d.email, taxId: d.taxId, terms: +d.terms || 0 }); close(); ok('ptoast.supplier'); } });
  }
  R['compras/proveedores'] = (node) => node.append(N.table({
    id: 'proveedores', rows: D.suppliers, id_of: (r) => r.id, sort: 'name', text: (r) => [r.id, r.name, r.email, r.taxId].join(' '),
    cols: [
      { key: 'name', label: 'col.supplier', value: (r) => r.name, render: who },
      { key: 'terms', label: 'col.terms', align: 'r', value: (r) => r.terms, render: (r) => `${r.terms} ${N.t('b2b.days')}` },
      { key: 'count', label: 'col.purchases', align: 'r', value: (r) => D.purchases.filter((p) => p.supplier === r.id && p.status !== 'cancelado').length, render: (r) => D.purchases.filter((p) => p.supplier === r.id && p.status !== 'cancelado').length },
      { key: 'bought', label: 'col.bought', align: 'r', value: (r) => D.purchases.filter((p) => p.supplier === r.id && p.status !== 'cancelado').reduce((a, p) => a + pTotal(p), 0), render: (r) => `<span class="num">${money(D.purchases.filter((p) => p.supplier === r.id && p.status !== 'cancelado').reduce((a, p) => a + pTotal(p), 0))}</span>` },
      { key: 'debt', label: 'col.payable', align: 'r', value: (r) => debtOf(r.id), render: (r) => `<span class="num" style="color:${debtOf(r.id) ? 'var(--danger)' : 'var(--muted)'}">${money(debtOf(r.id))}</span>` },
      { key: 'email', label: 'col.email', hidden: true, value: (r) => r.email, render: (r) => N.esc(r.email) },
      { key: 'taxId', label: 'pform.taxid', hidden: true, value: (r) => r.taxId, render: (r) => `<span class="mono">${N.esc(r.taxId)}</span>` }
    ],
    filters: [{ key: 'debt', label: 'pf.unpaid', fn: (r) => debtOf(r.id) > 0 }], newLabel: 'sup.new', onNew: supplierForm, actions: [{ key: 'pay', label: 'sp.pay', icon: 'wallet' }],
    onAction: (k, r) => payForm(r.id), onRow: (r) => { const ps = D.purchases.filter((p) => p.supplier === r.id); N.drawer({ title: r.name, wide: true, body: `<div class="mini"><div class="card"><div class="muted">${N.t('col.payable')}</div><div class="v num">${money(debtOf(r.id))}</div></div><div class="card"><div class="muted">${N.t('col.terms')}</div><div class="v">${r.terms} ${N.t('b2b.days')}</div></div></div><div class="tablewrap"><table class="t"><tbody>${ps.map((p) => `<tr><td class="mono">${p.id}</td><td>${N.date(p.date)}</td><td>${psChip(p.status)}</td><td class="r num">${money(pTotal(p))}</td></tr>`).join('') || `<tr><td class="muted">—</td></tr>`}</tbody></table></div>` }); }
  }));

  R['compras/porpagar'] = (node) => {
    const open = D.purchases.filter((p) => pOpen(p) > 0 && p.status !== 'cancelado');
    const B = [['aging.current', (p) => daysOver(p) === 0], ['aging.d1', (p) => daysOver(p) >= 1 && daysOver(p) <= 30], ['aging.d31', (p) => daysOver(p) >= 31 && daysOver(p) <= 60], ['aging.d61', (p) => daysOver(p) >= 61 && daysOver(p) <= 90], ['aging.d90', (p) => daysOver(p) > 90]];
    const sums = B.map(([, fn]) => open.filter(fn).reduce((a, p) => a + pOpen(p), 0)), tot = sums.reduce((a, b) => a + b, 0) || 1;
    node.append(N.el(`<div class="card" style="margin-bottom:16px"><h2>${N.t('pa.title')} <span class="num">${money(sums.reduce((a, b) => a + b, 0))}</span></h2><div style="display:flex;height:14px;border-radius:8px;overflow:hidden;margin-bottom:14px">${sums.map((v, i) => `<i style="width:${(v / tot) * 100}%;background:${['var(--ok)', 'var(--info)', 'var(--warn)', 'var(--violet)', 'var(--danger)'][i]}"></i>`).join('')}</div><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${B.map(([k], i) => `<div><span class="muted">${N.t(k)}</span><div class="num" style="font-size:20px;font-weight:800">${money(sums[i])}</div></div>`).join('')}</div></div>`));
    node.append(N.table({ id: 'porpagar', rows: open, id_of: (r) => r.id, sort: 'due', text: (r) => r.id + ' ' + supName(r.supplier) + ' ' + r.inv,
      cols: [
        { key: 'id', label: 'col.po', value: (r) => r.id, render: (r) => `<span class="mono">${r.id}</span>` },
        { key: 'supplier', label: 'col.supplier', value: (r) => supName(r.supplier), render: (r) => who(sup(r.supplier)) },
        { key: 'inv', label: 'col.supinv', value: (r) => r.inv, render: (r) => `<span class="mono">${N.esc(r.inv)}</span>` },
        { key: 'due', label: 'col.due', value: (r) => r.due, render: (r) => N.date(r.due) },
        { key: 'days', label: 'aging.days_over', align: 'r', value: daysOver, render: (r) => (daysOver(r) ? N.chip('danger', daysOver(r) + ' d') : '<span class="faint">—</span>') },
        { key: 'open', label: 'col.open', align: 'r', value: pOpen, render: (r) => `<b class="num">${money(pOpen(r))}</b>` },
        { key: 'act', label: 'pact.pay', align: 'r', render: (r) => `<button class="btn primary sm" data-pay="${r.id}">${N.t('pact.pay')}</button>` }
      ], filters: [{ key: 'over', label: 'pf.overdue', fn: (r) => daysOver(r) > 0 }], footer: (rows) => money(rows.reduce((a, r) => a + pOpen(r), 0)), onRow: () => {} }));
    node.addEventListener('click', (e) => { const b = e.target.closest('[data-pay]'); if (!b) return; e.stopPropagation(); const p = D.purchases.find((x) => x.id === b.dataset.pay); payForm(p.supplier, p.id); }, true);
  };

  function expenseForm() {
    N.drawer({ title: N.t('exp.new'), body: `${N.field('cat', N.t('pform.category'), { options: D.expCats.map((c) => [c, c]) })}${N.field('desc', N.t('pform.desc'))}<div class="row2">${N.field('amount', N.t('form.amount'), { type: 'number', min: 0, step: '0.01', num: true })}${N.field('date', N.t('col.date'), { type: 'date', value: TODAY })}</div>${N.field('method', N.t('pform.paynow'), { options: [['', N.t('pform.unpaid')], ['transferencia', N.t('meth.transferencia')], ['efectivo', N.t('meth.efectivo')], ['tarjeta', N.t('meth.tarjeta')]] })}`,
      onSave(d, close) { const e = {}, a = Math.round(+d.amount * 100); if (!d.desc.trim()) e.desc = N.t('perr.desc'); if (!(a > 0)) e.amount = N.t('perr.amount'); if (Object.keys(e).length) return e; D.expenses.unshift({ id: nextId(D.expenses, 'GAS'), date: d.date || TODAY, cat: d.cat, desc: d.desc.trim(), amount: a, status: d.method ? 'pagado' : 'pendiente', method: d.method || null }); close(); ok('ptoast.expense'); } });
  }
  R['compras/gastos'] = (node) => {
    const m = D.expenses.filter((e) => e.date.slice(0, 7) === TODAY.slice(0, 7)), tot = m.reduce((a, e) => a + e.amount, 0), by = {};
    m.forEach((e) => (by[e.cat] = (by[e.cat] || 0) + e.amount));
    const cats = Object.entries(by).sort((a, b) => b[1] - a[1]), top = cats.length ? cats[0][1] : 1;
    node.append(N.el(`<div class="grid g-main" style="margin-bottom:16px"><div class="card kpi hero"><div class="label">${N.t('month.expenses')}</div><div class="value num">${money(tot)}</div><span class="chip plain" style="background:rgba(255,255,255,.55);color:var(--accent-ink)">${m.length}</span></div><div class="card"><h2>${N.t('exp.by_cat')}</h2>${cats.map(([c, v]) => `<div class="bar-row"><div style="display:flex;justify-content:space-between"><b>${N.esc(c)}</b><span class="num">${money(v)}</span></div><div class="track"><div class="fill" style="width:${(v / top) * 100}%"></div></div></div>`).join('')}</div></div>`));
    node.append(N.table({ id: 'gastos', rows: D.expenses, id_of: (r) => r.id, sort: 'date', text: (r) => r.id + ' ' + r.desc + ' ' + r.cat,
      cols: [
        { key: 'id', label: 'col.number', value: (r) => r.id, render: (r) => `<span class="mono">${r.id}</span>` },
        { key: 'date', label: 'col.date', value: (r) => r.date, render: (r) => N.date(r.date) },
        { key: 'cat', label: 'col.category', value: (r) => r.cat, render: (r) => N.chip('', r.cat, true) },
        { key: 'desc', label: 'col.desc', value: (r) => r.desc, render: (r) => `<b>${N.esc(r.desc)}</b>` },
        { key: 'status', label: 'col.status', value: (r) => r.status, render: (r) => N.chip(r.status === 'pagado' ? 'ok' : 'warn', N.t('es.' + r.status)) },
        { key: 'amount', label: 'col.amount', align: 'r', value: (r) => r.amount, render: (r) => `<b class="num">${money(r.amount)}</b>` },
        { key: 'act', label: 'pact.expay', align: 'r', render: (r) => (r.status === 'pendiente' ? `<button class="btn primary sm" data-exp="${r.id}">${N.t('pact.expay')}</button>` : '') }
      ], filters: [{ key: 'pend', label: 'pf.pending', fn: (r) => r.status === 'pendiente' }], newLabel: 'exp.new', onNew: expenseForm, footer: (rows) => money(rows.reduce((a, r) => a + r.amount, 0)), onRow: () => {} }));
    node.addEventListener('click', (e) => { const b = e.target.closest('[data-exp]'); if (!b) return; e.stopPropagation(); const x = D.expenses.find((y) => y.id === b.dataset.exp); x.status = 'pagado'; x.method = 'transferencia'; ok('ptoast.expaid'); }, true);
  };
})(window.Nexo);
