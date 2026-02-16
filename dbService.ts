
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
      const trimmed = text.trim();
      
      // КРИТИЧЕСКАЯ ПРОВЕРКА: Если сервер выдал HTML
      if (trimmed.toLowerCase().startsWith('<!doctype') || trimmed.includes('<html')) {
        console.error('SERVER REDIRECT ERROR: Received HTML instead of JSON.');
        console.log('Response content preview:', trimmed.slice(0, 500));
        
        return { 
          success: false, 
          message: `Ошибка: Файл api.php не найден или сервер перенаправляет запрос на главную. Убедитесь, что в URL указано /api.php в конце.` 
        };
      }

      if (response.status === 403) {
        return { success: false, message: '403: Ошибка токена. Проверьте "MebelPlan_2025_Secure"' };
      }

      let data;
      try {
        data = JSON.parse(trimmed);
      } catch (e) {
        return { success: false, message: `Ошибка парсинга JSON (Статус ${response.status})` };
      }

      if (!response.ok) {
        return { success: false, message: data.message || `Ошибка сервера ${response.status}` };
      }
      
      return { success: data.success, message: data.message || 'Связь установлена' };
    } catch (err: any) {
      return { success: false, message: 'Сетевая ошибка или CORS. Проверьте https://' };
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
