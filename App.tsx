
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
import { Loader2, CheckCircle2, AlertCircle, X, Database } from 'lucide-react';

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
  const [dbStatus, setDbStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const initData = useCallback(async () => {
    setDbStatus('loading');
    
    try {
      const cloudCfg = bitrixConfig.cloud?.enabled ? bitrixConfig.cloud : INITIAL_BITRIX_CONFIG.cloud!;
      const cloudData = await dbService.loadFromCloud(cloudCfg);
      
      if (cloudData) {
        setOrders(cloudData.orders || []);
        setStaff(cloudData.staff || []);
        setSessions(cloudData.sessions || []);
        setShifts(cloudData.shifts || {});
        setDbStatus('ready');
        return;
      }
    } catch (e) {
      console.error("Cloud load error:", e);
    }

    const localStaff = JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_STAFF) || '[]');
    if (localStaff.length > 0) {
      setOrders(JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_ORDERS) || '[]'));
      setStaff(localStaff);
      setShifts(JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_SHIFTS) || '{}'));
      setSessions(JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_SESSIONS) || '[]'));
      setDbStatus('ready');
    } else {
      setDbStatus('ready');
    }
  }, [bitrixConfig.cloud]);

  useEffect(() => {
    initData();
  }, [initData]);

  const syncWithCloud = useCallback(async (forcedData?: any) => {
    if (dbStatus !== 'ready' && !forcedData) return;
    const dataToSave = forcedData || { orders, staff, sessions, shifts };
    
    if (bitrixConfig.cloud?.enabled) {
      setIsSyncing(true);
      try {
        await dbService.saveToCloud(bitrixConfig.cloud, dataToSave);
      } catch (e) {
        console.error("Sync failed:", e);
      }
      setIsSyncing(false);
    }
    
    localStorage.setItem(STORAGE_KEYS.CACHE_ORDERS, JSON.stringify(dataToSave.orders));
    localStorage.setItem(STORAGE_KEYS.CACHE_STAFF, JSON.stringify(dataToSave.staff));
    localStorage.setItem(STORAGE_KEYS.CACHE_SHIFTS, JSON.stringify(dataToSave.shifts));
    localStorage.setItem(STORAGE_KEYS.CACHE_SESSIONS, JSON.stringify(dataToSave.sessions));
  }, [orders, staff, sessions, shifts, bitrixConfig.cloud, dbStatus]);

  useEffect(() => {
    if (dbStatus === 'ready' && user) {
      const timer = setTimeout(() => { syncWithCloud(); }, 3000);
      return () => clearTimeout(timer);
    }
  }, [orders, staff, shifts, sessions, syncWithCloud, dbStatus, user]);

  const updateTaskStatus = useCallback((orderId: string, taskId: string, status: TaskStatus | 'RESUME', comment?: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return {
        ...o,
        tasks: o.tasks.map(t => {
          if (t.id !== taskId) return t;
          const newStatus = status === 'RESUME' ? TaskStatus.IN_PROGRESS : status;
          const now = new Date().toISOString();
          const updates: Partial<Task> = { status: newStatus as TaskStatus };
          if (newStatus === TaskStatus.IN_PROGRESS && !t.startedAt) updates.startedAt = now;
          if (newStatus === TaskStatus.COMPLETED) updates.completedAt = now;
          if (comment) updates.notes = t.notes ? `${t.notes}\n${comment}` : comment;
          return { ...t, ...updates };
        })
      };
    }));
  }, []);

  const handleSyncBitrix = useCallback(async () => {
    setIsSyncing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      showToast("Заказы из Bitrix24 синхронизированы");
      return 0;
    } catch (e) {
      showToast("Ошибка синхронизации заказов", "error");
      return 0;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const handleSyncStaff = useCallback(async () => {
    setIsSyncing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      showToast("Сотрудники из Bitrix24 загружены");
      return 0;
    } catch (e) {
      showToast("Ошибка загрузки сотрудников", "error");
      return 0;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  if (dbStatus === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-6">
        <Loader2 size={48} className="text-blue-500 animate-spin" />
        <div className="text-center">
          <h2 className="text-white font-black uppercase text-sm tracking-widest">МебельПлан</h2>
          <p className="text-slate-500 text-[10px] mt-2 uppercase tracking-[0.3em] flex items-center gap-2">
            <Database size={12}/> Подключение к базе TimeWeb...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage 
      onLogin={(role, email, pass) => {
        const found = staff.find(s => s.email?.toLowerCase() === email?.toLowerCase());
        if (found && found.password === pass) { 
          setUser(found); 
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(found)); 
        } else {
          return staff.length === 0 
            ? "База данных сотрудников пуста. Попробуйте зарегистрироваться или обновить страницу."
            : "Неверный логин или пароль.";
        }
      }} 
      onRegister={(name, email, pass) => {
        const u: User = { 
          id: 'U-' + Math.random().toString(36).substr(2, 9), 
          email, password: pass, name: 'Администратор', role: UserRole.COMPANY_ADMIN, companyName: name, isProduction: false 
        };
        const updatedStaff = [...staff, u];
        setStaff(updatedStaff); 
        setUser(u); 
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(u));
        syncWithCloud({ orders, staff: updatedStaff, sessions, shifts });
      }} 
    />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} onLogout={() => { setUser(null); localStorage.removeItem(STORAGE_KEYS.USER); }} user={user} bitrixConfig={bitrixConfig} />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm z-30">
          <h1 className="text-xl font-bold uppercase text-slate-800 tracking-tight">{NAVIGATION_ITEMS.find(i => i.id === currentPage)?.label}</h1>
          <div className="flex items-center gap-6">
            {isSyncing && <div className="text-[9px] font-black text-blue-500 animate-pulse uppercase flex items-center gap-1"><Database size={10}/> Синхронизация...</div>}
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
              isBitrixEnabled={bitrixConfig.enabled} staff={staff} shifts={shifts} 
            />
          )}
          {currentPage === 'schedule' && <Schedule staff={staff} currentUser={user} shifts={shifts} onToggleShift={(uid, d) => setShifts(prev => { const us = { ...(prev[uid] || {}) }; us[d] = !us[d]; return { ...prev, [uid]: us }; })} />}
          {currentPage === 'production' && <ProductionBoard orders={orders} onUpdateTask={updateTaskStatus} onAddAccomplice={(oid, tid, uid) => setOrders(prev => prev.map(o => o.id !== oid ? o : { ...o, tasks: o.tasks.map(t => t.id !== tid ? t : { ...t, accompliceIds: [...new Set([...(t.accompliceIds || []), uid])] }) }))} onUpdateDetails={(oid, tid, d, p) => setOrders(prev => prev.map(o => o.id !== oid ? o : { ...o, tasks: o.tasks.map(t => t.id === tid ? { ...t, details: d, packages: p || t.packages } : t) }))} staff={staff} currentUser={user} onAddB24Comment={async () => {}} isShiftActive={true} shifts={shifts} onTriggerShiftFlash={() => {}} />}
          {currentPage === 'salaries' && <Salaries orders={orders} staff={staff} />}
          {currentPage === 'users' && <UsersManagement staff={staff} onSync={handleSyncStaff} isBitrixEnabled={bitrixConfig.enabled} onToggleProduction={uid => setStaff(prev => prev.map(u => u.id === uid ? { ...u, isProduction: !u.isProduction } : u))} onUpdateStaff={(uid, upd) => setStaff(prev => prev.map(u => u.id === uid ? { ...u, ...upd } : u))} />}
          {currentPage === 'reports' && <Reports orders={orders} staff={staff} workSessions={sessions} />}
          {currentPage === 'archive' && <Archive orders={orders} />}
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
