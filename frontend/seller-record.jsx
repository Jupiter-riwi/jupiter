const { useState, useEffect, useRef } = React;
const { SIcon, AVFeed } = window;

/* ============================================================
   RECORDING FLOW — gate → record → preview → processing
   ============================================================ */
const RecordingStage = ({ question, onClose, onComplete }) => {
  const [phase, setPhase] = useState('gate'); // gate | record | preview | processing
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState(false);
  const cv = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (phase === 'record' || phase === 'preview') {
      if (cv.current) AVFeed(cv.current, { seed: 7, tracks: 1 });
    }
  }, [phase]);

  useEffect(() => {
    if (recording) {
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [recording]);

  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const start = () => { setRecording(true); setSeconds(0); };
  const stop = () => { setRecording(false); setPhase('preview'); };
  const upload = () => { setPhase('processing'); setTimeout(() => onComplete(), 7600); };

  return (
    <div className="rec-stage">
      <div className="glass glass-strong rec-frame">
        <div className="rec-head">
          <div className="step">
            {phase === 'gate' && '01 · Permisos'}
            {phase === 'record' && '02 · Grabación'}
            {phase === 'preview' && '03 · Revisar'}
            {phase === 'processing' && '04 · Análisis'}
          </div>
          <div className="logo" style={{flex:1,justifyContent:'center'}}>
            <div className="brand" style={{fontSize:11}}>Apex<small>VISION</small></div>
          </div>
          <div className="close" onClick={onClose}><SIcon name="close" size={14}/></div>
        </div>

        {phase === 'gate' && (
          <div className="gate">
            <div>
              <div className="device-pulse"><SIcon name="mic" size={36} stroke={1.2}/></div>
              <h2>Necesitamos tu cámara y micrófono</h2>
              <p>Apex analiza tu lenguaje corporal, tu voz y lo que decís. Nada se sube hasta que vos confirmás. Permitís acceso una sola vez por sesión.</p>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <button className="btn" onClick={onClose}>Ahora no</button>
                <button className="btn btn-primary" onClick={() => setPhase('record')}>
                  <SIcon name="check" size={13}/> Permitir y continuar
                </button>
              </div>
              <div className="mono" style={{marginTop:32,fontSize:10,color:'var(--ink-30)',letterSpacing:'0.2em',textTransform:'uppercase'}}>
                CIFRADO E2E · TU VIDEO ES PRIVADO · SOLO VOS LO VES
              </div>
            </div>
          </div>
        )}

        {(phase === 'record' || phase === 'preview') && (
          <>
            <div className="rec-video">
              <canvas ref={cv}/>
              {phase === 'record' && (
                <>
                  <div className="rec-badge"><span className={`dot ${recording?'live':''}`}/>{recording?'REC':'LISTO'}</div>
                  <div className="rec-time">{fmt(seconds)} / 01:30</div>
                </>
              )}
              {phase === 'preview' && (
                <>
                  <div className="rec-badge">PREVIEW · {fmt(seconds)}</div>
                </>
              )}
              <div className="question-overlay">
                <div className="mono" style={{fontSize:10,color:'rgba(255,255,255,0.55)',letterSpacing:'0.2em',textTransform:'uppercase',marginBottom:8}}>
                  Pregunta {question.category}
                </div>
                <div className="q-text">{question.prompt}</div>
              </div>
            </div>

            <div className="rec-controls">
              <div className="rec-meters">
                <div className="meter">
                  Voz
                  <div className="bars">
                    {[10,14,8,18,12,16,10,14,9].map((h,i)=>(
                      <span key={i} style={{height:`${recording? Math.min(18, h + Math.sin(seconds+i)*4 + 4):4}px`}}/>
                    ))}
                  </div>
                </div>
                <div className="meter">
                  Pose
                  <div className="bars">
                    {[12,9,14,16,10,12,8,15,11].map((h,i)=>(
                      <span key={i} style={{height:`${recording? Math.min(18, h + Math.cos(seconds+i)*3 + 3):4}px`}}/>
                    ))}
                  </div>
                </div>
              </div>

              {phase === 'record' ? (
                <button className={`rec-btn ${recording?'recording':''}`} onClick={recording?stop:start}>
                  <div className="inner"/>
                </button>
              ) : (
                <div style={{display:'flex',gap:10}}>
                  <button className="btn" onClick={() => { setPhase('record'); setSeconds(0); }}>
                    <SIcon name="redo" size={13}/> Regrabar
                  </button>
                  <button className="btn btn-primary" onClick={upload} style={{padding:'12px 22px'}}>
                    <SIcon name="check" size={13}/> Enviar para análisis
                  </button>
                </div>
              )}

              <div className="mono" style={{fontSize:10,color:'var(--ink-50)',letterSpacing:'0.16em',textTransform:'uppercase',textAlign:'right',width:120}}>
                {phase === 'record' ? 'LOCAL · 1080p' : 'LISTO PARA\nANÁLISIS'}
              </div>
            </div>
          </>
        )}

        {phase === 'processing' && <ProcessingStage onComplete={onComplete}/>}
      </div>
    </div>
  );
};

const ProcessingStage = ({ onComplete }) => {
  const [pct, setPct] = useState(8);
  const [steps, setSteps] = useState({ pose: 'active', whisper: 'idle', prosody: 'idle', scoring: 'idle' });
  const cir = 2 * Math.PI * 60;

  useEffect(() => {
    const t = setInterval(() => setPct(p => Math.min(p + 1.4, 100)), 90);
    const t1 = setTimeout(() => setSteps(s => ({...s, pose:'done', whisper:'active'})), 1800);
    const t2 = setTimeout(() => setSteps(s => ({...s, whisper:'done', prosody:'active'})), 3600);
    const t3 = setTimeout(() => setSteps(s => ({...s, prosody:'done', scoring:'active'})), 5200);
    const t4 = setTimeout(() => setSteps(s => ({...s, scoring:'done'})), 7000);
    return () => { clearInterval(t); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  return (
    <div className="processing">
      <div>
        <div className="ring">
          <svg viewBox="0 0 140 140">
            <circle cx="70" cy="70" r="60" stroke="rgba(255,255,255,0.06)" strokeWidth="2" fill="none"/>
            <circle cx="70" cy="70" r="60" stroke="rgba(255,255,255,0.85)" strokeWidth="2" fill="none"
                    strokeDasharray={cir} strokeDashoffset={cir - (pct/100)*cir} strokeLinecap="round"
                    style={{transition:'stroke-dashoffset 200ms linear'}}/>
          </svg>
          <div className="label">{Math.round(pct)} %</div>
        </div>
        <h2 style={{fontSize:22,fontWeight:300,letterSpacing:'-0.005em',marginBottom:8}}>Analizando tu evaluación</h2>
        <p style={{color:'var(--ink-70)',maxWidth:'46ch',margin:'0 auto',lineHeight:1.55}}>
          Estamos procesando tu lenguaje corporal, transcribiendo tu voz y midiendo tu prosodia. Tarda unos 30 segundos.
        </p>
        <div className="proc-steps">
          {[
            ['pose','Pose'],
            ['whisper','Transcripción'],
            ['prosody','Prosodia'],
            ['scoring','Score IA'],
          ].map(([k,l]) => (
            <div key={k} className={`proc-step ${steps[k]}`}>
              <div className="dot-lg">
                {steps[k]==='done' ? <SIcon name="check" size={16}/> :
                 steps[k]==='active' ? <span style={{width:6,height:6,borderRadius:99,background:'#fff'}}/> :
                 <span style={{width:5,height:5,borderRadius:99,background:'rgba(255,255,255,0.2)'}}/>}
              </div>
              {l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { RecordingStage, ProcessingStage });
