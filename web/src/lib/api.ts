export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  status?: number;
  credits?: number;
  hasCustomGateway?: boolean;
  created_at?: number;
}

export interface Settings {
  baseUrl: string;
  apiKey: string; // 打码
  isCustom?: boolean; // 是否是专属接口
}

export interface Task {
  id: string;
  userId?: string;
  kind: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  prompt: string;
  params: { ratio?: string; model?: string; refCount?: number };
  resultUrl: string | null;
  error: string | null;
  creditsCost?: number;
  userCredits?: number;
  createdAt: number;
  doneAt: number | null;
}

export interface ModelsResponse {
  models: string[];
  total: number;
  pricing?: Record<string, number>;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const { headers, ...rest } = init ?? {};
  // 只有携带 body 的请求才设置 Content-Type（空 body + json 头会被 Fastify 400 拒绝）
  const finalHeaders: Record<string, string> = { ...(headers as Record<string, string>) };
  if (rest.body != null && !finalHeaders['Content-Type']) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    credentials: 'same-origin',
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    if (url !== '/api/auth/login' && url !== '/api/auth/register') {
      window.dispatchEvent(new Event('auth:expired'));
      throw new Error('登录已过期');
    }
    throw new Error((body as any).error ?? '用户名或密码错误');
  }
  if (!res.ok) throw new Error((body as any).error ?? `请求失败 (${res.status})`);
  return body as T;
}

export const api = {
  login: (data: { username?: string; password: string }) =>
    request<{ ok: true; user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: { username: string; password: string }) =>
    request<{ ok: true; user: User }>('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request<{ user: User | null }>('/api/auth/me'),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),

  getSettings: () => request<Settings>('/api/settings'),
  saveSettings: (s: Partial<Settings>) => request<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(s) }),
  resetSettings: () => request<Settings>('/api/settings/custom', { method: 'DELETE' }),
  testSettings: () => request<{ ok: boolean; message: string }>('/api/settings/test', { method: 'POST' }),

  getModels: () => request<ModelsResponse>('/api/models'),

  createImage: (p: { prompt: string; ratio: string; model: string; refAssets?: string[] }) =>
    request<Task & { userCredits?: number }>('/api/tasks/image', { method: 'POST', body: JSON.stringify(p) }),
  listTasks: (since = 0) => request<Task[]>(`/api/tasks?since=${since}`),
  deleteTask: (id: string) => request<{ ok: true }>(`/api/tasks/${id}`, { method: 'DELETE' }),

  // Admin APIs
  adminListUsers: () => request<User[]>('/api/admin/users'),
  adminCreateUser: (data: { username: string; password: string; role?: string; credits?: number }) =>
    request<{ ok: true; id: string }>('/api/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  adminUpdateUser: (id: string, data: { password?: string; role?: string; status?: number; credits?: number }) =>
    request<{ ok: true }>(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminDeleteUser: (id: string) => request<{ ok: true }>(`/api/admin/users/${id}`, { method: 'DELETE' }),
  adminGetAllowedModels: () => request<{ allowedModels: string[] }>('/api/admin/allowed-models'),
  adminSetAllowedModels: (allowedModels: string[]) =>
    request<{ ok: true; allowedModels: string[] }>('/api/admin/allowed-models', {
      method: 'PUT',
      body: JSON.stringify({ allowedModels }),
    }),
};
