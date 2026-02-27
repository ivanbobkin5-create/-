
import { Order, User, WorkSession, CloudConfig } from './types';

export const dbService = {
  async checkHealth(): Promise<{ success: boolean; message: string; details?: string; serverIp?: string }> {
    try {
      const response = await fetch('/api/test-db');
      const data = await response.json();
      
      if (response.ok) {
        return { success: true, message: 'Система: Связь ОК', serverIp: data.serverIp };
      } else {
        return { 
            success: false, 
            message: 'БД: Нет доступа', 
            details: data.hint || data.message,
            serverIp: data.serverIp
        };
      }
    } catch (err: any) {
      return { success: false, message: 'API: Оффлайн', details: 'Сервер приложений не отвечает.' };
    }
  },

  async login(email: string, pass: string): Promise<{ success: boolean; user?: User; payload?: any; message?: string }> {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const data = await response.json();
      return data;
    } catch (err: any) {
      return { success: false, message: "Ошибка сети" };
    }
  },

  async register(user: User): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user })
      });
      return await response.json();
    } catch (err: any) {
      return { success: false, message: "Ошибка сети" };
    }
  },

  async saveToCloud(config: CloudConfig, data: any, companyId?: string) {
    if (!config.enabled) return null;
    try {
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: data, token: config.apiToken, companyId })
      });
      return response.ok;
    } catch (err) {
      return false;
    }
  },

  async loadFromCloud(config: CloudConfig, companyId?: string) {
    try {
      const response = await fetch('/api/load', {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${config.apiToken}`,
          'X-Company-Id': companyId || ''
        }
      });
      if (!response.ok) return null;
      const result = await response.json();
      return result.payload;
    } catch (err) {
      return null;
    }
  },

  async testConnection(config: CloudConfig) {
    return this.checkHealth();
  }
};
