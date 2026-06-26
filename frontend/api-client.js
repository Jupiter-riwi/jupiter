/* ============================================================
   API Client — Apex Vision
   Conecta el frontend con el API Gateway real.
   ============================================================ */
(function () {
  var API_BASE = 'http://localhost:8080';

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

  async _errorMessage(res, fallback) {
    const body = await res.json().catch(() => null);
    const detail = body && body.detail;
    if (detail === 'insufficient_at_balance') {
      const needed = Number(body.needed || 0);
      const available = Number(body.available || 0);
      return `Saldo insuficiente de AT. Necesitas ${needed} y tienes ${available}.`;
    }
    if (detail && typeof detail === 'object') {
      return detail.message || detail.error || fallback + ': ' + res.status;
    }
    return detail || (body && (body.error || body.message)) || fallback + ': ' + res.status;
  },

  async register(email, password, tenantId) {
    const res = await fetch(API_BASE + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, tenant_id: tenantId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Register failed: ' + res.status);
    }
    const data = await res.json();
    this.setToken(data.access_token);
    localStorage.setItem('apex_access_token', data.access_token);
    localStorage.setItem('apex_refresh_token', data.refresh_token);
    return data;
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

  async refreshToken() {
    const rt = localStorage.getItem('apex_refresh_token');
    if (!rt) return false;
    try {
      const res = await fetch(API_BASE + '/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.access_token) return false;
      this.setToken(data.access_token);
      localStorage.setItem('apex_access_token', data.access_token);
      if (data.refresh_token) localStorage.setItem('apex_refresh_token', data.refresh_token);
      console.log('[ApexAPI] Token refreshed');
      return true;
    } catch (e) {
      console.warn('[ApexAPI] refresh failed', e);
      return false;
    }
  },

  async _fetchAuth(url, opts, isUpload) {
    const buildHeaders = () => {
      if (isUpload) {
        return Object.assign({}, opts.headers || {}, {
          'Authorization': 'Bearer ' + this._token,
        });
      }
      return this._headers();
    };
    let res = await fetch(url, Object.assign({}, opts, { headers: buildHeaders() }));
    if (res.status === 401) {
      const ok = await this.refreshToken();
      if (ok) {
        res = await fetch(url, Object.assign({}, opts, { headers: buildHeaders() }));
      } else {
        this.logout();
        window.dispatchEvent(new CustomEvent('apex:session-expired'));
      }
    }
    return res;
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

  async getEvaluations(page = 1, limit = 10) {
    const res = await this._fetchAuth(API_BASE + `/api/evaluations?page=${page}&limit=${limit}`, {});
    if (!res.ok) throw new Error('Evaluations failed');
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
    const res = await this._fetchAuth(API_BASE + '/api/evaluations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      if (res.status === 401) throw new Error('Sesion expirada. Volve a iniciar sesion.');
      throw new Error('Create evaluation failed: ' + res.status);
    }
    return res.json();
  },

  async completeEvaluation(id) {
    const res = await this._fetchAuth(API_BASE + '/api/evaluations/' + id + '/complete', {
      method: 'POST',
    });
    if (!res.ok) throw new Error(await this._errorMessage(res, 'Complete failed'));
    return res.json();
  },

  async getEvaluation(id) {
    const res = await this._fetchAuth(API_BASE + '/api/evaluations/' + id, { method: 'GET' });
    if (!res.ok) throw new Error('Get evaluation failed');
    return res.json();
  },

  async listEvaluations() {
    const res = await this._fetchAuth(API_BASE + '/api/evaluations', { method: 'GET' });
    if (!res.ok) throw new Error('List evaluations failed');
    const body = await res.json();
    return body.data || body;
  },

  async listAdminEvaluations() {
    const res = await this._fetchAuth(API_BASE + '/api/admin/evaluations?limit=500', { method: 'GET' });
    if (!res.ok) throw new Error('List admin evaluations failed: ' + res.status);
    const body = await res.json();
    return body.data || body;
  },

  async uploadVideo(evalId, blob) {
    const url = API_BASE + '/api/evaluations/' + evalId + '/upload';
    const res = await this._fetchAuth(url, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': blob.type || 'video/webm' },
    }, true);
    if (!res.ok) throw new Error(await this._errorMessage(res, 'Upload failed'));
    return res.json();
  },

  async coachChat(evalId, message) {
    const res = await this._fetchAuth(API_BASE + '/api/evaluations/' + evalId + '/coach/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error(await this._errorMessage(res, 'Coach chat failed'));
    return res.json();
  },

  // ── Live conversational agent ──────────────────────────────────────────
  // Builds the WebSocket URL for a real-time session. The JWT travels as a
  // query param because browsers can't set headers on a WebSocket.
  liveWsUrl({ mode, role, level, lang, scenario } = {}) {
    const wsBase = API_BASE.replace(/^http/, 'ws');
    const p = new URLSearchParams();
    p.set('token', this._token || localStorage.getItem('apex_access_token') || '');
    if (mode) p.set('mode', mode);
    if (role) p.set('role', role);
    if (level) p.set('level', level);
    if (lang) p.set('lang', lang);
    if (scenario) p.set('scenario', scenario);
    return wsBase + '/api/live/ws?' + p.toString();
  },

  async livePersonas() {
    const res = await fetch(API_BASE + '/api/live/personas');
    if (!res.ok) throw new Error('Live personas failed: ' + res.status);
    return res.json();
  },

  // ── Billing (Stripe) ───────────────────────────────────────────────────
  // The backend returns { url } from each checkout/portal call; the frontend
  // redirects to that URL so Stripe's hosted UI handles card data (PCI).
  async getBillingBalance() {
    const res = await this._fetchAuth(API_BASE + '/api/billing/balance', { method: 'GET' });
    if (!res.ok) throw new Error('Billing balance failed: ' + res.status);
    return res.json();
  },

  async getBillingSubscription() {
    const res = await this._fetchAuth(API_BASE + '/api/billing/subscription', { method: 'GET' });
    if (!res.ok) throw new Error('Billing subscription failed: ' + res.status);
    return res.json();
  },

  async getBillingLedger(limit = 50) {
    const res = await this._fetchAuth(API_BASE + '/api/billing/ledger?limit=' + encodeURIComponent(limit), { method: 'GET' });
    if (!res.ok) throw new Error('Billing ledger failed: ' + res.status);
    return res.json();
  },

  async startSubscriptionCheckout(plan) {
    const res = await this._fetchAuth(API_BASE + '/api/billing/checkout/subscription', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
    if (!res.ok) throw new Error('Checkout subscription failed: ' + res.status);
    return res.json();
  },

  async startTopupCheckout(pack) {
    const res = await this._fetchAuth(API_BASE + '/api/billing/checkout/topup', {
      method: 'POST',
      body: JSON.stringify({ pack }),
    });
    if (!res.ok) throw new Error('Checkout topup failed: ' + res.status);
    return res.json();
  },

  async openBillingPortal() {
    const res = await this._fetchAuth(API_BASE + '/api/billing/portal', { method: 'POST' });
    if (!res.ok) throw new Error('Billing portal failed: ' + res.status);
    return res.json();
  },
  };

  window.ApexAPI = ApexAPI;
})();
