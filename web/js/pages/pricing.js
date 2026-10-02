/* Fase 9 · B2B avanzado: escalas por volumen, reglas dinámicas y simulador de precios.
   Replica la migración 020 (price_resolve, price_tier_set/delete, rule_create/validate, sale_check_minimum). */
(function (N) {
  const K = {
    'tab.pricing': ['Precios y reglas', 'Pricing & rules', 'Preços e regras'],
    'pr.v.tiers': ['Escalas por volumen', 'Volume tiers', 'Faixas por volume'], 'pr.v.rules': ['Reglas dinámicas', 'Dynamic rules', 'Regras dinâmicas'], 'pr.v.sim': ['Simulador', 'Simulator', 'Simulador'],
    'pr.plan': ['Incluido en tu plan B2B', 'Included in your B2B plan', 'Incluído no seu plano B2B'],
    'pr.col.product': ['Producto', 'Product', 'Produto'], 'pr.col.list': ['Lista', 'List', 'Lista'], 'pr.col.tiers': ['Escalas', 'Tiers', 'Faixas'], 'pr.col.base': ['Precio base', 'Base price', 'Preço base'], 'pr.col.best': ['Mejor descuento', 'Best discount', 'Melhor desconto'],
    'pr.col.prio': ['Prioridad', 'Priority', 'Prioridade'], 'pr.col.name': ['Regla', 'Rule', 'Regra'], 'pr.col.cond': ['Si…', 'If…', 'Se…'], 'pr.col.act': ['Entonces…', 'Then…', 'Então…'], 'pr.col.valid': ['Vigencia', 'Validity', 'Vigência'], 'pr.col.state': ['Estado', 'Status', 'Status'],
    'pr.new_tier': ['Nueva escala', 'New tier', 'Nova faixa'], 'pr.new_rule': ['Nueva regla', 'New rule', 'Nova regra'], 'pr.edit_tiers': ['Escalas de', 'Tiers for', 'Faixas de'],
    'pr.s.in_force': ['Vigente', 'In force', 'Vigente'], 'pr.s.inactive': ['Inactiva', 'Inactive', 'Inativa'], 'pr.s.scheduled': ['Fuera de vigencia', 'Out of date range', 'Fora de vigência'], 'pr.always': ['Siempre', 'Always', 'Sempre'], 'pr.all': ['Todos', 'All', 'Todos'],
    'pr.f.list': ['Lista de precios', 'Price list', 'Lista de preços'], 'pr.f.product': ['Producto', 'Product', 'Produto'], 'pr.f.minqty': ['Desde (cant.)', 'From (qty)', 'A partir de (qtd.)'], 'pr.f.price': ['Precio unitario', 'Unit price', 'Preço unitário'],
    'pr.f.name': ['Nombre de la regla', 'Rule name', 'Nome da regra'], 'pr.f.prio': ['Prioridad (menor = primero)', 'Priority (lower = first)', 'Prioridade (menor = primeiro)'], 'pr.f.group': ['Grupo de clientes', 'Customer group', 'Grupo de clientes'], 'pr.f.from': ['Vigente desde', 'Valid from', 'Vigente desde'], 'pr.f.until': ['Vigente hasta', 'Valid until', 'Vigente até'],
    'pr.f.stop': ['Cortar el proceso si se aplica', 'Stop processing if applied', 'Parar o processamento se aplicada'], 'pr.f.cond': ['Condiciones (todas deben cumplirse)', 'Conditions (all must match)', 'Condições (todas devem ser cumpridas)'], 'pr.f.act': ['Acciones', 'Actions', 'Ações'], 'pr.f.value': ['Valor', 'Value', 'Valor'], 'pr.f.value_hint': ['Listas con coma: a,b — rango: desde,hasta', 'Lists with commas: a,b — range: from,to', 'Listas com vírgula: a,b — faixa: de,até'],
    'pr.fld.customer_group': ['Grupo de clientes', 'Customer group', 'Grupo de clientes'], 'pr.fld.customer_type': ['Tipo de cliente', 'Customer type', 'Tipo de cliente'], 'pr.fld.customer': ['Cliente', 'Customer', 'Cliente'], 'pr.fld.sku': ['SKU', 'SKU', 'SKU'], 'pr.fld.quantity': ['Cantidad', 'Quantity', 'Quantidade'], 'pr.fld.cart_total': ['Total del carrito', 'Cart total', 'Total do carrinho'],
    'pr.act.set_price': ['Fijar precio', 'Set price', 'Definir preço'], 'pr.act.percent_discount': ['Descuento %', 'Percent discount', 'Desconto %'], 'pr.act.fixed_discount': ['Descuento fijo', 'Fixed discount', 'Desconto fixo'], 'pr.act.free_shipping': ['Envío gratis', 'Free shipping', 'Frete grátis'], 'pr.act.min_order': ['Pedido mínimo', 'Minimum order', 'Pedido mínimo'], 'pr.act.tax_exempt': ['Exento de impuestos', 'Tax exempt', 'Isento de impostos'], 'pr.act.hide_product': ['Ocultar producto', 'Hide product', 'Ocultar produto'],
    'pr.e.name': ['La regla necesita un nombre', 'The rule needs a name', 'A regra precisa de um nome'], 'pr.e.acts': ['Agregá al menos una acción', 'Add at least one action', 'Adicione ao menos uma ação'], 'pr.e.percent': ['El descuento debe ser mayor a 0 y hasta 100%', 'The discount must be above 0 and up to 100%', 'O desconto deve ser maior que 0 e até 100%'], 'pr.e.amount': ['Ingresá un importe mayor o igual a 0', 'Enter an amount of 0 or more', 'Informe um valor igual ou maior que 0'],
    'pr.e.num': ['Esta condición espera un número', 'This condition expects a number', 'Esta condição espera um número'], 'pr.e.numop': ['Este operador solo aplica a cantidad o total del carrito', 'This operator only applies to quantity or cart total', 'Este operador só se aplica a quantidade ou total do carrinho'], 'pr.e.between': ['Ingresá «desde,hasta» con desde menor o igual a hasta', 'Enter “from,to” with from ≤ to', 'Informe «de,até» com de ≤ até'], 'pr.e.value': ['Ingresá un valor', 'Enter a value', 'Informe um valor'],
    'pr.e.product': ['Elegí un producto', 'Choose a product', 'Escolha um produto'], 'pr.e.tier_qty': ['La cantidad debe ser mayor a cero y no repetirse', 'Quantity must be above zero and unique', 'A quantidade deve ser maior que zero e não repetida'], 'pr.e.tier_price': ['El precio no puede ser negativo', 'The price cannot be negative', 'O preço não pode ser negativo'], 'pr.e.tier_order': ['Una escala de mayor cantidad no puede costar más que una de menor cantidad', 'A higher-quantity tier cannot cost more than a lower-quantity one', 'Uma faixa de maior quantidade não pode custar mais que uma de menor quantidade'], 'pr.e.tier_none': ['Cargá al menos una escala', 'Add at least one tier', 'Adicione ao menos uma faixa'],
    'pr.t.tiers': ['Escalas guardadas', 'Tiers saved', 'Faixas salvas'], 'pr.t.rule': ['Regla creada', 'Rule created', 'Regra criada'], 'pr.t.rule_status': ['Regla actualizada', 'Rule updated', 'Regra atualizada'], 'pr.t.rule_deleted': ['Regla eliminada', 'Rule deleted', 'Regra excluída'], 'pr.a.activate': ['Activar', 'Activate', 'Ativar'], 'pr.a.deactivate': ['Desactivar', 'Deactivate', 'Desativar'], 'pr.a.delete': ['Eliminar', 'Delete', 'Excluir'],
    'pr.sim.customer': ['Cliente', 'Customer', 'Cliente'], 'pr.sim.product': ['Producto', 'Product', 'Produto'], 'pr.sim.qty': ['Cantidad', 'Quantity', 'Quantidade'], 'pr.sim.cart': ['Resto del carrito', 'Rest of the cart', 'Restante do carrinho'], 'pr.sim.steps': ['Cómo se calculó', 'How it was calculated', 'Como foi calculado'], 'pr.sim.base': ['Precio base', 'Base price', 'Preço base'], 'pr.sim.list': ['Lista del grupo', 'Group price list', 'Lista do grupo'], 'pr.sim.tier': ['escala desde', 'tier from', 'faixa a partir de'], 'pr.sim.rule': ['Regla', 'Rule', 'Regra'],
    'pr.sim.unit': ['Precio unitario final', 'Final unit price', 'Preço unitário final'], 'pr.sim.line': ['Total de la línea', 'Line total', 'Total da linha'], 'pr.sim.hidden': ['No disponible para este cliente', 'Not available for this customer', 'Indisponível para este cliente'], 'pr.sim.none': ['Sin reglas aplicadas', 'No rules applied', 'Nenhuma regra aplicada'],
    'pr.e.minorder': ['El pedido mínimo para este cliente es', 'The minimum order for this customer is', 'O pedido mínimo para este cliente é'], 'pr.note.min': ['Pedido mínimo', 'Minimum order', 'Pedido mínimo'], 'pr.note.free': ['envío gratis', 'free shipping', 'frete grátis'], 'pr.note.hidden': ['Producto no disponible para este cliente', 'Product not available for this customer', 'Produto indisponível para este cliente']
  };
  ['es-AR', 'en', 'pt-BR'].forEach((lg, i) => Object.keys(K).forEach((k) => (N.DICT[lg][k] = K[k][i])));

  const D = N.data, TODAY = '2026-10-01', R = (N.routes = N.routes || {}), t = (k) => N.t(k), esc = N.esc, money = (m) => N.money(m);
  const ok = (key) => { N.toast(t(key)); N.rerender(); };
  const prod = (sku) => D.products2.find((p) => p.sku === sku), cust = (id) => D.customers.find((c) => c.id === id);
  const who = (name, sub) => `<div class="who"><span class="av">${N.initials(name)}</span><div><b>${esc(name)}</b>${sub ? `<small class="mono">${esc(sub)}</small>` : ''}</div></div>`;

  if (!D.priceLists) {
    D.priceLists = [{ id: 'PL-PUB', name: 'Precio de venta al público' }, { id: 'PL-MAY', name: 'Lista mayorista' }];
    D.tiers = [
      { list: 'PL-MAY', sku: 'SKU-001', tiers: [{ min: 1, price: 2300000 }, { min: 10, price: 2150000 }, { min: 50, price: 2000000 }] },
      { list: 'PL-MAY', sku: 'SKU-002', tiers: [{ min: 1, price: 720000 }, { min: 20, price: 650000 }] },
      { list: 'PL-MAY', sku: 'SKU-003', tiers: [{ min: 1, price: 1950000 }, { min: 10, price: 1800000 }] },
      { list: 'PL-MAY', sku: 'SKU-005', tiers: [{ min: 1, price: 1100000 }, { min: 10, price: 1000000 }, { min: 40, price: 920000 }] }
    ];
    D.rules = [
      { id: 'RUL-0001', name: 'Mayoristas: 10% desde 20 unidades', priority: 10, status: 'activa', group: 'G2', sku: null, from: null, until: null, stop: false, conds: [{ field: 'quantity', op: '>=', value: 20 }], acts: [{ type: 'percent_discount', value: 10 }] },
      { id: 'RUL-0002', name: 'Envío gratis en pedidos grandes B2B', priority: 20, status: 'activa', group: null, sku: null, from: null, until: null, stop: false, conds: [{ field: 'customer_type', op: '=', value: 'B2B' }, { field: 'cart_total', op: '>=', value: 50000000 }], acts: [{ type: 'free_shipping', value: null }] },
      { id: 'RUL-0003', name: 'Pedido mínimo mayorista', priority: 30, status: 'activa', group: 'G2', sku: null, from: null, until: null, stop: false, conds: [], acts: [{ type: 'min_order', value: 10000000 }] },
      { id: 'RUL-0004', name: 'Liquidación de primavera', priority: 40, status: 'activa', group: null, sku: 'SKU-003', from: '2026-11-01', until: '2026-11-30', stop: false, conds: [], acts: [{ type: 'percent_discount', value: 15 }] },
      { id: 'RUL-0005', name: 'Ocultar cable a minoristas', priority: 50, status: 'inactiva', group: null, sku: null, from: null, until: null, stop: false, conds: [{ field: 'customer_type', op: '=', value: 'B2C' }, { field: 'sku', op: 'in', value: ['SKU-004'] }], acts: [{ type: 'hide_product', value: null }] }
    ];
  }
  const groupName = (id) => (D.groups.find((g) => g.id === id) || {}).name || t('pr.all');
  const listOf = (c) => { const g = D.groups.find((x) => x.id === c.group); return g && D.priceLists.find((l) => l.name === g.list); };
  const inForce = (r) => r.status === 'activa' && (!r.from || r.from <= TODAY) && (!r.until || r.until >= TODAY);

  /* ---------- Motor ---------- */
  function condOk(c, ctx) {
    const v = ctx[c.field]; if (v === undefined || v === null) return false;
    const n = (x) => Number(x);
    switch (c.op) {
      case '=': return v === c.value; case '!=': return v !== c.value;
      case '>': return n(v) > n(c.value); case '>=': return n(v) >= n(c.value); case '<': return n(v) < n(c.value); case '<=': return n(v) <= n(c.value);
      case 'in': return c.value.includes(v); case 'not_in': return !c.value.includes(v); case 'between': return n(v) >= n(c.value[0]) && n(v) <= n(c.value[1]);
      default: return false;
    }
  }
  function resolve(customerId, sku, qty, cartTotal) {
    const c = cust(customerId), p = prod(sku), base = p.price; let price = base, tierMin = null, list = base;
    const pl = listOf(c), entry = pl && D.tiers.find((x) => x.list === pl.id && x.sku === sku);
    if (entry) { const best = entry.tiers.filter((x) => x.min <= qty).sort((a, b) => b.min - a.min)[0]; if (best) { price = list = best.price; tierMin = best.min; } }
    const out = { base, list, tierMin, applied: [], freeShipping: false, minOrder: 0, taxExempt: false, hidden: false };
    const ctx = { customer_group: c.group, customer_type: c.type, customer: c.id, product: sku, sku, quantity: qty, cart_total: (cartTotal || 0) + qty * price, currency: N.state.currency };
    for (const r of D.rules.filter(inForce).sort((a, b) => a.priority - b.priority)) {
      if (r.group && r.group !== c.group) continue; if (r.sku && r.sku !== sku) continue;
      if (!r.conds.every((x) => condOk(x, ctx))) continue;
      r.acts.forEach((a) => {
        if (a.type === 'set_price') price = a.value; else if (a.type === 'percent_discount') price = Math.round(price * (1 - a.value / 100)); else if (a.type === 'fixed_discount') price = Math.max(price - a.value, 0);
        else if (a.type === 'free_shipping') out.freeShipping = true; else if (a.type === 'min_order') out.minOrder = Math.max(out.minOrder, a.value); else if (a.type === 'tax_exempt') out.taxExempt = true; else if (a.type === 'hide_product') out.hidden = true;
      });
      out.applied.push({ name: r.name, after: price }); if (r.stop) break;
    }
    out.unit = price; out.line = Math.round(qty * price); return out;
  }
  const saleSubtotal = (s) => s.items.reduce((a, i) => a + i.qty * i.price - (i.disc || 0), 0);
  N.pricing = {
    resolve,
    minimumError(s) { const sub = saleSubtotal(s); let min = 0; s.items.forEach((i) => { min = Math.max(min, resolve(s.customer, i.sku, i.qty, sub).minOrder); }); return sub < min ? t('pr.e.minorder') + ' ' + money(min) + ' (' + money(sub) + ')' : null; }
  };

  /* ---------- Texto de reglas ---------- */
  const OPS = { '=': '=', '!=': '≠', '>': '>', '>=': '≥', '<': '<', '<=': '≤', in: '∈', not_in: '∉', between: '↔' };
  const MONEY_F = ['cart_total'];
  const showVal = (c) => (MONEY_F.includes(c.field) ? (Array.isArray(c.value) ? c.value.map(money).join(' – ') : money(c.value)) : Array.isArray(c.value) ? c.value.join(', ') : c.field === 'customer_group' ? groupName(c.value) : String(c.value));
  const condText = (c) => `${t('pr.fld.' + c.field)} ${OPS[c.op]} ${showVal(c)}`;
  const actText = (a) => t('pr.act.' + a.type) + (a.type === 'percent_discount' ? ' ' + a.value + '%' : ['set_price', 'fixed_discount', 'min_order'].includes(a.type) ? ' ' + money(a.value) : '');
  const ruleChip = (r) => (inForce(r) ? N.chip('ok', t('pr.s.in_force')) : r.status === 'inactiva' ? N.chip('', t('pr.s.inactive')) : N.chip('warn', t('pr.s.scheduled')));

  /* ---------- Escalas ---------- */
  function tierForm(entry) {
    const used = D.tiers.map((x) => x.list + '|' + x.sku), prods = D.products2.filter((p) => entry || D.priceLists.some((l) => l.id !== 'PL-PUB' && !used.includes(l.id + '|' + p.sku)));
    const rows = [0, 1, 2, 3, 4].map((i) => { const x = entry && entry.tiers[i]; return `<div class="row2"><div class="field"><label for="f-mq${i}">${t('pr.f.minqty')}</label><input class="input num" id="f-mq${i}" name="mq${i}" type="number" min="1" step="1" value="${x ? x.min : ''}"></div><div class="field"><label for="f-mp${i}">${t('pr.f.price')}</label><input class="input num" id="f-mp${i}" name="mp${i}" type="number" min="0" step="0.01" value="${x ? x.price / 100 : ''}"></div></div>`; }).join('');
    N.drawer({ title: entry ? t('pr.edit_tiers') + ' ' + prod(entry.sku).name : t('pr.new_tier'), wide: true,
      body: (entry ? `<div class="alloc"><span>${t('pr.col.base')}</span><b class="num">${money(prod(entry.sku).price)}</b></div>` : `${N.field('list', t('pr.f.list'), { options: D.priceLists.filter((l) => l.id !== 'PL-PUB').map((l) => [l.id, l.name]) })}${N.field('sku', t('pr.f.product'), { options: [['', '—']].concat(prods.map((p) => [p.sku, p.name])) })}`) + `<div class="cmp" style="margin-top:12px">${rows}</div>`,
      onSave(d, close) {
        const list = entry ? entry.list : d.list, sku = entry ? entry.sku : d.sku; if (!sku) return { sku: t('pr.e.product') };
        const tiers = [], seen = new Set();
        for (let i = 0; i < 5; i++) { if (d['mq' + i] === '' && d['mp' + i] === '') continue; const min = +d['mq' + i], price = Math.round((+d['mp' + i]) * 100);
          if (!(min > 0) || seen.has(min)) return { ['mq' + i]: t('pr.e.tier_qty') }; if (d['mp' + i] === '' || price < 0) return { ['mp' + i]: t('pr.e.tier_price') }; seen.add(min); tiers.push({ min, price }); }
        if (!tiers.length) return { mq0: t('pr.e.tier_none') };
        tiers.sort((a, b) => a.min - b.min);
        for (let i = 1; i < tiers.length; i++) if (tiers[i].price > tiers[i - 1].price) return { ['mp' + i]: t('pr.e.tier_order') };
        const e = D.tiers.find((x) => x.list === list && x.sku === sku); if (e) e.tiers = tiers; else D.tiers.push({ list, sku, tiers });
        close(); ok('pr.t.tiers'); } });
  }
  const tiersView = (node) => node.append(N.table({
    id: 'escalas', rows: D.tiers.map((x, i) => ({ ...x, key: i })), id_of: (r) => r.list + r.sku, sort: 'product', text: (r) => prod(r.sku).name + ' ' + r.sku,
    cols: [
      { key: 'product', label: 'pr.col.product', value: (r) => prod(r.sku).name, render: (r) => who(prod(r.sku).name, r.sku) },
      { key: 'list', label: 'pr.col.list', value: (r) => r.list, render: (r) => esc(D.priceLists.find((l) => l.id === r.list).name) },
      { key: 'tiers', label: 'pr.col.tiers', value: (r) => r.tiers.length, render: (r) => r.tiers.map((x) => `<span class="chip plain">${x.min}+ · ${money(x.price)}</span>`).join(' ') },
      { key: 'base', label: 'pr.col.base', align: 'r', value: (r) => prod(r.sku).price, render: (r) => `<span class="num">${money(prod(r.sku).price)}</span>` },
      { key: 'best', label: 'pr.col.best', align: 'r', value: (r) => Math.round((1 - r.tiers[r.tiers.length - 1].price / prod(r.sku).price) * 100), render: (r) => `<b class="num">${Math.round((1 - r.tiers[r.tiers.length - 1].price / prod(r.sku).price) * 100)}%</b>` }
    ], newLabel: 'pr.new_tier', onNew: () => tierForm(null), onRow: (r) => tierForm(D.tiers.find((x) => x.list === r.list && x.sku === r.sku)), actions: [{ key: 'edit', label: 'pr.edit_tiers', icon: 'edit' }], onAction: (k, r) => tierForm(D.tiers.find((x) => x.list === r.list && x.sku === r.sku))
  }));

  /* ---------- Reglas ---------- */
  const FIELDS = ['customer_group', 'customer_type', 'customer', 'sku', 'quantity', 'cart_total'], NUMF = ['quantity', 'cart_total'];
  const ACTS = ['percent_discount', 'fixed_discount', 'set_price', 'free_shipping', 'min_order', 'tax_exempt', 'hide_product'], NOVAL = ['free_shipping', 'tax_exempt', 'hide_product'];
  function parseCond(f, op, raw) {
    const split = (s) => s.split(',').map((x) => x.trim()).filter(Boolean), num = NUMF.includes(f), cv = (x) => (num ? (MONEY_F.includes(f) ? Math.round(Number(x) * 100) : Number(x)) : x);
    if (!raw.trim()) return { err: t('pr.e.value') };
    if (['>', '>=', '<', '<='].includes(op) && !num) return { err: t('pr.e.numop') };
    if (op === 'between') { const a = split(raw); if (a.length !== 2 || isNaN(cv(a[0])) || isNaN(cv(a[1])) || cv(a[0]) > cv(a[1])) return { err: t('pr.e.between') }; return { value: a.map(cv) }; }
    if (op === 'in' || op === 'not_in') { const a = split(raw); if (!a.length || (num && a.some((x) => isNaN(Number(x))))) return { err: num ? t('pr.e.num') : t('pr.e.value') }; return { value: a.map(cv) }; }
    if (num && isNaN(Number(raw))) return { err: t('pr.e.num') };
    return { value: cv(raw.trim()) };
  }
  function ruleForm() {
    const cRows = [0, 1].map((i) => `<div class="row3c"><div class="field"><label for="f-cf${i}">${t('pr.f.cond')} ${i + 1}</label><select class="input" id="f-cf${i}" name="cf${i}"><option value="">—</option>${FIELDS.map((f) => `<option value="${f}">${t('pr.fld.' + f)}</option>`).join('')}</select></div><div class="field"><label for="f-co${i}">&nbsp;</label><select class="input" id="f-co${i}" name="co${i}">${Object.keys(OPS).map((o) => `<option value="${o}">${OPS[o]}</option>`).join('')}</select></div><div class="field"><label for="f-cv${i}">${t('pr.f.value')}</label><input class="input" id="f-cv${i}" name="cv${i}" placeholder="${esc(t('pr.f.value_hint'))}"></div></div>`).join('');
    const aRows = [0, 1].map((i) => `<div class="row2"><div class="field"><label for="f-at${i}">${t('pr.f.act')} ${i + 1}</label><select class="input" id="f-at${i}" name="at${i}"><option value="">—</option>${ACTS.map((a) => `<option value="${a}">${t('pr.act.' + a)}</option>`).join('')}</select></div><div class="field"><label for="f-av${i}">${t('pr.f.value')}</label><input class="input num" id="f-av${i}" name="av${i}" type="number" min="0" step="0.01"></div></div>`).join('');
    N.drawer({ title: t('pr.new_rule'), wide: true,
      body: `${N.field('name', t('pr.f.name'))}<div class="row2">${N.field('priority', t('pr.f.prio'), { type: 'number', min: 1, num: true, value: 100 })}${N.field('group', t('pr.f.group'), { options: [['', t('pr.all')]].concat(D.groups.map((g) => [g.id, g.name])) })}</div><div class="row2">${N.field('from', t('pr.f.from'), { type: 'date' })}${N.field('until', t('pr.f.until'), { type: 'date' })}</div>${N.field('product', t('pr.f.product'), { options: [['', t('pr.all')]].concat(D.products2.map((p) => [p.sku, p.name])) })}<div class="cmp" style="margin-top:8px">${cRows}${aRows}</div>${N.field('stop', t('pr.f.stop'), { options: [['0', '—'], ['1', '✓']] })}`,
      onSave(d, close) {
        if (!d.name.trim()) return { name: t('pr.e.name') };
        const conds = [], acts = [];
        for (let i = 0; i < 2; i++) { if (!d['cf' + i]) continue; const r = parseCond(d['cf' + i], d['co' + i], d['cv' + i]); if (r.err) return { ['cv' + i]: r.err }; conds.push({ field: d['cf' + i], op: d['co' + i], value: r.value }); }
        for (let i = 0; i < 2; i++) { const ty = d['at' + i]; if (!ty) continue; let v = null;
          if (ty === 'percent_discount') { v = Number(d['av' + i]); if (!(v > 0 && v <= 100)) return { ['av' + i]: t('pr.e.percent') }; }
          else if (!NOVAL.includes(ty)) { if (d['av' + i] === '' || Number(d['av' + i]) < 0) return { ['av' + i]: t('pr.e.amount') }; v = Math.round(Number(d['av' + i]) * 100); }
          acts.push({ type: ty, value: v }); }
        if (!acts.length) return { at0: t('pr.e.acts') };
        if (d.from && d.until && d.until < d.from) return { until: t('pr.e.between') };
        D.rules.push({ id: 'RUL-' + String(D.rules.length + 1).padStart(4, '0'), name: d.name.trim(), priority: +d.priority || 100, status: 'activa', group: d.group || null, sku: d.product || null, from: d.from || null, until: d.until || null, stop: d.stop === '1', conds, acts });
        close(); ok('pr.t.rule'); } });
  }
  const rulesView = (node) => {
    node.append(N.table({
      id: 'reglas', rows: D.rules, id_of: (r) => r.id, sort: 'priority', text: (r) => r.name + ' ' + r.id,
      cols: [
        { key: 'priority', label: 'pr.col.prio', align: 'r', value: (r) => r.priority, render: (r) => `<span class="num">${r.priority}</span>` },
        { key: 'name', label: 'pr.col.name', value: (r) => r.name, render: (r) => `<div><b>${esc(r.name)}</b><br><small class="muted">${esc(groupName(r.group))}${r.sku ? ' · ' + esc(prod(r.sku).name) : ''}</small></div>` },
        { key: 'cond', label: 'pr.col.cond', value: (r) => r.conds.length, render: (r) => `<div class="chips-wrap">${r.conds.map((c) => `<span class="chip plain">${esc(condText(c))}</span>`).join('') || `<span class="faint">${t('pr.always')}</span>`}</div>` },
        { key: 'act', label: 'pr.col.act', value: (r) => r.acts.length, render: (r) => `<div class="chips-wrap">${r.acts.map((a) => `<span class="chip info">${esc(actText(a))}</span>`).join('')}</div>` },
        { key: 'valid', label: 'pr.col.valid', hidden: true, value: (r) => r.from || '', render: (r) => (r.from || r.until ? `${N.date(r.from)} → ${N.date(r.until)}` : t('pr.always')) },
        { key: 'state', label: 'pr.col.state', value: (r) => (inForce(r) ? 0 : 1), render: ruleChip },
        { key: 'ctl', label: 'pr.a.activate', align: 'r', render: (r) => `<button class="btn sm" data-rt="${r.id}">${t(r.status === 'activa' ? 'pr.a.deactivate' : 'pr.a.activate')}</button> <button class="btn sm danger" data-rd="${r.id}">${t('pr.a.delete')}</button>` }
      ], filters: [{ key: 'force', label: 'pr.s.in_force', fn: inForce }], newLabel: 'pr.new_rule', onNew: ruleForm, onRow: () => {}
    }));
    node.addEventListener('click', (e) => {
      const tg = e.target.closest('[data-rt]'), dl = e.target.closest('[data-rd]'); if (!tg && !dl) return; e.stopPropagation();
      if (tg) { const r = D.rules.find((x) => x.id === tg.dataset.rt); r.status = r.status === 'activa' ? 'inactiva' : 'activa'; ok('pr.t.rule_status'); }
      else { D.rules.splice(D.rules.findIndex((x) => x.id === dl.dataset.rd), 1); ok('pr.t.rule_deleted'); }
    }, true);
  };

  /* ---------- Simulador ---------- */
  const simView = (node) => {
    const box = N.el(`<div class="card"><div class="form-grid">${N.field('sc', t('pr.sim.customer'), { options: D.customers.map((c) => [c.id, c.name + ' · ' + c.type]), value: 'CLI-0002' })}${N.field('sp', t('pr.sim.product'), { options: D.products2.map((p) => [p.sku, p.name]) })}${N.field('sq', t('pr.sim.qty'), { type: 'number', min: 1, num: true, value: 20 })}${N.field('sk', t('pr.sim.cart'), { type: 'number', min: 0, step: '0.01', num: true, value: 0 })}</div></div>`);
    const out = N.el('<div class="card" style="margin-top:16px" id="sim-out" aria-live="polite"></div>');
    const draw = () => {
      const qty = Math.max(1, Math.round(+box.querySelector('[name=sq]').value || 1)), r = resolve(box.querySelector('[name=sc]').value, box.querySelector('[name=sp]').value, qty, Math.round((+box.querySelector('[name=sk]').value || 0) * 100));
      out.innerHTML = `<h2>${t('pr.sim.steps')}</h2>
        <div class="alloc"><span>${t('pr.sim.base')}</span><b class="num">${money(r.base)}</b></div>
        <div class="alloc"><span>${t('pr.sim.list')}${r.tierMin ? ` · ${t('pr.sim.tier')} ${r.tierMin}` : ''}</span><b class="num">${money(r.list)}</b></div>
        ${r.applied.map((a) => `<div class="alloc"><span>${t('pr.sim.rule')}: ${esc(a.name)}</span><b class="num">${money(a.after)}</b></div>`).join('') || `<p class="muted">${t('pr.sim.none')}</p>`}
        <div class="alloc" style="background:var(--accent-soft)"><b>${t('pr.sim.unit')}</b><b class="num" id="sim-unit">${money(r.unit)}</b></div>
        <div class="alloc"><b>${t('pr.sim.line')}</b><b class="num">${money(r.line)}</b></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">${r.freeShipping ? N.chip('ok', t('pr.act.free_shipping')) : ''}${r.minOrder ? N.chip('warn', t('pr.act.min_order') + ' ' + money(r.minOrder)) : ''}${r.taxExempt ? N.chip('info', t('pr.act.tax_exempt')) : ''}${r.hidden ? N.chip('danger', t('pr.sim.hidden')) : ''}</div>`;
    };
    box.addEventListener('input', draw); node.append(box, out); draw();
  };

  /* ---------- Página ---------- */
  let view = 'tiers';
  R['clientes/precios'] = (node) => {
    node.append(N.el(`<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px" role="tablist">${['tiers', 'rules', 'sim'].map((k) => `<button type="button" class="seg" role="tab" data-v="${k}" aria-pressed="${k === view}" style="flex-direction:row;padding:8px 14px">${t('pr.v.' + k)}</button>`).join('')}<span class="chip violet" style="margin-left:auto">${t('pr.plan')}</span></div>`));
    node.firstChild.onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { view = b.dataset.v; N.rerender(); } };
    ({ tiers: tiersView, rules: rulesView, sim: simView })[view](node);
  };
})(window.Nexo);
