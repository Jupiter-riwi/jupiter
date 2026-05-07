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

const DIMENSIONS = ['Confianza', 'Claridad', 'Lenguaje corporal', 'Ritmo de voz', 'Escucha activa'];
const STATUS_LABEL = {
  'on-track':       'En camino',
  'improving':      'Mejorando',
  'watch':          'Observar',
  'needs-coaching': 'Requiere coaching',
};

/* ----------------------------- KPI ----------------------------- */
const Kpi = ({ label, value, unit, delta, sparkId, data }) => {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) AVSpark(ref.current, data, { id: sparkId }); }, []);
  return (
    <div className="glass kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}<span style={{fontSize:14,color:'var(--ink-50)',marginLeft:4}}>{unit}</span></div>
      <svg ref={ref} className="kpi-spark"/>
      <div className="kpi-delta">{delta}</div>
    </div>
  );
};

/* ----------------------------- TOP BAR ----------------------------- */
const NAV_ITEMS = ['equipo', 'preguntas', 'reportes', 'ajustes'];
const NAV_LABELS = { equipo: 'Equipo', preguntas: 'Preguntas', reportes: 'Reportes', ajustes: 'Ajustes' };

const AdminTop = ({ user, page, onNav }) => (
  <div className="s-topbar">
    <div style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}} onClick={() => onNav('equipo')}>
      <ApexLogo size={34}/>
      <div style={{lineHeight:1}}>
        <div style={{fontSize:13,fontWeight:500,letterSpacing:'0.18em',color:'var(--ink-90)'}}>APEX</div>
        <div style={{fontSize:9,letterSpacing:'0.28em',color:'var(--ink-50)',marginTop:1}}>VISION</div>
      </div>
    </div>
    <div style={{display:'flex',gap:4}}>
      {NAV_ITEMS.map(id => (
        <a key={id} onClick={() => onNav(id)} style={{
          padding:'8px 16px', fontSize:12.5, borderRadius:999, letterSpacing:'0.04em', cursor:'pointer',
          color: page === id ? 'var(--ink-100)' : 'var(--ink-60)',
          background: page === id ? 'rgba(255,255,255,0.08)' : 'transparent',
          transition: 'background 150ms, color 150ms',
        }}>
          {NAV_LABELS[id]}
        </a>
      ))}
    </div>
    <div style={{display:'flex',alignItems:'center',gap:14}}>
      <div className="mono" style={{fontSize:10.5,color:'var(--ink-50)',letterSpacing:'0.12em',textAlign:'right',textTransform:'uppercase'}}>
        {user.tenant}<br/>
        <span style={{color:'var(--ink-30)'}}>{user.role}</span>
      </div>
      <div className="avatar">{user.initials}</div>
    </div>
  </div>
);

/* ----------------------------- TEAM ROW ----------------------------- */
const TeamRow = ({ p, onOpen }) => (
  <div className="t-row" onClick={() => onOpen(p)}>
    <div className="t-avatar">{p.name.split(' ').map(s=>s[0]).join('').slice(0,2)}</div>
    <div>
      <div className="t-name">{p.name}</div>
      <div className="t-meta">{p.role} · {p.evals} evaluaciones · última {p.last}</div>
    </div>
    <div className="t-mini">
      <MiniRadar values={p.skills}/>
    </div>
    <div className={`t-status s-${p.status}`}>
      <span className="dot"/>{STATUS_LABEL[p.status]}
    </div>
    <div className="t-score-block">
      <div className={`t-score ${p.score>=80?'high':''}`}>{p.score}</div>
      <div className="t-trend">{p.trend}</div>
    </div>
    <div style={{color:'var(--ink-50)'}}><SIcon name="arrow" size={14}/></div>
  </div>
);

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
        {DIMENSIONS.map(d => <div key={d} className="hmap-col-label">{d}</div>)}
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

/* ----------------------------- DRAWER (drill-down) ----------------------------- */
const PersonDrawer = ({ person, onClose }) => {
  if (!person) return null;
  return (
    <div className="drawer-back" onClick={onClose}>
      <div className="drawer glass glass-strong" onClick={e => e.stopPropagation()}>
        <div className="drawer-head">
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div className="t-avatar" style={{width:44,height:44,fontSize:14}}>{person.name.split(' ').map(s=>s[0]).join('').slice(0,2)}</div>
            <div>
              <div style={{fontSize:18,fontWeight:400,letterSpacing:'-0.005em'}}>{person.name}</div>
              <div className="mono" style={{fontSize:10.5,color:'var(--ink-50)',letterSpacing:'0.08em',marginTop:2}}>{person.role.toUpperCase()} · {person.evals} EVALUACIONES</div>
            </div>
          </div>
          <div className="rec-head" style={{padding:0}}>
            <div className="close" onClick={onClose}><SIcon name="close" size={14}/></div>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'180px 1fr',gap:24,alignItems:'center',padding:'8px 4px 24px',borderBottom:'1px solid var(--glass-border)'}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:56,fontWeight:200,letterSpacing:'-0.03em',lineHeight:1}}>{person.score}</div>
            <div className="mono" style={{fontSize:10,letterSpacing:'0.22em',color:'var(--ink-50)',textTransform:'uppercase',marginTop:4}}>SCORE GLOBAL</div>
            <div className="mono" style={{fontSize:10.5,color:'var(--ink-70)',marginTop:8,letterSpacing:'0.08em'}}>{person.trend} VS MES ANTERIOR</div>
          </div>
          <div className="dim-grid">
            {DIMENSIONS.map((d,i) => (
              <div key={d} className="dim-card">
                <div className="mono" style={{fontSize:10,color:'var(--ink-50)',letterSpacing:'0.16em',textTransform:'uppercase'}}>{d}</div>
                <div style={{fontSize:22,fontWeight:300,marginTop:6,letterSpacing:'-0.01em',fontVariantNumeric:'tabular-nums'}}>{person.skills[i]}</div>
                <div className="bar-track" style={{marginTop:8}}><div className="bar-fill" style={{width:`${person.skills[i]}%`}}/></div>
              </div>
            ))}
          </div>
        </div>

        <div style={{padding:'20px 4px 4px'}}>
          <div className="mono" style={{fontSize:10.5,letterSpacing:'0.22em',color:'var(--ink-50)',textTransform:'uppercase',marginBottom:14}}>Evaluaciones recientes</div>
          {[
            ['Manejo de objeción: precio', 'hoy 16:08', 84],
            ['Apertura en frío', 'ayer 11:22', 81],
            ['Discovery: detectar dolor', 'lun 17:05', 78],
            ['Cierre consultivo', '23 mar 11:30', 76],
          ].map(([t,d,s],i) => (
            <div key={i} className="h-row" style={{margin:0,padding:'12px 0',borderTop:i>0?'1px solid var(--glass-border)':'none',cursor:'default'}}>
              <div className={`h-score ${s>=80?'high':''}`}>{s}</div>
              <div>
                <div className="h-title">{t}</div>
                <div className="h-sub">{d}</div>
              </div>
              <div className="h-trend">→ ver</div>
              <div className="h-arrow"><SIcon name="arrow" size={14}/></div>
            </div>
          ))}
        </div>

        <div style={{padding:'20px 4px 4px'}}>
          <div className="mono" style={{fontSize:10.5,letterSpacing:'0.22em',color:'var(--ink-50)',textTransform:'uppercase',marginBottom:14}}>Áreas a trabajar (sugerencia IA)</div>
          {[
            ['Bajar la velocidad al hablar de precio', 'WPM promedio 184 vs objetivo 150 cuando menciona costos.'],
            ['Eliminar muletillas “este…” y “como que”', '11 ocurrencias en últimas 5 evaluaciones.'],
            ['Sostener la mirada en el cierre', 'Contacto visual cae al 42% en los últimos 15 segundos.'],
          ].map(([t,d],i) => (
            <div key={i} className="rec" style={{borderTopColor:'var(--glass-border)'}}>
              <div className="priority high"><span className="dot"/> SUGERENCIA</div>
              <div className="tip">{t}</div>
              <div className="drill">{d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ----------------------------- VISTA PREGUNTAS ----------------------------- */
const PreguntasView = () => {
  const QUESTIONS = [
    { id:1, title:'Pitch de producto 90s', category:'Pitch · Producto', uses:47, avgScore:78, difficulty:'Media' },
    { id:2, title:'Apertura en frío', category:'Apertura', uses:38, avgScore:72, difficulty:'Alta' },
    { id:3, title:'Presentación ejecutiva', category:'Ejecutivo', uses:22, avgScore:80, difficulty:'Alta' },
    { id:4, title:'Manejo de objeciones · precio', category:'Objeciones', uses:41, avgScore:69, difficulty:'Alta' },
    { id:5, title:'Cierre consultivo', category:'Cierre', uses:29, avgScore:74, difficulty:'Media' },
    { id:6, title:'Discovery: detectar dolor', category:'Discovery', uses:33, avgScore:81, difficulty:'Media' },
  ];
  return (
    <div className="s-stage"><div className="s-wrap" style={{maxWidth:1280}}>
      <div className="s-greet">
        <h1><small>Banco de preguntas</small>Escenarios de evaluación</h1>
        <button className="btn btn-primary"><SIcon name="sparkle" size={13}/> Nueva pregunta</button>
      </div>
      <div className="glass" style={{padding:0}}>
        <div className="section-head"><h3>Todos los escenarios</h3><span className="label">{QUESTIONS.length} ACTIVOS</span></div>
        {QUESTIONS.map((q,i) => (
          <div key={q.id} style={{display:'grid',gridTemplateColumns:'1fr 140px 80px 80px 100px 40px',gap:16,alignItems:'center',padding:'14px 22px',borderTop:i>0?'1px solid var(--glass-border)':'none'}}>
            <div>
              <div style={{fontSize:13.5,fontWeight:500,marginBottom:3}}>{q.title}</div>
              <div className="mono" style={{fontSize:10.5,color:'var(--ink-50)',letterSpacing:'0.08em'}}>{q.category}</div>
            </div>
            <div className="mono" style={{fontSize:11,color:'var(--ink-50)',letterSpacing:'0.06em'}}>{q.uses} usos</div>
            <div className={`t-score ${q.avgScore>=80?'high':''}`}>{q.avgScore}</div>
            <div className="mono" style={{fontSize:10.5,color:'var(--ink-50)',letterSpacing:'0.06em'}}>{q.difficulty}</div>
            <button className="btn" style={{padding:'6px 12px',fontSize:11}}>Editar</button>
            <div style={{color:'var(--ink-40)',cursor:'pointer'}}><SIcon name="close" size={13}/></div>
          </div>
        ))}
      </div>
    </div></div>
  );
};

/* ----------------------------- VISTA REPORTES ----------------------------- */
const ReportesView = () => (
  <div className="s-stage"><div className="s-wrap" style={{maxWidth:1280}}>
    <div className="s-greet">
      <h1><small>Reportes</small>Exportar datos del equipo</h1>
      <div className="pillbar">
        <button className="on">30D</button><button>90D</button><button>Todo</button>
      </div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:18}}>
      {[
        { title:'Reporte de equipo · PDF', desc:'Score general, dimensiones y tendencia de los últimos 30 días.', icon:'download' },
        { title:'Detalle por vendedor · CSV', desc:'Todas las evaluaciones con timestamps, scores y dimensiones.', icon:'download' },
        { title:'Plan de coaching · PDF', desc:'Sugerencias de IA personalizadas por vendedor priorizadas por impacto.', icon:'sparkle' },
      ].map(r => (
        <div key={r.title} className="glass" style={{padding:24}}>
          <div style={{marginBottom:14,color:'var(--ink-60)'}}><SIcon name={r.icon} size={22} stroke={1.2}/></div>
          <div style={{fontSize:14,fontWeight:500,marginBottom:8}}>{r.title}</div>
          <div style={{fontSize:12.5,color:'var(--ink-50)',lineHeight:1.6,marginBottom:18}}>{r.desc}</div>
          <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',padding:'10px'}}><SIcon name="download" size={12}/> Generar</button>
        </div>
      ))}
    </div>
    <div className="glass" style={{padding:0}}>
      <div className="section-head"><h3>Historial de reportes</h3></div>
      {[
        ['Reporte equipo · Abril 2026','PDF','hace 3 días','2.4 MB'],
        ['Detalle vendedores · Abril 2026','CSV','hace 3 días','180 KB'],
        ['Plan de coaching · Q1 2026','PDF','hace 32 días','1.1 MB'],
      ].map(([name,type,date,size],i) => (
        <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 60px 120px 80px 80px',gap:16,alignItems:'center',padding:'14px 22px',borderTop:i>0?'1px solid var(--glass-border)':'none'}}>
          <div style={{fontSize:13}}>{name}</div>
          <div className="mono" style={{fontSize:10.5,color:'var(--ink-50)'}}>{type}</div>
          <div className="mono" style={{fontSize:10.5,color:'var(--ink-50)'}}>{date}</div>
          <div className="mono" style={{fontSize:10.5,color:'var(--ink-50)'}}>{size}</div>
          <button className="btn" style={{padding:'6px 12px',fontSize:11}}><SIcon name="download" size={11}/> Descargar</button>
        </div>
      ))}
    </div>
  </div></div>
);

/* ----------------------------- VISTA AJUSTES ----------------------------- */
const AjustesView = () => (
  <div className="s-stage"><div className="s-wrap" style={{maxWidth:820}}>
    <div className="s-greet"><h1><small>Ajustes</small>Configuración de cuenta</h1></div>
    <div style={{display:'grid',gap:14}}>
      {[
        { section:'Empresa', fields:[['Nombre de la empresa','Northwind Sales'],['Industria','Tecnología B2B'],['País','Argentina']] },
        { section:'Evaluaciones', fields:[['Duración máxima de grabación','3 minutos'],['Retención de videos','30 días'],['Idioma de evaluación','Español']] },
        { section:'Notificaciones', fields:[['Resumen semanal por email','Activado'],['Alertas de bajo rendimiento','Activado'],['Nuevas evaluaciones','Desactivado']] },
      ].map(({ section, fields }) => (
        <div key={section} className="glass" style={{padding:'24px 28px'}}>
          <div className="mono" style={{fontSize:10.5,letterSpacing:'0.22em',color:'var(--ink-50)',textTransform:'uppercase',marginBottom:18}}>{section}</div>
          {fields.map(([label, val], i) => (
            <div key={label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderTop:i>0?'1px solid var(--glass-border)':'none'}}>
              <div style={{fontSize:13,color:'var(--ink-80)'}}>{label}</div>
              <div style={{fontSize:13,color:'var(--ink-50)',fontFamily:'var(--font-mono)',letterSpacing:'0.04em'}}>{val}</div>
            </div>
          ))}
        </div>
      ))}
      <button className="btn" style={{color:'rgba(255,80,80,0.7)',borderColor:'rgba(255,80,80,0.2)',alignSelf:'flex-start'}}>Cerrar sesión</button>
    </div>
  </div></div>
);

/* ----------------------------- MAIN VIEW ----------------------------- */
const AdminApp = () => {
  const [time, setTime] = useState(new Date());
  const [drawer, setDrawer] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [page, setPage] = useState('equipo');
  const user = { tenant: 'NORTHWIND', role: 'ADMIN', initials: 'JL' };

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const teamAvg = Math.round(TEAM.reduce((s,p) => s + p.score, 0) / TEAM.length);
  const totalEvals = TEAM.reduce((s,p) => s + p.evals, 0);
  const needsCoach = TEAM.filter(p => p.status === 'needs-coaching').length;

  return (
    <div id="app">
      <div className="s-shell">
        <AdminTop user={user} page={page} onNav={setPage}/>
        {page === 'preguntas' && <PreguntasView/>}
        {page === 'reportes'  && <ReportesView/>}
        {page === 'ajustes'   && <AjustesView/>}
        {page === 'equipo' && <div className="s-stage">
          <div className="s-wrap" style={{maxWidth:1280}}>
            <div className="s-greet">
              <h1>
                <small>Equipo · {user.tenant}</small>
                Hola Juliana
              </h1>
              <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
                <div className="pillbar">
                  <button className={period==='7d'?'on':''} onClick={()=>setPeriod('7d')}>7D</button>
                  <button className={period==='30d'?'on':''} onClick={()=>setPeriod('30d')}>30D</button>
                  <button className={period==='90d'?'on':''} onClick={()=>setPeriod('90d')}>90D</button>
                </div>
                <button className="btn"><SIcon name="download" size={13}/> Exportar reporte</button>
              </div>
            </div>

            <div className="kpis" style={{marginBottom:18}}>
              <Kpi label="Score promedio del equipo" value={teamAvg} unit="/100" delta="+ 4 vs mes anterior" sparkId="a1" data={[68,70,69,72,73,72,75,74,76,75,76,teamAvg]}/>
              <Kpi label="Evaluaciones · 30d" value={totalEvals} unit="" delta="↑ 18% participación" sparkId="a2" data={[6,8,12,9,14,18,16,20,22,19,24,totalEvals]}/>
              <Kpi label="Vendedores activos" value={TEAM.length} unit={`/${TEAM.length}`} delta="100% activos esta semana" sparkId="a3" data={[5,6,6,7,7,8,8,8,8,8,8,8]}/>
              <Kpi label="Requieren coaching" value={needsCoach} unit="" delta="2 desde la semana pasada" sparkId="a4" data={[1,1,2,1,2,2,2,3,2,2,2,needsCoach]}/>
            </div>

            <div className="grid-dash" style={{gridTemplateColumns:'2fr 1fr',marginBottom:18}}>
              {/* TEAM LIST */}
              <div className="glass" style={{padding:0}}>
                <div className="section-head">
                  <h3>Tu equipo</h3>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <div className="pillbar">
                      <button className="on">Todos</button><button>Senior</button><button>Mid</button><button>Junior</button>
                    </div>
                  </div>
                </div>
                <div className="t-list">
                  {TEAM.map(p => <TeamRow key={p.id} p={p} onOpen={setDrawer}/>)}
                </div>
              </div>

              {/* INSIGHTS */}
              <div className="glass" style={{padding:24}}>
                <div className="mono" style={{fontSize:10.5,letterSpacing:'0.22em',color:'var(--ink-50)',textTransform:'uppercase',marginBottom:14}}>Insights del equipo</div>

                <div className="insight-block">
                  <div className="insight-label">Fortaleza del equipo</div>
                  <div className="insight-value">Escucha activa</div>
                  <div className="insight-meta">79 promedio · +6 vs mes anterior</div>
                </div>
                <div className="insight-block">
                  <div className="insight-label">Punto débil</div>
                  <div className="insight-value">Ritmo de voz</div>
                  <div className="insight-meta">68 promedio · 5 vendedores hablan {'>'}170 WPM</div>
                </div>
                <div className="insight-block">
                  <div className="insight-label">Top performer del mes</div>
                  <div className="insight-value">Mariana Aimar</div>
                  <div className="insight-meta">84 score · 24 evaluaciones · racha de 7 días</div>
                </div>
                <div className="insight-block">
                  <div className="insight-label">Mayor mejora</div>
                  <div className="insight-value">Tomás Iriarte</div>
                  <div className="insight-meta">+11 puntos · de Junior a borde de Mid</div>
                </div>

                <button className="btn" style={{width:'100%',justifyContent:'center',marginTop:18}}>
                  <SIcon name="sparkle" size={13}/> Generar plan de coaching con IA
                </button>
              </div>
            </div>

            {/* HEATMAP */}
            <div className="glass" style={{padding:0,marginBottom:18}}>
              <div className="section-head">
                <h3>Mapa de habilidades · equipo × dimensión</h3>
                <span className="label">PROMEDIO {period.toUpperCase()}</span>
              </div>
              <div style={{padding:'14px 22px 22px',overflowX:'auto'}}>
                <Heatmap/>
              </div>
            </div>

            {/* QUESTIONS / CATEGORIES */}
            <div className="grid-dash" style={{gridTemplateColumns:'1fr 1fr'}}>
              <div className="glass" style={{padding:24}}>
                <div className="mono" style={{fontSize:10.5,letterSpacing:'0.22em',color:'var(--ink-50)',textTransform:'uppercase',marginBottom:16}}>Desempeño por categoría de pregunta</div>
                <div className="bars">
                  {[
                    ['Apertura en frío',     76],
                    ['Discovery',            81],
                    ['Pitch · producto',     78],
                    ['Manejo de objeciones', 72],
                    ['Cierre consultivo',    74],
                    ['Negociación',          69],
                  ].map(([n,v])=>(
                    <div key={n} className="bar-row">
                      <span className="name">{n}</span>
                      <div className="bar-track"><div className="bar-fill" style={{width:`${v}%`}}/></div>
                      <span className="val">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass" style={{padding:24}}>
                <div className="mono" style={{fontSize:10.5,letterSpacing:'0.22em',color:'var(--ink-50)',textTransform:'uppercase',marginBottom:16}}>Actividad reciente del equipo</div>
                {[
                  ['Mariana Aimar',  'completó · Manejo de objeción: precio', '84', 'hace 12 min'],
                  ['Tomás Iriarte',  'completó · Pitch de 30 segundos',       '72', 'hace 1 h'],
                  ['Lucía Fernández','completó · Apertura en frío',           '74', 'hace 2 h'],
                  ['Federico Lozada','completó · Discovery',                  '83', 'hace 4 h'],
                  ['Carolina Méndez','completó · Cierre consultivo',          '79', 'ayer'],
                ].map(([n,a,s,t],i)=>(
                  <div key={i} style={{display:'grid',gridTemplateColumns:'auto 1fr auto auto',gap:12,alignItems:'center',padding:'10px 0',borderTop:i>0?'1px solid var(--glass-border)':'none'}}>
                    <div className="t-avatar" style={{width:30,height:30,fontSize:10}}>{n.split(' ').map(s=>s[0]).join('').slice(0,2)}</div>
                    <div>
                      <div style={{fontSize:12.5,fontWeight:500}}>{n}</div>
                      <div className="mono" style={{fontSize:10.5,color:'var(--ink-50)',marginTop:2,letterSpacing:'0.04em'}}>{a}</div>
                    </div>
                    <div className={`h-score ${parseInt(s)>=80?'high':''}`} style={{width:36,height:36,fontSize:11}}>{s}</div>
                    <div className="mono" style={{fontSize:10,color:'var(--ink-50)',letterSpacing:'0.08em',width:60,textAlign:'right'}}>{t}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>}
      </div>
      <PersonDrawer person={drawer} onClose={() => setDrawer(null)}/>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<AdminApp/>);
