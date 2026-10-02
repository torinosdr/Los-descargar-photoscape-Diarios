/* Textos de la Fase 4 (clientes, billetera, segmentos, inventario). */
(function (N) {
  const X = {
    'es-AR': {
      'cust.new': 'Nuevo cliente', 'cust.edit': 'Editar cliente', 'cust.type': 'Tipo de cliente', 'cust.person': 'Persona', 'cust.person_f': 'Persona física', 'cust.company': 'Empresa',
      'cust.first': 'Nombre', 'cust.last': 'Apellido', 'cust.companyname': 'Razón social', 'cust.taxid': 'CUIT / DNI', 'cust.group': 'Grupo', 'cust.owner': 'Responsable', 'cust.limit': 'Límite de crédito', 'cust.terms': 'Plazo de pago (días)',
      'cust.saved': 'Cliente guardado', 'cust.err_name': 'Ingresá el nombre o la razón social', 'cust.err_email': 'El email no es válido', 'cust.err_company': 'Una empresa necesita razón social', 'cust.b2c_person': 'Un cliente B2C debe ser persona física',
      'grp.title': 'Grupos de clientes', 'grp.members': 'clientes', 'grp.list': 'Lista de precios', 'grp.b2b': 'Grupo B2B', 'grp.retail': 'Minorista',
      'b2b.credit': 'Crédito', 'b2b.limit': 'Límite', 'b2b.used': 'Usado', 'b2b.avail': 'Disponible', 'b2b.over': 'Excedido', 'b2b.sub': 'Subcuentas', 'b2b.spend': 'Tope de gasto', 'b2b.terms': 'Plazo', 'b2b.days': 'días', 'b2b.nosub': 'Sin subcuentas',
      'wal.apply': 'Aplicar a la deuda', 'wal.preview': 'Se aplicará a las deudas más antiguas primero', 'wal.confirm': 'Aplicar', 'wal.done': 'Billetera aplicada', 'wal.balance': 'Saldo en billetera', 'wal.after': 'Billetera después', 'wal.debt_after': 'Deuda después', 'wal.none': 'Este cliente no tiene saldo para aplicar', 'wal.total': 'Total en billeteras',
      'seg.vip': 'VIP', 'seg.con_deuda_vencida': 'Con deuda vencida', 'seg.inactivo_90d': 'Inactivos 90 días', 'seg.nuevo_30d': 'Nuevos (30 días)', 'seg.con_saldo_a_favor': 'Con saldo a favor', 'seg.sin_compras': 'Sin compras',
      'seg.vip_d': 'Mayor volumen de compra (20% superior)', 'seg.con_deuda_vencida_d': 'Facturas pasadas de fecha', 'seg.inactivo_90d_d': 'Sin comprar hace más de 90 días', 'seg.nuevo_30d_d': 'Dados de alta este mes', 'seg.con_saldo_a_favor_d': 'Pueden usar su billetera', 'seg.sin_compras_d': 'Aún no concretaron una compra',
      'inv.title': 'Inventario', 'inv.sku': 'SKU', 'inv.product': 'Producto', 'inv.available': 'Disponible', 'inv.reserved': 'Reservado', 'inv.min': 'Mínimo', 'inv.state': 'Estado', 'inv.total': 'Existencia', 'inv.adjust': 'Ajustar stock', 'inv.transfer': 'Transferir', 'inv.movements': 'Movimientos recientes',
      'inv.ok': 'Normal', 'inv.low': 'Bajo', 'inv.out': 'Agotado', 'inv.newqty': 'Nueva existencia', 'inv.reason': 'Motivo del ajuste', 'inv.warehouse': 'Depósito', 'inv.from': 'Origen', 'inv.to': 'Destino', 'inv.qty': 'Cantidad', 'inv.f_low': 'Stock bajo', 'inv.f_out': 'Agotados',
      'inv.err_reason': 'Indicá el motivo', 'inv.err_neg': 'No puede ser negativa', 'inv.err_same': 'Origen y destino deben ser distintos', 'inv.err_qty': 'Cantidad inválida', 'inv.err_stock': 'No hay tanto stock en el origen', 'inv.done': 'Stock actualizado', 'inv.current': 'Existencia actual', 'inv.change': 'Cambio',
      'common.save': 'Guardar', 'common.cancel': 'Cancelar', 'common.close': 'Cerrar', 'common.type': 'Tipo', 'common.date': 'Fecha', 'common.detail': 'Detalle', 'common.qty': 'Cant.', 'common.invoices': 'Facturas'
    },
    'en': {
      'cust.new': 'New customer', 'cust.edit': 'Edit customer', 'cust.type': 'Customer type', 'cust.person': 'Person', 'cust.person_f': 'Individual', 'cust.company': 'Company',
      'cust.first': 'First name', 'cust.last': 'Last name', 'cust.companyname': 'Company name', 'cust.taxid': 'Tax ID', 'cust.group': 'Group', 'cust.owner': 'Owner', 'cust.limit': 'Credit limit', 'cust.terms': 'Payment terms (days)',
      'cust.saved': 'Customer saved', 'cust.err_name': 'Enter a name or company name', 'cust.err_email': 'Email is not valid', 'cust.err_company': 'A company needs a company name', 'cust.b2c_person': 'A B2C customer must be an individual',
      'grp.title': 'Customer groups', 'grp.members': 'customers', 'grp.list': 'Price list', 'grp.b2b': 'B2B group', 'grp.retail': 'Retail',
      'b2b.credit': 'Credit', 'b2b.limit': 'Limit', 'b2b.used': 'Used', 'b2b.avail': 'Available', 'b2b.over': 'Over limit', 'b2b.sub': 'Sub-accounts', 'b2b.spend': 'Spending cap', 'b2b.terms': 'Terms', 'b2b.days': 'days', 'b2b.nosub': 'No sub-accounts',
      'wal.apply': 'Apply to debt', 'wal.preview': 'Applied to the oldest debts first', 'wal.confirm': 'Apply', 'wal.done': 'Wallet applied', 'wal.balance': 'Wallet balance', 'wal.after': 'Wallet after', 'wal.debt_after': 'Debt after', 'wal.none': 'This customer has no balance to apply', 'wal.total': 'Total in wallets',
      'seg.vip': 'VIP', 'seg.con_deuda_vencida': 'Overdue debt', 'seg.inactivo_90d': 'Inactive 90 days', 'seg.nuevo_30d': 'New (30 days)', 'seg.con_saldo_a_favor': 'With credit', 'seg.sin_compras': 'No purchases',
      'seg.vip_d': 'Highest purchase volume (top 20%)', 'seg.con_deuda_vencida_d': 'Invoices past due', 'seg.inactivo_90d_d': 'No purchase in over 90 days', 'seg.nuevo_30d_d': 'Added this month', 'seg.con_saldo_a_favor_d': 'Can use their wallet', 'seg.sin_compras_d': 'Have not bought yet',
      'inv.title': 'Inventory', 'inv.sku': 'SKU', 'inv.product': 'Product', 'inv.available': 'Available', 'inv.reserved': 'Reserved', 'inv.min': 'Minimum', 'inv.state': 'Status', 'inv.total': 'On hand', 'inv.adjust': 'Adjust stock', 'inv.transfer': 'Transfer', 'inv.movements': 'Recent movements',
      'inv.ok': 'OK', 'inv.low': 'Low', 'inv.out': 'Out of stock', 'inv.newqty': 'New quantity', 'inv.reason': 'Reason for adjustment', 'inv.warehouse': 'Warehouse', 'inv.from': 'From', 'inv.to': 'To', 'inv.qty': 'Quantity', 'inv.f_low': 'Low stock', 'inv.f_out': 'Out of stock',
      'inv.err_reason': 'Enter a reason', 'inv.err_neg': 'Cannot be negative', 'inv.err_same': 'From and to must differ', 'inv.err_qty': 'Invalid quantity', 'inv.err_stock': 'Not enough stock at the origin', 'inv.done': 'Stock updated', 'inv.current': 'Current stock', 'inv.change': 'Change',
      'common.save': 'Save', 'common.cancel': 'Cancel', 'common.close': 'Close', 'common.type': 'Type', 'common.date': 'Date', 'common.detail': 'Detail', 'common.qty': 'Qty', 'common.invoices': 'Invoices'
    },
    'pt-BR': {
      'cust.new': 'Novo cliente', 'cust.edit': 'Editar cliente', 'cust.type': 'Tipo de cliente', 'cust.person': 'Pessoa', 'cust.person_f': 'Pessoa física', 'cust.company': 'Empresa',
      'cust.first': 'Nome', 'cust.last': 'Sobrenome', 'cust.companyname': 'Razão social', 'cust.taxid': 'CPF / CNPJ', 'cust.group': 'Grupo', 'cust.owner': 'Responsável', 'cust.limit': 'Limite de crédito', 'cust.terms': 'Prazo de pagamento (dias)',
      'cust.saved': 'Cliente salvo', 'cust.err_name': 'Informe o nome ou a razão social', 'cust.err_email': 'E-mail inválido', 'cust.err_company': 'Uma empresa precisa de razão social', 'cust.b2c_person': 'Um cliente B2C deve ser pessoa física',
      'grp.title': 'Grupos de clientes', 'grp.members': 'clientes', 'grp.list': 'Tabela de preços', 'grp.b2b': 'Grupo B2B', 'grp.retail': 'Varejo',
      'b2b.credit': 'Crédito', 'b2b.limit': 'Limite', 'b2b.used': 'Usado', 'b2b.avail': 'Disponível', 'b2b.over': 'Excedido', 'b2b.sub': 'Subcontas', 'b2b.spend': 'Teto de gasto', 'b2b.terms': 'Prazo', 'b2b.days': 'dias', 'b2b.nosub': 'Sem subcontas',
      'wal.apply': 'Aplicar à dívida', 'wal.preview': 'Aplicado primeiro às dívidas mais antigas', 'wal.confirm': 'Aplicar', 'wal.done': 'Carteira aplicada', 'wal.balance': 'Saldo da carteira', 'wal.after': 'Carteira depois', 'wal.debt_after': 'Dívida depois', 'wal.none': 'Este cliente não tem saldo para aplicar', 'wal.total': 'Total em carteiras',
      'seg.vip': 'VIP', 'seg.con_deuda_vencida': 'Dívida vencida', 'seg.inactivo_90d': 'Inativos 90 dias', 'seg.nuevo_30d': 'Novos (30 dias)', 'seg.con_saldo_a_favor': 'Com saldo a favor', 'seg.sin_compras': 'Sem compras',
      'seg.vip_d': 'Maior volume de compra (20% superior)', 'seg.con_deuda_vencida_d': 'Faturas vencidas', 'seg.inactivo_90d_d': 'Sem comprar há mais de 90 dias', 'seg.nuevo_30d_d': 'Cadastrados este mês', 'seg.con_saldo_a_favor_d': 'Podem usar a carteira', 'seg.sin_compras_d': 'Ainda não compraram',
      'inv.title': 'Estoque', 'inv.sku': 'SKU', 'inv.product': 'Produto', 'inv.available': 'Disponível', 'inv.reserved': 'Reservado', 'inv.min': 'Mínimo', 'inv.state': 'Status', 'inv.total': 'Existência', 'inv.adjust': 'Ajustar estoque', 'inv.transfer': 'Transferir', 'inv.movements': 'Movimentos recentes',
      'inv.ok': 'Normal', 'inv.low': 'Baixo', 'inv.out': 'Esgotado', 'inv.newqty': 'Nova existência', 'inv.reason': 'Motivo do ajuste', 'inv.warehouse': 'Depósito', 'inv.from': 'Origem', 'inv.to': 'Destino', 'inv.qty': 'Quantidade', 'inv.f_low': 'Estoque baixo', 'inv.f_out': 'Esgotados',
      'inv.err_reason': 'Informe o motivo', 'inv.err_neg': 'Não pode ser negativa', 'inv.err_same': 'Origem e destino devem ser diferentes', 'inv.err_qty': 'Quantidade inválida', 'inv.err_stock': 'Estoque insuficiente na origem', 'inv.done': 'Estoque atualizado', 'inv.current': 'Existência atual', 'inv.change': 'Alteração',
      'common.save': 'Salvar', 'common.cancel': 'Cancelar', 'common.close': 'Fechar', 'common.type': 'Tipo', 'common.date': 'Data', 'common.detail': 'Detalhe', 'common.qty': 'Qtd.', 'common.invoices': 'Faturas'
    }
  };
  Object.keys(X).forEach((l) => Object.assign(N.DICT[l], X[l]));
})(window.Nexo);
