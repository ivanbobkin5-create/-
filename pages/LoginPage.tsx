
import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { Layout, Shield, Factory, Lock, User as UserIcon, ArrowLeft, Loader2, Database, AlertCircle, CheckCircle } from 'lucide-react';
import { dbService } from '../dbService';

interface LoginPageProps {
  onLogin: (role: UserRole, email?: string, password?: string) => Promise<string | void>;
  onRegister: (companyName: string, email: string, pass: string) => Promise<string | void>;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onRegister }) => {
  const [view, setView] = useState<'login' | 'register' | 'site_admin'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [adminLogin, setAdminLogin] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Диагностика
  const [systemHealth, setSystemHealth] = useState<{success: boolean, message: string} | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const health = await dbService.checkHealth();
      setSystemHealth(health);
    };
    checkStatus();
  }, []);

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    if (adminLogin === 'ivanbobkin' && adminPass === 'Joe240193') {
      await onLogin(UserRole.SITE_ADMIN);
    } else {
      setError('Неверный логин или пароль администратора');
      setTimeout(() => setError(''), 3000);
    }
    setIsLoading(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (view === 'register') {
        if (!companyName || !email || !password) {
          setError('Заполните все поля регистрации');
          return;
        }
        const result = await onRegister(companyName, email, password);
        if (typeof result === 'string') setError(result);
        return;
      }

      const result = await onLogin(UserRole.EMPLOYEE, email, password);
      if (typeof result === 'string') setError(result);
    } catch (e) {
      setError("Ошибка соединения с сервером");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 bg-[url('https://images.unsplash.com/photo-1581421015105-df4ef9f59b63?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"></div>
      
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl mb-4 shadow-xl shadow-blue-500/20">
            <Layout size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Мебель<span className="text-blue-500">План</span></h1>
          <p className="text-slate-400 mt-2 font-medium">Система управления мебельным бизнесом</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-100">
          {/* Статус системы */}
          <div className="mb-6 flex items-center justify-center">
            {systemHealth ? (
               <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${systemHealth.success ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                 {systemHealth.success ? <CheckCircle size={12}/> : <AlertCircle size={12}/>}
                 {systemHealth.message}
               </div>
            ) : (
               <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-400 rounded-full text-[10px] font-black uppercase">
                 <Loader2 size={12} className="animate-spin"/> Диагностика...
               </div>
            )}
          </div>

          {view === 'site_admin' ? (
            <div className="animate-in fade-in duration-300">
              <button 
                onClick={() => setView('login')}
                className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase mb-6 hover:text-slate-600 transition-colors"
              >
                <ArrowLeft size={14} /> Назад
              </button>
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Shield className="text-blue-600" /> Вход в Core-панель
              </h2>
              <form className="space-y-5" onSubmit={handleAdminAuth}>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 px-1">Логин администратора</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      disabled={isLoading}
                      value={adminLogin}
                      onChange={e => setAdminLogin(e.target.value)}
                      placeholder="" 
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 px-1">Пароль</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="password" 
                      disabled={isLoading}
                      value={adminPass}
                      onChange={e => setAdminPass(e.target.value)}
                      placeholder="" 
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                    />
                  </div>
                </div>
                {error && <p className="text-rose-600 text-[10px] font-bold text-center animate-pulse">{error}</p>}
                <button disabled={isLoading} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2">
                  {isLoading && <Loader2 size={16} className="animate-spin" />}
                  Авторизоваться
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-8">
                <button 
                  onClick={() => setView('login')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${view === 'login' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                >
                  Вход
                </button>
                <button 
                  onClick={() => setView('register')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${view === 'register' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                >
                  Регистрация
                </button>
              </div>

              <form className="space-y-5" onSubmit={handleAuth}>
                {view === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 px-1">Название компании</label>
                    <div className="relative">
                      <Factory className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        disabled={isLoading}
                        value={companyName}
                        onChange={e => setCompanyName(e.target.value)}
                        placeholder='ООО "Мебель Фактура"' 
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 px-1">Email</label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="email" 
                      disabled={isLoading}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder={view === 'register' ? 'admin@mebel-faktura.ru' : 'name@mebel-faktura.ru'} 
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 px-1">Пароль</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="password" 
                      disabled={isLoading}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" 
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                    />
                  </div>
                </div>
                
                {error && <p className="text-rose-600 text-[10px] font-bold text-center bg-rose-50 p-2 rounded-lg border border-rose-100">{error}</p>}

                <button 
                  disabled={isLoading || systemHealth?.success === false} 
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading && <Loader2 size={16} className="animate-spin" />}
                  {view === 'login' ? 'Войти в систему' : 'Создать аккаунт'}
                </button>
              </form>

              <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col gap-4 text-center">
                <button 
                  onClick={() => setView('site_admin')}
                  className="w-full text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-slate-600 transition-colors"
                >
                  Вход для администратора сайта
                </button>
              </div>
            </>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="text-slate-500 text-[10px] leading-relaxed">© 2026 МебельПлан ERP ООО "Мебель Фактура".<br/>Все права защищены.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
