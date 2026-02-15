
import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, 
  UserRole, 
  Order, 
  ProductionStage, 
  TaskStatus, 
  BitrixConfig,
  Task,
  Detail,
  Package,
  WorkSession
} from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Planning from './pages/Planning';
import Schedule from './pages/Schedule';
import ProductionBoard from './pages/ProductionBoard';
import Reports from './pages/Reports';
import Salaries from './pages/Salaries';
import UsersManagement from './pages/UsersManagement';
import Archive from './pages/Archive';
import LoginPage from './pages/LoginPage';
import SiteAdmin from './pages/SiteAdmin';
import Settings from './pages/Settings';
import { STAGE_SEQUENCE, STAGE_CONFIG } from './constants';
import { Mail, Bell, X, Trash2, ExternalLink, MessageSquare, LogIn, LogOut, Clock } from 'lucide-react';

const STORAGE_KEYS = {
  ORDERS: 'woodplan_orders',
  STAFF: 'woodplan_staff',
  BITRIX_CONFIG: 'woodplan_bitrix_config',
  USER: 'woodplan_user',
  MESSAGES: 'woodplan_messages',
  SHIFTS: 'woodplan_shifts',
  WORK_SESSIONS: 'woodplan_sessions'
};

const INITIAL_BITRIX_CONFIG: BitrixConfig = {
  enabled: false,
  webhookUrl: '',
  chatUrl: '',
  selectedFunnelIds: [],
  triggerStageIds: [],
  fieldMapping: {
    orderNumber: 'ID',
    clientName: 'TITLE',
    deadline: 'CLOSEDATE',
    description: 'COMMENTS'
  }
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });
  
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [staff, setStaff] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STAFF);
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [shifts, setShifts] = useState<Record<string, Record<string, boolean>>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SHIFTS);
      return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
  });

  const [sessions, setSessions] = useState<WorkSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WORK_SESSIONS);
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [bitrixConfig, setBitrixConfig] = useState<BitrixConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BITRIX_CONFIG);
      return saved ? JSON.parse(saved) : INITIAL_BITRIX_CONFIG;
    } catch (e) { return INITIAL_BITRIX_CONFIG; }
  });

  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSiteAdmin, setIsSiteAdmin] = useState(() => user?.role === UserRole.SITE_ADMIN);
  const [flashShiftBtn, setFlashShiftBtn] = useState(false);

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staff)); }, [staff]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.BITRIX_CONFIG, JSON.stringify(bitrixConfig)); }, [bitrixConfig]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts)); }, [shifts]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.WORK_SESSIONS, JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEYS.USER);
  }, [user]);

  const activeSession = useMemo(() => {
    if (!user) return null;
    return sessions.find(s => s.userId === user.id && !s.endTime);
  }, [sessions, user]);

  const triggerShiftFlash = () => {
    setFlashShiftBtn(true);
    setTimeout(() => setFlashShiftBtn(false), 2000);
  };

  const toggleWorkSession = () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const isScheduled = shifts[user.id]?.[today];

    if (!activeSession && !isScheduled && user.role !== UserRole.COMPANY_ADMIN) {
      alert('Внимание: Вас нет в графике на сегодня. Смена не может быть начата. Обратитесь к администратору.');
      return;
    }

    if (activeSession) {
      setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, endTime: new Date().toISOString() } : s));
    } else {
      const newSession: WorkSession = { id: Math.random().toString(36).substr(2, 9), userId: user.id, startTime: new Date().toISOString() };
      setSessions(prev => [...prev, newSession]);
    }
  };

  const toggleShift = (userId: string, date: string) => {
    setShifts(prev => {
      const userShifts = prev[userId] || {};
      return { ...prev, [userId]: { ...userShifts, [date]: !userShifts[date] } };
    });
  };

  const updateBitrixTask = async (externalTaskId: string, fields: any) => {
    if (!bitrixConfig.enabled || !bitrixConfig.webhookUrl || !externalTaskId) return;
    let url = bitrixConfig.webhookUrl.trim();
    if (!url.endsWith('/')) url += '/';
    try {
      await fetch(`${url}tasks.task.update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: externalTaskId, fields })
      });
    } catch (err) { console.error("Failed to sync with B24:", err); }
  };

  const addBitrixTaskComment = async (externalTaskId: string, message: string) => {
    if (!bitrixConfig.enabled || !bitrixConfig.webhookUrl || !externalTaskId) return;
    let url = bitrixConfig.webhookUrl.trim();
    if (!url.endsWith('/')) url += '/';
    try {
      const authorPrefix = user ? `[${user.name}]: ` : '';
      await fetch(`${url}task.commentitem.add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: externalTaskId, fields: { POST_MESSAGE: authorPrefix + message } })
      });
    } catch (err) { console.error("Failed to add B24 comment:", err); }
  };

  const updateBitrixTaskStatus = async (externalTaskId: string, newStatus: TaskStatus | 'RESUME') => {
    let b24Status = '2'; 
    if (newStatus === TaskStatus.COMPLETED) b24Status = '5';
    else if (newStatus === TaskStatus.IN_PROGRESS || newStatus === 'RESUME') b24Status = '3';
    else if (newStatus === TaskStatus.PAUSED) b24Status = '2';
    await updateBitrixTask(externalTaskId, { STATUS: b24Status });
  };

  const handleRegister = (companyName: string, email: string, pass: string) => {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) return;
    if (staff.some(s => s.email?.toLowerCase() === normalizedEmail)) { alert("Пользователь с таким email уже зарегистрирован."); return; }
    const newAdmin: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'Администратор',
      email: normalizedEmail,
      role: UserRole.COMPANY_ADMIN,
      companyId: 'c-' + Math.random().toString(36).substr(2, 5),
      companyName: companyName,
      password: pass,
      isLocked: false,
      source: 'MANUAL'
    };
    setStaff(prev => [...prev, newAdmin]);
    setBitrixConfig(prev => ({ ...prev, portalName: companyName }));
    setUser(newAdmin);
    setIsSiteAdmin(false);
  };

  const handleLogin = (role: UserRole, email?: string, password?: string) => {
    if (role === UserRole.SITE_ADMIN) {
      setIsSiteAdmin(true);
      const sa = { id: 'sa', name: 'Иван Бобкин', email: 'ivanbobkin@system.ru', role: UserRole.SITE_ADMIN };
      setUser(sa);
      return;
    }
    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      const foundUser = staff.find(s => s.email?.toLowerCase() === normalizedEmail);
      if (!foundUser) return "Пользователь с таким email не найден";
      if (foundUser.isLocked) return "Доступ заблокирован администратором";
      if (!foundUser.password) return "Доступ еще не предоставлен";
      if (foundUser.password !== password) return "Неверный пароль";
      setIsSiteAdmin(false);
      setUser(foundUser);
      return;
    }
    return "Введите данные для входа";
  };

  const handleLogout = () => { setUser(null); setIsSiteAdmin(false); localStorage.removeItem(STORAGE_KEYS.USER); setCurrentPage('dashboard'); };

  const updateStaffMember = (userId: string, updates: Partial<User>) => {
    setStaff(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
    if (user && user.id === userId) setUser(prev => prev ? { ...prev, ...updates } : null);
  };

  const syncBitrixUsers = async () => {
    if (!bitrixConfig.enabled || !bitrixConfig.webhookUrl) return -1;
    let url = bitrixConfig.webhookUrl.trim();
    if (!url.endsWith('/')) url += '/';
    try {
      const response = await fetch(`${url}user.get`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filter: { "ACTIVE": "Y" } }) });
      const data = await response.json();
      if (!data || !data.result) return 0;
      const bitrixUsers: User[] = (data.result || []).map((u: any) => {
        const existing = staff.find(s => s.id === String(u.ID));
        return {
          id: String(u.ID),
          name: `${u.NAME || ''} ${u.LAST_NAME || ''}`.trim() || u.EMAIL || 'Сотрудник ' + u.ID,
          email: u.EMAIL || '',
          role: UserRole.EMPLOYEE,
          avatar: u.PERSONAL_PHOTO || undefined,
          position: u.WORK_POSITION || '',
          source: 'BITRIX24',
          companyId: user?.companyId,
          isProduction: existing?.isProduction || false,
          isProductionHead: existing?.isProductionHead || false,
          password: existing?.password,
          isLocked: existing?.isLocked || false
        };
      });
      setStaff(prev => {
        const manualUsers = prev.filter(u => u.source === 'MANUAL' || u.role === UserRole.COMPANY_ADMIN || (u.companyId !== user?.companyId));
        const manualEmails = new Set(manualUsers.map(u => u.email?.toLowerCase() || ''));
        const uniqueBitrixUsers = bitrixUsers.filter(bu => bu.email && !manualEmails.has(bu.email.toLowerCase()));
        return [...manualUsers, ...uniqueBitrixUsers];
      });
      return bitrixUsers.length;
    } catch (err) { return -1; }
  };

  const syncBitrixOrders = async () => {
    if (!bitrixConfig.enabled || !bitrixConfig.webhookUrl) return -1;
    let url = bitrixConfig.webhookUrl.trim();
    if (!url.endsWith('/')) url += '/';
    
    try {
      const dealRes = await fetch(`${url}crm.deal.list`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          filter: bitrixConfig.triggerStageIds?.length > 0 ? { "STAGE_ID": bitrixConfig.triggerStageIds } : {}, 
          select: ["ID", "TITLE", "CLOSEDATE", "COMMENTS", "STAGE_ID", "CATEGORY_ID", "CONTACT_ID", "COMPANY_ID", ...Object.values(bitrixConfig.fieldMapping)] 
        }) 
      });
      
      const dealData = await dealRes.json();
      if (!dealData || !dealData.result) return 0;
      
      const fetchedDeals = dealData.result;
      const newOrders: Order[] = [];
      const mapping = bitrixConfig.fieldMapping;

      for (const deal of fetchedDeals) {
        if (orders.find(o => o.externalId === String(deal.ID))) continue;
        
        let clientName = String(deal[mapping.clientName] || deal.TITLE || 'Без имени');
        
        // Пытаемся подтянуть данные из контакта/компании если маппинг указывает на них
        if (mapping.clientName.startsWith('CONTACT_') && deal.CONTACT_ID) {
           const contactField = mapping.clientName.replace('CONTACT_', '');
           const cRes = await fetch(`${url}crm.contact.get`, { method: 'POST', body: JSON.stringify({ id: deal.CONTACT_ID }) });
           const cData = await cRes.json();
           if (cData.result && cData.result[contactField]) clientName = cData.result[contactField];
        } else if (mapping.clientName.startsWith('COMPANY_') && deal.COMPANY_ID) {
           const companyField = mapping.clientName.replace('COMPANY_', '');
           const compRes = await fetch(`${url}crm.company.get`, { method: 'POST', body: JSON.stringify({ id: deal.COMPANY_ID }) });
           const compData = await compRes.json();
           if (compData.result && compData.result[companyField]) clientName = compData.result[companyField];
        }

        const taskRes = await fetch(`${url}tasks.task.list`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ 
            filter: { "UF_CRM_TASK": [`D_${deal.ID}`] }, 
            select: ["ID", "TITLE", "STATUS", "RESPONSIBLE_ID", "ACCOMPLICES"] 
          }) 
        });
        
        const taskData = await taskRes.json();
        const b24Tasks = (taskData && taskData.result && taskData.result.tasks) ? taskData.result.tasks : [];
        
        const finalTasks: Task[] = b24Tasks.map((bt: any) => {
          const titleLower = bt.title ? bt.title.toLowerCase() : '';
          let stage: ProductionStage | null = null;
          for (const [s, cfg] of Object.entries(STAGE_CONFIG)) { 
            if (cfg.keywords.some(keyword => titleLower.includes(keyword.toLowerCase()))) { 
              stage = s as ProductionStage; 
              break; 
            } 
          }
          if (!stage) return null;
          return { 
            id: Math.random().toString(36).substr(2, 9), 
            orderId: '', 
            stage, 
            status: bt.status === '5' ? TaskStatus.COMPLETED : (bt.status === '3' ? TaskStatus.IN_PROGRESS : TaskStatus.PENDING), 
            externalTaskId: String(bt.id), 
            title: bt.title || 'Задача из B24', 
            assignedTo: bt.responsibleId ? String(bt.responsibleId) : undefined, 
            accompliceIds: bt.accomplices ? bt.accomplices.map((a: any) => String(a)) : [], 
            details: [], 
            packages: [] 
          };
        }).filter((t): t is Task => t !== null);

        if (finalTasks.length > 0) {
          newOrders.push({ 
            id: Math.random().toString(36).substr(2, 9), 
            companyId: user?.companyId || 'c1', 
            orderNumber: String(deal[mapping.orderNumber] || deal.ID), 
            clientName, 
            deadline: deal[mapping.deadline] || new Date().toISOString(), 
            description: deal[mapping.description] || deal.COMMENTS || '', 
            priority: 'MEDIUM', 
            createdAt: new Date().toISOString(), 
            source: 'BITRIX24', 
            externalId: String(deal.ID), 
            externalStageId: String(deal.STAGE_ID), 
            externalCategoryId: String(deal.CATEGORY_ID), 
            tasks: finalTasks 
          });
        }
      }
      if (newOrders.length > 0) { setOrders(prev => [...newOrders, ...prev]); return newOrders.length; }
      return 0;
    } catch (err) { return -1; }
  };

  const updateTaskPlanning = (orderId: string, taskId: string, date: string | undefined, userId: string | undefined, accompliceIds?: string[]) => {
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order;
      const updatedTasks = order.tasks.map(task => {
        if (task.id === taskId) {
           if (task.externalTaskId && (userId !== task.assignedTo || JSON.stringify(accompliceIds) !== JSON.stringify(task.accompliceIds))) {
             updateBitrixTask(task.externalTaskId, { RESPONSIBLE_ID: userId || 0, ACCOMPLICES: accompliceIds || [] });
           }
           return { ...task, plannedDate: date, assignedTo: userId, accompliceIds: accompliceIds || [] };
        }
        return task;
      });
      return { ...order, tasks: updatedTasks };
    }));
  };

  const updateTaskStatus = (orderId: string, taskId: string, newStatus: TaskStatus | 'RESUME', comment?: string) => {
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order;
      let updatedOrderTasks = [...order.tasks];
      const taskIndex = updatedOrderTasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        const currentTask = updatedOrderTasks[taskIndex];
        const statusToApply = newStatus === 'RESUME' ? TaskStatus.IN_PROGRESS : newStatus;
        let newNotes = currentTask.notes || '';
        if (comment) {
          const commentText = `[${new Date().toLocaleString()}] ${user?.name}: ${comment}`;
          newNotes += `\n${commentText}`;
          if (currentTask.externalTaskId) addBitrixTaskComment(currentTask.externalTaskId, comment);
        }
        if (statusToApply === TaskStatus.COMPLETED && currentTask.externalTaskId) {
           const details = currentTask.details || [];
           const pkgs = currentTask.packages || [];
           const isShipment = currentTask.stage === ProductionStage.SHIPMENT;
           
           const scanStats: Record<string, number> = {};
           details.forEach(d => { 
             if(d.scannedBy) {
               scanStats[d.scannedBy] = (scanStats[d.scannedBy] || 0) + (d.quantity || 1); 
             }
           });
           
           const totalScans = Object.values(scanStats).reduce((a, b) => a + b, 0);
           
           const participantIds = Array.from(new Set([
             currentTask.assignedTo, 
             ...(currentTask.accompliceIds || []),
             ...Object.keys(scanStats)
           ])).filter((id): id is string => !!id);

           const report = [
             `✅ Задача завершена: ${STAGE_CONFIG[currentTask.stage].label}`, 
             `📅 Дата: ${new Date().toLocaleString('ru-RU')}`, 
             isShipment 
               ? `📦 Просканировано упаковок: ${details.length}` 
               : `📊 Просканировано деталей: ${details.reduce((acc, d) => acc + (d.quantity || 1), 0)}`, 
             pkgs.length > 0 ? `📦 Создано упаковок: ${pkgs.length} (${pkgs.map(p => p.name).join(', ')})` : null, 
             `👥 Участники: ${participantIds.map(id => staff.find(s => s.id === id)?.name || id).join(', ')}`, 
             `📈 Распределение участия (сканы):`, 
             ...participantIds.map(id => {
               const name = staff.find(s => s.id === id)?.name || 'Неизвестно';
               const pts = scanStats[id] || 0;
               const pct = totalScans > 0 ? Math.round((pts / totalScans) * 100) : 0;
               const finalPct = totalScans === 0 && id === currentTask.assignedTo ? 100 : pct;
               return `- ${name}: ${finalPct}% (${pts} ед.)`;
             })
           ].filter(Boolean).join('\n');
           
           addBitrixTaskComment(currentTask.externalTaskId, report);
        }
        updatedOrderTasks[taskIndex] = { ...currentTask, status: statusToApply, notes: newNotes, startedAt: (statusToApply === TaskStatus.IN_PROGRESS && !currentTask.startedAt) ? new Date().toISOString() : currentTask.startedAt, completedAt: statusToApply === TaskStatus.COMPLETED ? new Date().toISOString() : (newStatus === 'RESUME' ? undefined : currentTask.completedAt) };
        if (currentTask.externalTaskId) updateBitrixTaskStatus(currentTask.externalTaskId, newStatus);
      }
      return { ...order, tasks: updatedOrderTasks };
    }));
  };

  const addAccompliceToTask = (orderId: string, taskId: string, userId: string) => {
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order;
      return { ...order, tasks: order.tasks.map(task => {
        if (task.id === taskId) {
           if (!task.assignedTo) {
             if (task.externalTaskId) updateBitrixTask(task.externalTaskId, { RESPONSIBLE_ID: userId });
             return { ...task, assignedTo: userId };
           }
           const currentIds = task.accompliceIds || [];
           if (currentIds.includes(userId)) return task;
           const updatedIds = [...currentIds, userId];
           if (task.externalTaskId) updateBitrixTask(task.externalTaskId, { ACCOMPLICES: updatedIds });
           return { ...task, accompliceIds: updatedIds };
        }
        return task;
      })};
    }));
  };

  const updateTaskDetails = (orderId: string, taskId: string, details: Detail[], packages?: Package[]) => {
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order;
      let updatedTasks = order.tasks.map(task => {
        if (task.id === taskId) return { ...task, details, packages: packages || task.packages };
        return task;
      });
      return { ...order, tasks: updatedTasks };
    }));
  };

  const updateTaskRate = (orderId: string, taskId: string, rate: number) => {
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order;
      return { ...order, tasks: order.tasks.map(task => task.id === taskId ? { ...task, rate } : task) };
    }));
  };

  const removeOrderTask = (orderId: string, taskId: string) => {
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order;
      return { ...order, tasks: order.tasks.filter(t => t.id !== taskId) };
    }));
  };

  if (!user) return <LoginPage onLogin={handleLogin} onRegister={handleRegister} />;
  if (isSiteAdmin) return <SiteAdmin onLogout={handleLogout} orders={orders} staff={staff} companies={[]} config={bitrixConfig} onUpdateUser={updateStaffMember} onSendMessage={() => {}} />;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} onLogout={handleLogout} user={user} bitrixConfig={bitrixConfig} />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm shrink-0 z-10">
          <div className="flex items-center gap-4">
             <h1 className="text-xl font-bold text-slate-800 uppercase tracking-tight">
              {currentPage === 'dashboard' && 'Дашборд'}
              {currentPage === 'planning' && 'Планирование'}
              {currentPage === 'schedule' && 'График работы'}
              {currentPage === 'production' && 'Производство'}
              {currentPage === 'reports' && 'Отчеты'}
              {currentPage === 'salaries' && 'Зарплата'}
              {currentPage === 'users' && 'Сотрудники'}
              {currentPage === 'archive' && 'Архив'}
              {currentPage === 'settings' && 'Настройки'}
            </h1>
            <div className="h-6 w-px bg-slate-200"></div>
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{bitrixConfig.portalName || user.companyName}</span>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={toggleWorkSession}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all shadow-lg shadow-blue-500/10 ${
                activeSession ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-blue-600 text-white hover:bg-blue-700'
              } ${flashShiftBtn ? 'animate-flash-shift' : ''}`}
            >
              {activeSession ? <><LogOut size={16} /> Закончить смену</> : <><LogIn size={16} /> Начать смену</>}
            </button>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-700">{user.name}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                  {user.role === UserRole.COMPANY_ADMIN ? 'Администратор' : (user.isProductionHead ? 'Начальник произв.' : 'Сотрудник')}
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border-2 border-white shadow-sm overflow-hidden">
                {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.name.charAt(0)}
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative bg-slate-50">
          {currentPage === 'dashboard' && <Dashboard orders={orders} staff={staff} />}
          {currentPage === 'planning' && (
            <Planning orders={orders} onAddOrder={() => {}} onSyncBitrix={syncBitrixOrders} onUpdateTaskPlanning={updateTaskPlanning} onUpdateTaskRate={updateTaskRate} isBitrixEnabled={bitrixConfig.enabled} bitrixConfig={bitrixConfig} staff={staff.filter(u => u.isProduction && u.companyId === user.companyId)} shifts={shifts} onDeleteTask={removeOrderTask} />
          )}
          {currentPage === 'schedule' && (
            <Schedule staff={staff.filter(s => s.companyId === user.companyId)} currentUser={user} shifts={shifts} onToggleShift={toggleShift} />
          )}
          {currentPage === 'production' && <ProductionBoard orders={orders.filter(o => o.companyId === user.companyId)} onUpdateTask={updateTaskStatus} onAddAccomplice={addAccompliceToTask} onUpdateDetails={updateTaskDetails} staff={staff.filter(s => s.companyId === user.companyId)} currentUser={user} onAddB24Comment={addBitrixTaskComment} isShiftActive={!!activeSession} shifts={shifts} onTriggerShiftFlash={triggerShiftFlash} />}
          {currentPage === 'reports' && <Reports orders={orders.filter(o => o.companyId === user.companyId)} staff={staff.filter(s => s.companyId === user.companyId)} workSessions={sessions.filter(s => staff.find(st => st.id === s.userId)?.companyId === user.companyId)} />}
          {currentPage === 'salaries' && <Salaries orders={orders.filter(o => o.companyId === user.companyId)} staff={staff.filter(s => s.companyId === user.companyId)} />}
          {currentPage === 'users' && (
            <UsersManagement staff={staff.filter(s => s.companyId === user.companyId)} onSync={syncBitrixUsers} isBitrixEnabled={bitrixConfig.enabled} onToggleProduction={(uid) => updateStaffMember(uid, { isProduction: !staff.find(s => s.id === uid)?.isProduction })} onUpdateStaff={updateStaffMember} />
          )}
          {currentPage === 'archive' && <Archive orders={orders.filter(o => o.companyId === user.companyId)} />}
          {currentPage === 'settings' && <Settings config={bitrixConfig} setConfig={setBitrixConfig} />}
        </div>
      </main>
    </div>
  );
};

export default App;
