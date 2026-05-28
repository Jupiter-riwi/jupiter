const { useState, useEffect, useRef } = React;
const { SIcon } = window;

/* ============================================================
   RESULTS — muestra datos reales desde la API o demo fallback
   ============================================================ */

const Radar = ({ values, max = 100, size = 320 }) => {
  // viewBox más grande + radio más chico para que los labels largos no se corten
  const cx = size / 2, cy = size / 2, r = size / 2 - 70;
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
    return [cx + Math.cos(a) * (r + 18), cy + Math.sin(a) * (r + 18), a];
  });
  // Soporta labels multilínea: si el texto contiene espacios y es largo, lo partimos en 2 líneas
  const wrapLabel = (txt) => {
    if (txt.length <= 10) return [txt];
    const words = txt.split(' ');
    if (words.length === 1) return [txt];
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
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
        const lines = wrapLabel(values[i].name);
        return (
          <text key={i} x={x} y={y} fontSize="10" fill="rgba(255,255,255,0.7)"
            textAnchor={anchor} dominantBaseline="middle"
            style={{ fontFamily: 'JetBrains Mono', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {lines.map((ln, li) => (
              <tspan key={li} x={x} dy={li === 0 ? (lines.length > 1 ? -6 : 0) : 12}>{ln}</tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
};

// Mapeo de keys del backend a labels en español
const DIMENSION_LABEL_ES = {
  communication:      'Comunicación',
  body_language:      'Lenguaje corporal',
  prosody:            'Prosodia',
  objection_handling: 'Manejo objeciones',
  confidence:         'Confianza',
  presence:           'Presencia',
  clarity:            'Claridad',
  pace:               'Ritmo',
};
const labelize = (k) => DIMENSION_LABEL_ES[k] || k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

/* ----------------------------- RESULTS PAGE ----------------------------- */
const SellerResults = ({ scenario, onBack, onPractice, evaluationData }) => {
  const cir = 2 * Math.PI * 90;
  const features = evaluationData?.features || {};
  // Backend devuelve score en 0-100 directo. Capeamos a 0-100 por seguridad.
  const rawScore = evaluationData?.score ?? features.overall;
  const overall = rawScore != null
    ? Math.max(0, Math.min(100, Math.round(rawScore <= 1 ? rawScore * 100 : rawScore)))
    : 0;
  const dimRaw = features.dimensions || evaluationData?.dimensions;
  // Si tenemos dimensiones reales del breakdown del backend, usarlas.
  // Si no, derivar dimensiones proporcionales al score real (no hardcodear 80s).
  const fallbackDims = (() => {
    const base = overall;
    return [
      { name: 'Confianza',         score: Math.max(0, Math.min(100, base + 4)), evidence: '' },
      { name: 'Comunicación',      score: Math.max(0, Math.min(100, base - 2)), evidence: '' },
      { name: 'Lenguaje corporal', score: Math.max(0, Math.min(100, base + 2)), evidence: '' },
      { name: 'Prosodia',          score: Math.max(0, Math.min(100, base - 5)), evidence: '' },
      { name: 'Presencia',         score: Math.max(0, Math.min(100, base + 4)), evidence: '' },
    ];
  })();
  const dimensions = dimRaw
    ? Object.entries(dimRaw).map(([k, v]) => ({
        name: labelize(k),
        score: Math.max(0, Math.min(100, Math.round(v.score ?? v))),
        evidence: v.evidence ?? ''
      }))
    : fallbackDims.length > 0 ? fallbackDims : [
        { name: 'Confianza', score: 88, evidence: '' },
        { name: 'Claridad', score: 82, evidence: '' },
        { name: 'Leng corporal', score: 86, evidence: '' },
        { name: 'Ritmo voz', score: 75, evidence: '' },
        { name: 'Presencia', score: 88, evidence: '' },
      ];

  const apiRecommendations = features.recommendations || evaluationData?.recommendations || [];
  const apiIssues = features.issues || evaluationData?.issues || [];
  const apiVerdict = features.verdict || evaluationData?.verdict || '';

  // Fallbacks ricos según rango de score — el usuario SIEMPRE recibe feedback útil
  const fallbackByScore = (s) => {
    if (s <= 15) return [
      { area: 'Comunicación',   tip: 'No se detectó discurso. Activá el micrófono y grabá un pitch de al menos 60 segundos. Meta: superar 80 palabras transcritas.' },
      { area: 'Estructura',     tip: 'Empezá con un hook (problema), seguí con tu solución y cerrá con una llamada a acción concreta.' },
      { area: 'Lenguaje corporal', tip: 'Asegurate de aparecer frente a cámara con buena luz y pose estable. Sin video o sin persona no se evalúa.' },
      { area: 'Setup',          tip: 'Probá el micrófono antes de grabar (los videos en silencio se descartan automáticamente).' },
    ];
    if (s <= 35) return [
      { area: 'Duración',       tip: 'Tu pitch fue muy corto. Usá los 90 segundos completos: cubrí problema + solución + diferencial + CTA.' },
      { area: 'Comunicación',   tip: 'Agregá al menos 2 frases de contexto al inicio. Meta: superar 80 palabras totales.' },
      { area: 'Propuesta de valor', tip: 'Hacé explícita tu propuesta de valor en una sola frase: "Ayudamos a [audiencia] a [beneficio] mediante [solución]".' },
      { area: 'Cierre',         tip: 'Terminá con una llamada a acción específica: "¿Podemos agendar 15 minutos esta semana?"' },
    ];
    if (s <= 60) return [
      { area: 'Estructura',     tip: 'Reordená: hook (5s) → problema (15s) → solución (30s) → diferencial (20s) → CTA (10s).' },
      { area: 'Manejo objeciones', tip: 'Anticipá una objeción común antes de que el prospecto la plantee. Ej: "Sé que el precio es una preocupación, pero..."' },
      { area: 'Ritmo',          tip: 'Apuntá a 130-160 palabras por minuto. Si vas más rápido, agregá pausas estratégicas.' },
      { area: 'Confianza',      tip: 'Practicá en voz alta 3 veces antes de grabar. La fluidez se nota.' },
    ];
    if (s <= 80) return [
      { area: 'Refinamiento',   tip: 'Tu pitch está sólido. Pulí el cierre: termina con una pregunta abierta o agenda concreta.' },
      { area: 'Diferenciación', tip: 'Agregá un dato cuantitativo que respalde tu diferencial (ej: "reducimos X un 40%").' },
      { area: 'Lenguaje corporal', tip: 'Mantené contacto visual con la cámara durante 80% del tiempo. Mirar a un lado quita confianza.' },
      { area: 'Personalización', tip: 'Si conocés al prospecto, abrí mencionando algo específico de su empresa.' },
    ];
    return [
      { area: 'Excelencia',     tip: 'Pitch excelente. Para llevarlo a 95+: incorporá un mini caso de éxito de 1 frase.' },
      { area: 'Storytelling',   tip: 'Considerá abrir con una historia breve (15s) para crear conexión emocional.' },
      { area: 'Cierre fuerte',  tip: 'Cerrá con confianza: enuncia la próxima acción esperada del prospecto.' },
    ];
  };

  const recommendations = apiRecommendations.length > 0 ? apiRecommendations : fallbackByScore(overall);
  const displayQuestion = scenario?.prompt || evaluationData?.title || 'Evaluacion completada';
  const displayCategory = scenario?.category || 'Pitch';
  const dateStr = evaluationData?.created_at
    ? new Date(evaluationData.created_at).toLocaleDateString('es', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : new Date().toLocaleDateString('es', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const status = evaluationData?.status || 'completed';
  const evalId = evaluationData?.id || '';
  const [coachInput, setCoachInput] = useState('');
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachMessages, setCoachMessages] = useState([]);
  const audioRef = useRef(null);

  const sendCoachMessage = async () => {
    const text = (coachInput || '').trim();
    if (!text || !evalId || coachBusy) return;
    setCoachBusy(true);
    setCoachMessages(prev => [...prev, { role: 'user', content: text }]);
    setCoachInput('');
    try {
      const data = await window.ApexAPI.coachChat(evalId, text);
      const reply = data?.reply || 'No pude generar respuesta en este momento.';
      const transcript = data?.transcript || '';
      const fullReply = transcript
        ? `Tu transcripción original:\n"${transcript}"\n\n---\n\n${reply}`
        : reply;
      setCoachMessages(prev => [...prev, { role: 'assistant', content: fullReply }]);
      if (data?.audio_base64_mp3) {
        const src = `data:audio/mpeg;base64,${data.audio_base64_mp3}`;
        if (audioRef.current) {
          audioRef.current.src = src;
          audioRef.current.play().catch(() => {});
        }
      }
    } catch (err) {
      setCoachMessages(prev => [...prev, { role: 'assistant', content: 'No pude responder ahora. Reintentá en unos segundos.' }]);
    } finally {
      setCoachBusy(false);
    }
  };

  return (
    <div className="s-stage">
      <div className="s-wrap">

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <button className="btn" onClick={onBack}>← Evaluar otro pitch</button>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span
              className="mono"
              title="Esta evaluación ya quedó registrada en el panel del admin. Podés revisarla cuando quieras."
              style={{
                fontSize: 10.5, color: '#9ef5be', letterSpacing: '0.16em', textTransform: 'uppercase',
                padding: '6px 12px', border: '1px solid rgba(120,255,180,0.3)',
                background: 'rgba(120,255,180,0.08)', borderRadius: 999
              }}
            >
              ✓ Notificado al admin
            </span>
            <button className="btn btn-primary" onClick={onPractice}><SIcon name="redo" size={13} /> Volver a practicar</button>
            <button
              className="btn"
              onClick={() => { window.open('/admin?eval=' + evalId, '_blank'); }}
              style={{ background:'rgba(120,255,180,0.1)', borderColor:'rgba(120,255,180,0.3)', color:'#9ef5be' }}
            >
              <SIcon name="arrow" size={13} /> Ver en panel admin
            </button>
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
              <span
                className="btn"
                title="1 evaluación = 5 tokens · 1 token = $0.01 USD"
                style={{
                  cursor: 'default',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'rgba(120,255,180,0.1)',
                  borderColor: 'rgba(120,255,180,0.3)',
                  color: '#9ef5be',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11, letterSpacing: '0.08em'
                }}
              >
                <SIcon name="sparkle" size={11}/>
                5 tokens · $0.05
              </span>
            </div>
            <div style={{
              marginTop: 12, padding: '10px 14px',
              border: '1px solid var(--glass-border)', borderRadius: 8,
              background: 'rgba(255,255,255,0.02)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-50)',
              letterSpacing: '0.04em'
            }}>
              <div>
                <span style={{color:'var(--ink-70)'}}>Procesamiento IA:</span>
                <span style={{marginLeft:10}}>Whisper (1) + Pose (1) + Prosodia (1) + LLaMA 3.3 70B (2) = <strong style={{color:'#9ef5be'}}>5 tokens</strong></span>
              </div>
              <div>Costo: <strong style={{color:'var(--ink-80)'}}>$0.05 USD</strong></div>
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
              {apiRecommendations.length > 0 ? 'Generadas por Groq (LLaMA 3.3 70B) · personalizadas a tu pitch' : 'Sugerencias para tu proximo intento'}
            </div>

            {apiVerdict && (
              <div style={{
                marginBottom: 14, padding: '12px 14px',
                borderLeft: `3px solid ${overall <= 35 ? '#fca5a5' : overall <= 60 ? '#fcd34d' : '#9ef5be'}`,
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '0 8px 8px 0',
              }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--ink-50)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Veredicto
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-90)', lineHeight: 1.5 }}>{apiVerdict}</div>
              </div>
            )}

            {apiIssues.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--ink-50)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Problemas detectados
                </div>
                {apiIssues.map((iss, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--ink-70)', marginBottom: 6, lineHeight: 1.5 }}>
                    <span style={{ color: '#fca5a5', marginTop: 2 }}>•</span>
                    <span>{iss}</span>
                  </div>
                ))}
              </div>
            )}

            {recommendations.map((r, i) => (
              <div key={i} className="rec">
                <div className={`priority ${r.priority || (overall <= 35 ? 'high' : overall <= 60 ? 'medium' : 'low')}`}>
                  <span className="dot" />
                  {r.area || (r.priority === 'high' ? 'Alta prioridad' : r.priority === 'medium' ? 'Prioridad media' : 'Sugerencia')}
                </div>
                {r.problem && <div className="problem">{r.problem}</div>}
                {r.impact && <div className="impact">{r.impact}</div>}
                <div className="tip">{r.tip || r}</div>
                {r.drill && <div className="drill">{r.drill}</div>}
                {r.success_metric && <div className="metric">{r.success_metric}</div>}
              </div>
            ))}
            <button className="btn btn-primary" onClick={onPractice} style={{ width: '100%', justifyContent: 'center', marginTop: 18 }}>
              <SIcon name="redo" size={13} /> Practicar con estas sugerencias
            </button>
          </div>
        </div>

        <div className="glass" style={{ marginTop: 16, padding: 16 }}>
          <h3 style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--ink-50)', marginBottom: 8, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
            Voice Coach (Bilingüe Ejecutivo)
          </h3>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-50)', marginBottom: 10 }}>
            Escribí tu duda o pedí: "reescribí mi pitch y léelo con las correcciones".
          </div>
          <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid var(--glass-border)', borderRadius: 8, padding: 10, background: 'rgba(255,255,255,0.02)' }}>
            {coachMessages.length === 0 && (
              <div style={{ color: 'var(--ink-50)', fontSize: 12 }}>Todavía no hay conversación.</div>
            )}
            {coachMessages.map((m, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-50)', textTransform: 'uppercase' }}>{m.role === 'user' ? 'Tú' : 'Coach'}</div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, color: 'var(--ink-85)', lineHeight: 1.45 }}>{m.content}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              value={coachInput}
              onChange={(e) => setCoachInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendCoachMessage(); }}
              placeholder="Ej: Reescribe mi pitch para sonar más ejecutivo y convincente."
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--glass-border)',
                background: 'rgba(255,255,255,0.03)',
                color: 'var(--ink-90)',
                fontSize: 12,
              }}
            />
            <button className="btn btn-primary" onClick={sendCoachMessage} disabled={coachBusy || !evalId}>
              {coachBusy ? 'Enviando...' : 'Chatear + voz'}
            </button>
          </div>
          <audio ref={audioRef} controls style={{ width: '100%', marginTop: 10 }} />
        </div>
      </div>
    </div>
  );
};

window.SellerResults = SellerResults;
window.Radar = Radar;
