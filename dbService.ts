
import { Order, User, WorkSession, CloudConfig } from './types';

export const dbService = {
  async testConnection(config: CloudConfig): Promise<{ success: boolean; message: string }> {
    if (!config.apiUrl) return { success: false, message: 'URL API не задан' };
    
    let url = config.apiUrl.trim();
    
    // Авто-проверка: если URL заканчивается на / или просто домен, подсказываем про api.php
    if (!url.toLowerCase().endsWith('.php')) {
      return { 
        success: false, 
        message: 'Ошибка: URL должен заканчиваться на /api.php. Добавьте его в настройках.' 
      };
    }

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
      
      // Логируем тип контента для отладки
      const contentType = response.headers.get('content-type');
      const apiHeader = response.headers.get('x-mebelplan-api');
      console.log(`[Cloud] Status: ${response.status}, Content-Type: ${contentType}, API-Header: ${apiHeader}`);

      // Если в ответе HTML, значит сервер перенаправил запрос на index.html (SPA fallback)
      if (trimmed.toLowerCase().startsWith('<!doctype') || trimmed.includes('<html')) {
        console.error('SERVER CONFIG ERROR: Received HTML instead of JSON.');
        return { 
          success: false, 
          message: `Сервер вернул HTML-страницу. Это значит, что файл api.php либо отсутствует по этому адресу, либо сервер перенаправляет запросы на главную. Убедитесь, что api.php загружен на хостинг.` 
        };
      }

      if (response.status === 403) {
        return { success: false, message: '403: Неверный токен (Bearer Token)' };
      }

      if (response.status === 404) {
        return { success: false, message: '404: Файл api.php не найден на сервере' };
      }

      try {
        const data = JSON.parse(trimmed);
        if (!response.ok) return { success: false, message: data.message || `Ошибка сервера ${response.status}` };
        return { success: data.success, message: data.message || 'Связь с базой установлена' };
      } catch (e) {
        console.error('JSON Parse Error:', trimmed.slice(0, 100));
        return { success: false, message: 'Ошибка: сервер прислал некорректный ответ (не JSON)' };
      }
    } catch (err: any) {
      console.error('[Cloud] Network Error:', err);
      return { success: false, message: 'Сетевая ошибка. Проверьте интернет или настройки CORS на сервере.' };
    }
  },

  async saveToCloud(config: CloudConfig, data: { orders: Order[], staff: User[], sessions: WorkSession[], shifts: any }) {
    if (!config.enabled || !config.apiUrl) return null;
    if (!config.apiUrl.toLowerCase().endsWith('.php')) return null;
    
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
    if (!config.apiUrl.toLowerCase().endsWith('.php')) return null;

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
