
import { Order, User, WorkSession, CloudConfig } from './types';

export const dbService = {
  async testConnection(config: CloudConfig): Promise<{ success: boolean; message: string }> {
    if (!config.apiUrl) return { success: false, message: 'URL API не задан' };
    
    let url = config.apiUrl.trim();
    
    if (!url.toLowerCase().endsWith('.php')) {
      return { 
        success: false, 
        message: 'Ошибка: URL должен заканчиваться на /api.php.' 
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
      
      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();
      const trimmed = text.trim();

      console.log(`[Cloud] Status: ${response.status}, Content-Type: ${contentType}`);
      console.log(`[Cloud] Raw Response:`, trimmed);

      // 1. Проверка на HTML (редирект на index.html)
      if (contentType.includes('text/html') || trimmed.toLowerCase().startsWith('<!doctype')) {
        return { 
          success: false, 
          message: 'Сервер вернул HTML-страницу. Проверьте правильность пути и наличие api.php в папке build.' 
        };
      }

      if (response.status === 403) {
        return { success: false, message: '403: Неверный токен доступа.' };
      }

      if (response.status === 404) {
        return { success: false, message: '404: Файл api.php не найден по этому адресу.' };
      }

      // 2. Попытка парсинга с детальным выводом ошибки
      try {
        const data = JSON.parse(trimmed);
        if (!response.ok) return { success: false, message: data.message || `Ошибка сервера ${response.status}` };
        return { success: data.success, message: data.message || 'Связь установлена' };
      } catch (e) {
        // Если не JSON, показываем начало текста ответа (там обычно текст ошибки PHP)
        const snippet = trimmed.substring(0, 60).replace(/<[^>]*>?/gm, ''); // убираем теги для читаемости
        return { 
          success: false, 
          message: `Ошибка ответа сервера. Получено: "${snippet}..."` 
        };
      }
    } catch (err: any) {
      return { success: false, message: 'Сетевая ошибка. Проверьте CORS или интернет.' };
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
