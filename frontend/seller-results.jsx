const { useState, useEffect, useRef } = React;
const { SIcon } = window;

/* ============================================================
   RESULTS — muestra datos reales desde la API o demo fallback
   ============================================================ */

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
            {values[i].name}
          </text>
        );
      })}
    </svg>
  );
};

/* ----------------------------- RESULTS PAGE ----------------------------- */
const SellerResults = ({ scenario, onBack, onPractice, evaluationData }) => {
  const cir = 2 * Math.PI * 90;

  const features = evaluationData?.features || {};
  const overall = evaluationData?.score != null ? Math.round(evaluationData.score * 100) : (features.overall ?? 84);
  const dimRaw = features.dimensions || evaluationData?.dimensions;
  const dimensions = dimRaw
    ? Object.entries(dimRaw).map(([k, v]) => ({
        name: k.replace(/_/g, ' '),
        score: v.score ?? v,
        evidence: v.evidence ?? ''
      }))
    : [
        { name: 'Confianza', score: 88, evidence: '' },
        { name: 'Claridad', score: 82, evidence: '' },
        { name: 'Leng corporal', score: 86, evidence: '' },
        { name: 'Ritmo voz', score: 75, evidence: '' },
        { name: 'Presencia', score: 88, evidence: '' },
      ];

  const recommendations = features.recommendations || evaluationData?.recommendations || [];
  const displayQuestion = scenario?.prompt || evaluationData?.title || 'Evaluacion completada';
  const displayCategory = scenario?.category || 'Pitch';
  const dateStr = evaluationData?.created_at
    ? new Date(evaluationData.created_at).toLocaleDateString('es', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : new Date().toLocaleDateString('es', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const status = evaluationData?.status || 'completed';
  const evalId = evaluationData?.id || '';

  return (
    <div className="s-stage">
      <div className="s-wrap">

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <button className="btn" onClick={onBack}>← Evaluar otro pitch</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={onPractice}><SIcon name="redo" size={13} /> Volver a practicar</button>
          </div>
        </div>

        {/* HERO — score global */}
        <div className="glass glass-strong r-hero">
          <div className="score-circle">
            <svg viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="90" stroke="rgba(255,255,255,0.06)" strokeWidth="3" fill="none" />
              <circle cx="100" cy="100" r="90" stroke="rgba(255,255,255,0.92)" strokeWidth="3" fill="none"
                strokeDasharray={cir} strokeDashoffset={cir - (overall / 100) * cir} strokeLinecap="round" />
            </svg>
            <div className="center">
              <div>
                <div className="v">{overall}</div>
                <div className="l">SCORE GLOBAL</div>
              </div>
            </div>
          </div>
          <div className="summary">
            <div className="label-row">{displayCategory} · {dateStr} · Estado: {status}</div>
            <h2>{displayQuestion}</h2>
            {evalId && <div className="mono" style={{fontSize:9,color:'var(--ink-40)',marginTop:4}}>ID: {evalId}</div>}
            <div className="actions">
              <span className="btn" style={{ cursor: 'default' }}>Analisis IA</span>
              <span className="btn" style={{ cursor: 'default' }}>{displayCategory}</span>
            </div>
          </div>
        </div>

        <div className="r-grid">
          {/* RADAR */}
          <div className="glass radar-card">
            <h3>Dimensiones</h3>
            <div className="radar-wrap">
              <Radar values={dimensions} />
              <div className="dim-list">
                {dimensions.map(d => (
                  <div key={d.name} className="dim">
                    <span className="name">{d.name}</span>
                    <span className="val">{d.score}</span>
                    {d.evidence && <span className="ev">{d.evidence}</span>}
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
              Generadas por IA · personalizadas a tu evaluacion
            </div>
            {recommendations.length === 0 ? (
              <p style={{color:'var(--ink-50)',fontSize:12}}>No hay recomendaciones disponibles. El score se calculo con workers base (stubs).</p>
            ) : (
              recommendations.map((r, i) => (
                <div key={i} className="rec">
                  <div className={`priority ${r.priority || 'medium'}`}>
                    <span className="dot" /> {r.priority === 'high' ? 'Alta prioridad' : r.priority === 'medium' ? 'Prioridad media' : 'Baja prioridad'}
                  </div>
                  <div className="tip">{r.tip || r}</div>
                  {r.drill && <div className="drill">{r.drill}</div>}
                </div>
              ))
            )}
            <button className="btn btn-primary" onClick={onPractice} style={{ width: '100%', justifyContent: 'center', marginTop: 18 }}>
              <SIcon name="redo" size={13} /> Practicar con estas sugerencias
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

window.SellerResults = SellerResults;
window.Radar = Radar;
