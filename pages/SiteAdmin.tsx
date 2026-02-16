
import React, { useMemo, useState } from 'react';
import { Settings, Server, Users, Database, Globe, LogOut, Factory, Briefcase, Mail, Shield, Edit2, X, Save, Lock, Unlock, Search, CheckCircle2, AlertCircle, HardDrive, Cpu, Zap, Activity, Share2, Link as LinkIcon, ShieldCheck, Terminal, RefreshCw } from 'lucide-react';
import { Order, User, UserRole, BitrixConfig, CloudConfig } from '../types';
import { dbService } from '../dbService';

interface Company {
  id: string;
  name: string;
}

interface SiteAdminProps {
  onLogout: () => void;
  orders: Order[];
  staff: User[];
  companies: Company[];
  config: BitrixConfig;
  onUpdateUser: (userId: string, updates: Partial<User>) => void;
  onSendMessage: (toUserId: string, text: string) => void;
  onUpdateConfig: (config: BitrixConfig) => void;
}

type Tab = 'companies' | 'database' | 'users' | 'cloud';

const SiteAdmin: React.FC<SiteAdminProps> = ({ onLogout, orders, staff, companies, config, onUpdateUser, onSendMessage, onUpdateConfig }) => {
  const [activeTab, setActiveTab] = useState<Tab>('companies');
  const [editingAdmin, setEditingAdmin] = useState<User | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [companySearch, setCompanySearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [messageTo, setMessageTo] = useState<User | null>(null);
  const [messageText, setMessageText] = useState('');
  
  // Cloud logic
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const adminUsers = staff.filter(u => u.role === UserRole.COMPANY_ADMIN);
  const totalDetails = orders.reduce((acc, o) => acc + o.tasks.reduce((tacc, t) => tacc + (t.details?.length || 0), 0), 0);

  const handleSendMessage = () => {
    if (messageTo && messageText) {
      onSendMessage(messageTo.id, messageText);
      setMessageTo(null);
      setMessageText('');
      alert('Сообщение отправлено!');
    }
  };

  const toggleAdminLock = (admin: User) => {
    onUpdateUser(admin.id, { isLocked: !admin.isLocked });
  };

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  const startEditAdmin = (admin: User) => {
    setEditingAdmin(admin);
    setSelectedCompanyId(admin.companyId || '');
  };

  const saveAdminCompany = () => {
    if (editingAdmin && selectedCompanyId) {
      const companyName = companies.find(c => c.id === selectedCompanyId)?.name;
      onUpdateUser(editingAdmin.id, { companyId: selectedCompanyId, companyName });
      setEditingAdmin(null);
    }
  };

  const updateCloudConfig = (updates: Partial<CloudConfig>) => {
    onUpdateConfig({
      ...config,
      cloud: { ...(config.cloud || { enabled: false, apiUrl: '', apiToken: '' }), ...updates }
    });
  };

  const handleTestConnection = async () => {
    if (!config.cloud) return;
    setIsTesting(true);
    setTestResult(null);
    const result = await dbService.testConnection(config.cloud);
    setTestResult(result);
    setIsTesting(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex">
      <aside className="w-64 border-r border-slate-800 p-6 flex flex-col shrink-0">
        <div className="font-bold text-xl mb-12 flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
            <Zap className="text-white" size={20} />
          </div>
          <span>План<span className="text-blue-500">Админ</span></span>
        </div>
        
        <nav className="flex-1 space-y-1">
          <button 
            onClick={() => setActiveTab('companies')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'companies' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <Globe size={18} /> Компании
          </button>
          <button 
            onClick={() => setActiveTab('cloud')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'cloud' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <Server size={18} /> Облако
          </button>
          <button 
            onClick={() => setActiveTab('database')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'database' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <Database size={18} /> База данных
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <Users size={18} /> Все пользователи
          </button>
        </nav>

        <div className="mt-auto border-t border-slate-800 pt-4">
          <button 
            onClick={onLogout}
            className="flex items-center gap-3 px-4 py-3 text-rose-500 hover:text-rose-400 w-full transition-colors font-bold text-sm"
          >
            <LogOut size={18} /> Выйти
          </button>
        </div>
      </aside>

      <main className="flex-1 p-12 overflow-y-auto custom-scrollbar">
        <header className="mb-12 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black mb-2 tracking-tight uppercase">
              {activeTab === 'companies' && 'Управление компаниями'}
              {activeTab === 'database' && 'Статистика данных'}
              {activeTab === 'users' && 'Пользователи сети'}
              {activeTab === 'cloud' && 'Глобальное Облако'}
            </h1>
            <p className="text-slate-400 text-sm">Центральная консоль управления ресурсами ПланАдмин</p>
          </div>
        </header>

        {activeTab === 'companies' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="grid grid-cols-4 gap-6">
              <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700 shadow-xl">
                <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Компаний</h3>
                <div className="text-4xl font-black text-white">{companies.length}</div>
              </div>
              <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700 shadow-xl">
                <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Заказов</h3>
                <div className="text-4xl font-black text-blue-500">{orders.length}</div>
              </div>
              <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700 shadow-xl">
                <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Деталей</h3>
                <div className="text-4xl font-black text-indigo-400">{totalDetails}</div>
              </div>
              <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700 shadow-xl">
                <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Админов</h3>
                <div className="text-4xl font-black text-emerald-400">{adminUsers.length}</div>
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                <h2 className="font-black text-sm uppercase tracking-widest text-slate-400 flex items-center gap-2">
                   <Shield size={16} className="text-blue-500" /> Реестр администраторов
                </h2>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-500 uppercase border-b border-slate-700">
                    <th className="px-6 py-4">Администратор</th>
                    <th className="px-6 py-4">Компания</th>
                    <th className="px-6 py-4">Статус</th>
                    <th className="px-6 py-4 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm">
                  {adminUsers.map(admin => (
                    <tr key={admin.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-xs">{admin.name.charAt(0)}</div>
                          <div><div className="font-bold">{admin.name}</div><div className="text-[10px] text-slate-500">{admin.email}</div></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-blue-400">{admin.companyName || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-black ${admin.isLocked ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {admin.isLocked ? 'BLOCKED' : 'ACTIVE'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => startEditAdmin(admin)} className="p-2 bg-slate-700 hover:bg-blue-600 rounded-lg text-white"><Edit2 size={14}/></button>
                        <button onClick={() => setMessageTo(admin)} className="p-2 bg-slate-700 hover:bg-blue-600 rounded-lg text-white"><Mail size={14}/></button>
                        <button onClick={() => toggleAdminLock(admin)} className={`p-2 rounded-lg text-white ${admin.isLocked ? 'bg-rose-900' : 'bg-slate-700 hover:bg-rose-600'}`}>
                          {admin.isLocked ? <Unlock size={14}/> : <Lock size={14}/>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'cloud' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="bg-slate-800/50 p-10 rounded-[40px] border border-slate-700 shadow-2xl max-w-4xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-blue-600 rounded-3xl shadow-lg shadow-blue-500/20"><Server size={32} /></div>
                  <div>
                    <h2 className="text-2xl font-black">Timeweb Cloud</h2>
                    <p className="text-slate-400 text-sm">Центральная база данных системы</p>
                  </div>
                </div>
                <button 
                  onClick={() => updateCloudConfig({ enabled: !config.cloud?.enabled })}
                  className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${config.cloud?.enabled ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                >
                  {config.cloud?.enabled ? 'Синхронизация активна' : 'Синхронизация выключена'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Endpoint URL (api.php)</label>
                  <div className="relative">
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={20} />
                    <input 
                      type="text" 
                      value={config.cloud?.apiUrl || ''} 
                      onChange={e => updateCloudConfig({ apiUrl: e.target.value })}
                      placeholder="https://server.ru/api.php" 
                      className="w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-slate-700 rounded-2xl text-sm outline-none focus:border-blue-500 transition-all font-mono" 
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Секретный токен</label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={20} />
                    <input 
                      type="password" 
                      value={config.cloud?.apiToken || ''} 
                      onChange={e => updateCloudConfig({ apiToken: e.target.value })}
                      placeholder="MebelPlan_Secure_..." 
                      className="w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-slate-700 rounded-2xl text-sm outline-none focus:border-blue-500 transition-all font-mono" 
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 mb-10">
                <button 
                  onClick={handleTestConnection}
                  disabled={isTesting || !config.cloud?.apiUrl}
                  className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all disabled:opacity-30"
                >
                  {isTesting ? <RefreshCw size={16} className="animate-spin" /> : 'Проверить соединение'}
                </button>
                {testResult && (
                  <div className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold border ${testResult.success ? 'bg-emerald-900/20 border-emerald-800 text-emerald-400' : 'bg-rose-900/20 border-rose-800 text-rose-400'}`}>
                    {testResult.success ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
                    {testResult.message}
                  </div>
                )}
              </div>

              <div className="bg-slate-950 rounded-3xl p-8 font-mono text-xs leading-relaxed text-slate-400 border border-slate-800">
                <div className="flex items-center gap-3 text-blue-500 mb-4 border-b border-slate-800 pb-3">
                  <Terminal size={16}/> <span className="font-bold uppercase tracking-widest">Инструкция Core-Админа</span>
                </div>
                <p className="mb-3">1. Этот модуль синхронизирует данные <span className="text-white">всех компаний</span> в одну глобальную базу.</p>
                <p className="mb-3">2. Убедитесь, что PostgreSQL на Timeweb Cloud настроен на <span className="text-white">sslmode=verify-full</span>.</p>
                <p className="mb-3">3. Файл <span className="text-blue-400 italic">api.php</span> должен находиться по указанному URL и иметь права на запись.</p>
                <div className="mt-6 p-4 bg-blue-900/20 rounded-xl border border-blue-900/50 text-[10px] text-blue-300">
                  ВНИМАНИЕ: Изменение URL или токена приведет к потере связи у всех текущих пользователей до момента синхронизации.
                </div>
              </div>
            </div>
          </div>
        )}

        {editingAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">Назначить компанию</h3>
                <button onClick={() => setEditingAdmin(null)} className="text-slate-500 hover:text-white"><X size={24}/></button>
              </div>
              <div className="space-y-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input 
                    type="text" 
                    value={companySearch} 
                    onChange={e => setCompanySearch(e.target.value)} 
                    placeholder="Поиск компании..." 
                    className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
                <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                   {filteredCompanies.map(c => (
                     <button 
                       key={c.id} 
                       onClick={() => setSelectedCompanyId(c.id)}
                       className={`w-full p-4 rounded-xl border text-left transition-all ${selectedCompanyId === c.id ? 'bg-blue-600 border-blue-500 shadow-lg' : 'bg-slate-900 border-slate-700 hover:bg-slate-800'}`}
                     >
                       <div className="font-bold text-sm">{c.name}</div>
                     </button>
                   ))}
                </div>
                <button 
                  onClick={saveAdminCompany}
                  disabled={!selectedCompanyId}
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-500 transition-all disabled:opacity-50"
                >
                  Применить
                </button>
              </div>
            </div>
          </div>
        )}

        {messageTo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">Сообщение</h3>
                <button onClick={() => setMessageTo(null)} className="text-slate-500 hover:text-white"><X size={24}/></button>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-700">
                  <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Кому:</div>
                  <div className="text-sm font-bold text-blue-400">{messageTo.name}</div>
                </div>
                <textarea 
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  placeholder="Текст сообщения..."
                  className="w-full h-32 bg-slate-900 border border-slate-700 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
                <button 
                  onClick={handleSendMessage}
                  disabled={!messageText}
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-500 shadow-xl disabled:opacity-50"
                >
                  Отправить
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SiteAdmin;
