const { useState, useEffect, useRef } = React;
const { SIcon, AVSpark } = window;

/* ============================================================
   RESULTS — análisis completo del pitch
   ============================================================ */

const SCORE = {
  overall: 84,
  question: 'Presentá tu producto o servicio a un decisor que hoy usa a tu competencia. Tenés 90 segundos para generar interés real.',
  date: '12 Abr 2026 · 16:08',
  duration: '01:24',
  insight: 'Excelente apertura y diferenciación. Tu cierre fue claro y el lenguaje corporal mejoró respecto a sesiones anteriores. Trabajá la velocidad: hablás un 18% más rápido cuando mencionás precio — eso puede restar credibilidad.',
  dimensions: [
    { name: 'Confianza',         score: 88, evidence: 'Postura firme y mirada sostenida el 78% del video. Tono asertivo en el cierre.' },
    { name: 'Claridad',          score: 82, evidence: 'Estructura clara: problema → diferencial → cierre. 2 muletillas detectadas.' },
    { name: 'Lenguaje corporal', score: 86, evidence: 'Gestos abiertos. Inclinación hacia adelante en momentos clave.' },
    { name: 'Ritmo de voz',      score: 75, evidence: 'WPM promedio 168 (objetivo 140-160). Aceleraste al hablar de precio.' },
    { name: 'Presencia',         score: 88, evidence: 'Pausas estratégicas tras preguntas retóricas. Buen manejo de silencios.' },
  ],
  recommendations: [
    {
      priority: 'high',
      tip: 'Bajá la velocidad cuando hables de precio',
      drill: 'Practicá la sección del diferencial a 140 WPM marcando una pausa de 800 ms antes de cada cifra.',
    },
    {
      priority: 'high',
      tip: 'Eliminá las muletillas "este…" y "como que"',
      drill: 'Regrabate 3 veces seguidas; reemplazá cada muletilla con un silencio consciente de 1 segundo.',
    },
    {
      priority: 'medium',
      tip: 'Sostené la mirada en el cierre',
      drill: 'En los últimos 15 segundos no rompas el contacto visual. Fijá un punto justo arriba de la lente.',
    },
  ],
  transcript: [
    { ts: '00:00', text: 'Hola Daniel, soy Marcos. Sé que ya están usando otra plataforma, así que voy directo al grano.', meta: '142 WPM' },
    { ts: '00:14', text: 'La diferencia clave es que no evaluamos sobre rúbricas genéricas: medimos lenguaje corporal, voz y discurso en tiempo real, y los comparamos contra el desempeño de tus mejores vendedores.', meta: '156 WPM' },
    { ts: '00:38', text: 'Cada vendedor recibe recomendaciones específicas, no consejos de manual.', meta: '149 WPM' },
    { ts: '00:48', text: '<mark>Este…</mark> en cuanto al precio, somos competitivos y, <mark>como que</mark>, lo que cambia es el ROI: nuestros clientes ven mejoras de 22% en cierre en 60 días.', meta: '184 WPM ↑' },
    { ts: '01:08', text: 'Te propongo un acceso de 14 días para tu equipo. Si no ves la diferencia, lo dejamos ahí. ¿Te parece?', meta: '152 WPM' },
  ],
};

/* ----------------------------- RADAR ----------------------------- */
const Radar = ({ values, max = 100, size = 240 }) => {
  const cx = size / 2, cy = size / 2, r = size / 2 - 24;
  const N = values.length;
  const pts = values.map((v, i) => {
    const a = (Math.PI * 2 * i) / N - Math.PI / 2;
    return [cx + Math.cos(a) * (v.score / max) * r, cy + Math.sin(a) * (v.score / max) * r];
  });
  const axisPts = values.map((_, i) => {
    const a = (Math.PI * 2 * i) / N - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  const labelPts = values.map((v, i) => {
    const a = (Math.PI * 2 * i) / N - Math.PI / 2;
    return [cx + Math.cos(a) * (r + 14), cy + Math.sin(a) * (r + 14), a];
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1].map((f, i) => (
        <polygon key={i}
          points={axisPts.map(([x, y]) => [(x - cx) * f + cx, (y - cy) * f + cy].join(',')).join(' ')}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      ))}
      {axisPts.map(([x, y], i) => (
        <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      ))}
      <polygon points={pts.map(p => p.join(',')).join(' ')}
        fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.85)" strokeWidth="1.4" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="#fff" />)}
      {labelPts.map(([x, y, a], i) => {
        const anchor = Math.cos(a) > 0.3 ? 'start' : Math.cos(a) < -0.3 ? 'end' : 'middle';
        return (
          <text key={i} x={x} y={y} fontSize="9" fill="rgba(255,255,255,0.55)"
            textAnchor={anchor} dominantBaseline="middle"
            style={{ fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {values[i].name.toUpperCase()}
          </text>
        );
      })}
    </svg>
  );
};

/* ----------------------------- RESULTS PAGE ----------------------------- */
const SellerResults = ({ scenario, onBack, onPractice }) => {
  const trendRef = useRef(null);
  const cir = 2 * Math.PI * 90;

  useEffect(() => {
    if (trendRef.current) AVSpark(trendRef.current, [62, 65, 64, 68, 71, 70, 73, 76, 75, 78, 82, 84], { id: 'r-trend' });
  }, []);

  const displayQuestion = scenario?.prompt || SCORE.question;
  const displayCategory = scenario?.category || 'Pitch · Producto';

  return (
    <div className="s-stage">
      <div className="s-wrap">

        {/* ACTIONS BAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <button className="btn" onClick={onBack}>← Evaluar otro pitch</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn"><SIcon name="download" size={13} /> Descargar PDF</button>
            <button className="btn btn-primary" onClick={onPractice}><SIcon name="redo" size={13} /> Volver a practicar</button>
          </div>
        </div>

        {/* HERO — score global */}
        <div className="glass glass-strong r-hero">
          <div className="score-circle">
            <svg viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="90" stroke="rgba(255,255,255,0.06)" strokeWidth="3" fill="none" />
              <circle cx="100" cy="100" r="90" stroke="rgba(255,255,255,0.92)" strokeWidth="3" fill="none"
                strokeDasharray={cir} strokeDashoffset={cir - (SCORE.overall / 100) * cir} strokeLinecap="round" />
            </svg>
            <div className="center">
              <div>
                <div className="v">{SCORE.overall}</div>
                <div className="l">SCORE GLOBAL</div>
              </div>
            </div>
          </div>
          <div className="summary">
            <div className="label-row">{displayCategory} · {SCORE.date} · {SCORE.duration}</div>
            <h2>{displayQuestion}</h2>
            <p className="insight">{SCORE.insight}</p>
            <div className="actions">
              <span className="btn" style={{ cursor: 'default' }}>↑ Muy bueno</span>
              <span className="btn" style={{ cursor: 'default' }}>Análisis completo</span>
              <span className="btn" style={{ cursor: 'default' }}>{displayCategory}</span>
            </div>
          </div>
        </div>

        {/* RADAR + RECS */}
        <div className="r-grid">

          {/* RADAR */}
          <div className="glass radar-card">
            <h3>Dimensiones</h3>
            <div className="radar-wrap">
              <Radar values={SCORE.dimensions} />
              <div className="dim-list">
                {SCORE.dimensions.map(d => (
                  <div key={d.name} className="dim">
                    <span className="name">{d.name}</span>
                    <span className="val">{d.score}</span>
                    <span className="ev">{d.evidence}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RECOMENDACIONES */}
          <div className="glass recs-card">
            <h3 style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--ink-50)', marginBottom: 6, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
              Recomendaciones
            </h3>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-50)', letterSpacing: '0.06em', marginBottom: 12 }}>
              Generadas por IA · personalizadas a tu evaluación
            </div>
            {SCORE.recommendations.map((r, i) => (
              <div key={i} className="rec">
                <div className={`priority ${r.priority}`}>
                  <span className="dot" /> {r.priority === 'high' ? 'Alta prioridad' : 'Prioridad media'}
                </div>
                <div className="tip">{r.tip}</div>
                <div className="drill">{r.drill}</div>
              </div>
            ))}
            <button className="btn btn-primary" onClick={onPractice} style={{ width: '100%', justifyContent: 'center', marginTop: 18 }}>
              <SIcon name="redo" size={13} /> Practicar con estas sugerencias
            </button>
          </div>

          {/* TRANSCRIPCIÓN */}
          <div className="glass transcript-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>Transcripción anotada</h3>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-50)', letterSpacing: '0.06em' }}>
                  Timestamps · WPM por segmento · muletillas resaltadas
                </div>
              </div>
              <button className="btn" style={{ padding: '6px 14px', fontSize: 11 }}>
                <SIcon name="play" size={11} /> Reproducir
              </button>
            </div>
            {SCORE.transcript.map((t, i) => (
              <div key={i} className="tr-row">
                <div className="ts">{t.ts}</div>
                <div className="text" dangerouslySetInnerHTML={{ __html: t.text }} />
                <div className="meta">{t.meta}</div>
              </div>
            ))}
          </div>

          {/* EVOLUCIÓN */}
          <div className="glass trend-card" style={{ gridColumn: '1 / 3' }}>
            <h3>Tu evolución · últimas 12 evaluaciones</h3>
            <div className="sub">SCORE GLOBAL · MEDIA MÓVIL DE 3</div>
            <svg ref={trendRef} />
          </div>

        </div>
      </div>
    </div>
  );
};

Object.assign(window, { SellerResults, Radar, SCORE });
