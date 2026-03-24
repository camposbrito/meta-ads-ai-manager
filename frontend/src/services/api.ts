import axios from 'axios';
import type { AuthTokens, User, Organization, AdAccount, Campaign, Ad, Insight, OptimizationSuggestion, OptimizationRule, Plan } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
        const { accessToken } = response.data.tokens;

        localStorage.setItem('accessToken', accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data: { email: string; password: string; name: string; organizationName: string }) =>
    api.post<{ user: User; tokens: AuthTokens }>('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<{ user: User; tokens: AuthTokens }>('/auth/login', data),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),

  me: () => api.get<{ user: User }>('/auth/me'),
};

export const organizationAPI = {
  get: () => api.get<{ organization: Organization }>('/organization'),
  update: (data: { name: string }) => api.put<{ organization: Organization }>('/organization', data),
  getMembers: () => api.get<{ members: any[] }>('/organization/members'),
  addMember: (data: { email: string; name: string; role: string }) =>
    api.post('/organization/members', data),
  removeMember: (id: string) => api.delete(`/organization/members/${id}`),
  updateMemberRole: (id: string, role: string) =>
    api.patch(`/organization/members/${id}/role`, { role }),
};

export const adAccountAPI = {
  list: () => api.get<{ accounts: AdAccount[] }>('/ad-accounts'),
  connect: (data: { accessToken: string; accountId: string }) =>
    api.post('/ad-accounts/connect', data),
  disconnect: (id: string) => api.delete(`/ad-accounts/${id}`),
  sync: (id: string) => api.post(`/ad-accounts/${id}/sync`),
  getSyncStatus: (id: string) => api.get(`/ad-accounts/${id}/sync-status`),
};

export const dashboardAPI = {
  getOverview: (days?: number) => api.get('/dashboard/overview', { params: { days } }),
  getPerformance: (days?: number) => api.get<{ data: Insight[] }>('/dashboard/performance', { params: { days } }),
  getCampaigns: () => api.get<{ campaigns: Campaign[] }>('/dashboard/campaigns'),
  getTopAds: (days?: number, limit?: number) =>
    api.get<{ ads: Ad[] }>('/dashboard/top-ads', { params: { days, limit } }),
};

export const optimizationAPI = {
  getRules: () => api.get<{ rules: OptimizationRule[] }>('/optimization/rules'),
  createRule: (data: any) => api.post('/optimization/rules', data),
  updateRule: (id: string, data: any) => api.put(`/optimization/rules/${id}`, data),
  deleteRule: (id: string) => api.delete(`/optimization/rules/${id}`),
  toggleRule: (id: string, is_active: boolean) =>
    api.patch(`/optimization/rules/${id}/toggle`, { is_active }),
  getSuggestions: (status?: string) =>
    api.get<{ suggestions: OptimizationSuggestion[] }>('/optimization/suggestions', { params: { status } }),
  getSuggestion: (id: string) =>
    api.get<{ suggestion: OptimizationSuggestion }>(`/optimization/suggestions/${id}`),
  acceptSuggestion: (id: string, execute?: boolean) =>
    api.post(`/optimization/suggestions/${id}/accept`, { execute }),
  rejectSuggestion: (id: string) =>
    api.post(`/optimization/suggestions/${id}/reject`),
  runOptimization: (ad_account_id: string) =>
    api.post('/optimization/run', { ad_account_id }),
};

export const billingAPI = {
  getPlans: () => api.get<{ plans: Plan[] }>('/billing/plans'),
  getSubscription: () => api.get('/billing/subscription'),
  upgrade: (plan: string, billing_cycle?: string) =>
    api.post('/billing/upgrade', { plan, billing_cycle }),
  cancel: () => api.post('/billing/cancel'),
};

export default api;
