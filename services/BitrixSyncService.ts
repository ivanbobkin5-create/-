import { Task, Order, BitrixConfig } from '../types';

// Сервис для работы с Битрикс24
class BitrixSyncService {
  private queue: (() => Promise<any>)[] = [];
  private isProcessing = false;

  constructor(private config: BitrixConfig) {}

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        try {
          await task();
        } catch (e) {
          console.error('BitrixSyncService: Error processing queue item', e);
        }
        await this.sleep(1000); // Пауза между запросами
      }
    }
    this.isProcessing = false;
  }

  private addToQueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await task());
        } catch (e) {
          reject(e);
        }
      });
      this.processQueue();
    });
  }

  private async proxyRequest(url: string, method: string, body?: any) {
    const response = await fetch('/api/b24-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, method, body })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'B24 Proxy Error');
    return data;
  }

  async searchTask(orderId: string, stageLabel: string): Promise<any> {
    const baseUrl = this.config.webhookUrl.replace(/\/$/, '');
    return this.addToQueue(() => this.proxyRequest(`${baseUrl}/tasks.task.list.json`, 'POST', {
      filter: { "UF_CRM_TASK": [`D_${orderId}`] },
      select: ["ID", "TITLE"]
    }));
  }

  async updateTask(taskId: string, fields: any): Promise<any> {
    const baseUrl = this.config.webhookUrl.replace(/\/$/, '');
    return this.addToQueue(() => this.proxyRequest(`${baseUrl}/tasks.task.update.json`, 'POST', {
      taskId,
      fields
    }));
  }

  async createTask(fields: any): Promise<any> {
    const baseUrl = this.config.webhookUrl.replace(/\/$/, '');
    return this.addToQueue(() => this.proxyRequest(`${baseUrl}/tasks.task.add.json`, 'POST', {
      fields
    }));
  }
}

export default BitrixSyncService;
