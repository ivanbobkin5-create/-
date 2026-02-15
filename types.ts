
export enum UserRole {
  SITE_ADMIN = 'SITE_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  EMPLOYEE = 'EMPLOYEE'
}

export enum ProductionStage {
  SAWING = 'SAWING', // Распил
  EDGE_BANDING = 'EDGE_BANDING', // Кромка
  DRILLING = 'DRILLING', // Присадка
  KIT_ASSEMBLY = 'KIT_ASSEMBLY', // Комплектация
  PACKAGING = 'PACKAGING', // Упаковка
  SHIPMENT = 'SHIPMENT' // Отгрузка
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED = 'PAUSED', // Промежуточный итог
  COMPLETED = 'COMPLETED'
}

export interface Detail {
  id: string;
  code: string; // QR код
  name?: string;
  quantity?: number; // Количество деталей под одним номером
  scannedBy?: string; // ID сотрудника, отсканировавшего деталь
  scannedAt: string;
  status: 'PENDING' | 'SCANNED' | 'VERIFIED' | 'MISSING';
  returnAfterEdge?: boolean; // Флаг: деталь должна быть разделена после кромки
  wasSplit?: boolean; // Флаг: деталь уже была разделена
  parentDetailId?: string; // Ссылка на родительскую деталь
  planQuantity?: number;
}

export interface Package {
  id: string;
  name: string;
  sequenceNumber?: number; // Порядковый номер
  qr: string;
  createdAt: string;
  detailIds: string[]; // детали из участка Присадка (для Упаковки) или произвольные
  type: 'FURNITURE' | 'FITTINGS' | 'OTHER';
}

export interface WorkSession {
  id: string;
  userId: string;
  startTime: string;
  endTime?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId?: string;
  companyName?: string; 
  avatar?: string;
  source?: 'MANUAL' | 'BITRIX24';
  position?: string;
  isProduction?: boolean;
  isProductionHead?: boolean;
  password?: string; 
  isLocked?: boolean; 
}

export interface BitrixConfig {
  enabled: boolean;
  webhookUrl: string;
  chatUrl?: string; // Ссылка на чат Битрикс
  selectedFunnelIds: string[];
  triggerStageIds: string[]; 
  fieldMapping: BitrixFieldMapping;
  portalName?: string;
  portalLogo?: string;
}

// Fix: Added BitrixFunnel interface which was missing and causing errors in Settings.tsx
export interface BitrixFunnel {
  id: string;
  name: string;
}

// Fix: Added BitrixStage interface which was missing and causing errors in Settings.tsx
export interface BitrixStage {
  id: string;
  name: string;
  funnelId: string;
}

export interface BitrixFieldMapping {
  orderNumber: string;
  clientName: string;
  deadline: string;
  description: string;
}

export interface Order {
  id: string;
  companyId: string;
  clientName: string;
  orderNumber: string;
  deadline: string;
  description: string;
  createdAt: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  tasks: Task[];
  externalId?: string; 
  externalStageId?: string;
  externalCategoryId?: string;
  source?: 'MANUAL' | 'BITRIX24';
}

export interface Task {
  id: string;
  orderId: string;
  stage: ProductionStage;
  status: TaskStatus;
  assignedTo?: string;
  accompliceIds?: string[]; // Массив соисполнителей
  plannedDate?: string; 
  startedAt?: string;
  completedAt?: string;
  notes?: string;
  externalTaskId?: string;
  title?: string;
  details?: Detail[]; 
  packages?: Package[];
  rate?: number;
}
