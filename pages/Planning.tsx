
import React, { useState, useMemo, useEffect } from 'react';
import { Order, ProductionStage, TaskStatus, User, Task } from '../types';
import { STAGE_CONFIG, STAGE_SEQUENCE, getEmployeeColor } from '../constants';
import { 
  Search, RefreshCw, Calendar as CalendarIcon, 
  ChevronLeft, ChevronRight, Inbox, User as UserIcon, 
  X, Check, Plus, Factory, ChevronDown, Coins, UserPlus, AlertCircle, Clock
} from 'lucide-react';

type GroupingMode = 'stage' | 'deal';

interface PlanningProps {
  orders: Order[];
  onAddOrder: (order: Order) => void;
  onSyncBitrix: () => Promise<number>;
  onUpdateTaskPlanning: (orderId: string, taskId: string, date: string | undefined, userId: string | undefined, accompliceIds?: string[]) => void;
  onUpdateTaskRate?: (orderId: string, taskId: string, rate: number) => void;
  isBitrixEnabled: boolean;
  staff: User[];
  shifts?: Record<string, Record<string, boolean>>;
}

const Planning: React.FC<PlanningProps> = ({ orders, onAddOrder, onSyncBitrix, onUpdateTaskPlanning, onUpdateTaskRate, isBitrixEnabled, staff, shifts = {} }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTaskId, setSelectedTaskId] = useState<{orderId: string, taskId: string} | null>(null);
  const [inboxSearch, setInboxSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [newOrder, setNewOrder] = useState({
    number: '', client: '', deadline: '', priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    stages: [ProductionStage.SAWING, ProductionStage.EDGE_BANDING, ProductionStage.DRILLING, ProductionStage.PACKAGING, ProductionStage.SHIPMENT] as ProductionStage[],
    detailsInput: ''
  });

  const [assigneeMenu, setAssigneeMenu] = useState<{orderId: string, taskId: string, type: 'main' | 'support', date?: string} | null>(null);
  const [rateMenu, setRateMenu] = useState<{orderId: string, taskId: string, currentRate: number} | null>(null);
  const [tempRate, setTempRate] = useState<string>('');
  const [groupingMode, setGroupingMode] = useState<GroupingMode>(() => (localStorage.getItem('woodplan_grouping') as GroupingMode) || 'stage');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i); return d;
    });
  }, [currentDate]);

  const formatDateKey = (date: Date) => date.toISOString().split('T')[0];
  const todayStr = formatDateKey(new Date());

  const groupedInboxTasks = useMemo(() => {
    const list: (Task & { order: Order })[] = [];
    orders.forEach(order => {
      if (order.tasks.find(t => t.stage === ProductionStage.SHIPMENT)?.status === TaskStatus.COMPLETED) return;
      order.tasks.forEach(task => {
        if (!task.plannedDate && task.status !== TaskStatus.COMPLETED) {
          const s = inboxSearch.toLowerCase();
          if (order.orderNumber.toLowerCase().includes(s) || order.clientName.toLowerCase().includes(s)) list.push({ ...task, order });
        }
      });
    });
    const groups: Record<string, any> = {};
    if (groupingMode === 'stage') {
      STAGE_SEQUENCE.forEach(stage => groups[stage] = { label: STAGE_CONFIG[stage].label, icon: STAGE_CONFIG[stage].icon, tasks: list.filter(t => t.stage === stage) });
    } else {
      list.forEach(item => {
        if (!groups[item.order.id]) groups[item.order.id] = { label: `${item.order.clientName}`, icon: <Factory size={16} />, tasks: [] };
        groups[item.order.id].tasks.push(item);
      });
    }
    return Object.entries(groups).filter(([_, g]: any) => g.tasks.length > 0);
  }, [orders, groupingMode, inboxSearch]);

  const scheduledTasks = useMemo(() => {
    const weekMap: Record<string, Record<string, (Task & { order: Order })[]>> = {};
    weekDays.forEach(day => {
      const key = formatDateKey(day); 
      weekMap[key] = {};
      STAGE_SEQUENCE.forEach(stage => { weekMap[key][stage] = []; });
    });
    orders.forEach(order => {
      order.tasks.forEach(task => {
        if (task.plannedDate && weekMap[task.plannedDate]) {
          const stageKey = task.stage as string;
          if (!weekMap[task.plannedDate][stageKey]) weekMap[task.plannedDate][stageKey] = [];
          weekMap[task.plannedDate][stageKey].push({ ...task, order });
        }
      });
    });
    return weekMap;
  }, [orders, weekDays]);

  return (
    <div className="h-full flex gap-6 overflow-hidden">
      <div className="w-80 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Inbox size={18} className="text-blue-600"/> Входящие</h3>
            <div className="flex gap-2">
               {isBitrixEnabled && <button onClick={async () => { setIsSyncing(true); await onSyncBitrix(); setIsSyncing(false); }} className={`p-2 bg-blue-50 text-blue-600 rounded-xl ${isSyncing ? 'animate-spin' : ''}`}><RefreshCw size={18} /></button>}
               <button onClick={() => setIsOrderModalOpen(true)} className="p-2 bg-blue-600 text-white rounded-xl shadow-lg"><Plus size={18} /></button>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
             <button onClick={() => setGroupingMode('stage')} className={`flex-1 py-1 rounded-lg text-[10px] font-black uppercase ${groupingMode === 'stage' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Участки</button>
             <button onClick={() => setGroupingMode('deal')} className={`flex-1 py-1 rounded-lg text-[10px] font-black uppercase ${groupingMode === 'deal' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Сделки</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
          {groupedInboxTasks.map(([groupId, group]: any) => (
            <div key={groupId} className="space-y-1">
              <button onClick={() => setExpandedGroups(p => p.includes(groupId) ? p.filter(g => g !== groupId) : [...p, groupId])} className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl group/header">
                <div className="flex items-center gap-2"><div className="text-slate-400 group-hover/header:text-blue-500">{group.icon}</div><span className="text-[11px] font-black text-slate-700 uppercase">{group.label}</span></div>
                <div className="flex items-center gap-2"><span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{group.tasks.length}</span><ChevronDown size={14} className={`text-slate-300 transition-transform ${expandedGroups.includes(groupId) ? 'rotate-180' : ''}`} /></div>
              </button>
              {(expandedGroups.includes(groupId) || inboxSearch) && (
                <div className="pl-2 space-y-2 animate-in slide-in-from-top-1">
                  {group.tasks.map((task: any) => (
                    <div key={task.id} onClick={() => setSelectedTaskId(selectedTaskId?.taskId === task.id ? null : { orderId: task.order.id, taskId: task.id })} className={`p-3 rounded-2xl border cursor-pointer transition-all ${selectedTaskId?.taskId === task.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100'}`}>
                      <div className="font-bold text-xs truncate">{groupingMode === 'stage' ? task.order.clientName : (task.title || 'Без описания')}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-6 flex justify-between shrink-0">
          <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
            <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }} className="p-2 hover:bg-slate-50 rounded-lg"><ChevronLeft size={20} /></button>
            <div className="px-4 py-2 text-sm font-bold flex items-center gap-2"><CalendarIcon size={16} className="text-blue-500" />{weekDays[0].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — {weekDays[6].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }} className="p-2 hover:bg-white rounded-lg"><ChevronRight size={20} /></button>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
          <div className="flex border-b border-slate-100 bg-slate-50/50 sticky top-0 z-20 shrink-0">
            <div className="w-40 p-4 border-r border-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase tracking-wider">Участки</div>
            <div className="flex-1 grid grid-cols-7 divide-x divide-slate-100 overflow-hidden">
              {weekDays.map(day => (
                <div key={day.toString()} className="p-4 text-center">
                  <div className="text-[10px] font-black uppercase text-slate-400">{day.toLocaleDateString('ru-RU', { weekday: 'short' })}</div>
                  <div className={`text-xl font-black ${formatDateKey(day) === todayStr ? 'text-blue-600' : 'text-slate-800'}`}>{day.getDate()}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {STAGE_SEQUENCE.map(stage => (
              <div key={stage} className="flex border-b border-slate-100 min-h-[160px] items-stretch">
                <div className="w-40 bg-slate-50/30 p-4 border-r border-slate-100 flex flex-col items-center justify-center gap-2 shrink-0">
                  <div className={`p-2 rounded-xl text-white shadow-sm ${STAGE_CONFIG[stage].color}`}>{STAGE_CONFIG[stage].icon}</div>
                  <div className="text-[11px] font-black text-slate-700 text-center uppercase leading-tight">{STAGE_CONFIG[stage].label}</div>
                </div>
                <div className="flex-1 grid grid-cols-7 divide-x divide-slate-100">
                  {weekDays.map(day => {
                    const dk = formatDateKey(day); 
                    const tasks = scheduledTasks[dk]?.[stage as string] || [];
                    const canAssign = !!(selectedTaskId && orders.find(o => o.id === selectedTaskId.orderId)?.tasks.find(t => t.id === selectedTaskId.taskId)?.stage === stage);
                    
                    return (
                      <div 
                        key={dk} 
                        onClick={() => { if (canAssign && selectedTaskId) onUpdateTaskPlanning(selectedTaskId.orderId, selectedTaskId.taskId, dk, undefined, []); }} 
                        className={`relative h-full flex flex-col gap-2 p-2 min-h-full ${canAssign ? 'cursor-pointer bg-emerald-50/40 ring-4 ring-inset ring-emerald-500/20 z-10' : ''}`}
                      >
                        {tasks.map(task => {
                          const isC = task.status === TaskStatus.COMPLETED; 
                          const orderColor = getEmployeeColor(task.order.id); 
                          const isOverdue = !isC && task.plannedDate && task.plannedDate < todayStr;
                          
                          return (
                            <div key={task.id} className={`p-2.5 rounded-2xl border-2 flex flex-col h-fit min-h-[140px] shadow-sm transition-all hover:shadow-md group/card ${isC ? 'bg-emerald-50 border-emerald-300' : 'bg-white'} ${isOverdue ? 'ring-2 ring-rose-500 ring-offset-2' : ''}`} style={{ borderColor: isC ? undefined : orderColor.replace('bg-', '#') }}>
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex flex-col">
                                  <span className={`text-[10px] font-bold leading-tight line-clamp-2 ${isC ? 'text-emerald-700' : 'text-slate-800'}`}>{task.order.clientName}</span>
                                  {isOverdue && <span className="flex items-center gap-1 text-[8px] font-black text-rose-600 uppercase mt-1"><Clock size={8}/> ПРОСРОЧЕНО</span>}
                                </div>
                                <button onClick={e => { e.stopPropagation(); onUpdateTaskPlanning(task.order.id, task.id, undefined, undefined, []); }} className="p-1 text-slate-300 hover:text-rose-500 shrink-0"><X size={10} /></button>
                              </div>
                              <div className="mt-auto space-y-2">
                                <div className="space-y-1">
                                  <button onClick={e => { e.stopPropagation(); setAssigneeMenu({ orderId: task.order.id, taskId: task.id, type: 'main', date: dk }); }} className={`w-full flex items-center gap-1.5 p-1 rounded-lg border text-[8px] font-black uppercase transition-colors ${task.assignedTo ? `${getEmployeeColor(staff.find(s => s.id === task.assignedTo)?.name || '')} text-white border-transparent` : 'bg-slate-50 text-slate-400 hover:bg-blue-50'}`}>
                                    <UserIcon size={10} /> <span className="truncate">{staff.find(s => s.id === task.assignedTo)?.name.split(' ')[0] || 'Исполнитель'}</span>
                                  </button>
                                  <div className="flex flex-wrap gap-0.5">
                                    {(task.accompliceIds || []).map(id => (
                                       <div key={id} className={`px-1.5 py-0.5 rounded text-[7px] font-bold text-white uppercase ${getEmployeeColor(staff.find(s => s.id === id)?.name || '')}`}>{staff.find(s => s.id === id)?.name.split(' ')[0]}</div>
                                    ))}
                                    <button onClick={e => { e.stopPropagation(); setAssigneeMenu({ orderId: task.order.id, taskId: task.id, type: 'support', date: dk }); }} className="p-1 rounded bg-slate-100 text-slate-400 hover:bg-blue-100"><UserPlus size={10}/></button>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                   <div onClick={e => { e.stopPropagation(); setRateMenu({ orderId: task.order.id, taskId: task.id, currentRate: task.rate || 0 }); setTempRate(String(task.rate || '')); }} className={`text-[9px] font-black px-1.5 py-0.5 rounded cursor-pointer transition-all ${task.rate ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'text-slate-300'}`}>
                                      {task.rate ? `${task.rate} ₽` : '+ Ставка'}
                                   </div>
                                   <span className="text-[7px] font-black uppercase text-slate-300">#{task.order.orderNumber}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Остальные модалки (assigneeMenu, rateMenu, etc) аналогичны */}
    </div>
  );
};

export default Planning;
