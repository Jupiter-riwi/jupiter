const { useState } = React;
// pull cross-file components from window (set by each JSX file via Object.assign)
const { PublicTopBar, PublicLanding, ScenarioSelector, RecordingStage, SellerResults } = window;

/* ============================================================
   APEX VISION — app pública
   Flujo: landing → selector de escenario → grabación → resultados
   ============================================================ */
function ApexApp() {
  const [page, setPage]           = useState('landing');   // landing | scenario | results
  const [scenario, setScenario]   = useState(null);
  const [recording, setRecording] = useState(false);

  const goLanding  = () => { setPage('landing');  setScenario(null); };
  const goScenario = () =>   setPage('scenario');

  const handleSelectScenario = (s) => {
    setScenario(s);
    setRecording(true);
  };

  const handleCloseRec  = () => setRecording(false);
  const handleFinishRec = () => { setRecording(false); setPage('results'); };

  return (
    <div id="app">
      <div className="s-shell">
        <PublicTopBar onHome={goLanding} />

        {page === 'landing'   && <PublicLanding  onStart={goScenario} />}
        {page === 'scenario'  && <ScenarioSelector onSelect={handleSelectScenario} onBack={goLanding} />}
        {page === 'results'   && <SellerResults scenario={scenario} onBack={goLanding} onPractice={goScenario} />}
      </div>

      {recording && scenario && (
        <RecordingStage
          question={scenario}
          onClose={handleCloseRec}
          onComplete={handleFinishRec}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ApexApp />);
