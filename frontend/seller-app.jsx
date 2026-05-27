const { useState, useEffect } = React;
const { PublicTopBar, PublicLanding, ScenarioSelector, RecordingStage, SellerResults, SIcon, ApexLogo, SellerDashboard, SellerProgress, SellerCoaching, SellerPlan, SellerSettings, SellerProfile, SellerMainDashboard } = window;

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';

/* ============================================================
   APEX VISION — app conectada al API Gateway real
   Flujo: login → landing → selector → grabacion real → resultados reales
   ============================================================ */
function ApexApp() {
  const [page, setPage]           = useState('login');   // login | register | landing | scenario | results
  const [tab, setTab]             = useState('dashboard'); // dashboard | home | progress | coaching | plan | settings
  const [scenario, setScenario]   = useState(null);
  const [recording, setRecording] = useState(false);
  const [evaluationData, setEvalData] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // ── auth state ────────────────────────────────────────────────────────────
  const [email, setEmail]           = useState('seller.demo@jupiter.local');
  const [password, setPassword]     = useState('Demo1234!');
  const [showPass, setShowPass]     = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy]   = useState(false);
  const [user, setUser]             = useState(null);

  // ── register state ────────────────────────────────────────────────────────
  const [regEmail, setRegEmail]         = useState('');
  const [regPassword, setRegPassword]   = useState('');
  const [regConfirm, setRegConfirm]     = useState('');
  const [showRegPass, setShowRegPass]   = useState(false);
  const [regError, setRegError]         = useState('');
  const [regBusy, setRegBusy]           = useState(false);

  // ── always start at login for fresh token ─────────────────────────────────
  useEffect(() => {
    window.ApexAPI.logout();
    setAuthChecked(true);
    const onExpired = () => {
      setLoginError('Tu sesion expiro. Volve a iniciar sesion.');
      setPage('login');
      setScenario(null);
      setRecording(false);
      setEvalData(null);
    };
    window.addEventListener('apex:session-expired', onExpired);
    return () => window.removeEventListener('apex:session-expired', onExpired);
  }, []);

  // ── login ─────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginBusy(true);
    try {
      await window.ApexAPI.login(email, password);
      try {
        const me = await window.ApexAPI.getMe();
        setUser(me);
      } catch (_) {}
      setPage('landing');
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('401') || msg.includes('Login failed')) {
        setLoginError('Email o contraseña incorrectos.');
      } else {
        setLoginError('No se pudo conectar con el servidor. Verificá tu conexión.');
      }
    } finally {
      setLoginBusy(false);
    }
  };

  // ── register ──────────────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    if (regPassword !== regConfirm) { setRegError('Las contraseñas no coinciden.'); return; }
    if (regPassword.length < 6) { setRegError('La contraseña debe tener al menos 6 caracteres.'); return; }
    setRegBusy(true);
    try {
      await window.ApexAPI.register(regEmail, regPassword, DEMO_TENANT_ID);
      try { const me = await window.ApexAPI.getMe(); setUser(me); } catch (_) {}
      setPage('landing');
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('already registered')) {
        setRegError('Ese email ya tiene una cuenta. Iniciá sesión.');
      } else {
        setRegError('No se pudo crear la cuenta. Verificá tu conexión.');
      }
    } finally {
      setRegBusy(false);
    }
  };

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

  // ── shared card shell ─────────────────────────────────────────────────────
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
                Evaluación comercial con IA
              </div>
              {children}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── login / register screens ───────────────────────────────────────────────
  if (!authChecked) return null;

  const inputStyle = {width:'100%',padding:'11px 14px',borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:13,boxSizing:'border-box'};
  const Spinner = () => <span style={{width:13,height:13,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',display:'inline-block',animation:'spin 0.7s linear infinite'}} />;
  const ErrorBox = ({ msg }) => msg ? (
    <div style={{display:'flex',alignItems:'flex-start',gap:8,padding:'10px 12px',borderRadius:7,background:'rgba(252,165,165,0.08)',border:'1px solid rgba(252,165,165,0.2)'}}>
      <span style={{color:'#fca5a5',fontSize:13,marginTop:1}}>!</span>
      <span className="mono" style={{fontSize:11,color:'#fca5a5',lineHeight:1.55}}>{msg}</span>
    </div>
  ) : null;

  if (page === 'login') {
    return (
      <AuthCard>
        <form onSubmit={handleLogin} style={{display:'grid',gap:12,textAlign:'left'}}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" required autoComplete="email" style={inputStyle} />
          <div style={{position:'relative'}}>
            <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña" required autoComplete="current-password"
              style={{...inputStyle, padding:'11px 42px 11px 14px'}} />
            <button type="button" onClick={() => setShowPass(v => !v)}
              style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--ink-40)',padding:4,display:'flex',alignItems:'center'}}>
              <SIcon name={showPass ? 'eye-off' : 'eye'} size={15} stroke={1.5} />
            </button>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loginBusy}
            style={{width:'100%',justifyContent:'center',padding:'13px',opacity:loginBusy?0.7:1,transition:'opacity 150ms'}}>
            {loginBusy ? <span style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}><Spinner /> Conectando…</span> : 'Ingresar'}
          </button>
          <ErrorBox msg={loginError} />
        </form>
        <div style={{marginTop:20,textAlign:'center'}}>
          <span style={{fontSize:12,color:'var(--ink-40)'}}>¿No tenés cuenta? </span>
          <button onClick={() => { setLoginError(''); setPage('register'); }}
            style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'var(--ink-70)',textDecoration:'underline',textUnderlineOffset:3,padding:0}}>
            Registrate
          </button>
        </div>
      </AuthCard>
    );
  }

  if (page === 'register') {
    return (
      <AuthCard>
        <form onSubmit={handleRegister} style={{display:'grid',gap:12,textAlign:'left'}}>
          <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
            placeholder="Email" required autoComplete="email" style={inputStyle} />
          <div style={{position:'relative'}}>
            <input type={showRegPass ? 'text' : 'password'} value={regPassword} onChange={e => setRegPassword(e.target.value)}
              placeholder="Contraseña (mín. 6 caracteres)" required autoComplete="new-password"
              style={{...inputStyle, padding:'11px 42px 11px 14px'}} />
            <button type="button" onClick={() => setShowRegPass(v => !v)}
              style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--ink-40)',padding:4,display:'flex',alignItems:'center'}}>
              <SIcon name={showRegPass ? 'eye-off' : 'eye'} size={15} stroke={1.5} />
            </button>
          </div>
          <input type="password" value={regConfirm} onChange={e => setRegConfirm(e.target.value)}
            placeholder="Confirmá la contraseña" required autoComplete="new-password" style={inputStyle} />
          <button type="submit" className="btn btn-primary" disabled={regBusy}
            style={{width:'100%',justifyContent:'center',padding:'13px',opacity:regBusy?0.7:1,transition:'opacity 150ms'}}>
            {regBusy ? <span style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}><Spinner /> Creando cuenta…</span> : 'Crear cuenta'}
          </button>
          <ErrorBox msg={regError} />
        </form>
        <div style={{marginTop:20,textAlign:'center'}}>
          <span style={{fontSize:12,color:'var(--ink-40)'}}>¿Ya tenés cuenta? </span>
          <button onClick={() => { setRegError(''); setPage('login'); }}
            style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'var(--ink-70)',textDecoration:'underline',textUnderlineOffset:3,padding:0}}>
            Iniciá sesión
          </button>
        </div>
      </AuthCard>
    );
  }

  // ── nav autenticada ──────────────────────────────────────────────────────
  const AuthTopBar = () => {
    const displayName = user?.name || user?.email?.split('@')[0] || 'Vendedor';
    const isMain = page === 'landing';
    const TABS = [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'home',      label: 'Evaluaciones' },
      { id: 'progress',  label: 'Progreso' },
      { id: 'coaching',  label: 'Coaching IA' },
      { id: 'plan',      label: 'Mi Plan' },
      { id: 'profile',   label: 'Perfil' },
      { id: 'settings',  label: 'Configuración' },
    ];
    return (
      <div style={{backdropFilter:'blur(20px) saturate(140%)', background:'rgba(10,10,12,0.55)', borderBottom:'1px solid rgba(255,255,255,0.07)', position:'relative', zIndex:5}}>
        {/* fila logo + usuario */}
        <div style={{display:'flex',alignItems:'center',height:56,padding:'0 28px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}} onClick={goLanding}>
            <ApexLogo size={36} />
            <div style={{lineHeight:1}}>
              <div style={{fontSize:13,fontWeight:500,letterSpacing:'0.18em',color:'var(--ink-90)'}}>APEX</div>
              <div style={{fontSize:9,letterSpacing:'0.28em',color:'var(--ink-50)',marginTop:1}}>VISION</div>
            </div>
          </div>
          <div style={{flex:1}} />
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div onClick={() => { setPage('landing'); setTab('profile'); }}
              style={{display:'flex',alignItems:'center',gap:7,padding:'6px 12px',borderRadius:999,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',cursor:'pointer',transition:'background 150ms'}}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.09)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}>
              <SIcon name="user" size={13} stroke={1.5} />
              <span style={{fontSize:12,color:'var(--ink-70)',letterSpacing:'0.02em'}}>{displayName}</span>
            </div>
            <button className="btn" onClick={handleLogout}
              style={{display:'flex',alignItems:'center',gap:6,fontSize:11.5,padding:'6px 14px',opacity:0.75}}>
              <SIcon name="logout" size={13} stroke={1.5} />
              Salir
            </button>
          </div>
        </div>
        {/* fila tabs — centradas */}
        {isMain && (
          <div style={{display:'flex',gap:2,padding:'0 24px', borderTop:'1px solid rgba(255,255,255,0.05)', justifyContent:'center'}}>
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

        {page === 'landing'   && tab === 'dashboard' && <SellerMainDashboard user={user} onStart={goScenario} onGoTab={setTab} />}
        {page === 'landing'   && tab === 'home'     && <SellerDashboard user={user} onStart={goScenario} />}
        {page === 'landing'   && tab === 'progress' && <SellerProgress user={user} />}
        {page === 'landing'   && tab === 'coaching' && <SellerCoaching user={user} onGoToPlan={() => setTab('plan')} />}
        {page === 'landing'   && tab === 'plan'     && <SellerPlan user={user} />}
        {page === 'landing'   && tab === 'profile'  && <SellerProfile user={user} onGoTab={setTab} />}
        {page === 'landing'   && tab === 'settings' && <SellerSettings user={user} onUserUpdate={u => setUser(u)} />}
        {page === 'scenario'  && <ScenarioSelector onSelect={handleSelectScenario} onBack={goLanding} />}
        {page === 'results'   && <SellerResults scenario={scenario} evaluationData={evaluationData} onBack={goLanding} onPractice={goScenario} />}
      </div>

      {recording && scenario && (
        <RecordingStage
          question={scenario}
          onClose={handleCloseRec}
          onComplete={handleFinishRec}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ApexApp />);
