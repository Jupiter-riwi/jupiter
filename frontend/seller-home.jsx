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
          <div key={f.title} className="glass" style={{ padding: '26px 22px', textAlign: 'center' }}>
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
            padding: '32px 28px', display: 'flex', flexDirection: 'column',
            border: '1px solid rgba(120,255,180,0.35)',
            background: 'linear-gradient(180deg, rgba(120,255,180,0.06), rgba(255,255,255,0.02))',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: -10, right: 18,
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
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink-50)', textTransform: 'uppercase', marginBottom: 8 }}>
            Paso 1 de 3
          </div>
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
              className="glass"
              onClick={() => setSelected(s)}
              style={{
                padding: '18px 20px',
                cursor: 'pointer',
                border: selected?.id === s.id ? '1px solid rgba(255,255,255,0.38)' : '1px solid var(--glass-border)',
                background: selected?.id === s.id ? 'rgba(255,255,255,0.08)' : undefined,
                transition: 'border 140ms, background 140ms',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{s.title}</div>
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
          className="glass"
          onClick={() => setSelected(SCENARIOS[4])}
          style={{
            padding: '18px 20px',
            cursor: 'pointer',
            marginBottom: 24,
            border: selected?.id === 'free' ? '1px solid rgba(255,255,255,0.38)' : '1px solid var(--glass-border)',
            background: selected?.id === 'free' ? 'rgba(255,255,255,0.08)' : undefined,
            transition: 'border 140ms, background 140ms',
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
            className={`btn${selected ? ' btn-primary' : ''}`}
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

/* backward-compat para admin-app.jsx */
const HOME_QUESTION = SCENARIOS[0];

Object.assign(window, {
  SIcon, ApexLogo, PublicTopBar, PublicLanding, ScenarioSelector,
  HOME_QUESTION, SCENARIOS, FEATURES,
  SellerTopBar: PublicTopBar,
  SellerHome: PublicLanding,
});
