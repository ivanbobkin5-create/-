
export enum UserRole {
  SITE_ADMIN = 'SITE_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  EMPLOYEE = 'EMPLOYEE'
}

export enum ProductionStage {
  SAWING = 'SAWING', 
  EDGE_BANDING = 'EDGE_BANDING', 
  DRILLING = 'DRILLING', 
  KIT_ASSEMBLY = 'KIT_ASSEMBLY', 
  PACKAGING = 'PACKAGING', 
  SHIPMENT = 'SHIPMENT' 
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED = 'PAUSED', 
  COMPLETED = 'COMPLETED'
}

export interface Detail {
  id: string;
  code: string; 
  name?: string;
  quantity?: number; 
  scannedBy?: string; 
  scannedAt: string;
  status: 'PENDING' | 'SCANNED' | 'VERIFIED' | 'MISSING';
  returnAfterEdge?: boolean; 
  wasSplit?: boolean; 
  parentDetailId?: string; 
  planQuantity?: number;
}

export interface Package {
  id: string;
  name: string;
  sequenceNumber?: number; 
  qr: string;
  createdAt: string;
  detailIds: string[]; 
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

export interface CloudConfig {
  enabled: boolean;
  apiUrl: string;
  apiToken: string;
  lastSync?: string;
}

export interface BitrixConfig {
  enabled: boolean;
  webhookUrl: string;
  chatUrl?: string; 
  selectedFunnelIds: string[];
  triggerStageIds: string[]; 
  fieldMapping: BitrixFieldMapping;
  portalName?: string;
  portalLogo?: string;
  cloud?: CloudConfig;
}

export interface BitrixFunnel {
  id: string;
  name: string;
}

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
  accompliceIds?: string[]; 
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
