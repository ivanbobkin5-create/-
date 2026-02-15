
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
  WorkSession,
  CloudConfig
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
import { dbService } from './dbService';
import { Database, CloudOff, CloudCheck, Loader2 } from 'lucide-react';

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
    enabled: false, 
    apiUrl: '', 
    apiToken: 'MebelPlan_2025_Secure' // Токен по умолчанию совпадает с api.php
  }
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
  
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbStatus, setDbStatus] = useState<'loading' | 'online' | 'offline' | 'local'>('loading');

  useEffect(() => {
    const initData = async () => {
      setDbStatus('loading');
      
      if (bitrixConfig.cloud?.enabled && bitrixConfig.cloud.apiUrl) {
        const cloudData = await dbService.loadFromCloud(bitrixConfig.cloud);
        if (cloudData) {
          setOrders(cloudData.orders || []);
          setStaff(cloudData.staff || []);
          setSessions(cloudData.sessions || []);
          setShifts(cloudData.shifts || {});
          setDbStatus('online');
          
          localStorage.setItem(STORAGE_KEYS.CACHE_ORDERS, JSON.stringify(cloudData.orders || []));
          localStorage.setItem(STORAGE_KEYS.CACHE_STAFF, JSON.stringify(cloudData.staff || []));
          return;
        } else {
          setDbStatus('offline');
        }
      }

      const cachedOrders = JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_ORDERS) || '[]');
      const cachedStaff = JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_STAFF) || '[]');
      const cachedShifts = JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_SHIFTS) || '{}');
      const cachedSessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_SESSIONS) || '[]');
      
      setOrders(cachedOrders);
      setStaff(cachedStaff);
      setShifts(cachedShifts);
      setSessions(cachedSessions);
      if (!bitrixConfig.cloud?.enabled) setDbStatus('local');
    };

    initData();
  }, [bitrixConfig.cloud?.enabled, bitrixConfig.cloud?.apiUrl]);

  const syncWithCloud = useCallback(async () => {
    if (!bitrixConfig.cloud?.enabled || !bitrixConfig.cloud?.apiUrl) {
      localStorage.setItem(STORAGE_KEYS.CACHE_ORDERS, JSON.stringify(orders));
      localStorage.setItem(STORAGE_KEYS.CACHE_STAFF, JSON.stringify(staff));
      localStorage.setItem(STORAGE_KEYS.CACHE_SHIFTS, JSON.stringify(shifts));
      localStorage.setItem(STORAGE_KEYS.CACHE_SESSIONS, JSON.stringify(sessions));
      return;
    }

    setIsSyncing(true);
    const data = { orders, staff, sessions, shifts };
    const result = await dbService.saveToCloud(bitrixConfig.cloud, data);
    
    if (result && result.success) {
      setDbStatus('online');
      localStorage.setItem(STORAGE_KEYS.CACHE_ORDERS, JSON.stringify(orders));
    } else {
      setDbStatus('offline');
    }
    setIsSyncing(false);
  }, [orders, staff, sessions, shifts, bitrixConfig.cloud]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (dbStatus !== 'loading') syncWithCloud();
    }, 2000);
    return () => clearTimeout(timer);
  }, [orders, staff, shifts, sessions, syncWithCloud, dbStatus]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BITRIX_CONFIG, JSON.stringify(bitrixConfig));
  }, [bitrixConfig]);

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEYS.USER);
  }, [user]);

  const addOrder = (order: Order) => {
    setOrders(prev => [...prev, order]);
  };

  const deleteTask = (orderId: string, taskId: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return {
        ...o,
        tasks: o.tasks.filter(t => t.id !== taskId)
      };
    }));
  };

  const updateTaskStatus = (orderId: string, taskId: string, newStatus: TaskStatus | 'RESUME', comment?: string) => {
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order;
      return {
        ...order,
        tasks: order.tasks.map(t => {
          if (t.id !== taskId) return t;
          const status = newStatus === 'RESUME' ? TaskStatus.IN_PROGRESS : newStatus;
          const updates: Partial<Task> = { status };
          if (status === TaskStatus.IN_PROGRESS && !t.startedAt) updates.startedAt = new Date().toISOString();
          if (status === TaskStatus.COMPLETED) updates.completedAt = new Date().toISOString();
          if (comment) updates.notes = (t.notes ? t.notes + '\n' : '') + comment;
          return { ...t, ...updates };
        })
      };
    }));
  };

  const updateTaskPlanning = (orderId: string, taskId: string, date: string | undefined, userId: string | undefined, accompliceIds?: string[]) => {
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order;
      return {
        ...order,
        tasks: order.tasks.map(t => t.id === taskId ? { ...t, plannedDate: date, assignedTo: userId, accompliceIds: accompliceIds || [] } : t)
      };
    }));
  };

  const updateTaskRate = (orderId: string, taskId: string, rate: number) => {
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order;
      return {
        ...order,
        tasks: order.tasks.map(t => t.id === taskId ? { ...t, rate } : t)
      };
    }));
  };

  const updateTaskDetails = (orderId: string, taskId: string, details: Detail[], packages?: Package[]) => {
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order;
      return {
        ...order,
        tasks: order.tasks.map(t => t.id === taskId ? { ...t, details, packages: packages || t.packages } : t)
      };
    }));
  };

  const addAccomplice = (orderId: string, taskId: string, userId: string) => {
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order;
      return {
        ...order,
        tasks: order.tasks.map(t => {
          if (t.id !== taskId) return t;
          const current = t.accompliceIds || [];
          if (current.includes(userId)) return t;
          return { ...t, accompliceIds: [...current, userId] };
        })
      };
    }));
  };

  const updateStaffMember = (userId: string, updates: Partial<User>) => {
    setStaff(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
  };

  const toggleShift = (userId: string, date: string) => {
    setShifts(prev => {
      const userShifts = { ...(prev[userId] || {}) };
      userShifts[date] = !userShifts[date];
      return { ...prev, [userId]: userShifts };
    });
  };

  const activeSession = useMemo(() => {
    if (!user) return null;
    return sessions.find((s) => s.userId === user.id && !s.endTime);
  }, [sessions, user]);

  const toggleWorkSession = () => {
    if (!user) return;
    if (activeSession) {
      setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, endTime: new Date().toISOString() } : s));
    } else {
      const newSession: WorkSession = { 
        id: 'SESS-' + Math.random().toString(36).substr(2, 9), 
        userId: user.id, 
        startTime: new Date().toISOString() 
      };
      setSessions(prev => [...prev, newSession]);
    }
  };

  if (!user) return <LoginPage onLogin={(role, email, pass) => {
    if (role === UserRole.SITE_ADMIN) {
      setUser({ id: 'sa', name: 'Администратор', email: 'admin@system.ru', role: UserRole.SITE_ADMIN });
      return;
    }
    const foundUser = staff.find((s) => s.email?.toLowerCase() === email?.toLowerCase());
    if (foundUser && foundUser.password === pass) {
      setUser(foundUser);
    } else {
      return "Неверный логин или пароль";
    }
  }} onRegister={() => {}} />;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} onLogout={() => setUser(null)} user={user} bitrixConfig={bitrixConfig} />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm z-30">
          <div className="flex items-center gap-4">
             <h1 className="text-xl font-bold uppercase tracking-tight text-slate-800">{currentPage}</h1>
             <div className="h-4 w-px bg-slate-200"></div>
             <div className="flex items-center gap-2">
                {dbStatus === 'loading' && <div className="flex items-center gap-1.5 text-blue-500 animate-pulse"><Loader2 size={14} className="animate-spin"/> <span className="text-[10px] font-black uppercase">Загрузка из облака...</span></div>}
                {dbStatus === 'online' && <div className="flex items-center gap-1.5 text-emerald-500"><CloudCheck size={14}/> <span className="text-[10px] font-black uppercase">Timeweb: OK</span></div>}
                {dbStatus === 'offline' && <div className="flex items-center gap-1.5 text-rose-500"><CloudOff size={14}/> <span className="text-[10px] font-black uppercase">Ошибка связи</span></div>}
                {dbStatus === 'local' && <div className="flex items-center gap-1.5 text-amber-500"><Database size={14}/> <span className="text-[10px] font-black uppercase">Локальный кэш</span></div>}
             </div>
          </div>

          <div className="flex items-center gap-6">
            {isSyncing && <div className="text-[9px] font-black text-blue-500 animate-pulse uppercase tracking-widest">Синхронизация...</div>}
            <button onClick={toggleWorkSession} className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all shadow-lg ${activeSession ? 'bg-rose-50 text-rose-600' : 'bg-blue-600 text-white'}`}>
              {activeSession ? 'Закончить смену' : 'Начать смену'}
            </button>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-semibold">{user.name}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">{user.role}</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 border-2 border-white shadow-sm">{user.name.charAt(0)}</div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {dbStatus === 'loading' && (
            <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-50">
               <Loader2 size={48} className="text-blue-600 animate-spin" />
               <p className="text-xs font-black uppercase tracking-widest text-slate-400">Подключение к облаку Timeweb...</p>
            </div>
          )}
          {dbStatus !== 'loading' && (
            <>
              {currentPage === 'dashboard' && <Dashboard orders={orders} staff={staff} />}
              {currentPage === 'planning' && (
                <Planning 
                  orders={orders} 
                  onAddOrder={addOrder}
                  onSyncBitrix={async () => 0} 
                  onUpdateTaskPlanning={updateTaskPlanning} 
                  onUpdateTaskRate={updateTaskRate} 
                  onDeleteTask={deleteTask}
                  isBitrixEnabled={bitrixConfig.enabled} 
                  bitrixConfig={bitrixConfig} 
                  staff={staff.filter(s => s.isProduction)} 
                  shifts={shifts} 
                />
              )}
              {currentPage === 'schedule' && <Schedule staff={staff} currentUser={user} shifts={shifts} onToggleShift={toggleShift} />}
              {currentPage === 'production' && <ProductionBoard orders={orders} onUpdateTask={updateTaskStatus} onAddAccomplice={addAccomplice} onUpdateDetails={updateTaskDetails} staff={staff} currentUser={user} onAddB24Comment={async () => {}} isShiftActive={!!activeSession} shifts={shifts} onTriggerShiftFlash={() => {}} />}
              {currentPage === 'reports' && <Reports orders={orders} staff={staff} workSessions={sessions} />}
              {currentPage === 'salaries' && <Salaries orders={orders} staff={staff} />}
              {currentPage === 'users' && <UsersManagement staff={staff} onSync={async () => 0} isBitrixEnabled={bitrixConfig.enabled} onToggleProduction={(id) => updateStaffMember(id, { isProduction: !staff.find(s => s.id === id)?.isProduction })} onUpdateStaff={updateStaffMember} />}
              {currentPage === 'settings' && <Settings config={bitrixConfig} setConfig={setBitrixConfig} onExport={() => {}} onImport={() => {}} onClear={() => {}} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
