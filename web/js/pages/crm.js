/* Fase 7 · CRM: leads, embudo, tickets, tareas y proyectos.
   La lógica replica las funciones SQL de la migración 018 (lead_advance, lead_lose, lead_convert, ticket_reply,
   ticket_change_status, task_complete, task_log_time, project_set_status). */
(function (N) {
  const K = {
    'lead.nuevo': ['Nuevo', 'New', 'Novo'], 'lead.contactado': ['Contactado', 'Contacted', 'Contatado'], 'lead.calificado': ['Calificado', 'Qualified', 'Qualificado'],
    'lead.propuesta': ['Propuesta enviada', 'Proposal sent', 'Proposta enviada'], 'lead.negociacion': ['Negociación', 'Negotiation', 'Negociação'], 'lead.ganado': ['Ganado', 'Won', 'Ganho'], 'lead.perdido': ['Perdido', 'Lost', 'Perdido'],
    'tk.abierto': ['Abierto', 'Open', 'Aberto'], 'tk.progreso': ['En progreso', 'In progress', 'Em andamento'], 'tk.esperando': ['Esperando cliente', 'Waiting on customer', 'Aguardando cliente'], 'tk.resuelto': ['Resuelto', 'Resolved', 'Resolvido'], 'tk.cerrado': ['Cerrado', 'Closed', 'Fechado'],
    'task.pendiente': ['Pendiente', 'To do', 'Pendente'], 'task.progreso': ['En progreso', 'In progress', 'Em andamento'], 'task.completada': ['Completada', 'Done', 'Concluída'],
    'prj.planificado': ['Planificado', 'Planned', 'Planejado'], 'prj.progreso': ['En progreso', 'In progress', 'Em andamento'], 'prj.pausa': ['En pausa', 'On hold', 'Em pausa'], 'prj.completado': ['Completado', 'Completed', 'Concluído'], 'prj.cancelado': ['Cancelado', 'Cancelled', 'Cancelado'],
    'prio.baja': ['Baja', 'Low', 'Baixa'], 'prio.media': ['Media', 'Medium', 'Média'], 'prio.alta': ['Alta', 'High', 'Alta'], 'prio.urgente': ['Urgente', 'Urgent', 'Urgente'],
    'bill.nofact': ['No facturable', 'Non-billable', 'Não faturável'], 'bill.fijo': ['Precio fijo', 'Fixed price', 'Preço fixo'], 'bill.horas': ['Por horas', 'Hourly', 'Por horas'],
    'crm.new_lead': ['Nuevo lead', 'New lead', 'Novo lead'], 'crm.new_ticket': ['Nuevo ticket', 'New ticket', 'Novo ticket'], 'crm.new_task': ['Nueva tarea', 'New task', 'Nova tarefa'], 'crm.new_project': ['Nuevo proyecto', 'New project', 'Novo projeto'],
    'crm.col.lead': ['Lead', 'Lead', 'Lead'], 'crm.col.company': ['Empresa', 'Company', 'Empresa'], 'crm.col.source': ['Origen', 'Source', 'Origem'], 'crm.col.value': ['Valor estimado', 'Estimated value', 'Valor estimado'], 'crm.col.owner': ['Responsable', 'Owner', 'Responsável'], 'crm.col.temp': ['Temperatura', 'Temperature', 'Temperatura'],
    'crm.col.ticket': ['Ticket', 'Ticket', 'Ticket'], 'crm.col.subject': ['Asunto', 'Subject', 'Assunto'], 'crm.col.customer': ['Cliente', 'Customer', 'Cliente'], 'crm.col.priority': ['Prioridad', 'Priority', 'Prioridade'], 'crm.col.due': ['Vence', 'Due', 'Vence'], 'crm.col.msgs': ['Mensajes', 'Messages', 'Mensagens'],
    'crm.col.task': ['Tarea', 'Task', 'Tarefa'], 'crm.col.project': ['Proyecto', 'Project', 'Projeto'], 'crm.col.hours': ['Horas', 'Hours', 'Horas'], 'crm.col.progress': ['Avance', 'Progress', 'Progresso'], 'crm.col.budget': ['Presupuesto', 'Budget', 'Orçamento'], 'crm.col.billing': ['Facturación', 'Billing', 'Faturamento'],
    'temp.frio': ['Frío', 'Cold', 'Frio'], 'temp.tibio': ['Tibio', 'Warm', 'Morno'], 'temp.caliente': ['Caliente', 'Hot', 'Quente'],
    'crm.f.open': ['Abiertos', 'Open', 'Abertos'], 'crm.f.hot': ['Calientes', 'Hot', 'Quentes'], 'crm.f.overdue': ['Vencidos', 'Overdue', 'Vencidos'], 'crm.f.mine': ['Mías', 'Mine', 'Minhas'], 'crm.f.active': ['Activos', 'Active', 'Ativos'],
    'crm.a.advance': ['Avanzar a', 'Move to', 'Avançar para'], 'crm.a.convert': ['Convertir en cliente', 'Convert to customer', 'Converter em cliente'], 'crm.a.lose': ['Marcar como perdido', 'Mark as lost', 'Marcar como perdido'], 'crm.a.reopen': ['Reabrir', 'Reopen', 'Reabrir'],
    'crm.a.reply': ['Responder', 'Reply', 'Responder'], 'crm.a.complete': ['Completar', 'Complete', 'Concluir'], 'crm.a.log': ['Cargar horas', 'Log time', 'Lançar horas'], 'crm.a.setstatus': ['Cambiar estado', 'Change status', 'Alterar status'], 'crm.a.view_customer': ['Ver cliente', 'View customer', 'Ver cliente'],
    'crm.f.name': ['Nombre', 'Name', 'Nome'], 'crm.f.email': ['Email', 'Email', 'E-mail'], 'crm.f.phone': ['Teléfono', 'Phone', 'Telefone'], 'crm.f.company': ['Empresa (opcional)', 'Company (optional)', 'Empresa (opcional)'], 'crm.f.source': ['Origen', 'Source', 'Origem'], 'crm.f.value': ['Valor estimado', 'Estimated value', 'Valor estimado'], 'crm.f.reason': ['Motivo', 'Reason', 'Motivo'],
    'crm.f.subject': ['Asunto', 'Subject', 'Assunto'], 'crm.f.desc': ['Descripción', 'Description', 'Descrição'], 'crm.f.channel': ['Canal', 'Channel', 'Canal'], 'crm.f.message': ['Mensaje', 'Message', 'Mensagem'], 'crm.f.internal': ['Nota interna (el cliente no la ve)', 'Internal note (hidden from customer)', 'Nota interna (o cliente não vê)'],
    'crm.f.title': ['Título', 'Title', 'Título'], 'crm.f.assignee': ['Responsable', 'Assignee', 'Responsável'], 'crm.f.duedate': ['Vencimiento', 'Due date', 'Vencimento'], 'crm.f.minutes': ['Minutos', 'Minutes', 'Minutos'], 'crm.f.billable': ['Facturable', 'Billable', 'Faturável'], 'crm.f.parent': ['Subtarea de', 'Subtask of', 'Subtarefa de'],
    'crm.f.none': ['— Ninguno —', '— None —', '— Nenhum —'], 'crm.f.yes': ['Sí', 'Yes', 'Sim'], 'crm.f.no': ['No', 'No', 'Não'], 'crm.f.billing': ['Modo de facturación', 'Billing mode', 'Modo de faturamento'], 'crm.f.budget': ['Presupuesto', 'Budget', 'Orçamento'],
    'crm.e.name': ['Ingresá el nombre', 'Enter a name', 'Informe o nome'], 'crm.e.email': ['Email inválido', 'Invalid email', 'E-mail inválido'], 'crm.e.reason': ['Indicá el motivo', 'Enter a reason', 'Informe o motivo'], 'crm.e.msg': ['El mensaje está vacío', 'The message is empty', 'A mensagem está vazia'],
    'crm.e.closed': ['El ticket está cerrado: reabrilo para responder', 'The ticket is closed: reopen it to reply', 'O ticket está fechado: reabra para responder'], 'crm.e.subject': ['Ingresá el asunto', 'Enter a subject', 'Informe o assunto'], 'crm.e.title': ['Ingresá el título', 'Enter a title', 'Informe o título'],
    'crm.e.minutes': ['Los minutos deben ser mayores a cero', 'Minutes must be greater than zero', 'Os minutos devem ser maiores que zero'], 'crm.e.subtasks': ['Hay subtareas sin completar', 'There are unfinished subtasks', 'Há subtarefas não concluídas'], 'crm.e.opentasks': ['El proyecto tiene tareas sin completar', 'The project has unfinished tasks', 'O projeto tem tarefas não concluídas'],
    'crm.e.step': ['Solo se puede avanzar a la etapa siguiente', 'You can only move to the next stage', 'Só é possível avançar para a próxima etapa'], 'crm.e.customer': ['Elegí un cliente', 'Choose a customer', 'Escolha um cliente'],
    'crm.t.lead': ['Lead creado', 'Lead created', 'Lead criado'], 'crm.t.advanced': ['Lead actualizado', 'Lead updated', 'Lead atualizado'], 'crm.t.converted': ['Lead convertido: cliente creado', 'Lead converted: customer created', 'Lead convertido: cliente criado'], 'crm.t.lost': ['Lead marcado como perdido', 'Lead marked as lost', 'Lead marcado como perdido'], 'crm.t.reopened': ['Lead reabierto', 'Lead reopened', 'Lead reaberto'],
    'crm.t.ticket': ['Ticket creado', 'Ticket created', 'Ticket criado'], 'crm.t.replied': ['Respuesta enviada', 'Reply sent', 'Resposta enviada'], 'crm.t.status': ['Estado actualizado', 'Status updated', 'Status atualizado'], 'crm.t.task': ['Tarea creada', 'Task created', 'Tarefa criada'], 'crm.t.done': ['Tarea completada', 'Task completed', 'Tarefa concluída'], 'crm.t.logged': ['Horas registradas', 'Time logged', 'Horas registradas'], 'crm.t.project': ['Proyecto creado', 'Project created', 'Projeto criado'],
    'crm.d.lost_reason': ['Motivo de pérdida', 'Lost reason', 'Motivo da perda'], 'crm.d.customer': ['Cliente creado', 'Customer created', 'Cliente criado'], 'crm.d.thread': ['Conversación', 'Conversation', 'Conversa'], 'crm.d.internal': ['Interna', 'Internal', 'Interna'], 'crm.d.tasks': ['Tareas', 'Tasks', 'Tarefas'], 'crm.d.logged': ['Registrado', 'Logged', 'Registrado'], 'crm.d.noproject': ['Sin proyecto', 'No project', 'Sem projeto'],
    'crm.pipe.total': ['Valor en el embudo', 'Pipeline value', 'Valor no funil'], 'crm.pipe.empty': ['Sin leads', 'No leads', 'Sem leads'], 'crm.pipe.hint': ['Arrastrá una tarjeta a la etapa siguiente', 'Drag a card to the next stage', 'Arraste um cartão para a próxima etapa'],
    'crm.kpi.open': ['Tickets abiertos', 'Open tickets', 'Tickets abertos'], 'crm.kpi.overdue': ['Vencidos', 'Overdue', 'Vencidos'], 'crm.kpi.mytasks': ['Tareas pendientes', 'Pending tasks', 'Tarefas pendentes']
  };
  ['es-AR', 'en', 'pt-BR'].forEach((lg, i) => Object.keys(K).forEach((k) => (N.DICT[lg][k] = K[k][i])));

  const D = N.data, TODAY = '2026-10-01', R = (N.routes = N.routes || {}), money = (m) => N.money(m), t = (k) => N.t(k), esc = N.esc;
  const USERS = ['Ana Demo', 'Marcos Ríos', 'Vale Sosa', 'Carlos Vega'], ME = 'Ana Demo';
  const ok = (key) => { N.toast(t(key)); N.rerender(); };
  const cust = (id) => D.customers.find((c) => c.id === id);
  const custName = (id) => (cust(id) || {}).name || '—';
  const nextId = (arr, pfx) => pfx + '-' + String(arr.length + 1).padStart(4, '0');
  const who = (name) => `<div class="who"><span class="av">${N.initials(name)}</span><div><b>${esc(name)}</b></div></div>`;
  const PRIO = { baja: '', media: 'info', alta: 'warn', urgente: 'danger' };
  const prioChip = (p) => N.chip(PRIO[p], t('prio.' + p));
  const emailOk = (e) => !e || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
  const custOptions = (withNone) => (withNone ? [['', t('crm.f.none')]] : [['', '—']]).concat(D.customers.map((c) => [c.id, c.name]));

  if (!D.leads) {
    D.leads = [
      { id: 'LED-0001', name: 'Roberto Salas', company: 'Salas Hnos.', email: 'roberto@salas.example', phone: '+54 11 5555-2001', source: 'Web', owner: 'Ana Demo', status: 'nuevo', temp: 'tibio', value: 1200000 },
      { id: 'LED-0002', name: 'Camila Ortiz', company: '', email: 'camila@example.com', phone: '+54 11 5555-2002', source: 'Instagram', owner: 'Vale Sosa', status: 'contactado', temp: 'frio', value: 180000 },
      { id: 'LED-0003', name: 'Hernán Paz', company: 'Paz Construcciones', email: 'hernan@paz.example', phone: '+54 351 555-2003', source: 'Referido', owner: 'Marcos Ríos', status: 'calificado', temp: 'caliente', value: 4500000 },
      { id: 'LED-0004', name: 'Lucía Vera', company: 'Vera Eventos', email: 'lucia@vera.example', phone: '+54 11 5555-2004', source: 'Web', owner: 'Ana Demo', status: 'propuesta', temp: 'caliente', value: 2800000 },
      { id: 'LED-0005', name: 'Tomás Ibáñez', company: 'Ibáñez y Cía', email: 'tomas@ibanez.example', phone: '+54 261 555-2005', source: 'Feria', owner: 'Carlos Vega', status: 'negociacion', temp: 'caliente', value: 7600000 },
      { id: 'LED-0006', name: 'Paula Rey', company: '', email: 'paula@example.com', phone: '+54 11 5555-2006', source: 'Referido', owner: 'Vale Sosa', status: 'contactado', temp: 'tibio', value: 320000 },
      { id: 'LED-0007', name: 'Gustavo Lima', company: 'Lima Textil', email: 'gustavo@lima.example', phone: '+54 223 555-2007', source: 'Web', owner: 'Marcos Ríos', status: 'perdido', temp: 'frio', value: 900000, lostReason: 'Eligió otro proveedor' },
      { id: 'LED-0008', name: 'Inés Molina', company: 'Molina Distribuciones', email: 'ines@molina.example', phone: '+54 11 5555-2008', source: 'Feria', owner: 'Carlos Vega', status: 'ganado', temp: 'caliente', value: 3900000, customerId: 'CLI-0008' }
    ];
    D.tickets = [
      { id: 'TCK-0001', customer: 'CLI-0002', subject: 'No llegó el pedido VTA-0002', priority: 'alta', status: 'progreso', channel: 'Email', assignee: 'Ana Demo', due: '2026-09-29',
        msgs: [{ by: 'Distribuidora Norte', type: 'cliente', body: 'Pasaron 10 días y no recibimos la mercadería.', internal: false }, { by: 'Ana Demo', type: 'usuario', body: 'Estamos consultando con logística.', internal: false }, { by: 'Ana Demo', type: 'usuario', body: 'Revisar con el transportista el seguimiento.', internal: true }] },
      { id: 'TCK-0002', customer: 'CLI-0003', subject: 'Factura con CUIT incorrecto', priority: 'media', status: 'abierto', channel: 'Portal', assignee: 'Vale Sosa', due: '2026-10-05', msgs: [{ by: 'Laura Gómez', type: 'cliente', body: 'La factura salió con otro CUIT, ¿pueden corregirla?', internal: false }] },
      { id: 'TCK-0003', customer: 'CLI-0006', subject: 'Reclamo por producto dañado', priority: 'urgente', status: 'esperando', channel: 'WhatsApp', assignee: 'Carlos Vega', due: '2026-09-30', msgs: [{ by: 'Ferretería Central', type: 'cliente', body: 'Llegaron 3 cajas golpeadas.', internal: false }, { by: 'Carlos Vega', type: 'usuario', body: 'Enviamos fotos para validar el cambio, ¿nos las pasás?', internal: false }] },
      { id: 'TCK-0004', customer: 'CLI-0007', subject: 'Consulta por garantía', priority: 'baja', status: 'resuelto', channel: 'Teléfono', assignee: 'Ana Demo', due: '2026-09-27', msgs: [{ by: 'Diego Fernández', type: 'cliente', body: '¿Cuánto dura la garantía del cable?', internal: false }, { by: 'Ana Demo', type: 'usuario', body: 'Son 12 meses desde la compra.', internal: false }] },
      { id: 'TCK-0005', customer: 'CLI-0010', subject: 'Pedido de cuenta corriente', priority: 'media', status: 'cerrado', channel: 'Email', assignee: 'Marcos Ríos', due: null, msgs: [{ by: 'Mayorista Cuyo', type: 'cliente', body: 'Necesitamos el resumen de cuenta.', internal: false }] }
    ];
    D.tasks = [
      { id: 'TSK-0001', title: 'Llamar a Roberto Salas', lead: 'LED-0001', customer: null, project: null, parent: null, assignee: 'Ana Demo', status: 'pendiente', priority: 'alta', due: '2026-10-02', billable: false, log: [] },
      { id: 'TSK-0002', title: 'Enviar propuesta a Vera Eventos', lead: 'LED-0004', customer: null, project: null, parent: null, assignee: 'Ana Demo', status: 'progreso', priority: 'urgente', due: '2026-09-30', billable: false, log: [] },
      { id: 'TSK-0003', title: 'Relevamiento de procesos', lead: null, customer: 'CLI-0008', project: 'PRY-0001', parent: null, assignee: 'Marcos Ríos', status: 'progreso', priority: 'media', due: '2026-10-10', billable: true, log: [{ minutes: 120, billable: true, notes: 'Reunión inicial', date: '2026-09-25' }] },
      { id: 'TSK-0004', title: 'Entrevistas con el equipo', lead: null, customer: 'CLI-0008', project: 'PRY-0001', parent: 'TSK-0003', assignee: 'Marcos Ríos', status: 'pendiente', priority: 'media', due: '2026-10-08', billable: true, log: [] },
      { id: 'TSK-0005', title: 'Configurar catálogo B2B', lead: null, customer: 'CLI-0002', project: 'PRY-0002', parent: null, assignee: 'Vale Sosa', status: 'completada', priority: 'media', due: '2026-09-20', billable: false, log: [{ minutes: 180, billable: false, notes: '', date: '2026-09-18' }] },
      { id: 'TSK-0006', title: 'Capacitar al equipo de ventas', lead: null, customer: 'CLI-0002', project: 'PRY-0002', parent: null, assignee: 'Vale Sosa', status: 'pendiente', priority: 'baja', due: '2026-10-15', billable: false, log: [] },
      { id: 'TSK-0007', title: 'Conciliar cobranzas de septiembre', lead: null, customer: null, project: null, parent: null, assignee: 'Carlos Vega', status: 'pendiente', priority: 'alta', due: '2026-09-29', billable: false, log: [] },
      { id: 'TSK-0008', title: 'Diseñar landing de campaña', lead: null, customer: null, project: 'PRY-0003', parent: null, assignee: 'Ana Demo', status: 'progreso', priority: 'media', due: '2026-10-20', billable: false, log: [] }
    ];
    D.projects = [
      { id: 'PRY-0001', name: 'Implementación para Almacén Los Pinos', customer: 'CLI-0008', status: 'progreso', due: '2026-10-31', billing: 'horas', budget: 1500000 },
      { id: 'PRY-0002', name: 'Alta de portal B2B Distribuidora Norte', customer: 'CLI-0002', status: 'progreso', due: '2026-09-25', billing: 'fijo', budget: 2400000 },
      { id: 'PRY-0003', name: 'Campaña de primavera', customer: null, status: 'planificado', due: '2026-11-15', billing: 'nofact', budget: 0 }
    ];
  }

  /* ================= Leads ================= */
  const LPATH = ['nuevo', 'contactado', 'calificado', 'propuesta', 'negociacion'];
  const leadChip = (s) => N.chip({ nuevo: '', contactado: 'info', calificado: 'info', propuesta: 'violet', negociacion: 'warn', ganado: 'ok', perdido: 'danger' }[s], t('lead.' + s));
  const tempChip = (x) => (x ? N.chip({ frio: 'info', tibio: 'warn', caliente: 'danger' }[x], t('temp.' + x)) : '<span class="faint">—</span>');
  const leadOps = {
    advance(l) { const i = LPATH.indexOf(l.status); if (i >= 0 && i < LPATH.length - 1) l.status = LPATH[i + 1]; },
    lose(l, reason) { l.status = 'perdido'; l.lostReason = reason; },
    reopen(l) { l.status = 'nuevo'; l.lostReason = null; },
    convert(l) {
      const company = (l.company || '').trim(), id = nextId(D.customers, 'CLI'), b2b = !!company;
      const c = { id, name: b2b ? company : l.name, type: b2b ? 'B2B' : 'B2C', status: 'active', balance: 0, wallet: 0, last: TODAY, owner: l.owner, email: l.email, phone: l.phone, total: 0, group: b2b ? 'G2' : 'G1', limit: null, terms: b2b ? 30 : 0, taxId: '', fromLead: l.id };
      D.customers.push(c); l.status = 'ganado'; l.customerId = id;
      D.tasks.forEach((x) => { if (x.lead === l.id && !x.customer) x.customer = id; });
      return c;
    }
  };
  function leadForm() {
    N.drawer({ title: t('crm.new_lead'), body: `${N.field('name', t('crm.f.name'))}<div class="row2">${N.field('email', t('crm.f.email'), { type: 'email' })}${N.field('phone', t('crm.f.phone'))}</div>${N.field('company', t('crm.f.company'))}<div class="row2">${N.field('source', t('crm.f.source'), { options: ['Web', 'Instagram', 'Referido', 'Feria', 'Otro'].map((x) => [x, x]) })}${N.field('value', t('crm.f.value'), { type: 'number', min: 0, step: '0.01', num: true })}</div><div class="row2">${N.field('owner', t('crm.f.assignee'), { options: USERS.map((u) => [u, u]) })}${N.field('temp', t('crm.col.temp'), { options: [['tibio', t('temp.tibio')], ['frio', t('temp.frio')], ['caliente', t('temp.caliente')]] })}</div>`,
      onSave(d, close) { const e = {}; if (!d.name.trim()) e.name = t('crm.e.name'); if (!emailOk(d.email)) e.email = t('crm.e.email'); if (Object.keys(e).length) return e;
        D.leads.unshift({ id: nextId(D.leads, 'LED'), name: d.name.trim(), company: d.company.trim(), email: d.email, phone: d.phone, source: d.source, owner: d.owner, status: 'nuevo', temp: d.temp, value: Math.round((+d.value || 0) * 100) }); close(); ok('crm.t.lead'); } });
  }
  function loseForm(l) {
    N.drawer({ title: t('crm.a.lose') + ' · ' + l.id, body: N.field('reason', t('crm.f.reason')), saveLabel: t('crm.a.lose'),
      onSave(d, close) { if (!d.reason.trim()) return { reason: t('crm.e.reason') }; leadOps.lose(l, d.reason.trim()); close(); ok('crm.t.lost'); } });
  }
  function openLead(l) {
    const i = LPATH.indexOf(l.status), next = i >= 0 && i < LPATH.length - 1 ? LPATH[i + 1] : null, open = l.status !== 'ganado' && l.status !== 'perdido';
    const tasks = D.tasks.filter((x) => x.lead === l.id);
    const dr = N.drawer({ title: l.id + ' · ' + l.name, wide: true, body: `<div style="display:flex;gap:8px;flex-wrap:wrap">${leadChip(l.status)}${tempChip(l.temp)}${l.company ? N.chip('', l.company, true) : ''}</div>
      <div class="mini"><div class="card"><div class="muted">${t('crm.col.value')}</div><div class="v num">${money(l.value)}</div></div><div class="card"><div class="muted">${t('crm.col.owner')}</div><div class="v" style="font-size:15px">${esc(l.owner)}</div></div><div class="card"><div class="muted">${t('crm.col.source')}</div><div class="v" style="font-size:15px">${esc(l.source)}</div></div></div>
      <p class="muted">${esc(l.email || '')} ${l.phone ? '· ' + esc(l.phone) : ''}</p>
      ${l.status === 'perdido' ? `<div class="alloc"><span>${t('crm.d.lost_reason')}</span><b>${esc(l.lostReason || '')}</b></div>` : ''}
      ${l.status === 'ganado' ? `<div class="alloc"><span>${t('crm.d.customer')}</span><b class="mono">${l.customerId}</b></div>` : ''}
      ${tasks.length ? `<h3 style="margin:12px 0 6px">${t('crm.d.tasks')}</h3>${tasks.map((x) => `<div class="alloc"><span>${esc(x.title)}</span>${N.chip({ pendiente: '', progreso: 'info', completada: 'ok' }[x.status], t('task.' + x.status))}</div>`).join('')}` : ''}
      <div id="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">${next ? `<button type="button" class="btn sm primary" data-op="advance">${t('crm.a.advance')} ${t('lead.' + next)}</button>` : ''}${open ? `<button type="button" class="btn sm primary" data-op="convert">${t('crm.a.convert')}</button><button type="button" class="btn sm danger" data-op="lose">${t('crm.a.lose')}</button>` : ''}${l.status === 'perdido' ? `<button type="button" class="btn sm" data-op="reopen">${t('crm.a.reopen')}</button>` : ''}</div>` });
    dr.el.querySelector('#acts').onclick = (e) => { const b = e.target.closest('[data-op]'); if (!b) return; const op = b.dataset.op; dr.close();
      if (op === 'advance') { leadOps.advance(l); ok('crm.t.advanced'); } else if (op === 'convert') { leadOps.convert(l); ok('crm.t.converted'); } else if (op === 'lose') loseForm(l); else if (op === 'reopen') { leadOps.reopen(l); ok('crm.t.reopened'); } };
  }
  R['crm/leads'] = (node) => node.append(N.table({
    id: 'leads', rows: D.leads, id_of: (r) => r.id, sort: 'id', text: (r) => [r.id, r.name, r.company, r.email, r.source].join(' '),
    cols: [
      { key: 'id', label: 'crm.col.lead', value: (r) => r.name, render: (r) => `<div class="who"><span class="av">${N.initials(r.name)}</span><div><b>${esc(r.name)}</b><small class="mono">${r.id}</small></div></div>` },
      { key: 'company', label: 'crm.col.company', value: (r) => r.company || '', render: (r) => esc(r.company || '—') },
      { key: 'status', label: 'col.status', value: (r) => LPATH.indexOf(r.status), render: (r) => leadChip(r.status) },
      { key: 'temp', label: 'crm.col.temp', value: (r) => r.temp || '', render: (r) => tempChip(r.temp) },
      { key: 'source', label: 'crm.col.source', value: (r) => r.source, render: (r) => N.chip('', r.source, true) },
      { key: 'owner', label: 'crm.col.owner', hidden: true, value: (r) => r.owner, render: (r) => esc(r.owner) },
      { key: 'value', label: 'crm.col.value', align: 'r', value: (r) => r.value, render: (r) => `<b class="num">${money(r.value)}</b>` }
    ],
    filters: [{ key: 'open', label: 'crm.f.open', fn: (r) => r.status !== 'ganado' && r.status !== 'perdido' }, { key: 'hot', label: 'crm.f.hot', fn: (r) => r.temp === 'caliente' && r.status !== 'perdido' }],
    newLabel: 'crm.new_lead', onNew: leadForm, onRow: openLead, actions: [{ key: 'open', label: 'crm.a.advance', icon: 'expand' }], onAction: (k, r) => openLead(r),
    footer: (rows) => money(rows.reduce((a, r) => a + r.value, 0))
  }));

  /* ================= Embudo ================= */
  R['crm/embudo'] = (node) => {
    const cols = LPATH.concat(['ganado', 'perdido']), tot = D.leads.filter((l) => LPATH.includes(l.status)).reduce((a, l) => a + l.value, 0);
    node.append(N.el(`<div class="card" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><div class="muted">${t('crm.pipe.total')}</div><div class="num" style="font-size:26px;font-weight:800">${money(tot)}</div></div><span class="muted">${t('crm.pipe.hint')}</span></div>`));
    const board = N.el(`<div class="kanban">${cols.map((s) => { const ls = D.leads.filter((l) => l.status === s);
      return `<section class="kcol" data-status="${s}" aria-label="${t('lead.' + s)}"><header><b>${t('lead.' + s)}</b><span class="num muted">${ls.length} · ${money(ls.reduce((a, l) => a + l.value, 0))}</span></header>${ls.map((l) => `<article class="kcard" draggable="${LPATH.includes(l.status)}" tabindex="0" data-id="${l.id}"><b>${esc(l.name)}</b><small class="muted">${esc(l.company || l.source)}</small><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;margin-top:8px"><span class="num">${money(l.value)}</span>${tempChip(l.temp)}</div></article>`).join('') || `<div class="kempty">${t('crm.pipe.empty')}</div>`}</section>`; }).join('')}</div>`);
    node.append(board);
    let drag = null;
    board.addEventListener('dragstart', (e) => { const c = e.target.closest('.kcard'); if (!c) return; drag = D.leads.find((l) => l.id === c.dataset.id); e.dataTransfer.setData('text/plain', drag.id); e.dataTransfer.effectAllowed = 'move'; });
    board.addEventListener('dragover', (e) => { if (e.target.closest('.kcol')) e.preventDefault(); });
    board.addEventListener('drop', (e) => { const col = e.target.closest('.kcol'); if (!col || !drag) return; e.preventDefault(); const l = drag, to = col.dataset.status; drag = null;
      if (to === l.status) return;
      if (to === 'ganado') { if (LPATH.includes(l.status)) { leadOps.convert(l); ok('crm.t.converted'); } else N.toast(t('crm.e.step')); return; }
      if (to === 'perdido') { if (LPATH.includes(l.status)) loseForm(l); else N.toast(t('crm.e.step')); return; }
      if (LPATH.indexOf(to) === LPATH.indexOf(l.status) + 1) { leadOps.advance(l); ok('crm.t.advanced'); } else N.toast(t('crm.e.step')); });
    board.addEventListener('click', (e) => { const c = e.target.closest('.kcard'); if (c) openLead(D.leads.find((l) => l.id === c.dataset.id)); });
    board.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const c = e.target.closest('.kcard'); if (c) openLead(D.leads.find((l) => l.id === c.dataset.id)); } });
  };

  /* ================= Tickets ================= */
  const TT = { abierto: ['progreso', 'cerrado'], progreso: ['esperando', 'resuelto'], esperando: ['progreso', 'resuelto'], resuelto: ['cerrado', 'progreso'], cerrado: ['abierto'] };
  const tkChip = (s) => N.chip({ abierto: 'info', progreso: 'warn', esperando: 'violet', resuelto: 'ok', cerrado: '' }[s], t('tk.' + s));
  const tkOverdue = (k) => !!k.due && k.due < TODAY && !['resuelto', 'cerrado'].includes(k.status);
  const tkOps = {
    reply(k, body, internal) {
      if (!body.trim()) return 'crm.e.msg'; if (k.status === 'cerrado') return 'crm.e.closed';
      k.msgs.push({ by: ME, type: 'usuario', body: body.trim(), internal }); if (k.status === 'abierto' && !internal) k.status = 'progreso'; return null;
    },
    setStatus(k, s) { if (TT[k.status].includes(s)) k.status = s; }
  };
  function ticketForm() {
    N.drawer({ title: t('crm.new_ticket'), body: `${N.field('customer', t('crm.col.customer'), { options: custOptions() })}${N.field('subject', t('crm.f.subject'))}${N.field('desc', t('crm.f.desc'))}<div class="row2">${N.field('priority', t('crm.col.priority'), { value: 'media', options: Object.keys(PRIO).map((p) => [p, t('prio.' + p)]) })}${N.field('channel', t('crm.f.channel'), { options: ['Manual', 'Email', 'Portal', 'WhatsApp', 'Teléfono'].map((x) => [x, x]) })}</div>${N.field('assignee', t('crm.f.assignee'), { options: USERS.map((u) => [u, u]) })}`,
      onSave(d, close) { const e = {}; if (!d.customer) e.customer = t('crm.e.customer'); if (!d.subject.trim()) e.subject = t('crm.e.subject'); if (Object.keys(e).length) return e;
        D.tickets.unshift({ id: nextId(D.tickets, 'TCK'), customer: d.customer, subject: d.subject.trim(), priority: d.priority, status: 'abierto', channel: d.channel, assignee: d.assignee, due: null, msgs: d.desc.trim() ? [{ by: custName(d.customer), type: 'cliente', body: d.desc.trim(), internal: false }] : [] }); close(); ok('crm.t.ticket'); } });
  }
  function openTicket(k) {
    const msgs = k.msgs.map((m) => `<div class="msg ${m.type}${m.internal ? ' internal' : ''}"><div><b>${esc(m.by)}</b>${m.internal ? ' ' + N.chip('warn', t('crm.d.internal')) : ''}</div><p>${esc(m.body)}</p></div>`).join('');
    const dr = N.drawer({ title: k.id + ' · ' + k.subject, wide: true, saveLabel: t('crm.a.reply'), body: `<div style="display:flex;gap:8px;flex-wrap:wrap">${tkChip(k.status)}${prioChip(k.priority)}${tkOverdue(k) ? N.chip('danger', t('crm.f.overdue')) : ''}${N.chip('', k.channel, true)}</div>
      <p class="muted">${esc(custName(k.customer))} · ${esc(k.assignee)}</p><h3 style="margin:8px 0">${t('crm.d.thread')}</h3><div class="thread">${msgs || '—'}</div>
      <div class="field"><label for="f-body">${t('crm.f.message')}</label><textarea class="input" id="f-body" name="body" rows="3"></textarea></div><label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" name="internal"> ${t('crm.f.internal')}</label>
      <div id="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><span class="muted">${t('crm.a.setstatus')}:</span>${TT[k.status].map((s) => `<button type="button" class="btn sm" data-st="${s}">${t('tk.' + s)}</button>`).join('')}</div>`,
      onSave(d, close) { const err = tkOps.reply(k, d.body || '', !!d.internal); if (err) return { body: t(err) }; close(); ok('crm.t.replied'); } });
    dr.el.querySelector('#acts').onclick = (e) => { const b = e.target.closest('[data-st]'); if (!b) return; tkOps.setStatus(k, b.dataset.st); dr.close(); ok('crm.t.status'); };
  }
  R['crm/tickets'] = (node) => {
    const open = D.tickets.filter((k) => !['resuelto', 'cerrado'].includes(k.status)), over = D.tickets.filter(tkOverdue);
    node.append(N.el(`<div class="mini" style="margin-bottom:16px"><div class="card"><div class="muted">${t('crm.kpi.open')}</div><div class="v num">${open.length}</div></div><div class="card"><div class="muted">${t('crm.kpi.overdue')}</div><div class="v num" style="color:${over.length ? 'var(--danger)' : 'inherit'}">${over.length}</div></div></div>`));
    node.append(N.table({
      id: 'tickets', rows: D.tickets, id_of: (r) => r.id, sort: 'id', text: (r) => [r.id, r.subject, custName(r.customer), r.assignee].join(' '),
      cols: [
        { key: 'id', label: 'crm.col.ticket', value: (r) => r.id, render: (r) => `<span class="mono">${r.id}</span>` },
        { key: 'subject', label: 'crm.col.subject', value: (r) => r.subject, render: (r) => `<b>${esc(r.subject)}</b>` },
        { key: 'customer', label: 'crm.col.customer', value: (r) => custName(r.customer), render: (r) => esc(custName(r.customer)) },
        { key: 'status', label: 'col.status', value: (r) => r.status, render: (r) => tkChip(r.status) },
        { key: 'priority', label: 'crm.col.priority', value: (r) => Object.keys(PRIO).indexOf(r.priority), render: (r) => prioChip(r.priority) },
        { key: 'due', label: 'crm.col.due', value: (r) => r.due || '9999', render: (r) => (tkOverdue(r) ? N.chip('danger', N.date(r.due)) : N.date(r.due)) },
        { key: 'assignee', label: 'crm.col.owner', hidden: true, value: (r) => r.assignee, render: (r) => esc(r.assignee) },
        { key: 'msgs', label: 'crm.col.msgs', align: 'r', hidden: true, value: (r) => r.msgs.length, render: (r) => r.msgs.length }
      ],
      filters: [{ key: 'open', label: 'crm.f.open', fn: (r) => !['resuelto', 'cerrado'].includes(r.status) }, { key: 'over', label: 'crm.f.overdue', fn: tkOverdue }],
      newLabel: 'crm.new_ticket', onNew: ticketForm, onRow: openTicket, actions: [{ key: 'open', label: 'crm.a.reply', icon: 'expand' }], onAction: (k, r) => openTicket(r)
    }));
  };

  /* ================= Tareas ================= */
  const taskChip = (s) => N.chip({ pendiente: '', progreso: 'info', completada: 'ok' }[s], t('task.' + s));
  const minsOf = (x) => x.log.reduce((a, e) => a + e.minutes, 0);
  const hrs = (m) => (m / 60).toFixed(1).replace(/\.0$/, '') + ' h';
  const taskOver = (x) => !!x.due && x.due < TODAY && x.status !== 'completada';
  const taskOps = {
    complete(x) { if (D.tasks.some((s) => s.parent === x.id && s.status !== 'completada')) return 'crm.e.subtasks'; x.status = 'completada'; return null; },
    log(x, minutes, billable, notes) { if (!(minutes > 0)) return 'crm.e.minutes'; x.log.push({ minutes, billable, notes, date: TODAY }); if (x.status === 'pendiente') x.status = 'progreso'; return null; }
  };
  function logForm(x) {
    N.drawer({ title: t('crm.a.log') + ' · ' + x.id, saveLabel: t('crm.a.log'), body: `<div class="row2">${N.field('minutes', t('crm.f.minutes'), { type: 'number', min: 0, num: true })}${N.field('billable', t('crm.f.billable'), { value: x.billable ? '1' : '0', options: [['1', t('crm.f.yes')], ['0', t('crm.f.no')]] })}</div>${N.field('notes', t('crm.f.desc'))}<p class="muted">${t('crm.d.logged')}: ${hrs(minsOf(x))}</p>`,
      onSave(d, close) { const err = taskOps.log(x, Math.round(+d.minutes), d.billable === '1', d.notes); if (err) return { minutes: t(err) }; close(); ok('crm.t.logged'); } });
  }
  function taskForm() {
    N.drawer({ title: t('crm.new_task'), body: `${N.field('title', t('crm.f.title'))}<div class="row2">${N.field('customer', t('crm.col.customer'), { options: custOptions(true) })}${N.field('project', t('crm.col.project'), { options: [['', t('crm.f.none')]].concat(D.projects.map((p) => [p.id, p.name])) })}</div><div class="row2">${N.field('assignee', t('crm.f.assignee'), { options: USERS.map((u) => [u, u]) })}${N.field('priority', t('crm.col.priority'), { value: 'media', options: Object.keys(PRIO).map((p) => [p, t('prio.' + p)]) })}</div><div class="row2">${N.field('due', t('crm.f.duedate'), { type: 'date' })}${N.field('parent', t('crm.f.parent'), { options: [['', t('crm.f.none')]].concat(D.tasks.filter((x) => !x.parent).map((x) => [x.id, x.title])) })}</div>${N.field('billable', t('crm.f.billable'), { options: [['0', t('crm.f.no')], ['1', t('crm.f.yes')]] })}`,
      onSave(d, close) { if (!d.title.trim()) return { title: t('crm.e.title') };
        D.tasks.unshift({ id: nextId(D.tasks, 'TSK'), title: d.title.trim(), lead: null, customer: d.customer || null, project: d.project || null, parent: d.parent || null, assignee: d.assignee, status: 'pendiente', priority: d.priority, due: d.due || null, billable: d.billable === '1', log: [] }); close(); ok('crm.t.task'); } });
  }
  R['crm/tareas'] = (node) => {
    const pending = D.tasks.filter((x) => x.status !== 'completada').length;
    node.append(N.el(`<div class="mini" style="margin-bottom:16px"><div class="card"><div class="muted">${t('crm.kpi.mytasks')}</div><div class="v num">${pending}</div></div><div class="card"><div class="muted">${t('crm.kpi.overdue')}</div><div class="v num" style="color:${D.tasks.some(taskOver) ? 'var(--danger)' : 'inherit'}">${D.tasks.filter(taskOver).length}</div></div></div>`));
    node.append(N.table({
      id: 'tareas', rows: D.tasks, id_of: (r) => r.id, sort: 'due', text: (r) => [r.id, r.title, r.assignee, custName(r.customer)].join(' '),
      cols: [
        { key: 'id', label: 'crm.col.task', value: (r) => r.title, render: (r) => `<div><b>${esc(r.title)}</b><br><small class="mono muted">${r.id}${r.parent ? ' ↳ ' + r.parent : ''}</small></div>` },
        { key: 'status', label: 'col.status', value: (r) => r.status, render: (r) => taskChip(r.status) },
        { key: 'priority', label: 'crm.col.priority', value: (r) => Object.keys(PRIO).indexOf(r.priority), render: (r) => prioChip(r.priority) },
        { key: 'due', label: 'crm.col.due', value: (r) => r.due || '9999', render: (r) => (taskOver(r) ? N.chip('danger', N.date(r.due)) : N.date(r.due)) },
        { key: 'assignee', label: 'crm.col.owner', value: (r) => r.assignee, render: (r) => esc(r.assignee) },
        { key: 'customer', label: 'crm.col.customer', hidden: true, value: (r) => custName(r.customer), render: (r) => esc(custName(r.customer)) },
        { key: 'hours', label: 'crm.col.hours', align: 'r', value: minsOf, render: (r) => `<span class="num">${hrs(minsOf(r))}</span>` },
        { key: 'act', label: 'crm.a.complete', align: 'r', render: (r) => (r.status !== 'completada' ? `<button class="btn sm" data-log="${r.id}">${t('crm.a.log')}</button> <button class="btn primary sm" data-done="${r.id}">${t('crm.a.complete')}</button>` : '') }
      ],
      filters: [{ key: 'mine', label: 'crm.f.mine', fn: (r) => r.assignee === ME && r.status !== 'completada' }, { key: 'over', label: 'crm.f.overdue', fn: taskOver }, { key: 'open', label: 'crm.f.open', fn: (r) => r.status !== 'completada' }],
      newLabel: 'crm.new_task', onNew: taskForm, onRow: () => {}
    }));
    node.addEventListener('click', (e) => {
      const d = e.target.closest('[data-done]'), l = e.target.closest('[data-log]'); if (!d && !l) return; e.stopPropagation();
      if (d) { const err = taskOps.complete(D.tasks.find((x) => x.id === d.dataset.done)); if (err) N.toast(t(err)); else ok('crm.t.done'); } else logForm(D.tasks.find((x) => x.id === l.dataset.log));
    }, true);
  };

  /* ================= Proyectos ================= */
  const PS = ['planificado', 'progreso', 'pausa', 'completado', 'cancelado'];
  const prjChip = (s) => N.chip({ planificado: '', progreso: 'info', pausa: 'warn', completado: 'ok', cancelado: 'danger' }[s], t('prj.' + s));
  const prjTasks = (p) => D.tasks.filter((x) => x.project === p.id);
  const prjStats = (p) => { const ts = prjTasks(p), done = ts.filter((x) => x.status === 'completada').length; return { total: ts.length, done, pct: ts.length ? Math.round((done / ts.length) * 100) : 0, mins: ts.reduce((a, x) => a + minsOf(x), 0) }; };
  const prjOver = (p) => !!p.due && p.due < TODAY && ['planificado', 'progreso'].includes(p.status);
  function setProject(p, s) { if (s === 'completado' && prjTasks(p).some((x) => x.status !== 'completada')) return 'crm.e.opentasks'; p.status = s; return null; }
  function projectForm() {
    N.drawer({ title: t('crm.new_project'), body: `${N.field('name', t('crm.f.name'))}${N.field('customer', t('crm.col.customer'), { options: custOptions(true) })}<div class="row2">${N.field('billing', t('crm.f.billing'), { options: [['nofact', t('bill.nofact')], ['fijo', t('bill.fijo')], ['horas', t('bill.horas')]] })}${N.field('budget', t('crm.f.budget'), { type: 'number', min: 0, step: '0.01', num: true })}</div>${N.field('due', t('crm.f.duedate'), { type: 'date' })}`,
      onSave(d, close) { if (!d.name.trim()) return { name: t('crm.e.name') };
        D.projects.unshift({ id: nextId(D.projects, 'PRY'), name: d.name.trim(), customer: d.customer || null, status: 'planificado', due: d.due || null, billing: d.billing, budget: Math.round((+d.budget || 0) * 100) }); close(); ok('crm.t.project'); } });
  }
  function openProject(p) {
    const s = prjStats(p);
    const dr = N.drawer({ title: p.id + ' · ' + p.name, wide: true, body: `<div style="display:flex;gap:8px;flex-wrap:wrap">${prjChip(p.status)}${prjOver(p) ? N.chip('danger', t('crm.f.overdue')) : ''}${N.chip('', t('bill.' + p.billing), true)}</div>
      <div class="mini"><div class="card"><div class="muted">${t('crm.col.progress')}</div><div class="v">${s.pct}%</div></div><div class="card"><div class="muted">${t('crm.col.hours')}</div><div class="v num">${hrs(s.mins)}</div></div><div class="card"><div class="muted">${t('crm.col.budget')}</div><div class="v num">${money(p.budget)}</div></div></div>
      <h3 style="margin:12px 0 6px">${t('crm.d.tasks')}</h3>${prjTasks(p).map((x) => `<div class="alloc"><span>${esc(x.title)}</span>${taskChip(x.status)}</div>`).join('') || '<p class="muted">—</p>'}
      <div id="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><span class="muted">${t('crm.a.setstatus')}:</span>${PS.filter((x) => x !== p.status).map((x) => `<button type="button" class="btn sm" data-st="${x}">${t('prj.' + x)}</button>`).join('')}</div>` });
    dr.el.querySelector('#acts').onclick = (e) => { const b = e.target.closest('[data-st]'); if (!b) return; const err = setProject(p, b.dataset.st); dr.close(); if (err) N.toast(t(err)); else ok('crm.t.status'); };
  }
  R['crm/proyectos'] = (node) => node.append(N.table({
    id: 'proyectos', rows: D.projects, id_of: (r) => r.id, sort: 'due', text: (r) => [r.id, r.name, custName(r.customer)].join(' '),
    cols: [
      { key: 'name', label: 'crm.col.project', value: (r) => r.name, render: (r) => `<div><b>${esc(r.name)}</b><br><small class="mono muted">${r.id}</small></div>` },
      { key: 'customer', label: 'crm.col.customer', value: (r) => custName(r.customer), render: (r) => esc(custName(r.customer)) },
      { key: 'status', label: 'col.status', value: (r) => r.status, render: (r) => prjChip(r.status) },
      { key: 'progress', label: 'crm.col.progress', value: (r) => prjStats(r).pct, render: (r) => { const s = prjStats(r); return `<div style="display:flex;align-items:center;gap:8px"><div class="meter"><i style="width:${s.pct}%"></i></div><span class="num">${s.done}/${s.total}</span></div>`; } },
      { key: 'due', label: 'crm.col.due', value: (r) => r.due || '9999', render: (r) => (prjOver(r) ? N.chip('danger', N.date(r.due)) : N.date(r.due)) },
      { key: 'hours', label: 'crm.col.hours', align: 'r', value: (r) => prjStats(r).mins, render: (r) => `<span class="num">${hrs(prjStats(r).mins)}</span>` },
      { key: 'billing', label: 'crm.col.billing', hidden: true, value: (r) => r.billing, render: (r) => t('bill.' + r.billing) },
      { key: 'budget', label: 'crm.col.budget', align: 'r', value: (r) => r.budget, render: (r) => `<span class="num">${money(r.budget)}</span>` }
    ],
    filters: [{ key: 'active', label: 'crm.f.active', fn: (r) => ['planificado', 'progreso'].includes(r.status) }, { key: 'over', label: 'crm.f.overdue', fn: prjOver }],
    newLabel: 'crm.new_project', onNew: projectForm, onRow: openProject, actions: [{ key: 'open', label: 'crm.d.tasks', icon: 'expand' }], onAction: (k, r) => openProject(r)
  }));
})(window.Nexo);
