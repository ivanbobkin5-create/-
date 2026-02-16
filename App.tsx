
import React, { useState, useEffect, useCallback } from 'react';
import { 
  User, 
  UserRole, 
  Order, 
  ProductionStage, 
  TaskStatus, 
  BitrixConfig,
  Task,
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
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbStatus, setDbStatus] = useState<'loading' | 'ready'>('loading');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const syncWithCloud = useCallback(async (forcedData?: any) => {
    const cloudCfg = bitrixConfig.cloud || INITIAL_BITRIX_CONFIG.cloud!;
    const dataToSave = forcedData || { orders, staff, sessions, shifts };
    setIsSyncing(true);
    try {
      await dbService.saveToCloud(cloudCfg, dataToSave);
    } catch (e) {
      console.error("Save to cloud failed", e);
    }
    setIsSyncing(false);
  }, [orders, staff, sessions, shifts, bitrixConfig.cloud]);

  // Загрузка данных при входе/старте
  const initData = useCallback(async () => {
    setDbStatus('loading');
    const cloudCfg = bitrixConfig.cloud || INITIAL_BITRIX_CONFIG.cloud!;
    try {
      const cloudData = await dbService.loadFromCloud(cloudCfg);
      if (cloudData) {
        setOrders(cloudData.orders || []);
        setStaff(cloudData.staff || []);
        setSessions(cloudData.sessions || []);
        setShifts(cloudData.shifts || {});
      }
      setDbStatus('ready');
    } catch (e) {
      setDbStatus('ready'); // Все равно пускаем к логину
    }
  }, [bitrixConfig.cloud]);

  useEffect(() => {
    if (user) initData();
    else setDbStatus('ready');
  }, [user, initData]);

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

  if (dbStatus === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-6">
        <Loader2 size={48} className="text-blue-500 animate-spin" />
        <div className="text-center">
          <h2 className="text-white font-black uppercase text-sm tracking-widest">МебельПлан</h2>
          <p className="text-slate-500 text-[10px] mt-2 uppercase tracking-[0.3em] flex items-center justify-center gap-2">
            <Database size={12}/> Синхронизация...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage 
      onLogin={async (role, email, pass) => {
        if (!email || !pass) return "Введите e-mail и пароль";
        
        const result = await dbService.login(email, pass);
        
        if (result.success && result.user) {
          // Если логин успешен, сразу ставим все данные из ответа сервера
          const data = result.payload;
          if (data) {
            setOrders(data.orders || []);
            setStaff(data.staff || []);
            setSessions(data.sessions || []);
            setShifts(data.shifts || {});
          }
          setUser(result.user);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(result.user));
          return;
        } else {
          return result.message || "Ошибка входа";
        }
      }} 
      onRegister={async (name, email, pass) => {
        const u: User = { 
          id: 'U-' + Math.random().toString(36).substr(2, 9), 
          email, password: pass, name: 'Администратор', role: UserRole.COMPANY_ADMIN, companyName: name, isProduction: false 
        };
        const updatedStaff = [u];
        setStaff(updatedStaff); 
        setUser(u); 
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(u));
        await dbService.saveToCloud(bitrixConfig.cloud!, { orders: [], staff: updatedStaff, sessions: [], shifts: {} });
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
              onAddOrder={o => { setOrders(prev => [...prev, o]); syncWithCloud(); }} 
              onSyncBitrix={async () => 0} 
              onUpdateTaskPlanning={(oid, tid, d, uid, aids) => {
                const updated = orders.map(o => o.id !== oid ? o : { ...o, tasks: o.tasks.map(t => t.id === tid ? { ...t, plannedDate: d, assignedTo: uid, accompliceIds: aids || [] } : t) });
                setOrders(updated);
                syncWithCloud({ orders: updated, staff, sessions, shifts });
              }} 
              onUpdateTaskRate={(oid, tid, r) => {
                const updated = orders.map(o => o.id !== oid ? o : { ...o, tasks: o.tasks.map(t => t.id === tid ? { ...t, rate: r } : t) });
                setOrders(updated);
                syncWithCloud({ orders: updated, staff, sessions, shifts });
              }} 
              isBitrixEnabled={bitrixConfig.enabled} staff={staff} shifts={shifts} 
            />
          )}
          {currentPage === 'schedule' && <Schedule staff={staff} currentUser={user} shifts={shifts} onToggleShift={(uid, d) => {
            const updatedShifts = { ...shifts };
            if (!updatedShifts[uid]) updatedShifts[uid] = {};
            updatedShifts[uid][d] = !updatedShifts[uid][d];
            setShifts(updatedShifts);
            syncWithCloud({ orders, staff, sessions, shifts: updatedShifts });
          }} />}
          {currentPage === 'production' && <ProductionBoard orders={orders} onUpdateTask={(oid, tid, st, comm) => { updateTaskStatus(oid, tid, st, comm); syncWithCloud(); }} onAddAccomplice={(oid, tid, uid) => {
            const updated = orders.map(o => o.id !== oid ? o : { ...o, tasks: o.tasks.map(t => t.id !== tid ? t : { ...t, accompliceIds: [...new Set([...(t.accompliceIds || []), uid])] }) });
            setOrders(updated);
            syncWithCloud({ orders: updated, staff, sessions, shifts });
          }} onUpdateDetails={(oid, tid, d, p) => {
            const updated = orders.map(o => o.id !== oid ? o : { ...o, tasks: o.tasks.map(t => t.id === tid ? { ...t, details: d, packages: p || t.packages } : t) });
            setOrders(updated);
            syncWithCloud({ orders: updated, staff, sessions, shifts });
          }} staff={staff} currentUser={user} onAddB24Comment={async () => {}} isShiftActive={true} shifts={shifts} onTriggerShiftFlash={() => {}} />}
          {currentPage === 'salaries' && <Salaries orders={orders} staff={staff} />}
          {currentPage === 'users' && <UsersManagement staff={staff} onSync={async () => 0} isBitrixEnabled={bitrixConfig.enabled} onToggleProduction={uid => {
            const updated = staff.map(u => u.id === uid ? { ...u, isProduction: !u.isProduction } : u);
            setStaff(updated);
            syncWithCloud({ orders, staff: updated, sessions, shifts });
          }} onUpdateStaff={(uid, upd) => {
            const updated = staff.map(u => u.id === uid ? { ...u, ...upd } : u);
            setStaff(updated);
            syncWithCloud({ orders, staff: updated, sessions, shifts });
          }} />}
          {currentPage === 'reports' && <Reports orders={orders} staff={staff} workSessions={sessions} />}
          {currentPage === 'archive' && <Archive orders={orders} />}
          {currentPage === 'settings' && <Settings config={bitrixConfig} setConfig={c => { setBitrixConfig(c); localStorage.setItem(STORAGE_KEYS.BITRIX_CONFIG, JSON.stringify(c)); }} onExport={() => {}} onImport={() => {}} onClear={() => {}} />}
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
