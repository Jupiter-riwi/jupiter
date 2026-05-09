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

const AdminTop = ({ user, page, onNav, onLogout, onProfile }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
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
      <div ref={ref} style={{display:'flex',alignItems:'center',gap:14,position:'relative'}}>
        <div className="mono" style={{fontSize:10.5,color:'var(--ink-50)',letterSpacing:'0.12em',textAlign:'right',textTransform:'uppercase'}}>
          {user.tenant}<br/>
          <span style={{color:'var(--ink-30)'}}>{user.role}</span>
        </div>
        <div
          className="avatar"
          style={{cursor:'pointer'}}
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
              <SIcon name="sparkle" size={13}/> Mi perfil
            </button>
            <button
              onClick={() => { setOpen(false); onNav('ajustes'); }}
              style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 14px',background:'transparent',border:0,color:'var(--ink-80)',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:6}}
              onMouseOver={(e) => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
              onMouseOut={(e) => e.currentTarget.style.background='transparent'}
            >
              <SIcon name="download" size={13}/> Configuración
            </button>
            <div style={{height:1,background:'var(--glass-border)',margin:'4px 0'}}/>
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 14px',background:'transparent',border:0,color:'rgba(255,80,80,0.8)',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:6}}
              onMouseOver={(e) => e.currentTarget.style.background='rgba(255,80,80,0.08)'}
              onMouseOut={(e) => e.currentTarget.style.background='transparent'}
            >
              <SIcon name="close" size={13}/> Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

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

  return (
    <div className="s-stage"><div className="s-wrap" style={{maxWidth:1280}}>
      <div className="s-greet">
        <h1><small>Banco de preguntas</small>Escenarios de evaluación</h1>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          <SIcon name="sparkle" size={13}/> Nueva pregunta
        </button>
      </div>
      <div className="glass" style={{padding:0}}>
        <div className="section-head"><h3>Todos los escenarios</h3><span className="label">{questions.length} ACTIVOS</span></div>
        {questions.length === 0 ? (
          <div style={{padding:40,textAlign:'center',color:'var(--ink-50)',fontSize:13}}>
            No hay preguntas · crea la primera con "Nueva pregunta"
          </div>
        ) : questions.map((q,i) => (
          <div key={q.id} style={{display:'grid',gridTemplateColumns:'1fr 140px 80px 80px 100px 40px',gap:16,alignItems:'center',padding:'14px 22px',borderTop:i>0?'1px solid var(--glass-border)':'none'}}>
            <div>
              <div style={{fontSize:13.5,fontWeight:500,marginBottom:3}}>{q.title}</div>
              <div className="mono" style={{fontSize:10.5,color:'var(--ink-50)',letterSpacing:'0.08em'}}>{q.category}</div>
            </div>
            <div className="mono" style={{fontSize:11,color:'var(--ink-50)',letterSpacing:'0.06em'}}>{q.uses} usos</div>
            <div className={`t-score ${q.avgScore>=80?'high':''}`}>{q.avgScore || '—'}</div>
            <div className="mono" style={{fontSize:10.5,color:'var(--ink-50)',letterSpacing:'0.06em'}}>{q.difficulty}</div>
            <button className="btn" style={{padding:'6px 12px',fontSize:11}} onClick={() => setEditing(q)}>Editar</button>
            <div
              style={{color:'var(--ink-40)',cursor:'pointer',display:'flex',justifyContent:'center'}}
              onClick={() => handleDelete(q.id)}
              title="Eliminar pregunta"
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

  return (
    <div className="s-stage"><div className="s-wrap" style={{maxWidth:1280}}>
      <div className="s-greet">
        <h1><small>Reportes</small>Exportar datos del equipo</h1>
        <div className="pillbar">
          {['30d','90d','todo'].map(p => (
            <button key={p} className={period===p?'on':''} onClick={() => setPeriod(p)}>
              {p === 'todo' ? 'Todo' : p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:18}}>
        {reports.map(r => (
          <div key={r.key} className="glass" style={{padding:24,display:'flex',flexDirection:'column'}}>
            <div style={{marginBottom:14,color:'var(--ink-60)'}}><SIcon name={r.icon} size={22} stroke={1.2}/></div>
            <div style={{fontSize:14,fontWeight:500,marginBottom:8}}>{r.title}</div>
            <div style={{fontSize:12.5,color:'var(--ink-50)',lineHeight:1.6,marginBottom:18,flex:1}}>{r.desc}</div>
            <button
              className="btn btn-primary"
              style={{width:'100%',justifyContent:'center',padding:'10px',display:'inline-flex',alignItems:'center',gap:6}}
              onClick={() => generate(r)}
              disabled={busy === r.key}
            >
              <SIcon name="download" size={12}/>
              {busy === r.key ? 'Generando...' : 'Generar'}
            </button>
          </div>
        ))}
      </div>
      <div className="glass" style={{padding:0}}>
        <div className="section-head"><h3>Historial de reportes</h3></div>
        {history.length === 0 ? (
          <div style={{padding:30,textAlign:'center',color:'var(--ink-50)',fontSize:13}}>Sin reportes generados</div>
        ) : history.map((item,i) => (
          <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 60px 120px 80px 110px',gap:16,alignItems:'center',padding:'14px 22px',borderTop:i>0?'1px solid var(--glass-border)':'none'}}>
            <div style={{fontSize:13}}>{item.name}</div>
            <div className="mono" style={{fontSize:10.5,color:'var(--ink-50)'}}>{item.type}</div>
            <div className="mono" style={{fontSize:10.5,color:'var(--ink-50)'}}>{item.date}</div>
            <div className="mono" style={{fontSize:10.5,color:'var(--ink-50)'}}>{item.size}</div>
            <button
              className="btn"
              style={{padding:'6px 12px',fontSize:11,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6}}
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

  return (
    <div className="s-stage"><div className="s-wrap" style={{maxWidth:820}}>
      <div className="s-greet">
        <h1><small>Ajustes</small>Configuración de cuenta</h1>
        {savedAt && !dirty && (
          <div className="mono" style={{fontSize:10.5,color:'rgba(120,255,180,0.7)',letterSpacing:'0.18em',textTransform:'uppercase'}}>
            ✓ Guardado · {savedAt}
          </div>
        )}
      </div>

      <div style={{display:'grid',gap:14}}>
        {/* EMPRESA */}
        <div className="glass" style={{padding:'24px 28px'}}>
          <div className="mono" style={{fontSize:10.5,letterSpacing:'0.22em',color:'var(--ink-50)',textTransform:'uppercase',marginBottom:14}}>Empresa</div>
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
        <div className="glass" style={{padding:'24px 28px'}}>
          <div className="mono" style={{fontSize:10.5,letterSpacing:'0.22em',color:'var(--ink-50)',textTransform:'uppercase',marginBottom:14}}>Evaluaciones</div>
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
        <div className="glass" style={{padding:'24px 28px'}}>
          <div className="mono" style={{fontSize:10.5,letterSpacing:'0.22em',color:'var(--ink-50)',textTransform:'uppercase',marginBottom:14}}>Notificaciones</div>
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
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <button
            className="btn btn-primary"
            onClick={save}
            disabled={!dirty}
            style={{opacity: dirty ? 1 : 0.5}}
          >
            <SIcon name="download" size={13}/> Guardar cambios
          </button>
          <button className="btn" onClick={reset}>Restablecer</button>
          {dirty && (
            <span className="mono" style={{fontSize:10.5,color:'#fcd34d',letterSpacing:'0.18em',textTransform:'uppercase'}}>
              · Cambios sin guardar
            </span>
          )}
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

/* ----------------------------- MAIN VIEW ----------------------------- */
const AdminApp = () => {
  const [time, setTime] = useState(new Date());
  const [drawer, setDrawer] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [page, setPage] = useState('equipo');
  const [roleFilter, setRoleFilter] = useState('Todos');

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

    const teamAvg = Math.round(TEAM.reduce((s,p) => s + p.score, 0) / TEAM.length);
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

    const targets = TEAM.filter(p => p.status === 'needs-coaching' || p.status === 'watch' || p.score < 75);

    const plan = {
      generatedAt: new Date().toLocaleString('es-AR'),
      summary: `Equipo ${TEAM.length} vendedores · score promedio ${teamAvg}/100 · ${targets.length} requieren intervención (criterio: score<75 o status watch/needs-coaching)`,
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
    localStorage.removeItem('apex_access_token');
    localStorage.removeItem('apex_refresh_token');
    window.location.href = '/seller';
  };

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
        <AdminTop user={user} page={page} onNav={setPage} onLogout={handleLogout} onProfile={openProfile}/>
        {page === 'preguntas' && <PreguntasView/>}
        {page === 'reportes'  && <ReportesView/>}
        {page === 'ajustes'   && <AjustesView onLogout={handleLogout}/>}
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
                <div
                  title={`1 evaluación = ${TOKEN_COSTS.evaluation} tokens · 1 plan coaching IA = ${TOKEN_COSTS.coachingPlan} tokens · 1 token = $0.01`}
                  style={{
                    display:'flex',alignItems:'center',gap:8,padding:'8px 14px',
                    border:'1px solid var(--ink-20)',borderRadius:10,
                    background:'rgba(255,255,255,0.03)',cursor:'help'
                  }}
                >
                  <SIcon name="sparkle" size={13}/>
                  <div style={{display:'flex',flexDirection:'column',lineHeight:1}}>
                    <span className="mono" style={{fontSize:9,letterSpacing:'0.18em',color:'var(--ink-50)',textTransform:'uppercase'}}>Saldo IA</span>
                    <span style={{fontSize:14,fontWeight:500,fontVariantNumeric:'tabular-nums',marginTop:3}}>{tokens.toLocaleString('es-AR')} <small style={{fontSize:10,color:'var(--ink-50)'}}>tokens</small></span>
                  </div>
                  <button
                    className="btn"
                    style={{padding:'4px 10px',fontSize:11,marginLeft:4}}
                    onClick={() => recharge(500)}
                    title="Recargar 500 tokens ($5.00)"
                  >+500</button>
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
                      {['Todos','Senior','Mid','Junior'].map(r => (
                        <button
                          key={r}
                          className={roleFilter === r ? 'on' : ''}
                          onClick={() => setRoleFilter(r)}
                        >{r}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="t-list">
                  {TEAM.filter(p => roleFilter === 'Todos' || p.role === roleFilter)
                       .map(p => <TeamRow key={p.id} p={p} onOpen={setDrawer}/>)}
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

                <button
                  className="btn btn-primary"
                  style={{width:'100%',justifyContent:'center',marginTop:18}}
                  onClick={generateCoachingPlan}
                  disabled={coachingBusy || tokens < TOKEN_COSTS.coachingPlan}
                >
                  <SIcon name="sparkle" size={13}/>
                  {coachingBusy ? 'Generando con IA...' : `Generar plan de coaching con IA · ${TOKEN_COSTS.coachingPlan} tokens`}
                </button>
                {tokenError && (
                  <div className="mono" style={{fontSize:10.5,color:'#fca5a5',marginTop:8,lineHeight:1.5}}>
                    {tokenError}
                  </div>
                )}
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

ReactDOM.createRoot(document.getElementById('root')).render(<AdminApp/>);
