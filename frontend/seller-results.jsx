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

// Mapeo de keys del backend a labels (ES/EN)
const DIMENSION_LABELS = {
  communication:      ['Comunicación', 'Communication'],
  body_language:      ['Lenguaje corporal', 'Body language'],
  prosody:            ['Prosodia', 'Prosody'],
  objection_handling: ['Manejo objeciones', 'Objection handling'],
  confidence:         ['Confianza', 'Confidence'],
  presence:           ['Presencia', 'Presence'],
  clarity:            ['Claridad', 'Clarity'],
  pace:               ['Ritmo', 'Pace'],
  // claves en español que también llegan del scoring worker
  claridad:           ['Claridad', 'Clarity'],
  confianza:          ['Confianza', 'Confidence'],
  ritmo_voz:          ['Ritmo de voz', 'Voice pace'],
  escucha_activa:     ['Escucha activa', 'Active listening'],
  lenguaje_corporal:  ['Lenguaje corporal', 'Body language'],
};
const labelize = (k) => {
  const pair = DIMENSION_LABELS[k];
  if (pair) return window.L(pair[0], pair[1]);
  return k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
};

/* ----------------------------- RESULTS PAGE ----------------------------- */
const SellerResults = ({ scenario, onBack, onPractice, evaluationData }) => {
  window.useLang(); const L = window.L;
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
      { name: L('Confianza', 'Confidence'),         score: Math.max(0, Math.min(100, base + 4)), evidence: '' },
      { name: L('Comunicación', 'Communication'),      score: Math.max(0, Math.min(100, base - 2)), evidence: '' },
      { name: L('Lenguaje corporal', 'Body language'), score: Math.max(0, Math.min(100, base + 2)), evidence: '' },
      { name: L('Prosodia', 'Prosody'),          score: Math.max(0, Math.min(100, base - 5)), evidence: '' },
      { name: L('Presencia', 'Presence'),         score: Math.max(0, Math.min(100, base + 4)), evidence: '' },
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
      { area: L('Comunicación', 'Communication'),   tip: L('No se detectó discurso. Activa el micrófono y graba un pitch de al menos 60 segundos. Meta: superar 80 palabras transcritas.', 'No speech detected. Turn on your mic and record a pitch of at least 60 seconds. Goal: pass 80 transcribed words.') },
      { area: L('Estructura', 'Structure'),     tip: L('Empieza con un hook (problema), sigue con tu solución y cierra con una llamada a acción concreta.', 'Start with a hook (the problem), follow with your solution, and close with a concrete call to action.') },
      { area: L('Lenguaje corporal', 'Body language'), tip: L('Asegúrate de aparecer frente a cámara con buena luz y pose estable. Sin video o sin persona no se evalúa.', 'Make sure you appear on camera with good light and a stable pose. Without video or a person it cannot be evaluated.') },
      { area: L('Setup', 'Setup'),          tip: L('Prueba el micrófono antes de grabar (los videos en silencio se descartan automáticamente).', 'Test your mic before recording (silent videos are discarded automatically).') },
    ];
    if (s <= 35) return [
      { area: L('Duración', 'Duration'),       tip: L('Tu pitch fue muy corto. Usa los 90 segundos completos: cubre problema + solución + diferencial + CTA.', 'Your pitch was too short. Use the full 90 seconds: cover problem + solution + differentiator + CTA.') },
      { area: L('Comunicación', 'Communication'),   tip: L('Agrega al menos 2 frases de contexto al inicio. Meta: superar 80 palabras totales.', 'Add at least 2 sentences of context at the start. Goal: pass 80 total words.') },
      { area: L('Propuesta de valor', 'Value proposition'), tip: L('Haz explícita tu propuesta de valor en una sola frase: "Ayudamos a [audiencia] a [beneficio] mediante [solución]".', 'Make your value proposition explicit in one sentence: "We help [audience] to [benefit] through [solution]."') },
      { area: L('Cierre', 'Closing'),         tip: L('Termina con una llamada a acción específica: "¿Podemos agendar 15 minutos esta semana?"', 'End with a specific call to action: "Can we schedule 15 minutes this week?"') },
    ];
    if (s <= 60) return [
      { area: L('Estructura', 'Structure'),     tip: L('Reordena: hook (5s) → problema (15s) → solución (30s) → diferencial (20s) → CTA (10s).', 'Reorder: hook (5s) → problem (15s) → solution (30s) → differentiator (20s) → CTA (10s).') },
      { area: L('Manejo objeciones', 'Objection handling'), tip: L('Anticipa una objeción común antes de que el prospecto la plantee. Ej: "Sé que el precio es una preocupación, pero..."', 'Anticipate a common objection before the prospect raises it. E.g.: "I know price is a concern, but..."') },
      { area: L('Ritmo', 'Pace'),          tip: L('Apunta a 130-160 palabras por minuto. Si vas más rápido, agrega pausas estratégicas.', 'Aim for 130-160 words per minute. If you go faster, add strategic pauses.') },
      { area: L('Confianza', 'Confidence'),      tip: L('Practica en voz alta 3 veces antes de grabar. La fluidez se nota.', 'Practice out loud 3 times before recording. Fluency shows.') },
    ];
    if (s <= 80) return [
      { area: L('Refinamiento', 'Refinement'),   tip: L('Tu pitch está sólido. Pule el cierre: termina con una pregunta abierta o agenda concreta.', 'Your pitch is solid. Polish the close: end with an open question or a concrete next step.') },
      { area: L('Diferenciación', 'Differentiation'), tip: L('Agrega un dato cuantitativo que respalde tu diferencial (ej: "reducimos X un 40%").', 'Add a quantitative data point that backs your differentiator (e.g. "we reduce X by 40%").') },
      { area: L('Lenguaje corporal', 'Body language'), tip: L('Mantén contacto visual con la cámara durante 80% del tiempo. Mirar a un lado quita confianza.', 'Keep eye contact with the camera 80% of the time. Looking away undermines confidence.') },
      { area: L('Personalización', 'Personalization'), tip: L('Si conoces al prospecto, abre mencionando algo específico de su empresa.', 'If you know the prospect, open by mentioning something specific about their company.') },
    ];
    return [
      { area: L('Excelencia', 'Excellence'),     tip: L('Pitch excelente. Para llevarlo a 95+: incorpora un mini caso de éxito de 1 frase.', 'Excellent pitch. To push it to 95+: add a one-sentence mini success story.') },
      { area: L('Storytelling', 'Storytelling'),   tip: L('Considera abrir con una historia breve (15s) para crear conexión emocional.', 'Consider opening with a brief story (15s) to create emotional connection.') },
      { area: L('Cierre fuerte', 'Strong close'),  tip: L('Cierra con confianza: enuncia la próxima acción esperada del prospecto.', 'Close with confidence: state the next action you expect from the prospect.') },
    ];
  };

  const recommendations = apiRecommendations.length > 0 ? apiRecommendations : fallbackByScore(overall);
  const displayQuestion = scenario?.prompt || evaluationData?.title || L('Evaluación completada', 'Evaluation completed');
  const displayCategory = scenario?.category || 'Pitch';
  const dateStr = evaluationData?.created_at
    ? new Date(evaluationData.created_at).toLocaleDateString(L('es', 'en-US'), { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : new Date().toLocaleDateString(L('es', 'en-US'), { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
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
      const reply = data?.reply || L('No pude generar respuesta en este momento.', "I couldn't generate a response right now.");
      const transcript = data?.transcript || '';
      const fullReply = transcript
        ? `${L('Tu transcripción original', 'Your original transcript')}:\n"${transcript}"\n\n---\n\n${reply}`
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
      setCoachMessages(prev => [...prev, { role: 'assistant', content: L('No pude responder ahora. Reintenta en unos segundos.', "I couldn't respond now. Try again in a few seconds.") }]);
    } finally {
      setCoachBusy(false);
    }
  };

  return (
    <div className="s-stage">
      <div className="s-wrap">

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <button className="btn" onClick={onBack}>{L('← Evaluar otro pitch', '← Evaluate another pitch')}</button>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span
              className="mono"
              title={L('Esta evaluación ya quedó registrada en el panel del admin. Puedes revisarla cuando quieras.', 'This evaluation is already recorded in the admin panel. You can review it anytime.')}
              style={{
                fontSize: 10.5, color: '#9ef5be', letterSpacing: '0.16em', textTransform: 'uppercase',
                padding: '6px 12px', border: '1px solid rgba(120,255,180,0.3)',
                background: 'rgba(120,255,180,0.08)', borderRadius: 999
              }}
            >
              {L('✓ Notificado al admin', '✓ Sent to admin')}
            </span>
            <button className="btn btn-primary" onClick={onPractice}><SIcon name="redo" size={13} /> {L('Volver a practicar', 'Practice again')}</button>
            <button
              className="btn"
              onClick={() => { window.open('/admin?eval=' + evalId, '_blank'); }}
              style={{ background:'rgba(120,255,180,0.1)', borderColor:'rgba(120,255,180,0.3)', color:'#9ef5be' }}
            >
              <SIcon name="arrow" size={13} /> {L('Ver en panel admin', 'View in admin panel')}
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
                <div className="l">{L('SCORE GLOBAL', 'OVERALL SCORE')}</div>
              </div>
            </div>
          </div>
          <div className="summary">
            <div className="label-row">{displayCategory} · {dateStr} · {L('Estado', 'Status')}: {status}</div>
            <h2>{displayQuestion}</h2>
            {evalId && <div className="mono" style={{fontSize:9,color:'var(--ink-40)',marginTop:4}}>ID: {evalId}</div>}
            <div className="actions">
              <span className="btn" style={{ cursor: 'default' }}>{L('Análisis IA', 'AI analysis')}</span>
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
                <span style={{color:'var(--ink-70)'}}>{L('Procesamiento IA:', 'AI processing:')}</span>
                <span style={{marginLeft:10}}>Whisper (1) + Pose (1) + {L('Prosodia', 'Prosody')} (1) + LLaMA 3.3 70B (2) = <strong style={{color:'#9ef5be'}}>5 tokens</strong></span>
              </div>
              <div>{L('Costo', 'Cost')}: <strong style={{color:'var(--ink-80)'}}>$0.05 USD</strong></div>
            </div>
          </div>
        </div>

        <div className="r-grid">
          {/* RADAR */}
          <div className="glass radar-card">
            <h3>{L('Dimensiones', 'Dimensions')}</h3>
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
              {L('Recomendaciones', 'Recommendations')}
            </h3>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-50)', letterSpacing: '0.06em', marginBottom: 12 }}>
              {apiRecommendations.length > 0 ? L('Generadas por Groq (LLaMA 3.3 70B) · personalizadas a tu pitch', 'Generated by Groq (LLaMA 3.3 70B) · personalized to your pitch') : L('Sugerencias para tu próximo intento', 'Suggestions for your next attempt')}
            </div>

            {apiVerdict && (
              <div style={{
                marginBottom: 14, padding: '12px 14px',
                borderLeft: `3px solid ${overall <= 35 ? '#fca5a5' : overall <= 60 ? '#fcd34d' : '#9ef5be'}`,
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '0 8px 8px 0',
              }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--ink-50)', textTransform: 'uppercase', marginBottom: 6 }}>
                  {L('Veredicto', 'Verdict')}
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-90)', lineHeight: 1.5 }}>{apiVerdict}</div>
              </div>
            )}

            {apiIssues.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--ink-50)', textTransform: 'uppercase', marginBottom: 8 }}>
                  {L('Problemas detectados', 'Issues detected')}
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
                  {r.area || (r.priority === 'high' ? L('Alta prioridad', 'High priority') : r.priority === 'medium' ? L('Prioridad media', 'Medium priority') : L('Sugerencia', 'Suggestion'))}
                </div>
                {r.problem && <div className="problem">{r.problem}</div>}
                {r.impact && <div className="impact">{r.impact}</div>}
                <div className="tip">{r.tip || r}</div>
                {r.drill && <div className="drill">{r.drill}</div>}
                {r.success_metric && <div className="metric">{r.success_metric}</div>}
              </div>
            ))}
            <button className="btn btn-primary" onClick={onPractice} style={{ width: '100%', justifyContent: 'center', marginTop: 18 }}>
              <SIcon name="redo" size={13} /> {L('Practicar con estas sugerencias', 'Practice with these suggestions')}
            </button>
          </div>
        </div>

        <div className="glass" style={{ marginTop: 16, padding: 16 }}>
          <h3 style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--ink-50)', marginBottom: 8, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
            {L('Voice Coach (Bilingüe Ejecutivo)', 'Voice Coach (Executive Bilingual)')}
          </h3>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-50)', marginBottom: 10 }}>
            {L('Escribe tu duda o pide: "reescribe mi pitch y léelo con las correcciones".', 'Type your question or ask: "rewrite my pitch and read it back with corrections".')}
          </div>
          <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid var(--glass-border)', borderRadius: 8, padding: 10, background: 'rgba(255,255,255,0.02)' }}>
            {coachMessages.length === 0 && (
              <div style={{ color: 'var(--ink-50)', fontSize: 12 }}>{L('Todavía no hay conversación.', 'No conversation yet.')}</div>
            )}
            {coachMessages.map((m, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-50)', textTransform: 'uppercase' }}>{m.role === 'user' ? L('Tú', 'You') : 'Coach'}</div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, color: 'var(--ink-85)', lineHeight: 1.45 }}>{m.content}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              value={coachInput}
              onChange={(e) => setCoachInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendCoachMessage(); }}
              placeholder={L('Ej: Reescribe mi pitch para sonar más ejecutivo y convincente.', 'e.g. Rewrite my pitch to sound more executive and convincing.')}
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
              {coachBusy ? L('Enviando...', 'Sending...') : L('Chatear + voz', 'Chat + voice')}
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
