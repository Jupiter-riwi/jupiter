const { useState, useEffect } = React;
const { PublicTopBar, PublicLanding, ScenarioSelector, RecordingStage, SellerResults, SIcon, ApexLogo, SellerDashboard, SellerProgress, SellerCoaching, SellerPlan, SellerBilling, SellerSettings, SellerProfile, SellerMainDashboard, LiveRoom, LangToggle } = window;
const T = (k) => window.I18N.t(k);

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';

/* ============================================================
   NUEVA EVALUACIÓN — selector: pitch en vivo · entrevista · grabar
   ============================================================ */
function NewEvalChooser({ onLive, onRecord, onBack }) {
  window.useLang(); const L = window.L;
  const OPTIONS = [
    { id: 'pitch', icon: 'sparkle', accent: '#60a5fa',
      title: L('Pitch en vivo', 'Live pitch'),
      desc: L('Presenta a un comprador IA que te escucha, repregunta y objeta en tiempo real. Con cámara y análisis de lenguaje corporal.', 'Pitch to an AI buyer that listens, follows up and objects in real time. With camera and body-language analysis.'),
      badge: L('NUEVO', 'NEW'), onClick: () => onLive('presentacion') },
    { id: 'interview', icon: 'user', accent: '#34d399',
      title: L('Entrevista en vivo', 'Live interview'),
      desc: L('Practica una entrevista laboral con un entrevistador IA (reclutador, hiring manager, líder técnico…). Con cámara.', 'Practice a job interview with an AI interviewer (recruiter, hiring manager, tech lead…). With camera.'),
      badge: L('NUEVO', 'NEW'), onClick: () => onLive('entrevista') },
    { id: 'record', icon: 'video', accent: 'rgba(255,255,255,0.4)',
      title: L('Grabar y subir', 'Record & upload'),
      desc: L('El modo clásico: grabas un pitch de 60–90s y la IA lo analiza (cuerpo, voz, discurso). Sin conversación.', 'The classic mode: record a 60–90s pitch and the AI analyzes it (body, voice, delivery). No conversation.'),
      badge: null, onClick: onRecord },
  ];
  return (
    <div className="s-stage">
      <div className="s-wrap" style={{ maxWidth: 760, padding: '24px' }}>
        <button className="btn" onClick={onBack} style={{ marginBottom: 22 }}>{L('← Volver', '← Back')}</button>
        <h1 style={{ fontSize: 28, fontWeight: 200, letterSpacing: '-0.02em', marginBottom: 6 }}>{L('Nueva evaluación', 'New evaluation')}</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-50)', lineHeight: 1.6, marginBottom: 28 }}>
          {L('Elige cómo quieres practicar tu comunicación comercial hoy.', 'Choose how you want to practice your sales communication today.')}
        </p>
        <div style={{ display: 'grid', gap: 14 }}>
          {OPTIONS.map(o => (
            <div key={o.id} onClick={o.onClick}
              style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '20px 22px', borderRadius: 14, cursor: 'pointer',
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${o.accent}44`, transition: 'all 150ms' }}
              onMouseEnter={e => { e.currentTarget.style.background = `${o.accent}14`; e.currentTarget.style.borderColor = `${o.accent}99`; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = `${o.accent}44`; }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${o.accent}1f`, color: o.accent }}>
                <SIcon name={o.icon} size={22} stroke={1.4} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15.5, fontWeight: 400, color: 'var(--ink-90)' }}>{o.title}</span>
                  {o.badge && <span className="mono" style={{ fontSize: 8.5, letterSpacing: '0.14em', padding: '2px 7px', borderRadius: 5, background: `${o.accent}22`, color: o.accent }}>{o.badge}</span>}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-50)', lineHeight: 1.5 }}>{o.desc}</div>
              </div>
              <SIcon name="arrow" size={16} stroke={1.4} style={{ color: 'var(--ink-30)', flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── shared auth components ──────────────────────────────────────────────────
const AuthCard = ({ children }) => (
  <div id="app">
    <div className="s-shell">
      <div style={{padding:'40px 24px'}}></div>
      <div className="s-stage">
        <div className="s-wrap" style={{maxWidth:420}}>
          <div className="glass" style={{padding:36,textAlign:'center'}}>
            <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
              <ApexLogo size={44} />
            </div>
            <div style={{fontSize:22,fontWeight:200,letterSpacing:'-0.02em',marginBottom:4}}>Apex Vision</div>
            <div className="mono" style={{fontSize:10,color:'var(--ink-40)',marginBottom:28,letterSpacing:'0.2em',textTransform:'uppercase'}}>
              {T('auth.tagline')}
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const inputStyle = {width:'100%',padding:'11px 14px',borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:13,boxSizing:'border-box'};
const Spinner = () => <span style={{width:13,height:13,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',display:'inline-block',animation:'spin 0.7s linear infinite'}} />;
const ErrorBox = ({ msg }) => msg ? (
  <div style={{display:'flex',alignItems:'flex-start',gap:8,padding:'10px 12px',borderRadius:7,background:'rgba(252,165,165,0.08)',border:'1px solid rgba(252,165,165,0.2)'}}>
    <span style={{color:'#fca5a5',fontSize:13,marginTop:1}}>!</span>
    <span className="mono" style={{fontSize:11,color:'#fca5a5',lineHeight:1.55}}>{msg}</span>
  </div>
) : null;

/* ============================================================
   LOGIN FORM — isolated React.memo component
   Keystrokes re-render ONLY this subtree, not ApexApp.
   ============================================================ */
const LoginForm = React.memo(function LoginForm({ onSuccess, onGoRegister, expiredMsg }) {
  const [email, setEmail]       = useState('seller.demo@jupiter.local');
  const [password, setPassword] = useState('Demo1234!');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState(expiredMsg || '');
  const [busy, setBusy]         = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await window.ApexAPI.login(email, password);
      let me = null;
      try { me = await window.ApexAPI.getMe(); } catch (_) {}
      onSuccess(me);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('401') || msg.includes('Login failed')) {
        setError(T('auth.err.badCreds'));
      } else {
        setError(T('auth.err.server'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form onSubmit={handleLogin} style={{display:'grid',gap:12,textAlign:'left'}}>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder={T('auth.email')} required autoComplete="email" style={inputStyle} />
        <div style={{position:'relative'}}>
          <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
            placeholder={T('auth.password')} required autoComplete="current-password"
            style={{...inputStyle, padding:'11px 42px 11px 14px'}} />
          <button type="button" onClick={() => setShowPass(v => !v)}
            style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--ink-40)',padding:4,display:'flex',alignItems:'center'}}>
            <SIcon name={showPass ? 'eye-off' : 'eye'} size={15} stroke={1.5} />
          </button>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}
          style={{width:'100%',justifyContent:'center',padding:'13px',opacity:busy?0.7:1,transition:'opacity 150ms'}}>
          {busy ? <span style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}><Spinner /> {T('auth.connecting')}</span> : T('auth.login')}
        </button>
        <ErrorBox msg={error} />
      </form>
      <div style={{marginTop:20,textAlign:'center'}}>
        <span style={{fontSize:12,color:'var(--ink-40)'}}>{T('auth.noAccount')} </span>
        <button onClick={onGoRegister}
          style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'var(--ink-70)',textDecoration:'underline',textUnderlineOffset:3,padding:0}}>
          {T('auth.register')}
        </button>
      </div>
    </>
  );
});

/* ============================================================
   REGISTER FORM — isolated React.memo component
   ============================================================ */
const RegisterForm = React.memo(function RegisterForm({ onSuccess, onGoLogin }) {
  const [regEmail, setRegEmail]       = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm]   = useState('');
  const [regCode, setRegCode]         = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [error, setError]             = useState('');
  const [busy, setBusy]               = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (regPassword !== regConfirm) { setError(T('auth.err.mismatch')); return; }
    if (regPassword.length < 6) { setError(T('auth.err.short')); return; }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/.test(regPassword)) { setError(T('auth.err.weak')); return; }
    if (!regCode.trim()) { setError(T('auth.err.invalidCode')); return; }
    setBusy(true);
    try {
      await window.ApexAPI.register(regEmail, regPassword, regCode);
      let me = null;
      try { me = await window.ApexAPI.getMe(); } catch (_) {}
      onSuccess(me);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('already registered')) {
        setError(T('auth.err.exists'));
      } else if (msg.includes('registration code')) {
        setError(T('auth.err.invalidCode'));
      } else {
        setError(T('auth.err.create'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form onSubmit={handleRegister} style={{display:'grid',gap:12,textAlign:'left'}}>
        <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
          placeholder={T('auth.email')} required autoComplete="email" style={inputStyle} />
        <div style={{position:'relative'}}>
          <input type={showRegPass ? 'text' : 'password'} value={regPassword} onChange={e => setRegPassword(e.target.value)}
            placeholder={T('auth.passwordMin')} required autoComplete="new-password"
            style={{...inputStyle, padding:'11px 42px 11px 14px'}} />
          <button type="button" onClick={() => setShowRegPass(v => !v)}
            style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--ink-40)',padding:4,display:'flex',alignItems:'center'}}>
            <SIcon name={showRegPass ? 'eye-off' : 'eye'} size={15} stroke={1.5} />
          </button>
        </div>
        <input type="password" value={regConfirm} onChange={e => setRegConfirm(e.target.value)}
          placeholder={T('auth.confirm')} required autoComplete="new-password" style={inputStyle} />
        <input type="text" value={regCode} onChange={e => setRegCode(e.target.value)}
          placeholder={T('auth.registrationCode')} required style={inputStyle} />
        <button type="submit" className="btn btn-primary" disabled={busy}
          style={{width:'100%',justifyContent:'center',padding:'13px',opacity:busy?0.7:1,transition:'opacity 150ms'}}>
          {busy ? <span style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}><Spinner /> {T('auth.creating')}</span> : T('auth.createAccount')}
        </button>
        <ErrorBox msg={error} />
      </form>
      <div style={{marginTop:20,textAlign:'center'}}>
        <span style={{fontSize:12,color:'var(--ink-40)'}}>{T('auth.haveAccount')} </span>
        <button onClick={onGoLogin}
          style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'var(--ink-70)',textDecoration:'underline',textUnderlineOffset:3,padding:0}}>
          {T('auth.signin')}
        </button>
      </div>
    </>
  );
});

function ApexApp() {
  const [page, setPage]           = useState('login');   // login | register | landing | scenario | results
  const [tab, setTab]             = useState('dashboard'); // dashboard | home | progress | coaching | plan | settings
  const [scenario, setScenario]   = useState(null);
  const [recording, setRecording] = useState(false);
  const [liveMode, setLiveMode]   = useState(null);   // null | 'presentacion' | 'entrevista'
  const lang = window.useLang();
  const [evaluationData, setEvalData] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser]             = useState(null);
  const [expiredMsg, setExpiredMsg] = useState('');

  // ── restore session on load ───────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const hasToken = await window.ApexAPI.restoreToken();
      if (hasToken && await window.ApexAPI.ensureValidToken()) {
        setPage('landing');
      } else {
        window.ApexAPI.logout();
      }
      setAuthChecked(true);
    })();
    const onExpired = () => {
      setExpiredMsg(T('auth.expired'));
      setPage('login');
      setScenario(null);
      setRecording(false);
      setEvalData(null);
    };
    window.addEventListener('apex:session-expired', onExpired);
    return () => window.removeEventListener('apex:session-expired', onExpired);
  }, []);





  // ── navigation ────────────────────────────────────────────────────────────
  const goLanding   = () => { setPage('landing'); setTab('dashboard'); setScenario(null); setEvalData(null); };
  const goSection   = (id) => {
    setPage('landing'); setScenario(null); setEvalData(null);
    setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        const cs = getComputedStyle(parent);
        if (/(auto|scroll)/.test(cs.overflowY)) break;
        parent = parent.parentElement;
      }
      if (parent && parent !== document.body) {
        const offset = el.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop - 20;
        parent.scrollTo({ top: offset, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 20, behavior: 'smooth' });
      }
    }, 50);
  };
  const goScenario  = () =>  setPage('scenario');
  const goNewEval   = () =>  setPage('chooser');   // selector: pitch en vivo / entrevista / grabar
  const openLive    = (m) => { setPage('landing'); setLiveMode(m); };
  const handleLogout = () => { window.ApexAPI.logout(); setUser(null); setPage('login'); };

  const handleSelectScenario = (s) => {
    setScenario(s);
    setRecording(true);
  };

  const handleCloseRec  = () => setRecording(false);
  const handleFinishRec = (evalData) => {
    setRecording(false);
    setEvalData(evalData);
    setPage('results');
  };

  // ── login / register screens ───────────────────────────────────────────────
  if (!authChecked) return null;

  const handleAuthSuccess = (me) => { setUser(me); setPage('landing'); };

  if (page === 'login') {
    return (
      <AuthCard>
        <LoginForm
          expiredMsg={expiredMsg}
          onSuccess={handleAuthSuccess}
          onGoRegister={() => { setExpiredMsg(''); setPage('register'); }}
        />
      </AuthCard>
    );
  }

  if (page === 'register') {
    return (
      <AuthCard>
        <RegisterForm
          onSuccess={handleAuthSuccess}
          onGoLogin={() => setPage('login')}
        />
      </AuthCard>
    );
  }

  // ── nav autenticada ──────────────────────────────────────────────────────
  const AuthTopBar = () => {
    const displayName = user?.name || user?.email?.split('@')[0] || 'Vendedor';
    const isMain = page === 'landing';
    const TABS = [
      { id: 'dashboard', label: T('nav.dashboard') },
      { id: 'home',      label: T('nav.evaluations') },
      { id: 'progress',  label: T('nav.progress') },
      { id: 'coaching',  label: T('nav.coaching') },
      { id: 'plan',      label: T('nav.plan') },
      { id: 'profile',   label: T('nav.profile') },
      { id: 'settings',  label: T('nav.settings') },
    ];
    return (
      <div style={{backdropFilter:'blur(20px) saturate(140%)', background:'rgba(10,10,12,0.55)', borderBottom:'1px solid rgba(255,255,255,0.07)', position:'relative', zIndex:5}}>
        {/* fila logo + usuario */}
        <div className="auth-topbar-row" style={{display:'flex',alignItems:'center',height:56,padding:'0 28px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}} onClick={goLanding}>
            <ApexLogo size={36} />
            <div style={{lineHeight:1}}>
              <div style={{fontSize:13,fontWeight:500,letterSpacing:'0.18em',color:'var(--ink-90)'}}>APEX</div>
              <div style={{fontSize:9,letterSpacing:'0.28em',color:'var(--ink-50)',marginTop:1}}>VISION</div>
            </div>
          </div>
          <div style={{flex:1}} />
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {LangToggle && <LangToggle />}
            <div onClick={() => { setPage('landing'); setTab('profile'); }}
              style={{display:'flex',alignItems:'center',gap:7,padding:'6px 12px',borderRadius:999,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',cursor:'pointer',transition:'background 150ms'}}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.09)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}>
              <SIcon name="user" size={13} stroke={1.5} />
              <span className="auth-username" style={{fontSize:12,color:'var(--ink-70)',letterSpacing:'0.02em'}}>{displayName}</span>
            </div>
            <button className="btn" onClick={handleLogout}
              style={{display:'flex',alignItems:'center',gap:6,fontSize:11.5,padding:'6px 14px',opacity:0.75}}>
              <SIcon name="logout" size={13} stroke={1.5} />
              <span className="auth-logout-label">{T('nav.logout')}</span>
            </button>
          </div>
        </div>
        {/* fila tabs — centradas, scrollea horizontal en mobile */}
        {isMain && (
          <div className="auth-tabs-row" style={{display:'flex',gap:2,padding:'0 24px', borderTop:'1px solid rgba(255,255,255,0.05)', justifyContent:'center'}}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  background:'none',border:'none',cursor:'pointer',padding:'10px 16px',fontSize:12.5,
                  color: tab===t.id ? 'var(--ink-90)' : 'var(--ink-40)',
                  borderBottom: tab===t.id ? '2px solid rgba(255,255,255,0.7)' : '2px solid transparent',
                  marginBottom:-1,letterSpacing:'0.02em',transition:'color 150ms',
                }}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── main app ──────────────────────────────────────────────────────────────
  return (
    <div id="app">
      <div className="s-shell">
        <AuthTopBar />

        {page === 'landing'   && tab === 'dashboard' && <SellerMainDashboard user={user} onStart={goNewEval} onGoTab={setTab} />}
        {page === 'landing'   && tab === 'home'     && <SellerDashboard user={user} onStart={goNewEval} />}
        {page === 'landing'   && tab === 'progress' && <SellerProgress user={user} />}
        {page === 'landing'   && tab === 'coaching' && <SellerCoaching user={user} onGoToPlan={() => setTab('plan')} />}
        {page === 'landing'   && tab === 'plan'     && <SellerBilling user={user} />}
        {page === 'landing'   && tab === 'profile'  && <SellerProfile user={user} onGoTab={setTab} />}
        {page === 'landing'   && tab === 'settings' && <SellerSettings user={user} onUserUpdate={u => setUser(u)} />}
        {page === 'chooser'   && <NewEvalChooser onLive={openLive} onRecord={goScenario} onBack={goLanding} />}
        {page === 'scenario'  && <ScenarioSelector onSelect={handleSelectScenario} onBack={goNewEval} />}
        {page === 'results'   && <SellerResults scenario={scenario} evaluationData={evaluationData} onBack={goLanding} onPractice={goNewEval} />}
      </div>

      {recording && scenario && (
        <RecordingStage
          question={scenario}
          onClose={handleCloseRec}
          onComplete={handleFinishRec}
        />
      )}

      {/* Floating entries: dos productos en vivo (ventas · entrevista) */}
      {page === 'landing' && !liveMode && (
        <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
          <button onClick={() => setLiveMode('entrevista')} title={T('entry.live.interviewDesc')}
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 18px', borderRadius: 999,
              border: '1px solid rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.14)', backdropFilter: 'blur(12px)',
              color: '#a7f3d0', cursor: 'pointer', fontSize: 12.5, boxShadow: '0 8px 30px rgba(52,211,153,0.2)' }}>
            <SIcon name="user" size={15} /> {T('entry.live.interview')}
          </button>
          <button onClick={() => setLiveMode('presentacion')} title={T('entry.live.salesDesc')}
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 20px', borderRadius: 999,
              border: '1px solid rgba(96,165,250,0.4)', background: 'rgba(96,165,250,0.16)', backdropFilter: 'blur(12px)',
              color: '#bfdbfe', cursor: 'pointer', fontSize: 13, boxShadow: '0 8px 30px rgba(96,165,250,0.25)' }}>
            <SIcon name="sparkle" size={16} /> {T('entry.live.sales')}
          </button>
        </div>
      )}
      {liveMode && LiveRoom && <LiveRoom initialMode={liveMode} onClose={() => setLiveMode(null)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ApexApp />);
