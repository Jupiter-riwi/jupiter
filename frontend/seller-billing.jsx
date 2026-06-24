/* ============================================================
   SellerBilling — vista real conectada al backend de Stripe.
   Muestra: saldo de AT, plan activo, planes para suscribirse,
   packs de recarga (top-up), botón al Billing Portal y ledger.
   El backend devuelve { url } y el navegador redirige a Stripe
   Checkout (UI alojada por Stripe → cero PCI en el frontend).
   ============================================================ */
(function () {
  const { useState, useEffect } = React;

  const PLANS = [
    { id: 'starter', name: 'Starter', priceUsd: 29,  at: 200 },
    { id: 'growth',  name: 'Growth',  priceUsd: 79,  at: 650 },
    { id: 'pro',     name: 'Pro',     priceUsd: 199, at: 1800 },
    { id: 'scale',   name: 'Scale',   priceUsd: 499, at: 5000 },
  ];

  const TOPUPS = [
    { id: 's', name: 'Top-up S', priceUsd: 20,  at: 120 },
    { id: 'm', name: 'Top-up M', priceUsd: 50,  at: 350 },
    { id: 'l', name: 'Top-up L', priceUsd: 100, at: 800 },
  ];

  // tiny i18n helper that respects window.L if available, falls back to ES.
  const L = (es, en) => (window.L ? window.L(es, en) : es);

  function SellerBilling({ user }) {
    if (window.useLang) window.useLang();
    const [balance, setBalance] = useState(null);
    const [sub, setSub] = useState(null);
    const [ledger, setLedger] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');

    async function refresh() {
      setLoading(true);
      setError('');
      try {
        const [b, s, l] = await Promise.all([
          window.ApexAPI.getBillingBalance(),
          window.ApexAPI.getBillingSubscription(),
          window.ApexAPI.getBillingLedger(20),
        ]);
        setBalance(b);
        setSub(s);
        setLedger(Array.isArray(l) ? l : []);
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setLoading(false);
      }
    }

    useEffect(() => { refresh(); }, []);

    async function go(action, label) {
      setBusy(label);
      setError('');
      try {
        const { url } = await action();
        if (url) window.location.href = url;
        else throw new Error('no_url_returned');
      } catch (e) {
        setError(String(e.message || e));
        setBusy('');
      }
    }

    const includedRemaining = balance ? balance.included_remaining : 0;
    const purchasedRemaining = balance ? balance.purchased_remaining : 0;
    const totalRemaining = balance ? balance.total : 0;
    const includedQuota = sub && sub.included_at_quota ? sub.included_at_quota : 0;
    const usedPct = includedQuota ? Math.min(1, 1 - includedRemaining / includedQuota) : 0;
    const currentPlanId = sub && sub.plan ? sub.plan : null;
    const subStatus = sub ? sub.status : 'none';
    const periodEnd = sub && sub.current_period_end ? new Date(sub.current_period_end) : null;

    function fmtDate(d) {
      if (!d) return null;
      try { return d.toLocaleDateString(); } catch (_) { return String(d); }
    }

    return (
      <div className="s-stage">
        <div className="s-wrap" style={{ maxWidth: 900 }}>

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 300, letterSpacing: '-0.01em' }}>
              {L('Facturación', 'Billing')}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-30)', marginTop: 3 }}>
              {L('Plan, saldo de Apex Tokens y recargas. Pago seguro vía Stripe.',
                 'Plan, Apex Token balance and top-ups. Secure payments via Stripe.')}
            </div>
          </div>

          {error && (
            <div style={{ padding: 12, borderRadius: 10, marginBottom: 18,
              background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.3)',
              color: '#ff9595', fontSize: 12.5 }}>
              {L('Error', 'Error')}: {error}
            </div>
          )}

          {/* Saldo + plan */}
          <div className="glass" style={{ padding: '24px 28px', marginBottom: 22 }}>
            {loading ? (
              <div style={{ color: 'var(--ink-50)', fontSize: 13 }}>{L('Cargando…', 'Loading…')}</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--ink-40)', marginBottom: 8 }}>
                    {L('SALDO ACTUAL', 'CURRENT BALANCE')}
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 200, marginBottom: 4 }}>{totalRemaining} AT</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-50)' }}>
                    {includedRemaining} {L('incluidos', 'included')} · {purchasedRemaining} {L('comprados', 'purchased')}
                  </div>
                  {includedQuota > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.max(2, usedPct * 100)}%`,
                          background: usedPct > 0.8 ? '#ffb04d' : '#9ef5be', borderRadius: 99,
                          transition: 'width 700ms ease' }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-40)', marginTop: 6 }}>
                        {Math.round(usedPct * 100)}% {L('de la cuota mensual usada', 'of monthly quota used')}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--ink-40)', marginBottom: 8 }}>
                    {L('PLAN ACTIVO', 'ACTIVE PLAN')}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 300, marginBottom: 4, textTransform: 'capitalize' }}>
                    {currentPlanId || L('Sin plan', 'No plan')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-50)' }}>
                    {L('Estado', 'Status')}: <span className="mono">{subStatus}</span>
                    {periodEnd ? (
                      <> · {L('renueva el', 'renews on')} {fmtDate(periodEnd)}</>
                    ) : null}
                  </div>
                  {currentPlanId && (
                    <button className="btn" style={{ marginTop: 14 }}
                      onClick={() => go(() => window.ApexAPI.openBillingPortal(), 'portal')}
                      disabled={busy === 'portal'}>
                      {busy === 'portal'
                        ? L('Abriendo portal…', 'Opening portal…')
                        : L('Gestionar suscripción', 'Manage subscription')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Planes */}
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-40)', textTransform: 'uppercase', marginBottom: 12 }}>
            {L('Planes', 'Plans')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
            {PLANS.map(p => {
              const isCurrent = p.id === currentPlanId;
              return (
                <div key={p.id} className="glass" style={{
                  padding: '20px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  border: isCurrent ? '1px solid rgba(120,255,180,0.6)' : '1px solid rgba(255,255,255,0.07)',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{p.name}</div>
                    <div style={{ fontSize: 26, fontWeight: 200, marginBottom: 4 }}>${p.priceUsd}<span style={{ fontSize: 11, color: 'var(--ink-50)' }}>/mes</span></div>
                    <div style={{ fontSize: 12, color: 'var(--ink-50)' }}>{p.at} AT {L('incluidos', 'included')}</div>
                  </div>
                  <button className="btn" style={{ marginTop: 14 }}
                    disabled={isCurrent || busy === ('plan-' + p.id)}
                    onClick={() => go(() => window.ApexAPI.startSubscriptionCheckout(p.id), 'plan-' + p.id)}>
                    {isCurrent
                      ? L('Actual', 'Current')
                      : busy === ('plan-' + p.id)
                        ? L('Abriendo…', 'Opening…')
                        : L('Elegir', 'Choose')}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Top-ups */}
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-40)', textTransform: 'uppercase', marginBottom: 12 }}>
            {L('Recargas de AT', 'AT top-ups')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
            {TOPUPS.map(t => (
              <div key={t.id} className="glass" style={{ padding: '20px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{t.name}</div>
                <div style={{ fontSize: 22, fontWeight: 200, marginBottom: 4 }}>${t.priceUsd}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-50)', marginBottom: 14 }}>+{t.at} AT</div>
                <button className="btn" style={{ width: '100%' }}
                  disabled={busy === ('topup-' + t.id)}
                  onClick={() => go(() => window.ApexAPI.startTopupCheckout(t.id), 'topup-' + t.id)}>
                  {busy === ('topup-' + t.id)
                    ? L('Abriendo…', 'Opening…')
                    : L('Comprar', 'Buy')}
                </button>
              </div>
            ))}
          </div>

          {/* Ledger */}
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-40)', textTransform: 'uppercase', marginBottom: 12 }}>
            {L('Historial reciente', 'Recent activity')}
          </div>
          <div className="glass" style={{ padding: 18 }}>
            {loading ? (
              <div style={{ color: 'var(--ink-50)', fontSize: 13 }}>{L('Cargando…', 'Loading…')}</div>
            ) : ledger.length === 0 ? (
              <div style={{ color: 'var(--ink-50)', fontSize: 13 }}>
                {L('Sin movimientos todavía. Compra una recarga o suscríbete para empezar.',
                   'No activity yet. Buy a top-up or subscribe to get started.')}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {ledger.map((e, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5,
                    padding: '8px 0', borderBottom: i === ledger.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <span className="mono" style={{ color: 'var(--ink-50)', marginRight: 10 }}>{(e.created_at || '').slice(0,16).replace('T',' ')}</span>
                      <span style={{ textTransform: 'capitalize' }}>{e.reason}</span>
                      {e.ref_id ? <span className="mono" style={{ color: 'var(--ink-40)', marginLeft: 8 }}>{String(e.ref_id).slice(0,16)}</span> : null}
                    </div>
                    <div style={{ color: e.delta < 0 ? '#ff9595' : '#9ef5be' }}>
                      {e.delta > 0 ? '+' : ''}{e.delta} AT · {L('saldo', 'balance')} {e.balance_after}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    );
  }

  window.SellerBilling = SellerBilling;
})();
