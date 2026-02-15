
import { Order, User, WorkSession, CloudConfig } from './types';

export const dbService = {
  async testConnection(config: CloudConfig): Promise<{ success: boolean; message: string }> {
    if (!config.apiUrl) return { success: false, message: 'URL API не задан' };
    try {
      const response = await fetch(`${config.apiUrl}?action=test`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${config.apiToken}`,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Сервер вернул не JSON: ${text.substring(0, 100)}...`);
      }

      if (!response.ok) {
        throw new Error(data.message || `Ошибка сервера ${response.status}`);
      }
      
      return { success: data.success, message: data.message || 'Связь установлена' };
    } catch (err: any) {
      console.error('Connection Test Failed:', err);
      return { success: false, message: err.message || 'Сетевая ошибка' };
    }
  },

  async saveToCloud(config: CloudConfig, data: { orders: Order[], staff: User[], sessions: WorkSession[], shifts: any }) {
    if (!config.enabled || !config.apiUrl) return null;
    try {
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiToken}`
        },
        body: JSON.stringify({
          action: 'save',
          payload: data
        })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Ошибка сохранения');
      }
      return await response.json();
    } catch (err: any) {
      console.error('Cloud Save Error:', err);
      return { success: false, message: err.message };
    }
  },

  async loadFromCloud(config: CloudConfig) {
    if (!config.enabled || !config.apiUrl) return null;
    try {
      const response = await fetch(`${config.apiUrl}?action=load`, {
        headers: { 
          'Authorization': `Bearer ${config.apiToken}`,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      if (!response.ok) return null;
      const result = await response.json();
      return result.payload;
    } catch (err) {
      console.error('Cloud Load Error:', err);
      return null;
    }
  }
};
