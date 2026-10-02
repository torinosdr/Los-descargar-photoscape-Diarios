/* Idioma: es-AR (por defecto), en, pt-BR. Para añadir uno: agregar un bloque en DICT. */
window.Nexo = window.Nexo || {};
(function (N) {
  const DICT = {
    'es-AR': {
      'nav.home':'Inicio','nav.clients':'Clientes','nav.sales':'Ventas','nav.purchases':'Compras','nav.crm':'CRM',
      'rail.contacts':'Contactos','rail.agenda':'Agenda','rail.calls':'Llamadas','rail.announcements':'Anuncios','rail.reports':'Informes',
      'tab.overview':'Resumen','tab.list':'Lista','tab.groups':'Grupos','tab.b2b':'Cuentas B2B','tab.wallet':'Billetera','tab.segments':'Segmentos',
      'tab.invoices':'Facturas','tab.quotes':'Presupuestos','tab.sales':'Ventas','tab.payments':'Cobranzas','tab.receivable':'Por cobrar','tab.returns':'Devoluciones',
      'tab.orders':'Órdenes','tab.suppliers':'Proveedores','tab.payable':'Por pagar','tab.expenses':'Gastos','tab.stock':'Inventario',
      'tab.leads':'Leads','tab.pipeline':'Embudo','tab.tickets':'Tickets','tab.tasks':'Tareas','tab.projects':'Proyectos',
      'home.title':'Buen día','home.sub':'Esto es lo que pasa hoy en tu negocio',
      'kpi.sales':'Ventas del mes','kpi.receivable':'Por cobrar','kpi.payable':'Por pagar','kpi.customers':'Clientes activos','kpi.wallet':'Saldo en billeteras',
      'card.sales_trend':'Ventas, últimos 6 meses','card.top_debtors':'Mayores deudores','card.tasks':'Tareas de hoy','card.activity':'Actividad reciente','card.low_stock':'Stock bajo',
      'search.placeholder':'Buscar clientes, facturas, productos…','search.hint':'Buscar','search.empty':'Sin resultados','search.clients':'Clientes','search.invoices':'Facturas','search.products':'Productos','search.go':'Ir a',
      'tbl.search':'Filtrar en la tabla…','tbl.columns':'Columnas','tbl.density':'Densidad','tbl.rows':'filas','tbl.of':'de','tbl.none':'Nada coincide con los filtros','tbl.clear':'Quitar filtros','tbl.export':'Exportar','tbl.new':'Nuevo',
      'dens.compact':'Compacta','dens.normal':'Normal','dens.comfortable':'Amplia',
      'col.name':'Cliente','col.type':'Tipo','col.status':'Estado','col.balance':'Saldo','col.wallet':'Billetera','col.last':'Última compra','col.owner':'Responsable','col.total':'Total','col.number':'Número','col.date':'Fecha','col.due':'Vence','col.paid':'Cobrado','col.open':'Pendiente','col.email':'Email','col.phone':'Teléfono',
      'f.all':'Todos','f.debt':'Con deuda','f.wallet':'Con saldo a favor','f.b2b':'B2B','f.b2c':'B2C','f.overdue':'Vencidas','f.pending':'Pendientes','f.paid':'Pagadas',
      'c360.expand':'Expandir','c360.close':'Cerrar','c360.back':'Volver a clientes','c360.summary':'Resumen','c360.sales':'Ventas','c360.payments':'Pagos','c360.wallet':'Billetera','c360.tickets':'Tickets','c360.notes':'Notas',
      'c360.total_bought':'Total comprado','c360.debt':'Deuda','c360.wallet_bal':'Billetera','c360.ltv':'Valor de por vida','c360.last_contact':'Último contacto','c360.timeline':'Línea de tiempo','c360.apply_wallet':'Aplicar billetera a la deuda','c360.new_sale':'Nueva venta','c360.register_payment':'Registrar pago',
      'st.active':'Activo','st.inactive':'Inactivo','st.blocked':'Bloqueado','st.paid':'Pagada','st.partial':'Parcial','st.pending':'Pendiente','st.overdue':'Vencida',
      'wip.title':'Esta sección llega en una fase próxima','wip.body':'La estructura de datos ya existe; la pantalla se construye en','wip.phase':'Fase',
      'set.language':'Idioma','set.currency':'Moneda','set.theme':'Tema','set.density':'Densidad',
      'design.title':'Sistema de diseño','design.sub':'Componentes y tokens que usa toda la aplicación',
      'user.role':'Admin','money.note':'Importes convertidos con tasas de demostración',
      'copy.copied':'Copiado'
    },
    'en': {
      'nav.home':'Home','nav.clients':'Customers','nav.sales':'Sales','nav.purchases':'Purchases','nav.crm':'CRM',
      'rail.contacts':'Contacts','rail.agenda':'Calendar','rail.calls':'Calls','rail.announcements':'Announcements','rail.reports':'Reports',
      'tab.overview':'Overview','tab.list':'List','tab.groups':'Groups','tab.b2b':'B2B accounts','tab.wallet':'Wallet','tab.segments':'Segments',
      'tab.invoices':'Invoices','tab.quotes':'Quotes','tab.sales':'Sales','tab.payments':'Payments','tab.receivable':'Receivable','tab.returns':'Returns',
      'tab.orders':'Orders','tab.suppliers':'Suppliers','tab.payable':'Payable','tab.expenses':'Expenses','tab.stock':'Inventory',
      'tab.leads':'Leads','tab.pipeline':'Pipeline','tab.tickets':'Tickets','tab.tasks':'Tasks','tab.projects':'Projects',
      'home.title':'Good morning','home.sub':"Here's what's happening in your business today",
      'kpi.sales':'Sales this month','kpi.receivable':'Receivable','kpi.payable':'Payable','kpi.customers':'Active customers','kpi.wallet':'Wallet balances',
      'card.sales_trend':'Sales, last 6 months','card.top_debtors':'Top debtors','card.tasks':"Today's tasks",'card.activity':'Recent activity','card.low_stock':'Low stock',
      'search.placeholder':'Search customers, invoices, products…','search.hint':'Search','search.empty':'No results','search.clients':'Customers','search.invoices':'Invoices','search.products':'Products','search.go':'Go to',
      'tbl.search':'Filter table…','tbl.columns':'Columns','tbl.density':'Density','tbl.rows':'rows','tbl.of':'of','tbl.none':'Nothing matches the filters','tbl.clear':'Clear filters','tbl.export':'Export','tbl.new':'New',
      'dens.compact':'Compact','dens.normal':'Normal','dens.comfortable':'Comfortable',
      'col.name':'Customer','col.type':'Type','col.status':'Status','col.balance':'Balance','col.wallet':'Wallet','col.last':'Last purchase','col.owner':'Owner','col.total':'Total','col.number':'Number','col.date':'Date','col.due':'Due','col.paid':'Paid','col.open':'Open','col.email':'Email','col.phone':'Phone',
      'f.all':'All','f.debt':'With debt','f.wallet':'With credit','f.b2b':'B2B','f.b2c':'B2C','f.overdue':'Overdue','f.pending':'Pending','f.paid':'Paid',
      'c360.expand':'Expand','c360.close':'Close','c360.back':'Back to customers','c360.summary':'Overview','c360.sales':'Sales','c360.payments':'Payments','c360.wallet':'Wallet','c360.tickets':'Tickets','c360.notes':'Notes',
      'c360.total_bought':'Total purchased','c360.debt':'Debt','c360.wallet_bal':'Wallet','c360.ltv':'Lifetime value','c360.last_contact':'Last contact','c360.timeline':'Timeline','c360.apply_wallet':'Apply wallet to debt','c360.new_sale':'New sale','c360.register_payment':'Record payment',
      'st.active':'Active','st.inactive':'Inactive','st.blocked':'Blocked','st.paid':'Paid','st.partial':'Partial','st.pending':'Pending','st.overdue':'Overdue',
      'wip.title':'This section arrives in an upcoming phase','wip.body':'The data structure already exists; the screen is built in','wip.phase':'Phase',
      'set.language':'Language','set.currency':'Currency','set.theme':'Theme','set.density':'Density',
      'design.title':'Design system','design.sub':'Components and tokens used across the app',
      'user.role':'Admin','money.note':'Amounts converted with demo rates','copy.copied':'Copied'
    },
    'pt-BR': {
      'nav.home':'Início','nav.clients':'Clientes','nav.sales':'Vendas','nav.purchases':'Compras','nav.crm':'CRM',
      'rail.contacts':'Contatos','rail.agenda':'Agenda','rail.calls':'Ligações','rail.announcements':'Avisos','rail.reports':'Relatórios',
      'tab.overview':'Resumo','tab.list':'Lista','tab.groups':'Grupos','tab.b2b':'Contas B2B','tab.wallet':'Carteira','tab.segments':'Segmentos',
      'tab.invoices':'Faturas','tab.quotes':'Orçamentos','tab.sales':'Vendas','tab.payments':'Recebimentos','tab.receivable':'A receber','tab.returns':'Devoluções',
      'tab.orders':'Pedidos','tab.suppliers':'Fornecedores','tab.payable':'A pagar','tab.expenses':'Despesas','tab.stock':'Estoque',
      'tab.leads':'Leads','tab.pipeline':'Funil','tab.tickets':'Chamados','tab.tasks':'Tarefas','tab.projects':'Projetos',
      'home.title':'Bom dia','home.sub':'Veja o que acontece hoje no seu negócio',
      'kpi.sales':'Vendas do mês','kpi.receivable':'A receber','kpi.payable':'A pagar','kpi.customers':'Clientes ativos','kpi.wallet':'Saldo em carteiras',
      'card.sales_trend':'Vendas, últimos 6 meses','card.top_debtors':'Maiores devedores','card.tasks':'Tarefas de hoje','card.activity':'Atividade recente','card.low_stock':'Estoque baixo',
      'search.placeholder':'Buscar clientes, faturas, produtos…','search.hint':'Buscar','search.empty':'Sem resultados','search.clients':'Clientes','search.invoices':'Faturas','search.products':'Produtos','search.go':'Ir para',
      'tbl.search':'Filtrar na tabela…','tbl.columns':'Colunas','tbl.density':'Densidade','tbl.rows':'linhas','tbl.of':'de','tbl.none':'Nada corresponde aos filtros','tbl.clear':'Limpar filtros','tbl.export':'Exportar','tbl.new':'Novo',
      'dens.compact':'Compacta','dens.normal':'Normal','dens.comfortable':'Ampla',
      'col.name':'Cliente','col.type':'Tipo','col.status':'Status','col.balance':'Saldo','col.wallet':'Carteira','col.last':'Última compra','col.owner':'Responsável','col.total':'Total','col.number':'Número','col.date':'Data','col.due':'Vence','col.paid':'Recebido','col.open':'Pendente','col.email':'E-mail','col.phone':'Telefone',
      'f.all':'Todos','f.debt':'Com dívida','f.wallet':'Com saldo a favor','f.b2b':'B2B','f.b2c':'B2C','f.overdue':'Vencidas','f.pending':'Pendentes','f.paid':'Pagas',
      'c360.expand':'Expandir','c360.close':'Fechar','c360.back':'Voltar aos clientes','c360.summary':'Resumo','c360.sales':'Vendas','c360.payments':'Pagamentos','c360.wallet':'Carteira','c360.tickets':'Chamados','c360.notes':'Notas',
      'c360.total_bought':'Total comprado','c360.debt':'Dívida','c360.wallet_bal':'Carteira','c360.ltv':'Valor vitalício','c360.last_contact':'Último contato','c360.timeline':'Linha do tempo','c360.apply_wallet':'Aplicar carteira à dívida','c360.new_sale':'Nova venda','c360.register_payment':'Registrar pagamento',
      'st.active':'Ativo','st.inactive':'Inativo','st.blocked':'Bloqueado','st.paid':'Paga','st.partial':'Parcial','st.pending':'Pendente','st.overdue':'Vencida',
      'wip.title':'Esta seção chega em uma fase futura','wip.body':'A estrutura de dados já existe; a tela é construída na','wip.phase':'Fase',
      'set.language':'Idioma','set.currency':'Moeda','set.theme':'Tema','set.density':'Densidade',
      'design.title':'Sistema de design','design.sub':'Componentes e tokens usados em todo o app',
      'user.role':'Admin','money.note':'Valores convertidos com taxas de demonstração','copy.copied':'Copiado'
    }
  };
  N.DICT = DICT;
  N.LANGS = [['es-AR', 'Español (AR)'], ['en', 'English'], ['pt-BR', 'Português (BR)']];
  N.t = (k) => (DICT[N.state.lang] && DICT[N.state.lang][k]) || DICT['es-AR'][k] || k;
})(window.Nexo);
