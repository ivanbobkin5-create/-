
import React from 'react';
import { 
  Disc, 
  Layers, 
  Target, 
  PackageCheck, 
  Box, 
  Truck, 
  LayoutDashboard,
  Users,
  Calendar,
  Settings,
  Archive,
  ClipboardList,
  BarChart3,
  Wallet,
  MessageSquare,
  CalendarDays
} from 'lucide-react';
import { ProductionStage, UserRole } from './types';

export const STAGE_SEQUENCE = [
  ProductionStage.SAWING,
  ProductionStage.EDGE_BANDING,
  ProductionStage.DRILLING,
  ProductionStage.KIT_ASSEMBLY,
  ProductionStage.PACKAGING,
  ProductionStage.SHIPMENT
];

export const STAGE_CONFIG = {
  [ProductionStage.SAWING]: { label: 'Распил', icon: <Disc size={20} />, color: 'bg-blue-500', keywords: ['распил', 'пиление'] },
  [ProductionStage.EDGE_BANDING]: { label: 'Кромка', icon: <Layers size={20} />, color: 'bg-indigo-500', keywords: ['кромка', 'кромление', 'кромить'] },
  [ProductionStage.DRILLING]: { label: 'Присадка', icon: <Target size={20} />, color: 'bg-cyan-500', keywords: ['присадка', 'сверление', 'сверлить'] },
  [ProductionStage.KIT_ASSEMBLY]: { label: 'Комплектация', icon: <PackageCheck size={20} />, color: 'bg-emerald-500', keywords: ['комплектация', 'укомплектовать'] },
  [ProductionStage.PACKAGING]: { label: 'Упаковка', icon: <Box size={20} />, color: 'bg-amber-500', keywords: ['упаковка', 'упаковать'] },
  [ProductionStage.SHIPMENT]: { label: 'Отгрузка', icon: <Truck size={20} />, color: 'bg-rose-500', keywords: ['отгрузка', 'отгрузить'] },
};

export const NAVIGATION_ITEMS = [
  { id: 'dashboard', label: 'Дашборд', icon: <LayoutDashboard size={20} />, roles: [UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE] },
  { id: 'planning', label: 'Планирование', icon: <Calendar size={20} />, roles: [UserRole.COMPANY_ADMIN], allowProductionHead: true },
  { id: 'schedule', label: 'График работы', icon: <CalendarDays size={20} />, roles: [UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE] },
  { id: 'production', label: 'Производство', icon: <ClipboardList size={20} />, roles: [UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE] },
  { id: 'chat', label: 'Чат', icon: <MessageSquare size={20} />, roles: [UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE], isExternal: true },
  { id: 'reports', label: 'Отчеты', icon: <BarChart3 size={20} />, roles: [UserRole.COMPANY_ADMIN], allowProductionHead: true },
  { id: 'salaries', label: 'Зарплата', icon: <Wallet size={20} />, roles: [UserRole.COMPANY_ADMIN], allowProductionHead: true },
  { id: 'users', label: 'Сотрудники', icon: <Users size={20} />, roles: [UserRole.COMPANY_ADMIN] },
  { id: 'archive', label: 'Архив', icon: <Archive size={20} />, roles: [UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE] },
  { id: 'settings', label: 'Настройки', icon: <Settings size={20} />, roles: [UserRole.COMPANY_ADMIN] },
];

const STAFF_COLORS = [
  'bg-blue-600', 'bg-emerald-600', 'bg-indigo-600', 'bg-rose-600', 
  'bg-amber-600', 'bg-cyan-600', 'bg-purple-600', 'bg-orange-600',
  'bg-teal-600', 'bg-pink-600'
];

export const getEmployeeColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return STAFF_COLORS[Math.abs(hash) % STAFF_COLORS.length];
};
