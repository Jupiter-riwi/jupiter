const { useState, useEffect, useRef, useCallback } = React;
const { SIcon } = window;
const t = (k, l) => window.I18N.t(k, l);

/* ============================================================
   LIVE ROOM — agente conversacional en tiempo real (ES/EN)
   Dos productos: presentación de ventas · entrevista laboral
   Loop: mic → WS → STT(Groq) → LLM(DeepSeek) → TTS(ElevenLabs)
   UI: orbe estilo Gemini Live (gradiente fluido reactivo al audio)
   ============================================================ */

const ROLE_DEF = {
  presentacion: [
    { id: 'cliente',           es: ['Cliente', 'Precio, ROI, por qué cambiar'],       en: ['Customer', 'Price, ROI, why switch'] },
    { id: 'director',          es: ['Director', 'C-level: negocio, impaciente'],       en: ['Director', 'C-level: business, impatient'] },
    { id: 'administrador',     es: ['Administrador', 'Proceso, integración, soporte'], en: ['Administrator', 'Process, integration, support'] },
    { id: 'comprador_tecnico', es: ['Comprador técnico', 'Arquitectura, seguridad'],  en: ['Technical buyer', 'Architecture, security'] },
    { id: 'usuario_final',     es: ['Usuario final', 'Facilidad de uso, día a día'],   en: ['End user', 'Ease of use, daily workflow'] },
    { id: 'inversor',          es: ['Inversor', 'Mercado, métricas, moat'],            en: ['Investor', 'Market, metrics, moat'] },
  ],
  entrevista: [
    { id: 'reclutador',      es: ['Reclutador/a RRHH', 'Motivación, fit, screening'], en: ['HR recruiter', 'Motivation, fit, screening'] },
    { id: 'hiring_manager',  es: ['Hiring Manager', 'Competencias del rol (STAR)'],   en: ['Hiring Manager', 'Role competencies (STAR)'] },
    { id: 'lider_tecnico',   es: ['Líder técnico', 'Profundidad técnica'],            en: ['Tech lead', 'Technical depth'] },
    { id: 'panel_ejecutivo', es: ['Panel ejecutivo', 'Estrategia, liderazgo'],        en: ['Executive panel', 'Strategy, leadership'] },
  ],
};
const LEVEL_IDS = ['accesible', 'neutral', 'exigente'];

const PALETTE = {
  connecting: ['#6b7280', '#9ca3af', '#4b5563'],
  listening:  ['#34d399', '#22d3ee', '#3b82f6'],
  thinking:   ['#fbbf24', '#f59e0b', '#f472b6'],
  speaking:   ['#60a5fa', '#818cf8', '#c084fc'],
};

function encodeWav(float32, sampleRate) {
  const n = float32.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buf);
  const ws = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); view.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE');
  ws(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ws(36, 'data'); view.setUint32(40, n * 2, true);
  let off = 44;
  for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, float32[i])); view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2; }
  return buf;
}
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const el = document.createElement('script');
    el.src = src; el.onload = () => resolve(); el.onerror = () => reject(new Error('load failed'));
    document.head.appendChild(el);
  });
}

/* ════════ Gemini-style audio-reactive orb ════════ */
function GeminiOrb({ state, amplitudeRef }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const tRef = useRef(0);
  const ampSmoothRef = useRef(0);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const SIZE = 260; canvas.width = SIZE * dpr; canvas.height = SIZE * dpr; ctx.scale(dpr, dpr);
    const cx = SIZE / 2, cy = SIZE / 2;
    const draw = () => {
      tRef.current += 0.016; const tt = tRef.current;
      const target = amplitudeRef.current || 0;
      ampSmoothRef.current += (target - ampSmoothRef.current) * 0.18;
      const amp = ampSmoothRef.current;
      const idle = (Math.sin(tt * 1.1) * 0.5 + 0.5) * 0.12;
      const energy = Math.max(idle, amp);
      const cols = PALETTE[state] || PALETTE.connecting;
      ctx.clearRect(0, 0, SIZE, SIZE); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const phase = tt * 0.8 - i * 0.9; const ring = ((phase % 3) / 3);
        const r = 50 + ring * (70 + energy * 90); const a = (1 - ring) * (0.10 + energy * 0.22);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = cols[i % cols.length] + Math.round(a * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = 2 + energy * 3; ctx.stroke();
      }
      const baseR = 46 + energy * 42;
      const lobes = [
        { ang: tt * 0.7, dist: 10 + energy * 16, col: cols[0] },
        { ang: tt * -0.9 + 2.1, dist: 12 + energy * 18, col: cols[1] },
        { ang: tt * 1.3 + 4.2, dist: 8 + energy * 14, col: cols[2] },
      ];
      for (const lo of lobes) {
        const lx = cx + Math.cos(lo.ang) * lo.dist, ly = cy + Math.sin(lo.ang) * lo.dist;
        const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, baseR);
        g.addColorStop(0, lo.col + 'cc'); g.addColorStop(0.5, lo.col + '55'); g.addColorStop(1, lo.col + '00');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, baseR, 0, Math.PI * 2); ctx.fill();
      }
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26 + energy * 16);
      core.addColorStop(0, '#ffffffEE'); core.addColorStop(0.4, cols[1] + 'aa'); core.addColorStop(1, cols[2] + '00');
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, 26 + energy * 16, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state, amplitudeRef]);
  return <canvas ref={canvasRef} style={{ width: 260, height: 260, display: 'block' }} />;
}

/* ════════ Live Room ════════ */
window.LiveRoom = function LiveRoom({ onClose, initialMode, initialScore, initialVideoEval }) {
  const lang = window.useLang();
  const [phase, setPhase] = useState(initialScore !== undefined ? 'results' : 'setup');
  const [mode, setMode] = useState(initialMode || 'presentacion');
  const [role, setRole] = useState((ROLE_DEF[initialMode || 'presentacion'][0]).id);
  const [level, setLevel] = useState('neutral');
  const [scenario, setScenario] = useState('');

  const [state, setState] = useState('connecting');
  const [turns, setTurns] = useState([]);
  const [partial, setPartial] = useState('');
  const [inputMode, setInputMode] = useState('vad');
  const [holding, setHolding] = useState(false);
  const [err, setErr] = useState('');
  const [scoring, setScoring] = useState(false);
  const [score, setScore] = useState(initialScore);   // undefined=none yet, null=too short, obj=result
  const [videoEval, setVideoEval] = useState(initialVideoEval); // undefined=n/a · 'processing' · result obj · 'failed' · 'skipped'

  const wsRef = useRef(null);
  const videoSelfRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const capCtxRef = useRef(null);
  const playCtxRef = useRef(null);
  const playAnalyserRef = useRef(null);
  const micAnalyserRef = useRef(null);
  const nextStartRef = useRef(0);
  const activeSrcRef = useRef([]);
  const decodeQueueRef = useRef([]);
  const decodingRef = useRef(false);
  const streamRef = useRef(null);
  const vadRef = useRef(null);
  const procRef = useRef(null);
  const capturingRef = useRef(false);
  const capBufRef = useRef([]);
  const stateRef = useRef('connecting');
  const finishingRef = useRef(false);
  const playGenRef = useRef(0);
  const amplitudeRef = useRef(0);
  const ampRafRef = useRef(0);
  const transcriptEndRef = useRef(null);

  const setStateBoth = (s) => { stateRef.current = s; setState(s); };

  useEffect(() => {
    const tick = () => {
      const an = stateRef.current === 'speaking' ? playAnalyserRef.current
               : stateRef.current === 'listening' ? micAnalyserRef.current : null;
      if (an) {
        const buf = new Uint8Array(an.frequencyBinCount); an.getByteTimeDomainData(buf);
        let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        amplitudeRef.current = Math.min(1, Math.sqrt(sum / buf.length) * 3.2);
      } else amplitudeRef.current *= 0.9;
      ampRafRef.current = requestAnimationFrame(tick);
    };
    ampRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ampRafRef.current);
  }, []);

  const stopPlayback = useCallback(() => {
    playGenRef.current++;            // invalidate any in-flight decode
    decodeQueueRef.current = [];
    for (const s of activeSrcRef.current) { try { s.stop(); } catch (_) {} }
    activeSrcRef.current = []; nextStartRef.current = 0;
  }, []);
  const pumpDecode = useCallback(async () => {
    if (decodingRef.current) return; const ctx = playCtxRef.current; if (!ctx) return;
    decodingRef.current = true;
    while (decodeQueueRef.current.length) {
      const gen = playGenRef.current;
      const bytes = decodeQueueRef.current.shift();
      let audioBuf; try { audioBuf = await ctx.decodeAudioData(bytes.slice(0)); } catch (_) { continue; }
      if (finishingRef.current || playGenRef.current !== gen) continue;  // dropped after finish/barge-in
      const src = ctx.createBufferSource(); src.buffer = audioBuf; src.connect(playAnalyserRef.current);
      const start = Math.max(ctx.currentTime, nextStartRef.current); src.start(start);
      nextStartRef.current = start + audioBuf.duration; activeSrcRef.current.push(src);
      src.onended = () => { activeSrcRef.current = activeSrcRef.current.filter(s => s !== src); };
    }
    decodingRef.current = false;
  }, []);
  const enqueueAudio = useCallback((b) => { if (finishingRef.current) return; decodeQueueRef.current.push(b); pumpDecode(); }, [pumpDecode]);
  const sendUtterance = useCallback((f) => {
    const ws = wsRef.current;
    if (finishingRef.current) return;   // drop any late VAD turn after "finish"
    if (!ws || ws.readyState !== WebSocket.OPEN || !f) return;
    // gate: ignore too-short clips and near-silence (breaths/noise) so Whisper
    // never hallucinates a fake "Gracias" from non-speech.
    if (f.length < 4800) return;        // < ~0.3s @ 16kHz
    let sum = 0; for (let i = 0; i < f.length; i++) sum += f[i] * f[i];
    const rms = Math.sqrt(sum / f.length);
    if (rms < 0.012) return;            // near-silent → drop
    ws.send(encodeWav(f, 16000));
  }, []);
  const bargeIn = useCallback(() => {
    if (stateRef.current === 'speaking') {
      stopPlayback();
      const ws = wsRef.current; if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'barge_in' }));
    }
  }, [stopPlayback]);

  const onWsMessage = useCallback((ev) => {
    if (ev.data instanceof ArrayBuffer) { enqueueAudio(ev.data); return; }
    if (ev.data instanceof Blob) { ev.data.arrayBuffer().then(enqueueAudio); return; }
    let d; try { d = JSON.parse(ev.data); } catch (_) { return; }
    if (d.type === 'ready') setStateBoth('listening');
    else if (d.type === 'state') setStateBoth(d.value);
    else if (d.type === 'user_transcript') setTurns(x => [...x, { role: 'user', text: d.text }]);
    else if (d.type === 'agent_text') {
      if (d.done) { setPartial(''); if (d.text) setTurns(x => [...x, { role: 'agent', text: d.text }]); }
      else setPartial(p => p + (d.delta || ''));
    } else if (d.type === 'scoring') { setScoring(true); }
    else if (d.type === 'session_score') { setScoring(false); setScore(d.data || null); setPhase('results'); stopPlayback(); }
    else if (d.type === 'error') setErr(t('live.err.agent'));
  }, [enqueueAudio, stopPlayback]);

  const startLive = useCallback(async () => {
    setErr(''); setTurns([]); setPartial(''); setStateBoth('connecting');
    finishingRef.current = false; capturingRef.current = false;
    const url = window.ApexAPI.liveWsUrl({ mode, role, level, lang, scenario: scenario.trim() || undefined });
    const ws = new WebSocket(url); ws.binaryType = 'arraybuffer'; wsRef.current = ws;
    ws.onmessage = onWsMessage; ws.onerror = () => setErr(t('live.err.connect'));

    const PCtx = window.AudioContext || window.webkitAudioContext;
    const playCtx = new PCtx(); playCtxRef.current = playCtx;
    const pAn = playCtx.createAnalyser(); pAn.fftSize = 512; pAn.connect(playCtx.destination); playAnalyserRef.current = pAn;

    // Request camera + mic. The camera feed is recorded for post-session body-language
    // analysis (pose/prosody/whisper); the audio track drives the live conversation.
    let stream; let hasVideo = true;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }); }
    catch (_) {
      // fall back to audio-only (no body-language analysis)
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }); hasVideo = false; }
      catch (__) { setErr(t('live.err.mic')); return; }
    }
    streamRef.current = stream;

    if (hasVideo) {
      setVideoEval(undefined);
      if (videoSelfRef.current) { try { videoSelfRef.current.srcObject = stream; videoSelfRef.current.play().catch(() => {}); } catch (_) {} }
      // record the whole session (video+audio) for the evaluation pipeline
      try {
        const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
          .find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || 'video/webm';
        recordedChunksRef.current = [];
        const rec = new MediaRecorder(stream, { mimeType: mime });
        rec.ondataavailable = (e) => { if (e.data && e.data.size) recordedChunksRef.current.push(e.data); };
        rec.start(1000);
        mediaRecorderRef.current = rec;
      } catch (_) { mediaRecorderRef.current = null; }
    } else {
      setVideoEval('skipped');
    }

    let capCtx; try { capCtx = new PCtx({ sampleRate: 16000 }); } catch (_) { capCtx = new PCtx(); }
    capCtxRef.current = capCtx;
    const micSrc = capCtx.createMediaStreamSource(stream);
    const mAn = capCtx.createAnalyser(); mAn.fftSize = 512; micSrc.connect(mAn); micAnalyserRef.current = mAn;

    let vadOk = false;
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/ort.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.7/dist/bundle.min.js');
      if (window.vad && window.vad.MicVAD) {
        const myvad = await window.vad.MicVAD.new({
          stream,
          onSpeechStart: () => { bargeIn(); setStateBoth('listening'); },
          onSpeechEnd: (audio) => sendUtterance(audio),
        });
        myvad.start(); vadRef.current = myvad; vadOk = true; setInputMode('vad');
      }
    } catch (_) {}
    if (!vadOk) {
      setInputMode('ptt');
      const proc = capCtx.createScriptProcessor(4096, 1, 1);
      proc.onaudioprocess = (e) => { if (capturingRef.current) capBufRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
      micSrc.connect(proc);
      const sink = capCtx.createGain(); sink.gain.value = 0; proc.connect(sink); sink.connect(capCtx.destination);
      procRef.current = proc;
    }
  }, [mode, role, level, lang, scenario, onWsMessage, sendUtterance, bargeIn]);

  const pttStart = useCallback(() => { if (inputMode !== 'ptt') return; bargeIn(); capBufRef.current = []; capturingRef.current = true; setHolding(true); setStateBoth('listening'); }, [inputMode, bargeIn]);
  const pttStop = useCallback(() => {
    if (inputMode !== 'ptt' || !capturingRef.current) return;
    capturingRef.current = false; setHolding(false);
    const chunks = capBufRef.current; capBufRef.current = [];
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const merged = new Float32Array(total); let off = 0; for (const c of chunks) { merged.set(c, off); off += c.length; }
    sendUtterance(merged);
  }, [inputMode, sendUtterance]);

  // Stop recording and return the recorded video blob (or null).
  const stopRecording = useCallback(() => new Promise((resolve) => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state === 'inactive') { resolve(null); return; }
    let done = false;
    const finishUp = () => {
      if (done) return; done = true;
      const chunks = recordedChunksRef.current; recordedChunksRef.current = [];
      resolve(chunks.length ? new Blob(chunks, { type: rec.mimeType || 'video/webm' }) : null);
    };
    rec.onstop = finishUp;
    setTimeout(finishUp, 4000);   // safety: never hang if onstop doesn't fire
    try { rec.stop(); } catch (_) { finishUp(); }
    mediaRecorderRef.current = null;
  }), []);

  // Run the recorded video through the existing pipeline (pose/prosody/whisper/scoring)
  // to get the body-language + voice dimensions, then surface them in the results card.
  const processVideo = useCallback(async () => {
    if (!mediaRecorderRef.current) { setVideoEval('skipped'); return; }  // no camera → audio-only
    setVideoEval('processing');   // show the spinner immediately
    const blob = await stopRecording();
    // conversation is over — release camera + mic (turns the camera light off)
    try { streamRef.current && streamRef.current.getTracks().forEach(t => t.stop()); } catch (_) {}
    if (!blob || blob.size < 10000) { setVideoEval('failed'); return; }
    try {
      const roleMeta = (ROLE_DEF[mode] || ROLE_DEF.presentacion).find(r => r.id === role);
      const roleLbl = roleMeta ? (roleMeta[lang] || roleMeta.es)[0] : '';
      const prefix = mode === 'entrevista' ? (lang === 'en' ? 'Live interview' : 'Entrevista en vivo') : (lang === 'en' ? 'Live pitch' : 'Pitch en vivo');
      // embed the difficulty so the batch scorer can grade harder for tougher personas
      const title = `${prefix} · ${roleLbl} · nivel:${level}${scenario.trim() ? ' · ' + scenario.trim().slice(0, 40) : ''}`;
      const created = await window.ApexAPI.createEvaluation(title);
      const evalId = created.evaluation.id;
      await window.ApexAPI.uploadVideo(evalId, blob);
      await window.ApexAPI.completeEvaluation(evalId);
      const startedAt = Date.now();
      const poll = setInterval(async () => {
        try {
          const data = await window.ApexAPI.getEvaluation(evalId);
          if (data.status === 'completed') { clearInterval(poll); setVideoEval(data); }
          else if (data.status === 'failed') { clearInterval(poll); setVideoEval('failed'); }
          else if (Date.now() - startedAt > 180000) { clearInterval(poll); setVideoEval('failed'); }
        } catch (_) {}
      }, 3000);
    } catch (_) { setVideoEval('failed'); }
  }, [mode, role, lang, scenario, stopRecording]);

  const endSession = useCallback(() => {
    stopPlayback();
    try { mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive' && mediaRecorderRef.current.stop(); } catch (_) {}
    mediaRecorderRef.current = null;
    try { wsRef.current && wsRef.current.readyState === WebSocket.OPEN && wsRef.current.send(JSON.stringify({ type: 'end' })); } catch (_) {}
    try { wsRef.current && wsRef.current.close(); } catch (_) {}
    try { vadRef.current && vadRef.current.pause(); } catch (_) {}
    try { procRef.current && procRef.current.disconnect(); } catch (_) {}
    try { streamRef.current && streamRef.current.getTracks().forEach(x => x.stop()); } catch (_) {}
    try { capCtxRef.current && capCtxRef.current.close(); } catch (_) {}
    try { playCtxRef.current && playCtxRef.current.close(); } catch (_) {}
    wsRef.current = vadRef.current = procRef.current = streamRef.current = capCtxRef.current = playCtxRef.current = null;
  }, [stopPlayback]);

  useEffect(() => () => endSession(), [endSession]);
  useEffect(() => { if (transcriptEndRef.current) transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [turns, partial]);

  const roleList = ROLE_DEF[mode] || ROLE_DEF.presentacion;
  const enterLive = () => { setPhase('live'); setTimeout(() => startLive(), 50); };
  const leave = () => { endSession(); onClose && onClose(); };
  // Stop listening to the mic immediately (VAD + PTT capture) so no more turns are sent.
  const stopListening = useCallback(() => {
    finishingRef.current = true;
    capturingRef.current = false;
    try { vadRef.current && vadRef.current.pause(); } catch (_) {}
    vadRef.current = null;
    try { procRef.current && (procRef.current.onaudioprocess = null, procRef.current.disconnect()); } catch (_) {}
    procRef.current = null;
    try { micAnalyserRef.current && micAnalyserRef.current.disconnect(); } catch (_) {}
  }, []);

  const finishAndScore = useCallback(() => {
    const ws = wsRef.current;
    stopListening();                       // stop the mic the moment you click finish
    stopPlayback();                        // clear the agent audio queue
    try { playCtxRef.current && playCtxRef.current.suspend(); } catch (_) {}  // hard-silence anything scheduled
    if (!ws || ws.readyState !== WebSocket.OPEN) { leave(); return; }
    setStateBoth('thinking'); setScoring(true);
    ws.send(JSON.stringify({ type: 'finish' }));
    processVideo();   // upload recorded video → pose/prosody/whisper in parallel
  }, [stopPlayback, processVideo, stopListening]);
  const restart = () => { setScore(undefined); setScoring(false); setVideoEval(undefined); setTurns([]); setPartial(''); setPhase('setup'); endSession(); };
  const switchMode = (m) => { setMode(m); setRole((ROLE_DEF[m] || ROLE_DEF.presentacion)[0].id); };
  const isInt = mode === 'entrevista';
  const STATE_LABEL = { connecting: t('live.state.connecting'), listening: t('live.state.listening'), thinking: t('live.state.thinking'), speaking: t('live.state.speaking') };

  /* ════ SETUP ════ */
  if (phase === 'setup') {
    const accent = '#818cf8';
    const card = (active) => ({
      padding: '15px', borderRadius: 12, cursor: 'pointer',
      background: active ? `${accent}1a` : 'rgba(255,255,255,0.03)',
      border: active ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.08)', transition: 'all 150ms',
    });
    const modeMeta = (id) => id === 'presentacion' ? [t('mode.sales'), t('mode.salesDesc'), 'sparkle'] : [t('mode.interview'), t('mode.interviewDesc'), 'user'];
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(8,8,11,0.97)', backdropFilter: 'blur(14px)', overflowY: 'auto' }}>
        <div className="s-wrap" style={{ maxWidth: 760, margin: '0 auto', padding: '36px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <button className="btn" onClick={leave}>{t('live.back')}</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <LangToggle />
              <span className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--ink-40)', textTransform: 'uppercase' }}>{t('live.beta')}</span>
            </div>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 200, letterSpacing: '-0.02em', marginBottom: 6 }}>{isInt ? t('live.title.interview') : t('live.title.sales')}</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-50)', lineHeight: 1.6, marginBottom: 26 }}>{isInt ? t('live.subtitle.interview') : t('live.subtitle.sales')}</p>

          <Section label={t('live.section.mode')} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
            {['presentacion', 'entrevista'].map(id => { const [lbl, desc, ic] = modeMeta(id); return (
              <div key={id} style={card(mode === id)} onClick={() => switchMode(id)}>
                <SIcon name={ic} size={18} stroke={1.5} />
                <div style={{ fontSize: 14.5, fontWeight: 400, marginTop: 8, marginBottom: 3 }}>{lbl}</div>
                <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink-40)', lineHeight: 1.4 }}>{desc}</div>
              </div>); })}
          </div>

          <Section label={isInt ? t('live.section.roleInterview') : t('live.section.roleSales')} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 24 }}>
            {roleList.map(r => { const [lbl, desc] = r[lang] || r.es; return (
              <div key={r.id} style={card(role === r.id)} onClick={() => setRole(r.id)}>
                <div style={{ fontSize: 13.5, fontWeight: 400, marginBottom: 3 }}>{lbl}</div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--ink-40)', lineHeight: 1.4 }}>{desc}</div>
              </div>); })}
          </div>

          <Section label={t('live.section.level')} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 24 }}>
            {LEVEL_IDS.map(id => (
              <div key={id} style={card(level === id)} onClick={() => setLevel(id)}>
                <div style={{ fontSize: 13.5, fontWeight: 400, marginBottom: 3 }}>{t('level.' + id)}</div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--ink-40)', lineHeight: 1.4 }}>{t('level.' + id + 'Desc')}</div>
              </div>
            ))}
          </div>

          <Section label={t('live.section.lang')} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
            {[['es', 'Español'], ['en', 'English']].map(([id, lbl]) => (
              <div key={id} style={card(lang === id)} onClick={() => window.I18N.set(id)}>
                <div style={{ fontSize: 13.5, fontWeight: 400 }}>{lbl}</div>
              </div>
            ))}
          </div>

          <Section label={isInt ? t('live.section.scenarioInterview') : t('live.section.scenarioSales')} />
          <textarea value={scenario} onChange={e => setScenario(e.target.value)} rows={2}
            placeholder={isInt ? t('live.scenarioPh.interview') : t('live.scenarioPh.sales')}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', marginBottom: 26 }} />

          <button className="btn btn-primary" onClick={enterLive} style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 13, gap: 8 }}>
            <SIcon name="sparkle" size={15} /> {t('live.start')}
          </button>
        </div>
      </div>
    );
  }

  /* ════ RESULTS ════ */
  if (phase === 'results') {
    const sc = score;
    const ov = sc && typeof sc.overall === 'number' ? Math.round(sc.overall) : null;
    const ovColor = ov == null ? '#9ca3af' : ov >= 75 ? '#34d399' : ov >= 55 ? '#fbbf24' : '#fca5a5';
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(8,8,11,0.98)', backdropFilter: 'blur(16px)', overflowY: 'auto' }}>
        <div className="s-wrap" style={{ maxWidth: 680, margin: '0 auto', padding: '36px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
            <h1 style={{ fontSize: 24, fontWeight: 200, letterSpacing: '-0.02em' }}>{t('live.results.title')}</h1>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-45)' }}>{modeLbl} · {roleLbl}</span>
          </div>

          {!sc ? (
            <div className="mono" style={{ fontSize: 12.5, color: 'var(--ink-50)', lineHeight: 1.6, padding: '20px 0' }}>{t('live.results.none')}</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
                <div style={{ width: 96, height: 96, borderRadius: '50%', border: `3px solid ${ovColor}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 30px ${ovColor}33` }}>
                  <div style={{ fontSize: 30, fontWeight: 200, color: ovColor, lineHeight: 1 }}>{ov != null ? ov : '—'}</div>
                  <div className="mono" style={{ fontSize: 8, color: 'var(--ink-40)', marginTop: 2 }}>/100</div>
                </div>
                <div>
                  <div className="mono" style={{ fontSize: 9, letterSpacing: '0.16em', color: 'var(--ink-30)', textTransform: 'uppercase', marginBottom: 4 }}>{t('live.results.overall')}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--ink-70)', lineHeight: 1.5 }}>{sc.summary || ''}</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {(sc.dimensions || []).map((dim, i) => {
                  const s = Math.round(dim.score || 0);
                  const c = s >= 75 ? '#34d399' : s >= 55 ? '#fbbf24' : '#fca5a5';
                  return (
                    <div key={i} style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: 'var(--ink-80)' }}>{dim.label}</span>
                        <span style={{ fontSize: 14, fontWeight: 300, color: c }}>{s}</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginBottom: 7 }}>
                        <div style={{ width: `${s}%`, height: '100%', borderRadius: 2, background: c }} />
                      </div>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-45)', lineHeight: 1.5 }}>{dim.comment}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 26 }}>
                <div>
                  <div className="mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: '#34d399', textTransform: 'uppercase', marginBottom: 8 }}>{t('live.results.strengths')}</div>
                  {(sc.strengths || []).map((x, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--ink-65)', lineHeight: 1.5, marginBottom: 6, paddingLeft: 12, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, color: '#34d399' }}>+</span>{x}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: '#fbbf24', textTransform: 'uppercase', marginBottom: 8 }}>{t('live.results.improvements')}</div>
                  {(sc.improvements || []).map((x, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--ink-65)', lineHeight: 1.5, marginBottom: 6, paddingLeft: 12, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, color: '#fbbf24' }}>→</span>{x}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── lenguaje corporal y voz (del video, vía pipeline pose/prosody/whisper) ── */}
          <div style={{ marginTop: 6, marginBottom: 22 }}>
            <div className="mono" style={{ fontSize: 9, letterSpacing: '0.16em', color: 'var(--ink-30)', textTransform: 'uppercase', marginBottom: 10 }}>
              {t('live.results.body')}
            </div>
            {videoEval === 'processing' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ width: 14, height: 14, border: '2px solid rgba(129,140,248,0.3)', borderTopColor: '#818cf8', borderRadius: '50%', display: 'inline-block', animation: 'liveSpin 0.7s linear infinite' }} />
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-55)' }}>{t('live.results.bodyProcessing')}</span>
              </div>
            )}
            {(videoEval === 'skipped' || videoEval === undefined) && (
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-40)', padding: '10px 0' }}>{t('live.results.bodySkipped')}</div>
            )}
            {videoEval === 'failed' && (
              <div className="mono" style={{ fontSize: 11, color: '#fca5a5', padding: '10px 0' }}>{t('live.results.bodyFailed')}</div>
            )}
            {videoEval && typeof videoEval === 'object' && (() => {
              const dims = (videoEval.features && videoEval.features.dimensions) || {};
              const entries = Object.entries(dims);
              const DIM_LBL = { confianza:['Confianza','Confidence'], claridad:['Claridad','Clarity'], ritmo_voz:['Ritmo de voz','Voice pace'], escucha_activa:['Escucha activa','Active listening'], lenguaje_corporal:['Lenguaje corporal','Body language'] };
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {entries.map(([k, v]) => {
                    const sv = Math.round((v && (v.score ?? v)) || 0);
                    const c = sv >= 75 ? '#34d399' : sv >= 55 ? '#fbbf24' : '#fca5a5';
                    const pair = DIM_LBL[k];
                    const label = pair ? (lang === 'en' ? pair[1] : pair[0]) : k;
                    return (
                      <div key={k} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 12.5, color: 'var(--ink-80)' }}>{label}</span>
                          <span style={{ fontSize: 13.5, fontWeight: 300, color: c }}>{sv}</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                          <div style={{ width: `${sv}%`, height: '100%', borderRadius: 2, background: c }} />
                        </div>
                        {v && v.evidence && <div className="mono" style={{ fontSize: 10, color: 'var(--ink-45)', lineHeight: 1.5, marginTop: 6 }}>{v.evidence}</div>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={restart} style={{ flex: 1, justifyContent: 'center', padding: '12px' }}>
              <SIcon name="redo" size={13} /> {t('live.results.again')}
            </button>
            <button className="btn btn-primary" onClick={leave} style={{ flex: 1, justifyContent: 'center', padding: '12px' }}>{t('live.results.close')}</button>
          </div>
          <style>{`@keyframes liveSpin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  /* ════ SCORING (entre live y results) ════ */
  if (scoring) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'radial-gradient(circle at 50% 40%, rgba(30,27,55,0.6), rgba(8,8,11,0.98))', backdropFilter: 'blur(16px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
        <GeminiOrb state="thinking" amplitudeRef={amplitudeRef} />
        <div className="mono" style={{ fontSize: 12.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#fbbf24' }}>{t('live.scoring')}</div>
      </div>
    );
  }

  /* ════ LIVE ════ */
  const accent = (PALETTE[state] || PALETTE.connecting)[2];
  const curRole = roleList.find(r => r.id === role); const roleLbl = curRole ? (curRole[lang] || curRole.es)[0] : '';
  const modeLbl = isInt ? t('mode.interview') : t('mode.sales');
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'radial-gradient(circle at 50% 30%, rgba(30,27,55,0.6), rgba(8,8,11,0.98))', backdropFilter: 'blur(16px)', display: 'flex', flexDirection: 'column' }}>
      {/* self-view: confirma que la cámara graba para el análisis de lenguaje corporal */}
      <div style={{ position: 'absolute', left: 18, bottom: 18, width: 150, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', display: videoEval === 'skipped' ? 'none' : 'block', zIndex: 5 }}>
        <video ref={videoSelfRef} autoPlay muted playsInline style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block', transform: 'scaleX(-1)', background: '#000' }} />
        <div style={{ position: 'absolute', top: 7, left: 8, display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#fff', background: 'rgba(0,0,0,0.45)', padding: '2px 7px', borderRadius: 999 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'liveRecBlink 1.2s infinite' }} />
          <span className="mono" style={{ letterSpacing: '0.1em' }}>{t('live.rec')}</span>
        </div>
      </div>
      <style>{`@keyframes liveRecBlink { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-55)', letterSpacing: '0.08em' }}>
          {modeLbl} · {roleLbl} · {t('level.' + level)} · {lang.toUpperCase()}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={finishAndScore} disabled={scoring} style={{ fontSize: 11.5, padding: '6px 14px', opacity: scoring ? 0.6 : 1 }}>
            <SIcon name="check" size={13} /> {t('live.finish')}
          </button>
          <button className="btn" onClick={leave} style={{ fontSize: 11.5, padding: '6px 12px' }}>
            <SIcon name="close" size={13} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 14 }}>
        <GeminiOrb state={state} amplitudeRef={amplitudeRef} />
        <div className="mono" style={{ marginTop: 6, fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: accent }}>{STATE_LABEL[state]}</div>
        {err && <div className="mono" style={{ marginTop: 8, fontSize: 11, color: '#fca5a5' }}>{err}</div>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 24px 8px', maxWidth: 720, width: '100%', margin: '0 auto' }}>
        {turns.length === 0 && !partial && (
          <div className="mono" style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-30)', marginTop: 8 }}>{t('live.hint')}</div>
        )}
        {turns.map((x, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: x.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
            <div style={{
              maxWidth: '78%', padding: '10px 14px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.5,
              background: x.role === 'user' ? 'rgba(129,140,248,0.16)' : 'rgba(255,255,255,0.05)',
              border: x.role === 'user' ? '1px solid rgba(129,140,248,0.3)' : '1px solid rgba(255,255,255,0.08)',
              color: x.role === 'user' ? '#e0e7ff' : 'var(--ink-80)',
            }}>{x.text}</div>
          </div>
        ))}
        {partial && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
            <div style={{ maxWidth: '78%', padding: '10px 14px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.5, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--ink-60)' }}>
              {partial}<span style={{ opacity: 0.5 }}>▌</span>
            </div>
          </div>
        )}
        <div ref={transcriptEndRef} />
      </div>

      <div style={{ padding: '14px 24px 26px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
        {inputMode === 'ptt' ? (
          <>
            <button onMouseDown={pttStart} onMouseUp={pttStop} onMouseLeave={pttStop}
              onTouchStart={(e) => { e.preventDefault(); pttStart(); }} onTouchEnd={(e) => { e.preventDefault(); pttStop(); }}
              style={{ width: 68, height: 68, borderRadius: '50%', cursor: 'pointer', border: `2px solid ${holding ? accent : 'rgba(255,255,255,0.2)'}`, background: holding ? `${accent}2a` : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 120ms', transform: holding ? 'scale(1.08)' : 'scale(1)' }}>
              <SIcon name="mic" size={24} stroke={1.5} />
            </button>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-40)', letterSpacing: '0.1em' }}>{holding ? t('live.ptt.talking') : t('live.ptt.hold')}</span>
          </>
        ) : (
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-45)', letterSpacing: '0.08em' }}>
            <SIcon name="mic" size={12} /> {t('live.handsfree')}
          </span>
        )}
      </div>
    </div>
  );
};

/* small helpers */
function Section({ label }) {
  return <div className="mono" style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--ink-30)', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>;
}
window.LangToggle = function LangToggle() {
  const lang = window.useLang();
  return (
    <button onClick={() => window.I18N.toggle()} title="ES / EN"
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', color: 'var(--ink-70)', cursor: 'pointer', fontSize: 11, letterSpacing: '0.06em' }}>
      <SIcon name="wave" size={12} /> {lang.toUpperCase()} · {window.I18N.t('lang.toggle')}
    </button>
  );
};
