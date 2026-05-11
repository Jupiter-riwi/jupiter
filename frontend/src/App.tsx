import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  completeEvaluation,
  createEvaluation,
  getEvaluation,
  getMe,
  getQuestions,
  listEvaluations,
  login,
  tokenStore,
  type Evaluation,
  type Question
} from './services/api';
import './App.css';

type Stage = 'login' | 'workspace';

function App() {
  const [stage, setStage] = useState<Stage>(tokenStore.accessToken ? 'workspace' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [userName, setUserName] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [title, setTitle] = useState('Evaluacion de practica');
  const [file, setFile] = useState<File | null>(null);
  const [activeEvalId, setActiveEvalId] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const activeEvaluation = useMemo(
    () => evaluations.find((item) => item.id === activeEvalId),
    [evaluations, activeEvalId]
  );

  useEffect(() => {
    if (stage !== 'workspace') {
      return;
    }

    void bootstrapWorkspace();
  }, [stage]);

  useEffect(() => {
    if (!activeEvalId) {
      return;
    }

    const timer = setInterval(() => {
      void refreshEvaluation(activeEvalId);
    }, 3000);

    return () => clearInterval(timer);
  }, [activeEvalId]);

  async function bootstrapWorkspace() {
    try {
      const [me, qs, evals] = await Promise.all([getMe(), getQuestions(), listEvaluations()]);
      setUserName(me.email || 'usuario');
      setQuestions(qs);
      setEvaluations(evals);
    } catch {
      tokenStore.clear();
      setStage('login');
      setLoginError('Sesion invalida. Inicia sesion de nuevo.');
    }
  }

  async function refreshEvaluation(id: string) {
    const latest = await getEvaluation(id);
    setEvaluations((current) => {
      const exists = current.some((item) => item.id === id);
      if (!exists) {
        return [latest, ...current];
      }
      return current.map((item) => (item.id === id ? latest : item));
    });

    if (latest.status === 'completed') {
      setStatusMessage('Evaluacion completada. Score listo en dashboard.');
    }
    if (latest.status === 'failed') {
      setStatusMessage('La evaluacion fallo durante el procesamiento.');
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoginError('');
    setBusy(true);
    try {
      await login(email, password);
      setStage('workspace');
    } catch {
      setLoginError('Credenciales invalidas o backend no disponible.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateAndUpload(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setStatusMessage('Selecciona un archivo de video antes de continuar.');
      return;
    }

    setBusy(true);
    setStatusMessage('Creando evaluacion...');

    try {
      const created = await createEvaluation(title);
      setActiveEvalId(created.evaluation.id);
      setEvaluations((current) => [created.evaluation, ...current]);

      setStatusMessage('Subiendo video al storage...');
      const uploadResponse = await fetch(created.upload_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'video/mp4'
        }
      });

      if (!uploadResponse.ok) {
        throw new Error('upload-failed');
      }

      setStatusMessage('Disparando procesamiento AI...');
      const updated = await completeEvaluation(created.evaluation.id);
      setEvaluations((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setStatusMessage('Procesando. Actualizando estado cada 3s...');
    } catch {
      setStatusMessage('No se pudo completar el flujo create/upload/complete.');
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    tokenStore.clear();
    setEvaluations([]);
    setQuestions([]);
    setActiveEvalId('');
    setStage('login');
  }

  if (stage === 'login') {
    return (
      <main className="shell">
        <section className="card auth-card">
          <h1>Apex Vision</h1>
          <p>Login para integrar frontend con API Gateway</p>
          <form onSubmit={handleLogin} className="form-stack">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              required
            />
            <button type="submit" disabled={busy}>
              {busy ? 'Ingresando...' : 'Ingresar'}
            </button>
            {loginError && <small className="error">{loginError}</small>}
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h2>Workspace de Integracion Frontend</h2>
          <p>Usuario: {userName}</p>
        </div>
        <button onClick={handleLogout}>Salir</button>
      </header>

      <section className="grid">
        <article className="card">
          <h3>Crear evaluacion</h3>
          <form onSubmit={handleCreateAndUpload} className="form-stack">
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
            <button type="submit" disabled={busy}>
              {busy ? 'Ejecutando...' : 'Crear + Subir + Procesar'}
            </button>
            {statusMessage && <small>{statusMessage}</small>}
          </form>
        </article>

        <article className="card">
          <h3>Pregunta de practica</h3>
          {questions.length === 0 ? (
            <p>Sin preguntas cargadas para este tenant.</p>
          ) : (
            <ul>
              {questions.slice(0, 3).map((q) => (
                <li key={q.id}>
                  <strong>{q.category}</strong>: {q.text}
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="card">
        <h3>Evaluaciones</h3>
        {evaluations.length === 0 ? (
          <p>No hay evaluaciones todavia.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Titulo</th>
                <th>Estado</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((item) => (
                <tr key={item.id} className={item.id === activeEvalId ? 'active-row' : ''}>
                  <td>{item.id.slice(0, 8)}</td>
                  <td>{item.title}</td>
                  <td>{item.status}</td>
                  <td>{typeof item.score === 'number' ? item.score.toFixed(3) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {activeEvaluation?.features && (
        <section className="card">
          <h3>Features de evaluacion activa</h3>
          <pre>{JSON.stringify(activeEvaluation.features, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}

export default App;
