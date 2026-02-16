
import { Order, User, WorkSession, CloudConfig } from './types';

// Определяем базовый URL для API (полезно для разработки)
const API_BASE = ''; 

export const dbService = {
  async checkHealth(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${API_BASE}/api/health`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return { success: false, message: 'Ошибка БД: ' + (errData.database || response.statusText) };
      }
      const data = await response.json();
      return { success: true, message: 'Система: Связь ОК' };
    } catch (err: any) {
      console.error('ПОДРОБНОСТИ ОШИБКИ СВЯЗИ:', err);
      return { success: false, message: 'Сервер: Ожидание...' };
    }
  },

  async login(email: string, pass: string): Promise<{ success: boolean; user?: User; payload?: any; message?: string }> {
    try {
      const response = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const data = await response.json();
      if (!response.ok) return { success: false, message: data.message || "Ошибка входа" };
      return data;
    } catch (err: any) {
      console.error('ОШИБКА LOGIN FETCH:', err);
      return { success: false, message: "Ошибка связи с API" };
    }
  },

  async saveToCloud(config: CloudConfig, data: any) {
    if (!config.enabled) return null;
    try {
      const response = await fetch(`${API_BASE}/api/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            action: 'save', 
            payload: data,
            token: config.apiToken
        })
      });
      return response.ok ? await response.json() : { success: false };
    } catch (err) {
      return { success: false };
    }
  },

  async loadFromCloud(config: CloudConfig) {
    try {
      const response = await fetch(`${API_BASE}/api/load`, {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${config.apiToken}`, 
            'Accept': 'application/json' 
        }
      });
      if (!response.ok) return null;
      const result = await response.json();
      return result.payload;
    } catch (err) {
      return null;
    }
  },

  async testConnection(config: CloudConfig): Promise<{ success: boolean; message: string }> {
    return this.checkHealth();
  }
};
