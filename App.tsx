import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Settings, 
  Users, 
  Package, 
  Calendar, 
  BarChart3,
  Archive,
  Factory
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Factory className="w-6 h-6 text-blue-400" />
            Mebel Plan
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Дашборд" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <NavItem 
            icon={<Package size={20} />} 
            label="Планирование" 
            active={activeTab === 'planning'} 
            onClick={() => setActiveTab('planning')} 
          />
          <NavItem 
            icon={<Calendar size={20} />} 
            label="График" 
            active={activeTab === 'schedule'} 
            onClick={() => setActiveTab('schedule')} 
          />
          <NavItem 
            icon={<Users size={20} />} 
            label="Сотрудники" 
            active={activeTab === 'users'} 
            onClick={() => setActiveTab('users')} 
          />
          <NavItem 
            icon={<BarChart3 size={20} />} 
            label="Отчеты" 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')} 
          />
          <NavItem 
            icon={<Archive size={20} />} 
            label="Архив" 
            active={activeTab === 'archive'} 
            onClick={() => setActiveTab('archive')} 
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <NavItem 
            icon={<Settings size={20} />} 
            label="Настройки" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="bg-white border-b h-16 flex items-center px-8 justify-between">
          <h2 className="text-lg font-semibold text-slate-800 capitalize">
            {activeTab}
          </h2>
          <div className="flex items-center gap-4">
             <span className="text-sm text-slate-500">Система активна</span>
             <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
               A
             </div>
          </div>
        </header>

        <div className="p-8">
           <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-2xl mx-auto mt-20">
             <Factory className="w-16 h-16 text-slate-300 mx-auto mb-4" />
             <h3 className="text-xl font-bold text-slate-800 mb-2">Добро пожаловать в Mebel Plan ERP</h3>
             <p className="text-slate-500 mb-8">
               Мы восстановили структуру приложения. Вы можете продолжить настройку интеграции с Bitrix24 и Firebase.
             </p>
             <div className="flex gap-4 justify-center">
               <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                 Начать работу
               </button>
               <button 
                onClick={() => setActiveTab('settings')}
                className="px-6 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition"
               >
                 Настройки
               </button>
             </div>
           </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
        active 
          ? 'bg-blue-600 text-white' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}
