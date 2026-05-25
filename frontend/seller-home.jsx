/* global React, AVSpark */
const { useState, useEffect, useRef } = React;

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
        onMouseLeave={e => e.target.style.color = 'var(--ink-60)'}>Cómo funciona</a>
      <a onClick={() => goSection('para-empresas')} style={linkStyle}
        onMouseEnter={e => e.target.style.color = 'var(--ink-90)'}
        onMouseLeave={e => e.target.style.color = 'var(--ink-60)'}>Para empresas</a>
      <a onClick={() => goSection('precios')} style={linkStyle}
        onMouseEnter={e => e.target.style.color = 'var(--ink-90)'}
        onMouseLeave={e => e.target.style.color = 'var(--ink-60)'}>Precios</a>
    </div>
    <div style={{ width: 120 }} />
  </div>
  );
};

/* ============================================================
   LANDING — hero público
   ============================================================ */
const FEATURES = [
  { icon: 'body',    title: 'Lenguaje corporal',   desc: 'Postura, gestos, contacto visual y presencia evaluados fotograma a fotograma.' },
  { icon: 'wave',    title: 'Análisis de voz',      desc: 'Velocidad, tono, pausas estratégicas, muletillas y claridad del discurso.' },
  { icon: 'brain',   title: 'Sugerencias con IA',   desc: 'Recomendaciones concretas y personalizadas para mejorar en tu próxima presentación.' },
];

const PublicLanding = ({ onStart }) => (
  <div className="s-stage">
    <div className="s-wrap" style={{ maxWidth: 860 }}>

      {/* HERO */}
      <div style={{ textAlign: 'center', padding: '72px 0 56px' }}>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.3em', color: 'var(--ink-40)', textTransform: 'uppercase', marginBottom: 20 }}>
          Apex Vision · Evaluación comercial con IA
        </div>
        <h1 style={{ fontSize: 54, fontWeight: 200, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 22 }}>
          Grabate.<br/>Mejorá tu pitch.
        </h1>
        <p style={{ fontSize: 16, color: 'var(--ink-70)', maxWidth: '48ch', margin: '0 auto 36px', lineHeight: 1.65 }}>
          Presentá tu producto, servicio o idea y recibí un análisis detallado de tu comunicación: cuerpo, voz y discurso.
        </p>
        <button className="btn btn-primary" onClick={onStart}
          style={{ padding: '16px 34px', fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', gap: 10 }}>
          <SIcon name="mic" size={14} /> Evaluar mi pitch — es gratis
        </button>
        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-30)', marginTop: 18, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          Sin instalación · Resultados en segundos · Tu video es privado
        </div>
      </div>

      {/* FEATURES */}
      <div id="features" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 56 }}>
        {FEATURES.map(f => (
          <div key={f.title} className="glass card-hover" style={{ padding: '26px 22px', textAlign: 'center' }}>
            <div style={{ marginBottom: 14, color: 'var(--ink-60)' }}>
              <SIcon name={f.icon} size={26} stroke={1.2} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, letterSpacing: '-0.005em' }}>{f.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-50)', lineHeight: 1.6 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* HOW IT WORKS */}
      <div id="how-it-works" className="glass" style={{ padding: '32px 36px', marginBottom: 56 }}>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-50)', textTransform: 'uppercase', marginBottom: 28, textAlign: 'center' }}>
          Cómo funciona
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
          {[
            ['01', 'Elegís el escenario',   'Seleccionás el tipo de pitch que querés practicar.'],
            ['02', 'Te grabás',             'Usamos tu cámara y micrófono — nada se sube sin tu ok.'],
            ['03', 'IA analiza',            'Pose, voz, gestos faciales y discurso en segundos.'],
            ['04', 'Mejorás',               'Métricas claras y sugerencias accionables para la próxima vez.'],
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
          ¿Listo para ver cómo te comunicás realmente?
        </p>
        <button className="btn btn-primary" onClick={onStart}
          style={{ padding: '16px 34px', fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', gap: 10 }}>
          <SIcon name="sparkle" size={14} /> Empezar ahora
        </button>
      </div>

      {/* PARA EMPRESAS */}
      <div id="para-empresas" className="glass" style={{ padding: '40px 44px', marginBottom: 60, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
        <div>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.28em', color: 'var(--ink-40)', textTransform: 'uppercase', marginBottom: 14 }}>
            Para empresas
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 200, letterSpacing: '-0.02em', marginBottom: 14, lineHeight: 1.2 }}>
            Evaluá a todo tu equipo comercial desde un solo lugar
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--ink-50)', lineHeight: 1.65, marginBottom: 24 }}>
            Con el panel de administración podés ver el rendimiento de cada vendedor, detectar quién necesita coaching y medir la mejora en el tiempo con métricas reales.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {[
              'Dashboard de equipo con score por vendedor',
              'Mapa de habilidades: confianza, voz, lenguaje corporal',
              'Sugerencias de coaching generadas por IA',
              'Reportes exportables por período',
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink-70)' }}>
                <SIcon name="check" size={14} />
                {f}
              </div>
            ))}
          </div>
          <a href="Apex Vision Console.html" className="btn btn-primary" style={{ display: 'inline-flex', padding: '13px 24px', fontSize: 12.5, letterSpacing: '0.12em', textTransform: 'uppercase', gap: 8, textDecoration: 'none' }}>
            <SIcon name="arrow" size={13} /> Ver panel de administración
          </a>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'Score promedio del equipo', value: '78', unit: '/100', delta: '+4 vs mes anterior' },
            { label: 'Evaluaciones este mes',     value: '156', unit: '',     delta: '↑ 22% participación' },
            { label: 'Vendedores activos',         value: '8',  unit: '/8',   delta: '100% activos esta semana' },
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
            Precios
          </div>
          <h2 style={{ fontSize: 32, fontWeight: 200, letterSpacing: '-0.02em', marginBottom: 12 }}>
            Planes que escalan con tu equipo
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--ink-50)', maxWidth: 540, margin: '0 auto', lineHeight: 1.65 }}>
            Sin contratos largos. Cancelá cuando quieras. Margen real para invertir en tus vendedores.
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
              <span style={{ fontSize: 13, color: 'var(--ink-50)', marginLeft: 6 }}>USD / usuario / mes</span>
            </div>
            <div className="mono" style={{ fontSize: 11, color: '#9ef5be', letterSpacing: '0.12em', marginBottom: 18 }}>
              ✦ 600 tokens incluidos / mes
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-50)', lineHeight: 1.6, marginBottom: 20 }}>
              Para equipos pequeños que arrancan a medir el desempeño comercial.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, flex: 1 }}>
              {[
                '~120 evaluaciones / mes (5 tokens c/u)',
                'Análisis de voz, lenguaje corporal y ritmo',
                'Score con recomendaciones de IA',
                'Historial individual y exportación CSV',
                'Recarga +500 tokens por $5 USD',
                'Soporte por email',
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--ink-70)' }}>
                  <SIcon name="check" size={13} /> {f}
                </div>
              ))}
            </div>
            <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
              Empezar gratis · 50 tokens
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
              Más elegido
            </div>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-50)', textTransform: 'uppercase', marginBottom: 8 }}>
              Growth
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 44, fontWeight: 200, letterSpacing: '-0.02em' }}>$89</span>
              <span style={{ fontSize: 13, color: 'var(--ink-50)', marginLeft: 6 }}>USD / usuario / mes</span>
            </div>
            <div className="mono" style={{ fontSize: 11, color: '#9ef5be', letterSpacing: '0.12em', marginBottom: 18 }}>
              ✦ 2,000 tokens incluidos / mes
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-50)', lineHeight: 1.6, marginBottom: 20 }}>
              Para equipos en crecimiento que necesitan coaching personalizado y reportes profundos.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, flex: 1 }}>
              {[
                '~400 evaluaciones / mes',
                'Plan de coaching IA por vendedor (20 tokens)',
                'Dashboard de equipo con tendencias',
                'Reportes PDF/CSV automáticos',
                'Análisis con GPT-4.1 (modelo premium)',
                'Tokens no usados se acumulan',
                'Soporte prioritario',
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--ink-70)' }}>
                  <SIcon name="check" size={13} /> {f}
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
              Empezar prueba · 200 tokens
            </button>
          </div>

          {/* ENTERPRISE */}
          <div className="glass" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column' }}>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-50)', textTransform: 'uppercase', marginBottom: 8 }}>
              Enterprise
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 32, fontWeight: 200, letterSpacing: '-0.02em' }}>A medida</span>
              <div style={{ fontSize: 12, color: 'var(--ink-50)', marginTop: 4 }}>desde 50+ usuarios</div>
            </div>
            <div className="mono" style={{ fontSize: 11, color: '#9ef5be', letterSpacing: '0.12em', marginBottom: 18 }}>
              ✦ Pool de tokens compartido
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-50)', lineHeight: 1.6, marginBottom: 20 }}>
              Para organizaciones grandes con requerimientos de compliance e integraciones.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, flex: 1 }}>
              {[
                'Tokens ilimitados o pool dedicado',
                'Multi-tenant con roles avanzados',
                'SSO (Google, Azure AD, Okta)',
                'Retención de datos personalizada',
                'Integraciones (Salesforce, HubSpot)',
                'SLA 99.9% y soporte dedicado',
                'Onboarding del equipo incluido',
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--ink-70)' }}>
                  <SIcon name="check" size={13} /> {f}
                </div>
              ))}
            </div>
            <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
              Contactar ventas
            </button>
          </div>
        </div>

        {/* Tabla de costos por token */}
        <div className="glass" style={{ marginTop: 28, padding: '28px 32px' }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-50)', textTransform: 'uppercase', marginBottom: 18, textAlign: 'center' }}>
            Cómo se consumen los tokens
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            {[
              { label: 'Evaluación de pitch',     value: '5 tokens',  desc: '$0.05 USD por video analizado' },
              { label: 'Plan de coaching IA',     value: '20 tokens', desc: '$0.20 USD análisis del equipo con GPT-4.1' },
              { label: 'Reporte PDF / CSV',       value: 'Gratis',    desc: 'sin costo en tokens' },
              { label: 'Recarga adicional',       value: '$10 / 1k',  desc: '+1.000 tokens por $10 USD (sin vencimiento)' },
            ].map(({ label, value, desc }) => (
              <div key={label}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--ink-50)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 300, letterSpacing: '-0.01em', marginBottom: 4 }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-40)', lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--glass-border)', textAlign: 'center', fontSize: 12, color: 'var(--ink-50)' }}>
            <strong style={{ color: 'var(--ink-80)' }}>1 token = $0.01 USD</strong> · Pagás solo por lo que usás · Margen bruto del producto: 85%
          </div>
        </div>
      </div>

    </div>
  </div>
);

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
  const [selected, setSelected] = useState(null);

  return (
    <div className="s-stage">
      <div className="s-wrap" style={{ maxWidth: 820 }}>

        <div style={{ marginBottom: 32 }}>
          <button className="btn" onClick={onBack} style={{ marginBottom: 22 }}>← Volver</button>
          <StepProgress current={1} />
          <h2 style={{ fontSize: 34, fontWeight: 200, letterSpacing: '-0.02em', marginBottom: 8 }}>
            ¿Qué querés evaluar?
          </h2>
          <p style={{ color: 'var(--ink-50)', fontSize: 14 }}>
            Elegí el escenario y la IA calibra los parámetros de análisis.
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
              Prompt de evaluación · {selected.category}
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
            <SIcon name="mic" size={13} /> Comenzar grabación
          </button>
        </div>

      </div>
    </div>
  );
};

/* ============================================================
   STEP PROGRESS — indicador visual de paso X de N
   ============================================================ */
const StepProgress = ({ current, steps = ['Escenario', 'Grabación', 'Resultados'] }) => (
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
  const [evals, setEvals]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.ApexAPI.getEvaluations(1, 6)
      .then(d => setEvals(d))
      .catch(() => setEvals({ data: [], total: 0 }))
      .finally(() => setLoading(false));
  }, []);

  const name = user?.name || user?.email?.split('@')[0] || 'Vendedor';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  const completedEvals = evals?.data?.filter(e => e.status === 'completed') || [];
  const avgScore = completedEvals.length
    ? Math.round(completedEvals.reduce((s, e) => s + (e.score?.overall ?? e.overall_score ?? 0), 0) / completedEvals.length)
    : null;

  return (
    <div className="s-stage">
      <div className="s-wrap" style={{ maxWidth: 900 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 48, paddingBottom: 36 }}>
          <div>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-40)', textTransform: 'uppercase', marginBottom: 8 }}>
              {greeting}
            </div>
            <h1 style={{ fontSize: 38, fontWeight: 200, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 6 }}>
              {name}
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--ink-50)' }}>
              {evals?.total
                ? `${evals.total} evaluación${evals.total !== 1 ? 'es' : ''} realizadas`
                : 'Todavía no realizaste evaluaciones'}
            </p>
          </div>

          <button className="btn btn-primary" onClick={onStart}
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 28px', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0, marginTop: 8 }}>
            <SIcon name="mic" size={15} stroke={1.5} />
            Nueva evaluación
          </button>
        </div>

        {/* STATS — solo si hay evaluaciones */}
        {(evals?.total > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 36 }}>
            {[
              { label: 'Evaluaciones',     value: evals.total,          unit: 'total' },
              { label: 'Score promedio',   value: avgScore ?? '—',      unit: avgScore ? '/100' : '' },
              { label: 'Completadas',      value: completedEvals.length, unit: `de ${evals.total}` },
            ].map(({ label, value, unit }) => (
              <div key={label} className="glass" style={{ padding: '20px 22px' }}>
                <div style={{ fontSize: 11, color: 'var(--ink-40)', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
                <div style={{ fontSize: 32, fontWeight: 200, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {value}
                  <span style={{ fontSize: 12, color: 'var(--ink-40)', marginLeft: 5 }}>{unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* EVALUACIONES RECIENTES o EMPTY STATE */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-40)', fontSize: 13 }}>
            Cargando historial…
          </div>
        ) : evals?.total === 0 ? (
          /* EMPTY STATE */
          <div className="glass" style={{ padding: '48px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>
              <SIcon name="mic" size={44} stroke={1} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 300, marginBottom: 10, letterSpacing: '-0.01em' }}>
              Tu primera evaluación te espera
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-50)', maxWidth: '40ch', margin: '0 auto 28px', lineHeight: 1.65 }}>
              Elegí un escenario, grabate por 60–90 segundos y la IA analiza tu lenguaje corporal, voz y discurso.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 32 }}>
              {[['body', 'Lenguaje corporal'], ['wave', 'Voz y prosodia'], ['brain', 'Score con IA']].map(([icon, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink-50)' }}>
                  <SIcon name={icon} size={15} stroke={1.3} />
                  {label}
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={onStart}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '14px 32px', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              <SIcon name="mic" size={14} /> Empezar ahora
            </button>
          </div>
        ) : (
          /* HISTORIAL */
          <div>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-40)', textTransform: 'uppercase', marginBottom: 16 }}>
              Evaluaciones recientes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 40 }}>
              {evals.data.map(ev => {
                const score = ev.score?.overall ?? ev.overall_score ?? null;
                const scenario = ev.title || 'Evaluación';
                const date = new Date(ev.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
                return (
                  <div key={ev.id} className="glass"
                    onClick={() => onViewResult && onViewResult(ev)}
                    style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
                      cursor: ev.status === 'completed' ? 'pointer' : 'default',
                      transition: 'background 140ms',
                    }}
                    onMouseEnter={e => { if(ev.status==='completed') e.currentTarget.style.background='rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background=''; }}>

                    {score !== null
                      ? <ScoreRing score={Math.round(score > 1 ? score : score * 100)} />
                      : <div style={{ width: 56, height: 56, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-30)' }}>
                          <SIcon name="progress" size={18} stroke={1.2} />
                        </div>
                    }

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scenario}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-40)' }}>{date}</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor[ev.status] || 'var(--ink-30)', display: 'inline-block' }}/>
                      <span className="mono" style={{ fontSize: 10, color: statusColor[ev.status] || 'var(--ink-40)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        {statusLabel[ev.status] || ev.status}
                      </span>
                    </div>

                    {ev.status === 'completed' && <SIcon name="arrow" size={14} stroke={1.3} style={{ color: 'var(--ink-30)', flexShrink: 0 }} />}
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
  { id: 'first',    icon: 'mic',      label: 'Primer paso',       desc: 'Completaste tu primera evaluación',  color: '#9ef5be', unlocked: c => c.length >= 1 },
  { id: 'five',     icon: 'progress', label: 'Constancia',        desc: '5 evaluaciones completadas',         color: '#9ef5be', unlocked: c => c.length >= 5,  prog: c => [Math.min(c.length,5), 5] },
  { id: 'ten',      icon: 'history',  label: 'Dedicación',        desc: '10 evaluaciones completadas',        color: '#60a5fa', unlocked: c => c.length >= 10, prog: c => [Math.min(c.length,10), 10] },
  { id: 'score70',  icon: 'wave',     label: 'Buen comunicador',  desc: 'Alcanzaste un score de 70+',         color: '#fbbf24', unlocked: c => c.some(e => e._s >= 70) },
  { id: 'score80',  icon: 'sparkle',  label: 'Gran comunicador',  desc: 'Alcanzaste un score de 80+',         color: '#f97316', unlocked: c => c.some(e => e._s >= 80) },
  { id: 'score90',  icon: 'brain',    label: 'Experto en pitch',  desc: 'Alcanzaste un score de 90+',         color: '#a78bfa', unlocked: c => c.some(e => e._s >= 90) },
  { id: 'free',     icon: 'play',     label: 'Pitch libre',       desc: 'Completaste un pitch sin guión',     color: '#9ef5be', unlocked: c => c.some(e => e._t?.toLowerCase().includes('libre')) },
  { id: 'perfect',  icon: 'check',    label: 'Puntaje perfecto',  desc: 'Score de 95 o más en una sesión',    color: '#a78bfa', unlocked: c => c.some(e => e._s >= 95) },
];

const ScoreChart = ({ data }) => {
  if (!data || data.length < 2) return (
    <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-30)', fontSize: 12 }}>
      Completá al menos 2 evaluaciones para ver el gráfico de progreso.
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
    .map(e => ({ ...e, _s: Math.round((e.score?.overall ?? e.overall_score ?? 0) > 1 ? (e.score?.overall ?? e.overall_score) : (e.score?.overall ?? e.overall_score) * 100), _t: e.title || '' }))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const chartData = completed.map(e => ({
    s: e._s,
    label: new Date(e.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
  }));

  const avgScore  = completed.length ? Math.round(completed.reduce((s,e) => s + e._s, 0) / completed.length) : null;
  const bestScore = completed.length ? Math.max(...completed.map(e => e._s)) : null;
  const lastScore = completed.length ? completed[completed.length - 1]._s : null;
  const trend     = completed.length >= 2 ? lastScore - completed[completed.length - 2]._s : null;

  return (
    <div className="s-stage">
      <div className="s-wrap" style={{ maxWidth: 900 }}>
        <div style={{ paddingTop: 48, paddingBottom: 32 }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-40)', textTransform: 'uppercase', marginBottom: 8 }}>Progreso</div>
          <h1 style={{ fontSize: 34, fontWeight: 200, letterSpacing: '-0.03em' }}>Tu evolución</h1>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-40)', fontSize: 13 }}>Cargando datos…</div>
        ) : (
          <>
            {/* STATS */}
            {completed.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'Score promedio', value: avgScore, unit: '/100' },
                  { label: 'Mejor score',    value: bestScore, unit: '/100' },
                  { label: 'Última sesión',  value: lastScore, unit: '/100' },
                  { label: 'Tendencia',      value: trend !== null ? (trend >= 0 ? `+${trend}` : trend) : '—', unit: trend !== null ? 'vs anterior' : '', color: trend > 0 ? '#9ef5be' : trend < 0 ? '#fca5a5' : 'inherit' },
                ].map(({ label, value, unit, color }) => (
                  <div key={label} className="glass" style={{ padding: '18px 20px' }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-40)', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
                    <div style={{ fontSize: 28, fontWeight: 200, letterSpacing: '-0.02em', color: color || 'inherit' }}>
                      {value ?? '—'}<span style={{ fontSize: 11, color: 'var(--ink-40)', marginLeft: 4 }}>{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CHART */}
            <div className="glass" style={{ padding: '24px 28px', marginBottom: 28 }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--ink-40)', textTransform: 'uppercase', marginBottom: 16 }}>Score por sesión</div>
              <ScoreChart data={chartData} />
            </div>

            {/* LOGROS */}
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-40)', textTransform: 'uppercase', marginBottom: 16 }}>Logros</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 40 }}>
              {BADGES_DEF.map(b => {
                const ok  = b.unlocked(completed);
                const prg = b.prog ? b.prog(completed) : null;
                return (
                  <div key={b.id} className="glass" style={{
                    padding: '18px 16px', textAlign: 'center',
                    opacity: ok ? 1 : 0.4,
                    filter: ok ? 'none' : 'grayscale(1)',
                    transition: 'opacity 300ms',
                  }}>
                    <div style={{ marginBottom: 10, color: ok ? b.color : 'var(--ink-30)' }}>
                      <SIcon name={b.icon} size={22} stroke={1.3} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{b.label}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-40)', lineHeight: 1.4, marginBottom: prg ? 10 : 0 }}>{b.desc}</div>
                    {prg && !ok && (
                      <div>
                        <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginTop: 8 }}>
                          <div style={{ height: '100%', width: `${(prg[0]/prg[1])*100}%`, background: b.color, borderRadius: 99 }} />
                        </div>
                        <div style={{ fontSize: 9.5, color: 'var(--ink-30)', marginTop: 4 }}>{prg[0]}/{prg[1]}</div>
                      </div>
                    )}
                    {ok && <div style={{ fontSize: 9.5, color: b.color, marginTop: 6, letterSpacing: '0.1em' }}>✓ Obtenido</div>}
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
  { icon: 'wave', category: 'Voz y prosodia', color: '#60a5fa', tips: [
    'Hacé pausas de 1–2 segundos antes de los puntos clave. El silencio refuerza el mensaje.',
    'Variá el tono: las preguntas retóricas suben, las afirmaciones fuertes bajan.',
    'Controlá las muletillas: contá cuántas veces usás "eh", "o sea", "básicamente" por minuto.',
  ]},
  { icon: 'body', category: 'Lenguaje corporal', color: '#9ef5be', tips: [
    'Mantené contacto visual directo cuando describís el beneficio principal.',
    'Gestos abiertos (palmas hacia arriba) generan más confianza que los brazos cruzados.',
    'La postura recta pero relajada proyecta seguridad sin tensión. Evitá encogerte.',
  ]},
  { icon: 'brain', category: 'Estructura del discurso', color: '#f9d45b', tips: [
    'Empezá con el problema del cliente, no con tu producto. El dolor primero.',
    'Una sola idea central por minuto de presentación. Más es ruido.',
    'Cerrá siempre con un llamado a la acción concreto: fecha, número, próximo paso.',
  ]},
  { icon: 'sparkle', category: 'Manejo de objeciones', color: '#f97316', tips: [
    'Ante "es caro": validá la preocupación primero, luego anclá en ROI, no en precio.',
    'Ante "no es el momento": preguntá qué tendría que pasar para que sí lo sea.',
    'Evitá el silencio incómodo: si no sabés la respuesta, pedí tiempo para investigar.',
  ]},
];

const SellerCoaching = ({ user, onGoToPlan }) => {
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
    ? Math.round(completed.reduce((s, e) => s + ((e.score?.overall ?? e.overall_score ?? 0) > 1 ? (e.score?.overall ?? e.overall_score) : (e.score?.overall ?? e.overall_score) * 100), 0) / completed.length)
    : null;

  const tip = COACHING_TIPS[active];

  return (
    <div className="s-stage">
      <div className="s-wrap" style={{ maxWidth: 900 }}>
        <div style={{ paddingTop: 48, paddingBottom: 32 }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-40)', textTransform: 'uppercase', marginBottom: 8 }}>Coaching IA</div>
          <h1 style={{ fontSize: 34, fontWeight: 200, letterSpacing: '-0.03em', marginBottom: 6 }}>Mejorá tu pitch</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-50)' }}>
            Técnicas seleccionadas para vendedores {avgScore !== null ? `con score ${avgScore}/100` : 'en formación'}.
          </p>
        </div>

        {!loading && completed.length === 0 && (
          <div className="glass" style={{ padding: '28px 32px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16,
            background: 'rgba(158,245,190,0.04)', border: '1px solid rgba(158,245,190,0.15)' }}>
            <SIcon name="sparkle" size={20} stroke={1.3} style={{ color: '#9ef5be', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3, color: '#9ef5be' }}>Coaching personalizado disponible tras tu primera evaluación</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-50)' }}>Grabate un pitch y la IA analizará tus áreas específicas de mejora.</div>
            </div>
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
              {c.category}
            </button>
          ))}
        </div>

        {/* TIPS ACTIVOS */}
        <div className="glass" style={{ padding: '28px 32px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <span style={{ color: tip.color }}><SIcon name={tip.icon} size={20} stroke={1.3} /></span>
            <div style={{ fontSize: 15, fontWeight: 400, letterSpacing: '-0.01em' }}>{tip.category}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {tip.tips.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <span style={{ fontSize: 10, color: tip.color, fontWeight: 600 }}>{i + 1}</span>
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--ink-75)', lineHeight: 1.65, margin: 0 }}>{t}</p>
              </div>
            ))}
          </div>
        </div>

        {/* UPSELL COACHING IA PERSONALIZADO */}
        <div className="glass" style={{ padding: '24px 28px', marginBottom: 40, display: 'flex', alignItems: 'center', gap: 20,
          background: 'linear-gradient(135deg, rgba(120,255,180,0.04), rgba(255,255,255,0.02))',
          border: '1px solid rgba(120,255,180,0.18)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 5 }}>Coaching IA personalizado</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-50)', lineHeight: 1.6 }}>
              Con el plan Growth, la IA analiza tus evaluaciones y genera un plan de mejora específico para vos: áreas débiles, ejercicios y metas semanales.
            </div>
          </div>
          <button className="btn btn-primary" onClick={onGoToPlan} style={{ flexShrink: 0, padding: '11px 20px', fontSize: 12, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
            Ver plan Growth
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
    id: 'starter', name: 'Starter', price: '$39', unit: 'USD / usuario / mes',
    tokens: 600, color: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)',
    features: ['~120 evaluaciones / mes', 'Análisis de voz y lenguaje corporal', 'Score con IA', 'Historial y exportación CSV'],
  },
  {
    id: 'growth', name: 'Growth', price: '$89', unit: 'USD / usuario / mes',
    tokens: 2000, color: 'rgba(120,255,180,0.05)', border: 'rgba(120,255,180,0.35)',
    badge: 'Más elegido',
    features: ['~400 evaluaciones / mes', 'Coaching IA por vendedor', 'Dashboard de equipo', 'Reportes PDF/CSV', 'GPT-4.1 premium', 'Tokens acumulables'],
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 'A medida', unit: 'desde 50+ usuarios',
    tokens: null, color: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)',
    features: ['Tokens ilimitados', 'SSO (Google, Azure, Okta)', 'Multi-tenant avanzado', 'SLA 99.9%', 'Onboarding incluido'],
  },
];

const SellerPlan = ({ user }) => {
  const currentPlan = 'starter';
  const tokensUsed  = 0;
  const tokensTotal = 600;
  const pct = tokensUsed / tokensTotal;
  const r = 30, circ = 2 * Math.PI * r;
  const [upgradeTarget, setUpgradeTarget] = useState(null);

  return (
    <div className="s-stage">
      <div className="s-wrap" style={{ maxWidth: 900 }}>

        {/* HEADER */}
        <div style={{ paddingTop: 48, paddingBottom: 32 }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-40)', textTransform: 'uppercase', marginBottom: 8 }}>Mi Plan</div>
          <h1 style={{ fontSize: 34, fontWeight: 200, letterSpacing: '-0.03em', marginBottom: 4 }}>Plan Starter</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-50)' }}>Período actual · renovación mensual</p>
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
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Tokens disponibles</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-50)', marginBottom: 10 }}>
              {tokensTotal - tokensUsed} tokens restantes · cada evaluación consume 5 tokens
            </div>
            <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(2, pct * 100)}%`, background: '#9ef5be', borderRadius: 99, transition: 'width 700ms ease' }} />
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-40)', marginBottom: 4 }}>Próxima recarga</div>
            <div style={{ fontSize: 13, color: 'var(--ink-70)' }}>En 30 días</div>
          </div>
        </div>

        {/* PLANES */}
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-40)', textTransform: 'uppercase', marginBottom: 16 }}>
          Planes disponibles
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
                    Plan actual
                  </div>
                )}
                {p.badge && !isCurrent && (
                  <div style={{ alignSelf: 'flex-end', marginBottom: 12,
                    fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600,
                    padding: '3px 10px', borderRadius: 999,
                    background: 'rgba(120,255,180,0.18)', color: '#9ef5be',
                    border: '1px solid rgba(120,255,180,0.4)' }}>
                    {p.badge}
                  </div>
                )}
                <div className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--ink-50)', textTransform: 'uppercase', marginBottom: 6, marginTop: isCurrent ? 20 : 0 }}>
                  {p.name}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <span style={{ fontSize: 32, fontWeight: 200, letterSpacing: '-0.02em' }}>{p.price}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-40)', marginLeft: 6 }}>{p.unit}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, flex: 1 }}>
                  {p.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-60)' }}>
                      <SIcon name="check" size={12} /> {f}
                    </div>
                  ))}
                </div>
                <button className={`btn${isCurrent ? '' : ' btn-primary'}`}
                  style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 12,
                    opacity: isCurrent ? 0.45 : 1, cursor: isCurrent ? 'default' : 'pointer' }}
                  disabled={isCurrent}
                  onClick={() => !isCurrent && setUpgradeTarget(p)}>
                  {isCurrent ? 'Plan actual' : p.id === 'enterprise' ? 'Contactar ventas' : 'Actualizar plan'}
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
              <span style={{ fontSize: 38, fontWeight: 200 }}>{upgradeTarget.price}</span>
              <span style={{ fontSize: 12, color: 'var(--ink-40)', marginLeft: 6 }}>{upgradeTarget.unit}</span>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-50)', marginBottom: 24, lineHeight: 1.65 }}>
              {upgradeTarget.id === 'enterprise'
                ? 'Contactá a nuestro equipo para armar un plan a medida para tu organización.'
                : `Estás a punto de actualizar al plan ${upgradeTarget.name}. Un representante de Apex Vision se va a comunicar con vos para completar el proceso.`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {upgradeTarget.features.slice(0, 4).map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--ink-60)', textAlign: 'left' }}>
                  <SIcon name="check" size={13} /> {f}
                </div>
              ))}
            </div>
            <a href={`mailto:ventas@apexvision.ai?subject=Upgrade%20a%20plan%20${upgradeTarget.name}&body=Hola%2C%20quiero%20actualizar%20mi%20plan%20a%20${upgradeTarget.name}.%20Mi%20cuenta%3A%20${encodeURIComponent(user?.email || '')}`}
              className="btn btn-primary"
              style={{ display: 'block', width: '100%', textAlign: 'center', padding: '13px', fontSize: 13, letterSpacing: '0.08em', textDecoration: 'none', marginBottom: 10, boxSizing: 'border-box' }}>
              {upgradeTarget.id === 'enterprise' ? 'Contactar ventas' : 'Solicitar upgrade'}
            </a>
            <button onClick={() => setUpgradeTarget(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ink-40)', padding: '6px 0' }}>
              Cancelar
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
    if (pwNew.length < 6) { setPwError('La nueva contraseña debe tener al menos 6 caracteres.'); return; }
    if (pwNew !== pwConfirm) { setPwError('Las contraseñas no coinciden.'); return; }
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

        <div style={{ paddingTop: 48, paddingBottom: 32 }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-40)', textTransform: 'uppercase', marginBottom: 8 }}>Configuración</div>
          <h1 style={{ fontSize: 34, fontWeight: 200, letterSpacing: '-0.03em' }}>Tu perfil</h1>
        </div>

        {/* DATOS PERSONALES */}
        <div className="glass" style={{ padding: '28px 32px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 22, color: 'var(--ink-80)' }}>Datos personales</div>
          <form onSubmit={handleSaveName} style={{ display: 'grid', gap: 16 }}>
            <Field label="Email">
              <input value={user?.email || ''} readOnly
                style={{ ...inputStyle, opacity: 0.45, cursor: 'not-allowed' }} />
              <div style={{ fontSize: 11, color: 'var(--ink-30)', marginTop: 5 }}>El email no se puede modificar.</div>
            </Field>
            <Field label="Nombre para mostrar">
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Tu nombre" style={inputStyle} />
            </Field>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '11px 24px', fontSize: 12.5 }}>
                Guardar cambios
              </button>
              {saved && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ef5be' }}>
                  <SIcon name="check" size={13} stroke={2} /> Guardado
                </span>
              )}
            </div>
          </form>
        </div>

        {/* CAMBIAR CONTRASEÑA */}
        <div className="glass" style={{ padding: '28px 32px', marginBottom: 40 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 22, color: 'var(--ink-80)' }}>Cambiar contraseña</div>
          <form onSubmit={handleChangePassword} style={{ display: 'grid', gap: 14 }}>
            <Field label="Contraseña actual">
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={pwCurrent} onChange={e => setPwCurrent(e.target.value)}
                  placeholder="Tu contraseña actual" required style={{ ...inputStyle, padding: '11px 42px 11px 14px' }} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-40)', padding: 4, display: 'flex', alignItems: 'center' }}>
                  <SIcon name={showPw ? 'eye-off' : 'eye'} size={15} stroke={1.5} />
                </button>
              </div>
            </Field>
            <Field label="Nueva contraseña">
              <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)}
                placeholder="Mínimo 6 caracteres" required style={inputStyle} />
            </Field>
            <Field label="Confirmá la nueva contraseña">
              <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
                placeholder="Repetí la contraseña" required style={inputStyle} />
            </Field>
            {pwError && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 7, background: 'rgba(252,165,165,0.08)', border: '1px solid rgba(252,165,165,0.2)' }}>
                <span style={{ color: '#fca5a5', fontSize: 13, marginTop: 1 }}>!</span>
                <span className="mono" style={{ fontSize: 11, color: '#fca5a5', lineHeight: 1.55 }}>{pwError}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button type="submit" className="btn" style={{ padding: '11px 24px', fontSize: 12.5 }}>
                Actualizar contraseña
              </button>
              {pwSaved && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ef5be' }}>
                  <SIcon name="check" size={13} stroke={2} /> Contraseña actualizada
                </span>
              )}
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};

/* backward-compat para admin-app.jsx */
const HOME_QUESTION = SCENARIOS[0];

Object.assign(window, {
  SIcon, ApexLogo, PublicTopBar, PublicLanding, ScenarioSelector, StepProgress,
  SellerDashboard, SellerProgress, SellerCoaching, SellerPlan, SellerSettings,
  HOME_QUESTION, SCENARIOS, FEATURES,
  SellerTopBar: PublicTopBar,
  SellerHome: PublicLanding,
});
