
import { Order, User, WorkSession, CloudConfig } from './types';

export const dbService = {
  async testConnection(config: CloudConfig): Promise<{ success: boolean; message: string }> {
    if (!config.apiUrl) return { success: false, message: 'URL API не задан' };
    
    const url = config.apiUrl.trim();

    try {
      console.log(`[Cloud] Testing connection to: ${url}`);
      const response = await fetch(`${url}?action=test`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${config.apiToken}`,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      const text = await response.text();
      const trimmed = text.trim();
      
      // Логируем тип контента для отладки в консоли браузера
      const contentType = response.headers.get('content-type');
      console.log(`[Cloud] Response Status: ${response.status}, Content-Type: ${contentType}`);

      if (trimmed.toLowerCase().startsWith('<!doctype') || trimmed.includes('<html')) {
        console.error('SERVER CONFIG ERROR: API URL returned HTML instead of JSON.');
        console.log('Body preview:', trimmed.slice(0, 300));
        return { 
          success: false, 
          message: `Сервер TimeWeb вернул страницу сайта вместо ответа API. Проверьте, что файл api.php загружен в корень и URL в настройках верный.` 
        };
      }

      if (response.status === 403) {
        return { success: false, message: '403: Ошибка токена. Проверьте "MebelPlan_2025_Secure"' };
      }

      try {
        const data = JSON.parse(trimmed);
        if (!response.ok) return { success: false, message: data.message || `Ошибка ${response.status}` };
        return { success: data.success, message: data.message || 'Связь установлена' };
      } catch (e) {
        console.error('JSON Parse Error. Raw text:', trimmed);
        return { success: false, message: `Ошибка: сервер прислал не JSON (Код ${response.status})` };
      }
    } catch (err: any) {
      console.error('[Cloud] Network Error:', err);
      return { success: false, message: 'Сетевая ошибка. Возможно, сервер TimeWeb блокирует CORS запросы.' };
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
        body: JSON.stringify({ action: 'save', payload: data })
      });
      return response.ok ? await response.json() : { success: false };
    } catch (err) {
      return { success: false };
    }
  },

  async loadFromCloud(config: CloudConfig) {
    if (!config.enabled || !config.apiUrl) return null;
    try {
      const response = await fetch(`${config.apiUrl}?action=load`, {
        headers: { 'Authorization': `Bearer ${config.apiToken}`, 'Accept': 'application/json' }
      });
      if (!response.ok) return null;
      const result = await response.json();
      return result.payload;
    } catch (err) {
      return null;
    }
  }
};
