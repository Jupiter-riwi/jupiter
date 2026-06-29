const { useState } = React;
const { SIcon, ApexLogo, ApexAPI } = window;

const AuthScreen = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await ApexAPI.login(email, password);
        onLoginSuccess();
      } else {
        await ApexAPI.register(email, password, name, 'admin'); // Assuming admin role for this dashboard
        // After register, switch to login
        setIsLogin(true);
        setError('Registro exitoso. Por favor, inicia sesión.');
        setPassword('');
      }
    } catch (err) {
      setError(err.message || 'Ocurrió un error. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: 20
    }}>
      <div className="glass" style={{
        width: '100%',
        maxWidth: 400,
        padding: '40px 30px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {ApexLogo && <ApexLogo size={48} />}
          <h1 style={{ fontSize: 24, fontWeight: 300, letterSpacing: '-0.02em', margin: 0 }}>
            {isLogin ? 'Iniciar Sesión' : 'Registro'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-50)', margin: 0, textAlign: 'center' }}>
            {isLogin ? 'Accede al panel de Apex Vision' : 'Crea una cuenta en Apex Vision'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!isLogin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nombre completo</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                required
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  color: 'var(--ink-100)',
                  fontSize: 14,
                  outline: 'none'
                }}
              />
            </div>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Correo Electrónico</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                color: 'var(--ink-100)',
                fontSize: 14,
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Contraseña</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                color: 'var(--ink-100)',
                fontSize: 14,
                outline: 'none'
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 12px',
              background: error.includes('exitoso') ? 'rgba(167, 243, 208, 0.1)' : 'rgba(254, 226, 226, 0.1)',
              border: `1px solid ${error.includes('exitoso') ? 'rgba(167, 243, 208, 0.2)' : 'rgba(254, 226, 226, 0.2)'}`,
              borderRadius: 'var(--radius-sm)',
              color: error.includes('exitoso') ? '#a7f3d0' : '#fca5a5',
              fontSize: 12,
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="btn-primary glass"
            disabled={loading}
            style={{ marginTop: 8, justifyContent: 'center', width: '100%', padding: '12px 0' }}
          >
            {loading ? (isLogin ? 'Iniciando...' : 'Registrando...') : (isLogin ? 'Ingresar' : 'Crear Cuenta')}
          </button>
        </form>

        <div style={{ fontSize: 13, color: 'var(--ink-50)' }}>
          {isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <span 
            onClick={() => { setIsLogin(!isLogin); setError(''); }} 
            style={{ color: 'var(--ink-90)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {isLogin ? 'Regístrate aquí' : 'Inicia sesión'}
          </span>
        </div>
      </div>
    </div>
  );
};

window.AuthScreen = AuthScreen;
