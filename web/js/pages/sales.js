/* Fase 5 · Ventas: presupuestos, ventas, facturas, cobranzas, por cobrar y devoluciones.
   La lógica de este archivo replica las funciones SQL de la migración 016 (quote_convert_to_sale, sale_issue_invoice, payment_register…). */
(function (N) {
  const L = {
    'es-AR': { 'tab.ventas': 'Ventas', 'sale.new': 'Nueva venta', 'quote.new': 'Nuevo presupuesto', 'pay.new': 'Registrar cobro', 'ret.new': 'Nueva devolución', 'col.sale': 'Venta', 'col.quote': 'Presupuesto', 'col.valid': 'Válido hasta', 'col.invoice': 'Factura', 'col.method': 'Medio', 'col.ref': 'Referencia', 'col.amount': 'Importe', 'col.imputed': 'Imputado', 'col.wallet_part': 'A billetera', 'col.reason': 'Motivo', 'col.refund': 'Reembolso',
      'ss.pendiente': 'Pendiente de pago', 'ss.parcial': 'Pago parcial', 'ss.pagado': 'Pagado', 'ss.preparacion': 'En preparación', 'ss.enviado': 'Enviado', 'ss.entregado': 'Entregado', 'ss.completado': 'Completado', 'ss.cancelado': 'Cancelado', 'ss.devuelto': 'Devuelto',
      'qs.borrador': 'Borrador', 'qs.enviado': 'Enviado', 'qs.aceptado': 'Aceptado', 'qs.rechazado': 'Rechazado', 'qs.convertido': 'Convertido a venta',
      'act.send': 'Marcar como enviado', 'act.accept': 'Marcar como aceptado', 'act.convert': 'Convertir en venta', 'act.reserve': 'Reservar stock', 'act.invoice': 'Emitir factura', 'act.prepare': 'Pasar a preparación', 'act.dispatch': 'Despachar', 'act.deliver': 'Marcar entregada', 'act.complete': 'Completar', 'act.cancel': 'Anular venta', 'act.return': 'Devolución', 'act.collect': 'Cobrar', 'act.complete_ret': 'Completar devolución',
      'f.open_sales': 'En curso', 'f.to_invoice': 'Sin factura', 'f.accepted': 'Aceptados', 'f.requested': 'Solicitadas',
      'form.customer': 'Cliente', 'form.product': 'Producto', 'form.qty': 'Cant.', 'form.price': 'Precio', 'form.addline': 'Agregar línea', 'form.discount': 'Descuento', 'form.shipping': 'Envío', 'form.total': 'Total', 'form.valid_days': 'Validez (días)', 'form.method': 'Medio de pago', 'form.amount': 'Importe', 'form.invoice_opt': 'Aplicar primero a', 'form.auto_oldest': 'Las deudas más antiguas', 'form.reason': 'Motivo', 'form.refund_method': 'Cómo se reembolsa', 'form.sale': 'Venta', 'form.restock': 'Reingresar al stock',
      'err.lines': 'Agregá al menos una línea con producto', 'err.amount': 'El importe debe ser mayor a cero', 'err.reason': 'Indicá el motivo', 'err.ret_qty': 'Cantidad inválida o mayor a la vendida', 'err.ret_none': 'Elegí al menos una cantidad a devolver', 'err.stock': 'No hay stock disponible suficiente',
      'toast.sale_created': 'Venta creada', 'toast.quote_created': 'Presupuesto creado', 'toast.converted': 'Venta creada desde el presupuesto', 'toast.reserved': 'Stock reservado', 'toast.invoiced': 'Factura emitida', 'toast.status': 'Estado actualizado', 'toast.dispatched': 'Venta despachada', 'toast.cancelled': 'Venta anulada', 'toast.paid': 'Cobro registrado', 'toast.returned': 'Devolución completada', 'toast.to_wallet': 'a la billetera',
      'det.items': 'Líneas', 'det.history': 'Seguimiento', 'det.paid': 'Cobrado', 'det.open': 'Pendiente', 'det.no_invoice': 'Sin factura', 'det.refund_to_wallet': 'Se devuelve a la billetera lo ya cobrado', 'det.reserved': 'Stock reservado',
      'aging.current': 'Al día', 'aging.d1': '1–30 días', 'aging.d31': '31–60 días', 'aging.d61': '61–90 días', 'aging.d90': 'Más de 90 días', 'aging.total': 'Total por cobrar', 'aging.title': 'Antigüedad de la deuda', 'aging.days_over': 'Días de atraso', 'meth.efectivo': 'Efectivo', 'meth.transferencia': 'Transferencia', 'meth.tarjeta': 'Tarjeta', 'meth.cheque': 'Cheque', 'meth.billetera': 'Billetera', 'meth.mp': 'Mercado Pago' },
    en: { 'tab.ventas': 'Sales', 'sale.new': 'New sale', 'quote.new': 'New quote', 'pay.new': 'Record payment', 'ret.new': 'New return', 'col.sale': 'Sale', 'col.quote': 'Quote', 'col.valid': 'Valid until', 'col.invoice': 'Invoice', 'col.method': 'Method', 'col.ref': 'Reference', 'col.amount': 'Amount', 'col.imputed': 'Allocated', 'col.wallet_part': 'To wallet', 'col.reason': 'Reason', 'col.refund': 'Refund',
      'ss.pendiente': 'Awaiting payment', 'ss.parcial': 'Partially paid', 'ss.pagado': 'Paid', 'ss.preparacion': 'In preparation', 'ss.enviado': 'Shipped', 'ss.entregado': 'Delivered', 'ss.completado': 'Completed', 'ss.cancelado': 'Cancelled', 'ss.devuelto': 'Returned',
      'qs.borrador': 'Draft', 'qs.enviado': 'Sent', 'qs.aceptado': 'Accepted', 'qs.rechazado': 'Rejected', 'qs.convertido': 'Converted to sale',
      'act.send': 'Mark as sent', 'act.accept': 'Mark as accepted', 'act.convert': 'Convert to sale', 'act.reserve': 'Reserve stock', 'act.invoice': 'Issue invoice', 'act.prepare': 'Move to preparation', 'act.dispatch': 'Dispatch', 'act.deliver': 'Mark delivered', 'act.complete': 'Complete', 'act.cancel': 'Cancel sale', 'act.return': 'Return', 'act.collect': 'Collect', 'act.complete_ret': 'Complete return',
      'f.open_sales': 'In progress', 'f.to_invoice': 'Not invoiced', 'f.accepted': 'Accepted', 'f.requested': 'Requested',
      'form.customer': 'Customer', 'form.product': 'Product', 'form.qty': 'Qty', 'form.price': 'Price', 'form.addline': 'Add line', 'form.discount': 'Discount', 'form.shipping': 'Shipping', 'form.total': 'Total', 'form.valid_days': 'Validity (days)', 'form.method': 'Payment method', 'form.amount': 'Amount', 'form.invoice_opt': 'Apply first to', 'form.auto_oldest': 'Oldest debts', 'form.reason': 'Reason', 'form.refund_method': 'Refund as', 'form.sale': 'Sale', 'form.restock': 'Return to stock',
      'err.lines': 'Add at least one line with a product', 'err.amount': 'Amount must be greater than zero', 'err.reason': 'Enter a reason', 'err.ret_qty': 'Invalid quantity or more than sold', 'err.ret_none': 'Choose at least one quantity to return', 'err.stock': 'Not enough available stock',
      'toast.sale_created': 'Sale created', 'toast.quote_created': 'Quote created', 'toast.converted': 'Sale created from the quote', 'toast.reserved': 'Stock reserved', 'toast.invoiced': 'Invoice issued', 'toast.status': 'Status updated', 'toast.dispatched': 'Sale dispatched', 'toast.cancelled': 'Sale cancelled', 'toast.paid': 'Payment recorded', 'toast.returned': 'Return completed', 'toast.to_wallet': 'to the wallet',
      'det.items': 'Lines', 'det.history': 'Tracking', 'det.paid': 'Collected', 'det.open': 'Open', 'det.no_invoice': 'No invoice', 'det.refund_to_wallet': 'Anything already collected goes back to the wallet', 'det.reserved': 'Stock reserved',
      'aging.current': 'Current', 'aging.d1': '1–30 days', 'aging.d31': '31–60 days', 'aging.d61': '61–90 days', 'aging.d90': 'Over 90 days', 'aging.total': 'Total receivable', 'aging.title': 'Debt aging', 'aging.days_over': 'Days overdue', 'meth.efectivo': 'Cash', 'meth.transferencia': 'Bank transfer', 'meth.tarjeta': 'Card', 'meth.cheque': 'Cheque', 'meth.billetera': 'Wallet', 'meth.mp': 'Mercado Pago' },
    'pt-BR': { 'tab.ventas': 'Vendas', 'sale.new': 'Nova venda', 'quote.new': 'Novo orçamento', 'pay.new': 'Registrar recebimento', 'ret.new': 'Nova devolução', 'col.sale': 'Venda', 'col.quote': 'Orçamento', 'col.valid': 'Válido até', 'col.invoice': 'Fatura', 'col.method': 'Meio', 'col.ref': 'Referência', 'col.amount': 'Valor', 'col.imputed': 'Imputado', 'col.wallet_part': 'Para carteira', 'col.reason': 'Motivo', 'col.refund': 'Reembolso',
      'ss.pendiente': 'Aguardando pagamento', 'ss.parcial': 'Pago parcial', 'ss.pagado': 'Pago', 'ss.preparacion': 'Em preparação', 'ss.enviado': 'Enviado', 'ss.entregado': 'Entregue', 'ss.completado': 'Concluído', 'ss.cancelado': 'Cancelado', 'ss.devuelto': 'Devolvido',
      'qs.borrador': 'Rascunho', 'qs.enviado': 'Enviado', 'qs.aceptado': 'Aceito', 'qs.rechazado': 'Recusado', 'qs.convertido': 'Convertido em venda',
      'act.send': 'Marcar como enviado', 'act.accept': 'Marcar como aceito', 'act.convert': 'Converter em venda', 'act.reserve': 'Reservar estoque', 'act.invoice': 'Emitir fatura', 'act.prepare': 'Passar para preparação', 'act.dispatch': 'Despachar', 'act.deliver': 'Marcar entregue', 'act.complete': 'Concluir', 'act.cancel': 'Cancelar venda', 'act.return': 'Devolução', 'act.collect': 'Cobrar', 'act.complete_ret': 'Concluir devolução',
      'f.open_sales': 'Em andamento', 'f.to_invoice': 'Sem fatura', 'f.accepted': 'Aceitos', 'f.requested': 'Solicitadas',
      'form.customer': 'Cliente', 'form.product': 'Produto', 'form.qty': 'Qtd.', 'form.price': 'Preço', 'form.addline': 'Adicionar linha', 'form.discount': 'Desconto', 'form.shipping': 'Frete', 'form.total': 'Total', 'form.valid_days': 'Validade (dias)', 'form.method': 'Meio de pagamento', 'form.amount': 'Valor', 'form.invoice_opt': 'Aplicar primeiro a', 'form.auto_oldest': 'Dívidas mais antigas', 'form.reason': 'Motivo', 'form.refund_method': 'Como reembolsar', 'form.sale': 'Venda', 'form.restock': 'Devolver ao estoque',
      'err.lines': 'Adicione ao menos uma linha com produto', 'err.amount': 'O valor deve ser maior que zero', 'err.reason': 'Informe o motivo', 'err.ret_qty': 'Quantidade inválida ou maior que a vendida', 'err.ret_none': 'Escolha ao menos uma quantidade a devolver', 'err.stock': 'Estoque disponível insuficiente',
      'toast.sale_created': 'Venda criada', 'toast.quote_created': 'Orçamento criado', 'toast.converted': 'Venda criada a partir do orçamento', 'toast.reserved': 'Estoque reservado', 'toast.invoiced': 'Fatura emitida', 'toast.status': 'Status atualizado', 'toast.dispatched': 'Venda despachada', 'toast.cancelled': 'Venda cancelada', 'toast.paid': 'Recebimento registrado', 'toast.returned': 'Devolução concluída', 'toast.to_wallet': 'para a carteira',
      'det.items': 'Linhas', 'det.history': 'Acompanhamento', 'det.paid': 'Recebido', 'det.open': 'Pendente', 'det.no_invoice': 'Sem fatura', 'det.refund_to_wallet': 'O que já foi recebido volta para a carteira', 'det.reserved': 'Estoque reservado',
      'aging.current': 'Em dia', 'aging.d1': '1–30 dias', 'aging.d31': '31–60 dias', 'aging.d61': '61–90 dias', 'aging.d90': 'Mais de 90 dias', 'aging.total': 'Total a receber', 'aging.title': 'Idade da dívida', 'aging.days_over': 'Dias de atraso', 'meth.efectivo': 'Dinheiro', 'meth.transferencia': 'Transferência', 'meth.tarjeta': 'Cartão', 'meth.cheque': 'Cheque', 'meth.billetera': 'Carteira', 'meth.mp': 'Mercado Pago' }
  };
  Object.keys(L).forEach((k) => Object.assign(N.DICT[k], L[k]));

  const D = N.data, TODAY = '2026-10-01', R = (N.routes = N.routes || {});
  const cust = (id) => D.customers.find((c) => c.id === id), byName = (n) => D.customers.find((c) => c.name === n);
  const prod = (sku) => D.products2.find((p) => p.sku === sku);
  const money = (m) => N.money(m);
  const addDays = (iso, d) => { const x = new Date(iso + 'T12:00:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
  const lineTotal = (it) => it.qty * it.price - (it.disc || 0);
  const saleTotal = (s) => s.items.reduce((a, i) => a + lineTotal(i), 0) - (s.discount || 0) + (s.shipping || 0);

  /* ---------- Datos de ejemplo derivados de las facturas ---------- */
  if (!D.sales) {
    const st = ['entregado', 'preparacion', 'pendiente', 'pendiente', 'entregado', 'completado', 'parcial', 'pendiente', 'completado'], skus = ['SKU-001', 'SKU-002', 'SKU-003', 'SKU-005'];
    D.sales = D.invoices.map((inv, i) => ({ id: 'VTA-' + String(i + 1).padStart(4, '0'), customer: byName(inv.customer).id, date: inv.date, due: inv.due, status: st[i], reserved: st[i] === 'preparacion', invoice: inv.id,
      items: [{ sku: skus[i % 4], desc: prod(skus[i % 4]).name, qty: 2, price: inv.total / 2, returned: 0 }], discount: 0, shipping: 0, history: [[inv.date, 'Venta creada']] }));
    D.quotes = [
      { id: 'PRE-0001', customer: 'CLI-0010', date: '2026-09-24', valid: '2026-10-24', status: 'aceptado', items: [{ sku: 'SKU-005', desc: 'Soporte para notebook', qty: 10, price: 1190000 }], discount: 500000, shipping: 0 },
      { id: 'PRE-0002', customer: 'CLI-0004', date: '2026-09-29', valid: '2026-10-29', status: 'enviado', items: [{ sku: 'SKU-002', desc: 'Mouse inalámbrico', qty: 6, price: 790000 }], discount: 0, shipping: 120000 },
      { id: 'PRE-0003', customer: 'CLI-0008', date: '2026-09-30', valid: '2026-10-30', status: 'borrador', items: [{ sku: 'SKU-004', desc: 'Cable USB-C 2m', qty: 20, price: 220000 }], discount: 0, shipping: 0 }
    ];
    D.payments = D.invoices.filter((i) => i.paid > 0).map((i, k) => ({ id: 'PAG-' + String(k + 1).padStart(4, '0'), customer: byName(i.customer).id, date: i.date, method: k % 2 ? 'transferencia' : 'efectivo', ref: 'TRX-00' + (k + 1), amount: i.paid, alloc: [[i.id, i.paid]], wallet: 0 }));
    D.returns = [];
  }
  const sTotal = (s) => (s.total != null ? s.total : saleTotal(s));   // con servidor: total con impuestos calculado por la base
  const invOf = (s) => D.invoices.find((i) => i.id === s.invoice);
  const recalcCustomer = (id) => { const c = cust(id); c.balance = D.invoices.filter((i) => i.customer === c.name).reduce((a, i) => a + i.open, 0); };
  const syncPayState = (s) => { const iv = invOf(s); if (!iv || !['pendiente', 'parcial', 'pagado'].includes(s.status)) return; s.status = iv.open === 0 ? 'pagado' : iv.paid ? 'parcial' : 'pendiente'; };
  const ssChip = (k) => N.chip({ pendiente: 'info', parcial: 'warn', pagado: 'ok', preparacion: 'violet', enviado: 'violet', entregado: 'ok', completado: '', cancelado: 'danger', devuelto: 'warn' }[k] || '', N.t('ss.' + k));
  const qsChip = (k) => N.chip({ borrador: '', enviado: 'info', aceptado: 'ok', rechazado: 'danger', convertido: 'violet' }[k], N.t('qs.' + k));
  const overdue = (iv) => iv.open > 0 && iv.due < TODAY;
  const daysOver = (iv) => Math.max(0, Math.round((new Date(TODAY) - new Date(iv.due)) / 864e5));
  const who = (c) => `<div class="who"><span class="av">${N.initials(c.name)}</span><div><b>${N.esc(c.name)}</b><small class="mono">${c.id}</small></div></div>`;
  const ok = (key) => { N.toast(N.t(key)); N.closeC360 && N.closeC360(true); N.rerender(); };

  /* ---------- Operaciones (espejo de las funciones SQL) ---------- */
  const ops = {
    reserve(s) { const need = {}; s.items.forEach((i) => (need[i.sku] = (need[i.sku] || 0) + i.qty)); for (const k in need) { const p = prod(k), av = Object.values(p.stock).reduce((a, b) => a + b, 0) - p.reserved; if (av < need[k]) return N.t('err.stock') + ' · ' + p.name; } for (const k in need) prod(k).reserved += need[k]; s.reserved = true; s.history.push([TODAY, N.t('act.reserve')]); return null; },
    invoice(s) { const id = 'INV-' + String(D.invoices.length + 1).padStart(4, '0'), c = cust(s.customer), total = sTotal(s); D.invoices.push({ id, customer: c.name, date: TODAY, due: s.due, total, paid: 0, open: total }); s.invoice = id; s.history.push([TODAY, N.t('act.invoice') + ' ' + id]); recalcCustomer(c.id); },
    prepare(s) { s.status = 'preparacion'; s.history.push([TODAY, N.t('act.prepare')]); },
    dispatch(s) { s.items.forEach((i) => { const p = prod(i.sku); if (s.reserved) p.reserved -= i.qty; let left = i.qty; for (const w of Object.keys(p.stock)) { const t = Math.min(left, p.stock[w]); p.stock[w] -= t; left -= t; D.movements.unshift([TODAY, i.sku, 'Venta', -t, w, 'Venta ' + s.id]); if (!left) break; } }); s.reserved = false; s.status = 'enviado'; s.history.push([TODAY, N.t('act.dispatch')]); },
    step(s, to, label) { s.status = to; s.history.push([TODAY, N.t(label)]); },
    cancel(s) { if (s.reserved) s.items.forEach((i) => (prod(i.sku).reserved -= i.qty)); s.reserved = false; const iv = invOf(s), c = cust(s.customer); let refund = 0; if (iv) { refund = iv.paid; iv.open = 0; iv.cancelled = true; } c.wallet += refund; s.status = 'cancelado'; s.history.push([TODAY, N.t('act.cancel')]); recalcCustomer(c.id); return refund; },
    pay(customerId, method, amount, first, ref) {
      const c = cust(customerId); let left = amount; const alloc = [];
      D.invoices.filter((i) => i.customer === c.name && i.open > 0 && !i.cancelled).sort((a, b) => (a.id === first ? -1 : b.id === first ? 1 : a.due.localeCompare(b.due))).forEach((iv) => { if (left <= 0) return; const a = Math.min(left, iv.open); iv.paid += a; iv.open -= a; alloc.push([iv.id, a]); left -= a; const s = D.sales.find((x) => x.invoice === iv.id); if (s) { syncPayState(s); s.history.push([TODAY, N.t('det.paid') + ' ' + money(a)]); } });
      if (left > 0) c.wallet += left;
      D.payments.unshift({ id: 'PAG-' + String(D.payments.length + 1).padStart(4, '0'), customer: customerId, date: TODAY, method, ref, amount, alloc, wallet: left });
      recalcCustomer(customerId); return left;
    },
    completeReturn(r) {
      const s = D.sales.find((x) => x.id === r.sale), c = cust(s.customer);
      r.items.forEach(([idx, q, restock]) => { const it = s.items[idx]; it.returned += q; if (restock) { const p = prod(it.sku), w = Object.keys(p.stock)[0]; p.stock[w] += q; D.movements.unshift([TODAY, it.sku, 'Devolución de cliente', q, w, 'Devolución ' + r.id]); } });
      if (r.refund === 'billetera') c.wallet += r.total;
      else if (r.refund === 'nota') { let left = r.total; D.invoices.filter((i) => i.customer === c.name && i.open > 0 && i.id === s.invoice).forEach((iv) => { const a = Math.min(left, iv.open); iv.open -= a; iv.credited = (iv.credited || 0) + a; left -= a; }); r.creditNote = r.total - left; }
      r.status = 'completada'; recalcCustomer(c.id);
      if (['enviado', 'entregado', 'completado'].includes(s.status) && s.items.every((i) => i.returned >= i.qty)) { s.status = 'devuelto'; s.history.push([TODAY, N.t('ss.devuelto')]); }
    }
  };

  /* ---------- Formularios ---------- */
  function lineRows(pre) {
    const opts = [['', '—']].concat(D.products2.map((p) => [p.sku, p.name]));
    return `<div id="lines" class="cmp">${[0, 1, 2, 3].map((i) => `<div class="row3" data-row="${i}" ${i > 0 && !(pre && pre[i]) ? 'hidden' : ''}><div class="field"><label for="f-p${i}">${N.t('form.product')}</label><select class="input" id="f-p${i}" name="p${i}">${opts.map(([v, l]) => `<option value="${v}" ${pre && pre[i] && pre[i].sku === v ? 'selected' : ''}>${N.esc(l)}</option>`).join('')}</select></div>
      <div class="field"><label for="f-q${i}">${N.t('form.qty')}</label><input class="input num" id="f-q${i}" name="q${i}" type="number" min="1" step="1" value="${pre && pre[i] ? pre[i].qty : 1}"></div>
      <div class="field"><label for="f-pr${i}">${N.t('form.price')}</label><input class="input num" id="f-pr${i}" name="pr${i}" type="number" min="0" step="0.01" value="${pre && pre[i] ? pre[i].price / 100 : ''}"></div></div>`).join('')}</div>
      <button type="button" class="btn sm" id="addline">${N.icon('plus')}${N.t('form.addline')}</button>`;
  }
  function wireLines(form) {
    form.querySelector('#addline').onclick = () => { const h = form.querySelector('[data-row][hidden]'); if (h) h.hidden = false; };
    const note = N.el('<small class="muted" id="pnote"></small>'); form.querySelector('#addline').after(note);
    const reprice = (i) => {
      const sku = form.querySelector('#f-p' + i).value; if (!sku || !form.customer) return;
      if (N.api.enabled) return N.api.reprice(form, i, note, upd);
      if (!N.pricing) return;
      let cart = 0; for (let j = 0; j < 4; j++) { if (j === i) continue; const sj = form.querySelector('#f-p' + j).value, pj = +form.querySelector('#f-pr' + j).value; if (sj) cart += Math.round(pj * 100) * (+form.querySelector('#f-q' + j).value || 0); }
      const r = N.pricing.resolve(form.customer.value, sku, Math.max(1, +form.querySelector('#f-q' + i).value || 1), cart);
      if (r.hidden) { N.toast(N.t('pr.note.hidden')); form.querySelector('#f-p' + i).value = ''; form.querySelector('#f-pr' + i).value = ''; return; }
      form.querySelector('#f-pr' + i).value = r.unit / 100; if (r.freeShipping && form.shipping) form.shipping.value = 0;
      note.textContent = [r.applied.map((a) => a.name).join(' · '), r.minOrder ? N.t('pr.note.min') + ' ' + money(r.minOrder) : '', r.freeShipping ? N.t('pr.note.free') : ''].filter(Boolean).join(' — ');
    };
    for (let i = 0; i < 4; i++) { form.querySelector('#f-p' + i).onchange = () => { reprice(i); upd(); }; form.querySelector('#f-q' + i).onchange = () => { reprice(i); upd(); }; }
    if (form.customer) form.customer.addEventListener('change', () => { for (let i = 0; i < 4; i++) reprice(i); upd(); });
    const upd = () => { const t = readLines(Object.fromEntries(new FormData(form))); const d = Math.round(+form.discount.value * 100) || 0, sh = Math.round(+form.shipping.value * 100) || 0; form.querySelector('#tot').textContent = money(t.reduce((a, i) => a + lineTotal(i), 0) - d + sh); };
    form.addEventListener('input', upd); upd();
  }
  function readLines(d) { const out = []; for (let i = 0; i < 4; i++) { const p = prod(d['p' + i]); if (p && +d['q' + i] > 0) out.push({ sku: p.sku, desc: p.name, qty: +d['q' + i], price: Math.round((+d['pr' + i] || p.price / 100) * 100) }); } return out; }
  const docForm = (kind, pre) => `${N.field('customer', N.t('form.customer'), { options: D.customers.filter((c) => c.status === 'active').map((c) => [c.id, c.name]), value: pre && pre.customer })}${lineRows(pre && pre.items)}<div class="row2">${N.field('discount', N.t('form.discount'), { type: 'number', min: 0, step: '0.01', num: true, value: 0 })}${N.field('shipping', N.t('form.shipping'), { type: 'number', min: 0, step: '0.01', num: true, value: 0 })}</div>${kind === 'quote' ? N.field('days', N.t('form.valid_days'), { type: 'number', min: 1, num: true, value: 30 }) : ''}<div class="alloc"><b>${N.t('form.total')}</b><b class="num" id="tot">—</b></div>`;
  function newDoc(kind, pre) {
    const dr = N.drawer({ title: N.t(kind === 'quote' ? 'quote.new' : 'sale.new'), wide: true, body: docForm(kind, pre),
      onSave(d, close) { const items = readLines(d); if (!items.length) return { p0: N.t('err.lines') }; const disc = Math.round(+d.discount * 100) || 0, ship = Math.round(+d.shipping * 100) || 0, c = cust(d.customer);
        if (N.api.enabled && kind === 'sale') return void N.api.submit(() => N.api.post('/sales', { customer_id: c.uuid, items: items.map((i) => ({ product_id: prod(i.sku).uuid, quantity: i.qty })), discount_minor: disc, shipping_minor: ship }),
          { close, okMsg: (r) => N.t('toast.sale_created') + ' ' + r.number, fields: { customer_id: 'customer', discount_minor: 'discount', shipping_minor: 'shipping', items: 'p0' } });
        if (kind === 'quote') { D.quotes.unshift({ id: 'PRE-' + String(D.quotes.length + 1).padStart(4, '0'), customer: c.id, date: TODAY, valid: addDays(TODAY, +d.days || 30), status: 'borrador', items, discount: disc, shipping: ship }); close(); ok('toast.quote_created'); }
        else { D.sales.unshift({ id: 'VTA-' + String(D.sales.length + 1).padStart(4, '0'), customer: c.id, date: TODAY, due: addDays(TODAY, c.terms || 0), status: 'pendiente', reserved: false, invoice: null, items: items.map((i) => ({ ...i, returned: 0 })), discount: disc, shipping: ship, history: [[TODAY, N.t('toast.sale_created')]] }); close(); ok('toast.sale_created'); } } });
    wireLines(dr.form);
  }
  N.newDoc = newDoc;
  function collect(customerId, invoiceId) {
    const dr = N.drawer({ title: N.t('pay.new'), saveLabel: N.t('pay.new'), body: `${N.field('customer', N.t('form.customer'), { value: customerId, options: D.customers.map((c) => [c.id, c.name + (c.balance ? ' · ' + money(c.balance) : '')]) })}
      <div class="row2">${N.field('method', N.t('form.method'), { options: [['efectivo', N.t('meth.efectivo')], ['transferencia', N.t('meth.transferencia')], ['tarjeta', N.t('meth.tarjeta')], ['cheque', N.t('meth.cheque')], ['mp', N.t('meth.mp')]] })}${N.field('amount', N.t('form.amount'), { type: 'number', min: 0, step: '0.01', num: true })}</div>
      ${N.field('ref', N.t('col.ref'), {})}<div id="prev" class="cmp"></div>`,
      onSave(d, close) { const a = Math.round(+d.amount * 100); if (!(a > 0)) return { amount: N.t('err.amount') };
        if (N.api.enabled) { const c = cust(d.customer), iv = invoiceId && D.invoices.find((i) => i.id === invoiceId);
          return void N.api.submit(() => N.api.post('/payments', { customer_id: c.uuid, method: N.api.METHOD_OUT[d.method], amount_minor: a, receivable_id: iv && iv.customerId === c.id ? iv.arId : null, reference: d.ref || null }),
            { close, okMsg: (r) => N.t('toast.paid') + ' ' + r.number + (r.to_wallet_minor ? ' · ' + money(r.to_wallet_minor) + ' ' + N.t('toast.to_wallet') : ''), fields: { amount_minor: 'amount', customer_id: 'customer', method: 'method', reference: 'ref' } }); }
        const left = ops.pay(d.customer, d.method, a, invoiceId, d.ref || ''); close(); N.toast(N.t('toast.paid') + (left ? ' · ' + money(left) + ' ' + N.t('toast.to_wallet') : '')); N.closeC360(true); N.rerender(); } });
    const f = dr.form, prev = () => { const c = cust(f.customer.value); let left = Math.round(+f.amount.value * 100) || 0, html = ''; D.invoices.filter((i) => i.customer === c.name && i.open > 0 && !i.cancelled).sort((a, b) => a.due.localeCompare(b.due)).forEach((i) => { if (left <= 0) return; const a = Math.min(left, i.open); left -= a; html += `<div class="alloc"><span class="mono">${i.id}</span><b class="num">${money(a)}</b></div>`; }); if (left > 0) html += `<div class="alloc"><span>${N.t('wal.balance')}</span><b class="num" style="color:var(--ok)">${money(left)}</b></div>`; f.querySelector('#prev').innerHTML = html; };
    f.addEventListener('input', prev); prev();
  }
  N.collectPayment = collect;
  function newReturn(preSale) {
    const sales = D.sales.filter((s) => ['enviado', 'entregado', 'completado'].includes(s.status) && s.items.some((i) => i.returned < i.qty));
    if (!sales.length) return N.toast(N.t('tbl.none'));
    const dr = N.drawer({ title: N.t('ret.new'), wide: true, body: `${N.field('sale', N.t('form.sale'), { value: preSale || sales[0].id, options: sales.map((s) => [s.id, s.id + ' · ' + cust(s.customer).name]) })}<div id="ritems" class="cmp"></div>${N.field('refund', N.t('form.refund_method'), { options: [['billetera', N.t('meth.billetera')], ['nota', 'Nota de crédito'], ['efectivo', N.t('meth.efectivo')], ['transferencia', N.t('meth.transferencia')]] })}${N.field('reason', N.t('form.reason'), {})}`,
      onSave(d, close) { const s = D.sales.find((x) => x.id === d.sale), items = []; let total = 0, bad = false; s.items.forEach((it, i) => { const q = +d['rq' + i] || 0; if (q < 0 || q > it.qty - it.returned) bad = true; if (q > 0) { items.push([i, q, d['rs' + i] === 'on']); total += q * it.price; } }); if (bad) return { rq0: N.t('err.ret_qty') }; if (!items.length) return { rq0: N.t('err.ret_none') }; if (!d.reason.trim()) return { reason: N.t('err.reason') };
        D.returns.unshift({ id: 'DEV-' + String(D.returns.length + 1).padStart(4, '0'), sale: s.id, customer: s.customer, date: TODAY, reason: d.reason, refund: d.refund, items, total, status: 'solicitada' }); close(); ok('ret.new'); } });
    const f = dr.form, draw = () => { const s = D.sales.find((x) => x.id === f.sale.value); f.querySelector('#ritems').innerHTML = s.items.map((it, i) => `<div class="alloc"><span><b>${N.esc(it.desc)}</b><br><small class="muted">${N.t('inv.available')}: ${it.qty - it.returned} · ${money(it.price)}</small></span><span style="display:flex;gap:10px;align-items:center"><input class="input num" style="width:70px" name="rq${i}" type="number" min="0" max="${it.qty - it.returned}" value="0" aria-label="${N.t('form.qty')}"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="rs${i}" checked> ${N.t('form.restock')}</label></span></div>`).join(''); };
    f.sale.onchange = draw; draw();
  }

  /* ---------- Detalle de venta con acciones según el estado ---------- */
  // Con servidor: las acciones llaman a /api/sales/:id/actions/:acción y se recargan los datos.
  const OK_MSG = { reserve: 'toast.reserved', invoice: 'toast.invoiced', prepare: 'toast.status', dispatch: 'toast.dispatched', deliver: 'toast.status', complete: 'toast.status' };
  function apiOp(s, op, dr) {
    dr.el.querySelectorAll('#acts button').forEach((b) => (b.disabled = true));
    N.api.submit(() => N.api.post('/sales/' + s.uuid + '/actions/' + op), { close: dr.close, okMsg: N.t(OK_MSG[op]) })
      .then(() => dr.el.isConnected && dr.el.querySelectorAll('#acts button').forEach((b) => (b.disabled = false)));
  }
  function apiCancel(s) {
    const iv = invOf(s);
    N.drawer({ title: N.t('act.cancel') + ' · ' + s.id, saveLabel: N.t('act.cancel'),
      body: `${N.field('reason', N.t('form.cancel_reason'))}${iv && iv.paid ? `<p class="muted">${N.t('det.refund_to_wallet')}: <b class="num">${money(iv.paid)}</b></p>` : ''}`,
      onSave(d, close) { if (!d.reason.trim()) return { reason: N.t('err.reason') };
        N.api.submit(() => N.api.post('/sales/' + s.uuid + '/actions/cancel', { reason: d.reason.trim() }), { close, okMsg: N.t('toast.cancelled') }); } });
  }
  function openSale(s) {
    if (N.api.enabled && !s._fresh) return void N.api.loadSale(s).then(() => { s._fresh = true; openSale(s); }, (e) => N.toast(e.message));
    delete s._fresh;
    const c = cust(s.customer), iv = invOf(s), total = sTotal(s);
    const A = [];
    if (['pendiente', 'parcial', 'pagado'].includes(s.status)) { if (!s.reserved) A.push(['reserve', 'act.reserve']); if (!iv) A.push(['invoice', 'act.invoice']); A.push(['prepare', 'act.prepare', 'primary']); }
    if (s.status === 'preparacion') A.push(['dispatch', 'act.dispatch', 'primary']);
    if (s.status === 'enviado') A.push(['deliver', 'act.deliver', 'primary']);
    if (s.status === 'entregado') A.push(['complete', 'act.complete', 'primary']);
    if (['enviado', 'entregado', 'completado'].includes(s.status) && !N.api.enabled) A.push(['return', 'act.return']);
    if (iv && iv.open > 0 && !iv.cancelled && s.status !== 'cancelado') A.push(['collect', 'act.collect', 'primary']);
    if (['pendiente', 'parcial', 'pagado', 'preparacion'].includes(s.status)) A.push(['cancel', 'act.cancel', 'danger']);
    const dr = N.drawer({ title: s.id + ' · ' + c.name, wide: true, body: `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${ssChip(s.status)}${s.reserved ? N.chip('violet', N.t('det.reserved'), true) : ''}${iv ? N.chip('', iv.id, true) : N.chip('warn', N.t('det.no_invoice'), true)}</div>
      <div class="mini"><div class="card"><div class="muted">${N.t('form.total')}</div><div class="v num">${money(total)}</div></div><div class="card"><div class="muted">${N.t('det.paid')}</div><div class="v num">${money(iv ? iv.paid : 0)}</div></div><div class="card"><div class="muted">${N.t('det.open')}</div><div class="v num">${money(iv ? iv.open : total)}</div></div></div>
      <div class="tablewrap"><table class="t"><thead><tr><th>${N.t('det.items')}</th><th class="r">${N.t('common.qty')}</th><th class="r">${N.t('form.price')}</th><th class="r">${N.t('col.total')}</th></tr></thead><tbody>${s.items.map((i) => `<tr><td>${N.esc(i.desc)}</td><td class="r num">${i.qty}</td><td class="r num">${money(i.price)}</td><td class="r num">${money(lineTotal(i))}</td></tr>`).join('')}</tbody></table></div>
      ${s.tax ? `<div class="alloc"><span class="muted">${N.t('det.tax')}</span><span class="num">${money(s.tax)}</span></div>` : ''}
      ${['pendiente', 'parcial', 'pagado', 'preparacion'].includes(s.status) && iv && iv.paid ? `<p class="muted">${N.t('det.refund_to_wallet')}</p>` : ''}
      <h3 style="font-size:14px">${N.t('det.history')}</h3><div class="timeline">${s.history.slice().reverse().map(([d, t]) => `<div class="tl"><span class="dot info">${N.icon('check')}</span><div><b>${N.esc(t)}</b><div class="muted" style="font-size:12px">${N.date(d)}</div></div></div>`).join('')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap" id="acts">${A.map(([k, l, v]) => `<button type="button" class="btn sm ${v === 'primary' ? 'primary' : v === 'danger' ? 'danger' : ''}" data-op="${k}">${N.t(l)}</button>`).join('')}</div>` });
    dr.el.querySelector('#acts').onclick = (e) => {
      const k = e.target.closest('[data-op]'); if (!k) return; const op = k.dataset.op;
      if (N.api.enabled && op === 'collect') { dr.close(); return collect(s.customer, s.invoice); }
      if (N.api.enabled && op === 'cancel') return apiCancel(s);
      if (N.api.enabled) return apiOp(s, op, dr);
      if (op === 'reserve') { const err = ops.reserve(s); if (err) return N.toast(err); dr.close(); ok('toast.reserved'); }
      else if (op === 'invoice') { const me = N.pricing && N.pricing.minimumError(s); if (me) { N.toast(me); return; } ops.invoice(s); dr.close(); ok('toast.invoiced'); }
      else if (op === 'prepare') { ops.prepare(s); dr.close(); ok('toast.status'); }
      else if (op === 'dispatch') { ops.dispatch(s); dr.close(); ok('toast.dispatched'); }
      else if (op === 'deliver') { ops.step(s, 'entregado', 'ss.entregado'); dr.close(); ok('toast.status'); }
      else if (op === 'complete') { ops.step(s, 'completado', 'ss.completado'); dr.close(); ok('toast.status'); }
      else if (op === 'cancel') { const r = ops.cancel(s); dr.close(); N.toast(N.t('toast.cancelled') + (r ? ' · ' + money(r) + ' ' + N.t('toast.to_wallet') : '')); N.rerender(); }
      else if (op === 'collect') { dr.close(); collect(s.customer, s.invoice); }
      else if (op === 'return') { dr.close(); newReturn(s.id); }
    };
  }

  /* ---------- Pantallas ---------- */
  const ssKeys = ['pendiente', 'parcial', 'pagado', 'preparacion', 'enviado', 'entregado', 'completado', 'cancelado', 'devuelto'];
  R['ventas/ventas'] = (node) => node.append(N.table({
    id: 'ventas', rows: D.sales, id_of: (r) => r.id, sort: 'date', text: (r) => r.id + ' ' + cust(r.customer).name,
    cols: [
      { key: 'id', label: 'col.sale', value: (r) => r.id, render: (r) => `<span class="mono">${r.id}</span>` },
      { key: 'customer', label: 'col.name', value: (r) => cust(r.customer).name, render: (r) => who(cust(r.customer)) },
      { key: 'date', label: 'col.date', value: (r) => r.date, render: (r) => N.date(r.date) },
      { key: 'status', label: 'col.status', value: (r) => ssKeys.indexOf(r.status), render: (r) => ssChip(r.status) },
      { key: 'invoice', label: 'col.invoice', value: (r) => r.invoice || '', render: (r) => (r.invoice ? `<span class="mono">${r.invoice}</span>` : `<span class="faint">—</span>`) },
      { key: 'total', label: 'col.total', align: 'r', value: sTotal, render: (r) => `<span class="num">${money(sTotal(r))}</span>` },
      { key: 'open', label: 'col.open', align: 'r', value: (r) => (invOf(r) ? invOf(r).open : sTotal(r)), render: (r) => { const o = invOf(r) ? invOf(r).open : sTotal(r); return `<span class="num" style="color:${o && r.status !== 'cancelado' ? 'var(--danger)' : 'var(--muted)'}">${money(r.status === 'cancelado' ? 0 : o)}</span>`; } }
    ],
    filters: [{ key: 'open', label: 'f.open_sales', fn: (r) => !['completado', 'cancelado', 'devuelto'].includes(r.status) }, { key: 'inv', label: 'f.to_invoice', fn: (r) => !r.invoice && r.status !== 'cancelado' }],
    actions: [{ key: 'open', label: 'det.items', icon: 'expand' }], newLabel: 'sale.new', onNew: () => newDoc('sale'), onRow: openSale, onAction: (k, r) => openSale(r),
    footer: (rows) => money(rows.reduce((a, r) => a + sTotal(r), 0))
  }));

  R['ventas/presupuestos'] = (node) => {
    const qTotal = (q) => q.items.reduce((a, i) => a + lineTotal(i), 0) - q.discount + q.shipping;
    function openQuote(q) {
      const A = q.status === 'borrador' ? [['send', 'act.send', 'primary']] : q.status === 'enviado' ? [['accept', 'act.accept', 'primary']] : q.status === 'aceptado' ? [['convert', 'act.convert', 'primary']] : [];
      const dr = N.drawer({ title: q.id + ' · ' + cust(q.customer).name, wide: true, body: `${qsChip(q.status)}<div class="tablewrap"><table class="t"><tbody>${q.items.map((i) => `<tr><td>${N.esc(i.desc)}</td><td class="r num">${i.qty}</td><td class="r num">${money(i.price)}</td><td class="r num">${money(lineTotal(i))}</td></tr>`).join('')}</tbody></table></div><div class="alloc"><b>${N.t('form.total')}</b><b class="num">${money(qTotal(q))}</b></div><div id="acts" style="display:flex;gap:8px">${A.map(([k, l]) => `<button type="button" class="btn primary sm" data-op="${k}">${N.t(l)}</button>`).join('')}</div>` });
      const a = dr.el.querySelector('#acts'); a.onclick = (e) => { const k = e.target.closest('[data-op]'); if (!k) return; const op = k.dataset.op;
        if (op === 'send') q.status = 'enviado'; else if (op === 'accept') q.status = 'aceptado';
        else if (op === 'convert') { const c = cust(q.customer); const s = { id: 'VTA-' + String(D.sales.length + 1).padStart(4, '0'), customer: c.id, date: TODAY, due: addDays(TODAY, c.terms || 0), status: 'pendiente', reserved: false, invoice: null, items: q.items.map((i) => ({ ...i, returned: 0 })), discount: q.discount, shipping: q.shipping, history: [[TODAY, N.t('toast.converted') + ' · ' + q.id]] }; D.sales.unshift(s); q.status = 'convertido'; q.sale = s.id; dr.close(); N.toast(N.t('toast.converted') + ' ' + s.id); return N.rerender(); }
        dr.close(); ok('toast.status'); };
    }
    node.append(N.table({ id: 'presupuestos', rows: D.quotes, id_of: (r) => r.id, sort: 'date', text: (r) => r.id + ' ' + cust(r.customer).name,
      cols: [
        { key: 'id', label: 'col.quote', value: (r) => r.id, render: (r) => `<span class="mono">${r.id}</span>` },
        { key: 'customer', label: 'col.name', value: (r) => cust(r.customer).name, render: (r) => who(cust(r.customer)) },
        { key: 'date', label: 'col.date', value: (r) => r.date, render: (r) => N.date(r.date) },
        { key: 'valid', label: 'col.valid', value: (r) => r.valid, render: (r) => N.date(r.valid) },
        { key: 'status', label: 'col.status', value: (r) => r.status, render: (r) => qsChip(r.status) },
        { key: 'total', label: 'col.total', align: 'r', value: qTotal, render: (r) => `<span class="num">${money(qTotal(r))}</span>` }
      ],
      filters: [{ key: 'acc', label: 'f.accepted', fn: (r) => r.status === 'aceptado' }], newLabel: 'quote.new', onNew: () => newDoc('quote'), onRow: openQuote, actions: [{ key: 'open', label: 'det.items', icon: 'expand' }], onAction: (k, r) => openQuote(r) }));
  };

  R['ventas/cobranzas'] = (node) => node.append(N.table({
    id: 'cobranzas', rows: D.payments, id_of: (r) => r.id, sort: 'date', text: (r) => r.id + ' ' + cust(r.customer).name + ' ' + r.ref,
    cols: [
      { key: 'id', label: 'col.number', value: (r) => r.id, render: (r) => `<span class="mono">${r.id}</span>` },
      { key: 'customer', label: 'col.name', value: (r) => cust(r.customer).name, render: (r) => who(cust(r.customer)) },
      { key: 'date', label: 'col.date', value: (r) => r.date, render: (r) => N.date(r.date) },
      { key: 'method', label: 'col.method', value: (r) => r.method, render: (r) => N.chip('', N.t('meth.' + r.method), true) },
      { key: 'ref', label: 'col.ref', value: (r) => r.ref, render: (r) => `<span class="mono">${N.esc(r.ref || '—')}</span>` },
      { key: 'alloc', label: 'col.imputed', value: (r) => r.alloc.map((a) => a[0]).join(', '), render: (r) => r.alloc.map((a) => `<span class="mono">${a[0]}</span>`).join(', ') || '—' },
      { key: 'wallet', label: 'col.wallet_part', align: 'r', value: (r) => r.wallet, render: (r) => (r.wallet ? `<span class="num" style="color:var(--ok)">${money(r.wallet)}</span>` : '<span class="faint">—</span>') },
      { key: 'amount', label: 'col.amount', align: 'r', value: (r) => r.amount, render: (r) => `<b class="num">${money(r.amount)}</b>` }
    ], newLabel: 'pay.new', onNew: () => collect(), footer: (rows) => money(rows.reduce((a, r) => a + r.amount, 0))
  }));

  R['ventas/porcobrar'] = (node) => {
    const open = D.invoices.filter((i) => i.open > 0 && !i.cancelled);
    const B = [['aging.current', (i) => daysOver(i) === 0], ['aging.d1', (i) => daysOver(i) >= 1 && daysOver(i) <= 30], ['aging.d31', (i) => daysOver(i) >= 31 && daysOver(i) <= 60], ['aging.d61', (i) => daysOver(i) >= 61 && daysOver(i) <= 90], ['aging.d90', (i) => daysOver(i) > 90]];
    const sums = B.map(([k, fn]) => open.filter(fn).reduce((a, i) => a + i.open, 0)), tot = sums.reduce((a, b) => a + b, 0) || 1;
    node.append(N.el(`<div class="card" style="margin-bottom:16px"><h2>${N.t('aging.title')} <span class="num">${money(sums.reduce((a, b) => a + b, 0))}</span></h2>
      <div style="display:flex;height:14px;border-radius:8px;overflow:hidden;margin-bottom:14px">${sums.map((v, i) => `<i style="width:${(v / tot) * 100}%;background:${['var(--ok)', 'var(--info)', 'var(--warn)', 'var(--violet)', 'var(--danger)'][i]}"></i>`).join('')}</div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${B.map(([k], i) => `<div><span class="muted">${N.t(k)}</span><div class="num" style="font-size:20px;font-weight:800">${money(sums[i])}</div></div>`).join('')}</div></div>`));
    node.append(N.table({ id: 'porcobrar', rows: open, id_of: (r) => r.id, sort: 'due', text: (r) => r.id + ' ' + r.customer,
      cols: [
        { key: 'id', label: 'col.invoice', value: (r) => r.id, render: (r) => `<span class="mono">${r.id}</span>` },
        { key: 'customer', label: 'col.name', value: (r) => r.customer, render: (r) => who(byName(r.customer)) },
        { key: 'due', label: 'col.due', value: (r) => r.due, render: (r) => N.date(r.due) },
        { key: 'days', label: 'aging.days_over', align: 'r', value: daysOver, render: (r) => (overdue(r) ? N.chip('danger', daysOver(r) + ' d') : `<span class="faint">—</span>`) },
        { key: 'open', label: 'col.open', align: 'r', value: (r) => r.open, render: (r) => `<b class="num">${money(r.open)}</b>` },
        { key: 'act', label: 'act.collect', align: 'r', render: (r) => `<button class="btn primary sm" data-collect="${r.id}">${N.t('act.collect')}</button>` }
      ],
      filters: [{ key: 'over', label: 'f.overdue', fn: overdue }], footer: (rows) => money(rows.reduce((a, r) => a + r.open, 0)), onRow: () => {} }));
    node.addEventListener('click', (e) => { const b = e.target.closest('[data-collect]'); if (!b) return; e.stopPropagation(); const iv = D.invoices.find((i) => i.id === b.dataset.collect); collect(byName(iv.customer).id, iv.id); }, true);
  };

  R['ventas/devoluciones'] = (node) => node.append(N.table({
    id: 'devoluciones', rows: D.returns, id_of: (r) => r.id, sort: 'date', text: (r) => r.id + ' ' + r.sale + ' ' + cust(r.customer).name,
    cols: [
      { key: 'id', label: 'col.number', value: (r) => r.id, render: (r) => `<span class="mono">${r.id}</span>` },
      { key: 'sale', label: 'col.sale', value: (r) => r.sale, render: (r) => `<span class="mono">${r.sale}</span>` },
      { key: 'customer', label: 'col.name', value: (r) => cust(r.customer).name, render: (r) => who(cust(r.customer)) },
      { key: 'reason', label: 'col.reason', value: (r) => r.reason, render: (r) => N.esc(r.reason) },
      { key: 'refund', label: 'col.refund', value: (r) => r.refund, render: (r) => N.chip('', r.refund === 'nota' ? 'Nota de crédito' : N.t('meth.' + r.refund), true) },
      { key: 'status', label: 'col.status', value: (r) => r.status, render: (r) => N.chip(r.status === 'completada' ? 'ok' : 'info', r.status === 'completada' ? N.t('ss.completado') : N.t('f.requested')) },
      { key: 'total', label: 'col.total', align: 'r', value: (r) => r.total, render: (r) => `<span class="num">${money(r.total)}</span>` },
      { key: 'act', label: 'act.complete_ret', align: 'r', render: (r) => (r.status === 'solicitada' ? `<button class="btn primary sm" data-done="${r.id}">${N.t('act.complete_ret')}</button>` : '') }
    ], newLabel: 'ret.new', onNew: () => newReturn(), onRow: () => {}, filters: [{ key: 'req', label: 'f.requested', fn: (r) => r.status === 'solicitada' }]
  }));
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-done]'); if (!b) return; const r = D.returns.find((x) => x.id === b.dataset.done); if (r && r.status === 'solicitada') { ops.completeReturn(r); N.toast(N.t('toast.returned')); N.rerender(); } });
  N.salesOps = ops;
})(window.Nexo);
