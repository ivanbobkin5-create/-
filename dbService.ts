
import { Order, User, WorkSession, CloudConfig } from './types';

export const dbService = {
  async testConnection(config: CloudConfig): Promise<{ success: boolean; message: string }> {
    if (!config.apiUrl) return { success: false, message: 'URL API не задан' };
    
    const url = config.apiUrl.trim();

    try {
      const response = await fetch(`${url}?action=test`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${config.apiToken}`,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      const text = await response.text();
      
      if (response.status === 403) {
        return { success: false, message: `403 Forbidden: Вероятно, токен API неверный. Получено: ${text.slice(0, 50)}...` };
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('SERVER SENT NON-JSON:', text);
        return { 
          success: false, 
          message: `Ошибка JSON: Сервер вернул текст вместо данных. Посмотрите консоль (F12) для деталей.` 
        };
      }

      if (!response.ok) {
        return { success: false, message: data.message || `Ошибка сервера ${response.status}` };
      }
      
      return { success: data.success, message: data.message || 'Связь установлена' };
    } catch (err: any) {
      console.error('Connection Test Failed:', err);
      if (err.message === 'Failed to fetch') {
        return { 
          success: false, 
          message: 'Сетевая ошибка (Failed to fetch). Убедитесь, что URL верный и SSL сертификат сайта исправен.' 
        };
      }
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
        const errText = await response.text();
        console.error('Cloud Save HTTP Error:', errText);
        throw new Error(`Ошибка ${response.status}: ${errText.slice(0, 100)}`);
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
