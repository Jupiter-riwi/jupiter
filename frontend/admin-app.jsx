const { useState, useEffect, useRef } = React;
const { SIcon, AVSpark, ApexLogo } = window;

/* ============================================================
   ADMIN DASHBOARD — Jupiter Sales Evaluator
   Vista del admin de cliente (HU-4.4): ve a todo su equipo de
   vendedores, identifica quién necesita coaching y en qué áreas.
   ============================================================ */

const TEAM = [
  { id: 1, name: 'Mariana Aimar',     role: 'Senior',     evals: 24, score: 84, trend: '+6', skills: [88,82,86,75,88], status: 'on-track', last: 'hoy 16:08' },
  { id: 2, name: 'Federico Lozada',   role: 'Senior',     evals: 22, score: 81, trend: '+3', skills: [80,84,78,82,79], status: 'on-track', last: 'hoy 11:22' },
  { id: 3, name: 'Carolina Méndez',   role: 'Mid',        evals: 18, score: 78, trend: '+8', skills: [82,76,72,80,80], status: 'improving', last: 'ayer 18:40' },
  { id: 4, name: 'Diego Sosa',        role: 'Senior',     evals: 26, score: 76, trend: '−2', skills: [70,75,82,78,75], status: 'watch', last: 'ayer 14:05' },
  { id: 5, name: 'Lucía Fernández',   role: 'Mid',        evals: 14, score: 72, trend: '+4', skills: [75,68,74,72,71], status: 'on-track', last: 'hoy 09:15' },
  { id: 6, name: 'Tomás Iriarte',     role: 'Junior',     evals: 9,  score: 68, trend: '+11', skills: [70,65,72,66,67], status: 'improving', last: 'hoy 10:48' },
  { id: 7, name: 'Sofía Bertinat',    role: 'Mid',        evals: 16, score: 64, trend: '−4', skills: [60,68,58,72,62], status: 'needs-coaching', last: '2 días' },
  { id: 8, name: 'Ricardo Pena',      role: 'Junior',     evals: 7,  score: 58, trend: '−6', skills: [55,60,52,68,55], status: 'needs-coaching', last: '4 días' },
];

const DIMENSIONS = () => [window.L('Confianza','Confidence'), window.L('Claridad','Clarity'), window.L('Lenguaje corporal','Body language'), window.L('Ritmo de voz','Voice pace'), window.L('Escucha activa','Active listening')];
const statusLabel = (s) => ({
  'on-track':       window.L('En camino','On track'),
  'improving':      window.L('Mejorando','Improving'),
  'watch':          window.L('Observar','Watch'),
  'needs-coaching': window.L('Requiere coaching','Needs coaching'),
}[s]);

/* ----------------------------- KPI ----------------------------- */
const Kpi = ({ label, value, unit, delta, deltaDir, sparkId, data }) => {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) AVSpark(ref.current, data, { id: sparkId }); }, []);
  const deltaColor = deltaDir === 'up' ? 'rgba(158,245,190,0.85)' : deltaDir === 'down' ? 'rgba(252,165,165,0.85)' : deltaDir === 'warn' ? 'rgba(251,191,36,0.85)' : 'var(--ink-35)';
  return (
    <div className="glass kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}<span style={{fontSize:14,color:'var(--ink-50)',marginLeft:4}}>{unit}</span></div>
      <svg ref={ref} className="kpi-spark"/>
      <div className="kpi-delta" style={{color: deltaColor, fontSize:11}}>{delta}</div>
    </div>
  );
};

/* ----------------------------- TOP BAR ----------------------------- */
const NAV_ITEMS = ['equipo', 'preguntas', 'reportes', 'ajustes'];
const navLabel = (id) => ({ equipo: window.L('Equipo','Team'), preguntas: window.L('Preguntas','Questions'), reportes: window.L('Reportes','Reports'), ajustes: window.L('Ajustes','Settings') }[id]);

const AdminTop = ({ user, page, onNav, onLogout, onProfile, tokens, onRecharge }) => {
  const lang = window.useLang(); const L = window.L;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div style={{backdropFilter:'blur(20px) saturate(140%)', background:'rgba(10,10,12,0.55)', borderBottom:'1px solid rgba(255,255,255,0.07)', position:'relative', zIndex:5}}>
      {/* fila logo + usuario */}
      <div style={{display:'flex',alignItems:'center',height:56,padding:'0 28px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}} onClick={() => onNav('equipo')}>
          <ApexLogo size={36}/>
          <div style={{lineHeight:1}}>
            <div style={{fontSize:13,fontWeight:500,letterSpacing:'0.18em',color:'var(--ink-90)'}}>APEX</div>
            <div style={{fontSize:9,letterSpacing:'0.28em',color:'var(--ink-50)',marginTop:1}}>VISION</div>
          </div>
        </div>
        <div style={{flex:1}}/>
        <div ref={ref} style={{display:'flex',alignItems:'center',gap:10,position:'relative'}}>
          <button onClick={() => window.I18N.toggle()} title="ES / EN"
            style={{display:'flex',alignItems:'center',gap:5,padding:'5px 11px',borderRadius:999,border:'1px solid rgba(255,255,255,0.14)',background:'rgba(255,255,255,0.05)',color:'var(--ink-70)',cursor:'pointer',fontSize:11,letterSpacing:'0.06em'}}>
            <SIcon name="wave" size={12}/> {lang.toUpperCase()} · {L('EN','ES')}
          </button>
          <div
            onClick={() => onNav('perfil')}
            title={L('Ver perfil de la empresa', 'View company profile')}
            style={{display:'flex',alignItems:'center',gap:7,padding:'6px 12px',borderRadius:999,
              background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',
              cursor:'pointer',transition:'background 150ms,border-color 150ms'}}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.09)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; }}
          >
            <div className="mono" style={{fontSize:10,color:'var(--ink-50)',letterSpacing:'0.1em',textTransform:'uppercase'}}>{user.tenant}</div>
          </div>
          {tokens !== undefined && (
            <div
              title="Tokens disponibles · clic para recargar"
              onClick={onRecharge}
              style={{display:'flex',alignItems:'center',gap:6,padding:'5px 11px',borderRadius:999,
                background:'rgba(158,245,190,0.06)',border:'1px solid rgba(158,245,190,0.15)',
                cursor:'pointer',transition:'background 150ms'}}
              onMouseEnter={e => e.currentTarget.style.background='rgba(158,245,190,0.11)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(158,245,190,0.06)'}
            >
              <SIcon name="sparkle" size={11} style={{color:'rgba(158,245,190,0.7)'}}/>
              <span className="mono" style={{fontSize:10.5,color:'rgba(158,245,190,0.85)',fontVariantNumeric:'tabular-nums'}}>{(tokens||0).toLocaleString('es-AR')}</span>
              <span className="mono" style={{fontSize:9,color:'rgba(158,245,190,0.4)'}}>tk</span>
            </div>
          )}
          <div
            className="avatar"
            style={{cursor:'pointer', width:32, height:32, fontSize:12}}
            onClick={() => setOpen(o => !o)}
            title="Abrir menú de perfil"
          >{user.initials}</div>
        {open && (
          <div
            className="glass"
            style={{
              position:'absolute', top:'calc(100% + 10px)', right:0, minWidth:230,
              padding:6, zIndex:50, boxShadow:'0 18px 40px rgba(0,0,0,0.4)'
            }}
          >
            <div style={{padding:'12px 14px',borderBottom:'1px solid var(--glass-border)'}}>
              <div style={{fontSize:13,fontWeight:500}}>{user.name}</div>
              <div className="mono" style={{fontSize:10.5,color:'var(--ink-50)',letterSpacing:'0.08em',marginTop:3}}>{user.email}</div>
            </div>
            <button
              onClick={() => { setOpen(false); onProfile(); }}
              style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 14px',background:'transparent',border:0,color:'var(--ink-80)',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:6}}
              onMouseOver={(e) => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
              onMouseOut={(e) => e.currentTarget.style.background='transparent'}
            >
              <SIcon name="sparkle" size={13}/> {L('Mi perfil', 'My profile')}
            </button>
            <button
              onClick={() => { setOpen(false); onNav('ajustes'); }}
              style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 14px',background:'transparent',border:0,color:'var(--ink-80)',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:6}}
              onMouseOver={(e) => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
              onMouseOut={(e) => e.currentTarget.style.background='transparent'}
            >
              <SIcon name="download" size={13}/> {L('Configuración', 'Settings')}
            </button>
            <div style={{height:1,background:'var(--glass-border)',margin:'4px 0'}}/>
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 14px',background:'transparent',border:0,color:'rgba(255,80,80,0.8)',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:6}}
              onMouseOver={(e) => e.currentTarget.style.background='rgba(255,80,80,0.08)'}
              onMouseOut={(e) => e.currentTarget.style.background='transparent'}
            >
              <SIcon name="close" size={13}/> {L('Cerrar sesión', 'Log out')}
            </button>
          </div>
        )}
      </div>
      </div>
      {/* fila tabs — centradas */}
      <div style={{display:'flex',gap:2,padding:'0 24px',borderTop:'1px solid rgba(255,255,255,0.05)',justifyContent:'center'}}>
        {NAV_ITEMS.map(id => (
          <button key={id} onClick={() => onNav(id)} style={{
            background:'none', border:'none', cursor:'pointer', padding:'10px 16px', fontSize:12.5,
            color: page === id ? 'var(--ink-90)' : 'var(--ink-40)',
            borderBottom: page === id ? '2px solid rgba(255,255,255,0.7)' : '2px solid transparent',
            marginBottom:-1, letterSpacing:'0.02em', transition:'color 150ms',
          }}>
            {navLabel(id)}
          </button>
        ))}
      </div>
    </div>
  );
};

/* ----------------------------- TEAM CARD ----------------------------- */
const statusColor = { 'on-track':'#9ef5be', 'improving':'#60a5fa', 'watch':'#fbbf24', 'needs-coaching':'#fca5a5' };

const TeamCard = ({ p, onOpen }) => {
  const col = statusColor[p.status] || 'rgba(255,255,255,0.3)';
  const scoreCol = p.score >= 80 ? '#9ef5be' : p.score >= 65 ? '#fbbf24' : '#fca5a5';
  return (
    <div onClick={() => onOpen(p)}
      style={{ padding:'20px', borderRadius:12, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
        cursor:'pointer', transition:'background 150ms, border-color 150ms', display:'flex', flexDirection:'column', gap:14 }}
      onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.13)'; }}
      onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; }}>

      {/* top row: avatar + score */}
      <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between'}}>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <div className="t-avatar" style={{width:36,height:36,fontSize:12,flexShrink:0}}>
            {p.name.split(' ').map(s=>s[0]).join('').slice(0,2)}
          </div>
          <div>
            <div style={{fontSize:13,fontWeight:400,color:'var(--ink-85)',lineHeight:1.2}}>{p.name}</div>
            <div className="mono" style={{fontSize:9.5,color:'var(--ink-40)',marginTop:2}}>{p.role} · {p.evals} evals</div>
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:26,fontWeight:200,color:scoreCol,lineHeight:1}}>{p.score}</div>
          <div className="mono" style={{fontSize:9,color: parseInt(p.trend) > 0 ? '#9ef5be' : parseInt(p.trend) < 0 ? '#fca5a5' : 'var(--ink-35)', marginTop:2}}>
            {p.trend}
          </div>
        </div>
      </div>

      {/* habilidades en mini barras */}
      <div style={{display:'flex', flexDirection:'column', gap:5}}>
        {DIMENSIONS().map((d, i) => (
          <div key={d} style={{display:'flex', alignItems:'center', gap:8}}>
            <div className="mono" style={{fontSize:8.5, color:'var(--ink-35)', width:80, letterSpacing:'0.06em', textOverflow:'ellipsis', overflow:'hidden', whiteSpace:'nowrap', flexShrink:0}}>{d}</div>
            <div style={{flex:1, height:3, borderRadius:2, background:'rgba(255,255,255,0.06)'}}>
              <div style={{width:`${p.skills[i]}%`, height:'100%', borderRadius:2, background: p.skills[i] >= 75 ? 'rgba(158,245,190,0.6)' : p.skills[i] >= 60 ? 'rgba(251,191,36,0.6)' : 'rgba(252,165,165,0.6)'}}/>
            </div>
            <div className="mono" style={{fontSize:9, color:'var(--ink-40)', width:20, textAlign:'right', flexShrink:0}}>{p.skills[i]}</div>
          </div>
        ))}
      </div>

      {/* status badge */}
      <div style={{display:'flex', alignItems:'center', gap:6}}>
        <span style={{width:5, height:5, borderRadius:'50%', background:col, flexShrink:0}}/>
        <span className="mono" style={{fontSize:9.5, color:col, letterSpacing:'0.1em', textTransform:'uppercase'}}>{statusLabel(p.status)}</span>
        <div style={{flex:1}}/>
        <SIcon name="arrow" size={11} stroke={1.5} style={{color:'var(--ink-30)'}}/>
      </div>
    </div>
  );
};

const MiniRadar = ({ values, size = 44 }) => {
  const cx = size/2, cy = size/2, r = size/2 - 4;
  const N = values.length;
  const max = 100;
  const pts = values.map((v,i) => {
    const a = (Math.PI*2*i)/N - Math.PI/2;
    const d = (v/max)*r;
    return [cx + Math.cos(a)*d, cy + Math.sin(a)*d];
  });
  const ring = values.map((_,i) => {
    const a = (Math.PI*2*i)/N - Math.PI/2;
    return [cx + Math.cos(a)*r, cy + Math.sin(a)*r];
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <polygon points={ring.map(p=>p.join(',')).join(' ')} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8"/>
      <polygon points={pts.map(p=>p.join(',')).join(' ')} fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.85)" strokeWidth="1"/>
    </svg>
  );
};

/* ----------------------------- HEATMAP ----------------------------- */
const Heatmap = () => {
  // rows = vendedores, cols = dimensiones
  return (
    <div className="hmap">
      <div className="hmap-row hmap-head">
        <div></div>
        {DIMENSIONS().map(d => <div key={d} className="hmap-col-label">{d}</div>)}
        <div className="hmap-col-label">Global</div>
      </div>
      {TEAM.map(p => (
        <div key={p.id} className="hmap-row">
          <div className="hmap-name">{p.name}</div>
          {p.skills.map((v,i) => (
            <div key={i} className="hmap-cell" style={{
              background: `rgba(255,255,255,${0.05 + (v/100)*0.85})`,
              color: v >= 70 ? '#000' : '#fff'
            }}>{v}</div>
          ))}
          <div className="hmap-cell" style={{
            background: `rgba(255,255,255,${0.05 + (p.score/100)*0.85})`,
            color: p.score >= 70 ? '#000' : '#fff',
            fontWeight:600
          }}>{p.score}</div>
        </div>
      ))}
    </div>
  );
};

/* ----------------------------- PERSON MODAL ----------------------------- */
const PersonModal = ({ person, onClose }) => {
  if (!person) return null;
  const scoreCol = person.score >= 80 ? '#9ef5be' : person.score >= 65 ? '#fbbf24' : '#fca5a5';
  const col = statusColor[person.status] || 'rgba(255,255,255,0.3)';
  const trendNum = parseInt(person.trend);

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.72)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:'24px'}}
      onClick={onClose}>
      <div className="glass" onClick={e => e.stopPropagation()}
        style={{width:'100%',maxWidth:680,maxHeight:'90vh',overflowY:'auto',borderRadius:16,padding:'28px 32px'}}>

        {/* cabecera */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div className="t-avatar" style={{width:48,height:48,fontSize:16,flexShrink:0}}>
              {person.name.split(' ').map(s=>s[0]).join('').slice(0,2)}
            </div>
            <div>
              <div style={{fontSize:19,fontWeight:300,letterSpacing:'-0.01em'}}>{person.name}</div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
                <span className="mono" style={{fontSize:10,color:'var(--ink-45)'}}>{person.role} · {person.evals} evaluaciones · última {person.last}</span>
                <span style={{width:4,height:4,borderRadius:'50%',background:col}}/>
                <span className="mono" style={{fontSize:10,color:col,textTransform:'uppercase',letterSpacing:'0.08em'}}>{statusLabel(person.status)}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--ink-40)',padding:6,display:'flex',alignItems:'center'}}>
            <SIcon name="close" size={16}/>
          </button>
        </div>

        {/* score + tendencia */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:24}}>
          {[
            {label:window.L('Score global','Overall score'), value:person.score, unit:'/100', color:scoreCol},
            {label:window.L('Tendencia','Trend'), value:person.trend, unit:'pts', color: trendNum > 0 ? '#9ef5be' : trendNum < 0 ? '#fca5a5' : 'var(--ink-40)'},
            {label:window.L('Evaluaciones','Evaluations'), value:person.evals, unit:'total', color:'var(--ink-70)'},
          ].map(({label,value,unit,color}) => (
            <div key={label} style={{padding:'16px',borderRadius:10,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',textAlign:'center'}}>
              <div className="mono" style={{fontSize:9,color:'var(--ink-30)',letterSpacing:'0.16em',textTransform:'uppercase',marginBottom:8}}>{label}</div>
              <div style={{fontSize:28,fontWeight:200,color,lineHeight:1}}>{value}<span style={{fontSize:11,color:'var(--ink-35)',marginLeft:3}}>{unit}</span></div>
            </div>
          ))}
        </div>

        {/* dimensiones */}
        <div className="mono" style={{fontSize:9,color:'var(--ink-30)',letterSpacing:'0.16em',textTransform:'uppercase',marginBottom:12}}>{window.L('Habilidades por dimensión','Skills by dimension')}</div>
        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:24}}>
          {DIMENSIONS().map((d,i) => (
            <div key={d} style={{display:'grid',gridTemplateColumns:'140px 1fr 32px',alignItems:'center',gap:12}}>
              <div style={{fontSize:12,color:'var(--ink-60)'}}>{d}</div>
              <div style={{height:6,borderRadius:3,background:'rgba(255,255,255,0.06)'}}>
                <div style={{width:`${person.skills[i]}%`,height:'100%',borderRadius:3,
                  background: person.skills[i] >= 75 ? '#9ef5be' : person.skills[i] >= 60 ? '#fbbf24' : '#fca5a5',
                  transition:'width 400ms ease'}}/>
              </div>
              <div className="mono" style={{fontSize:11,color:'var(--ink-60)',textAlign:'right'}}>{person.skills[i]}</div>
            </div>
          ))}
        </div>

        {/* evaluaciones recientes */}
        <div className="mono" style={{fontSize:9,color:'var(--ink-30)',letterSpacing:'0.16em',textTransform:'uppercase',marginBottom:12}}>{window.L('Evaluaciones recientes','Recent evaluations')}</div>
        <div style={{display:'flex',flexDirection:'column',gap:1,marginBottom:24}}>
          {(person._rawEvals || []).slice(0,5).map((e) => {
            const s = e.status === 'completed' && e.score !== null ? (e.score > 1 ? Math.round(e.score) : Math.round((e.score||0)*100)) : null;
            const sc = s !== null ? (s >= 80 ? '#9ef5be' : s >= 65 ? '#fbbf24' : '#fca5a5') : 'var(--ink-40)';
            const d = new Date(e.created_at);
            const now = new Date();
            const diffH = Math.floor((now-d)/3600000);
            const dateStr = diffH < 24 ? `hoy ${d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}` : diffH < 48 ? `ayer ${d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}` : d.toLocaleDateString('es-AR',{day:'2-digit',month:'short'});
            const statusLabel = e.status === 'completed' ? 'completada' : e.status === 'failed' ? 'falló' : 'procesando';
            return (
              <div key={e.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:8,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.05)'}}>
                <div style={{width:36,height:36,borderRadius:'50%',border:`2px solid ${sc}33`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <span style={{fontSize:12,fontWeight:300,color:sc}}>{s !== null ? s : '—'}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12.5,color:'var(--ink-75)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:360}}>{e.title || 'Evaluación'}</div>
                  <div className="mono" style={{fontSize:10,color:'var(--ink-35)',marginTop:2}}>{dateStr} · {statusLabel}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* sugerencias IA */}
        <div className="mono" style={{fontSize:9,color:'var(--ink-30)',letterSpacing:'0.16em',textTransform:'uppercase',marginBottom:12}}>{window.L('Sugerencias IA','AI suggestions')}</div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {[
            ['Bajar la velocidad al hablar de precio','WPM promedio 184 vs objetivo 150 cuando menciona costos.'],
            ['Eliminar muletillas "este…" y "como que"','11 ocurrencias en últimas 5 evaluaciones.'],
            ['Sostener la mirada en el cierre','Contacto visual cae al 42% en los últimos 15 segundos.'],
          ].map(([t,d],i) => (
            <div key={i} style={{padding:'12px 14px',borderRadius:8,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderLeft:'2px solid rgba(251,191,36,0.4)'}}>
              <div style={{fontSize:12.5,color:'var(--ink-75)',marginBottom:4}}>{t}</div>
              <div style={{fontSize:11.5,color:'var(--ink-40)',lineHeight:1.5}}>{d}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

/* ----------------------------- VISTA PREGUNTAS ----------------------------- */
const DEFAULT_QUESTIONS = [
  { id:1, title:'Pitch de producto 90s', category:'Pitch · Producto', uses:47, avgScore:78, difficulty:'Media' },
  { id:2, title:'Apertura en frío', category:'Apertura', uses:38, avgScore:72, difficulty:'Alta' },
  { id:3, title:'Presentación ejecutiva', category:'Ejecutivo', uses:22, avgScore:80, difficulty:'Alta' },
  { id:4, title:'Manejo de objeciones · precio', category:'Objeciones', uses:41, avgScore:69, difficulty:'Alta' },
  { id:5, title:'Cierre consultivo', category:'Cierre', uses:29, avgScore:74, difficulty:'Media' },
  { id:6, title:'Discovery: detectar dolor', category:'Discovery', uses:33, avgScore:81, difficulty:'Media' },
];

const QuestionEditor = ({ question, onSave, onClose }) => {
  const [title, setTitle] = useState(question?.title || '');
  const [category, setCategory] = useState(question?.category || 'Pitch · Producto');
  const [difficulty, setDifficulty] = useState(question?.difficulty || 'Media');

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), category: category.trim() || 'General', difficulty });
  };

  return (
    <div className="drawer-back" onClick={onClose}>
      <form
        className="glass"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        style={{maxWidth:520,margin:'10vh auto',padding:30}}
      >
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
          <div>
            <div className="mono" style={{fontSize:10.5,letterSpacing:'0.22em',color:'var(--ink-50)',textTransform:'uppercase',marginBottom:6}}>
              {question ? 'Editar pregunta' : 'Nueva pregunta'}
            </div>
            <h2 style={{fontSize:22,fontWeight:300,letterSpacing:'-0.01em',margin:0}}>
              {question ? 'Modificar escenario' : 'Crear escenario de evaluación'}
            </h2>
          </div>
          <div className="close" onClick={onClose} style={{cursor:'pointer'}}><SIcon name="close" size={14}/></div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <label className="mono" style={{fontSize:10,letterSpacing:'0.18em',color:'var(--ink-50)',textTransform:'uppercase',display:'block',marginBottom:6}}>Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
              style={{width:'100%',padding:'10px 12px',background:'rgba(255,255,255,0.04)',border:'1px solid var(--ink-20)',borderRadius:8,color:'inherit',fontSize:13.5,fontFamily:'inherit'}}
              placeholder="Ej: Manejo de objeción · ROI no claro"
            />
          </div>
          <div>
            <label className="mono" style={{fontSize:10,letterSpacing:'0.18em',color:'var(--ink-50)',textTransform:'uppercase',display:'block',marginBottom:6}}>Categoría</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{width:'100%',padding:'10px 12px',background:'rgba(255,255,255,0.04)',border:'1px solid var(--ink-20)',borderRadius:8,color:'inherit',fontSize:13.5,fontFamily:'inherit'}}
              placeholder="Pitch · Producto / Apertura / Cierre..."
            />
          </div>
          <div>
            <label className="mono" style={{fontSize:10,letterSpacing:'0.18em',color:'var(--ink-50)',textTransform:'uppercase',display:'block',marginBottom:6}}>Dificultad</label>
            <div className="pillbar">
              {['Baja','Media','Alta'].map(d => (
                <button type="button" key={d} className={difficulty===d?'on':''} onClick={() => setDifficulty(d)}>{d}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{display:'flex',gap:10,marginTop:24}}>
          <button type="button" className="btn" style={{flex:1,justifyContent:'center'}} onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" style={{flex:1,justifyContent:'center'}}>
            {question ? 'Guardar cambios' : 'Crear pregunta'}
          </button>
        </div>
      </form>
    </div>
  );
};

const PreguntasView = () => {
  const [questions, setQuestions] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('apex_questions') || 'null');
      return Array.isArray(saved) && saved.length ? saved : DEFAULT_QUESTIONS;
    } catch { return DEFAULT_QUESTIONS; }
  });
  const [editing, setEditing] = useState(null); // null | 'new' | { ...question }

  const persist = (next) => {
    setQuestions(next);
    localStorage.setItem('apex_questions', JSON.stringify(next));
  };
  const handleSave = (data) => {
    if (editing === 'new') {
      const id = Math.max(0, ...questions.map(q => q.id)) + 1;
      persist([...questions, { id, uses: 0, avgScore: 0, ...data }]);
    } else {
      persist(questions.map(q => q.id === editing.id ? { ...q, ...data } : q));
    }
    setEditing(null);
  };
  const handleDelete = (id) => {
    if (!confirm('¿Eliminar esta pregunta? Esta acción no se puede deshacer.')) return;
    persist(questions.filter(q => q.id !== id));
  };

  const diffBadge = (d) => {
    const map = { Alta: ['rgba(252,165,165,0.12)','#fca5a5'], Media: ['rgba(251,191,36,0.12)','#fbbf24'], Baja: ['rgba(158,245,190,0.12)','#9ef5be'] };
    const [bg, color] = map[d] || ['rgba(255,255,255,0.07)','var(--ink-50)'];
    return <span className="mono" style={{fontSize:9.5,padding:'3px 9px',borderRadius:6,background:bg,color,letterSpacing:'0.12em',textTransform:'uppercase'}}>{d}</span>;
  };
  const scoreColor = (s) => s >= 80 ? '#9ef5be' : s >= 70 ? '#fbbf24' : '#fca5a5';

  return (
    <div className="s-stage"><div className="s-wrap" style={{maxWidth:1280}}>
      {/* header compacto */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <div style={{fontSize:16,fontWeight:300,letterSpacing:'-0.01em'}}>Preguntas</div>
          <div className="mono" style={{fontSize:10,color:'var(--ink-30)',marginTop:3}}>
            Banco de escenarios · {questions.length} activos
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          <SIcon name="sparkle" size={13}/> Nueva pregunta
        </button>
      </div>

      <div className="glass" style={{padding:0}}>
        {/* cabecera de columnas */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 120px 72px 90px 80px 36px',gap:16,alignItems:'center',padding:'10px 22px',borderBottom:'1px solid var(--glass-border)'}}>
          <div className="mono" style={{fontSize:9,color:'var(--ink-28)',letterSpacing:'0.16em',textTransform:'uppercase'}}>Escenario</div>
          <div className="mono" style={{fontSize:9,color:'var(--ink-28)',letterSpacing:'0.16em',textTransform:'uppercase'}}>Usos</div>
          <div className="mono" style={{fontSize:9,color:'var(--ink-28)',letterSpacing:'0.16em',textTransform:'uppercase'}}>Score</div>
          <div className="mono" style={{fontSize:9,color:'var(--ink-28)',letterSpacing:'0.16em',textTransform:'uppercase'}}>Dificultad</div>
          <div/>
          <div/>
        </div>
        {questions.length === 0 ? (
          <div style={{padding:40,textAlign:'center',color:'var(--ink-50)',fontSize:13}}>
            No hay preguntas · crea la primera con "Nueva pregunta"
          </div>
        ) : questions.map((q,i) => (
          <div key={q.id}
            style={{display:'grid',gridTemplateColumns:'1fr 120px 72px 90px 80px 36px',gap:16,alignItems:'center',
              padding:'14px 22px',borderTop:i>0?'1px solid var(--glass-border)':'none',
              transition:'background 120ms'}}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
            onMouseLeave={e => e.currentTarget.style.background=''}
          >
            <div>
              <div style={{fontSize:13.5,fontWeight:400,marginBottom:3,color:'var(--ink-85)'}}>{q.title}</div>
              <div className="mono" style={{fontSize:10,color:'var(--ink-40)',letterSpacing:'0.06em'}}>{q.category}</div>
            </div>
            <div className="mono" style={{fontSize:11,color:'var(--ink-45)',letterSpacing:'0.06em'}}>{q.uses} usos</div>
            <div style={{fontSize:22,fontWeight:200,color: q.avgScore ? scoreColor(q.avgScore) : 'var(--ink-30)',lineHeight:1}}>
              {q.avgScore || '—'}
            </div>
            {diffBadge(q.difficulty)}
            <button className="btn" style={{padding:'5px 10px',fontSize:10.5,opacity:0.8}} onClick={() => setEditing(q)}>Editar</button>
            <div
              style={{color:'var(--ink-30)',cursor:'pointer',display:'flex',justifyContent:'center',transition:'color 120ms'}}
              onClick={() => handleDelete(q.id)}
              title="Eliminar pregunta"
              onMouseEnter={e => e.currentTarget.style.color='rgba(252,165,165,0.7)'}
              onMouseLeave={e => e.currentTarget.style.color='var(--ink-30)'}
            ><SIcon name="close" size={13}/></div>
          </div>
        ))}
      </div>
      {editing && (
        <QuestionEditor
          question={editing === 'new' ? null : editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div></div>
  );
};

/* ----------------------------- VISTA REPORTES ----------------------------- */
const ReportesView = () => {
  const [period, setPeriod] = useState('30d');
  const [busy, setBusy] = useState(null); // null | report key
  const [history, setHistory] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('apex_reports_history') || 'null');
      return Array.isArray(saved) && saved.length ? saved : [
        { name:'Reporte equipo · Abril 2026', type:'PDF', date:'hace 3 días', size:'2.4 MB' },
        { name:'Detalle vendedores · Abril 2026', type:'CSV', date:'hace 3 días', size:'180 KB' },
        { name:'Plan de coaching · Q1 2026', type:'PDF', date:'hace 32 días', size:'1.1 MB' },
      ];
    } catch { return []; }
  });

  const persistHistory = (next) => {
    setHistory(next);
    localStorage.setItem('apex_reports_history', JSON.stringify(next));
  };

  const downloadCSV = (filename, content) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const SELLERS_CSV =
    'name,role,evaluations,score,trend,status\n' +
    'Mariana Aimar,Senior,24,84,+6,on-track\n' +
    'Federico Lozada,Senior,22,81,+3,on-track\n' +
    'Carolina Méndez,Mid,18,78,+8,improving\n' +
    'Diego Sosa,Senior,26,76,-2,watch\n' +
    'Lucía Fernández,Mid,14,72,+4,on-track\n' +
    'Tomás Iriarte,Junior,9,68,+11,improving\n' +
    'Sofía Bertinat,Mid,16,64,-4,needs-coaching\n' +
    'Ricardo Pena,Junior,7,58,-6,needs-coaching\n';

  const printPDF = (title, bodyHTML) => {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { alert('Permite ventanas emergentes para descargar el PDF.'); return false; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        @page { size: A4; margin: 18mm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; color: #1a1a1a; margin:0; padding:24px; }
        h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: 0.18em; }
        h2 { font-size: 15px; font-weight: 400; margin: 0 0 18px; color: #555; }
        h3 { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #777; margin: 22px 0 10px; }
        .meta { font-size: 11px; color: #888; margin-bottom: 18px; font-family: 'JetBrains Mono', monospace; }
        hr { border: 0; border-top: 1px solid #ddd; margin: 12px 0 18px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        td { padding: 8px 0; }
        td.label { color: #666; }
        td.value { text-align: right; font-weight: 500; }
        .row { padding: 12px 14px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 10px; }
        .row.high { border-left: 3px solid #e57373; }
        .row.med { border-left: 3px solid #fbbf24; }
        .row-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
        .name { font-size: 14px; font-weight: 500; }
        .role { font-size: 11px; color: #777; font-family: 'JetBrains Mono', monospace; }
        .badge { font-size: 9px; padding: 3px 8px; border-radius: 4px; font-weight: 600; letter-spacing: 0.1em; }
        .badge.high { background: #fee2e2; color: #b91c1c; }
        .badge.med { background: #fef3c7; color: #92400e; }
        .field { font-size: 12px; color: #444; margin-top: 4px; }
        .field strong { color: #111; }
        .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10px; color: #999; font-family: 'JetBrains Mono', monospace; }
      </style></head><body>${bodyHTML}<script>window.onload=()=>{setTimeout(()=>{window.print();},200);};</script></body></html>`);
    w.document.close();
    return true;
  };

  const generatePDF = (kind) => {
    const date = new Date().toLocaleString('es-AR');
    if (kind === 'team-pdf') {
      const body = `
        <h1>APEX VISION</h1>
        <h2>Reporte de Equipo</h2>
        <hr/>
        <div class="meta">Generado: ${date} · Periodo: ${period.toUpperCase()}</div>
        <h3>Métricas generales</h3>
        <table>
          ${[
            ['Score promedio del equipo','75 / 100'],
            ['Vendedores activos','8'],
            ['Evaluaciones realizadas','135'],
            ['Top performer','Mariana Aimar (84)'],
            ['Mayor mejora','Tomás Iriarte (+11)'],
            ['Requieren coaching','2'],
          ].map(([k,v]) => `<tr><td class="label">${k}</td><td class="value">${v}</td></tr>`).join('')}
        </table>
        <h3>Tendencia</h3>
        <p style="font-size:12px;color:#444">Score: 68 → 70 → 73 → 75 (+10% vs mes anterior)</p>
        <div class="footer">Apex Vision · Sales Evaluator</div>`;
      return printPDF('Reporte de Equipo', body);
    }
    const items = [
      { name:'Sofía Bertinat',  meta:'Mid · score 64/100',    pri:'high', focus:'Manejo de objeciones', action:'Sesión 1:1 semanal · revisar grabaciones de top performers' },
      { name:'Ricardo Pena',    meta:'Junior · score 58/100', pri:'high', focus:'Apertura',             action:'Práctica con top performer · 3 evaluaciones esta semana' },
      { name:'Diego Sosa',      meta:'Senior · score 76/100', pri:'med',  focus:'Ritmo de voz',         action:'Plan de práctica con 3 evaluaciones esta semana' },
    ];
    const body = `
      <h1>APEX VISION</h1>
      <h2>Plan de Coaching · IA</h2>
      <hr/>
      <div class="meta">Generado: ${date} · Periodo: ${period.toUpperCase()}</div>
      <h3>Recomendaciones priorizadas</h3>
      ${items.map((it,i) => `
        <div class="row ${it.pri}">
          <div class="row-head">
            <div><span class="name">${i+1}. ${it.name}</span> &nbsp;<span class="role">${it.meta}</span></div>
            <span class="badge ${it.pri}">PRIORIDAD ${it.pri === 'high' ? 'ALTA' : 'MEDIA'}</span>
          </div>
          <div class="field"><strong>Foco:</strong> ${it.focus}</div>
          <div class="field"><strong>Acción sugerida:</strong> ${it.action}</div>
        </div>`).join('')}
      <div class="footer">Apex Vision · Sales Evaluator · Generado por IA</div>`;
    return printPDF('Plan de Coaching', body);
  };

  const reports = [
    { key:'team-pdf',    title:'Reporte de equipo · PDF',     desc:'Score general, dimensiones y tendencia del periodo seleccionado.',         icon:'download', type:'PDF' },
    { key:'sellers-csv', title:'Detalle por vendedor · CSV',  desc:'Todas las evaluaciones con timestamps, scores y dimensiones.',              icon:'download', type:'CSV' },
    { key:'coaching',    title:'Plan de coaching · PDF',      desc:'Sugerencias de IA personalizadas por vendedor priorizadas por impacto.',  icon:'sparkle',  type:'PDF' },
  ];

  const generate = async (r) => {
    setBusy(r.key);
    await new Promise(res => setTimeout(res, 600));
    let ok = false;
    if (r.key === 'sellers-csv') {
      downloadCSV(`detalle-vendedores-${period}.csv`, SELLERS_CSV);
      ok = true;
    } else {
      ok = generatePDF(r.key);
    }
    if (ok) {
      persistHistory([
        { name: r.title.replace(' · PDF','').replace(' · CSV',''), type: r.type, date: 'recién', size: r.type === 'CSV' ? '180 KB' : '24 KB' },
        ...history,
      ].slice(0, 12));
    }
    setBusy(null);
  };

  const downloadHistory = (item) => {
    if (item.type === 'CSV') {
      downloadCSV(`${item.name}.csv`, SELLERS_CSV);
    } else {
      generatePDF(item.name.toLowerCase().includes('coaching') ? 'coaching' : 'team-pdf');
    }
  };

  const typeBadge = (t) => {
    const isPDF = t === 'PDF';
    return (
      <span className="mono" style={{fontSize:9,padding:'2px 7px',borderRadius:5,letterSpacing:'0.14em',
        background: isPDF ? 'rgba(139,92,246,0.14)' : 'rgba(34,197,94,0.12)',
        color: isPDF ? 'rgba(196,181,253,0.9)' : 'rgba(134,239,172,0.9)',
        border: `1px solid ${isPDF ? 'rgba(139,92,246,0.2)' : 'rgba(34,197,94,0.18)'}`,
      }}>{t}</span>
    );
  };

  return (
    <div className="s-stage"><div className="s-wrap" style={{maxWidth:1280}}>
      {/* header compacto */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <div>
          <div style={{fontSize:16,fontWeight:300,letterSpacing:'-0.01em'}}>Reportes</div>
          <div className="mono" style={{fontSize:10,color:'var(--ink-30)',marginTop:3}}>
            Exportar datos del equipo
          </div>
        </div>
      </div>

      {/* selector de periodo — debajo del título */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
        <div className="pillbar">
          {['30d','90d','todo'].map(p => (
            <button key={p} className={period===p?'on':''} onClick={() => setPeriod(p)}>
              {p === 'todo' ? 'Todo' : p.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="mono" style={{fontSize:9.5,color:'var(--ink-28)'}}>
          {period==='30d' ? 'Últimos 30 días' : period==='90d' ? 'Últimos 90 días' : 'Todo el historial'}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:18}}>
        {reports.map(r => (
          <div key={r.key} className="glass" style={{padding:24,display:'flex',flexDirection:'column',gap:0}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <div style={{color:'var(--ink-50)'}}><SIcon name={r.icon} size={18} stroke={1.2}/></div>
              {typeBadge(r.type)}
            </div>
            <div style={{fontSize:13.5,fontWeight:400,marginBottom:6,color:'var(--ink-85)'}}>{r.title}</div>
            <div style={{fontSize:12,color:'var(--ink-40)',lineHeight:1.6,marginBottom:20,flex:1}}>{r.desc}</div>
            <button
              className="btn"
              style={{width:'100%',justifyContent:'center',padding:'9px',display:'inline-flex',alignItems:'center',gap:6,
                border:'1px solid rgba(255,255,255,0.1)',fontSize:11.5,
                opacity: busy === r.key ? 0.6 : 1}}
              onClick={() => generate(r)}
              disabled={busy === r.key}
            >
              <SIcon name="download" size={12}/>
              {busy === r.key ? 'Generando…' : 'Generar'}
            </button>
          </div>
        ))}
      </div>

      <div className="glass" style={{padding:0}}>
        {/* cabecera columnas */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 64px 120px 72px 100px',gap:16,alignItems:'center',padding:'10px 22px',borderBottom:'1px solid var(--glass-border)'}}>
          {['Nombre','Tipo','Generado','Tamaño',''].map((h,i) => (
            <div key={i} className="mono" style={{fontSize:9,color:'var(--ink-28)',letterSpacing:'0.16em',textTransform:'uppercase'}}>{h}</div>
          ))}
        </div>
        {history.length === 0 ? (
          <div style={{padding:30,textAlign:'center',color:'var(--ink-50)',fontSize:13}}>Sin reportes generados</div>
        ) : history.map((item,i) => (
          <div key={i}
            style={{display:'grid',gridTemplateColumns:'1fr 64px 120px 72px 100px',gap:16,alignItems:'center',
              padding:'13px 22px',borderTop:i>0?'1px solid var(--glass-border)':'none',transition:'background 120ms'}}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
            onMouseLeave={e => e.currentTarget.style.background=''}
          >
            <div style={{fontSize:13,color:'var(--ink-80)'}}>{item.name}</div>
            {typeBadge(item.type)}
            <div className="mono" style={{fontSize:10.5,color:'var(--ink-40)'}}>{item.date}</div>
            <div className="mono" style={{fontSize:10.5,color:'var(--ink-40)'}}>{item.size}</div>
            <button
              className="btn"
              style={{padding:'5px 10px',fontSize:10.5,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:5,opacity:0.8}}
              onClick={() => downloadHistory(item)}
            >
              <SIcon name="download" size={11}/> Descargar
            </button>
          </div>
        ))}
      </div>
    </div></div>
  );
};

/* ----------------------------- VISTA AJUSTES ----------------------------- */
const DEFAULT_SETTINGS = {
  company:        { name: 'Northwind Sales', industry: 'Tecnología B2B', country: 'Argentina' },
  evaluations:    { maxDuration: '3 minutos', retention: '30 días', language: 'Español' },
  notifications:  { weekly: true, lowPerformance: true, newEvaluations: false },
};

const AjustesView = ({ onLogout }) => {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('apex_settings') || 'null');
      return saved && typeof saved === 'object' ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });
  const [savedAt, setSavedAt] = useState(null);
  const [dirty, setDirty] = useState(false);

  const update = (section, key, value) => {
    setSettings(s => ({ ...s, [section]: { ...s[section], [key]: value } }));
    setDirty(true);
  };

  const save = () => {
    localStorage.setItem('apex_settings', JSON.stringify(settings));
    setSavedAt(new Date().toLocaleTimeString('es-AR'));
    setDirty(false);
  };

  const reset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem('apex_settings', JSON.stringify(DEFAULT_SETTINGS));
    setDirty(false);
    setSavedAt(new Date().toLocaleTimeString('es-AR'));
  };

  const inputStyle = {
    fontSize:13,padding:'7px 10px',background:'rgba(255,255,255,0.04)',
    border:'1px solid var(--ink-20)',borderRadius:6,color:'inherit',
    fontFamily:'var(--font-mono)',letterSpacing:'0.04em',minWidth:200,textAlign:'right',
  };

  const Toggle = ({ checked, onChange }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width:42,height:24,padding:2,borderRadius:999,
        background: checked ? 'rgba(120,255,180,0.25)' : 'rgba(255,255,255,0.08)',
        border: '1px solid ' + (checked ? 'rgba(120,255,180,0.4)' : 'var(--ink-20)'),
        cursor:'pointer',transition:'all 150ms',display:'flex',alignItems:'center',
      }}
    >
      <span style={{
        display:'block',width:18,height:18,borderRadius:'50%',
        background: checked ? '#9ef5be' : 'var(--ink-50)',
        transform: checked ? 'translateX(18px)' : 'translateX(0)',
        transition:'transform 150ms',
      }}/>
    </button>
  );

  const Row = ({ label, children, top }) => (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderTop:top?'1px solid var(--glass-border)':'none'}}>
      <div style={{fontSize:13,color:'var(--ink-80)'}}>{label}</div>
      {children}
    </div>
  );

  const SectionLabel = ({ children }) => (
    <div style={{display:'flex',alignItems:'center',gap:10,paddingBottom:14,marginBottom:4,borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
      <div className="mono" style={{fontSize:9.5,letterSpacing:'0.22em',color:'var(--ink-35)',textTransform:'uppercase'}}>{children}</div>
      <div style={{flex:1,height:1,background:'rgba(255,255,255,0.03)'}}/>
    </div>
  );

  return (
    <div className="s-stage"><div className="s-wrap" style={{maxWidth:860}}>
      {/* header compacto */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <div style={{fontSize:16,fontWeight:300,letterSpacing:'-0.01em'}}>Ajustes</div>
          <div className="mono" style={{fontSize:10,color:'var(--ink-30)',marginTop:3}}>Configuración de cuenta</div>
        </div>
        {savedAt && !dirty && (
          <div className="mono" style={{fontSize:10,color:'rgba(120,255,180,0.65)',letterSpacing:'0.14em',textTransform:'uppercase',
            display:'flex',alignItems:'center',gap:6}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:'rgba(120,255,180,0.65)',display:'inline-block'}}/>
            Guardado · {savedAt}
          </div>
        )}
        {dirty && (
          <div className="mono" style={{fontSize:10,color:'rgba(251,191,36,0.75)',letterSpacing:'0.14em',textTransform:'uppercase',
            display:'flex',alignItems:'center',gap:6}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:'rgba(251,191,36,0.75)',display:'inline-block'}}/>
            Cambios sin guardar
          </div>
        )}
      </div>

      <div style={{display:'grid',gap:12}}>
        {/* EMPRESA */}
        <div className="glass" style={{padding:'22px 28px'}}>
          <SectionLabel>Empresa</SectionLabel>
          <Row label="Nombre de la empresa">
            <input style={inputStyle} value={settings.company.name} onChange={e => update('company','name',e.target.value)}/>
          </Row>
          <Row label="Industria" top>
            <input style={inputStyle} value={settings.company.industry} onChange={e => update('company','industry',e.target.value)}/>
          </Row>
          <Row label="País" top>
            <select style={inputStyle} value={settings.company.country} onChange={e => update('company','country',e.target.value)}>
              {['Argentina','Chile','Colombia','México','España','Uruguay','Perú'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Row>
        </div>

        {/* EVALUACIONES */}
        <div className="glass" style={{padding:'22px 28px'}}>
          <SectionLabel>Evaluaciones</SectionLabel>
          <Row label="Duración máxima de grabación">
            <select style={inputStyle} value={settings.evaluations.maxDuration} onChange={e => update('evaluations','maxDuration',e.target.value)}>
              {['1 minuto','2 minutos','3 minutos','5 minutos','10 minutos'].map(o => <option key={o}>{o}</option>)}
            </select>
          </Row>
          <Row label="Retención de videos" top>
            <select style={inputStyle} value={settings.evaluations.retention} onChange={e => update('evaluations','retention',e.target.value)}>
              {['7 días','15 días','30 días','60 días','90 días'].map(o => <option key={o}>{o}</option>)}
            </select>
          </Row>
          <Row label="Idioma de evaluación" top>
            <select style={inputStyle} value={settings.evaluations.language} onChange={e => update('evaluations','language',e.target.value)}>
              {['Español','Inglés','Portugués'].map(o => <option key={o}>{o}</option>)}
            </select>
          </Row>
        </div>

        {/* NOTIFICACIONES */}
        <div className="glass" style={{padding:'22px 28px'}}>
          <SectionLabel>Notificaciones</SectionLabel>
          <Row label="Resumen semanal por email">
            <Toggle checked={settings.notifications.weekly} onChange={v => update('notifications','weekly',v)}/>
          </Row>
          <Row label="Alertas de bajo rendimiento" top>
            <Toggle checked={settings.notifications.lowPerformance} onChange={v => update('notifications','lowPerformance',v)}/>
          </Row>
          <Row label="Nuevas evaluaciones" top>
            <Toggle checked={settings.notifications.newEvaluations} onChange={v => update('notifications','newEvaluations',v)}/>
          </Row>
        </div>

        {/* SAVE BAR */}
        <div style={{display:'flex',gap:10,alignItems:'center',padding:'4px 0'}}>
          <button
            className={dirty ? 'btn btn-primary' : 'btn'}
            onClick={save}
            disabled={!dirty}
            style={{opacity: dirty ? 1 : 0.45, transition:'opacity 150ms'}}
          >
            <SIcon name="download" size={13}/> Guardar cambios
          </button>
          <button className="btn" onClick={reset} style={{opacity:0.7}}>Restablecer</button>
          <div style={{flex:1}}/>
          <button
            className="btn"
            onClick={onLogout}
            style={{color:'rgba(255,80,80,0.7)',borderColor:'rgba(255,80,80,0.2)'}}
          >
            <SIcon name="close" size={13}/> Cerrar sesión
          </button>
        </div>
      </div>
    </div></div>
  );
};

/* ----------------------------- PERFIL EMPRESA ----------------------------- */
const PerfilEmpresa = ({ user, onGoAjustes, team = TEAM }) => {
  const teamAvg = team.length ? Math.round(team.reduce((s,p) => s + p.score, 0) / team.length) : 0;
  const totalEvals = team.reduce((s,p) => s + p.evals, 0);
  const topPerformer = team.length ? team.slice().sort((a,b) => b.score - a.score)[0] : { score: 0, name: '—' };

  const StatCard = ({ label, value, sub, color }) => (
    <div style={{padding:'18px 20px',borderRadius:12,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',flex:1}}>
      <div className="mono" style={{fontSize:9,color:'var(--ink-28)',letterSpacing:'0.16em',textTransform:'uppercase',marginBottom:10}}>{label}</div>
      <div style={{fontSize:26,fontWeight:200,color: color || 'var(--ink-85)',lineHeight:1,marginBottom:4}}>{value}</div>
      {sub && <div className="mono" style={{fontSize:10,color:'var(--ink-35)'}}>{sub}</div>}
    </div>
  );

  const InfoRow = ({ label, value }) => (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 0',borderTop:'1px solid rgba(255,255,255,0.05)'}}>
      <div style={{fontSize:13,color:'var(--ink-55)'}}>{label}</div>
      <div className="mono" style={{fontSize:12,color:'var(--ink-80)'}}>{value}</div>
    </div>
  );

  return (
    <div className="s-stage"><div className="s-wrap" style={{maxWidth:900}}>
      {/* header compacto */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <div style={{fontSize:16,fontWeight:300,letterSpacing:'-0.01em'}}>Perfil de empresa</div>
          <div className="mono" style={{fontSize:10,color:'var(--ink-30)',marginTop:3}}>
            {user.tenant} · cuenta activa
          </div>
        </div>
        <button className="btn" style={{fontSize:11.5}} onClick={onGoAjustes}>
          <SIcon name="download" size={12}/> Editar en Ajustes
        </button>
      </div>

      {/* avatar + info principal */}
      <div className="glass" style={{padding:'28px 32px',marginBottom:12,display:'flex',alignItems:'center',gap:24}}>
        <div style={{width:64,height:64,borderRadius:16,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',
          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <span className="mono" style={{fontSize:22,fontWeight:300,letterSpacing:'0.06em',color:'var(--ink-70)'}}>
            {user.tenant.slice(0,2).toUpperCase()}
          </span>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:22,fontWeight:300,letterSpacing:'-0.01em',marginBottom:4}}>{user.tenant} Sales</div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            {[['Tecnología B2B','rgba(139,92,246,0.14)','rgba(196,181,253,0.8)'],['Argentina','rgba(255,255,255,0.05)','var(--ink-50)'],['Plan Pro','rgba(158,245,190,0.1)','rgba(158,245,190,0.75)']].map(([label,bg,color]) => (
              <span key={label} className="mono" style={{fontSize:10,padding:'3px 10px',borderRadius:6,background:bg,color,letterSpacing:'0.1em'}}>
                {label}
              </span>
            ))}
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div className="mono" style={{fontSize:9,color:'var(--ink-28)',letterSpacing:'0.16em',textTransform:'uppercase',marginBottom:4}}>Miembro desde</div>
          <div style={{fontSize:13,color:'var(--ink-60)'}}>Enero 2025</div>
        </div>
      </div>

      {/* stats del equipo */}
      <div className="mono" style={{fontSize:9,color:'var(--ink-28)',letterSpacing:'0.16em',textTransform:'uppercase',marginBottom:10}}>Resumen del equipo</div>
      <div style={{display:'flex',gap:10,marginBottom:12}}>
        <StatCard label="Vendedores" value={team.length} sub="100% activos" />
        <StatCard label="Score promedio" value={teamAvg} sub="vs 70 benchmark" color={teamAvg >= 75 ? '#9ef5be' : teamAvg >= 65 ? '#fbbf24' : '#fca5a5'}/>
        <StatCard label="Evaluaciones totales" value={totalEvals} sub="últimos 30 días"/>
        <StatCard label="Top performer" value={topPerformer.score} sub={topPerformer.name} color="#9ef5be"/>
      </div>

      {/* datos de cuenta */}
      <div className="glass" style={{padding:'20px 28px'}}>
        <div className="mono" style={{fontSize:9.5,letterSpacing:'0.22em',color:'var(--ink-35)',textTransform:'uppercase',
          paddingBottom:12,marginBottom:4,borderBottom:'1px solid rgba(255,255,255,0.05)'}}>Datos de cuenta</div>
        <InfoRow label="Nombre de la empresa" value="Northwind Sales"/>
        <InfoRow label="Industria" value="Tecnología B2B"/>
        <InfoRow label="País" value="Argentina"/>
        <InfoRow label="Plan" value="Pro · 8 usuarios"/>
        <InfoRow label="Próxima renovación" value="15 Jun 2026"/>
        <InfoRow label="Admin principal" value={user.email}/>
      </div>
    </div></div>
  );
};

/* ----------------------------- MAIN VIEW ----------------------------- */
const AdminApp = () => {
  window.useLang(); const L = window.L;
  const [time, setTime] = useState(new Date());
  const [drawer, setDrawer] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [page, setPage] = useState('equipo');
  const [roleFilter, setRoleFilter] = useState('Todos');
  const [teamData, setTeamData] = useState(TEAM);
  const [recentEvals, setRecentEvals] = useState([]);
  const [highlightId, setHighlightId] = useState(() => new URLSearchParams(window.location.search).get('eval') || null);

  useEffect(() => {
    if (!window.ApexAPI) return;
    const DIM_KEYS = ['confianza','claridad','lenguaje_corporal','ritmo_voz','escucha_activa'];
    window.ApexAPI.listAdminEvaluations().then(evals => {
      const byUser = {};
      evals.forEach(e => {
        const key = e.user_id;
        if (!byUser[key]) byUser[key] = { email: e.seller_email, evals: [] };
        byUser[key].evals.push(e);
      });
      // Normaliza score: valores <= 1 están en escala 0-1 (multiplicar ×100),
      // valores > 1 ya están en escala 0-100 (usar directamente).
      const norm = s => s > 1 ? Math.round(s) : Math.round((s||0) * 100);
      const team = Object.values(byUser).map((u, i) => {
        const completed = u.evals.filter(e => e.status === 'completed' && e.score !== null);
        const scores = completed.map(e => norm(e.score));
        const avgScore = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
        const skills = DIM_KEYS.map(k => {
          const ds = completed.filter(e=>e.features?.dimensions?.[k]).map(e=>e.features.dimensions[k].score);
          return ds.length ? Math.round(ds.reduce((a,b)=>a+b,0)/ds.length) : 0;
        });
        const trend = scores.length >= 2 ? (scores[0]-scores[1]) : 0;
        const trendStr = trend > 0 ? `+${trend}` : String(trend);
        const status = avgScore >= 80 ? 'on-track' : avgScore >= 70 ? 'improving' : avgScore >= 60 ? 'watch' : 'needs-coaching';
        const lastDate = new Date(u.evals[0].created_at);
        const diffH = Math.floor((new Date()-lastDate)/3600000);
        const last = diffH < 24 ? `hoy ${lastDate.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}` : diffH < 48 ? 'ayer' : `${Math.floor(diffH/24)} días`;
        const rawName = u.email.split('@')[0];
        const name = rawName.split('.').map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join(' ');
        return { id: i+1, name, role: 'Vendedor', evals: u.evals.length, score: avgScore, trend: trendStr, skills, status, last, _rawEvals: u.evals };
      });
      if (team.length) setTeamData(team);
      // Guardar últimas 10 evaluaciones para la vista de recientes
      setRecentEvals(evals.slice(0, 10));
    }).catch(() => {});
  }, []);

  // ── Token system (basado en plan financiero: $0.01/token) ─────────────────
  // Costos: 5 tokens/evaluación ($0.05) · 20 tokens/plan coaching IA ($0.20)
  const TOKEN_COSTS = { evaluation: 5, coachingPlan: 20 };
  const [tokens, setTokens] = useState(() => {
    const saved = parseInt(localStorage.getItem('apex_tokens') || '500', 10);
    return Number.isFinite(saved) ? saved : 500;
  });
  const consumeTokens = (cost) => {
    if (tokens < cost) return false;
    const next = tokens - cost;
    setTokens(next);
    localStorage.setItem('apex_tokens', String(next));
    return true;
  };
  const recharge = (amount) => {
    const next = tokens + amount;
    setTokens(next);
    localStorage.setItem('apex_tokens', String(next));
  };

  const [coachingPlan, setCoachingPlan] = useState(null);
  const [coachingBusy, setCoachingBusy] = useState(false);
  const [tokenError, setTokenError] = useState('');

  const generateCoachingPlan = async () => {
    setTokenError('');
    if (tokens < TOKEN_COSTS.coachingPlan) {
      setTokenError(`Saldo insuficiente. Necesitas ${TOKEN_COSTS.coachingPlan} tokens (tienes ${tokens}).`);
      return;
    }
    setCoachingBusy(true);
    consumeTokens(TOKEN_COSTS.coachingPlan);

    // Análisis basado en datos reales del equipo (mismo criterio del scorer crítico):
    // Cada recomendación se ancla en una métrica concreta detectada en el desempeño.
    await new Promise(r => setTimeout(r, 800));

    const teamAvg = teamData.length ? Math.round(teamData.reduce((s,p) => s + p.score, 0) / teamData.length) : 0;
    const skillNames = ['Confianza','Claridad','Manejo objeciones','Ritmo de voz','Lenguaje corporal'];

    const buildItem = (p) => {
      // Identificar la dimensión más débil con su métrica
      let worstIdx = 0;
      let worstScore = p.skills[0];
      p.skills.forEach((s, i) => { if (s < worstScore) { worstScore = s; worstIdx = i; } });
      const weakness = skillNames[worstIdx];

      // Acción específica + métrica de éxito
      const actionMap = {
        'Confianza': `Practica 3 grabaciones esta semana enfocadas en apertura. Meta: subir confianza de ${worstScore} a ${Math.min(85, worstScore + 12)} en 30 días.`,
        'Claridad': `Estructura cada pitch con problema-solución-CTA. Meta: claridad ≥ 75 en próximas 2 evaluaciones (actual ${worstScore}).`,
        'Manejo objeciones': `Sesión 1:1 semanal · revisar 3 objeciones reales. Meta: manejo objeciones ${worstScore} → ${Math.min(80, worstScore + 15)} en 4 semanas.`,
        'Ritmo de voz': `Si pace > 170 WPM o < 100, ajustar pausas. Meta: ritmo entre 130-160 WPM y score ≥ 75 (actual ${worstScore}).`,
        'Lenguaje corporal': `Practicar postura abierta y contacto visual frente a cámara. Meta: leng. corporal ${worstScore} → 75+ en 3 evaluaciones.`,
      };

      const priority = p.score < 65 ? 'alta' : (p.score < 75 ? 'media' : 'baja');
      return {
        person: p.name,
        role: p.role,
        score: p.score,
        weakness: `${weakness} (${worstScore}/100)`,
        action: actionMap[weakness],
        evidence: `Score global ${p.score} · ${p.evals} evals · trend ${p.trend} · ${p.status}`,
        priority,
      };
    };

    const targets = teamData.filter(p => p.status === 'needs-coaching' || p.status === 'watch' || p.score < 75);

    const plan = {
      generatedAt: new Date().toLocaleString('es-AR'),
      summary: `Equipo ${teamData.length} vendedores · score promedio ${teamAvg}/100 · ${targets.length} requieren intervención (criterio: score<75 o status watch/needs-coaching)`,
      items: targets.sort((a,b) => a.score - b.score).map(buildItem),
      methodology: 'Cada recomendación se ancla en la dimensión más débil del vendedor con métricas concretas y meta de mejora medible.',
    };
    setCoachingPlan(plan);
    setCoachingBusy(false);
  };
  const baseUser = { tenant: 'NORTHWIND', role: 'ADMIN', initials: 'JL', name: 'Juliana López', email: 'juliana@northwind.com', phone: '+54 11 5555-1234', position: 'Sales Director' };
  const [profile, setProfile] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('apex_profile') || 'null');
      return saved && typeof saved === 'object' ? { ...baseUser, ...saved } : baseUser;
    } catch { return baseUser; }
  });
  const user = profile;
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState(profile);
  const [profileSaved, setProfileSaved] = useState(false);
  const openProfile = () => { setProfileDraft(profile); setProfileSaved(false); setProfileOpen(true); };
  const saveProfile = () => {
    const initials = profileDraft.name.split(' ').filter(Boolean).map(s => s[0]).slice(0,2).join('').toUpperCase() || 'JL';
    const next = { ...profileDraft, initials };
    setProfile(next);
    localStorage.setItem('apex_profile', JSON.stringify(next));
    setProfileSaved(true);
    setTimeout(() => setProfileOpen(false), 700);
  };
  const handleLogout = () => {
    if (window.ApexAPI) window.ApexAPI.logout();
    window.dispatchEvent(new Event('apex:session-expired'));
  };

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const teamAvg = teamData.length ? Math.round(teamData.reduce((s,p) => s + p.score, 0) / teamData.length) : 0;
  const totalEvals = teamData.reduce((s,p) => s + p.evals, 0);
  const needsCoach = teamData.filter(p => p.status === 'needs-coaching').length;

  return (
    <div id="app">
      <div className="s-shell">
        <AdminTop user={user} page={page} onNav={setPage} onLogout={handleLogout} onProfile={openProfile} tokens={tokens} onRecharge={() => recharge(500)}/>
        {page === 'preguntas' && <PreguntasView/>}
        {page === 'reportes'  && <ReportesView/>}
        {page === 'ajustes'   && <AjustesView onLogout={handleLogout}/>}
        {page === 'perfil'    && <PerfilEmpresa user={user} onGoAjustes={() => setPage('ajustes')} team={teamData}/>}
        {page === 'equipo' && <div className="s-stage">
          <div className="s-wrap" style={{maxWidth:1280}}>
            {/* header compacto */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <div>
                <div style={{fontSize:16,fontWeight:300,letterSpacing:'-0.01em'}}>{L('Equipo','Team')}</div>
                <div className="mono" style={{fontSize:10,color:'var(--ink-30)',marginTop:3}}>
                  {user.tenant} · {teamData.length} {L('vendedores','sellers')} · {needsCoach} {L('requieren coaching','need coaching')}
                </div>
              </div>
              <button className="btn" style={{display:'flex',alignItems:'center',gap:6,fontSize:11.5}}>
                <SIcon name="download" size={12}/> {L('Exportar','Export')}
              </button>
            </div>

            {/* barra de periodo — debajo del título, encima de KPIs */}
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
              <div className="pillbar">
                <button className={period==='7d'?'on':''} onClick={()=>setPeriod('7d')}>7D</button>
                <button className={period==='30d'?'on':''} onClick={()=>setPeriod('30d')}>30D</button>
                <button className={period==='90d'?'on':''} onClick={()=>setPeriod('90d')}>90D</button>
              </div>
              <div className="mono" style={{fontSize:9.5,color:'var(--ink-28)'}}>
                {period==='7d' ? L('Últimos 7 días','Last 7 days') : period==='30d' ? L('Últimos 30 días','Last 30 days') : L('Últimos 90 días','Last 90 days')}
              </div>
            </div>

            <div className="kpis" style={{marginBottom:18}}>
              <Kpi label={L('Score promedio del equipo','Team average score')} value={teamAvg} unit="/100" delta={L('+ 4 vs mes anterior','+ 4 vs last month')} deltaDir="up" sparkId="a1" data={[68,70,69,72,73,72,75,74,76,75,76,teamAvg]}/>
              <Kpi label={L('Evaluaciones · 30d','Evaluations · 30d')} value={totalEvals} unit="" delta={L('↑ 18% participación','↑ 18% participation')} deltaDir="up" sparkId="a2" data={[6,8,12,9,14,18,16,20,22,19,24,totalEvals]}/>
              <Kpi label={L('Vendedores activos','Active sellers')} value={teamData.length} unit={`/${teamData.length}`} delta={L('100% activos esta semana','100% active this week')} deltaDir="neutral" sparkId="a3" data={[5,6,6,7,7,8,8,8,8,8,8,8]}/>
              <Kpi label={L('Requieren coaching','Need coaching')} value={needsCoach} unit="" delta={L('↑ 2 desde la semana pasada','↑ 2 since last week')} deltaDir="warn" sparkId="a4" data={[1,1,2,1,2,2,2,3,2,2,2,needsCoach]}/>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:14,alignItems:'start'}}>

              {/* GRID DE TARJETAS */}
              <div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <div className="mono" style={{fontSize:9,color:'var(--ink-28)',letterSpacing:'0.16em',textTransform:'uppercase'}}>{L('Vendedores · clic para ver detalle','Sellers · click to view detail')}</div>
                  <div className="pillbar">
                    {[['Todos','All'],['Senior','Senior'],['Mid','Mid'],['Junior','Junior']].map(([r,rl]) => (
                      <button key={r} className={roleFilter===r?'on':''} onClick={()=>setRoleFilter(r)}>{L(r,rl)}</button>
                    ))}
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                  {teamData.filter(p => roleFilter==='Todos' || p.role===roleFilter)
                       .map(p => <TeamCard key={p.id} p={p} onOpen={setDrawer}/>)}
                </div>
              </div>

              {/* INSIGHTS SIDEBAR */}
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{padding:'18px 20px',borderRadius:12,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
                  <div className="mono" style={{fontSize:9,color:'var(--ink-28)',letterSpacing:'0.16em',textTransform:'uppercase',marginBottom:14}}>Insights</div>
                  {[
                    {label:L('Fortaleza','Strength'),       value:L('Escucha activa','Active listening'),  meta:L('79 prom · +6 vs mes ant.','79 avg · +6 vs last month')},
                    {label:L('Punto débil','Weak point'),      value:L('Ritmo de voz','Voice pace'),    meta:L('68 prom · 5 hablan >170 WPM','68 avg · 5 speak >170 WPM')},
                    {label:L('Top performer','Top performer'),   value:'Mariana Aimar',   meta:L('84 score · racha 7 días','84 score · 7-day streak')},
                    {label:L('Mayor mejora','Most improved'),    value:'Tomás Iriarte',   meta:'+11 pts · Junior → Mid'},
                  ].map(({label,value,meta}) => (
                    <div key={label} style={{marginBottom:14,paddingBottom:14,borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                      <div className="mono" style={{fontSize:9,color:'var(--ink-30)',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:3}}>{label}</div>
                      <div style={{fontSize:13,fontWeight:400,color:'var(--ink-80)',marginBottom:2}}>{value}</div>
                      <div className="mono" style={{fontSize:9.5,color:'var(--ink-35)'}}>{meta}</div>
                    </div>
                  ))}
                </div>

                <button className="btn" style={{width:'100%',justifyContent:'center',gap:7,fontSize:11.5,padding:'11px',
                  border:'1px solid rgba(158,245,190,0.2)',color:'rgba(158,245,190,0.8)',
                  opacity:(coachingBusy||tokens<TOKEN_COSTS.coachingPlan)?0.4:1}}
                  onClick={generateCoachingPlan}
                  disabled={coachingBusy||tokens<TOKEN_COSTS.coachingPlan}>
                  <SIcon name="sparkle" size={12}/>
                  {coachingBusy ? L('Generando…','Generating…') : `${L('Plan coaching IA','AI coaching plan')} · ${TOKEN_COSTS.coachingPlan} tokens`}
                </button>
                {tokenError && <div className="mono" style={{fontSize:10,color:'#fca5a5',lineHeight:1.5}}>{tokenError}</div>}
              </div>
            </div>

            {/* EVALUACIONES RECIENTES DEL EQUIPO */}
            {recentEvals.length > 0 && (
              <div style={{marginTop:20}}>
                <div className="mono" style={{fontSize:9,color:'var(--ink-28)',letterSpacing:'0.16em',textTransform:'uppercase',marginBottom:12}}>
                  {L('Evaluaciones recientes del equipo','Recent team evaluations')}
                </div>
                <div className="glass" style={{padding:0,overflow:'hidden'}}>
                  {recentEvals.map((e, i) => {
                    const s = e.score != null ? (e.score > 1 ? Math.round(e.score) : Math.round(e.score * 100)) : null;
                    const sc = s != null ? (s >= 70 ? '#9ef5be' : s >= 50 ? '#fbbf24' : '#fca5a5') : 'var(--ink-30)';
                    const isHL = e.id === highlightId;
                    const d = new Date(e.created_at);
                    const diffH = Math.floor((new Date()-d)/3600000);
                    const dateStr = diffH < 24 ? `hoy ${d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}` : diffH < 48 ? `ayer ${d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}` : d.toLocaleDateString('es-AR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
                    const sellerName = (e.seller_email||'').split('@')[0].split('.').map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(' ');
                    const statusLabel = e.status === 'completed' ? 'Completada' : e.status === 'failed' ? 'Falló' : 'Procesando';
                    const statusColor = e.status === 'completed' ? '#9ef5be' : e.status === 'failed' ? '#fca5a5' : '#fbbf24';
                    return (
                      <div key={e.id} style={{
                        display:'grid', gridTemplateColumns:'36px 1fr auto auto',
                        alignItems:'center', gap:14, padding:'12px 18px',
                        borderBottom: i < recentEvals.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        background: isHL ? 'rgba(158,245,190,0.07)' : 'transparent',
                        borderLeft: isHL ? '3px solid rgba(158,245,190,0.6)' : '3px solid transparent',
                        transition:'background 300ms',
                      }}>
                        {/* score circle */}
                        <div style={{width:36,height:36,borderRadius:'50%',border:`2px solid ${sc}44`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                          <span style={{fontSize:11,fontWeight:300,color:sc}}>{s != null ? s : '—'}</span>
                        </div>
                        {/* info */}
                        <div>
                          <div style={{fontSize:12.5,color: isHL ? 'rgba(158,245,190,0.95)' : 'var(--ink-75)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:420}}>
                            {e.title || 'Evaluación libre'}
                            {isHL && <span className="mono" style={{fontSize:9,marginLeft:8,padding:'2px 7px',background:'rgba(158,245,190,0.15)',borderRadius:4,color:'#9ef5be',letterSpacing:'0.1em'}}>NUEVA</span>}
                          </div>
                          <div className="mono" style={{fontSize:9.5,color:'var(--ink-35)',marginTop:2}}>{sellerName} · {dateStr}</div>
                        </div>
                        {/* status */}
                        <span className="mono" style={{fontSize:9,color:statusColor,letterSpacing:'0.1em',textTransform:'uppercase',whiteSpace:'nowrap'}}>{statusLabel}</span>
                        {/* score badge */}
                        <div style={{minWidth:42,textAlign:'right',fontSize:20,fontWeight:200,color:sc}}>{s != null ? s : '—'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>}
      </div>
      <PersonModal person={drawer} onClose={() => setDrawer(null)}/>
      {profileOpen && (
        <div className="drawer-back" onClick={() => setProfileOpen(false)}>
          <form
            className="glass"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); saveProfile(); }}
            style={{maxWidth:520,margin:'8vh auto',padding:30}}
          >
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
              <div>
                <div className="mono" style={{fontSize:10.5,letterSpacing:'0.22em',color:'var(--ink-50)',textTransform:'uppercase',marginBottom:6}}>Mi perfil</div>
                <h2 style={{fontSize:22,fontWeight:300,letterSpacing:'-0.01em',margin:0}}>Información personal</h2>
              </div>
              <div className="close" onClick={() => setProfileOpen(false)} style={{cursor:'pointer'}}><SIcon name="close" size={14}/></div>
            </div>

            <div style={{display:'flex',alignItems:'center',gap:18,marginBottom:22,padding:'14px 0',borderTop:'1px solid var(--glass-border)',borderBottom:'1px solid var(--glass-border)'}}>
              <div className="avatar" style={{width:64,height:64,fontSize:22}}>
                {(profileDraft.name.split(' ').filter(Boolean).map(s => s[0]).slice(0,2).join('').toUpperCase()) || 'JL'}
              </div>
              <div>
                <div style={{fontSize:15,fontWeight:500}}>{profileDraft.name}</div>
                <div className="mono" style={{fontSize:11,color:'var(--ink-50)',letterSpacing:'0.08em',marginTop:4}}>{profileDraft.role} · {profileDraft.tenant}</div>
              </div>
            </div>

            {[
              ['name', 'Nombre completo'],
              ['email', 'Email'],
              ['phone', 'Teléfono'],
              ['position', 'Cargo'],
            ].map(([key, label]) => (
              <div key={key} style={{marginBottom:12}}>
                <label className="mono" style={{fontSize:10,letterSpacing:'0.18em',color:'var(--ink-50)',textTransform:'uppercase',display:'block',marginBottom:6}}>{label}</label>
                <input
                  type={key === 'email' ? 'email' : 'text'}
                  value={profileDraft[key] || ''}
                  onChange={(e) => setProfileDraft(d => ({ ...d, [key]: e.target.value }))}
                  required={key === 'name' || key === 'email'}
                  style={{width:'100%',padding:'10px 12px',background:'rgba(255,255,255,0.04)',border:'1px solid var(--ink-20)',borderRadius:8,color:'inherit',fontSize:13.5,fontFamily:'inherit'}}
                />
              </div>
            ))}

            {profileSaved && (
              <div className="mono" style={{fontSize:10.5,color:'rgba(120,255,180,0.8)',marginTop:10,letterSpacing:'0.18em',textTransform:'uppercase'}}>
                ✓ Perfil actualizado
              </div>
            )}

            <div style={{display:'flex',gap:10,marginTop:22}}>
              <button type="button" className="btn" style={{flex:1,justifyContent:'center'}} onClick={() => setProfileOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" style={{flex:1,justifyContent:'center'}}>
                <SIcon name="download" size={13}/> Guardar
              </button>
            </div>
          </form>
        </div>
      )}
      {coachingPlan && (
        <div className="drawer-back" onClick={() => setCoachingPlan(null)}>
          <div
            className="glass"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth:680,margin:'5vh auto',padding:32,maxHeight:'90vh',overflowY:'auto'
            }}
          >
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
              <div>
                <div className="mono" style={{fontSize:10.5,letterSpacing:'0.22em',color:'var(--ink-50)',textTransform:'uppercase',marginBottom:6}}>
                  Plan de coaching · IA
                </div>
                <h2 style={{fontSize:24,fontWeight:300,letterSpacing:'-0.01em',margin:0}}>Recomendaciones priorizadas</h2>
                <div className="mono" style={{fontSize:11,color:'var(--ink-50)',marginTop:8}}>
                  Generado: {coachingPlan.generatedAt} · Costo: {TOKEN_COSTS.coachingPlan} tokens · Saldo restante: {tokens}
                </div>
              </div>
              <div className="close" onClick={() => setCoachingPlan(null)} style={{cursor:'pointer'}}>
                <SIcon name="close" size={14}/>
              </div>
            </div>

            <div className="insight-block" style={{marginBottom:18}}>
              <div className="insight-label">Resumen del análisis</div>
              <div className="insight-value" style={{fontSize:16}}>{coachingPlan.summary}</div>
            </div>

            {coachingPlan.items.length === 0 ? (
              <div className="mono" style={{fontSize:13,color:'var(--ink-50)',padding:24,textAlign:'center'}}>
                Tu equipo está en buena forma · ningún vendedor requiere intervención urgente.
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {coachingPlan.items.map((it, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding:16,
                      border:'1px solid var(--ink-20)',
                      borderRadius:10,
                      borderLeft: it.priority === 'alta' ? '3px solid #fca5a5' : '3px solid #fcd34d',
                    }}
                  >
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                      <div>
                        <div style={{fontSize:15,fontWeight:500}}>{it.person}</div>
                        <div className="mono" style={{fontSize:10,color:'var(--ink-50)',letterSpacing:'0.18em',textTransform:'uppercase',marginTop:2}}>
                          {it.role} · score {it.score}/100
                        </div>
                      </div>
                      <span
                        className="mono"
                        style={{
                          fontSize:10,padding:'4px 9px',borderRadius:6,height:'fit-content',
                          background: it.priority === 'alta' ? 'rgba(252,165,165,0.12)' : 'rgba(252,211,77,0.12)',
                          color: it.priority === 'alta' ? '#fca5a5' : '#fcd34d',
                          letterSpacing:'0.18em',textTransform:'uppercase',
                        }}
                      >Prioridad {it.priority}</span>
                    </div>
                    <div style={{fontSize:13,color:'var(--ink-70)',marginTop:6}}>
                      <strong style={{color:'var(--ink-90)'}}>Foco:</strong> {it.weakness}
                    </div>
                    <div style={{fontSize:13,color:'var(--ink-70)',marginTop:4}}>
                      <strong style={{color:'var(--ink-90)'}}>Acción sugerida:</strong> {it.action}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{display:'flex',gap:10,marginTop:24}}>
              <button className="btn" style={{flex:1,justifyContent:'center'}} onClick={() => setCoachingPlan(null)}>
                Cerrar
              </button>
              <button
                className="btn btn-primary"
                style={{flex:1,justifyContent:'center'}}
                onClick={() => {
                  const css = `
                    @page { size: A4; margin: 18mm; }
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; color:#1a1a1a; margin:0; padding:24px; }
                    h1 { font-size:22px; margin:0 0 4px; letter-spacing:0.18em; }
                    h2 { font-size:15px; font-weight:400; margin:0 0 18px; color:#555; }
                    h3 { font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#777; margin:22px 0 10px; }
                    .meta { font-size:11px; color:#888; margin-bottom:18px; font-family:'JetBrains Mono',monospace; }
                    hr { border:0; border-top:1px solid #ddd; margin:12px 0 18px; }
                    .row { padding:12px 14px; border:1px solid #e0e0e0; border-radius:8px; margin-bottom:10px; }
                    .row.high { border-left:3px solid #e57373; }
                    .row.med { border-left:3px solid #fbbf24; }
                    .row-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
                    .name { font-size:14px; font-weight:500; }
                    .role { font-size:11px; color:#777; font-family:'JetBrains Mono',monospace; }
                    .badge { font-size:9px; padding:3px 8px; border-radius:4px; font-weight:600; letter-spacing:0.1em; }
                    .badge.high { background:#fee2e2; color:#b91c1c; }
                    .badge.med { background:#fef3c7; color:#92400e; }
                    .field { font-size:12px; color:#444; margin-top:4px; }
                    .field strong { color:#111; }
                    .summary { padding:14px 18px; border:1px solid #e0e0e0; border-radius:8px; background:#fafafa; font-size:13px; }
                    .footer { margin-top:30px; padding-top:12px; border-top:1px solid #ddd; font-size:10px; color:#999; font-family:'JetBrains Mono',monospace; }`;

                  const items = coachingPlan.items.map((it,i) => `
                    <div class="row ${it.priority === 'alta' ? 'high' : 'med'}">
                      <div class="row-head">
                        <div><span class="name">${i+1}. ${it.person}</span> &nbsp;<span class="role">${it.role} · score ${it.score}/100</span></div>
                        <span class="badge ${it.priority === 'alta' ? 'high' : 'med'}">PRIORIDAD ${it.priority.toUpperCase()}</span>
                      </div>
                      <div class="field"><strong>Foco:</strong> ${it.weakness}</div>
                      <div class="field"><strong>Acción sugerida:</strong> ${it.action}</div>
                    </div>`).join('');

                  const body = `
                    <h1>APEX VISION</h1>
                    <h2>Plan de Coaching · IA</h2>
                    <hr/>
                    <div class="meta">Generado: ${coachingPlan.generatedAt} · Costo: ${TOKEN_COSTS.coachingPlan} tokens · Saldo restante: ${tokens}</div>
                    <h3>Resumen del análisis</h3>
                    <div class="summary">${coachingPlan.summary}</div>
                    <h3>Recomendaciones priorizadas</h3>
                    ${coachingPlan.items.length === 0
                      ? '<p style="font-size:12px;color:#666;font-style:italic">Tu equipo está en buena forma. Ningún vendedor requiere intervención urgente.</p>'
                      : items}
                    <div class="footer">Apex Vision · Sales Evaluator · Generado por IA</div>`;

                  const w = window.open('', '_blank', 'width=900,height=700');
                  if (!w) { alert('Permite ventanas emergentes para descargar el PDF.'); return; }
                  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Plan de Coaching</title><style>${css}</style></head><body>${body}<script>window.onload=()=>{setTimeout(()=>{window.print();},200);};</script></body></html>`);
                  w.document.close();
                }}
              >
                <SIcon name="download" size={13}/> Exportar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================
   ADMIN LOGIN — pantalla de autenticación para el panel admin
   ============================================================ */
const AdminLogin = ({ onSuccess }) => {
  window.useLang(); const L = window.L;
  const [email, setEmail]       = useState('admin.demo@jupiter.local');
  const [password, setPassword] = useState('Demo1234!');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await window.ApexAPI.login(email, password);
      onSuccess();
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('401') || msg.includes('Login failed')) {
        setError(L('Email o contraseña incorrectos.', 'Incorrect email or password.'));
      } else {
        setError(L('No se pudo conectar con el servidor. Verificá tu conexión.', 'Could not reach the server. Check your connection.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = { width: '100%', padding: '11px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13, boxSizing: 'border-box' };
  const Spinner = () => <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />;

  return (
    <div id="app">
      <div className="s-shell">
        <div style={{ padding: '40px 24px' }} />
        <div className="s-stage">
          <div className="s-wrap" style={{ maxWidth: 420 }}>
            <div className="glass" style={{ padding: 36, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <ApexLogo size={44} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 200, letterSpacing: '-0.02em', marginBottom: 4 }}>Apex Vision</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--ink-40)', marginBottom: 6, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                {L('Panel de administración', 'Admin panel')}
              </div>
              <div className="mono" style={{ fontSize: 9, color: 'rgba(158,245,190,0.5)', marginBottom: 28, letterSpacing: '0.16em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 4, background: 'rgba(158,245,190,0.05)', display: 'inline-block' }}>
                Admin Console
              </div>

              <form onSubmit={handleLogin} style={{ display: 'grid', gap: 12, textAlign: 'left' }}>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder={L('Email de administrador', 'Admin email')} required autoComplete="email" style={inputStyle} />
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={L('Contraseña', 'Password')} required autoComplete="current-password"
                    style={{ ...inputStyle, padding: '11px 42px 11px 14px' }} />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-40)', padding: 4, display: 'flex', alignItems: 'center' }}>
                    <SIcon name={showPass ? 'eye-off' : 'eye'} size={15} stroke={1.5} />
                  </button>
                </div>
                <button type="submit" className="btn" disabled={busy}
                  style={{ width: '100%', justifyContent: 'center', padding: '13px', opacity: busy ? 0.7 : 1, transition: 'opacity 150ms' }}>
                  {busy
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}><Spinner /> {L('Conectando…', 'Connecting…')}</span>
                    : L('Ingresar al panel', 'Sign in to panel')}
                </button>
                {error && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 7, background: 'rgba(252,165,165,0.08)', border: '1px solid rgba(252,165,165,0.2)' }}>
                    <span style={{ color: '#fca5a5', fontSize: 13, marginTop: 1 }}>!</span>
                    <span className="mono" style={{ fontSize: 11, color: '#fca5a5', lineHeight: 1.55 }}>{error}</span>
                  </div>
                )}
              </form>

              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <a href="/seller" style={{ fontSize: 12, color: 'var(--ink-35)', textDecoration: 'none' }}>
                  {L('← Ir al portal de vendedores', '← Go to the seller portal')}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

/* ============================================================
   ADMIN ROOT — auth gate
   ============================================================ */
const AdminRoot = () => {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Si hay token válido, entrar directo
    const token = localStorage.getItem('apex_access_token');
    if (token) {
      window.ApexAPI.getMe()
        .then(() => setAuthed(true))
        .catch(() => { window.ApexAPI.logout(); setAuthed(false); })
        .finally(() => setChecking(false));
    } else {
      window.ApexAPI.logout();
      setChecking(false);
    }
    const onExpired = () => { window.ApexAPI.logout(); setAuthed(false); };
    window.addEventListener('apex:session-expired', onExpired);
    return () => window.removeEventListener('apex:session-expired', onExpired);
  }, []);

  if (checking) return null;
  if (!authed) return <AdminLogin onSuccess={() => setAuthed(true)} />;
  return <AdminApp />;
};

ReactDOM.createRoot(document.getElementById('root')).render(<AdminRoot />);
