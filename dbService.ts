import { Order, User, WorkSession, CloudConfig } from './types';

export const dbService = {
  async testConnection(config: CloudConfig): Promise<{ success: boolean; message: string }> {
    if (!config.apiUrl) return { success: false, message: 'URL API не задан' };
    
    let url = config.apiUrl.trim();
    
    try {
      // 1. Пинг-тест: проверяем, работает ли интерпретатор PHP
      const pingRes = await fetch(`${url}?ping=1`, { cache: 'no-cache' });
      const pingText = await pingRes.text();
      
      if (pingText.includes('<?php') || pingText.includes('TEST FILE FOR MEBELPLAN')) {
        return { 
          success: false, 
          message: 'КРИТИЧЕСКАЯ ОШИБКА: Сервер не исполняет PHP, а отдает его как текст. В TimeWeb Cloud Apps нужно использовать другой тип приложения или Node.js API.' 
        };
      }

      if (!pingText && pingRes.status === 200) {
        return {
          success: false,
          message: 'Пустой ответ. Вероятно, сервер TimeWeb Cloud блокирует PHP-файлы в статическом окружении.'
        };
      }

      // 2. Основной тест
      const response = await fetch(`${url}?action=test`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${config.apiToken}`,
          'Accept': 'application/json'
        }
      });
      
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (data.message === 'MISSING_PDO_PGSQL') {
          return { success: false, message: 'На сервере не установлен модуль pdo_pgsql. Напишите в поддержку TimeWeb Cloud.' };
        }
        return { success: data.success, message: data.message || 'Связь установлена' };
      } catch (e) {
        return { 
          success: false, 
          message: `Ошибка JSON (${response.status}). Ответ: "${text.substring(0, 50)}..."` 
        };
      }
    } catch (err: any) {
      return { success: false, message: 'Сетевая ошибка. Проверьте URL.' };
    }
  },

  async saveToCloud(config: CloudConfig, data: any) {
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