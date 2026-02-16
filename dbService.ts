
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
        return { success: false, message: `403 Forbidden: Ошибка авторизации. Проверьте токен.` };
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        // Это КРИТИЧЕСКИЙ момент для отладки
        console.group('ОШИБКА API (Non-JSON response)');
        console.error('Статус:', response.status);
        console.error('Полученный текст:', text);
        console.groupEnd();
        
        return { 
          success: false, 
          message: `Сервер вернул текст вместо JSON. Нажмите F12 и проверьте вкладку Console.` 
        };
      }

      if (!response.ok) {
        return { success: false, message: data.message || `Ошибка сервера ${response.status}` };
      }
      
      return { success: data.success, message: data.message || 'Связь установлена' };
    } catch (err: any) {
      console.error('Connection Test Failed:', err);
      if (err.name === 'TypeError' || err.message.includes('fetch')) {
        return { 
          success: false, 
          message: 'Ошибка сети (Failed to fetch). Проверьте: 1. Доступность URL. 2. Наличие https. 3. Настройки CORS на хостинге.' 
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
        throw new Error(`Ошибка сервера: ${errText.slice(0, 50)}`);
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
