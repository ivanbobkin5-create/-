
import React, { useState, useMemo, useEffect } from 'react';
import { Order, ProductionStage, TaskStatus, BitrixConfig, User, Task, Detail } from '../types';
import { STAGE_CONFIG, STAGE_SEQUENCE, getEmployeeColor } from '../constants';
import { 
  Search, RefreshCw, Calendar as CalendarIcon, 
  ChevronLeft, ChevronRight, Inbox, User as UserIcon, 
  X, Check, Plus, Factory, ChevronDown, Coins, UserPlus, AlertCircle
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

const ORDER_TEMPLATES = [
  { name: 'Кухня (Полный цикл)', stages: [ProductionStage.SAWING, ProductionStage.EDGE_BANDING, ProductionStage.DRILLING, ProductionStage.KIT_ASSEMBLY, ProductionStage.PACKAGING, ProductionStage.SHIPMENT] },
  { name: 'Шкаф-купе', stages: [ProductionStage.SAWING, ProductionStage.EDGE_BANDING, ProductionStage.KIT_ASSEMBLY, ProductionStage.PACKAGING, ProductionStage.SHIPMENT] },
  { name: 'Тумба/Стол', stages: [ProductionStage.SAWING, ProductionStage.EDGE_BANDING, ProductionStage.DRILLING, ProductionStage.PACKAGING, ProductionStage.SHIPMENT] },
];

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

  const nextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); };
  const prevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); };

  useEffect(() => { localStorage.setItem('woodplan_grouping', groupingMode); }, [groupingMode]);

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

  const handleCreateOrder = () => {
    if (!newOrder.number || !newOrder.client) return;
    const orderId = 'ORD-' + Math.random().toString(36).substr(2, 9);
    const detailCodes = newOrder.detailsInput.split(/[\s,;]+/).filter(c => c.trim().length > 0);
    const details = detailCodes.map(code => ({ id: Math.random().toString(36).substr(2, 9), code: code.trim(), status: 'PENDING' as any, scannedAt: '', quantity: 0, planQuantity: 1 }));
    const tasks = newOrder.stages.map(stage => ({ id: 'TSK-' + Math.random().toString(36).substr(2, 9), orderId, stage, status: TaskStatus.PENDING, details: stage === ProductionStage.SAWING ? details : [] }));
    onAddOrder({ id: orderId, companyId: 'manual', orderNumber: newOrder.number, clientName: newOrder.client, deadline: newOrder.deadline || todayStr, priority: newOrder.priority, createdAt: new Date().toISOString(), description: '', tasks, source: 'MANUAL' });
    setIsOrderModalOpen(false);
  };

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
      STAGE_SEQUENCE.forEach(stage => {
        weekMap[key][stage] = [];
      });
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

  const handleAssigneeSelect = (orderId: string, taskId: string, userId: string | undefined) => {
    if (!assigneeMenu) return;
    const task = orders.find(o => o.id === orderId)?.tasks.find(t => t.id === taskId);
    if (!task) return;
    if (assigneeMenu.type === 'main') {
      onUpdateTaskPlanning(orderId, taskId, task.plannedDate, userId, task.accompliceIds);
      setAssigneeMenu(null);
    } else {
      const ids = task.accompliceIds || [];
      const upd = userId ? (ids.includes(userId) ? ids.filter(id => id !== userId) : [...ids, userId]) : [];
      onUpdateTaskPlanning(orderId, taskId, task.plannedDate, task.assignedTo, upd);
    }
  };

  const handleSaveRate = () => {
    if (!rateMenu || !onUpdateTaskRate) return;
    const r = parseFloat(tempRate);
    if (!isNaN(r)) onUpdateTaskRate(rateMenu.orderId, rateMenu.taskId, r);
    setRateMenu(null);
  };

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
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input type="text" placeholder="Поиск заказа..." value={inboxSearch} onChange={e => setInboxSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/10" /></div>
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
            <button onClick={prevWeek} className="p-2 hover:bg-slate-50 rounded-lg"><ChevronLeft size={20} /></button>
            <div className="px-4 py-2 text-sm font-bold flex items-center gap-2"><CalendarIcon size={16} className="text-blue-500" />{weekDays[0].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — {weekDays[6].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            <button onClick={nextWeek} className="p-2 hover:bg-white rounded-lg"><ChevronRight size={20} /></button>
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
                    const stageKey = stage as string;
                    const tasks = scheduledTasks[dk]?.[stageKey] || [];
                    const canAssign = !!(selectedTaskId && orders.find(o => o.id === selectedTaskId.orderId)?.tasks.find(t => t.id === selectedTaskId.taskId)?.stage === stage);
                    
                    return (
                      <div 
                        key={dk} 
                        onClick={() => {
                          if (canAssign && selectedTaskId) {
                            onUpdateTaskPlanning(selectedTaskId.orderId, selectedTaskId.taskId, dk, undefined, []);
                          }
                        }} 
                        className={`relative h-full flex flex-col gap-2 p-2 ${canAssign ? 'cursor-pointer bg-emerald-50/40 ring-4 ring-inset ring-emerald-500/20 z-10' : ''}`}
                      >
                        {tasks.map(task => {
                          const isC = task.status === TaskStatus.COMPLETED; 
                          const ms = staff.find(s => s.id === task.assignedTo);
                          const accompliceList = (task.accompliceIds || []).map(id => staff.find(s => s.id === id)).filter(Boolean);
                          
                          return (
                            <div key={task.id} className={`p-2.5 rounded-2xl border flex flex-col h-fit min-h-[140px] shadow-sm transition-all hover:shadow-md hover:border-blue-200 group/card ${isC ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200'}`}>
                              <div className="flex justify-between items-start mb-2">
                                <span className={`text-[10px] font-bold leading-tight line-clamp-2 ${isC ? 'text-emerald-700' : 'text-slate-800'}`}>{task.order.clientName}</span>
                                <button onClick={e => { e.stopPropagation(); onUpdateTaskPlanning(task.order.id, task.id, undefined, undefined, []); }} className="p-1 text-slate-300 hover:text-rose-500 shrink-0"><X size={10} /></button>
                              </div>
                              <div className="mt-auto space-y-2">
                                <div className="space-y-1">
                                  <button onClick={e => { e.stopPropagation(); setAssigneeMenu({ orderId: task.order.id, taskId: task.id, type: 'main', date: dk }); }} className={`w-full flex items-center gap-1.5 p-1 rounded-lg border text-[8px] font-black uppercase transition-colors ${task.assignedTo ? `${getEmployeeColor(ms?.name || '')} text-white border-transparent` : 'bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'}`}>
                                    <UserIcon size={10} /> <span className="truncate">{ms ? ms.name.split(' ')[0] : 'Исполнитель'}</span>
                                  </button>
                                  <div className="flex flex-wrap gap-0.5">
                                    {accompliceList.map(acc => (
                                       <div key={acc?.id} className={`px-1.5 py-0.5 rounded text-[7px] font-bold text-white uppercase ${getEmployeeColor(acc?.name || '')} flex items-center gap-1`}>
                                          {acc?.name.split(' ')[0]}
                                       </div>
                                    ))}
                                    <button onClick={e => { e.stopPropagation(); setAssigneeMenu({ orderId: task.order.id, taskId: task.id, type: 'support', date: dk }); }} className="p-1 rounded bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600 border border-slate-200 transition-colors">
                                       <UserPlus size={10}/>
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                   <div onClick={e => { e.stopPropagation(); setRateMenu({ orderId: task.order.id, taskId: task.id, currentRate: task.rate || 0 }); setTempRate(String(task.rate || '')); }} className={`text-[9px] font-black px-1.5 py-0.5 rounded cursor-pointer transition-all ${task.rate ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'text-slate-300 hover:text-amber-500'}`}>
                                      {task.rate ? `${task.rate} ₽` : '+ Ставка'}
                                   </div>
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

      {isOrderModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white rounded-[40px] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
             <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4"><div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20"><Plus size={24}/></div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Новый заказ</h3></div>
                <button onClick={() => setIsOrderModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600"><X size={24}/></button>
             </div>
             <div className="p-8 flex-1 overflow-y-auto custom-scrollbar space-y-8">
                <div className="grid grid-cols-2 gap-6">
                   <input type="text" value={newOrder.number} onChange={e => setNewOrder({...newOrder, number: e.target.value})} placeholder="Номер заказа" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" />
                   <input type="text" value={newOrder.client} onChange={e => setNewOrder({...newOrder, client: e.target.value})} placeholder="Имя клиента" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" />
                </div>
                <div className="flex gap-2 mb-2">{ORDER_TEMPLATES.map(t => <button key={t.name} onClick={() => setNewOrder({...newOrder, stages: t.stages})} className="text-[8px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-600 hover:text-white transition-all uppercase">{t.name}</button>)}</div>
                <div className="grid grid-cols-3 gap-3">
                   {STAGE_SEQUENCE.map(stage => (
                      <button key={stage} onClick={() => setNewOrder({...newOrder, stages: newOrder.stages.includes(stage) ? newOrder.stages.filter(s => s !== stage) : [...newOrder.stages, stage]})} className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-all ${newOrder.stages.includes(stage) ? 'bg-white border-blue-500 ring-4 ring-blue-50' : 'bg-slate-50 border-slate-100 opacity-40'}`}>
                         <div className={`p-2 rounded-lg text-white ${STAGE_CONFIG[stage].color}`}>{STAGE_CONFIG[stage].icon}</div>
                         <span className="text-[10px] font-black uppercase text-slate-700 leading-tight">{STAGE_CONFIG[stage].label}</span>
                      </button>
                   ))}
                </div>
                <textarea value={newOrder.detailsInput} onChange={e => setNewOrder({...newOrder, detailsInput: e.target.value})} placeholder="Детали заказа (коды через пробел)" className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none resize-none"></textarea>
             </div>
             <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button onClick={() => setIsOrderModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black">Отмена</button>
                <button onClick={handleCreateOrder} className="flex-[2] py-4 bg-blue-600 text-white rounded-3xl font-black text-xs uppercase shadow-xl">Запустить</button>
             </div>
          </div>
        </div>
      )}

      {assigneeMenu && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setAssigneeMenu(null)}>
           <div className="bg-white rounded-3xl w-72 shadow-2xl border border-slate-200 p-2 overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                <span>{assigneeMenu.type === 'main' ? 'Главный мастер' : 'Соисполнители'}</span>
                <button onClick={() => setAssigneeMenu(null)} className="text-slate-400 hover:text-rose-500"><X size={14}/></button>
              </div>
              <div className="max-h-80 overflow-y-auto custom-scrollbar p-1">
                 {assigneeMenu.type === 'main' && <button onClick={() => handleAssigneeSelect(assigneeMenu.orderId, assigneeMenu.taskId, undefined)} className="w-full px-4 py-3 text-left text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-xl flex items-center gap-2 mb-1"><X size={14}/> Сбросить основного</button>}
                 
                 {staff.filter(s => s.isProduction).map(m => {
                    const isWorking = shifts[m.id]?.[assigneeMenu.date || ''];
                    const isSelected = assigneeMenu.type === 'main' 
                      ? orders.find(o => o.id === assigneeMenu.orderId)?.tasks.find(t => t.id === assigneeMenu.taskId)?.assignedTo === m.id
                      : orders.find(o => o.id === assigneeMenu.orderId)?.tasks.find(t => t.id === assigneeMenu.taskId)?.accompliceIds?.includes(m.id);
                    
                    return (
                      <button key={m.id} onClick={() => handleAssigneeSelect(assigneeMenu.orderId, assigneeMenu.taskId, m.id)} className={`w-full px-4 py-3 text-left hover:bg-slate-50 rounded-xl flex items-center justify-between group transition-colors mb-0.5 ${!isWorking ? 'opacity-50' : ''}`}>
                         <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg ${getEmployeeColor(m.name)} text-white flex items-center justify-center font-black text-[10px] shadow-sm`}>{m.name.charAt(0)}</div>
                            <div className="flex flex-col">
                               <span className={`text-xs font-bold ${isSelected ? 'text-blue-600' : 'text-slate-700'}`}>{m.name}</span>
                               <span className={`text-[8px] font-black uppercase ${isWorking ? 'text-emerald-500' : 'text-slate-400'}`}>{isWorking ? 'В смене' : 'Не в смене'}</span>
                            </div>
                         </div>
                         {isSelected && <Check size={16} className="text-blue-600" />}
                      </button>
                    );
                 })}
              </div>
           </div>
        </div>
      )}

      {rateMenu && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setRateMenu(null)}>
           <div className="bg-white rounded-[32px] w-80 shadow-2xl border border-slate-200 p-8" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                 <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Ставка за этап (₽)</h4>
                 <button onClick={() => setRateMenu(null)} className="text-slate-300 hover:text-slate-500"><X size={18}/></button>
              </div>
              <div className="relative mb-6">
                <Coins className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" size={20} />
                <input type="number" value={tempRate} onChange={e => setTempRate(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-lg font-black outline-none focus:border-blue-500 transition-all" autoFocus placeholder="0" />
              </div>
              <button onClick={handleSaveRate} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all">Сохранить</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default Planning;
