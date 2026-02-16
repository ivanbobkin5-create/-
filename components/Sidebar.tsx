
import React from 'react';
import { LogOut, Layout, Factory } from 'lucide-react';
import { NAVIGATION_ITEMS } from '../constants';
import { User, BitrixConfig, UserRole } from '../types';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  onLogout: () => void;
  user: User;
  bitrixConfig?: BitrixConfig;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange, onLogout, user, bitrixConfig }) => {
  const visibleItems = NAVIGATION_ITEMS.filter(item => {
    if (user.role === UserRole.COMPANY_ADMIN) return true;
    if (user.isProductionHead && item.id !== 'settings') return true;
    return item.roles.includes(user.role);
  });

  const handleNavClick = (item: typeof NAVIGATION_ITEMS[0]) => {
    if (item.id === 'chat') {
      const url = bitrixConfig?.chatUrl;
      if (url) {
        window.open(url, '_blank');
      } else {
        alert('Ссылка на чат не настроена в параметрах интеграции.');
      }
      return;
    }
    onPageChange(item.id);
  };

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-full shadow-2xl z-20">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800/50">
        <div className="p-2 bg-blue-600 rounded-lg shrink-0">
          {bitrixConfig?.portalLogo ? (
            <img src={bitrixConfig.portalLogo} alt="Logo" className="w-6 h-6 object-contain rounded" />
          ) : (
            <Layout size={24} className="text-white" />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-extrabold tracking-tight">Мебель<span className="text-blue-500">План</span></span>
        </div>
      </div>

      <nav className="flex-1 mt-6 px-4 overflow-y-auto no-scrollbar">
        <ul className="space-y-1">
          {visibleItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleNavClick(item)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                  currentPage === item.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-4">
        {bitrixConfig?.portalName && (
          <div className="px-4 py-2 bg-slate-800/30 rounded-lg flex items-center gap-2 border border-slate-700/50">
            <Factory size={14} className="text-slate-500" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">
              {bitrixConfig.portalName}
            </span>
          </div>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-rose-900/20 hover:text-rose-400 transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Выйти</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
