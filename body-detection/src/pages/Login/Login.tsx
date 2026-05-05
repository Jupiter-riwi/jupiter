import React, { useEffect } from 'react';
import './Login.css';
import LoginForm from './LoginForm';

const Login: React.FC = () => {
  useEffect(() => {
    // Si la imagen original usa un base64 muy grande, 
    // se recomienda moverla a la carpeta 'public' o 'assets' e importarla.
    // document.getElementById('foxLayer').style.backgroundImage = "url('assets/fox.png')";

    // Aquí iría el código de los canvas (bgCanvas y starCanvas) si se necesita animación de partículas.
  }, []);

  return (
    <div className="login-wrapper">
      {/* Fox full-bleed background */}
      <div className="fox-layer" id="foxLayer"></div>

      {/* Edge darkening vignette */}
      <div className="vignette"></div>

      {/* Stars (only visible in dark space area) */}
      <canvas id="starCanvas"></canvas>

      {/* Ambient particle canvas */}
      <canvas id="bgCanvas"></canvas>

      {/* Floating holographic panels */}
      <div className="holo-wrap">
        <div className="scan-line"></div>

        <div 
          className="holo-panel" 
          style={{ top: '12%', left: '3%', '--dur': '6s', '--rot': '-1.5deg', '--delay': '1.3s' } as React.CSSProperties}
        >
          <div className="holo-title">◈ pitch.analyze()</div>
          <div>clarity &nbsp;&nbsp;: <span className="ok">94.2%</span></div>
          <div>pace &nbsp;&nbsp;&nbsp;&nbsp;: <span className="ok">optimal</span></div>
          <div>impact &nbsp;&nbsp;: <span className="ok">HIGH ✓</span></div>
          <div>filler &nbsp;&nbsp;: <span className="warn">2 words</span></div>
        </div>

        <div 
          className="holo-panel" 
          style={{ top: '42%', left: '2%', '--dur': '7.5s', '--rot': '1deg', '--delay': '1.7s' } as React.CSSProperties}
        >
          <div className="holo-title">◈ voice.metrics</div>
          <div>tone &nbsp;&nbsp;&nbsp;&nbsp;: confident</div>
          <div>volume &nbsp;: <span className="ok">stable</span></div>
          <div>score &nbsp;&nbsp;: <span className="ok">9.1/10</span></div>
        </div>
      </div>

      {/* Brand (top-left) */}
      <div className="brand-corner">
        <div className="brand-dot"></div>
        <span className="brand-name">Jupiter</span>
        <div className="brand-sep"></div>
        <span className="brand-sub">Speech AI</span>
      </div>

      {/* Tagline (left, above stats) */}
      <div className="tagline-block">
        <div className="tagline-sep"></div>
        <h1>Tu evaluador <em>objetivo</em> de oratoria.</h1>
        <p>Transforma tu pitch con datos precisos, no con percepciones subjetivas.</p>
      </div>

      {/* Stats (bottom-left) */}
      <div className="stats-strip">
        <div className="stat-item">
          <div className="stat-num">97%</div>
          <div className="stat-label">Precisión</div>
        </div>
        <div className="stat-item">
          <div className="stat-num">12k+</div>
          <div className="stat-label">Pitches evaluados</div>
        </div>
        <div className="stat-item">
          <div className="stat-num">4.9★</div>
          <div className="stat-label">Valoración</div>
        </div>
      </div>

      {/* Decorative glyphs */}
      <div className="glyph" style={{ bottom: '48px', right: 'calc(6vw + 405px)' }}>
        <svg width="16" height="16" viewBox="0 0 20 20" strokeWidth="1.5">
          <path d="M10 2v16M2 10h16M4.93 4.93l10.14 10.14M15.07 4.93L4.93 15.07"/>
        </svg>
      </div>

      {/* ══ LOGIN CARD ══ */}
      <div className="scene">
        <LoginForm />
      </div>
    </div>
  );
};

export default Login;
