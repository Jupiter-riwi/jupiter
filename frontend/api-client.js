/* ============================================================
   API Client — Apex Vision (Mock Backend con Seguridad en Frontend)
   Simula el comportamiento del servidor real guardando datos en localStorage.
   ============================================================ */
(function () {
  // Configuración
  const ACCESS_TOKEN_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutos
  
  // Utilidad para hashear contraseñas usando SHA-256
  async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Base de datos simulada en localStorage
  const DB = {
    getUsers() { return JSON.parse(localStorage.getItem('apex_db_users') || '[]'); },
    setUsers(users) { localStorage.setItem('apex_db_users', JSON.stringify(users)); },
    getEvaluations() { return JSON.parse(localStorage.getItem('apex_db_evaluations') || '[]'); },
    setEvaluations(evals) { localStorage.setItem('apex_db_evaluations', JSON.stringify(evals)); },
    getGlobalTokens() { 
      const tokens = parseInt(localStorage.getItem('apex_tokens'), 10);
      return Number.isFinite(tokens) ? tokens : 500;
    },
    setGlobalTokens(tokens) { localStorage.setItem('apex_tokens', tokens.toString()); }
  };

  // Inicializar DB con datos de prueba si está vacía
  if (DB.getUsers().length === 0) {
    (async () => {
      const demoHash = await hashPassword('Demo1234!');
      const adminHash = await hashPassword('Admin1234!');
      DB.setUsers([
        { id: 1, email: 'seller.demo@jupiter.local', passwordHash: demoHash, role: 'SELLER', name: 'Seller Demo' },
        { id: 2, email: 'admin@jupiter.local', passwordHash: adminHash, role: 'ADMIN', name: 'Admin Jupiter' }
      ]);
    })();
  }

  var ApexAPI = {
    _token: null,
    _currentUser: null,

    setToken(t) { this._token = t; },
    getToken() { return this._token; },

    // Generador simple de tokens JWT-like (solo payload base64)
    _createToken(user, expiresInMs) {
      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        exp: Date.now() + expiresInMs
      };
      return btoa(JSON.stringify(payload));
    },

    _decodeToken(token) {
      try { return JSON.parse(atob(token)); } catch(e) { return null; }
    },

    async register(name, email, password, role = 'SELLER') {
      const users = DB.getUsers();
      if (users.find(u => u.email === email)) {
        throw new Error('El correo electrónico ya está registrado.');
      }
      const passwordHash = await hashPassword(password);
      const newUser = { id: Date.now(), name, email, passwordHash, role };
      users.push(newUser);
      DB.setUsers(users);
      return await this.login(email, password);
    },

    async login(email, password) {
      const users = DB.getUsers();
      const user = users.find(u => u.email === email);
      if (!user) throw new Error('Credenciales inválidas');
      
      const hash = await hashPassword(password);
      if (user.passwordHash !== hash) throw new Error('Credenciales inválidas');

      const access_token = this._createToken(user, ACCESS_TOKEN_EXPIRATION_MS);
      const refresh_token = this._createToken(user, 7 * 24 * 60 * 60 * 1000); // 7 días

      this.setToken(access_token);
      this._currentUser = user;
      localStorage.setItem('apex_access_token', access_token);
      localStorage.setItem('apex_refresh_token', refresh_token);
      console.log('[ApexAPI] Login OK, token generado por 15 minutos');
      
      return { access_token, refresh_token, user: { email: user.email, role: user.role } };
    },

    async restoreToken() {
      const t = localStorage.getItem('apex_access_token');
      if (!t) return false;
      const decoded = this._decodeToken(t);
      if (!decoded || decoded.exp < Date.now()) {
        return await this.refreshToken();
      }
      this.setToken(t);
      const users = DB.getUsers();
      this._currentUser = users.find(u => u.id === decoded.userId);
      return !!this._currentUser;
    },

    async refreshToken() {
      const rt = localStorage.getItem('apex_refresh_token');
      if (!rt) return false;
      const decoded = this._decodeToken(rt);
      if (!decoded || decoded.exp < Date.now()) return false;
      
      const users = DB.getUsers();
      const user = users.find(u => u.id === decoded.userId);
      if (!user) return false;

      const new_access_token = this._createToken(user, ACCESS_TOKEN_EXPIRATION_MS);
      this.setToken(new_access_token);
      this._currentUser = user;
      localStorage.setItem('apex_access_token', new_access_token);
      console.log('[ApexAPI] Token refrescado (válido por 15 min más)');
      return true;
    },

    async _checkAuth() {
      const t = this.getToken();
      if (!t) throw new Error('401 Unauthorized');
      const decoded = this._decodeToken(t);
      if (!decoded || decoded.exp < Date.now()) {
        const refreshed = await this.refreshToken();
        if (!refreshed) {
          this.logout();
          window.dispatchEvent(new CustomEvent('apex:session-expired'));
          throw new Error('401 Unauthorized - Session expired');
        }
      }
      return true;
    },

    logout() {
      this.setToken(null);
      this._currentUser = null;
      localStorage.removeItem('apex_access_token');
      localStorage.removeItem('apex_refresh_token');
    },

    async getMe() {
      await this._checkAuth();
      return this._currentUser;
    },

    async getQuestions() {
      await this._checkAuth();
      try {
        const saved = JSON.parse(localStorage.getItem('apex_questions') || 'null');
        return Array.isArray(saved) && saved.length ? saved : [
          { id:1, title:'Pitch de producto 90s', category:'Pitch · Producto', uses:47, avgScore:78, difficulty:'Media' },
          { id:2, title:'Apertura en frío', category:'Apertura', uses:38, avgScore:72, difficulty:'Alta' }
        ];
      } catch { return []; }
    },

    async createEvaluation(title) {
      await this._checkAuth();
      const evalId = 'ev_' + Date.now().toString(36);
      const newEval = {
        id: evalId,
        userId: this._currentUser.id,
        userName: this._currentUser.name,
        title,
        status: 'pending',
        createdAt: Date.now()
      };
      const evals = DB.getEvaluations();
      evals.push(newEval);
      DB.setEvaluations(evals);
      return { evaluation: newEval, upload_url: '/mock/upload' };
    },

    async uploadVideo(evalId, blob) {
      await this._checkAuth();
      // Simular subida
      return { status: 'ok' };
    },

    async completeEvaluation(id) {
      await this._checkAuth();
      
      // Cobrar 5 tokens de IA reales
      const currentTokens = DB.getGlobalTokens();
      if (currentTokens >= 5) {
        DB.setGlobalTokens(currentTokens - 5);
      }

      // Procesamiento IA Mock
      const evals = DB.getEvaluations();
      const target = evals.find(e => e.id === id);
      if (target) {
        target.status = 'completed';
        target.score = Math.floor(Math.random() * 30) + 65; // Score 65-95
        target.skills = [target.score-2, target.score+1, target.score-4, target.score+5, target.score];
        DB.setEvaluations(evals);
        return target;
      }
      throw new Error('Evaluación no encontrada');
    },

    async getEvaluation(id) {
      await this._checkAuth();
      const evals = DB.getEvaluations();
      return evals.find(e => e.id === id);
    },

    async listEvaluations() {
      await this._checkAuth();
      const evals = DB.getEvaluations();
      if (this._currentUser.role === 'ADMIN') {
        return evals.sort((a,b) => b.createdAt - a.createdAt);
      }
      return evals.filter(e => e.userId === this._currentUser.id).sort((a,b) => b.createdAt - a.createdAt);
    }
  };

  window.ApexAPI = ApexAPI;
})();
