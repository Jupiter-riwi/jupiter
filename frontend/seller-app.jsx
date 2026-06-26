const { useState, useEffect } = React;
const { PublicTopBar, PublicLanding, ScenarioSelector, RecordingStage, SellerResults } = window;

/* ============================================================
   APEX VISION — app conectada al API Gateway real
   Flujo: login → landing → selector → grabacion real → resultados reales
   ============================================================ */
function ApexApp() {
  const [page, setPage]           = useState('login');   // login | landing | scenario | results
  const [scenario, setScenario]   = useState(null);
  const [recording, setRecording] = useState(false);
  const [evaluationData, setEvalData] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // ── auth state ────────────────────────────────────────────────────────────
  const [email, setEmail]         = useState('seller.demo@jupiter.local');
  const [password, setPassword]   = useState('Demo1234!');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');

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

  // ── login & register ────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginBusy(true);
    try {
      if (isRegistering) {
        if (!name.trim()) throw new Error('El nombre es requerido');
        await window.ApexAPI.register(name, email, password, 'SELLER');
      } else {
        await window.ApexAPI.login(email, password);
      }
      setPage('landing');
    } catch (err) {
      setLoginError(err.message || 'Error al conectar');
    } finally {
      setLoginBusy(false);
    }
  };

  // ── navigation ────────────────────────────────────────────────────────────
  const goLanding   = () => { setPage('landing'); setScenario(null); setEvalData(null); };
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
  const handleLogout = () => { window.ApexAPI.logout(); setPage('login'); };

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

  // ── login screen ──────────────────────────────────────────────────────────
  if (!authChecked) return null;

  if (page === 'login') {
    return (
      <div id="app">
        <div className="s-shell">
          <div style={{padding:'40px 24px'}}></div>
          <div className="s-stage">
            <div className="s-wrap" style={{maxWidth:420}}>
              <div className="glass" style={{padding:32,textAlign:'center'}}>
                <div style={{fontSize:28,fontWeight:200,letterSpacing:'-0.02em',marginBottom:8}}>Apex Vision</div>
                <div className="mono" style={{fontSize:10,color:'var(--ink-40)',marginBottom:28,letterSpacing:'0.2em',textTransform:'uppercase'}}>
                  Evaluacion comercial con IA
                </div>
                <form onSubmit={handleLogin} style={{display:'grid',gap:12,textAlign:'left'}}>
                  {isRegistering && (
                    <input
                      type="text" value={name} onChange={e => setName(e.target.value)}
                      placeholder="Nombre completo" required
                      style={{width:'100%',padding:'10px 14px',borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:13}}
                    />
                  )}
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="email" required
                    style={{width:'100%',padding:'10px 14px',borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:13}}
                  />
                  <input
                    type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="password" required
                    style={{width:'100%',padding:'10px 14px',borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:13}}
                  />
                  <button type="submit" className="btn btn-primary" disabled={loginBusy} style={{width:'100%',justifyContent:'center',padding:'13px'}}>
                    {loginBusy ? 'Conectando...' : (isRegistering ? 'Crear cuenta' : 'Ingresar')}
                  </button>
                  {loginError && <div className="mono" style={{fontSize:10.5,color:'#fca5a5',lineHeight:1.5,marginTop:4}}>{loginError}</div>}
                  <div style={{textAlign:'center', marginTop:10}}>
                    <a href="#" onClick={(e) => { e.preventDefault(); setIsRegistering(!isRegistering); setLoginError(''); }} style={{color:'var(--ink-50)', fontSize:12}}>
                      {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
                    </a>
                  </div>
                </form>
                <div className="mono" style={{marginTop:20,fontSize:10,color:'var(--ink-30)',letterSpacing:'0.15em'}}>
                  API Gateway: localhost:8080
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── main app ──────────────────────────────────────────────────────────────
  return (
    <div id="app">
      <div className="s-shell">
        <PublicTopBar onHome={goLanding} onSection={goSection} />
        <div style={{position:'absolute',top:12,right:24,zIndex:10}}>
          <button className="btn" onClick={handleLogout} style={{fontSize:10,opacity:0.6}}>Salir</button>
        </div>

        {page === 'landing'   && <PublicLanding  onStart={goScenario} />}
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
