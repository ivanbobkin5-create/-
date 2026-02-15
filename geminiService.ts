
import { GoogleGenAI } from "@google/genai";
import { Order } from "./types";

const insightCache: Record<string, { text: string; timestamp: number }> = {};
const CACHE_TTL = 1000 * 60 * 10; 

const getOrdersHash = (orders: Order[]) => {
  return orders.map((o: Order) => `${o.id}-${o.tasks.filter(t => t.status === 'COMPLETED').length}`).join('|');
};

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error?.status === 429 || error?.message?.includes('429'))) {
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
    Заказы: ${JSON.stringify(orders.map((o: Order) => ({ 
      id: o.orderNumber, 
      deadline: o.deadline, 
      tasksCount: o.tasks.length,
      completedTasks: o.tasks.filter(t => t.status === 'COMPLETED').length 
    })))}
    
    Дай краткий прогноз и рекомендации по узким местам и графику.
  `;

  try {
    const result = await retryWithBackoff(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text;
    });

    if (result) {
      insightCache[hash] = { text: result, timestamp: Date.now() };
    }
    
    return result;
  } catch (error: any) {
    return "Не удалось получить рекомендации от ИИ.";
  }
};
