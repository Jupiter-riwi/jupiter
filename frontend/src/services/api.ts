import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const tokenStore = {
  get accessToken() {
    return localStorage.getItem('access_token') || '';
  },
  set accessToken(value: string) {
    localStorage.setItem('access_token', value);
  },
  get refreshToken() {
    return localStorage.getItem('refresh_token') || '';
  },
  set refreshToken(value: string) {
    localStorage.setItem('refresh_token', value);
  },
  clear() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
};

api.interceptors.request.use((config) => {
  const token = tokenStore.accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type TokenPair = {
  access_token: string;
  refresh_token: string;
};

export type Question = {
  id: string;
  text: string;
  category: string;
  expected_duration_sec: number;
};

export type Evaluation = {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  video_key: string;
  status: 'pending' | 'uploading' | 'processing' | 'scoring' | 'completed' | 'failed';
  score?: number;
  features?: unknown;
  created_at: string;
};

export type EvaluationCreateResponse = {
  evaluation: Evaluation;
  upload_url: string;
  expires_in_sec: number;
};

export async function login(email: string, password: string) {
  const { data } = await api.post<TokenPair>('/api/auth/login', { email, password });
  tokenStore.accessToken = data.access_token;
  tokenStore.refreshToken = data.refresh_token;
  return data;
}

export async function getMe() {
  const { data } = await api.get('/api/me');
  return data;
}

export async function getQuestions() {
  const { data } = await api.get<{ data: Question[] }>('/api/questions');
  return data.data;
}

export async function createEvaluation(title: string) {
  const { data } = await api.post<EvaluationCreateResponse>('/api/evaluations', { title });
  return data;
}

export async function completeEvaluation(id: string) {
  const { data } = await api.post<Evaluation>(`/api/evaluations/${id}/complete`);
  return data;
}

export async function getEvaluation(id: string) {
  const { data } = await api.get<Evaluation>(`/api/evaluations/${id}`);
  return data;
}

export async function listEvaluations() {
  const { data } = await api.get<{ data: Evaluation[] }>('/api/evaluations');
  return data.data;
}
