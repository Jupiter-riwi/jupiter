/* ============================================================
   API Client — Apex Vision
   Conecta el frontend con el API Gateway real.
   ============================================================ */
(function () {
  var API_BASE = 'http://localhost:8081';

  var ApexAPI = {
  _token: null,

  setToken(t) { this._token = t; },
  getToken() { return this._token; },

  _headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this._token) h['Authorization'] = 'Bearer ' + this._token;
    else console.warn('[ApexAPI] No token set — request may fail with 401');
    return h;
  },

  async login(email, password) {
    const res = await fetch(API_BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Login failed: ' + res.status);
    const data = await res.json();
    this.setToken(data.access_token);
    localStorage.setItem('apex_access_token', data.access_token);
    localStorage.setItem('apex_refresh_token', data.refresh_token);
    console.log('[ApexAPI] Login OK, token stored');
    return data;
  },

  async restoreToken() {
    const t = localStorage.getItem('apex_access_token');
    if (t) this.setToken(t);
    return !!t;
  },

  logout() {
    this.setToken(null);
    localStorage.removeItem('apex_access_token');
    localStorage.removeItem('apex_refresh_token');
  },

  async getMe() {
    const res = await fetch(API_BASE + '/api/me', { headers: this._headers() });
    if (!res.ok) throw new Error('Get me failed');
    return res.json();
  },

  async getQuestions() {
    const res = await fetch(API_BASE + '/api/questions', { headers: this._headers() });
    if (!res.ok) throw new Error('Questions failed');
    const body = await res.json();
    return body.data || body;
  },

  async createEvaluation(title) {
    console.log('[ApexAPI] createEvaluation called, token:', !!this._token);
    const res = await fetch(API_BASE + '/api/evaluations', {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error('Create evaluation failed: ' + res.status);
    return res.json();
  },

  async completeEvaluation(id) {
    const res = await fetch(API_BASE + '/api/evaluations/' + id + '/complete', {
      method: 'POST',
      headers: this._headers(),
    });
    if (!res.ok) throw new Error('Complete failed: ' + res.status);
    return res.json();
  },

  async getEvaluation(id) {
    const res = await fetch(API_BASE + '/api/evaluations/' + id, { headers: this._headers() });
    if (!res.ok) throw new Error('Get evaluation failed');
    return res.json();
  },

  async listEvaluations() {
    const res = await fetch(API_BASE + '/api/evaluations', { headers: this._headers() });
    if (!res.ok) throw new Error('List evaluations failed');
    const body = await res.json();
    return body.data || body;
  },

  async uploadVideo(evalId, blob) {
    const url = API_BASE + '/api/evaluations/' + evalId + '/upload';
    const res = await fetch(url, {
      method: 'PUT',
      body: blob,
      headers: {
        'Content-Type': blob.type || 'video/webm',
        'Authorization': 'Bearer ' + this._token,
      },
    });
    if (!res.ok) throw new Error('Upload failed: ' + res.status);
    return res.json();
  },
  };

  window.ApexAPI = ApexAPI;
})();
