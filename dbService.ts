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

      // Если ответ пустой
      if (!trimmed && response.status === 200) {
        return { success: false, message: 'Сервер вернул пустой ответ (HTTP 200). Возможно, api.php пуст или заблокирован.' };
      }

      if (!trimmed && response.status >= 500) {
        return { success: false, message: `Ошибка сервера (${response.status}). Скрипт api.php не смог запуститься.` };
      }

      // Проверка на HTML
      if (contentType.includes('text/html') || trimmed.toLowerCase().startsWith('<!doctype') || trimmed.toLowerCase().startsWith('<html')) {
        return { 
          success: false, 
          message: 'Получена HTML страница. Скорее всего, путь к api.php неверен или сработал редирект.' 
        };
      }

      try {
        const data = JSON.parse(trimmed);
        return { success: data.success, message: data.message || 'Статус не определен' };
      } catch (e) {
        const snippet = trimmed.substring(0, 100).replace(/<[^>]*>?/gm, '');
        return { 
          success: false, 
          message: `Ошибка JSON. Ответ сервера (${response.status}): "${snippet || 'пусто'}..."` 
        };
      }
    } catch (err: any) {
      return { success: false, message: 'Сетевая ошибка. Проверьте CORS или URL.' };
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