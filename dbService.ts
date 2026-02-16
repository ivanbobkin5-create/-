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

      // 1. Проверка на HTML (редирект SPA)
      if (contentType.includes('text/html') || trimmed.toLowerCase().startsWith('<!doctype')) {
        return { 
          success: false, 
          message: 'Сервер вернул HTML-страницу вместо API. Проверьте правильность ссылки и деплой.' 
        };
      }

      if (response.status === 403) {
        return { success: false, message: '403: Неверный токен (Bearer Token) в api.php.' };
      }

      // 2. Попытка распарсить JSON
      try {
        const data = JSON.parse(trimmed);
        if (!response.ok) return { success: false, message: data.message || `Ошибка сервера ${response.status}` };
        return { success: data.success, message: data.message || 'Связь установлена' };
      } catch (e) {
        // Если это не JSON, выводим кусок ответа для диагностики
        const debugSnippet = trimmed.substring(0, 100).replace(/<[^>]*>?/gm, '');
        return { 
          success: false, 
          message: `Ошибка JSON. Сервер ответил: "${debugSnippet}..."` 
        };
      }
    } catch (err: any) {
      return { success: false, message: 'Сетевая ошибка: проверьте URL или настройки CORS.' };
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