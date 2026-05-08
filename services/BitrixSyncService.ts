import { Task, Order, BitrixConfig } from '../types';

declare const window: any;

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
        await this.sleep(this.isUsingBX24() ? 100 : 1000); // Меньшая задержка для нативного BX24
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

  private isUsingBX24() {
    return typeof window !== 'undefined' && window.BX24;
  }

  private async bx24Call(method: string, params: any) {
    return new Promise((resolve, reject) => {
      window.BX24.callMethod(method, params, (res: any) => {
        if (res.error()) {
          reject(res.error());
        } else {
          resolve({ result: res.data() });
        }
      });
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

  private async executeRequest(method: string, data: any): Promise<any> {
    if (this.isUsingBX24()) {
       return this.bx24Call(method, data);
    } else {
       const baseUrl = this.config.webhookUrl.replace(/\/$/, '');
       return this.proxyRequest(`${baseUrl}/${method}.json`, 'POST', data);
    }
  }

  async searchTask(orderId: string, stageLabel: string): Promise<any> {
    return this.addToQueue(() => this.executeRequest('tasks.task.list', {
      filter: { "UF_CRM_TASK": [`D_${orderId}`] },
      select: ["ID", "TITLE", "DESCRIPTION"]
    }));
  }

  async updateTask(taskId: string, fields: any): Promise<any> {
    return this.addToQueue(() => this.executeRequest('tasks.task.update', {
      taskId,
      fields
    }));
  }

  async createTask(fields: any): Promise<any> {
    return this.addToQueue(() => this.executeRequest('tasks.task.add', {
      fields
    }));
  }
}

export default BitrixSyncService;
