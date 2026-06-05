const { useState, useEffect, useRef } = React;
const { SIcon } = window;

/* ============================================================
   RECORDING FLOW — Real camera → MinIO upload → backend workers
   ============================================================ */
const RecordingStage = ({ question, onClose, onComplete }) => {
  window.useLang(); const L = window.L;
  const [phase, setPhase] = useState('gate'); // gate | record | preview | processing
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const previewRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);
  const recordedBlobRef = useRef(null);
  const [evalId, setEvalId] = useState('');
  const [streamVersion, setStreamVersion] = useState(0);

  // ── polling progress ──────────────────────────────────────────────────────
  const [procPct, setProcPct] = useState(8);
  const [procSteps, setProcSteps] = useState({ pose: 'idle', whisper: 'idle', prosody: 'idle', scoring: 'idle' });
  const pollRef = useRef(null);
  const startedAtRef = useRef(null);

  const buildFailureMessage = (evalData) => {
    const failure = evalData?.features || {};
    const code = (failure.error_code || '').toUpperCase();
    const reason = failure.error_message || failure.error || '';
    const reasonText = String(reason || '').toLowerCase();

    const isInsufficientFunds =
      code === 'GROQ_RATE_LIMIT' ||
      reasonText.includes('insufficient_quota') ||
      reasonText.includes('billing_hard_limit_reached') ||
      reasonText.includes('insufficient quota') ||
      reasonText.includes('saldo') ||
      reasonText.includes('credito');

    if (isInsufficientFunds) {
      return L('Límite de tasa en la API de Groq. Esperá unos segundos y volvé a intentar.', 'Rate limit on the Groq API. Wait a few seconds and try again.');
    }

    if (reason) {
      return `${L('La evaluación falló durante el procesamiento', 'The evaluation failed during processing')}: ${reason}`;
    }

    return L('La evaluación falló durante el procesamiento. Intentá de nuevo.', 'The evaluation failed during processing. Try again.');
  };

  useEffect(() => {
    return () => {
      stopTracks();
      clearInterval(intervalRef.current);
      clearInterval(pollRef.current);
    };
  }, []);

  // ── attach stream to video element whenever we enter record phase ─────
  useEffect(() => {
    if ((phase === 'record' || phase === 'preview') && streamRef.current) {
      requestAnimationFrame(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play().catch(() => {});
        }
      });
    }
  }, [phase, streamVersion]);

  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  // ── gate: request camera ──────────────────────────────────────────────────
  const requestCamera = async () => {
    setError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Tu navegador no soporta acceso a camara. Usa Chrome, Edge o Firefox actualizado.');
        return;
      }
      if (!window.isSecureContext) {
        setError('La camara requiere HTTPS o localhost. Accede via http://localhost:5173');
        return;
      }
      let s;
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: true });
      } catch (firstError) {
        console.warn('getUserMedia with ideal constraints failed, trying fallback:', firstError);
        s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }
      streamRef.current = s;
      setStreamVersion(v => v + 1);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
      setPhase('record');
    } catch (e) {
      const name = e.name || '';
      const msg = e.message || '';
      const detail = name ? (name + ': ' + msg) : String(e);
      console.error('getUserMedia error:', e);
      if (name === 'NotAllowedError') {
        setError(L('Permiso de cámara denegado. Ve a configuración del navegador > Privacidad > Cámara y permite localhost:5173.', 'Camera permission denied. Go to browser settings > Privacy > Camera and allow localhost:5173.'));
      } else if (name === 'NotFoundError') {
        setError(L('No se detectó cámara o micrófono. Conectá un dispositivo y recargá.', 'No camera or microphone detected. Connect a device and reload.'));
      } else if (name === 'NotReadableError') {
        setError(L('La cámara no responde. Verificá: 1) Configuración de Windows > Privacidad > Cámara (activada), 2) Ninguna otra app la use, 3) Reiniciá el navegador. Detalle: ', 'The camera is not responding. Check: 1) Windows Settings > Privacy > Camera (enabled), 2) No other app is using it, 3) Restart the browser. Detail: ') + detail);
      } else if (name === 'OverconstrainedError') {
        setError(L('La cámara no soporta los parámetros solicitados. Intentá con otra cámara.', 'The camera does not support the requested parameters. Try another camera.'));
      } else {
        setError(L('Error de cámara: ', 'Camera error: ') + detail);
      }
    }
  };

  // ── record ────────────────────────────────────────────────────────────────
  const startRec = () => {
    chunksRef.current = [];
    const rec = new MediaRecorder(streamRef.current, { mimeType: 'video/webm;codecs=vp9,opus' });
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      recordedBlobRef.current = blob;
      if (previewRef.current) {
        previewRef.current.src = URL.createObjectURL(blob);
      }
    };
    recorderRef.current = rec;
    rec.start(500);
    setRecording(true);
    setSeconds(0);
    intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  };

  const stopRec = () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    clearInterval(intervalRef.current);
    setRecording(false);
    stopTracks();
    setPhase('preview');
  };

  // ── upload & complete ─────────────────────────────────────────────────────
  const doUpload = async () => {
    setPhase('processing');
    setProcPct(5);
    setProcSteps({ pose: 'idle', whisper: 'idle', prosody: 'idle', scoring: 'idle' });

    try {
      // 1) Create evaluation
      const title = question?.prompt?.slice(0, 80) || question?.title || L('Evaluación de práctica', 'Practice evaluation');
      setProcSteps(s => ({ ...s, pose: 'active' }));
      const created = await window.ApexAPI.createEvaluation(title);
      setEvalId(created.evaluation.id);
      setProcPct(15);
      setProcSteps({ pose: 'done', whisper: 'active' });

      // 2) Upload video via gateway
      await window.ApexAPI.uploadVideo(created.evaluation.id, recordedBlobRef.current);
      setProcPct(35);
      setProcSteps({ pose: 'done', whisper: 'done', prosody: 'active' });

      // 3) Complete => triggers workers
      await window.ApexAPI.completeEvaluation(created.evaluation.id);
      setProcPct(50);
      setProcSteps({ pose: 'done', whisper: 'done', prosody: 'done', scoring: 'active' });

      // 4) Poll until done
      startedAtRef.current = Date.now();
      pollRef.current = setInterval(async () => {
        try {
          const evalData = await window.ApexAPI.getEvaluation(created.evaluation.id);
          setProcPct(p => Math.min(p + 3, 95));

          const elapsedMs = Date.now() - (startedAtRef.current || Date.now());
          if (elapsedMs > 180000) {
            clearInterval(pollRef.current);
            setError(L('La evaluación está tardando demasiado. Reintentá en unos segundos. Si se repite, revisá los logs del worker de pose.', 'The evaluation is taking too long. Retry in a few seconds. If it persists, check the pose worker logs.'));
            return;
          }

          if (evalData.status === 'completed') {
            clearInterval(pollRef.current);
            setProcPct(100);
            setProcSteps({ pose: 'done', whisper: 'done', prosody: 'done', scoring: 'done' });
            setTimeout(() => onComplete(evalData), 800);
          } else if (evalData.status === 'failed') {
            clearInterval(pollRef.current);
            setProcSteps({ pose: 'done', whisper: 'done', prosody: 'done', scoring: 'done' });
            setError(buildFailureMessage(evalData));
          }
        } catch {
          // keep polling
        }
      }, 3000);
    } catch (e) {
      console.error(e);
      const message = String(e?.message || 'Error inesperado');
      if (message.includes('401')) {
        setError(L('Tu sesión expiró. Iniciá sesión de nuevo y reintentá la evaluación.', 'Your session expired. Sign in again and retry the evaluation.'));
      } else {
        setError(L('Error en el flujo create/upload/complete: ', 'Error in the create/upload/complete flow: ') + message);
      }
      setPhase('gate');
    }
  };

  const cir = 2 * Math.PI * 60;

  return (
    <div className="rec-stage">
      <div className="glass glass-strong rec-frame">
        <div className="rec-head">
          <div className="step">
            {phase === 'gate' && L('01 · Permisos', '01 · Permissions')}
            {phase === 'record' && L('02 · Grabación', '02 · Recording')}
            {phase === 'preview' && L('03 · Revisar', '03 · Review')}
            {phase === 'processing' && L('04 · Análisis IA', '04 · AI analysis')}
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
              <h2>{L('Necesitamos tu cámara y micrófono', 'We need your camera and microphone')}</h2>
              <p>{L('Apex analiza tu lenguaje corporal, tu voz y lo que decís. El video se sube a tu cuenta y se procesa con IA.', 'Apex analyzes your body language, your voice and what you say. The video is uploaded to your account and processed with AI.')}</p>
              {error && <p style={{color:'#fca5a5',fontSize:12}}>{error}</p>}
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <button className="btn" onClick={onClose}>{L('Ahora no', 'Not now')}</button>
                <button className="btn btn-primary" onClick={requestCamera}>
                  <SIcon name="check" size={13}/> {L('Permitir y continuar', 'Allow and continue')}
                </button>
              </div>
              <div className="mono" style={{marginTop:32,fontSize:10,color:'var(--ink-30)',letterSpacing:'0.2em',textTransform:'uppercase'}}>
                {L('CONEXIÓN API GATEWAY · TU VIDEO ES PRIVADO', 'API GATEWAY CONNECTION · YOUR VIDEO IS PRIVATE')}
              </div>
            </div>
          </div>
        )}

        {/* record phase: live camera */}
        {phase === 'record' && (
          <>
            <div className="rec-video">
              <video ref={videoRef} autoPlay muted playsInline style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:10}} />
              <div className="rec-badge"><span className={`dot ${recording?'live':''}`}/>{recording?'REC':L('LISTO','READY')}</div>
              <div className="rec-time">{fmt(seconds)}</div>
              <div className="question-overlay">
                <div className="mono" style={{fontSize:10,color:'rgba(255,255,255,0.55)',letterSpacing:'0.2em',textTransform:'uppercase',marginBottom:8}}>
                  {L('Pregunta', 'Question')} {question?.category || 'Pitch'}
                </div>
                <div className="q-text">{question?.prompt || question?.title}</div>
              </div>
            </div>
            <div className="rec-controls">
              <div className="rec-meters">
                <div className="meter">{L('Voz','Voice')} <div className="bars">{Array(9).fill(0).map((_,i)=>(<span key={i} style={{height:recording?Math.min(18,10+Math.sin(seconds+i)*4+4):4}}/>))}</div></div>
                <div className="meter">Pose <div className="bars">{Array(9).fill(0).map((_,i)=>(<span key={i} style={{height:recording?Math.min(18,10+Math.cos(seconds+i)*3+3):4}}/>))}</div></div>
              </div>
              <button className={`rec-btn ${recording?'recording':''}`} onClick={recording?stopRec:startRec}>
                <div className="inner"/>
              </button>
              <div className="mono" style={{fontSize:10,color:'var(--ink-50)',letterSpacing:'0.16em',textTransform:'uppercase',textAlign:'right',width:120}}>
                {recording ? 'LOCAL · HD' : L('LISTO PARA\nGRABAR', 'READY TO\nRECORD')}
              </div>
            </div>
          </>
        )}

        {/* preview phase: recorded video */}
        {phase === 'preview' && (
          <>
            <div className="rec-video">
              <video ref={previewRef} controls style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:10}} />
              <div className="rec-badge">PREVIEW · {fmt(seconds)}</div>
            </div>
            <div className="rec-controls">
              <div/>
              <div style={{display:'flex',gap:10}}>
                <button className="btn" onClick={requestCamera}>
                  <SIcon name="redo" size={13}/> {L('Regrabar', 'Re-record')}
                </button>
                <button className="btn btn-primary" onClick={doUpload} style={{padding:'12px 22px'}}>
                  <SIcon name="check" size={13}/> {L('Enviar para análisis', 'Send for analysis')}
                </button>
              </div>
              <div className="mono" style={{fontSize:10,color:'var(--ink-50)',letterSpacing:'0.16em',textTransform:'uppercase',textAlign:'right',width:120}}>
                {L('LISTO PARA\nANÁLISIS IA', 'READY FOR\nAI ANALYSIS')}
              </div>
            </div>
          </>
        )}

        {/* processing phase */}
        {phase === 'processing' && (
          <div className="processing">
            <div>
              <div className="ring">
                <svg viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="60" stroke="rgba(255,255,255,0.06)" strokeWidth="2" fill="none"/>
                  <circle cx="70" cy="70" r="60" stroke="rgba(255,255,255,0.85)" strokeWidth="2" fill="none"
                          strokeDasharray={cir} strokeDashoffset={cir - (procPct/100)*cir} strokeLinecap="round"
                          style={{transition:'stroke-dashoffset 300ms linear'}}/>
                </svg>
                <div className="label">{Math.round(procPct)} %</div>
              </div>
              <h2 style={{fontSize:22,fontWeight:300,letterSpacing:'-0.005em',marginBottom:8}}>{L('Analizando con IA', 'Analyzing with AI')}</h2>
              <p style={{color:'var(--ink-70)',maxWidth:'46ch',margin:'0 auto',lineHeight:1.55}}>
                {L('Procesando lenguaje corporal, transcribiendo audio y evaluando tu pitch.', 'Processing body language, transcribing audio and evaluating your pitch.')}
              </p>
              {evalId && <div className="mono" style={{fontSize:9,color:'var(--ink-30)',marginTop:12}}>ID: {evalId}</div>}
              {error && <p style={{color:'#fca5a5',marginTop:12,fontSize:12}}>{error}</p>}
              {error && (
                <div style={{marginTop:10}}>
                  <button className="btn" onClick={() => setPhase('gate')}>{L('Volver a intentar', 'Try again')}</button>
                </div>
              )}
              <div className="proc-steps">
                {[
                  ['pose','Pose'],
                  ['whisper',L('Transcripción', 'Transcription')],
                  ['prosody',L('Prosodia', 'Prosody')],
                  ['scoring',L('Score IA', 'AI score')],
                ].map(([k,l]) => (
                  <div key={k} className={`proc-step ${procSteps[k]}`}>
                    <div className="dot-lg">
                      {procSteps[k]==='done' ? <SIcon name="check" size={16}/> :
                       procSteps[k]==='active' ? <span style={{width:6,height:6,borderRadius:99,background:'#fff',animation:'pulse 1s infinite'}}/> :
                       <span style={{width:5,height:5,borderRadius:99,background:'rgba(255,255,255,0.2)'}}/>}
                    </div>
                    {l}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

window.RecordingStage = RecordingStage;
