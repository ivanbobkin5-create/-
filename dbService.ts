
import { Order, User, WorkSession, CloudConfig } from './types';

export const dbService = {
  async checkHealth(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      if (data.status === 'ok') return { success: true, message: 'Система: Связь ОК' };
      return { success: false, message: 'БД: ' + data.database };
    } catch (err) {
      return { success: false, message: 'Сервер: Ожидание...' };
    }
  },

  async login(email: string, pass: string): Promise<{ success: boolean; user?: User; payload?: any; message?: string }> {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      return await response.json();
    } catch (err) {
      return { success: false, message: "Ошибка связи с API" };
    }
  },

  async saveToCloud(config: CloudConfig, data: any) {
    if (!config.enabled) return null;
    try {
      const response = await fetch('/api/save', {
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
      const response = await fetch('/api/load', {
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
