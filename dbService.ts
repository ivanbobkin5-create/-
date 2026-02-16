
import { Order, User, WorkSession, CloudConfig } from './types';

export const dbService = {
  async testConnection(config: CloudConfig): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('/api/test', {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${config.apiToken}`,
          'Accept': 'application/json'
        }
      });
      const data = await response.json();
      return { success: data.success, message: data.message || 'Связь установлена' };
    } catch (err: any) {
      return { success: false, message: 'Не удалось достучаться до сервера /api/test' };
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
    // Мы всегда пытаемся загрузить данные, если есть токен
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
      return result.payload; // Может быть null, если таблица пуста
    } catch (err) {
      console.error("Cloud load failed", err);
      return null;
    }
  }
};
