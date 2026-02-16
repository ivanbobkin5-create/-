
import React, { useState, useMemo, useEffect } from 'react';
import { Order, ProductionStage, TaskStatus, BitrixConfig, User, Task, Detail } from '../types';
import { STAGE_CONFIG, STAGE_SEQUENCE, getEmployeeColor } from '../constants';
import { 
  Search, RefreshCw, Calendar as CalendarIcon, 
  ChevronLeft, ChevronRight, Inbox, User as UserIcon, 
  X, Check, Users, AlertCircle, AlertTriangle, CheckCircle2,
  ChevronDown, LayoutList, Factory, ExternalLink, Coins, Trash2, Plus, Package, Clipboard
} from 'lucide-react';

type GroupingMode = 'stage' | 'deal';

interface PlanningProps {
  orders: Order[];
  onAddOrder: (order: Order) => void;
  onSyncBitrix: () => Promise<number>;
  onUpdateTaskPlanning: (orderId: string, taskId: string, date: string | undefined, userId: string | undefined, accompliceIds?: string[]) => void;
  onUpdateTaskRate?: (orderId: string, taskId: string, rate: number) => void;
  isBitrixEnabled: boolean;
  bitrixConfig?: BitrixConfig;
  staff: User[];
  shifts?: Record<string, Record<string, boolean>>;
  onDeleteTask?: (orderId: string, taskId: string) => void;
}

const ORDER_TEMPLATES = [
  { name: 'Кухня (Полный цикл)', stages: [ProductionStage.SAWING, ProductionStage.EDGE_BANDING, ProductionStage.DRILLING, ProductionStage.KIT_ASSEMBLY, ProductionStage.PACKAGING, ProductionStage.SHIPMENT] },
  { name: 'Шкаф-купе', stages: [ProductionStage.SAWING, ProductionStage.EDGE_BANDING, ProductionStage.KIT_ASSEMBLY, ProductionStage.PACKAGING, ProductionStage.SHIPMENT] },
  { name: 'Тумба/Стол', stages: [ProductionStage.SAWING, ProductionStage.EDGE_BANDING, ProductionStage.DRILLING, ProductionStage.PACKAGING, ProductionStage.SHIPMENT] },
  { name: 'Только распил', stages: [ProductionStage.SAWING, ProductionStage.SHIPMENT] },
];

const Planning: React.FC<PlanningProps> = ({ orders, onAddOrder, onSyncBitrix, onUpdateTaskPlanning, onUpdateTaskRate, isBitrixEnabled, bitrixConfig, staff, shifts = {}, onDeleteTask }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTaskId, setSelectedTaskId] = useState<{orderId: string, taskId: string} | null>(null);
  const [inboxSearch, setInboxSearch] = useState('');
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [newOrder, setNewOrder] = useState({
    number: '',
    client: '',
    deadline: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
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

  const todayStr = new Date().toISOString().split('T')[0];

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId]);
  };

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const formatDateKey = (date: Date) => date.toISOString().split('T')[0];

  const handleSync = async () => {
    setIsSyncing(true);
    const count = await onSyncBitrix();
    setIsSyncing(false);
    if (count > 0) alert(`Импортировано новых заказов: ${count}`);
    else alert("Новых заказов не найдено");
  };

  const handleCreateOrder = () => {
    if (!newOrder.number || !newOrder.client) { alert("Заполните номер заказа и имя клиента"); return; }
    const orderId = 'ORD-' + Math.random().toString(36).substr(2, 9);
    const detailCodes = newOrder.detailsInput.split(/[\s,;]+/).filter(c => c.trim().length > 0);
    const details: Detail[] = detailCodes.map(code => ({ id: Math.random().toString(36).substr(2, 9), code: code.trim(), status: 'PENDING', scannedAt: '', quantity: 0, planQuantity: 1 }));
    const tasks: Task[] = newOrder.stages.map(stage => ({ id: 'TSK-' + Math.random().toString(36).substr(2, 9), orderId, stage, status: TaskStatus.PENDING, details: stage === ProductionStage.SAWING ? details : [] }));
    onAddOrder({ id: orderId, companyId: 'manual', orderNumber: newOrder.number, clientName: newOrder.client, deadline: newOrder.deadline || todayStr, priority: newOrder.priority, createdAt: new Date().toISOString(), description: '', tasks, source: 'MANUAL' });
    setIsOrderModalOpen(false);
    setNewOrder({ number: '', client: '', deadline: '', priority: 'MEDIUM', stages: [ProductionStage.SAWING, ProductionStage.EDGE_BANDING, ProductionStage.DRILLING, ProductionStage.PACKAGING, ProductionStage.SHIPMENT], detailsInput: '' });
  };

  const groupedInboxTasks = useMemo(() => {
    const list: (Task & { order: Order })[] = [];
    orders.forEach(order => {
      const shipmentTask = order.tasks.find(t => t.stage === ProductionStage.SHIPMENT);
      if (shipmentTask?.status === TaskStatus.COMPLETED) return;
      order.tasks.forEach(task => {
        if (!task.plannedDate && task.status !== TaskStatus.COMPLETED) {
          const search = inboxSearch.toLowerCase();
          if (order.orderNumber.toLowerCase().includes(search) || order.clientName.toLowerCase().includes(search)) list.push({ ...task, order });
        }
      });
    });
    const groups: Record<string, { label: string, icon: React.ReactNode, tasks: (Task & { order: Order })[] }> = {};
    if (groupingMode === 'stage') {
      STAGE_SEQUENCE.forEach(stage => { groups[stage] = { label: STAGE_CONFIG[stage].label, icon: STAGE_CONFIG[stage].icon, tasks: list.filter(t => t.stage === stage) }; });
    } else {
      list.forEach(item => {
        if (!groups[item.order.id]) groups[item.order.id] = { label: `${item.order.orderNumber} — ${item.order.clientName}`, icon: <Factory size={16} />, tasks: [] };
        groups[item.order.id].tasks.push(item);
      });
    }
    return Object.entries(groups).filter(([_, group]) => group.tasks.length > 0);
  }, [orders, groupingMode, inboxSearch]);

  const scheduledTasks = useMemo(() => {
    const weekMap: Record<string, Record<ProductionStage, (Task & { order: Order })[]>> = {};
    weekDays.forEach(day => {
      const key = formatDateKey(day);
      weekMap[key] = {} as any;
      STAGE_SEQUENCE.forEach(stage => { weekMap[key][stage] = []; });
    });
    orders.forEach(order => {
      order.tasks.forEach(task => {
        if (task.plannedDate && weekMap[task.plannedDate]) weekMap[task.plannedDate][task.stage].push({ ...task, order });
      });
    });
    return weekMap;
  }, [orders, weekDays]);

  const assignTask = (dateKey: string, stage: ProductionStage) => {
    if (!selectedTaskId) return;
    const order = orders.find(o => o.id === selectedTaskId.orderId);
    const task = order?.tasks.find(t => t.id === selectedTaskId.taskId);
    if (task && task.stage !== stage) { alert(`Нельзя запланировать ${STAGE_CONFIG[task.stage].label} на участок ${STAGE_CONFIG[stage].label}`); return; }
    onUpdateTaskPlanning(selectedTaskId.orderId, selectedTaskId.taskId, dateKey, task?.assignedTo, task?.accompliceIds);
    setSelectedTaskId(null);
  };

  const handleAssigneeSelect = (orderId: string, taskId: string, userId: string | undefined) => {
    if (!assigneeMenu) return;
    const task = orders.find(o => o.id === orderId)?.tasks.find(t => t.id === taskId);
    if (!task) return;
    if (assigneeMenu.type === 'main') {
      onUpdateTaskPlanning(orderId, taskId, task.plannedDate, userId, task.accompliceIds);
      setAssigneeMenu(null);
    } else {
      const currentIds = task.accompliceIds || [];
      const updatedIds = userId ? (currentIds.includes(userId) ? currentIds.filter(id => id !== userId) : [...currentIds, userId]) : [];
      onUpdateTaskPlanning(orderId, taskId, task.plannedDate, task.assignedTo, updatedIds);
    }
  };

  return (
    <div className="h-full flex gap-6 overflow-hidden">
      <div className="w-80 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-100 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Inbox size={18} className="text-blue-600"/> Входящие</h3>
            <div className="flex gap-1.5">
               {isBitrixEnabled && (
                 <button onClick={handleSync} disabled={isSyncing} className={`p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all ${isSyncing ? 'animate-spin' : ''}`}>
                    <RefreshCw size={18} />
                 </button>
               )}
               <button onClick={() => setIsOrderModalOpen(true)} className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all">
                  <Plus size={18} />
               </button>
            </div>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl">
             <button onClick={() => setGroupingMode('stage')} className={`flex-1 flex justify-center py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${groupingMode === 'stage' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Участки</button>
             <button onClick={() => setGroupingMode('deal')} className={`flex-1 flex justify-center py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${groupingMode === 'deal' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Сделки</button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder="Поиск заказа..." value={inboxSearch} onChange={e => setInboxSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/10" />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
          {groupedInboxTasks.map(([groupId, group]) => (
            <div key={groupId} className="space-y-1">
              <button onClick={() => toggleGroup(groupId)} className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors group/header">
                <div className="flex items-center gap-2">
                  <div className="text-slate-400 group-hover/header:text-blue-500 transition-colors">{group.icon}</div>
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight truncate max-w-[180px]">{group.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{group.tasks.length}</span>
                  <ChevronDown size={14} className={`text-slate-300 transition-transform ${expandedGroups.includes(groupId) ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {(expandedGroups.includes(groupId) || inboxSearch) && (
                <div className="pl-2 space-y-2 pb-2 animate-in slide-in-from-top-1">
                  {group.tasks.map(task => (
                    <div key={task.id} onClick={() => setSelectedTaskId(selectedTaskId?.taskId === task.id ? null : { orderId: task.order.id, taskId: task.id })} className={`p-3 rounded-2xl border transition-all cursor-pointer group hover:shadow-md ${selectedTaskId?.taskId === task.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100'}`}>
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-[8px] font-black px-1 py-0.5 rounded uppercase tracking-widest ${selectedTaskId?.taskId === task.id ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{groupingMode === 'stage' ? task.order.orderNumber : STAGE_CONFIG[task.stage].label}</span>
                        {task.order.priority === 'HIGH' && <AlertCircle size={10} className={selectedTaskId?.taskId === task.id ? 'text-white' : 'text-rose-500'} />}
                      </div>
                      <div className="font-bold text-xs leading-tight mb-0.5 truncate">{groupingMode === 'stage' ? task.order.clientName : (task.title || 'Без описания')}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-6 flex items-center justify-between shrink-0">
          <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
            <button onClick={prevWeek} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-all"><ChevronLeft size={20} /></button>
            <div className="px-4 py-2 text-sm font-bold text-slate-800 flex items-center gap-2"><CalendarIcon size={16} className="text-blue-500" />{weekDays[0].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — {weekDays[6].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            <button onClick={nextWeek} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-all"><ChevronRight size={20} /></button>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
          <div className="flex border-b border-slate-100 bg-slate-50/50 z-20 sticky top-0 shrink-0">
            <div className="w-40 p-4 border-r border-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase tracking-wider">Участки</div>
            <div className="flex-1 grid grid-cols-7">
              {weekDays.map(day => (
                <div key={day.toString()} className="p-4 border-r border-slate-100 last:border-r-0 text-center min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{day.toLocaleDateString('ru-RU', { weekday: 'short' })}</div>
                  <div className={`text-xl font-black mt-1 ${day.toISOString().split('T')[0] === todayStr ? 'text-blue-600' : 'text-slate-800'}`}>{day.getDate()}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {STAGE_SEQUENCE.map(stage => (
              <div key={stage} className="flex border-b border-slate-100 min-h-[140px]">
                <div className="w-40 bg-slate-50/30 p-4 border-r border-slate-100 flex flex-col items-center justify-center gap-2 shrink-0">
                  <div className={`p-2 rounded-xl text-white shadow-sm ${STAGE_CONFIG[stage].color}`}>{STAGE_CONFIG[stage].icon}</div>
                  <div className="text-[11px] font-black text-slate-700 text-center uppercase tracking-tighter">{STAGE_CONFIG[stage].label}</div>
                </div>
                <div className="flex-1 grid grid-cols-7">
                  {weekDays.map(day => {
                    const dateKey = formatDateKey(day);
                    const tasks = scheduledTasks[dateKey][stage];
                    const canAssign = selectedTaskId && orders.find(o => o.id === selectedTaskId.orderId)?.tasks.find(t => t.id === selectedTaskId.taskId)?.stage === stage;
                    return (
                      <div key={dateKey} onClick={() => canAssign && assignTask(dateKey, stage)} className={`flex-1 p-2 border-r border-slate-100 relative group/cell flex flex-col gap-2 min-w-0 ${canAssign ? 'bg-emerald-50/30 cursor-pointer ring-2 ring-inset ring-emerald-500/20' : ''}`}>
                        {tasks.map(task => {
                          const isCompleted = task.status === TaskStatus.COMPLETED;
                          const mainStaff = staff.find(s => s.id === task.assignedTo);
                          return (
                            <div key={task.id} className={`p-2 rounded-xl border relative flex flex-col h-fit shadow-sm ${isCompleted ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-200'}`} style={{ minHeight: '110px' }}>
                              <div className="flex justify-between items-start mb-1">
                                <span className={`text-[8px] font-black px-1 py-0.5 rounded uppercase tracking-tighter ${isCompleted ? 'bg-emerald-600 text-white' : 'bg-blue-50 text-blue-600'}`}>{task.order.orderNumber}</span>
                                <button onClick={e => { e.stopPropagation(); onUpdateTaskPlanning(task.order.id, task.id, undefined, undefined, []); }} className="p-1 text-slate-300 hover:text-rose-500 transition-colors"><X size={10} /></button>
                              </div>
                              <div className={`text-[10px] font-bold leading-tight mb-2 line-clamp-2 ${isCompleted ? 'text-emerald-900' : 'text-slate-800'}`}>{task.order.clientName}</div>
                              <div className="mt-auto space-y-1">
                                <button onClick={e => { e.stopPropagation(); setAssigneeMenu({ orderId: task.order.id, taskId: task.id, type: 'main', date: dateKey }); }} className={`w-full flex items-center gap-1.5 p-1 rounded-lg border text-[8px] font-bold uppercase transition-all ${task.assignedTo ? `${getEmployeeColor(mainStaff?.name || '')} text-white` : 'bg-slate-50 text-slate-400 hover:border-blue-300'}`}>
                                  <UserIcon size={10} /> <span className="truncate">{mainStaff ? mainStaff.name.split(' ')[0] : 'Назначить'}</span>
                                </button>
                                {onUpdateTaskRate && (
                                  <div onClick={e => { e.stopPropagation(); setRateMenu({ orderId: task.order.id, taskId: task.id, currentRate: task.rate || 0 }); setTempRate(String(task.rate || '')); }} className="text-[8px] font-black text-slate-300 hover:text-amber-500 cursor-pointer">{task.rate ? `${task.rate} ₽` : '+ Ставка'}</div>
                                )}
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
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
             <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20"><Plus size={24}/></div>
                   <div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Новый заказ</h3></div>
                </div>
                <button onClick={() => setIsOrderModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600"><X size={24}/></button>
             </div>
             <div className="p-8 flex-1 overflow-y-auto custom-scrollbar space-y-8">
                <div className="grid grid-cols-2 gap-6">
                   <input type="text" value={newOrder.number} onChange={e => setNewOrder({...newOrder, number: e.target.value})} placeholder="Номер заказа" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" />
                   <input type="text" value={newOrder.client} onChange={e => setNewOrder({...newOrder, client: e.target.value})} placeholder="Имя клиента" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                   {STAGE_SEQUENCE.map(stage => (
                      <button key={stage} onClick={() => setNewOrder({...newOrder, stages: newOrder.stages.includes(stage) ? newOrder.stages.filter(s => s !== stage) : [...newOrder.stages, stage]})} className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-all ${newOrder.stages.includes(stage) ? 'bg-white border-blue-500 ring-4 ring-blue-50' : 'bg-slate-50 border-slate-100 opacity-40'}`}>
                         <div className={`p-2 rounded-lg text-white ${STAGE_CONFIG[stage].color}`}>{STAGE_CONFIG[stage].icon}</div>
                         <span className="text-[10px] font-black uppercase text-slate-700">{STAGE_CONFIG[stage].label}</span>
                      </button>
                   ))}
                </div>
                <textarea value={newOrder.detailsInput} onChange={e => setNewOrder({...newOrder, detailsInput: e.target.value})} placeholder="Детали (коды через пробел)" className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none resize-none"></textarea>
             </div>
             <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button onClick={() => setIsOrderModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black">Отмена</button>
                <button onClick={handleCreateOrder} className="flex-[2] py-4 bg-blue-600 text-white rounded-3xl font-black">Запустить</button>
             </div>
          </div>
        </div>
      )}

      {assigneeMenu && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50" onClick={() => setAssigneeMenu(null)}>
           <div className="bg-white rounded-3xl w-64 shadow-2xl p-2" onClick={e => e.stopPropagation()}>
              <div className="max-h-60 overflow-y-auto custom-scrollbar">
                 <button onClick={() => handleAssigneeSelect(assigneeMenu.orderId, assigneeMenu.taskId, undefined)} className="w-full px-4 py-3 text-left text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-2"><X size={14}/> Сбросить</button>
                 {staff.filter(s => s.isProduction && shifts[s.id]?.[assigneeMenu.date || '']).map(member => (
                    <button key={member.id} onClick={() => handleAssigneeSelect(assigneeMenu.orderId, assigneeMenu.taskId, member.id)} className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3">
                       <div className={`w-8 h-8 rounded-lg ${getEmployeeColor(member.name)} text-white flex items-center justify-center font-black text-[10px]`}>{member.name.charAt(0)}</div>
                       <span className="text-xs font-bold text-slate-700">{member.name}</span>
                    </button>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Planning;
