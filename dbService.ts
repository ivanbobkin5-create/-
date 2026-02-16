import { Order, User, WorkSession, CloudConfig } from './types';

export const dbService = {
  async testConnection(config: CloudConfig): Promise<{ success: boolean; message: string }> {
    // В новой схеме apiUrl в настройках можно оставить пустым, он пойдет на /api/test
    const baseUrl = config.apiUrl && config.apiUrl.startsWith('http') ? config.apiUrl : '';
    const endpoint = baseUrl ? `${baseUrl.replace(/\/$/, '')}/test` : '/api/test';

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${config.apiToken}`,
          'Accept': 'application/json'
        }
      });
      
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        return { success: data.success, message: data.message || 'Связь установлена' };
      } catch (e) {
        return { success: false, message: `Ошибка JSON. Проверьте Deploy и команду запуска.` };
      }
    } catch (err: any) {
      return { success: false, message: 'Сетевая ошибка сервера.' };
    }
  },

  async saveToCloud(config: CloudConfig, data: any) {
    if (!config.enabled) return null;
    const baseUrl = config.apiUrl && config.apiUrl.startsWith('http') ? config.apiUrl : '';
    const endpoint = baseUrl ? baseUrl : '/api/save';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            action: 'save', 
            payload: data,
            token: config.apiToken
        })
      });
      return response.ok ? await response.json() : { success: false };
    } catch (err) {
      return { success: false };
    }
  },

  async loadFromCloud(config: CloudConfig) {
    if (!config.enabled) return null;
    const baseUrl = config.apiUrl && config.apiUrl.startsWith('http') ? config.apiUrl : '';
    const endpoint = baseUrl ? `${baseUrl.replace(/\/$/, '')}/load` : '/api/load';

    try {
      const response = await fetch(endpoint, {
        headers: { 
            'Authorization': `Bearer ${config.apiToken}`, 
            'Accept': 'application/json' 
        }
      });
      if (!response.ok) return null;
      const result = await response.json();
      return result.payload;
    } catch (err) {
      return null;
    }
  }
};