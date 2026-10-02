/* Datos de ejemplo (alineados con el seed de la base). Se reemplazan por consultas reales al conectar el servidor. */
(function (N) {
  const C = (id, name, type, status, balance, wallet, last, owner, email, phone, total) => ({ id, name, type, status, balance, wallet, last, owner, email, phone, total });
  N.data = {
    customers: [
      C('CLI-0001', 'Juan Pérez', 'B2C', 'active', 0, 0, '2026-09-20', 'Ana Demo', 'juan@example.com', '+54 11 5555-0101', 2500000),
      C('CLI-0002', 'Distribuidora Norte', 'B2B', 'active', 1750000, 200000, '2026-09-21', 'Marcos Ríos', 'compras@norte.example', '+54 351 555-0202', 4850000),
      C('CLI-0003', 'Laura Gómez', 'B2C', 'active', 320000, 0, '2026-09-14', 'Vale Sosa', 'laura@example.com', '+54 11 5555-0303', 640000),
      C('CLI-0004', 'Kiosco El Sol', 'B2B', 'active', 920000, 0, '2026-08-30', 'Marcos Ríos', 'elsol@example.com', '+54 11 5555-0404', 1830000),
      C('CLI-0005', 'Mariana Torres', 'B2C', 'inactive', 0, 45000, '2026-05-02', 'Ana Demo', 'mariana@example.com', '+54 11 5555-0505', 310000),
      C('CLI-0006', 'Ferretería Central', 'B2B', 'blocked', 2480000, 0, '2026-07-11', 'Carlos Vega', 'info@ferrecentral.example', '+54 261 555-0606', 5120000),
      C('CLI-0007', 'Diego Fernández', 'B2C', 'active', 0, 120000, '2026-09-27', 'Vale Sosa', 'diego@example.com', '+54 11 5555-0707', 980000),
      C('CLI-0008', 'Almacén Los Pinos', 'B2B', 'active', 560000, 0, '2026-09-18', 'Carlos Vega', 'pinos@example.com', '+54 223 555-0808', 2210000),
      C('CLI-0009', 'Sofía Ruiz', 'B2C', 'active', 0, 0, '2026-09-25', 'Ana Demo', 'sofia@example.com', '+54 11 5555-0909', 450000),
      C('CLI-0010', 'Mayorista Cuyo', 'B2B', 'active', 3100000, 0, '2026-09-02', 'Marcos Ríos', 'ventas@cuyo.example', '+54 261 555-1010', 9340000)
    ],
    invoices: [
      ['INV-0001', 'Juan Pérez', '2026-09-20', '2026-09-20', 2500000, 2500000],
      ['INV-0002', 'Distribuidora Norte', '2026-09-21', '2026-10-21', 3750000, 2000000],
      ['INV-0003', 'Laura Gómez', '2026-09-14', '2026-09-28', 320000, 0],
      ['INV-0004', 'Kiosco El Sol', '2026-08-30', '2026-09-14', 920000, 0],
      ['INV-0005', 'Ferretería Central', '2026-07-11', '2026-08-10', 2480000, 0],
      ['INV-0006', 'Diego Fernández', '2026-09-27', '2026-09-27', 980000, 980000],
      ['INV-0007', 'Almacén Los Pinos', '2026-09-18', '2026-10-18', 1260000, 700000],
      ['INV-0008', 'Mayorista Cuyo', '2026-09-02', '2026-10-02', 3100000, 0],
      ['INV-0009', 'Sofía Ruiz', '2026-09-25', '2026-09-25', 450000, 450000]
    ].map(([id, customer, date, due, total, paid]) => ({ id, customer, date, due, total, paid, open: total - paid })),
    products: [['SKU-001', 'Auriculares Pro', 8], ['SKU-002', 'Mouse inalámbrico', 2], ['SKU-003', 'Teclado mecánico', 1], ['SKU-004', 'Cable USB-C 2m', 0]].map(([sku, name, stock]) => ({ sku, name, stock })),
    salesByMonth: [['Abr', 8.2], ['May', 9.1], ['Jun', 7.4], ['Jul', 10.3], ['Ago', 11.8], ['Sep', 13.6]],
    tasks: [['Llamar a Distribuidora Norte por el saldo', 'warn'], ['Enviar presupuesto a Kiosco El Sol', 'info'], ['Revisar stock de mouse inalámbrico', 'warn'], ['Conciliar cobranzas de la semana', 'ok']],
    activity: [['Pago recibido de Diego Fernández', 'ok', 'payments'], ['Nueva venta a Sofía Ruiz', 'info', 'sales'], ['Ticket #12 resuelto', 'ok', 'tickets'], ['Presupuesto aceptado por Mayorista Cuyo', 'info', 'quotes']]
  };
  Object.assign(N.data, {
    owners: ['Ana Demo', 'Marcos Ríos', 'Vale Sosa', 'Carlos Vega'],
    groups: [
      { id: 'G1', name: 'B2C General', desc: 'Clientes minoristas', b2b: false, list: 'Precio de venta al público' },
      { id: 'G2', name: 'Mayorista', desc: 'Clientes mayoristas con precios por escala', b2b: true, list: 'Lista mayorista' },
      { id: 'G3', name: 'Gastronomía', desc: 'Kioscos, almacenes y cafeterías', b2b: true, list: 'Lista mayorista' }
    ],
    warehouses: [['PRINCIPAL', 'Depósito Principal'], ['NORTE', 'Depósito Norte']],
    products2: [
      { sku: 'SKU-001', name: 'Auriculares Pro', min: 3, stock: { PRINCIPAL: 8, NORTE: 0 }, reserved: 1, cost: 1500000, price: 2500000 },
      { sku: 'SKU-002', name: 'Mouse inalámbrico', min: 5, stock: { PRINCIPAL: 2, NORTE: 6 }, reserved: 0, cost: 400000, price: 790000 },
      { sku: 'SKU-003', name: 'Teclado mecánico', min: 3, stock: { PRINCIPAL: 1, NORTE: 0 }, reserved: 1, cost: 1200000, price: 2100000 },
      { sku: 'SKU-004', name: 'Cable USB-C 2m', min: 10, stock: { PRINCIPAL: 0, NORTE: 0 }, reserved: 0, cost: 90000, price: 220000 },
      { sku: 'SKU-005', name: 'Soporte para notebook', min: 4, stock: { PRINCIPAL: 14, NORTE: 9 }, reserved: 2, cost: 650000, price: 1190000 }
    ],
    movements: [
      ['2026-09-27', 'SKU-001', 'Venta', -1, 'PRINCIPAL', 'Venta SAL-0007'], ['2026-09-21', 'SKU-002', 'Venta', -2, 'NORTE', 'Venta SAL-0002'],
      ['2026-09-18', 'SKU-005', 'Compra', 20, 'PRINCIPAL', 'Recepción REC-0003'], ['2026-09-10', 'SKU-003', 'Ajuste', -1, 'PRINCIPAL', 'Rotura en depósito'], ['2026-09-01', 'SKU-001', 'Stock inicial', 10, 'PRINCIPAL', 'Stock inicial']
    ],
    subaccounts: { 'CLI-0002': [['Compras Norte', 'compras@norte.example', 500000000, 'Activo'], ['Depósito Norte', 'deposito@norte.example', 150000000, 'Activo']], 'CLI-0010': [['Sucursal Mendoza', 'mendoza@cuyo.example', 800000000, 'Activo']] }
  });
  const gmap = { 'CLI-0002': 'G2', 'CLI-0006': 'G2', 'CLI-0010': 'G2', 'CLI-0004': 'G3', 'CLI-0008': 'G3' };
  const lim = { 'CLI-0002': 2500000, 'CLI-0004': 1500000, 'CLI-0006': 2000000, 'CLI-0008': 1000000, 'CLI-0010': 5000000 };
  N.data.customers.find((c) => c.id === 'CLI-0009').new = true;
  N.data.customers.forEach((c) => { c.group = gmap[c.id] || 'G1'; c.limit = lim[c.id] || null; c.terms = c.type === 'B2B' ? 30 : 0; c.taxId = c.type === 'B2B' ? '30-7' + c.id.slice(-4) + '321-9' : ''; });
  N.data.customers.forEach((c) => { c.timeline = [['sale', 'Venta SAL-00' + c.id.slice(-2), c.last], ['payment', 'Pago registrado', c.last], ['note', 'Nota del responsable', '2026-09-10']]; });
})(window.Nexo);
