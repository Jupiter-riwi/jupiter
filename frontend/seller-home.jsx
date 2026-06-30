/* global React, AVSpark */
const { useState, useEffect, useRef } = React;

/* Robust score reader: the API returns `score` as a plain 0–1 float (e.g. 0.25),
   but older code expected `score.overall` / `overall_score`. Handle every shape
   and never return NaN (which leaked into the progress view). Returns 0–100 or null. */
function evalScore(e) {
  let raw = (typeof e?.score === 'number') ? e.score
          : (e?.score && typeof e.score === 'object' ? e.score.overall : undefined);
  if (raw == null) raw = e?.overall_score;
  if (raw == null || isNaN(raw)) return null;
  return Math.round(raw > 1 ? raw : raw * 100);
}

/* ============================================================
   ICONS
   ============================================================ */
const SIcon = ({ name, size = 16, stroke = 1.4 }) => {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case 'home':      return <svg {...p}><path d="M3 11l9-8 9 8M5 9v11h5v-7h4v7h5V9"/></svg>;
    case 'mic':       return <svg {...p}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>;
    case 'video':     return <svg {...p}><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 7l-6 5 6 5z"/></svg>;
    case 'close':     return <svg {...p}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'play':      return <svg {...p}><polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/></svg>;
    case 'redo':      return <svg {...p}><path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5"/></svg>;
    case 'check':     return <svg {...p}><path d="M5 12l5 5 9-12"/></svg>;
    case 'arrow':     return <svg {...p}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case 'sparkle':   return <svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5L8 8M16 16l2.5 2.5M5.5 18.5L8 16M16 8l2.5-2.5"/></svg>;
    case 'download':  return <svg {...p}><path d="M12 3v13M6 11l6 6 6-6M4 21h16"/></svg>;
    case 'progress':  return <svg {...p}><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>;
    case 'history':   return <svg {...p}><path d="M3 12a9 9 0 109-9 9 9 0 00-7 3M3 4v5h5"/><path d="M12 7v5l3 2"/></svg>;
    case 'body':      return <svg {...p}><circle cx="12" cy="5" r="2"/><path d="M12 7v6M9 13l-2 5M15 13l2 5M9 10h6"/></svg>;
    case 'wave':      return <svg {...p}><path d="M2 12c1.5-3 3-4.5 4-4.5s2.5 3 4 3 2.5-3 4-3 2.5 1.5 4 4.5"/></svg>;
    case 'brain':     return <svg {...p}><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.04-4.54 3 3 0 0 1 .36-5.44 2.5 2.5 0 0 1 1.14-4.06A2.5 2.5 0 0 1 9.5 2"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.04-4.54 3 3 0 0 0-.36-5.44 2.5 2.5 0 0 0-1.14-4.06A2.5 2.5 0 0 0 14.5 2"/></svg>;
    case 'eye':       return <svg {...p}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'eye-off':   return <svg {...p}><path d="M17.94 17.94A10.1 10.1 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
    case 'user':      return <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'logout':    return <svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
    default: return null;
  }
};

/* ============================================================
   APEX VISION LOGO — SVG inline (concentric rounded triangles)
   ============================================================ */
const ApexLogo = ({ size = 36 }) => {
  // Rounded equilateral triangle path centered at (50, 50)
  // Vertices: top(50,10), bottom-right(84,68), bottom-left(16,68)
  // Rounded corners via quadratic beziers
  const SHAPE = "M44,21 Q50,10 56,21 C64,36 80,61 81,63 Q87,73 75,73 L25,73 Q13,73 19,63 C20,61 36,36 44,21 Z";
  const cx = 50, cy = 52;
  const rings = 9;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ display: 'block' }}>
      {Array.from({ length: rings }, (_, i) => {
        const s = 1 - i * (0.82 / (rings - 1));
        const tx = cx * (1 - s);
        const ty = cy * (1 - s);
        const opacity = 0.9 - i * 0.07;
        return (
          <path
            key={i}
            d={SHAPE}
            stroke="white"
            strokeWidth={1.1}
            fill="none"
            transform={`translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${s.toFixed(3)})`}
            opacity={opacity.toFixed(2)}
          />
        );
      })}
    </svg>
  );
};

/* ============================================================
   TOPBAR — con logo y nav funcional
   ============================================================ */
const scrollToSection = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  // Encontrar el contenedor scrollable (s-stage suele tener overflow:auto)
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
};

const PublicTopBar = ({ onHome, onSection }) => {
  window.useLang(); const L = window.L;
  const goSection = (id) => {
    if (typeof onSection === 'function') {
      onSection(id);
    } else {
      scrollToSection(id);
    }
  };
  const linkStyle = { padding: '8px 16px', fontSize: 12.5, color: 'var(--ink-60)', borderRadius: 999, letterSpacing: '0.04em', cursor: 'pointer', transition: 'color 150ms' };
  return (
  <div className="s-topbar">
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={onHome}>
      <ApexLogo size={38} />
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.18em', color: 'var(--ink-90)' }}>APEX</div>
        <div style={{ fontSize: 9, letterSpacing: '0.28em', color: 'var(--ink-50)', marginTop: 1 }}>VISION</div>
      </div>
    </div>
    <div style={{ display: 'flex', gap: 4 }}>
      <a onClick={() => goSection('how-it-works')} style={linkStyle}
        onMouseEnter={e => e.target.style.color = 'var(--ink-90)'}
        onMouseLeave={e => e.target.style.color = 'var(--ink-60)'}>{L('Cómo funciona', 'How it works')}</a>
      <a onClick={() => goSection('para-empresas')} style={linkStyle}
        onMouseEnter={e => e.target.style.color = 'var(--ink-90)'}
        onMouseLeave={e => e.target.style.color = 'var(--ink-60)'}>{L('Para empresas', 'For teams')}</a>
      <a onClick={() => goSection('precios')} style={linkStyle}
        onMouseEnter={e => e.target.style.color = 'var(--ink-90)'}
        onMouseLeave={e => e.target.style.color = 'var(--ink-60)'}>{L('Precios', 'Pricing')}</a>
    </div>
    <div style={{ width: 120 }} />
  </div>
  );
};

/* ============================================================
   LANDING — hero público
   ============================================================ */
const FEATURES = [
  { icon: 'body',    title: ['Lenguaje corporal', 'Body language'],   desc: ['Postura, gestos, contacto visual y presencia evaluados fotograma a fotograma.', 'Posture, gestures, eye contact and presence evaluated frame by frame.'] },
  { icon: 'wave',    title: ['Análisis de voz', 'Voice analysis'],      desc: ['Velocidad, tono, pausas estratégicas, muletillas y claridad del discurso.', 'Pace, tone, strategic pauses, filler words and speech clarity.'] },
  { icon: 'brain',   title: ['Sugerencias con IA', 'AI suggestions'],   desc: ['Recomendaciones concretas y personalizadas para mejorar en tu próxima presentación.', 'Concrete, personalized recommendations to improve in your next presentation.'] },
];

const PublicLanding = ({ onStart }) => {
  window.useLang(); const L = window.L;
  return (
  <div className="s-stage">
    <div className="s-wrap" style={{ maxWidth: 860 }}>

      {/* HERO */}
      <div style={{ textAlign: 'center', padding: '72px 0 56px' }}>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.3em', color: 'var(--ink-40)', textTransform: 'uppercase', marginBottom: 20 }}>
          {L('Apex Vision · Evaluación comercial con IA', 'Apex Vision · AI sales evaluation')}
        </div>
        <h1 style={{ fontSize: 54, fontWeight: 200, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 22 }}>
          {L('Grabate.', 'Record yourself.')}<br/>{L('Mejorá tu pitch.', 'Improve your pitch.')}
        </h1>
        <p style={{ fontSize: 16, color: 'var(--ink-70)', maxWidth: '48ch', margin: '0 auto 36px', lineHeight: 1.65 }}>
          {L('Presentá tu producto, servicio o idea y recibí un análisis detallado de tu comunicación: cuerpo, voz y discurso.', 'Present your product, service or idea and get a detailed analysis of your communication: body, voice and delivery.')}
        </p>
        <button className="btn btn-primary" onClick={onStart}
          style={{ padding: '16px 34px', fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', gap: 10 }}>
          <SIcon name="mic" size={14} /> {L('Evaluar mi pitch — es gratis', 'Evaluate my pitch — it\'s free')}
        </button>
        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-30)', marginTop: 18, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          {L('Sin instalación · Resultados en segundos · Tu video es privado', 'No install · Results in seconds · Your video is private')}
        </div>
      </div>

      {/* FEATURES */}
      <div id="features" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 56 }}>
        {FEATURES.map(f => (
          <div key={f.title[0]} className="glass card-hover" style={{ padding: '26px 22px', textAlign: 'center' }}>
            <div style={{ marginBottom: 14, color: 'var(--ink-60)' }}>
              <SIcon name={f.icon} size={26} stroke={1.2} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, letterSpacing: '-0.005em' }}>{L(f.title[0], f.title[1])}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-50)', lineHeight: 1.6 }}>{L(f.desc[0], f.desc[1])}</div>
          </div>
        ))}
      </div>

      {/* HOW IT WORKS */}
      <div id="how-it-works" className="glass" style={{ padding: '32px 36px', marginBottom: 56 }}>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-50)', textTransform: 'uppercase', marginBottom: 28, textAlign: 'center' }}>
          {L('Cómo funciona', 'How it works')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
          {[
            ['01', L('Elegís el escenario', 'Pick the scenario'),   L('Seleccionás el tipo de pitch que querés practicar.', 'Choose the type of pitch you want to practice.')],
            ['02', L('Te grabás', 'Record yourself'),             L('Usamos tu cámara y micrófono — nada se sube sin tu ok.', 'We use your camera and mic — nothing is uploaded without your ok.')],
            ['03', L('IA analiza', 'AI analyzes'),            L('Pose, voz, gestos faciales y discurso en segundos.', 'Pose, voice, facial gestures and delivery in seconds.')],
            ['04', L('Mejorás', 'You improve'),               L('Métricas claras y sugerencias accionables para la próxima vez.', 'Clear metrics and actionable tips for next time.')],
          ].map(([n, t, d]) => (
            <div key={n} style={{ textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 28, fontWeight: 200, color: 'var(--ink-20)', letterSpacing: '-0.02em', marginBottom: 10 }}>{n}</div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, letterSpacing: '-0.005em' }}>{t}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-50)', lineHeight: 1.55 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA BOTTOM */}
      <div style={{ textAlign: 'center', paddingBottom: 56 }}>
        <p style={{ fontSize: 14, color: 'var(--ink-50)', marginBottom: 20 }}>
          {L('¿Listo para ver cómo te comunicás realmente?', 'Ready to see how you really communicate?')}
        </p>
        <button className="btn btn-primary" onClick={onStart}
          style={{ padding: '16px 34px', fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', gap: 10 }}>
          <SIcon name="sparkle" size={14} /> {L('Empezar ahora', 'Start now')}
        </button>
      </div>

      {/* PARA EMPRESAS */}
      <div id="para-empresas" className="glass" style={{ padding: '40px 44px', marginBottom: 60, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
        <div>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.28em', color: 'var(--ink-40)', textTransform: 'uppercase', marginBottom: 14 }}>
            {L('Para empresas', 'For teams')}
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 200, letterSpacing: '-0.02em', marginBottom: 14, lineHeight: 1.2 }}>
            {L('Evaluá a todo tu equipo comercial desde un solo lugar', 'Evaluate your whole sales team from one place')}
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--ink-50)', lineHeight: 1.65, marginBottom: 24 }}>
            {L('Con el panel de administración podés ver el rendimiento de cada vendedor, detectar quién necesita coaching y medir la mejora en el tiempo con métricas reales.', 'With the admin panel you can see each seller\'s performance, spot who needs coaching and measure improvement over time with real metrics.')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {[
              L('Dashboard de equipo con score por vendedor', 'Team dashboard with score per seller'),
              L('Mapa de habilidades: confianza, voz, lenguaje corporal', 'Skill map: confidence, voice, body language'),
              L('Sugerencias de coaching generadas por IA', 'AI-generated coaching suggestions'),
              L('Reportes exportables por período', 'Exportable reports by period'),
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink-70)' }}>
                <SIcon name="check" size={14} />
                {f}
              </div>
            ))}
          </div>
          <a href="Apex Vision Console.html" className="btn btn-primary" style={{ display: 'inline-flex', padding: '13px 24px', fontSize: 12.5, letterSpacing: '0.12em', textTransform: 'uppercase', gap: 8, textDecoration: 'none' }}>
            <SIcon name="arrow" size={13} /> {L('Ver panel de administración', 'Open admin panel')}
          </a>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: L('Score promedio del equipo', 'Team average score'), value: '78', unit: '/100', delta: L('+4 vs mes anterior', '+4 vs last month') },
            { label: L('Evaluaciones este mes', 'Evaluations this month'),     value: '156', unit: '',     delta: L('↑ 22% participación', '↑ 22% participation') },
            { label: L('Vendedores activos', 'Active sellers'),         value: '8',  unit: '/8',   delta: L('100% activos esta semana', '100% active this week') },
          ].map(({ label, value, unit, delta }) => (
            <div key={label} className="glass" style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-40)', marginBottom: 6, letterSpacing: '0.04em' }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 200, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {value}<span style={{ fontSize: 13, color: 'var(--ink-40)', marginLeft: 4 }}>{unit}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-40)', marginTop: 6, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>{delta}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PRECIOS */}
      <div id="precios" style={{ marginBottom: 80 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.28em', color: 'var(--ink-40)', textTransform: 'uppercase', marginBottom: 14 }}>
            {L('Precios', 'Pricing')}
          </div>
          <h2 style={{ fontSize: 32, fontWeight: 200, letterSpacing: '-0.02em', marginBottom: 12 }}>
            {L('Planes que escalan con tu equipo', 'Plans that scale with your team')}
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--ink-50)', maxWidth: 540, margin: '0 auto', lineHeight: 1.65 }}>
            {L('Sin contratos largos. Cancelá cuando quieras. Margen real para invertir en tus vendedores.', 'No long contracts. Cancel anytime. Real margin to invest in your sellers.')}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          {/* STARTER */}
          <div className="glass" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column' }}>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-50)', textTransform: 'uppercase', marginBottom: 8 }}>
              Starter
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 44, fontWeight: 200, letterSpacing: '-0.02em' }}>$39</span>
              <span style={{ fontSize: 13, color: 'var(--ink-50)', marginLeft: 6 }}>{L('USD / usuario / mes', 'USD / user / month')}</span>
            </div>
            <div className="mono" style={{ fontSize: 11, color: '#9ef5be', letterSpacing: '0.12em', marginBottom: 18 }}>
              {L('✦ 600 tokens incluidos / mes', '✦ 600 tokens included / month')}
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-50)', lineHeight: 1.6, marginBottom: 20 }}>
              {L('Para equipos pequeños que arrancan a medir el desempeño comercial.', 'For small teams starting to measure sales performance.')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, flex: 1 }}>
              {[
                L('~120 evaluaciones / mes (5 tokens c/u)', '~120 evaluations / month (5 tokens each)'),
                L('Análisis de voz, lenguaje corporal y ritmo', 'Voice, body-language and pacing analysis'),
                L('Score con recomendaciones de IA', 'Score with AI recommendations'),
                L('Historial individual y exportación CSV', 'Individual history and CSV export'),
                L('Recarga +500 tokens por $5 USD', 'Top up +500 tokens for $5 USD'),
                L('Soporte por email', 'Email support'),
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--ink-70)' }}>
                  <SIcon name="check" size={13} /> {f}
                </div>
              ))}
            </div>
            <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
              {L('Empezar gratis · 50 tokens', 'Start free · 50 tokens')}
            </button>
          </div>

          {/* GROWTH (highlighted) */}
          <div className="glass" style={{
            padding: '20px 28px 32px', display: 'flex', flexDirection: 'column',
            border: '1px solid rgba(120,255,180,0.35)',
            background: 'linear-gradient(180deg, rgba(120,255,180,0.06), rgba(255,255,255,0.02))',
          }}>
            <div style={{
              alignSelf: 'flex-end', marginBottom: 16,
              fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600,
              padding: '4px 10px', borderRadius: 999,
              background: 'rgba(120,255,180,0.18)', color: '#9ef5be',
              border: '1px solid rgba(120,255,180,0.4)',
            }}>
              {L('Más elegido', 'Most popular')}
            </div>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-50)', textTransform: 'uppercase', marginBottom: 8 }}>
              Growth
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 44, fontWeight: 200, letterSpacing: '-0.02em' }}>$89</span>
              <span style={{ fontSize: 13, color: 'var(--ink-50)', marginLeft: 6 }}>{L('USD / usuario / mes', 'USD / user / month')}</span>
            </div>
            <div className="mono" style={{ fontSize: 11, color: '#9ef5be', letterSpacing: '0.12em', marginBottom: 18 }}>
              {L('✦ 2,000 tokens incluidos / mes', '✦ 2,000 tokens included / month')}
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-50)', lineHeight: 1.6, marginBottom: 20 }}>
              {L('Para equipos en crecimiento que necesitan coaching personalizado y reportes profundos.', 'For growing teams that need personalized coaching and deep reports.')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, flex: 1 }}>
              {[
                L('~400 evaluaciones / mes', '~400 evaluations / month'),
                L('Plan de coaching IA por vendedor (20 tokens)', 'AI coaching plan per seller (20 tokens)'),
                L('Dashboard de equipo con tendencias', 'Team dashboard with trends'),
                L('Reportes PDF/CSV automáticos', 'Automatic PDF/CSV reports'),
                L('Análisis con OpenAI/Groq (modelo premium)', 'OpenAI/Groq analysis (premium model)'),
                L('Tokens no usados se acumulan', 'Unused tokens roll over'),
                L('Soporte prioritario', 'Priority support'),
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--ink-70)' }}>
                  <SIcon name="check" size={13} /> {f}
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
              {L('Empezar prueba · 200 tokens', 'Start trial · 200 tokens')}
            </button>
          </div>

          {/* ENTERPRISE */}
          <div className="glass" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column' }}>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-50)', textTransform: 'uppercase', marginBottom: 8 }}>
              Enterprise
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 32, fontWeight: 200, letterSpacing: '-0.02em' }}>{L('A medida', 'Custom')}</span>
              <div style={{ fontSize: 12, color: 'var(--ink-50)', marginTop: 4 }}>{L('desde 50+ usuarios', 'from 50+ users')}</div>
            </div>
            <div className="mono" style={{ fontSize: 11, color: '#9ef5be', letterSpacing: '0.12em', marginBottom: 18 }}>
              {L('✦ Pool de tokens compartido', '✦ Shared token pool')}
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-50)', lineHeight: 1.6, marginBottom: 20 }}>
              {L('Para organizaciones grandes con requerimientos de compliance e integraciones.', 'For large organizations with compliance and integration requirements.')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, flex: 1 }}>
              {[
                L('Tokens ilimitados o pool dedicado', 'Unlimited tokens or dedicated pool'),
                L('Multi-tenant con roles avanzados', 'Multi-tenant with advanced roles'),
                L('SSO (Google, Azure AD, Okta)', 'SSO (Google, Azure AD, Okta)'),
                L('Retención de datos personalizada', 'Custom data retention'),
                L('Integraciones (Salesforce, HubSpot)', 'Integrations (Salesforce, HubSpot)'),
                L('SLA 99.9% y soporte dedicado', 'SLA 99.9% and dedicated support'),
                L('Onboarding del equipo incluido', 'Team onboarding included'),
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--ink-70)' }}>
                  <SIcon name="check" size={13} /> {f}
                </div>
              ))}
            </div>
            <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
              {L('Contactar ventas', 'Contact sales')}
            </button>
          </div>
        </div>

        {/* Tabla de costos por token */}
        <div className="glass" style={{ marginTop: 28, padding: '28px 32px' }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-50)', textTransform: 'uppercase', marginBottom: 18, textAlign: 'center' }}>
            {L('Cómo se consumen los tokens', 'How tokens are spent')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            {[
              { label: L('Evaluación de pitch', 'Pitch evaluation'),     value: '5 tokens',  desc: L('$0.05 USD por video analizado', '$0.05 USD per analyzed video') },
              { label: L('Plan de coaching IA', 'AI coaching plan'),     value: '20 tokens', desc: L('$0.20 USD análisis del equipo con OpenAI/Groq', '$0.20 USD team analysis with OpenAI/Groq') },
              { label: L('Reporte PDF / CSV', 'PDF / CSV report'),       value: L('Gratis', 'Free'),    desc: L('sin costo en tokens', 'no token cost') },
              { label: L('Recarga adicional', 'Extra top-up'),       value: '$10 / 1k',  desc: L('+1.000 tokens por $10 USD (sin vencimiento)', '+1,000 tokens for $10 USD (no expiry)') },
            ].map(({ label, value, desc }) => (
              <div key={label}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--ink-50)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 300, letterSpacing: '-0.01em', marginBottom: 4 }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-40)', lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--glass-border)', textAlign: 'center', fontSize: 12, color: 'var(--ink-50)' }}>
            <strong style={{ color: 'var(--ink-80)' }}>1 token = $0.01 USD</strong> · {L('Pagás solo por lo que usás · Margen bruto del producto: 85%', 'Pay only for what you use · Product gross margin: 85%')}
          </div>
        </div>
      </div>

    </div>
  </div>
  );
};

/* ============================================================
   ESCENARIOS
   ============================================================ */
const SCENARIOS = [
  {
    id: 'product-pitch',
    title: 'Pitch de producto',
    description: 'Presentá tu producto o servicio a un cliente potencial.',
    duration: '90 s',
    prompt: 'Presentá tu producto o servicio a un decisor que hoy usa a tu competencia. Tenés 90 segundos para generar interés real.',
    category: 'Pitch · Producto',
  },
  {
    id: 'cold-open',
    title: 'Apertura en frío',
    description: 'Primera llamada o contacto sin contexto previo.',
    duration: '60 s',
    prompt: 'Contactá en frío a un directivo que no te conoce. Generá interés y conseguí 15 minutos en su agenda.',
    category: 'Apertura en frío',
  },
  {
    id: 'executive',
    title: 'Presentación ejecutiva',
    description: 'Exposición estructurada ante un panel directivo.',
    duration: '3 min',
    prompt: 'Presentá una propuesta de valor ante un comité de dirección. Justificá el ROI y anticipá objeciones.',
    category: 'Presentación ejecutiva',
  },
  {
    id: 'objection',
    title: 'Manejo de objeciones',
    description: 'Respondé la objeción más difícil: precio o timing.',
    duration: '90 s',
    prompt: 'Tu prospecto dice: "Es interesante pero es muy caro y no es el momento". Respondé de forma consultiva sin bajar el precio.',
    category: 'Objeciones',
  },
  {
    id: 'free',
    title: 'Pitch libre',
    description: 'Sin restricciones — practicá lo que quieras evaluar.',
    duration: 'Libre',
    prompt: 'Usá este espacio para practicar cualquier aspecto de tu comunicación comercial. Sin guión impuesto.',
    category: 'Libre',
  },
];

/* ============================================================
   SELECTOR DE ESCENARIO
   ============================================================ */
const ScenarioSelector = ({ onSelect, onBack }) => {
  window.useLang(); const L = window.L;
  const [selected, setSelected] = useState(null);

  return (
    <div className="s-stage">
      <div className="s-wrap" style={{ maxWidth: 820 }}>

        <div style={{ marginBottom: 32 }}>
          <button className="btn" onClick={onBack} style={{ marginBottom: 22 }}>{L('← Volver', '← Back')}</button>
          <StepProgress current={1} />
          <h2 style={{ fontSize: 34, fontWeight: 200, letterSpacing: '-0.02em', marginBottom: 8 }}>
            {L('¿Qué querés evaluar?', 'What do you want to practice?')}
          </h2>
          <p style={{ color: 'var(--ink-50)', fontSize: 14 }}>
            {L('Elegí el escenario y la IA calibra los parámetros de análisis.', 'Pick a scenario and the AI calibrates the analysis parameters.')}
          </p>
        </div>

        {/* GRID DE ESCENARIOS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }}>
          {SCENARIOS.slice(0, 4).map(s => (
            <div
              key={s.id}
              className={`glass scenario-card${selected?.id === s.id ? ' selected' : ''}`}
              onClick={() => setSelected(s)}
              style={{ padding: '18px 20px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selected?.id === s.id && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9ef5be', display: 'inline-block', flexShrink: 0 }} />}
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{s.title}</div>
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-40)', letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap', marginLeft: 10 }}>
                  {s.duration}
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-50)', lineHeight: 1.5 }}>{s.description}</div>
            </div>
          ))}
        </div>

        {/* PITCH LIBRE — full width */}
        <div
          className={`glass scenario-card${selected?.id === 'free' ? ' selected' : ''}`}
          onClick={() => setSelected(SCENARIOS[4])}
          style={{
            padding: '18px 20px',
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 4 }}>{SCENARIOS[4].title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-50)' }}>{SCENARIOS[4].description}</div>
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-40)', letterSpacing: '0.12em', textTransform: 'uppercase', marginLeft: 16 }}>
            {SCENARIOS[4].duration}
          </div>
        </div>

        {/* PREVIEW DEL PROMPT */}
        {selected && (
          <div className="glass" style={{ padding: '16px 20px', marginBottom: 24, background: 'rgba(255,255,255,0.06)' }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-40)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>
              {L('Prompt de evaluación', 'Evaluation prompt')} · {selected.category}
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-85)', lineHeight: 1.6 }}>{selected.prompt}</p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className={`btn${selected ? ' btn-record-ready' : ''}`}
            disabled={!selected}
            onClick={() => selected && onSelect(selected)}
            style={{
              padding: '14px 28px',
              fontSize: 12.5,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              opacity: selected ? 1 : 0.38,
              cursor: selected ? 'pointer' : 'default',
              gap: 8,
            }}
          >
            <SIcon name="mic" size={13} /> {L('Comenzar grabación', 'Start recording')}
          </button>
        </div>

      </div>
    </div>
  );
};

/* ============================================================
   STEP PROGRESS — indicador visual de paso X de N
   ============================================================ */
const StepProgress = ({ current, steps = [window.L('Escenario', 'Scenario'), window.L('Grabación', 'Recording'), window.L('Resultados', 'Results')] }) => (
  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
    {steps.map((label, i) => {
      const step = i + 1;
      const done   = step < current;
      const active = step === current;
      return (
        <React.Fragment key={step}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10.5, fontWeight: 600,
              background: done   ? 'rgba(158,245,190,0.15)' :
                          active ? 'rgba(255,255,255,0.1)'  : 'transparent',
              border: done   ? '1px solid rgba(158,245,190,0.45)' :
                      active ? '1px solid rgba(255,255,255,0.35)' :
                               '1px solid rgba(255,255,255,0.1)',
              color: done   ? '#9ef5be' :
                     active ? 'var(--ink-90)' : 'var(--ink-25)',
              transition: 'all 240ms',
            }}>
              {done ? <SIcon name="check" size={11} stroke={2} /> : step}
            </div>
            <span style={{
              fontSize: 11.5,
              color: active ? 'var(--ink-80)' : done ? 'var(--ink-45)' : 'var(--ink-25)',
              letterSpacing: '0.02em',
              transition: 'color 240ms',
            }}>{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              flex: 1, height: 1, margin: '0 10px',
              background: done ? 'rgba(158,245,190,0.25)' : 'rgba(255,255,255,0.07)',
              transition: 'background 240ms',
            }} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

/* ============================================================
   SELLER DASHBOARD — vista post-login del vendedor
   ============================================================ */
const statusLabel = { pending: 'Pendiente', processing: 'Procesando', completed: 'Completado', failed: 'Error' };
const statusColor = { pending: 'var(--ink-40)', processing: '#f9d45b', completed: '#9ef5be', failed: '#fca5a5' };

const ScoreRing = ({ score }) => {
  const r = 22, circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  return (
    <svg width={56} height={56} viewBox="0 0 56 56">
      <circle cx={28} cy={28} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={4}/>
      <circle cx={28} cy={28} r={r} fill="none" stroke="#9ef5be" strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" transform="rotate(-90 28 28)" style={{transition:'stroke-dashoffset 600ms ease'}}/>
      <text x={28} y={33} textAnchor="middle" fontSize={13} fontWeight={300} fill="white">{score}</text>
    </svg>
  );
};

const SellerDashboard = ({ user, onStart, onViewResult }) => {
  window.useLang(); const L = window.L;
  const [evals, setEvals]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.ApexAPI.getEvaluations(1, 10)
      .then(d => setEvals(d))
      .catch(() => setEvals({ data: [], total: 0 }))
      .finally(() => setLoading(false));
  }, []);

  const completedEvals = evals?.data?.filter(e => e.status === 'completed' || e.status === 'scored') || [];
  const rawScores = completedEvals.map(evalScore).filter(s => s !== null);
  const avgScore  = rawScores.length ? Math.round(rawScores.reduce((a, b) => a + b, 0) / rawScores.length) : null;
  const bestScore = rawScores.length ? Math.max(...rawScores) : null;
  const scoreCol  = s => s >= 80 ? '#9ef5be' : s >= 60 ? '#fbbf24' : '#fca5a5';
  const fmtDate   = d => new Date(d).toLocaleDateString(L('es-AR', 'en-US'), { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="s-stage">
      <div className="s-wrap">

        {/* ── sección header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 300, letterSpacing: '-0.01em' }}>{L('Mis evaluaciones', 'My evaluations')}</div>
            {!loading && (
              <div className="mono" style={{ fontSize: 10, color: 'var(--ink-30)', marginTop: 3 }}>
                {evals?.total
                  ? `${evals.total} ${L(evals.total !== 1 ? 'evaluaciones' : 'evaluación', evals.total !== 1 ? 'evaluations' : 'evaluation')} · ${completedEvals.length} ${L(completedEvals.length !== 1 ? 'completadas' : 'completada', 'completed')}`
                  : L('ninguna realizada aún', 'none yet')}
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={onStart}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', fontSize: 11.5 }}>
            <SIcon name="mic" size={13} stroke={1.5} />
            {L('Nueva evaluación', 'New evaluation')}
          </button>
        </div>

        {/* ── stats (solo si hay datos) ── */}
        {!loading && evals?.total > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total',          value: evals.total,           color: 'var(--ink-70)', sub: `${completedEvals.length} ${L('completadas', 'completed')}` },
              { label: L('Score promedio', 'Average score'), value: avgScore  ? `${avgScore}/100`  : '—', color: avgScore  ? scoreCol(avgScore)  : 'var(--ink-20)', sub: avgScore  ? (avgScore >= 80 ? L('Excelente', 'Excellent') : avgScore >= 60 ? L('En progreso', 'In progress') : L('Necesita mejorar', 'Needs work')) : L('sin datos aún', 'no data yet') },
              { label: L('Mejor score', 'Best score'),    value: bestScore ? `${bestScore}/100` : '—', color: bestScore ? '#a78bfa' : 'var(--ink-20)', sub: bestScore ? L('tu récord personal', 'your personal best') : L('sin datos aún', 'no data yet') },
            ].map(({ label, value, color, sub }) => (
              <div key={label} style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="mono" style={{ fontSize: 9, color: 'var(--ink-28)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 200, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-25)' }}>{sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── cuerpo ── */}
        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-25)', fontSize: 12 }}>{L('Cargando…', 'Loading…')}</div>

        ) : evals?.total === 0 ? (
          /* empty state — sutil, no hero */
          <div style={{ padding: '40px 24px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', textAlign: 'center' }}>
            <div style={{ color: 'rgba(255,255,255,0.15)', marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
              <SIcon name="mic" size={32} stroke={0.9} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 300, color: 'var(--ink-50)', marginBottom: 6 }}>{L('Todavía no hay evaluaciones', 'No evaluations yet')}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-28)', marginBottom: 20, lineHeight: 1.6, maxWidth: 360, margin: '0 auto 20px' }}>
              {L('Grabate 60–90 segundos y la IA analiza tu lenguaje corporal, voz y discurso en tiempo real.', 'Record 60–90 seconds and the AI analyzes your body language, voice and delivery in real time.')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 22 }}>
              {[['body', L('Lenguaje corporal', 'Body language')], ['wave', L('Voz y prosodia', 'Voice & prosody')], ['sparkle', L('Score con IA', 'AI score')]].map(([icon, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink-35)' }}>
                  <SIcon name={icon} size={13} stroke={1.3} />{label}
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={onStart}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', fontSize: 12 }}>
              <SIcon name="mic" size={13} stroke={1.5} /> {L('Empezar primera evaluación', 'Start your first evaluation')}
            </button>
          </div>

        ) : (
          /* lista de evaluaciones */
          <div>
            <div className="mono" style={{ fontSize: 9, color: 'var(--ink-25)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
              {L('Historial reciente', 'Recent history')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {evals.data.map(ev => {
                const score = evalScore(ev);
                const isComplete = ev.status === 'completed' || ev.status === 'scored';
                const isProcessing = ev.status === 'processing';
                const date = fmtDate(ev.created_at);
                return (
                  <div key={ev.id}
                    onClick={() => isComplete && onViewResult && onViewResult(ev)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', cursor: isComplete ? 'pointer' : 'default', transition: 'background 140ms, border-color 140ms' }}
                    onMouseEnter={e => { if (isComplete) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; }}}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}>

                    {/* score ring o placeholder */}
                    {score !== null
                      ? <ScoreRing score={score} />
                      : <div style={{ width: 52, height: 52, borderRadius: '50%', border: '1px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--ink-25)' }}>
                          <SIcon name={isProcessing ? 'progress' : 'mic'} size={16} stroke={1.2} />
                        </div>}

                    {/* info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink-80)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.title || L('Evaluación sin título', 'Untitled evaluation')}
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-30)' }}>{date}</span>
                        <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: isComplete ? '#9ef5be' : isProcessing ? '#fbbf24' : 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                          <span className="mono" style={{ fontSize: 10, color: isComplete ? 'var(--ink-40)' : isProcessing ? '#fbbf24' : 'var(--ink-25)' }}>
                            {isComplete ? L('completada', 'completed') : isProcessing ? L('procesando…', 'processing…') : L('en curso', 'in progress')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* flecha si clickeable */}
                    {isComplete && <SIcon name="arrow" size={13} stroke={1.3} style={{ color: 'var(--ink-25)', flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

/* ============================================================
   PROGRESO — gráfico de scores + logros
   ============================================================ */
const BADGES_DEF = [
  { id: 'first',    icon: 'mic',      label: ['Primer paso', 'First step'],          desc: ['Completaste tu primera evaluación', 'You completed your first evaluation'],  color: '#9ef5be', unlocked: c => c.length >= 1 },
  { id: 'five',     icon: 'progress', label: ['Constancia', 'Consistency'],          desc: ['5 evaluaciones completadas', '5 evaluations completed'],         color: '#9ef5be', unlocked: c => c.length >= 5,  prog: c => [Math.min(c.length,5), 5] },
  { id: 'ten',      icon: 'history',  label: ['Dedicación', 'Dedication'],           desc: ['10 evaluaciones completadas', '10 evaluations completed'],        color: '#60a5fa', unlocked: c => c.length >= 10, prog: c => [Math.min(c.length,10), 10] },
  { id: 'score70',  icon: 'wave',     label: ['Buen comunicador', 'Good communicator'],  desc: ['Alcanzaste un score de 70+', 'You reached a score of 70+'],         color: '#fbbf24', unlocked: c => c.some(e => e._s >= 70) },
  { id: 'score80',  icon: 'sparkle',  label: ['Gran comunicador', 'Great communicator'], desc: ['Alcanzaste un score de 80+', 'You reached a score of 80+'],         color: '#f97316', unlocked: c => c.some(e => e._s >= 80) },
  { id: 'score90',  icon: 'brain',    label: ['Experto en pitch', 'Pitch expert'],   desc: ['Alcanzaste un score de 90+', 'You reached a score of 90+'],         color: '#a78bfa', unlocked: c => c.some(e => e._s >= 90) },
  { id: 'free',     icon: 'play',     label: ['Pitch libre', 'Free pitch'],          desc: ['Completaste un pitch sin guión', 'You completed an unscripted pitch'],     color: '#9ef5be', unlocked: c => c.some(e => e._t?.toLowerCase().includes('libre')) },
  { id: 'perfect',  icon: 'check',    label: ['Puntaje perfecto', 'Perfect score'],  desc: ['Score de 95 o más en una sesión', 'Score of 95 or more in a session'],    color: '#a78bfa', unlocked: c => c.some(e => e._s >= 95) },
];

const ScoreChart = ({ data }) => {
  if (!data || data.length < 2) return (
    <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-30)', fontSize: 12 }}>
      {window.L('Completá al menos 2 evaluaciones para ver el gráfico de progreso.', 'Complete at least 2 evaluations to see the progress chart.')}
    </div>
  );
  const W = 600, H = 140, PL = 36, PR = 16, PT = 12, PB = 28;
  const iw = W - PL - PR, ih = H - PT - PB;
  const scores = data.map(d => d.s);
  const lo = Math.max(0, Math.min(...scores) - 8);
  const hi = Math.min(100, Math.max(...scores) + 8);
  const cx = i => PL + (i / (data.length - 1)) * iw;
  const cy = s => PT + ih - ((s - lo) / (hi - lo)) * ih;
  const pts = data.map((d, i) => `${cx(i)},${cy(d.s)}`).join(' ');
  const area = `M${cx(0)},${cy(data[0].s)} ` + data.slice(1).map((d,i) => `L${cx(i+1)},${cy(d.s)}`).join(' ')
    + ` L${cx(data.length-1)},${H-PB} L${PL},${H-PB}Z`;
  const guides = [25,50,75,100].filter(v => v >= lo - 5 && v <= hi + 5);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9ef5be" stopOpacity={0.18}/>
          <stop offset="100%" stopColor="#9ef5be" stopOpacity={0}/>
        </linearGradient>
      </defs>
      {guides.map(v => (
        <g key={v}>
          <line x1={PL} y1={cy(v)} x2={W-PR} y2={cy(v)} stroke="rgba(255,255,255,0.05)" strokeWidth={1}/>
          <text x={PL-5} y={cy(v)+4} textAnchor="end" fontSize={8.5} fill="rgba(255,255,255,0.22)">{v}</text>
        </g>
      ))}
      <path d={area} fill="url(#sg)"/>
      <polyline points={pts} fill="none" stroke="#9ef5be" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={cx(i)} cy={cy(d.s)} r={3.5} fill="#9ef5be" stroke="rgba(0,0,0,0.6)" strokeWidth={1.5}/>
          {(i === 0 || i === data.length - 1 || data.length <= 7) && (
            <text x={cx(i)} y={H - 4} textAnchor="middle" fontSize={8.5} fill="rgba(255,255,255,0.22)">{d.label}</text>
          )}
        </g>
      ))}
    </svg>
  );
};

const SellerProgress = ({ user }) => {
  window.useLang(); const L = window.L;
  const [evals, setEvals] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.ApexAPI.getEvaluations(1, 50)
      .then(d => setEvals(d))
      .catch(() => setEvals({ data: [], total: 0 }))
      .finally(() => setLoading(false));
  }, []);

  const completed = (evals?.data || [])
    .filter(e => e.status === 'completed')
    .map(e => ({ ...e, _s: evalScore(e) ?? 0, _t: e.title || '' }))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const chartData = completed.map(e => ({
    s: e._s,
    label: new Date(e.created_at).toLocaleDateString(L('es-AR', 'en-US'), { day: 'numeric', month: 'short' }),
  }));

  const avgScore  = completed.length ? Math.round(completed.reduce((s,e) => s + e._s, 0) / completed.length) : null;
  const bestScore = completed.length ? Math.max(...completed.map(e => e._s)) : null;
  const lastScore = completed.length ? completed[completed.length - 1]._s : null;
  const trend     = completed.length >= 2 ? lastScore - completed[completed.length - 2]._s : null;

  const scoreCol = s => s >= 80 ? '#9ef5be' : s >= 60 ? '#fbbf24' : '#fca5a5';

  return (
    <div className="s-stage">
      <div className="s-wrap">

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 300, letterSpacing: '-0.01em' }}>{L('Tu evolución', 'Your evolution')}</div>
            {!loading && (
              <div className="mono" style={{ fontSize: 10, color: 'var(--ink-30)', marginTop: 3 }}>
                {completed.length === 0 ? L('completá evaluaciones para ver tu progreso', 'complete evaluations to see your progress') : `${completed.length} ${L(completed.length !== 1 ? 'evaluaciones completadas' : 'evaluación completada', 'completed')}`}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-25)', fontSize: 12 }}>{L('Cargando…', 'Loading…')}</div>
        ) : (
          <>
            {/* stats — solo con datos */}
            {completed.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: L('Score promedio', 'Average score'), value: avgScore,  color: avgScore  ? scoreCol(avgScore)  : 'var(--ink-20)', unit: '/100' },
                  { label: L('Mejor score', 'Best score'),    value: bestScore, color: '#a78bfa', unit: '/100' },
                  { label: L('Última sesión', 'Last session'),  value: lastScore, color: lastScore ? scoreCol(lastScore) : 'var(--ink-20)', unit: '/100' },
                  { label: L('Tendencia', 'Trend'),      value: trend !== null ? (trend >= 0 ? `+${trend}` : `${trend}`) : '—',
                    color: trend > 0 ? '#9ef5be' : trend < 0 ? '#fca5a5' : 'var(--ink-40)',
                    unit: trend !== null ? 'pts' : '' },
                ].map(({ label, value, unit, color }) => (
                  <div key={label} style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="mono" style={{ fontSize: 9, color: 'var(--ink-28)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
                    <div style={{ fontSize: 24, fontWeight: 200, color, lineHeight: 1 }}>
                      {value ?? '—'}<span style={{ fontSize: 10, color: 'var(--ink-30)', marginLeft: 3 }}>{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* gráfico */}
            <div style={{ padding: '18px 20px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div className="mono" style={{ fontSize: 9, color: 'var(--ink-28)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>{L('Score por sesión', 'Score per session')}</div>
                {completed.length > 0 && (
                  <span className="mono" style={{ fontSize: 9, color: 'var(--ink-25)' }}>{completed.length} {L(completed.length !== 1 ? 'sesiones' : 'sesión', completed.length !== 1 ? 'sessions' : 'session')}</span>
                )}
              </div>
              {completed.length < 2 ? (
                <div style={{ height: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, border: '1px dashed rgba(255,255,255,0.07)' }}>
                  <SIcon name="progress" size={20} stroke={1} style={{ color: 'rgba(255,255,255,0.12)' }} />
                  <div style={{ fontSize: 12, color: 'var(--ink-25)', textAlign: 'center' }}>
                    {completed.length === 0 ? L('Completá tu primera evaluación para ver el gráfico', 'Complete your first evaluation to see the chart') : L('Necesitás al menos 2 evaluaciones para ver la evolución', 'You need at least 2 evaluations to see the evolution')}
                  </div>
                </div>
              ) : (
                <ScoreChart data={chartData} />
              )}
            </div>

            {/* logros */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="mono" style={{ fontSize: 9, color: 'var(--ink-28)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>{L('Logros', 'Achievements')}</div>
              <span className="mono" style={{ fontSize: 9, color: 'var(--ink-25)' }}>
                {BADGES_DEF.filter(b => b.unlocked(completed)).length}/{BADGES_DEF.length} {L('obtenidos', 'unlocked')}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
              {BADGES_DEF.map(b => {
                const ok  = b.unlocked(completed);
                const prg = b.prog ? b.prog(completed) : null;
                return (
                  <div key={b.id} style={{
                    padding: '16px 14px', textAlign: 'center', borderRadius: 10,
                    background: ok ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                    border: ok ? `1px solid ${b.color}33` : '1px solid rgba(255,255,255,0.06)',
                    opacity: ok ? 1 : 0.5, transition: 'opacity 300ms',
                  }}>
                    <div style={{ marginBottom: 8, color: ok ? b.color : 'var(--ink-25)' }}>
                      <SIcon name={b.icon} size={20} stroke={1.3} />
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 400, marginBottom: 3, color: ok ? 'var(--ink-80)' : 'var(--ink-40)' }}>{L(b.label[0], b.label[1])}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-30)', lineHeight: 1.4 }}>{L(b.desc[0], b.desc[1])}</div>
                    {prg && !ok && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ height: 2, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(prg[0]/prg[1])*100}%`, background: b.color, borderRadius: 99 }} />
                        </div>
                        <div className="mono" style={{ fontSize: 9, color: 'var(--ink-25)', marginTop: 3 }}>{prg[0]}/{prg[1]}</div>
                      </div>
                    )}
                    {ok && <div className="mono" style={{ fontSize: 9, color: b.color, marginTop: 6, letterSpacing: '0.08em' }}>{L('obtenido', 'unlocked')}</div>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ============================================================
   COACHING IA — recomendaciones consolidadas
   ============================================================ */
const COACHING_TIPS = [
  { icon: 'wave', category: ['Voz y prosodia', 'Voice & prosody'], color: '#60a5fa', tips: [
    ['Hacé pausas de 1–2 segundos antes de los puntos clave. El silencio refuerza el mensaje.', 'Pause for 1–2 seconds before key points. Silence reinforces the message.'],
    ['Variá el tono: las preguntas retóricas suben, las afirmaciones fuertes bajan.', 'Vary your tone: rhetorical questions go up, strong statements go down.'],
    ['Controlá las muletillas: contá cuántas veces usás "eh", "o sea", "básicamente" por minuto.', 'Watch filler words: count how often you say "um", "like", "basically" per minute.'],
  ]},
  { icon: 'body', category: ['Lenguaje corporal', 'Body language'], color: '#9ef5be', tips: [
    ['Mantené contacto visual directo cuando describís el beneficio principal.', 'Keep direct eye contact when describing the main benefit.'],
    ['Gestos abiertos (palmas hacia arriba) generan más confianza que los brazos cruzados.', 'Open gestures (palms up) build more trust than crossed arms.'],
    ['La postura recta pero relajada proyecta seguridad sin tensión. Evitá encogerte.', 'An upright but relaxed posture projects confidence without tension. Avoid slouching.'],
  ]},
  { icon: 'brain', category: ['Estructura del discurso', 'Speech structure'], color: '#f9d45b', tips: [
    ['Empezá con el problema del cliente, no con tu producto. El dolor primero.', "Start with the customer's problem, not your product. Pain first."],
    ['Una sola idea central por minuto de presentación. Más es ruido.', 'One core idea per minute of presentation. More is noise.'],
    ['Cerrá siempre con un llamado a la acción concreto: fecha, número, próximo paso.', 'Always close with a concrete call to action: a date, a number, a next step.'],
  ]},
  { icon: 'sparkle', category: ['Manejo de objeciones', 'Objection handling'], color: '#f97316', tips: [
    ['Ante "es caro": validá la preocupación primero, luego anclá en ROI, no en precio.', 'On "it\'s expensive": validate the concern first, then anchor on ROI, not price.'],
    ['Ante "no es el momento": preguntá qué tendría que pasar para que sí lo sea.', 'On "it\'s not the right time": ask what would need to happen for it to be.'],
    ['Evitá el silencio incómodo: si no sabés la respuesta, pedí tiempo para investigar.', "Avoid awkward silence: if you don't know the answer, ask for time to look into it."],
  ]},
];

const SellerCoaching = ({ user, onGoToPlan }) => {
  window.useLang(); const L = window.L;
  const [evals, setEvals]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive]   = useState(0);

  useEffect(() => {
    window.ApexAPI.getEvaluations(1, 20)
      .then(d => setEvals(d))
      .catch(() => setEvals({ data: [], total: 0 }))
      .finally(() => setLoading(false));
  }, []);

  const completed = (evals?.data || []).filter(e => e.status === 'completed');
  const avgScore  = completed.length
    ? Math.round(completed.reduce((s, e) => s + (evalScore(e) ?? 0), 0) / completed.length)
    : null;

  const tip = COACHING_TIPS[active];

  return (
    <div className="s-stage">
      <div className="s-wrap" style={{ maxWidth: 900 }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 300, letterSpacing: '-0.01em' }}>{L('Coaching IA', 'AI Coaching')}</div>
            {!loading && (
              <div className="mono" style={{ fontSize: 10, color: 'var(--ink-30)', marginTop: 3 }}>
                {avgScore !== null ? `${L('score promedio', 'average score')} ${avgScore}/100 · ${L('técnicas personalizadas', 'personalized techniques')}` : L('técnicas para vendedores en formación', 'techniques for sellers in training')}
              </div>
            )}
          </div>
        </div>

        {!loading && completed.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(158,245,190,0.04)', border: '1px solid rgba(158,245,190,0.1)', marginBottom: 18 }}>
            <span style={{ color: '#9ef5be', flexShrink: 0 }}><SIcon name="sparkle" size={13} stroke={1.4} /></span>
            <span style={{ fontSize: 12, color: 'var(--ink-45)' }}>{L('El coaching se personaliza con tus datos luego de tu primera evaluación.', 'Coaching gets personalized with your data after your first evaluation.')}</span>
          </div>
        )}

        {/* CATEGORÍAS */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {COACHING_TIPS.map((c, i) => (
            <button key={c.category} onClick={() => setActive(i)}
              style={{
                background: active === i ? 'rgba(255,255,255,0.1)' : 'none',
                border: active === i ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 999, padding: '7px 16px', cursor: 'pointer',
                fontSize: 12, color: active === i ? 'var(--ink-90)' : 'var(--ink-40)',
                display: 'flex', alignItems: 'center', gap: 7, transition: 'all 150ms',
              }}>
              <span style={{ color: c.color }}><SIcon name={c.icon} size={13} stroke={1.4} /></span>
              {L(c.category[0], c.category[1])}
            </button>
          ))}
        </div>

        {/* TIPS ACTIVOS */}
        <div className="glass" style={{ padding: '28px 32px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <span style={{ color: tip.color }}><SIcon name={tip.icon} size={20} stroke={1.3} /></span>
            <div style={{ fontSize: 15, fontWeight: 400, letterSpacing: '-0.01em' }}>{L(tip.category[0], tip.category[1])}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {tip.tips.map((tp, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <span style={{ fontSize: 10, color: tip.color, fontWeight: 600 }}>{i + 1}</span>
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--ink-75)', lineHeight: 1.65, margin: 0 }}>{L(tp[0], tp[1])}</p>
              </div>
            ))}
          </div>
        </div>

        {/* UPSELL COACHING IA PERSONALIZADO */}
        <div style={{ padding: '18px 22px', borderRadius: 11, marginBottom: 32, display: 'flex', alignItems: 'center', gap: 20,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 400, marginBottom: 4, color: 'var(--ink-70)' }}>{L('Coaching IA personalizado', 'Personalized AI coaching')}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-35)', lineHeight: 1.55 }}>
              {L('Con el plan Growth la IA genera un plan de mejora específico: áreas débiles, ejercicios y metas semanales.', 'With the Growth plan, the AI generates a specific improvement plan: weak areas, drills and weekly goals.')}
            </div>
          </div>
          <button className="btn" onClick={onGoToPlan}
            style={{ flexShrink: 0, padding: '9px 18px', fontSize: 11.5, letterSpacing: '0.06em', whiteSpace: 'nowrap', color: 'var(--ink-60)' }}>
            {L('Ver plan Growth', 'See Growth plan')}
          </button>
        </div>

      </div>
    </div>
  );
};

/* ============================================================
   MI PLAN — vista de plan actual + upgrade
   ============================================================ */
const PLANS = [
  {
    id: 'starter', name: 'Starter', price: '$39', unit: ['USD / usuario / mes', 'USD / user / month'],
    tokens: 600, color: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)',
    features: [['~120 evaluaciones / mes', '~120 evaluations / month'], ['Análisis de voz y lenguaje corporal', 'Voice & body-language analysis'], ['Score con IA', 'AI score'], ['Historial y exportación CSV', 'History and CSV export']],
  },
  {
    id: 'growth', name: 'Growth', price: '$89', unit: ['USD / usuario / mes', 'USD / user / month'],
    tokens: 2000, color: 'rgba(120,255,180,0.05)', border: 'rgba(120,255,180,0.35)',
    badge: ['Más elegido', 'Most popular'],
    features: [['~400 evaluaciones / mes', '~400 evaluations / month'], ['Coaching IA por vendedor', 'AI coaching per seller'], ['Dashboard de equipo', 'Team dashboard'], ['Reportes PDF/CSV', 'PDF/CSV reports'], ['GPT-4.1 premium', 'GPT-4.1 premium'], ['Tokens acumulables', 'Rollover tokens']],
  },
  {
    id: 'enterprise', name: 'Enterprise', price: ['A medida', 'Custom'], unit: ['desde 50+ usuarios', 'from 50+ users'],
    tokens: null, color: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)',
    features: [['Tokens ilimitados', 'Unlimited tokens'], ['SSO (Google, Azure, Okta)', 'SSO (Google, Azure, Okta)'], ['Multi-tenant avanzado', 'Advanced multi-tenant'], ['SLA 99.9%', 'SLA 99.9%'], ['Onboarding incluido', 'Onboarding included']],
  },
];

const SellerPlan = ({ user }) => {
  window.useLang(); const L = window.L;
  const currentPlan = 'starter';
  const tokensUsed  = 0;
  const tokensTotal = 600;
  const pct = tokensUsed / tokensTotal;
  const r = 30, circ = 2 * Math.PI * r;
  const [upgradeTarget, setUpgradeTarget] = useState(null);

  return (
    <div className="s-stage">
      <div className="s-wrap" style={{ maxWidth: 900 }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 300, letterSpacing: '-0.01em' }}>{L('Mi plan', 'My plan')}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-30)', marginTop: 3 }}>
              {L('Plan Starter · renovación mensual', 'Starter plan · monthly renewal')} · {tokensTotal - tokensUsed} {L('tokens disponibles', 'tokens available')}
            </div>
          </div>
        </div>

        {/* TOKEN USAGE */}
        <div className="glass" style={{ padding: '28px 32px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 32 }}>
          <svg width={76} height={76} viewBox="0 0 76 76" style={{ flexShrink: 0 }}>
            <circle cx={38} cy={38} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5}/>
            <circle cx={38} cy={38} r={r} fill="none" stroke="#9ef5be" strokeWidth={5}
              strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
              strokeLinecap="round" transform="rotate(-90 38 38)" style={{transition:'stroke-dashoffset 700ms ease'}}/>
            <text x={38} y={43} textAnchor="middle" fontSize={13} fontWeight={300} fill="white">
              {tokensUsed}/{tokensTotal}
            </text>
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{L('Tokens disponibles', 'Tokens available')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-50)', marginBottom: 10 }}>
              {tokensTotal - tokensUsed} {L('tokens restantes · cada evaluación consume 5 tokens', 'tokens left · each evaluation costs 5 tokens')}
            </div>
            <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(2, pct * 100)}%`, background: '#9ef5be', borderRadius: 99, transition: 'width 700ms ease' }} />
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-40)', marginBottom: 4 }}>{L('Próxima recarga', 'Next refill')}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-70)' }}>{L('En 30 días', 'In 30 days')}</div>
          </div>
        </div>

        {/* PLANES */}
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-40)', textTransform: 'uppercase', marginBottom: 16 }}>
          {L('Planes disponibles', 'Available plans')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 40 }}>
          {PLANS.map(p => {
            const isCurrent = p.id === currentPlan;
            return (
              <div key={p.id} className="glass" style={{
                padding: '24px 22px', display: 'flex', flexDirection: 'column',
                background: p.color, border: `1px solid ${p.border}`,
                position: 'relative',
              }}>
                {isCurrent && (
                  <div style={{ position: 'absolute', top: 14, right: 14,
                    fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '3px 8px',
                    borderRadius: 999, background: 'rgba(255,255,255,0.08)', color: 'var(--ink-50)',
                    border: '1px solid rgba(255,255,255,0.12)' }}>
                    {L('Plan actual', 'Current plan')}
                  </div>
                )}
                {p.badge && !isCurrent && (
                  <div style={{ alignSelf: 'flex-end', marginBottom: 12,
                    fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600,
                    padding: '3px 10px', borderRadius: 999,
                    background: 'rgba(120,255,180,0.18)', color: '#9ef5be',
                    border: '1px solid rgba(120,255,180,0.4)' }}>
                    {L(p.badge[0], p.badge[1])}
                  </div>
                )}
                <div className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--ink-50)', textTransform: 'uppercase', marginBottom: 6, marginTop: isCurrent ? 20 : 0 }}>
                  {p.name}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <span style={{ fontSize: 32, fontWeight: 200, letterSpacing: '-0.02em' }}>{Array.isArray(p.price) ? L(p.price[0], p.price[1]) : p.price}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-40)', marginLeft: 6 }}>{L(p.unit[0], p.unit[1])}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, flex: 1 }}>
                  {p.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-60)' }}>
                      <SIcon name="check" size={12} /> {L(f[0], f[1])}
                    </div>
                  ))}
                </div>
                <button className="btn"
                  style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 12,
                    opacity: isCurrent ? 0.35 : 0.85, cursor: isCurrent ? 'default' : 'pointer',
                    color: isCurrent ? 'var(--ink-40)' : 'var(--ink-70)' }}
                  disabled={isCurrent}
                  onClick={() => !isCurrent && setUpgradeTarget(p)}>
                  {isCurrent ? L('Plan actual', 'Current plan') : p.id === 'enterprise' ? L('Contactar ventas', 'Contact sales') : L('Actualizar plan', 'Upgrade plan')}
                </button>
              </div>
            );
          })}
        </div>

      </div>

      {/* MODAL DE UPGRADE */}
      {upgradeTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 24 }}
          onClick={e => e.target === e.currentTarget && setUpgradeTarget(null)}>
          <div className="glass" style={{ width: '100%', maxWidth: 440, padding: '36px 32px', textAlign: 'center', border: `1px solid ${upgradeTarget.border}` }}>
            <div style={{ marginBottom: 6 }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--ink-40)', textTransform: 'uppercase', marginBottom: 8 }}>{upgradeTarget.name}</div>
              <span style={{ fontSize: 38, fontWeight: 200 }}>{Array.isArray(upgradeTarget.price) ? L(upgradeTarget.price[0], upgradeTarget.price[1]) : upgradeTarget.price}</span>
              <span style={{ fontSize: 12, color: 'var(--ink-40)', marginLeft: 6 }}>{L(upgradeTarget.unit[0], upgradeTarget.unit[1])}</span>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-50)', marginBottom: 24, lineHeight: 1.65 }}>
              {upgradeTarget.id === 'enterprise'
                ? L('Contactá a nuestro equipo para armar un plan a medida para tu organización.', 'Contact our team to build a custom plan for your organization.')
                : `${L('Estás a punto de actualizar al plan', 'You are about to upgrade to the')} ${upgradeTarget.name} ${L('plan', 'plan')}. ${L('Un representante de Apex Vision se va a comunicar con vos para completar el proceso.', 'An Apex Vision rep will reach out to complete the process.')}`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {upgradeTarget.features.slice(0, 4).map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--ink-60)', textAlign: 'left' }}>
                  <SIcon name="check" size={13} /> {L(f[0], f[1])}
                </div>
              ))}
            </div>
            <a href={`mailto:ventas@apexvision.ai?subject=Upgrade%20a%20plan%20${upgradeTarget.name}&body=Hola%2C%20quiero%20actualizar%20mi%20plan%20a%20${upgradeTarget.name}.%20Mi%20cuenta%3A%20${encodeURIComponent(user?.email || '')}`}
              className="btn"
              style={{ display: 'block', width: '100%', textAlign: 'center', padding: '13px', fontSize: 13, letterSpacing: '0.08em', textDecoration: 'none', marginBottom: 10, boxSizing: 'border-box', color: 'var(--ink-80)' }}>
              {upgradeTarget.id === 'enterprise' ? L('Contactar ventas', 'Contact sales') : L('Solicitar upgrade', 'Request upgrade')}
            </a>
            <button onClick={() => setUpgradeTarget(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ink-40)', padding: '6px 0' }}>
              {L('Cancelar', 'Cancel')}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

/* ============================================================
   CONFIGURACIÓN — perfil del vendedor
   ============================================================ */
const SellerSettings = ({ user, onUserUpdate }) => {
  window.useLang(); const L = window.L;
  const storedName = localStorage.getItem('apex_display_name') || '';
  const [name, setName]         = useState(storedName || user?.name || '');
  const [saved, setSaved]       = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew]         = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError]     = useState('');
  const [pwSaved, setPwSaved]     = useState(false);
  const [showPw, setShowPw]       = useState(false);

  const inputStyle = { width: '100%', padding: '11px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13, boxSizing: 'border-box' };

  const handleSaveName = (e) => {
    e.preventDefault();
    localStorage.setItem('apex_display_name', name);
    if (onUserUpdate) onUserUpdate({ ...user, name });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    setPwError('');
    if (pwNew.length < 6) { setPwError(L('La nueva contraseña debe tener al menos 6 caracteres.', 'The new password must be at least 6 characters.')); return; }
    if (pwNew !== pwConfirm) { setPwError(L('Las contraseñas no coinciden.', 'Passwords do not match.')); return; }
    setPwSaved(true);
    setTimeout(() => { setPwSaved(false); setPwCurrent(''); setPwNew(''); setPwConfirm(''); }, 2500);
  };

  const Field = ({ label, children }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, color: 'var(--ink-40)', letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>{label}</div>
      {children}
    </div>
  );

  return (
    <div className="s-stage">
      <div className="s-wrap" style={{ maxWidth: 640 }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 300, letterSpacing: '-0.01em' }}>{L('Configuración', 'Settings')}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-30)', marginTop: 3 }}>
              {user?.email || L('configuración de cuenta', 'account settings')}
            </div>
          </div>
        </div>

        {/* DATOS PERSONALES */}
        <div className="glass" style={{ padding: '28px 32px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 22, color: 'var(--ink-80)' }}>{L('Datos personales', 'Personal info')}</div>
          <form onSubmit={handleSaveName} style={{ display: 'grid', gap: 16 }}>
            <Field label="Email">
              <input value={user?.email || ''} readOnly
                style={{ ...inputStyle, opacity: 0.45, cursor: 'not-allowed' }} />
              <div style={{ fontSize: 11, color: 'var(--ink-30)', marginTop: 5 }}>{L('El email no se puede modificar.', "Email can't be changed.")}</div>
            </Field>
            <Field label={L('Nombre para mostrar', 'Display name')}>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder={L('Tu nombre', 'Your name')} style={inputStyle} />
            </Field>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button type="submit" className="btn" style={{ padding: '11px 24px', fontSize: 12.5 }}>
                {L('Guardar cambios', 'Save changes')}
              </button>
              {saved && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ef5be' }}>
                  <SIcon name="check" size={13} stroke={2} /> {L('Guardado', 'Saved')}
                </span>
              )}
            </div>
          </form>
        </div>

        {/* CAMBIAR CONTRASEÑA */}
        <div className="glass" style={{ padding: '28px 32px', marginBottom: 40 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 22, color: 'var(--ink-80)' }}>{L('Cambiar contraseña', 'Change password')}</div>
          <form onSubmit={handleChangePassword} style={{ display: 'grid', gap: 14 }}>
            <Field label={L('Contraseña actual', 'Current password')}>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={pwCurrent} onChange={e => setPwCurrent(e.target.value)}
                  placeholder={L('Tu contraseña actual', 'Your current password')} required style={{ ...inputStyle, padding: '11px 42px 11px 14px' }} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-40)', padding: 4, display: 'flex', alignItems: 'center' }}>
                  <SIcon name={showPw ? 'eye-off' : 'eye'} size={15} stroke={1.5} />
                </button>
              </div>
            </Field>
            <Field label={L('Nueva contraseña', 'New password')}>
              <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)}
                placeholder={L('Mínimo 6 caracteres', 'Minimum 6 characters')} required style={inputStyle} />
            </Field>
            <Field label={L('Confirmá la nueva contraseña', 'Confirm new password')}>
              <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
                placeholder={L('Repetí la contraseña', 'Repeat the password')} required style={inputStyle} />
            </Field>
            {pwError && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 7, background: 'rgba(252,165,165,0.08)', border: '1px solid rgba(252,165,165,0.2)' }}>
                <span style={{ color: '#fca5a5', fontSize: 13, marginTop: 1 }}>!</span>
                <span className="mono" style={{ fontSize: 11, color: '#fca5a5', lineHeight: 1.55 }}>{pwError}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button type="submit" className="btn" style={{ padding: '11px 24px', fontSize: 12.5, opacity: 0.75 }}>
                {L('Actualizar contraseña', 'Update password')}
              </button>
              {pwSaved && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ef5be' }}>
                  <SIcon name="check" size={13} stroke={2} /> {L('Contraseña actualizada', 'Password updated')}
                </span>
              )}
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};

/* ============================================================
   PERFIL — página de perfil del vendedor
   ============================================================ */
const SellerProfile = ({ user, onGoTab }) => {
  window.useLang(); const L = window.L;
  const [evals, setEvals] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.ApexAPI.getEvaluations(1, 50)
      .then(d => setEvals(d))
      .catch(() => setEvals({ data: [], total: 0 }))
      .finally(() => setLoading(false));
  }, []);

  const storedName   = localStorage.getItem('apex_display_name') || '';
  const displayName  = storedName || user?.name || user?.email?.split('@')[0] || L('Vendedor', 'Seller');
  const initials     = displayName.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const memberSince  = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(L('es-AR', 'en-US'), { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const completed = (evals?.data || [])
    .filter(e => e.status === 'completed' || e.status === 'scored')
    .map(e => ({ ...e, _s: evalScore(e) ?? 0 }));

  const scores    = completed.map(e => e._s);
  const avgScore  = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const bestScore = scores.length ? Math.max(...scores) : null;
  const scoreCol  = s => s >= 80 ? '#9ef5be' : s >= 60 ? '#fbbf24' : '#fca5a5';

  // this month
  const now = new Date();
  const thisMonth = (evals?.data || []).filter(e => {
    const d = new Date(e.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const unlockedBadges = BADGES_DEF.filter(b => b.unlocked(completed));

  return (
    <div className="s-stage">
      <div className="s-wrap" style={{ maxWidth: 760 }}>

        {/* ── hero de perfil ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 24, padding: '24px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {/* avatar grande */}
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 26, fontWeight: 200, color: 'var(--ink-70)' }}>{initials}</span>
          </div>
          {/* datos */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 200, letterSpacing: '-0.02em', color: 'var(--ink-90)', marginBottom: 4 }}>{displayName}</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-40)', marginBottom: 12 }}>{user?.email}</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-45)' }}>
                <SIcon name="user" size={12} stroke={1.4} />
                {L('Vendedor', 'Seller')}
              </div>
              {memberSince && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-45)' }}>
                  <SIcon name="history" size={12} stroke={1.4} />
                  {L('Miembro desde', 'Member since')} {memberSince}
                </div>
              )}
              {unlockedBadges.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-45)' }}>
                  <SIcon name="sparkle" size={12} stroke={1.4} />
                  {unlockedBadges.length} {L(unlockedBadges.length !== 1 ? 'logros obtenidos' : 'logro obtenido', unlockedBadges.length !== 1 ? 'achievements unlocked' : 'achievement unlocked')}
                </div>
              )}
            </div>
          </div>
          {/* botón editar */}
          <button className="btn" onClick={() => onGoTab('settings')}
            style={{ fontSize: 11.5, padding: '8px 16px', opacity: 0.65, flexShrink: 0 }}>
            {L('Editar perfil', 'Edit profile')}
          </button>
        </div>

        {/* ── estadísticas ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: L('Evaluaciones', 'Evaluations'), value: evals?.total ?? '—', sub: `${completed.length} ${L('completadas', 'completed')}`, color: 'var(--ink-70)' },
            { label: L('Score promedio', 'Average score'), value: avgScore ? `${avgScore}` : '—', sub: avgScore ? (avgScore >= 80 ? L('Excelente', 'Excellent') : avgScore >= 60 ? L('En progreso', 'In progress') : L('Mejorando', 'Improving')) : L('sin datos', 'no data'), color: avgScore ? scoreCol(avgScore) : 'var(--ink-20)', unit: avgScore ? '/100' : '' },
            { label: L('Mejor score', 'Best score'),   value: bestScore ? `${bestScore}` : '—', sub: bestScore ? L('tu récord', 'your record') : L('sin datos', 'no data'), color: bestScore ? '#a78bfa' : 'var(--ink-20)', unit: bestScore ? '/100' : '' },
            { label: L('Este mes', 'This month'),      value: thisMonth.length, sub: `${thisMonth.filter(e => e.status === 'completed' || e.status === 'scored').length} ${L('completadas', 'completed')}`, color: thisMonth.length > 0 ? 'var(--ink-70)' : 'var(--ink-20)' },
          ].map(({ label, value, sub, color, unit }) => (
            <div key={label} style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="mono" style={{ fontSize: 9, color: 'var(--ink-28)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 200, color, lineHeight: 1, marginBottom: 4 }}>
                {value}{unit && <span style={{ fontSize: 10, color: 'var(--ink-30)', marginLeft: 2 }}>{unit}</span>}
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-25)' }}>{loading ? '…' : sub}</div>
            </div>
          ))}
        </div>

        {/* ── logros ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="mono" style={{ fontSize: 9, color: 'var(--ink-28)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>{L('Logros', 'Achievements')}</div>
            <span className="mono" style={{ fontSize: 9, color: 'var(--ink-25)' }}>{unlockedBadges.length}/{BADGES_DEF.length} {L('obtenidos', 'unlocked')}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {BADGES_DEF.map(b => {
              const ok  = b.unlocked(completed);
              const prg = b.prog ? b.prog(completed) : null;
              return (
                <div key={b.id} style={{
                  padding: '16px 14px', textAlign: 'center', borderRadius: 10,
                  background: ok ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                  border: ok ? `1px solid ${b.color}33` : '1px solid rgba(255,255,255,0.05)',
                  opacity: ok ? 1 : 0.45, transition: 'opacity 300ms',
                }}>
                  <div style={{ marginBottom: 8, color: ok ? b.color : 'var(--ink-25)' }}>
                    <SIcon name={b.icon} size={20} stroke={1.3} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 400, marginBottom: 3, color: ok ? 'var(--ink-80)' : 'var(--ink-40)' }}>{L(b.label[0], b.label[1])}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-28)', lineHeight: 1.4 }}>{L(b.desc[0], b.desc[1])}</div>
                  {prg && !ok && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ height: 2, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(prg[0]/prg[1])*100}%`, background: b.color, borderRadius: 99 }} />
                      </div>
                      <div className="mono" style={{ fontSize: 9, color: 'var(--ink-25)', marginTop: 3 }}>{prg[0]}/{prg[1]}</div>
                    </div>
                  )}
                  {ok && <div className="mono" style={{ fontSize: 9, color: b.color, marginTop: 6, letterSpacing: '0.08em' }}>{L('obtenido', 'unlocked')}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── actividad reciente ── */}
        {!loading && completed.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="mono" style={{ fontSize: 9, color: 'var(--ink-28)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>{L('Actividad reciente', 'Recent activity')}</div>
              <button onClick={() => onGoTab('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--ink-35)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {L('Ver todas', 'View all')} <SIcon name="arrow" size={11} stroke={1.5} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...completed].reverse().slice(0, 5).map((ev, i) => (
                <div key={ev.id || i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 14px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${scoreCol(ev._s)}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 300, color: scoreCol(ev._s) }}>{ev._s}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title || L('Evaluación sin título', 'Untitled evaluation')}</div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--ink-30)', marginTop: 2 }}>
                      {new Date(ev.created_at).toLocaleDateString(L('es-AR', 'en-US'), { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#9ef5be', flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && completed.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', borderRadius: 11, border: '1px dashed rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-30)', marginBottom: 14 }}>{L('Todavía no hay evaluaciones completadas', 'No completed evaluations yet')}</div>
            <button className="btn btn-primary" onClick={() => onGoTab('home')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', fontSize: 12 }}>
              <SIcon name="mic" size={13} stroke={1.5} /> {L('Hacer mi primera evaluación', 'Do my first evaluation')}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

/* ============================================================
   MAIN DASHBOARD — vista general del vendedor
   ============================================================ */
const normScore = (e) => evalScore(e);

const ScoreMini = ({ scores }) => {
  if (scores.length < 2) return null;
  const W = 160, H = 44, pad = 6;
  const lo = Math.max(0, Math.min(...scores) - 8);
  const hi = Math.min(100, Math.max(...scores) + 8);
  const range = hi - lo || 1;
  const xs = scores.map((_, i) => pad + (i / (scores.length - 1)) * (W - pad * 2));
  const ys = scores.map(s => H - pad - ((s - lo) / range) * (H - pad * 2));
  const last = scores[scores.length - 1];
  const prev = scores[scores.length - 2];
  const color = last > prev ? '#9ef5be' : last < prev ? '#fca5a5' : 'rgba(255,255,255,0.35)';
  const area = `M${xs[0]},${H} ` + xs.map((x, i) => `L${x},${ys[i]}`).join(' ') + ` L${xs[xs.length-1]},${H} Z`;
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sg)" />
      <polyline points={xs.map((x, i) => `${x},${ys[i]}`).join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xs[xs.length-1]} cy={ys[ys.length-1]} r={3.5} fill={color} />
    </svg>
  );
};

const SellerMainDashboard = ({ user, onStart, onGoTab }) => {
  window.useLang(); const L = window.L;
  const [evals, setEvals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.ApexAPI.getEvaluations(1, 20)
      .then(r => setEvals(r.data || r || []))
      .catch(() => setEvals([]))
      .finally(() => setLoading(false));
  }, []);

  const displayName = user?.name || user?.email?.split('@')[0] || L('Vendedor', 'Seller');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? L('Buenos días', 'Good morning') : hour < 18 ? L('Buenas tardes', 'Good afternoon') : L('Buenas noches', 'Good evening');

  const completed = evals.filter(e => e.status === 'completed' || e.status === 'scored');
  const scores = completed.map(normScore).filter(s => s !== null);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const bestScore = scores.length ? Math.max(...scores) : null;
  const trend = scores.length >= 2 ? (scores[scores.length - 1] - scores[scores.length - 2]) : null;
  const recent = [...evals].reverse().slice(0, 4);

  const fmtDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString(L('es-AR', 'en-US'), { day: 'numeric', month: 'short' });
  };

  const scoreColor = (s) => s >= 80 ? '#9ef5be' : s >= 60 ? '#fbbf24' : '#fca5a5';

  /* ── layout compartido (vacío o con datos) ───────────────── */

  return (
    <div className="s-stage">
      <div className="s-wrap">

        {/* KPIs + CTA en la misma fila */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="mono" style={{ fontSize: 9, color: 'var(--ink-25)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>{L('Resumen', 'Summary')}</div>
          <button className="btn btn-primary" onClick={onStart} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', fontSize: 11.5 }}>
            <SIcon name="mic" size={12} stroke={1.5} />
            {L('Nueva evaluación', 'New evaluation')}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>

          {/* score promedio */}
          <div style={{ padding: '16px 18px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderTop: avgScore !== null ? `2px solid ${scoreColor(avgScore)}` : '1px solid rgba(255,255,255,0.07)' }}>
            <div className="mono" style={{ fontSize: 9, color: 'var(--ink-30)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>{L('Score promedio', 'Average score')}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 30, fontWeight: 200, color: avgScore !== null ? scoreColor(avgScore) : 'var(--ink-20)', lineHeight: 1 }}>{avgScore ?? '—'}</span>
              {avgScore !== null && <span style={{ fontSize: 11, color: 'var(--ink-30)' }}>/100</span>}
            </div>
            {avgScore !== null
              ? <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}><div style={{ width: `${avgScore}%`, height: '100%', borderRadius: 2, background: scoreColor(avgScore) }} /></div>
              : <div style={{ fontSize: 10, color: 'var(--ink-20)', marginTop: 8 }}>{L('promedio de todas tus sesiones', 'average across all your sessions')}</div>}
          </div>

          {/* mejor score */}
          <div style={{ padding: '16px 18px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderTop: bestScore !== null ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.07)' }}>
            <div className="mono" style={{ fontSize: 9, color: 'var(--ink-30)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>{L('Mejor score', 'Best score')}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 30, fontWeight: 200, color: bestScore !== null ? '#a78bfa' : 'var(--ink-20)', lineHeight: 1 }}>{bestScore ?? '—'}</span>
              {bestScore !== null && <span style={{ fontSize: 11, color: 'var(--ink-30)' }}>/100</span>}
            </div>
            {bestScore !== null
              ? <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}><div style={{ width: `${bestScore}%`, height: '100%', borderRadius: 2, background: '#a78bfa' }} /></div>
              : <div style={{ fontSize: 10, color: 'var(--ink-20)', marginTop: 8 }}>{L('tu puntaje más alto hasta ahora', 'your highest score so far')}</div>}
          </div>

          {/* evaluaciones */}
          <div style={{ padding: '16px 18px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="mono" style={{ fontSize: 9, color: 'var(--ink-30)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>{L('Evaluaciones', 'Evaluations')}</div>
            <div style={{ fontSize: 30, fontWeight: 200, lineHeight: 1, color: evals.length > 0 ? 'var(--ink-80)' : 'var(--ink-20)' }}>{evals.length}</div>
            <div style={{ fontSize: 10, color: 'var(--ink-25)', marginTop: 8 }}>
              {evals.length === 0 ? L('ninguna realizada aún', 'none yet') : `${completed.length} ${L(completed.length !== 1 ? 'completadas' : 'completada', 'completed')}`}
            </div>
          </div>

          {/* tendencia */}
          <div style={{ padding: '16px 18px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderTop: trend !== null ? `2px solid ${trend > 0 ? '#9ef5be' : trend < 0 ? '#fca5a5' : 'rgba(255,255,255,0.15)'}` : '1px solid rgba(255,255,255,0.07)' }}>
            <div className="mono" style={{ fontSize: 9, color: 'var(--ink-30)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>{L('Tendencia', 'Trend')}</div>
            <div style={{ fontSize: 30, fontWeight: 200, lineHeight: 1, color: trend !== null ? (trend > 0 ? '#9ef5be' : trend < 0 ? '#fca5a5' : 'var(--ink-40)') : 'var(--ink-20)' }}>
              {trend !== null ? (trend > 0 ? `+${trend}` : `${trend}`) : '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--ink-25)', marginTop: 8 }}>
              {trend !== null ? L('vs evaluación anterior', 'vs previous evaluation') : L('necesitás 2+ evaluaciones', 'you need 2+ evaluations')}
            </div>
          </div>
        </div>

        {/* fila inferior: sparkline + historial */}
        <div style={{ display: 'grid', gridTemplateColumns: scores.length >= 2 ? '220px 1fr' : '1fr', gap: 12 }}>

          {scores.length >= 2 && (
            <div style={{ padding: '18px 20px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="mono" style={{ fontSize: 9, color: 'var(--ink-30)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14 }}>{L('Evolución', 'Evolution')}</div>
              <ScoreMini scores={scores.slice(-8)} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span className="mono" style={{ fontSize: 9, color: 'var(--ink-20)' }}>{L('hace', '')} {Math.min(8, scores.length)} {L('', 'ago')}</span>
                <span className="mono" style={{ fontSize: 9, color: 'var(--ink-20)' }}>{L('ahora', 'now')}</span>
              </div>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={() => onGoTab('progress')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--ink-50)', cursor: 'pointer', fontSize: 11 }}>
                  <SIcon name="progress" size={12} stroke={1.5} /> {L('Ver progreso completo', 'View full progress')}
                </button>
                <button onClick={() => onGoTab('coaching')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--ink-50)', cursor: 'pointer', fontSize: 11 }}>
                  <SIcon name="sparkle" size={12} stroke={1.5} /> {L('Coaching IA', 'AI Coaching')}
                </button>
              </div>
            </div>
          )}

          {/* tabla historial */}
          <div style={{ padding: '18px 20px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="mono" style={{ fontSize: 9, color: 'var(--ink-30)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>{L('Historial de evaluaciones', 'Evaluation history')}</div>
              {evals.length > 5 && (
                <button onClick={() => onGoTab('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--ink-35)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {L('Ver todas', 'View all')} <SIcon name="arrow" size={11} stroke={1.5} />
                </button>
              )}
            </div>

            {/* cabecera tabla */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 100px 72px', padding: '0 8px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {[L('Evaluación', 'Evaluation'), L('Fecha', 'Date'), L('Estado', 'Status'), 'Score'].map(h => (
                <div key={h} className="mono" style={{ fontSize: 9, color: 'var(--ink-25)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>

            {loading && <div style={{ padding: '20px 8px', color: 'var(--ink-20)', fontSize: 12 }}>{L('Cargando…', 'Loading…')}</div>}

            {!loading && evals.length === 0 && (
              <div style={{ padding: '32px 8px', textAlign: 'center' }}>
                <div style={{ color: 'var(--ink-25)', fontSize: 12, marginBottom: 14 }}>{L('Todavía no hay evaluaciones registradas', 'No evaluations yet')}</div>
                <button className="btn btn-primary" onClick={onStart} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', fontSize: 12 }}>
                  <SIcon name="mic" size={13} stroke={1.5} /> {L('Empezar ahora', 'Start now')}
                </button>
              </div>
            )}

            {!loading && evals.length > 0 && (
              <div>
                {[...evals].reverse().slice(0, 6).map((ev, i) => {
                  const s = normScore(ev);
                  const isComplete = ev.status === 'completed' || ev.status === 'scored';
                  const isProcessing = ev.status === 'processing';
                  return (
                    <div key={ev.id || i}
                      style={{ display: 'grid', gridTemplateColumns: '1fr 90px 100px 72px', padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', borderRadius: 6, cursor: 'default', transition: 'background 150ms' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.title || L('Sin título', 'Untitled')}
                      </div>
                      <div className="mono" style={{ fontSize: 10, color: 'var(--ink-30)' }}>
                        {ev.created_at ? fmtDate(ev.created_at) : '—'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: isComplete ? '#9ef5be' : isProcessing ? '#fbbf24' : 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                        <span className="mono" style={{ fontSize: 10, color: isComplete ? 'var(--ink-40)' : isProcessing ? '#fbbf24' : 'var(--ink-20)' }}>
                          {isComplete ? L('completada', 'completed') : isProcessing ? L('procesando', 'processing') : L('en curso', 'in progress')}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {s !== null
                          ? <span style={{ fontSize: 14, fontWeight: 300, color: scoreColor(s) }}>{s}<span style={{ fontSize: 9, color: 'var(--ink-25)', marginLeft: 1 }}>/100</span></span>
                          : <span style={{ fontSize: 11, color: 'var(--ink-20)' }}>—</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

/* backward-compat para admin-app.jsx */
const HOME_QUESTION = SCENARIOS[0];

Object.assign(window, {
  SIcon, ApexLogo, PublicTopBar, PublicLanding, ScenarioSelector, StepProgress,
  SellerDashboard, SellerProgress, SellerCoaching, SellerPlan, SellerSettings, SellerProfile,
  SellerMainDashboard,
  HOME_QUESTION, SCENARIOS, FEATURES,
  SellerTopBar: PublicTopBar,
  SellerHome: PublicLanding,
});
