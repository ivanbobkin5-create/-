import React, { useState, useMemo } from 'react';
import { Order, ProductionStage, Task, TaskStatus, User, BitrixConfig } from '../types';
import { STAGE_CONFIG, STAGE_SEQUENCE } from '../constants';
import { Inbox, Factory, ChevronDown, Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Clock, UserIcon, UserPlus, Coins, AlertCircle, Plus, RefreshCw } from 'lucide-react';
import BitrixSyncService from '../services/BitrixSyncService';

interface PlanningNewProps {
  orders: Order[];
  onSyncBitrix: () => Promise<number>;
  onUpdateTaskPlanning: (orderId: string, taskId: string, date: string | undefined, userId: string | undefined, accompliceIds?: string[]) => void;
  onCreateB24Task?: (orderId: string, taskId: string) => void;
  onUpdateTaskRate?: (orderId: string, taskId: string, rate: number) => void;
  onUpdateOrderDescription?: (orderId: string, description: string) => void;
  isBitrixEnabled: boolean;
  staff: User[];
  shifts?: Record<string, Record<string, boolean>>;
  user: User | null;
  bitrixConfig?: BitrixConfig;
}

const PlanningNew: React.FC<PlanningNewProps> = ({ 
  orders, 
  onSyncBitrix, 
  onUpdateTaskPlanning, 
  onCreateB24Task,
  onUpdateTaskRate, 
  onUpdateOrderDescription,
  isBitrixEnabled, 
  staff, 
  shifts = {},
  user,
  bitrixConfig
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const syncService = useMemo(() => bitrixConfig ? new BitrixSyncService(bitrixConfig) : null, [bitrixConfig]);

  const formatDateKey = (date: Date) => date.toISOString().split('T')[0];
  const todayStr = formatDateKey(new Date());

  // Группировка входящих задач
  const groupedInboxTasks = useMemo(() => {
    const list: (Task & { order: Order })[] = [];
    orders.forEach(order => {
      order.tasks.forEach(task => {
        if (!task.plannedDate && task.status !== TaskStatus.COMPLETED) {
          list.push({ ...task, order });
        }
      });
    });

    const groups: Record<string, { label: string, icon: React.ReactNode, tasks: (Task & { order: Order })[] }> = {};
    
    list.forEach(item => {
      const stageLabel = STAGE_CONFIG[item.stage].label;
      const groupKey = stageLabel;
      if (!groups[groupKey]) {
        groups[groupKey] = { label: stageLabel, icon: STAGE_CONFIG[item.stage].icon, tasks: [] };
      }
      groups[groupKey].tasks.push(item);
    });

    return Object.entries(groups);
  }, [orders]);

  // Группировка запланированных задач
  const scheduledTasks = useMemo(() => {
    const tasksByDate: Record<string, (Task & { order: Order })[]> = {};
    orders.forEach(order => {
      order.tasks.forEach(task => {
        if (task.plannedDate && task.status !== TaskStatus.COMPLETED) {
          if (!tasksByDate[task.plannedDate]) tasksByDate[task.plannedDate] = [];
          tasksByDate[task.plannedDate].push({ ...task, order });
        }
      });
    });
    return tasksByDate;
  }, [orders]);

  const weekDays = useMemo(() => {
    const days = [];
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay() + 1); // Start from Monday
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  const handlePrevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const handleToday = () => setCurrentDate(new Date());

  return (
    <div className="h-full flex gap-6 overflow-hidden p-6 bg-slate-50">
      {/* Входящие */}
      <div className="w-80 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Inbox size={18} className="text-blue-600"/> Входящие</h3>
          {bitrixConfig?.enabled && (
            <button 
              onClick={async () => { setIsSyncing(true); await onSyncBitrix(); setIsSyncing(false); }} 
              className={`p-2 hover:bg-blue-50 text-blue-600 rounded-xl transition-colors ${isSyncing ? 'animate-spin' : ''}`}
              title="Синхронизировать с Bitrix24"
            >
              <RefreshCw size={18} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          {groupedInboxTasks.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <AlertCircle size={32} className="mx-auto mb-2 opacity-20" />
              <p className="text-xs">Нет новых задач</p>
            </div>
          ) : groupedInboxTasks.map(([groupKey, group]) => (
            <div key={groupKey} className="space-y-2">
              <div className="flex items-center gap-2 text-slate-500 px-1">
                {group.icon}
                <span className="text-[10px] font-black uppercase tracking-wider">{group.label}</span>
                <span className="ml-auto bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded-full">{group.tasks.length}</span>
              </div>
              <div className="space-y-2">
                {group.tasks.map(task => (
                  <div 
                    key={task.id} 
                    className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group relative"
                    onClick={() => {
                      // Быстрое планирование на сегодня
                      onUpdateTaskPlanning(task.order.id, task.id, todayStr, undefined);
                    }}
                  >
                    <div className="font-bold text-xs text-slate-800 group-hover:text-blue-600 transition-colors">{task.order.clientName}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded uppercase font-bold text-[8px]">{task.order.orderNumber}</span>
                      {task.externalTaskId && <span className="text-blue-400 font-bold">B24</span>}
                    </div>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus size={16} className="text-blue-500" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* План */}
      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white z-10">
          <div className="flex items-center gap-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><CalendarIcon size={18} className="text-blue-600"/> План работ</h3>
            <div className="flex items-center bg-slate-100 rounded-xl p-1">
              <button onClick={handlePrevWeek} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600"><ChevronLeft size={16}/></button>
              <button onClick={handleToday} className="px-3 py-1 text-[11px] font-bold text-slate-600 hover:text-blue-600">Сегодня</button>
              <button onClick={handleNextWeek} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600"><ChevronRight size={16}/></button>
            </div>
          </div>
          <div className="text-sm font-bold text-slate-500">
            {weekDays[0].toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
          </div>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col">
          <div className="flex min-w-[1000px] border-b border-slate-100 bg-slate-50/50">
            {weekDays.map(day => {
              const isToday = formatDateKey(day) === todayStr;
              return (
                <div key={day.toString()} className={`flex-1 p-3 text-center border-r border-slate-100 last:border-0 ${isToday ? 'bg-blue-50/50' : ''}`}>
                  <div className={`text-[10px] uppercase font-black tracking-widest mb-1 ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                    {day.toLocaleDateString('ru-RU', { weekday: 'short' })}
                  </div>
                  <div className={`text-lg font-black ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto min-w-[1000px] flex custom-scrollbar">
            {weekDays.map(day => {
              const dateStr = formatDateKey(day);
              const tasks = scheduledTasks[dateStr] || [];
              const isToday = dateStr === todayStr;

              return (
                <div key={day.toString()} className={`flex-1 border-r border-slate-100 last:border-0 p-3 space-y-3 min-h-full ${isToday ? 'bg-blue-50/20' : ''}`}>
                  {tasks.length === 0 ? (
                    <div className="h-full flex items-center justify-center opacity-10 pointer-events-none">
                      <CalendarIcon size={48} />
                    </div>
                  ) : tasks.map(task => (
                    <div 
                      key={task.id} 
                      className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all group relative"
                    >
                      <button 
                        onClick={() => onUpdateTaskPlanning(task.order.id, task.id, undefined, undefined)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X size={12} />
                      </button>

                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${STAGE_CONFIG[task.stage].color.replace('bg-', 'bg-')}`} />
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                          {STAGE_CONFIG[task.stage].label}
                        </span>
                      </div>

                      <div className="font-bold text-xs text-slate-800 mb-1">{task.order.clientName}</div>
                      
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                        <div className="flex -space-x-2">
                          {task.assignedTo ? (
                            <div className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-blue-600" title={staff.find(s => s.id === task.assignedTo)?.name}>
                              {staff.find(s => s.id === task.assignedTo)?.name.charAt(0)}
                            </div>
                          ) : (
                            <button 
                              className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 border-dashed flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-500 hover:border-blue-200 transition-all"
                              onClick={() => {
                                // Здесь можно открыть выбор сотрудника
                                const firstStaff = staff[0];
                                if (firstStaff) onUpdateTaskPlanning(task.order.id, task.id, dateStr, firstStaff.id);
                              }}
                            >
                              <UserPlus size={12} />
                            </button>
                          )}
                        </div>
                        {task.externalTaskId && (
                          <div className="flex items-center gap-1 text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                            B24
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanningNew;
