
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
import { Loader2 } from 'lucide-react';

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
  const [dbStatus, setDbStatus] = useState<'loading' | 'ready'>('loading');

  const initData = useCallback(async () => {
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

    const cachedOrders = JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_ORDERS) || '[]');
    const cachedStaff = JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_STAFF) || '[]');
    const cachedShifts = JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_SHIFTS) || '{}');
    const cachedSessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_SESSIONS) || '[]');
    
    setOrders(cachedOrders);
    setStaff(cachedStaff);
    setShifts(cachedShifts);
    setSessions(cachedSessions);
    setDbStatus('ready');
  }, [bitrixConfig.cloud]);

  useEffect(() => {
    initData();
  }, [initData]);

  const syncWithCloud = useCallback(async () => {
    if (!bitrixConfig.cloud?.enabled) {
      localStorage.setItem(STORAGE_KEYS.CACHE_ORDERS, JSON.stringify(orders));
      localStorage.setItem(STORAGE_KEYS.CACHE_STAFF, JSON.stringify(staff));
      localStorage.setItem(STORAGE_KEYS.CACHE_SHIFTS, JSON.stringify(shifts));
      localStorage.setItem(STORAGE_KEYS.CACHE_SESSIONS, JSON.stringify(sessions));
      return;
    }

    setIsSyncing(true);
    const data = { orders, staff, sessions, shifts };
    await dbService.saveToCloud(bitrixConfig.cloud, data);
    setIsSyncing(false);
  }, [orders, staff, sessions, shifts, bitrixConfig.cloud]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (dbStatus === 'ready') syncWithCloud();
    }, 2000);
    return () => clearTimeout(timer);
  }, [orders, staff, shifts, sessions, syncWithCloud, dbStatus]);

  const handleSyncBitrix = async () => {
    if (!bitrixConfig.webhookUrl) {
      alert("Настройте Webhook URL в настройках");
      return 0;
    }
    setIsSyncing(true);
    try {
      const url = bitrixConfig.webhookUrl.replace(/\/$/, '') + '/crm.deal.list.json';
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter: { "STAGE_ID": bitrixConfig.triggerStageIds },
          select: ["ID", "TITLE", "CLOSEDATE", "COMMENTS", "CATEGORY_ID", "STAGE_ID"]
        })
      });
      const data = await response.json();
      const deals = data.result || [];
      
      let importedCount = 0;
      const newOrders = [...orders];

      deals.forEach((deal: any) => {
        if (!newOrders.some(o => o.externalId === String(deal.ID))) {
          const orderId = 'ORD-' + Math.random().toString(36).substr(2, 9);
          const order: Order = {
            id: orderId,
            companyId: 'main',
            orderNumber: String(deal.ID),
            clientName: deal.TITLE || 'Без названия',
            deadline: deal.CLOSEDATE || new Date().toISOString().split('T')[0],
            description: deal.COMMENTS || '',
            priority: 'MEDIUM',
            createdAt: new Date().toISOString(),
            externalId: String(deal.ID),
            source: 'BITRIX24',
            tasks: [
              ProductionStage.SAWING, 
              ProductionStage.EDGE_BANDING, 
              ProductionStage.DRILLING, 
              ProductionStage.PACKAGING, 
              ProductionStage.SHIPMENT
            ].map(stage => ({
              id: 'TSK-' + Math.random().toString(36).substr(2, 9),
              orderId: orderId,
              stage,
              status: TaskStatus.PENDING,
              details: []
            }))
          };
          newOrders.push(order);
          importedCount++;
        }
      });

      if (importedCount > 0) setOrders(newOrders);
      setIsSyncing(false);
      return importedCount;
    } catch (e) {
      console.error(e);
      setIsSyncing(false);
      return 0;
    }
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

  const handleRegister = (companyName: string, email: string, pass: string) => {
    if (staff.some(s => s.email.toLowerCase() === email.toLowerCase())) {
      return "Пользователь с таким email уже существует";
    }
    const newUser: User = {
      id: 'U-' + Math.random().toString(36).substr(2, 9),
      email: email,
      password: pass,
      name: 'Администратор',
      role: UserRole.COMPANY_ADMIN,
      companyName: companyName,
      isProduction: false,
      source: 'MANUAL'
    };
    setStaff(prev => [...prev, newUser]);
    setUser(newUser);
  };

  if (dbStatus === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-6">
        <Loader2 size={48} className="text-blue-500 animate-spin" />
        <div className="text-center">
          <h2 className="text-white font-black uppercase tracking-widest text-sm">МебельПлан</h2>
          <p className="text-slate-500 text-[10px] uppercase font-bold mt-2">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage onLogin={(role, email, pass) => {
    if (role === UserRole.SITE_ADMIN) {
      setUser({ id: 'sa', name: 'Администратор', email: 'admin@system.ru', role: UserRole.SITE_ADMIN });
      return;
    }
    const foundUser = staff.find((s) => s.email?.toLowerCase() === email?.toLowerCase());
    if (foundUser && foundUser.password === pass) setUser(foundUser);
    else return "Неверный логин или пароль.";
  }} onRegister={handleRegister} />;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} onLogout={() => setUser(null)} user={user} bitrixConfig={bitrixConfig} />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm z-30">
          <div className="flex items-center gap-4">
             <h1 className="text-xl font-bold uppercase tracking-tight text-slate-800">{currentPage}</h1>
          </div>

          <div className="flex items-center gap-6">
            {isSyncing && <div className="text-[9px] font-black text-blue-500 animate-pulse uppercase tracking-widest">Обмен данными...</div>}
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
          {currentPage === 'dashboard' && <Dashboard orders={orders} staff={staff} />}
          {currentPage === 'planning' && (
            <Planning 
              orders={orders} 
              onAddOrder={(order) => setOrders(prev => [...prev, order])}
              onSyncBitrix={handleSyncBitrix} 
              onUpdateTaskPlanning={updateTaskPlanning} 
              onUpdateTaskRate={updateTaskRate} 
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
        </div>
      </main>
    </div>
  );
};

export default App;
