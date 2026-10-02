/* Formato de dinero y fechas. Los importes se guardan en unidades menores (centavos) en la moneda base (ARS). */
(function (N) {
  // Tasas de DEMOSTRACIÓN (1 unidad de moneda = X ARS). En producción salen de la tabla exchange_rates.
  N.CURRENCIES = { ARS: { rate: 1, name: 'Peso argentino' }, USD: { rate: 1050, name: 'Dólar' }, EUR: { rate: 1150, name: 'Euro' }, BRL: { rate: 200, name: 'Real' } };
  N.money = (minor, opts = {}) => {
    const cur = opts.currency || N.state.currency;
    const v = (minor / 100) / N.CURRENCIES[cur].rate;
    return new Intl.NumberFormat(N.state.lang, { style: 'currency', currency: cur, maximumFractionDigits: opts.compact ? 1 : 2, minimumFractionDigits: opts.compact ? 0 : 2, notation: opts.compact ? 'compact' : 'standard' }).format(v);
  };
  N.date = (iso, o = { day: '2-digit', month: 'short', year: 'numeric' }) => iso ? new Intl.DateTimeFormat(N.state.lang, o).format(new Date(iso + 'T12:00:00')) : '—';
  N.initials = (s) => s.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  N.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
})(window.Nexo);
