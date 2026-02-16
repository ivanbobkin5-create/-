
import { Order, User, WorkSession, CloudConfig } from './types';

export const dbService = {
  async testConnection(config: CloudConfig): Promise<{ success: boolean; message: string }> {
    if (!config.apiUrl) return { success: false, message: 'URL API не задан' };
    
    // Очищаем URL от лишних пробелов
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
      
      if (response.status === 403) {
        return { success: false, message: '403: Ошибка авторизации. Проверьте токен API.' };
      }

      if (response.status === 404) {
        return { success: false, message: '404: Файл api.php не найден по указанному адресу.' };
      }

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Raw response:', text);
        return { success: false, message: `Ошибка: Сервер вернул не JSON. Проверьте api.php.` };
      }

      if (!response.ok) {
        return { success: false, message: data.message || `Ошибка сервера ${response.status}` };
      }
      
      return { success: data.success, message: data.message || 'Связь установлена' };
    } catch (err: any) {
      console.error('Connection Test Failed:', err);
      // Если это Failed to fetch, даем более детальный совет
      if (err.message === 'Failed to fetch') {
        return { 
          success: false, 
          message: 'Сетевая ошибка (Failed to fetch). Возможно: 1. Неверный URL. 2. Ошибка SSL. 3. CORS заблокирован сервером.' 
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
