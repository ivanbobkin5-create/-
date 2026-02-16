
import { Order, User, WorkSession, CloudConfig } from './types';

export const dbService = {
  async login(email: string, pass: string): Promise<{ success: boolean; user?: User; payload?: any; message?: string }> {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      return await response.json();
    } catch (err) {
      return { success: false, message: "Сервер недоступен" };
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
      console.error("Cloud save failed", err);
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

  // Fix: Added missing testConnection method used in SiteAdmin.tsx
  async testConnection(config: CloudConfig): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('/api/load', {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${config.apiToken}`, 
            'Accept': 'application/json' 
        }
      });
      
      if (response.ok) {
        return { success: true, message: "Соединение установлено успешно" };
      } else if (response.status === 403) {
        return { success: false, message: "Ошибка авторизации: неверный токен" };
      } else {
        return { success: false, message: `Ошибка сервера: ${response.status}` };
      }
    } catch (err) {
      return { success: false, message: "Сервер облака недоступен" };
    }
  }
};
