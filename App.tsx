
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
import SiteAdmin from './pages/SiteAdmin';
import Settings from './pages/Settings';
import { dbService } from './dbService';
import { NAVIGATION_ITEMS, STAGE_CONFIG } from './constants';
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
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Failed to parse user from localStorage", e);
      return null;
    }
  });

  const [bitrixConfig, setBitrixConfig] = useState<BitrixConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BITRIX_CONFIG);
      return saved ? JSON.parse(saved) : INITIAL_BITRIX_CONFIG;
    } catch (e) {
      console.error("Failed to parse bitrixConfig from localStorage", e);
      return INITIAL_BITRIX_CONFIG;
    }
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Record<string, Record<string, boolean>>>({});
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbStatus, setDbStatus] = useState<'loading' | 'ready'>('loading');
  const [hasAttemptedInitialLoad, setHasAttemptedInitialLoad] = useState(false);
  const isInitialLoading = React.useRef(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const syncWithCloud = useCallback(async (forcedData?: any) => {
    if (!user) return;
    
    if (user.role === UserRole.SITE_ADMIN) return;

    const cloudCfg = bitrixConfig.cloud || INITIAL_BITRIX_CONFIG.cloud!;
    const dataToSave = forcedData || { orders, staff, sessions, shifts, bitrixConfig };
    
    setIsSyncing(true);
    try {
      const success = await dbService.saveToCloud(cloudCfg, dataToSave, user.companyId);
      if (success) {
        setLastSaved(new Date().toLocaleTimeString());
        setIsDirty(false);
      } else {
        showToast("Ошибка сохранения", "error");
      }
    } catch (e) {
      console.error("Save to cloud failed", e);
      showToast("Ошибка сети", "error");
    } finally {
      setIsSyncing(false);
    }
  }, [orders, staff, sessions, shifts, bitrixConfig.cloud, user]);

  // Авто-синхронизация при изменениях (с задержкой 2 секунды)
  useEffect(() => {
    if (dbStatus === 'ready' && user && user.role !== UserRole.SITE_ADMIN && isDirty) {
      const timer = setTimeout(() => {
        syncWithCloud();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isDirty, user, dbStatus, syncWithCloud]);

  const loadDataIfLoggedIn = useCallback(async (silent = false) => {
    if (!user || user.role === UserRole.SITE_ADMIN) {
      setDbStatus('ready');
      return;
    }
    
    if (isInitialLoading.current && !silent) return;
    if (!silent) {
      isInitialLoading.current = true;
      setDbStatus('loading');
    }

    const cloudCfg = bitrixConfig.cloud || INITIAL_BITRIX_CONFIG.cloud!;
    try {
      const cloudData = await dbService.loadFromCloud(cloudCfg, user.companyId);
      if (cloudData) {
        if (cloudData.orders) setOrders(cloudData.orders);
        if (cloudData.staff) setStaff(cloudData.staff);
        if (cloudData.sessions) setSessions(cloudData.sessions);
        if (cloudData.shifts) setShifts(cloudData.shifts);
        
        if (cloudData.bitrixConfig) {
          setBitrixConfig(cloudData.bitrixConfig);
          localStorage.setItem(STORAGE_KEYS.BITRIX_CONFIG, JSON.stringify(cloudData.bitrixConfig));
        }
        setLastSaved(new Date().toLocaleTimeString());
        setIsDirty(false);
      }
    } catch (e) {
      console.error("Load from cloud failed", e);
    } finally {
      if (!silent) {
        isInitialLoading.current = false;
        setHasAttemptedInitialLoad(true);
      }
      setDbStatus('ready');
    }
  }, [user?.id, user?.companyId, bitrixConfig.cloud?.apiToken, bitrixConfig.cloud?.enabled]);

  // Initial load effect
  useEffect(() => {
    if (user && !hasAttemptedInitialLoad && !isInitialLoading.current) {
      loadDataIfLoggedIn();
    } else if (!user) {
      setDbStatus('ready');
      setHasAttemptedInitialLoad(false);
    }
  }, [user, hasAttemptedInitialLoad, loadDataIfLoggedIn]);

  // Background sync effect
  useEffect(() => {
    if (!user || user.role === UserRole.SITE_ADMIN) return;

    const interval = setInterval(() => {
      if (!isSyncing && !isDirty) {
        loadDataIfLoggedIn(true);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user, isSyncing, isDirty, loadDataIfLoggedIn]);


  const syncTaskToBitrix = useCallback(async (order: Order, task: Task): Promise<string | undefined> => {
    if (!bitrixConfig.enabled || !bitrixConfig.webhookUrl || !order.externalId) return task.externalTaskId;
    
    try {
      const baseUrl = bitrixConfig.webhookUrl.replace(/\/$/, '');
      const stageLabel = STAGE_CONFIG[task.stage].label;
      const taskTitle = `${stageLabel} | ${order.clientName}`;
      
      const mainAssignee = staff.find(s => s.id === task.assignedTo);
      const accomplices = (task.accompliceIds || []).map(id => staff.find(s => s.id === id)?.b24Id).filter(Boolean);

      const fields: any = {
        ACCOMPLICES: accomplices
      };
      if (task.plannedDate) {
        fields.DEADLINE = `${task.plannedDate}T18:00:00`;
      }
      if (mainAssignee?.b24Id) {
        fields.RESPONSIBLE_ID = mainAssignee.b24Id;
      }

      if (task.externalTaskId) {
        await fetch('/api/b24-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: `${baseUrl}/tasks.task.update.json`,
            method: 'POST',
            body: {
              taskId: task.externalTaskId,
              fields
            }
          })
        });
        console.log(`Updated Bitrix24 task ${task.externalTaskId} for deal ${order.externalId}`);
        return task.externalTaskId;
      } else {
        // Check if task already exists in the deal
        const stageConfig = STAGE_CONFIG[task.stage];
        const stageLabel = stageConfig.label;
        const keywords = stageConfig.keywords || [stageLabel.toLowerCase()];

        const listResponse = await fetch('/api/b24-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: `${baseUrl}/tasks.task.list.json`,
            method: 'POST',
            body: {
              filter: { "UF_CRM_TASK": [`D_${order.externalId}`] },
              select: ["ID", "TITLE"]
            }
          })
        });
        const listData = await listResponse.json();
        const b24Tasks = Array.isArray(listData.result) ? listData.result : (listData.result?.tasks || []);
        
        const existingTask = b24Tasks.find((bt: any) => {
          const title = (bt.TITLE || '').toLowerCase();
          return title.includes(stageLabel.toLowerCase()) || keywords.some(k => title.includes(k));
        });

        if (existingTask) {
          const b24TaskId = String(existingTask.ID || existingTask.id);
          await fetch('/api/b24-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: `${baseUrl}/tasks.task.update.json`,
              method: 'POST',
              body: {
                taskId: b24TaskId,
                fields
              }
            })
          });
          setOrders(prev => prev.map(o => o.id !== order.id ? o : {
            ...o,
            tasks: o.tasks.map(t => t.id === task.id ? { ...t, externalTaskId: b24TaskId } : t)
          }));
          setIsDirty(true);
          console.log(`Updated existing Bitrix24 task ${b24TaskId} for deal ${order.externalId}`);
          return b24TaskId;
        } else {
          const createFields = {
            ...fields,
            TITLE: taskTitle,
            UF_CRM_TASK: [`D_${order.externalId}`],
            RESPONSIBLE_ID: fields.RESPONSIBLE_ID || user?.b24Id
          };
          const response = await fetch('/api/b24-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: `${baseUrl}/tasks.task.add.json`,
              method: 'POST',
              body: { fields: createFields }
            })
          });
          const data = await response.json();
          if (data.result?.task?.id) {
            const b24TaskId = String(data.result.task.id);
            setOrders(prev => prev.map(o => o.id !== order.id ? o : {
              ...o,
              tasks: o.tasks.map(t => t.id === task.id ? { ...t, externalTaskId: b24TaskId } : t)
            }));
            setIsDirty(true);
            console.log(`Created Bitrix24 task ${b24TaskId} for deal ${order.externalId}`);
            return b24TaskId;
          }
        }
      }
    } catch (e) {
      console.error("Failed to sync task to Bitrix24", e);
    }
    return undefined;
  }, [bitrixConfig, staff, user]);

  const syncTaskActionToBitrix = useCallback(async (order: Order, task: Task, currentUser: User, action: 'start' | 'pause' | 'complete', comment?: string) => {
    if (!bitrixConfig.enabled || !bitrixConfig.webhookUrl) return;
    
    try {
      let taskId = task.externalTaskId;
      if (!taskId) {
        taskId = await syncTaskToBitrix(order, task);
      }
      if (!taskId) return;

      const baseUrl = bitrixConfig.webhookUrl.replace(/\/$/, '');

      let method = '';
      if (action === 'start') method = 'tasks.task.start.json';
      if (action === 'pause') method = 'tasks.task.pause.json';
      if (action === 'complete') method = 'tasks.task.complete.json';

      if (method) {
        await fetch('/api/b24-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: `${baseUrl}/${method}`,
            method: 'POST',
            body: { taskId }
          })
        });
        console.log(`Synced task ${action} for task ${taskId} to Bitrix24.`);
      }

      if (comment) {
        await fetch('/api/b24-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: `${baseUrl}/task.commentitem.add.json`,
            method: 'POST',
            body: {
              taskId,
              fields: {
                POST_MESSAGE: `[b]${currentUser.name}[/b]: ${comment}`
              }
            }
          })
        });
        console.log(`Added comment to task ${taskId} in Bitrix24.`);
      }
    } catch (e) {
      console.error(`Failed to sync task ${action} to Bitrix24`, e);
    }
  }, [bitrixConfig, syncTaskToBitrix]);

  const onAddB24Comment = useCallback(async (taskId: string, message: string) => {
    if (!bitrixConfig.enabled || !bitrixConfig.webhookUrl) return;
    try {
      const baseUrl = bitrixConfig.webhookUrl.replace(/\/$/, '');
      await fetch('/api/b24-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${baseUrl}/task.commentitem.add.json`,
          method: 'POST',
          body: {
            taskId,
            fields: {
              POST_MESSAGE: `[b]${user?.name || 'Система'}[/b]: ${message}`
            }
          }
        })
      });
      console.log(`Added comment to task ${taskId} in Bitrix24.`);
    } catch (e) {
      console.error("Failed to add comment to Bitrix24", e);
    }
  }, [bitrixConfig, user]);

    const updateTaskStatus = useCallback((orderId: string, taskId: string, status: TaskStatus | 'RESUME', comment?: string) => {
      setOrders(prev => {
        let updatedTask: Task | undefined;
        let updatedOrder: Order | undefined;

        const newOrders = prev.map(o => {
          if (o.id !== orderId) return o;
          const newTasks = o.tasks.map(t => {
            if (t.id !== taskId) return t;
            const newStatus = status === 'RESUME' ? TaskStatus.IN_PROGRESS : status;
            const now = new Date().toISOString();
            const updates: Partial<Task> = { status: newStatus as TaskStatus };
            if (newStatus === TaskStatus.IN_PROGRESS && !t.startedAt) updates.startedAt = now;
            if (newStatus === TaskStatus.COMPLETED) updates.completedAt = now;
            if (comment) updates.notes = t.notes ? `${t.notes}\n${comment}` : comment;
            updatedTask = { ...t, ...updates };
            return updatedTask;
          });
          updatedOrder = { ...o, tasks: newTasks };
          return updatedOrder;
        });

        // Side effect: Sync with Bitrix24
        if (bitrixConfig.enabled && updatedOrder && updatedTask && user) {
          if (status === TaskStatus.IN_PROGRESS || status === 'RESUME') {
            syncTaskActionToBitrix(updatedOrder, updatedTask, user, 'start');
          } else if (status === TaskStatus.PAUSED) {
            syncTaskActionToBitrix(updatedOrder, updatedTask, user, 'pause', comment);
          } else if (status === TaskStatus.COMPLETED) {
            syncTaskActionToBitrix(updatedOrder, updatedTask, user, 'complete', comment);
          }
        }

        return newOrders;
      });
    }, [user, bitrixConfig.enabled, syncTaskActionToBitrix]);



    const onUpdateTaskPlanning = useCallback(async (orderId: string, taskId: string, date: string | undefined, userId: string | undefined, accompliceIds?: string[]) => {
      let updatedTask: Task | undefined;
      let updatedOrder: Order | undefined;

      setOrders(prev => {
        return prev.map(o => {
          if (o.id !== orderId) return o;
          const newTasks = o.tasks.map(t => {
            if (t.id !== taskId) return t;
            const ut = { ...t, plannedDate: date, assignedTo: userId, accompliceIds: accompliceIds || [] };
            updatedTask = ut;
            return ut;
          });
          const uo = { ...o, tasks: newTasks };
          updatedOrder = uo;
          return uo;
        });
      });

      setIsDirty(true);

      // Perform sync outside of setOrders to avoid state issues
      if (bitrixConfig.enabled && updatedOrder && updatedTask) {
        await syncTaskToBitrix(updatedOrder, updatedTask);
      }
    }, [syncTaskToBitrix, bitrixConfig.enabled]);

  if (dbStatus === 'loading' && user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-6">
        <Loader2 size={48} className="text-blue-500 animate-spin" />
        <div className="text-center">
          <h2 className="text-white font-black uppercase text-sm tracking-widest">МебельПлан</h2>
          <p className="text-slate-500 text-[10px] mt-2 uppercase tracking-[0.3em] flex items-center justify-center gap-2">
            <Database size={12}/> Загрузка данных предприятия...
          </p>
        </div>
      </div>
    );
  }

  const onSyncBitrix = async () => {
    if (!bitrixConfig.enabled || !bitrixConfig.webhookUrl || !user) return 0;
    
    try {
      const baseUrl = bitrixConfig.webhookUrl.replace(/\/$/, '');
      const triggerStages = bitrixConfig.triggerStageIds || [];
      
      if (triggerStages.length === 0) {
        showToast('Выберите стадии в настройках', 'error');
        return 0;
      }

      const response = await fetch('/api/b24-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${baseUrl}/crm.deal.list.json`,
          method: 'POST',
          body: {
            filter: { "STAGE_ID": triggerStages },
            select: ["ID", "TITLE", "CLOSEDATE", "ADDITIONAL_INFO", "COMMENTS"]
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Ошибка CRM");
      
      const deals = Array.isArray(data.result) ? data.result : [];
      const updatedOrders = [...orders];
      let importedCount = 0;

      for (const deal of deals) {
        const dealId = String(deal.ID);
        
        // Fetch tasks for this deal to sync status
        const tasksResponse = await fetch('/api/b24-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: `${baseUrl}/tasks.task.list.json`,
            method: 'POST',
            body: {
              filter: { "UF_CRM_TASK": [`D_${dealId}`] },
              select: ["ID", "TITLE", "REAL_STATUS"]
            }
          })
        });
        const tasksData = await tasksResponse.json();
        const b24Tasks = Array.isArray(tasksData.result) ? tasksData.result : (tasksData.result?.tasks || []);

        const existingOrderIndex = updatedOrders.findIndex(o => o.externalId === dealId);
        
        if (existingOrderIndex !== -1) {
          // Update existing order tasks status from B24
          const order = updatedOrders[existingOrderIndex];
          updatedOrders[existingOrderIndex] = {
            ...order,
            tasks: order.tasks.map(t => {
              const stageConfig = STAGE_CONFIG[t.stage];
              const stageLabel = stageConfig.label;
              const keywords = stageConfig.keywords || [stageLabel.toLowerCase()];
              
              const b24Task = b24Tasks.find((bt: any) => {
                const title = (bt.TITLE || '').toLowerCase();
                return title.includes(stageLabel.toLowerCase()) || keywords.some(k => title.includes(k));
              });

              if (b24Task) {
                const b24Status = parseInt(b24Task.REAL_STATUS);
                const b24Id = String(b24Task.ID || b24Task.id);
                let newStatus = t.status;
                if (b24Status >= 4) newStatus = TaskStatus.COMPLETED;
                else if (b24Status === 3) newStatus = TaskStatus.IN_PROGRESS;
                
                return { ...t, externalTaskId: b24Id, status: newStatus };
              }
              return t;
            })
          };
        } else {
          // Create new order
          const orderId = 'O-' + Math.random().toString(36).substr(2, 9);
          const newOrder: Order = {
            id: orderId,
            externalId: dealId,
            orderNumber: dealId,
            clientName: deal.TITLE || 'Без названия',
            deadline: deal.CLOSEDATE ? deal.CLOSEDATE.split('T')[0] : '',
            description: deal.ADDITIONAL_INFO || deal.COMMENTS || '',
            createdAt: new Date().toISOString(),
            priority: 'MEDIUM',
            tasks: [
              ProductionStage.SAWING, 
              ProductionStage.EDGE_BANDING, 
              ProductionStage.DRILLING, 
              ProductionStage.KIT_ASSEMBLY,
              ProductionStage.PACKAGING, 
              ProductionStage.SHIPMENT
            ].map(stage => {
              const stageConfig = STAGE_CONFIG[stage];
              const stageLabel = stageConfig.label;
              const keywords = stageConfig.keywords || [stageLabel.toLowerCase()];

              const b24Task = b24Tasks.find((bt: any) => {
                const title = (bt.TITLE || '').toLowerCase();
                return title.includes(stageLabel.toLowerCase()) || keywords.some(k => title.includes(k));
              });

              const b24Status = b24Task ? parseInt(b24Task.REAL_STATUS) : 2;
              const b24Id = b24Task ? String(b24Task.ID || b24Task.id) : undefined;
              
              let status = TaskStatus.PENDING;
              if (b24Status >= 4) status = TaskStatus.COMPLETED;
              else if (b24Status === 3) status = TaskStatus.IN_PROGRESS;

              return {
                id: 'T-' + Math.random().toString(36).substr(2, 9),
                orderId: orderId,
                stage,
                status,
                title: deal.TITLE || '',
                externalTaskId: b24Id
              };
            }),
            companyId: user.companyId
          };
          updatedOrders.push(newOrder);
          importedCount++;

          // Background sync for missing tasks
          setTimeout(async () => {
            for (const task of newOrder.tasks) {
              if (!task.externalTaskId) {
                await syncTaskToBitrix(newOrder, task);
                await new Promise(r => setTimeout(r, 500));
              }
            }
          }, 2000);
        }
      }

      setOrders(updatedOrders);
      setIsDirty(true);
      
      if (importedCount > 0) {
        showToast(`Импортировано ${importedCount} новых сделок`, 'success');
      } else {
        showToast('Данные синхронизированы');
      }

      return importedCount;
    } catch (e) {
      console.error("Sync error", e);
      showToast('Ошибка синхронизации', 'error');
      return 0;
    }
  };

  const onSyncStaff = async () => {
    if (!bitrixConfig.enabled || !bitrixConfig.webhookUrl || !user) return 0;
    
    setIsSyncing(true);
    try {
      const baseUrl = bitrixConfig.webhookUrl.replace(/\/$/, '');
      const response = await fetch('/api/b24-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${baseUrl}/user.get.json`,
          method: 'POST',
          body: {
            filter: { "ACTIVE": "Y" }
          }
        })
      });

      const contentType = response.headers.get('content-type');
      const text = await response.text();

      if (!contentType || !contentType.includes('application/json')) {
        throw new Error("Некорректный ответ сервера");
      }

      const data = JSON.parse(text);
      if (!response.ok) {
        const errMsg = data.message || data.error_description || `Ошибка Bitrix24 (${response.status})`;
        throw new Error(errMsg);
      }

      const b24Users = data.result || [];
      if (!Array.isArray(b24Users)) {
        throw new Error("Bitrix24 вернул некорректный формат списка пользователей");
      }
      
      let importedCount = 0;
      const newStaffList: User[] = [];

      b24Users.forEach((bUser: any) => {
        // Bitrix24 user.get can return EMAIL as a string or an array of objects
        let email = '';
        if (typeof bUser.EMAIL === 'string') {
          email = bUser.EMAIL;
        } else if (Array.isArray(bUser.EMAIL) && bUser.EMAIL.length > 0) {
          const firstEmail = bUser.EMAIL[0];
          email = typeof firstEmail === 'string' ? firstEmail : (firstEmail.VALUE || '');
        }
        
        if (!email || staff.find(s => s.email === email)) return;

        const newUser: User = {
          id: 'U-' + Math.random().toString(36).substr(2, 9),
          name: `${bUser.NAME || ''} ${bUser.LAST_NAME || ''}`.trim() || email || 'Сотрудник B24',
          email: email,
          role: UserRole.EMPLOYEE,
          companyId: user.companyId,
          isProduction: true,
          avatar: bUser.PERSONAL_PHOTO,
          source: 'BITRIX24',
          b24Id: String(bUser.ID)
        };
        newStaffList.push(newUser);
        importedCount++;
      });

      if (newStaffList.length > 0) {
        setStaff(prev => [...prev, ...newStaffList]);
        setIsDirty(true);
        showToast(`Загружено ${newStaffList.length} сотрудников`, 'success');
      } else {
        showToast('Новых сотрудников не найдено');
      }

      return importedCount;
    } catch (e: any) {
      console.error("Staff sync error", e);
      showToast(e.message || 'Ошибка загрузки сотрудников', 'error');
      return 0;
    } finally {
      setIsSyncing(false);
    }
  };

  if (!user) {
    return <LoginPage 
      onLogin={async (role, email, pass) => {
        if (role === UserRole.SITE_ADMIN) {
          const sa: User = { id: 'sa', name: 'Иван Бобкин', email: 'ivanbobkin@system.ru', role: UserRole.SITE_ADMIN, isProduction: false };
          setUser(sa);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(sa));
          return;
        }

        if (!email || !pass) return "Введите e-mail и пароль";
        const result = await dbService.login(email, pass);
        if (result.success && result.user) {
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
        const companyId = 'C-' + Math.random().toString(36).substr(2, 9);
        const u: User = { 
          id: 'U-' + Math.random().toString(36).substr(2, 9), 
          email, password: pass, name: 'Администратор', role: UserRole.COMPANY_ADMIN, companyName: name, companyId, isProduction: false 
        };
        
        const result = await dbService.register(u);
        if (!result.success) return result.message || "Ошибка регистрации";

        setStaff([u]); 
        setOrders([]);
        setSessions([]);
        setShifts({});
        setUser(u); 
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(u));
      }} 
    />;
  }

  if (user.role === UserRole.SITE_ADMIN) {
    const companies = Array.from(new Set(staff.filter(u => u.companyName).map(u => JSON.stringify({ id: u.companyId || u.id, name: u.companyName })))).map(s => JSON.parse(s as string));
    
    return <SiteAdmin 
      onLogout={() => { setUser(null); localStorage.removeItem(STORAGE_KEYS.USER); setOrders([]); }}
      orders={orders}
      staff={staff}
      companies={companies}
      config={bitrixConfig}
      onUpdateUser={(userId, updates) => {
        const updated = staff.map(u => u.id === userId ? { ...u, ...updates } : u);
        setStaff(updated);
        syncWithCloud({ orders, staff: updated, sessions, shifts });
      }}
      onSendMessage={(toUserId, text) => {
        console.log(`Sending message to ${toUserId}: ${text}`);
      }}
      onUpdateConfig={(config) => {
        setBitrixConfig(config);
        localStorage.setItem(STORAGE_KEYS.BITRIX_CONFIG, JSON.stringify(config));
      }}
    />;
  }

  const myOrders = orders.filter(o => o.companyId === user.companyId);
  const myStaff = staff.filter(s => s.companyId === user.companyId);
  const mySessions = sessions.filter(s => s.companyId === user.companyId);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} onLogout={() => { setUser(null); localStorage.removeItem(STORAGE_KEYS.USER); setOrders([]); }} user={user} bitrixConfig={bitrixConfig} />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm z-30">
          <h1 className="text-xl font-bold uppercase text-slate-800 tracking-tight">{NAVIGATION_ITEMS.find(i => i.id === currentPage)?.label}</h1>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2">
                {isDirty && !isSyncing && (
                  <button 
                    onClick={() => syncWithCloud()}
                    className="text-[9px] font-black bg-amber-500 text-white px-2 py-1 rounded hover:bg-amber-600 transition-colors uppercase animate-pulse"
                  >
                    Сохранить сейчас
                  </button>
                )}
                {isSyncing && <div className="text-[9px] font-black text-blue-500 animate-pulse uppercase flex items-center gap-1"><Database size={10}/> Синхронизация...</div>}
              </div>
              {lastSaved && !isSyncing && <div className="text-[9px] font-bold text-slate-400 uppercase">Сохранено: {lastSaved}</div>}
              {isDirty && !isSyncing && <div className="text-[9px] font-bold text-amber-500 uppercase">Есть несохраненные изменения</div>}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-semibold">{user.name}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">
                  {user.role === UserRole.COMPANY_ADMIN ? 'Администратор' : 'Сотрудник'}
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 border-2 border-white">{user.name.charAt(0)}</div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {currentPage === 'dashboard' && <Dashboard orders={myOrders} staff={myStaff} />}
          {currentPage === 'planning' && (
            <Planning 
              orders={myOrders} 
              onAddOrder={o => { 
                const newOrder = { ...o, companyId: user.companyId };
                setOrders(prev => [...prev, newOrder]); 
                setIsDirty(true);
              }} 
              onSyncBitrix={onSyncBitrix} 
              onUpdateTaskPlanning={onUpdateTaskPlanning} 
              onUpdateOrderDescription={(oid, desc) => {
                setOrders(prev => prev.map(o => o.id === oid ? { ...o, description: desc } : o));
                setIsDirty(true);
              }}
              onUpdateTaskRate={(oid, tid, r) => {
                setOrders(prev => prev.map(o => o.id !== oid ? o : { ...o, tasks: o.tasks.map(t => t.id === tid ? { ...t, rate: r } : t) }));
                setIsDirty(true);
              }} 
              isBitrixEnabled={bitrixConfig.enabled} staff={myStaff} shifts={shifts} user={user} bitrixConfig={bitrixConfig}
            />
          )}
          {currentPage === 'schedule' && <Schedule staff={myStaff} currentUser={user} shifts={shifts} onToggleShift={(uid, d) => {
            // Проверка прав: Админ, Нач. цеха или сам сотрудник
            const canEdit = user.role === UserRole.COMPANY_ADMIN || user.isProductionHead || user.id === uid;
            if (!canEdit) {
              showToast("У вас нет прав на изменение чужого графика", "error");
              return;
            }

            setShifts(prev => {
              const updated = { ...prev };
              if (!updated[uid]) updated[uid] = {};
              updated[uid][d] = !updated[uid][d];
              return updated;
            });
            setIsDirty(true);
          }} />}
          {currentPage === 'production' && <ProductionBoard orders={myOrders} onUpdateTask={(oid, tid, st, comm) => { 
            updateTaskStatus(oid, tid, st, comm); 
            setIsDirty(true);
          }} onAddAccomplice={(oid, tid, uid) => {
            setOrders(prev => prev.map(o => o.id !== oid ? o : { ...o, tasks: o.tasks.map(t => t.id !== tid ? t : { ...t, accompliceIds: [...new Set([...(t.accompliceIds || []), uid])] }) }));
            setIsDirty(true);
          }} onUpdateDetails={(oid, tid, d, p) => {
            setOrders(prev => prev.map(o => o.id !== oid ? o : { ...o, tasks: o.tasks.map(t => t.id === tid ? { ...t, details: d, packages: p || t.packages } : t) }));
            setIsDirty(true);
          }} staff={myStaff} currentUser={user} onAddB24Comment={onAddB24Comment} isShiftActive={true} shifts={shifts} onTriggerShiftFlash={() => {}} bitrixConfig={bitrixConfig} />}
          {currentPage === 'salaries' && <Salaries orders={myOrders} staff={myStaff} bitrixConfig={bitrixConfig} shifts={shifts} />}
          {currentPage === 'users' && <UsersManagement staff={myStaff} onSync={onSyncStaff} isBitrixEnabled={bitrixConfig.enabled} bitrixConfig={bitrixConfig} onToggleProduction={uid => {
            setStaff(prev => prev.map(u => u.id === uid ? { ...u, isProduction: !u.isProduction } : u));
            setIsDirty(true);
          }} onUpdateStaff={(uid, upd) => {
            setStaff(prev => prev.map(u => u.id === uid ? { ...u, ...upd } : u));
            setIsDirty(true);
          }} />}
          {currentPage === 'reports' && <Reports orders={myOrders} staff={myStaff} workSessions={mySessions} />}
          {currentPage === 'archive' && <Archive orders={myOrders} />}
          {currentPage === 'settings' && <Settings config={bitrixConfig} setConfig={c => { 
            setBitrixConfig(c); 
            localStorage.setItem(STORAGE_KEYS.BITRIX_CONFIG, JSON.stringify(c)); 
            setIsDirty(true);
            syncWithCloud({ orders, staff, sessions, shifts, bitrixConfig: c });
          }} onExport={() => {}} onImport={() => {}} onClear={() => {}} />}
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
