
import { GoogleGenAI } from "@google/genai";
import { Order } from "./types";

// Простейший кеш для предотвращения дублирующих запросов
const insightCache: Record<string, { text: string; timestamp: number }> = {};
const CACHE_TTL = 1000 * 60 * 10; // 10 минут

/**
 * Создает уникальный ключ на основе состояния заказов
 */
const getOrdersHash = (orders: Order[]) => {
  return orders.map(o => `${o.id}-${o.tasks.filter(t => t.status === 'COMPLETED').length}`).join('|');
};

/**
 * Вспомогательная функция для повторных попыток с экспоненциальной задержкой
 */
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // Если ошибка 429 (Resource Exhausted) и есть попытки
    if (retries > 0 && (error?.status === 429 || error?.message?.includes('429'))) {
      console.warn(`Gemini API rate limited. Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(r => setTimeout(r, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const getProductionInsights = async (orders: Order[]) => {
  if (!process.env.API_KEY) return "AI Insights unavailable: API key not found.";
  if (orders.length === 0) return "Добавьте заказы для получения аналитики.";

  const hash = getOrdersHash(orders);
  const cached = insightCache[hash];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.text;
  }

  const prompt = `
    Анализируй текущую ситуацию в мебельном цехе. У нас есть ${orders.length} активных заказов.
    Заказы: ${JSON.stringify(orders.map(o => ({ 
      id: o.orderNumber, 
      deadline: o.deadline, 
      tasksCount: o.tasks.length,
      completedTasks: o.tasks.filter(t => t.status === 'COMPLETED').length 
    })))}
    
    Дай краткий (3-4 предложения) прогноз и рекомендации:
    1. Какие участки могут стать узким местом?
    2. На какие заказы стоит обратить внимание в первую очередь?
    3. Оптимизация графика.
  `;

  try {
    const result = await retryWithBackoff(async () => {
      // Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          temperature: 0.7,
          maxOutputTokens: 600,
          thinkingConfig: { thinkingBudget: 300 }
        }
      });
      return response.text;
    });

    if (result) {
      insightCache[hash] = { text: result, timestamp: Date.now() };
    }
    
    return result;
  } catch (error: any) {
    console.error("Gemini Error:", error);
    
    if (error?.status === 429 || error?.message?.includes('429')) {
      return "Превышен лимит запросов к ИИ (Quota Exceeded). Пожалуйста, попробуйте обновить через минуту.";
    }
    
    return "Не удалось получить рекомендации от ИИ. Проверьте подключение к интернету или настройки API.";
  }
};
