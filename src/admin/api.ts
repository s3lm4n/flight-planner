/**
 * Admin API Client
 */

const API_BASE = '/admin/api';

class AdminApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (this.token) {
      (headers as Record<string, string>)['X-Admin-Session'] = this.token;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      localStorage.removeItem('adminToken');
      window.location.reload();
      throw new Error('Session expired');
    }

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // Auth
  async login(password: string): Promise<{ token: string; expiresAt: number }> {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Login failed');
    }

    return data.data;
  }

  // Stats
  async getStats(): Promise<{
    airports: number;
    notams: number;
    apiKeys: number;
    activeApiKeys: number;
  }> {
    const response = await this.request<{ success: boolean; data: any }>('/stats');
    return response.data;
  }

  // Upload
  async uploadCSV(file: File, type: string): Promise<{
    message: string;
    rowCount: number;
    errors?: string[];
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: this.token ? { 'X-Admin-Session': this.token } : {},
      body: formData,
    });

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || data.errors?.join(', ') || 'Upload failed');
    }

    return data;
  }

  // API Keys
  async getApiKeys(): Promise<any[]> {
    const response = await this.request<{ success: boolean; data: any[] }>('/keys');
    return response.data;
  }

  async createApiKey(name: string, permissions: string[] = ['read']): Promise<any> {
    const response = await this.request<{ success: boolean; data: any }>('/keys', {
      method: 'POST',
      body: JSON.stringify({ name, permissions }),
    });
    return response.data;
  }

  async deleteApiKey(keyId: string): Promise<void> {
    await this.request(`/keys/${keyId}`, { method: 'DELETE' });
  }

  // Data
  async getAirports(): Promise<any[]> {
    const response = await this.request<{ success: boolean; data: any[] }>('/airports');
    return response.data;
  }

  async getNotams(): Promise<any[]> {
    const response = await this.request<{ success: boolean; data: any[] }>('/notams');
    return response.data;
  }

  async clearData(type: 'airports' | 'notams' | 'all'): Promise<void> {
    await this.request('/clear', {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
  }
}

export const adminApi = new AdminApiClient();
