
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import Settings from './pages/Settings';
import { dbService } from './dbService';
import { NAVIGATION_ITEMS } from './constants';
import { Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';

const STORAGE_KEYS = {
  BITRIX_CONFIG: 'woodplan_bitrix_config',
  USER: 'woodplan_user',
  CACHE_ORDERS: 'woodplan_cache_orders',
  CACHE_STAFF: 'woodplan_cache_staff',
  CACHE_SHIFTS: 'woodplan_cache_shifts',
  CACHE_SESSIONS: 'woodplan_cache_sessions',
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
  },
  cloud: { 
    enabled: true,
    apiUrl: '',
    apiToken: 'MebelPlan_2025_Secure'
  },
  autoShiftEndTime: '20:00'
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER);
    return saved ? JSON.parse(saved) : null;
  });

  const [bitrixConfig, setBitrixConfig] = useState<BitrixConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.BITRIX_CONFIG);
    return saved ? JSON.parse(saved) : INITIAL_BITRIX_CONFIG;
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Record<string, Record<string, boolean>>>({});
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbStatus, setDbStatus] = useState<'loading' | 'ready'>('loading');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const checkAutoCloseSessions = useCallback(() => {
    if (!bitrixConfig.autoShiftEndTime) return;
    
    const [autoH, autoM] = bitrixConfig.autoShiftEndTime.split(':').map(Number);
    const now = new Date();
    let hasChanges = false;

    const updatedSessions = sessions.map(session => {
      if (session.endTime) return session;

      const startTime = new Date(session.startTime);
      const autoCloseTime = new Date(startTime);
      autoCloseTime.setHours(autoH, autoM, 0, 0);

      const isPastAutoClose = now > autoCloseTime;
      const isDifferentDay = now.toDateString() !== startTime.toDateString();

      if (isDifferentDay || isPastAutoClose) {
        hasChanges = true;
        return { ...session, endTime: autoCloseTime.toISOString() };
      }
      return session;
    });

    if (hasChanges) setSessions(updatedSessions);
  }, [sessions, bitrixConfig.autoShiftEndTime]);

  const initData = useCallback(async () => {
    setDbStatus('loading');
    // Всегда пробуем загрузить из облака в первую очередь
    if (bitrixConfig.cloud?.enabled) {
      try {
        const cloudData = await dbService.loadFromCloud(bitrixConfig.cloud);
        if (cloudData) {
          setOrders(cloudData.orders || []);
          setStaff(cloudData.staff || []);
          setSessions(cloudData.sessions || []);
          setShifts(cloudData.shifts || {});
          setDbStatus('ready');
          return;
        }
      } catch (e) {
        console.error("Cloud load failed", e);
      }
    }
    // Если облако недоступно, берем локальный кеш
    setOrders(JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_ORDERS) || '[]'));
    setStaff(JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_STAFF) || '[]'));
    setShifts(JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_SHIFTS) || '{}'));
    setSessions(JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_SESSIONS) || '[]'));
    setDbStatus('ready');
  }, [bitrixConfig.cloud]);

  useEffect(() => { initData(); }, []);

  const syncWithCloud = useCallback(async () => {
    if (dbStatus !== 'ready') return;
    if (bitrixConfig.cloud?.enabled) {
      setIsSyncing(true);
      await dbService.saveToCloud(bitrixConfig.cloud, { orders, staff, sessions, shifts });
      setIsSyncing(false);
    }
    // Дублируем в локалсторидж для надежности
    localStorage.setItem(STORAGE_KEYS.CACHE_ORDERS, JSON.stringify(orders));
    localStorage.setItem(STORAGE_KEYS.CACHE_STAFF, JSON.stringify(staff));
    localStorage.setItem(STORAGE_KEYS.CACHE_SHIFTS, JSON.stringify(shifts));
    localStorage.setItem(STORAGE_KEYS.CACHE_SESSIONS, JSON.stringify(sessions));
  }, [orders, staff, sessions, shifts, bitrixConfig.cloud, dbStatus]);

  useEffect(() => {
    if (dbStatus === 'ready') {
      const timer = setTimeout(() => { syncWithCloud(); }, 2000);
      return () => clearTimeout(timer);
    }
  }, [orders, staff, shifts, sessions, syncWithCloud, dbStatus]);

  const handleSyncBitrix = async () => {
    if (!bitrixConfig.webhookUrl) { showToast("Укажите Webhook URL", "error"); return 0; }
    setIsSyncing(true);
    try {
      const baseUrl = bitrixConfig.webhookUrl.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/crm.deal.list.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter: bitrixConfig.triggerStageIds.length > 0 ? { "STAGE_ID": bitrixConfig.triggerStageIds } : {},
          select: ["ID", "TITLE", "CLOSEDATE", "COMMENTS"]
        })
      });
      const data = await response.json();
      const deals = data.result || [];
      let count = 0;
      const newOrders = [...orders];
      deals.forEach((deal: any) => {
        if (!newOrders.some(o => o.externalId === String(deal.ID))) {
          const orderId = 'ORD-' + Math.random().toString(36).substr(2, 9);
          newOrders.push({
            id: orderId, companyId: 'main', orderNumber: String(deal.ID), clientName: deal.TITLE, deadline: deal.CLOSEDATE || new Date().toISOString().split('T')[0],
            description: deal.COMMENTS || '', priority: 'MEDIUM', createdAt: new Date().toISOString(), externalId: String(deal.ID), source: 'BITRIX24',
            tasks: [ProductionStage.SAWING, ProductionStage.EDGE_BANDING, ProductionStage.DRILLING, ProductionStage.PACKAGING, ProductionStage.SHIPMENT].map(stage => ({
              id: 'TSK-' + Math.random().toString(36).substr(2, 9), orderId, stage, status: TaskStatus.PENDING, details: []
            }))
          });
          count++;
        }
      });
      if (count > 0) setOrders(newOrders);
      setIsSyncing(false);
      showToast(count > 0 ? `Загружено ${count} заказов` : "Новых заказов нет");
      return count;
    } catch (e) { setIsSyncing(false); showToast("Ошибка связи с Б24", "error"); return 0; }
  };

  const handleSyncStaff = async () => {
    if (!bitrixConfig.webhookUrl) return 0;
    setIsSyncing(true);
    try {
      const baseUrl = bitrixConfig.webhookUrl.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/user.get.json`);
      const data = await response.json();
      const b24Users = data.result || [];
      
      let count = 0;
      const newStaff = [...staff];
      
      b24Users.forEach((u: any) => {
        const isActive = u.ACTIVE === true || u.ACTIVE === 'Y';
        if (!isActive) return;

        const b24Id = `U-B24-${u.ID}`;
        const isDuplicate = newStaff.some(s => 
          s.id === b24Id || 
          (u.EMAIL && s.email && s.email.toLowerCase() === u.EMAIL.toLowerCase())
        );

        if (!isDuplicate) {
          newStaff.push({
            id: b24Id, 
            email: u.EMAIL || `user_${u.ID}@bitrix24.ru`, 
            name: `${u.NAME || ''} ${u.LAST_NAME || ''}`.trim() || `Сотрудник B24 #${u.ID}`,
            role: UserRole.EMPLOYEE, 
            isProduction: true, 
            avatar: u.PERSONAL_PHOTO, 
            source: 'BITRIX24',
            password: '123'
          });
          count++;
        }
      });

      if (count > 0) setStaff(newStaff);
      setIsSyncing(false);
      showToast(count > 0 ? `Добавлено ${count} сотрудников` : "Новых активных сотрудников не найдено");
      return count;
    } catch (e) { 
      setIsSyncing(false); 
      showToast("Ошибка импорта сотрудников", "error");
      return 0; 
    }
  };

  const updateTaskStatus = (orderId: string, taskId: string, newStatus: TaskStatus | 'RESUME', comment?: string) => {
    setOrders(prev => prev.map(order => order.id !== orderId ? order : {
      ...order, tasks: order.tasks.map(t => {
        if (t.id !== taskId) return t;
        const status = newStatus === 'RESUME' ? TaskStatus.IN_PROGRESS : newStatus;
        const updates: Partial<Task> = { status };
        if (status === TaskStatus.IN_PROGRESS && !t.startedAt) updates.startedAt = new Date().toISOString();
        if (status === TaskStatus.COMPLETED) updates.completedAt = new Date().toISOString();
        if (comment) updates.notes = (t.notes ? t.notes + '\n' : '') + comment;
        return { ...t, ...updates };
      })
    }));
  };

  const toggleWorkSession = () => {
    if (!user) return;
    const active = sessions.find(s => s.userId === user.id && !s.endTime);
    if (active) {
      setSessions(prev => prev.map(s => s.id === active.id ? { ...s, endTime: new Date().toISOString() } : s));
      showToast("Смена завершена");
    } else {
      setSessions(prev => [...prev, { id: 'SESS-' + Math.random().toString(36).substr(2, 9), userId: user.id, startTime: new Date().toISOString() }]);
      showToast("Смена начата");
    }
  };

  if (dbStatus === 'loading') return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-6"><Loader2 size={48} className="text-blue-500 animate-spin" /><div className="text-center"><h2 className="text-white font-black uppercase text-sm">МебельПлан</h2><p className="text-slate-500 text-xs mt-2 uppercase tracking-widest">Загрузка данных из облака...</p></div></div>;
  
  if (!user) return <LoginPage onLogin={(role, email, pass) => {
    const found = staff.find(s => s.email?.toLowerCase() === email?.toLowerCase());
    if (found && found.password === pass) { setUser(found); localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(found)); }
    else return "Неверный логин или пароль.";
  }} onRegister={(name, email, pass) => {
    const u = { id: 'U-' + Math.random().toString(36).substr(2, 9), email, password: pass, name: 'Администратор', role: UserRole.COMPANY_ADMIN, companyName: name, isProduction: false };
    setStaff(prev => [...prev, u]); setUser(u); localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(u));
  }} />;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} onLogout={() => { setUser(null); localStorage.removeItem(STORAGE_KEYS.USER); }} user={user} bitrixConfig={bitrixConfig} />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm z-30">
          <h1 className="text-xl font-bold uppercase text-slate-800 tracking-tight">{NAVIGATION_ITEMS.find(i => i.id === currentPage)?.label}</h1>
          <div className="flex items-center gap-6">
            {isSyncing && <div className="text-[9px] font-black text-blue-500 animate-pulse uppercase">Синхронизация БД...</div>}
            <button onClick={toggleWorkSession} className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all shadow-lg ${sessions.some(s => s.userId === user.id && !s.endTime) ? 'bg-rose-50 text-rose-600' : 'bg-blue-600 text-white'}`}>
              {sessions.some(s => s.userId === user.id && !s.endTime) ? 'Закончить смену' : 'Начать смену'}
            </button>
            <div className="flex items-center gap-3">
              <div className="text-right"><div className="text-sm font-semibold">{user.name}</div><div className="text-[10px] text-slate-400 font-bold uppercase">{user.role}</div></div>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 border-2 border-white">{user.name.charAt(0)}</div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {currentPage === 'dashboard' && <Dashboard orders={orders} staff={staff} />}
          {currentPage === 'planning' && (
            <Planning 
              orders={orders} 
              onAddOrder={o => setOrders(prev => [...prev, o])} 
              onSyncBitrix={handleSyncBitrix} 
              onUpdateTaskPlanning={(oid, tid, d, uid, aids) => setOrders(prev => prev.map(o => o.id !== oid ? o : { ...o, tasks: o.tasks.map(t => t.id === tid ? { ...t, plannedDate: d, assignedTo: uid, accompliceIds: aids || [] } : t) }))} 
              onUpdateTaskRate={(oid, tid, r) => setOrders(prev => prev.map(o => o.id !== oid ? o : { ...o, tasks: o.tasks.map(t => t.id === tid ? { ...t, rate: r } : t) }))} 
              isBitrixEnabled={bitrixConfig.enabled} 
              staff={staff} 
              shifts={shifts} 
            />
          )}
          {currentPage === 'schedule' && <Schedule staff={staff} currentUser={user} shifts={shifts} onToggleShift={(uid, d) => setShifts(prev => { const us = { ...(prev[uid] || {}) }; us[d] = !us[d]; return { ...prev, [uid]: us }; })} />}
          {currentPage === 'production' && <ProductionBoard orders={orders} onUpdateTask={updateTaskStatus} onAddAccomplice={(oid, tid, uid) => setOrders(prev => prev.map(o => o.id !== oid ? o : { ...o, tasks: o.tasks.map(t => t.id !== tid ? t : { ...t, accompliceIds: [...new Set([...(t.accompliceIds || []), uid])] }) }))} onUpdateDetails={(oid, tid, d, p) => setOrders(prev => prev.map(o => o.id !== oid ? o : { ...o, tasks: o.tasks.map(t => t.id === tid ? { ...t, details: d, packages: p || t.packages } : t) }))} staff={staff} currentUser={user} onAddB24Comment={async () => {}} isShiftActive={!!sessions.find(s => s.userId === user.id && !s.endTime)} shifts={shifts} onTriggerShiftFlash={() => showToast("Начните смену!", "error")} />}
          {currentPage === 'reports' && <Reports orders={orders} staff={staff} workSessions={sessions} />}
          {currentPage === 'salaries' && <Salaries orders={orders} staff={staff} />}
          {currentPage === 'archive' && <Archive orders={orders} />}
          {currentPage === 'users' && <UsersManagement staff={staff} onSync={handleSyncStaff} isBitrixEnabled={bitrixConfig.enabled} onToggleProduction={uid => setStaff(prev => prev.map(u => u.id === uid ? { ...u, isProduction: !u.isProduction } : u))} onUpdateStaff={(uid, upd) => setStaff(prev => prev.map(u => u.id === uid ? { ...u, ...upd } : u))} />}
          {currentPage === 'settings' && <Settings config={bitrixConfig} setConfig={setBitrixConfig} onExport={() => {}} onImport={() => {}} onClear={() => {}} />}
        </div>
      </main>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-toast ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold text-sm">{toast.msg}</span>
          <button onClick={() => setToast(null)}><X size={16}/></button>
        </div>
      )}
    </div>
  );
};

export default App;
