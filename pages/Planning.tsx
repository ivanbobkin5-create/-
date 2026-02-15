
import React, { useState, useMemo, useEffect } from 'react';
import { Order, ProductionStage, TaskStatus, BitrixConfig, User, Task } from '../types';
import { STAGE_CONFIG, STAGE_SEQUENCE, getEmployeeColor } from '../constants';
import { 
  Search, RefreshCw, Calendar as CalendarIcon, 
  ChevronLeft, ChevronRight, Inbox, User as UserIcon, 
  X, Check, Users, AlertCircle, AlertTriangle, CheckCircle2,
  ChevronDown, LayoutList, Factory, ExternalLink, Coins, Trash2
} from 'lucide-react';

type GroupingMode = 'stage' | 'deal';

interface PlanningProps {
  orders: Order[];
  onAddOrder?: (order: Order) => void; // Сделано необязательным
  onSyncBitrix: () => Promise<number>;
  onUpdateTaskPlanning: (orderId: string, taskId: string, date: string | undefined, userId: string | undefined, accompliceIds?: string[]) => void;
  onUpdateTaskRate?: (orderId: string, taskId: string, rate: number) => void;
  isBitrixEnabled: boolean;
  bitrixConfig?: BitrixConfig;
  staff: User[];
  shifts?: Record<string, Record<string, boolean>>; // График работы
  onDeleteTask?: (orderId: string, taskId: string) => void;
}

const Planning: React.FC<PlanningProps> = ({ orders, onAddOrder, onSyncBitrix, onUpdateTaskPlanning, onUpdateTaskRate, isBitrixEnabled, bitrixConfig, staff, shifts = {}, onDeleteTask }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTaskId, setSelectedTaskId] = useState<{orderId: string, taskId: string} | null>(null);
  const [inboxSearch, setInboxSearch] = useState('');
  const [assigneeMenu, setAssigneeMenu] = useState<{orderId: string, taskId: string, type: 'main' | 'support', date?: string} | null>(null);
  const [rateMenu, setRateMenu] = useState<{orderId: string, taskId: string, currentRate: number} | null>(null);
  const [tempRate, setTempRate] = useState<string>('');
  
  const [groupingMode, setGroupingMode] = useState<GroupingMode>(() => {
    return (localStorage.getItem('woodplan_grouping') as GroupingMode) || 'stage';
  });
  
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  useEffect(() => {
    localStorage.setItem('woodplan_grouping', groupingMode);
  }, [groupingMode]);

  const todayStr = new Date().toISOString().split('T')[0];

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId]
    );
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

  const handleSyncClick = async () => {
    setIsSyncing(true);
    await onSyncBitrix();
    setIsSyncing(false);
  };

  const nextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); };
  const prevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); };

  const getBitrixLink = (externalTaskId?: string) => {
    if (!externalTaskId || !bitrixConfig?.webhookUrl) return null;
    try {
      const url = new URL(bitrixConfig.webhookUrl);
      return `https://${url.hostname}/company/personal/user/0/tasks/task/view/${externalTaskId}/`;
    } catch (e) {
      return null;
    }
  };

  const groupedInboxTasks = useMemo(() => {
    const list: (Task & { order: Order })[] = [];
    orders.forEach(order => {
      const shipmentTask = order.tasks.find(t => t.stage === ProductionStage.SHIPMENT);
      const isWorkflowDone = shipmentTask ? shipmentTask.status === TaskStatus.COMPLETED : order.tasks.every(t => t.status === TaskStatus.COMPLETED);
      if (isWorkflowDone) return;
      order.tasks.forEach(task => {
        if (!task.plannedDate && task.status !== TaskStatus.COMPLETED) {
          const search = inboxSearch.toLowerCase();
          if (order.orderNumber.toLowerCase().includes(search) || order.clientName.toLowerCase().includes(search) || (task.title && task.title.toLowerCase().includes(search))) {
            list.push({ ...task, order });
          }
        }
      });
    });
    const groups: Record<string, { label: string, icon: React.ReactNode, tasks: (Task & { order: Order })[] }> = {};
    if (groupingMode === 'stage') {
      STAGE_SEQUENCE.forEach(stage => {
        groups[stage] = { label: STAGE_CONFIG[stage].label, icon: STAGE_CONFIG[stage].icon, tasks: list.filter(t => t.stage === stage) };
      });
    } else {
      list.forEach(item => {
        if (!groups[item.order.id]) {
          groups[item.order.id] = { label: `${item.order.orderNumber} — ${item.order.clientName}`, icon: <Factory size={16} />, tasks: [] };
        }
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
    if (task && task.stage !== stage) {
      alert(`Нельзя запланировать ${STAGE_CONFIG[task.stage].label} на участок ${STAGE_CONFIG[stage].label}`);
      return;
    }
    onUpdateTaskPlanning(selectedTaskId.orderId, selectedTaskId.taskId, dateKey, task?.assignedTo, task?.accompliceIds);
    setSelectedTaskId(null);
  };

  const handleRemoveFromPlanning = (orderId: string, task: Task) => {
    if (task.status === TaskStatus.COMPLETED) {
      const confirmMsg = "Удалив задачу, нарушаются аналитические отчеты, а также учет заработной платы. Вы уверены?";
      if (!window.confirm(confirmMsg)) return;
    }
    onUpdateTaskPlanning(orderId, task.id, undefined, undefined, []);
  };

  const handleDeletePermanent = (orderId: string, task: Task) => {
     const confirmMsg = "Удалив задачу, нарушаются аналитические отчеты, а также учет заработной платы. Вы уверены?";
     if (window.confirm(confirmMsg)) {
        onDeleteTask?.(orderId, task.id);
     }
  };

  const handleAssigneeSelect = (orderId: string, taskId: string, userId: string | undefined) => {
    if (!assigneeMenu) return;
    const order = orders.find(o => o.id === orderId);
    const task = order?.tasks.find(t => t.id === taskId);
    if (!task) return;
    if (assigneeMenu.type === 'main') {
      onUpdateTaskPlanning(orderId, taskId, task.plannedDate, userId, task.accompliceIds);
    } else {
      const currentIds = task.accompliceIds || [];
      const updatedIds = userId ? (currentIds.includes(userId) ? currentIds.filter(id => id !== userId) : [...currentIds, userId]) : [];
      onUpdateTaskPlanning(orderId, taskId, task.plannedDate, task.assignedTo, updatedIds);
    }
    if (assigneeMenu.type === 'main') setAssigneeMenu(null);
  };

  const handleSaveRate = () => {
    if (!rateMenu || !onUpdateTaskRate) return;
    const rateVal = parseFloat(tempRate);
    if (!isNaN(rateVal)) onUpdateTaskRate(rateMenu.orderId, rateMenu.taskId, rateVal);
    setRateMenu(null);
  };

  return (
    <div className="h-full flex gap-6 overflow-hidden">
      <div className="w-80 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox className="text-blue-600" size={20} />
              <h3 className="font-bold text-slate-800">Входящие</h3>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button onClick={() => setGroupingMode('stage')} className={`p-1.5 rounded-lg transition-all ${groupingMode === 'stage' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}><LayoutList size={14} /></button>
              <button onClick={() => setGroupingMode('deal')} className={`p-1.5 rounded-lg transition-all ${groupingMode === 'deal' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}><Factory size={14} /></button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder="Поиск..." value={inboxSearch} onChange={e => setInboxSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/10" />
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
                  {group.tasks.map(task => {
                    const b24Link = getBitrixLink(task.externalTaskId);
                    return (
                      <div key={task.id} onClick={() => setSelectedTaskId(selectedTaskId?.taskId === task.id ? null : { orderId: task.order.id, taskId: task.id })} className={`p-3 rounded-2xl border transition-all cursor-pointer group hover:shadow-md ${selectedTaskId?.taskId === task.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100'}`}>
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-[8px] font-black px-1 py-0.5 rounded uppercase tracking-widest ${selectedTaskId?.taskId === task.id ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{groupingMode === 'stage' ? task.order.orderNumber : STAGE_CONFIG[task.stage].label}</span>
                          <div className="flex items-center gap-2">
                            {b24Link && <a href={b24Link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className={`p-1 rounded hover:bg-white/20 ${selectedTaskId?.taskId === task.id ? 'text-white' : 'text-blue-400'}`}><ExternalLink size={10} /></a>}
                          </div>
                        </div>
                        <div className="font-bold text-xs leading-tight mb-0.5 truncate">{groupingMode === 'stage' ? task.order.clientName : (task.title || 'Без описания')}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        {isBitrixEnabled && (
          <div className="p-4 border-t border-slate-100">
            <button onClick={handleSyncClick} disabled={isSyncing} className="w-full bg-blue-50 text-blue-700 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-blue-100 disabled:opacity-50">
              {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />} Обновить из B24
            </button>
          </div>
        )}
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
                  <div className="text-xl font-black mt-1 text-slate-800">{day.getDate()}</div>
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
                          const isOverdue = !isCompleted && task.plannedDate && task.plannedDate < todayStr;
                          const mainStaff = staff.find(s => s.id === task.assignedTo);
                          const accompliceCount = task.accompliceIds?.length || 0;
                          return (
                            <div key={task.id} className={`p-2 rounded-xl border relative flex flex-col h-fit shadow-sm ${isCompleted ? 'bg-emerald-50 border-emerald-500' : isOverdue ? 'bg-rose-50 border-rose-500' : 'bg-white border-slate-200'}`} style={{ minHeight: '110px', zIndex: (assigneeMenu?.taskId === task.id || rateMenu?.taskId === task.id) ? 50 : 10 }}>
                              <div className="flex justify-between items-start mb-1">
                                <span className={`text-[8px] font-black px-1 py-0.5 rounded uppercase tracking-tighter ${isCompleted ? 'bg-emerald-600 text-white' : isOverdue ? 'bg-rose-600 text-white' : 'bg-blue-50 text-blue-600'}`}>{task.order.orderNumber}</span>
                                <div className="flex gap-1">
                                  <button onClick={e => { e.stopPropagation(); handleDeletePermanent(task.order.id, task); }} className="p-1 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={10} /></button>
                                  <button onClick={e => { e.stopPropagation(); handleRemoveFromPlanning(task.order.id, task); }} className="p-1 text-slate-300 hover:text-rose-500 transition-colors"><X size={10} /></button>
                                </div>
                              </div>
                              <div className={`text-[10px] font-bold leading-tight mb-2 line-clamp-1 ${isCompleted ? 'text-emerald-900' : isOverdue ? 'text-rose-900' : 'text-slate-800'}`}>{task.order.clientName}</div>
                              <div className="flex items-center justify-between mb-2">
                                <button onClick={e => { e.stopPropagation(); setRateMenu({ orderId: task.order.id, taskId: task.id, currentRate: task.rate || 0 }); setTempRate(String(task.rate || '')); }} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black ${task.rate ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-400 hover:bg-amber-50'}`}>
                                  <Coins size={10} /> {task.rate ? `${task.rate} ₽` : 'Ставка'}
                                </button>
                              </div>
                              <div className="space-y-1 mt-auto">
                                <button onClick={e => { e.stopPropagation(); setAssigneeMenu({ orderId: task.order.id, taskId: task.id, type: 'main', date: dateKey }); }} className={`w-full flex items-center gap-1.5 p-1 rounded-lg border text-[8px] font-bold uppercase ${task.assignedTo ? `${getEmployeeColor(mainStaff?.name || '')} text-white` : 'bg-slate-50 text-slate-400'}`}>
                                  <UserIcon size={10} /> <span className="truncate">{mainStaff ? mainStaff.name.split(' ')[0] : 'Исполнитель'}</span>
                                </button>
                                <button onClick={e => { e.stopPropagation(); setAssigneeMenu({ orderId: task.order.id, taskId: task.id, type: 'support', date: dateKey }); }} className={`w-full flex items-center gap-1.5 p-1 rounded-lg border text-[8px] font-bold uppercase ${accompliceCount > 0 ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                  <Users size={10} /> <span className="truncate">{accompliceCount > 0 ? `Соисп. (${accompliceCount})` : 'Соисполнители'}</span>
                                </button>
                              </div>
                              
                              {(assigneeMenu?.taskId === task.id) && (
                                <div className="absolute top-0 left-full ml-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[1000] overflow-hidden py-1 animate-in fade-in zoom-in" onClick={e => e.stopPropagation()}>
                                  <div className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase border-b bg-slate-50/50 flex justify-between">{assigneeMenu.type === 'main' ? 'Работают в этот день' : 'Соисполнители'}{assigneeMenu.type === 'support' && <button onClick={() => setAssigneeMenu(null)} className="text-blue-500 font-bold">Готово</button>}</div>
                                  <button onClick={() => handleAssigneeSelect(task.order.id, task.id, undefined)} className="w-full px-3 py-2 text-left text-[11px] text-slate-500 hover:bg-slate-50 flex justify-between items-center"><span>{assigneeMenu.type === 'main' ? 'Не назначен' : 'Очистить всех'}</span></button>
                                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                    {staff.filter(member => shifts[member.id]?.[assigneeMenu.date || '']).map(member => {
                                      const isSelected = assigneeMenu.type === 'main' ? task.assignedTo === member.id : task.accompliceIds?.includes(member.id);
                                      return (
                                        <button key={member.id} onClick={() => handleAssigneeSelect(task.order.id, task.id, member.id)} className="w-full px-2 py-2 text-left text-[11px] font-bold rounded-lg hover:bg-slate-50 flex items-center justify-between">
                                          <div className="flex items-center gap-2.5"><div className={`w-5 h-5 rounded-full ${getEmployeeColor(member.name)} text-white flex items-center justify-center text-[8px] font-black`}>{member.name.charAt(0)}</div><span className="truncate text-slate-700">{member.name}</span></div>
                                          {isSelected && <Check size={12} className="text-blue-500" />}
                                        </button>
                                      );
                                    })}
                                    {staff.filter(member => shifts[member.id]?.[assigneeMenu.date || '']).length === 0 && (
                                      <div className="p-4 text-center text-[10px] text-slate-400 italic">Нет работающих сотрудников</div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {rateMenu?.taskId === task.id && (
                                <div className="absolute top-0 left-full ml-2 w-40 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[1000] p-3 animate-in zoom-in" onClick={e => e.stopPropagation()}>
                                  <div className="text-[9px] font-black text-slate-400 uppercase mb-2 border-b pb-1">Ставка за 100%</div>
                                  <input type="number" value={tempRate} onChange={e => setTempRate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" autoFocus />
                                  <div className="flex gap-2 mt-3">
                                     <button onClick={() => setRateMenu(null)} className="flex-1 py-2 text-[9px] font-black text-slate-400 bg-slate-100 rounded-lg">Отмена</button>
                                     <button onClick={handleSaveRate} className="flex-1 py-2 text-[9px] font-black text-white bg-amber-500 rounded-lg">OK</button>
                                  </div>
                                </div>
                              )}
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
    </div>
  );
};

export default Planning;
