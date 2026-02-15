
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { 
  UserPlus, Shield, User as UserIcon, Mail, 
  MoreVertical, RefreshCw, Share2, Briefcase, 
  CheckCircle2, Key, Lock, Unlock, X, Star
} from 'lucide-react';

interface UsersManagementProps {
  staff: User[];
  onSync: () => Promise<number>;
  isBitrixEnabled: boolean;
  onToggleProduction: (userId: string) => void;
  onUpdateStaff: (userId: string, updates: Partial<User>) => void;
}

const UsersManagement: React.FC<UsersManagementProps> = ({ staff, onSync, isBitrixEnabled, onToggleProduction, onUpdateStaff }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingAccess, setEditingAccess] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const handleSync = async () => {
    setIsSyncing(true);
    await onSync();
    setIsSyncing(false);
  };

  const saveAccess = (userId: string) => {
    onUpdateStaff(userId, { password: newPassword });
    setEditingAccess(null);
    setNewPassword('');
  };

  const toggleLock = (userId: string, currentStatus: boolean) => {
    onUpdateStaff(userId, { isLocked: !currentStatus });
  };

  const toggleProductionHead = (userId: string, currentStatus: boolean) => {
    onUpdateStaff(userId, { isProductionHead: !currentStatus });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          Штат компании <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-black text-slate-400 uppercase">{staff.length}</span>
        </h2>
        
        <div className="flex gap-3">
          {isBitrixEnabled && (
            <button 
              onClick={handleSync}
              disabled={isSyncing}
              className="bg-blue-50 text-blue-700 border border-blue-100 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-100 transition-all disabled:opacity-50"
            >
              {isSyncing ? <RefreshCw size={18} className="animate-spin" /> : <Share2 size={18} />}
              {isSyncing ? 'Импорт...' : 'Загрузить из B24'}
            </button>
          )}
          <button className="bg-slate-900 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">
            <UserPlus size={18} />
            Добавить вручную
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staff.map((member) => (
          <div key={member.id} className={`bg-white p-6 rounded-2xl border transition-all relative overflow-hidden group ${
            member.isProduction ? 'border-blue-200 shadow-blue-500/5 shadow-lg' : 'border-slate-200 shadow-sm'
          } ${member.isLocked ? 'opacity-75 grayscale' : ''}`}>
            
            {member.isLocked && (
              <div className="absolute inset-0 z-10 bg-slate-900/10 flex items-center justify-center backdrop-blur-[1px]">
                <div className="bg-rose-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">Доступ заблокирован</div>
              </div>
            )}

            {member.isProductionHead && (
              <div className="absolute top-0 right-0 px-2 py-1 bg-amber-500 text-white text-[8px] font-black uppercase tracking-widest rounded-bl-lg flex items-center gap-1">
                <Star size={10} /> Начальник цеха
              </div>
            )}
            
            <div className="flex items-start gap-4 mb-4 relative z-20">
              <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 bg-slate-100 border-2 border-slate-50 shadow-inner">
                {member.avatar ? (
                  <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center font-black text-xl ${
                    member.role === UserRole.COMPANY_ADMIN ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {member.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 leading-tight truncate">{member.name}</h3>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-black">
                  {member.role === UserRole.COMPANY_ADMIN ? <Shield size={10} className="text-blue-500" /> : <UserIcon size={10} />}
                  {member.role === UserRole.COMPANY_ADMIN ? 'Администратор' : (member.isProductionHead ? 'Начальник произв.' : 'Сотрудник')}
                </div>
              </div>
            </div>

            <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 relative z-20">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Mail size={14} className="text-slate-300 shrink-0" />
                <span className="truncate">{member.email || 'Email не указан'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Key size={14} className={member.password ? 'text-emerald-500' : 'text-slate-300'} />
                <span>{member.password ? 'Пароль установлен' : 'Пароль не задан'}</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 relative z-20">
              <div className="flex gap-2">
                 <button 
                  onClick={() => onToggleProduction(member.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    member.isProduction 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {member.isProduction ? 'В цеху' : 'Офис'}
                </button>
                {member.role !== UserRole.COMPANY_ADMIN && (
                   <button 
                    onClick={() => toggleProductionHead(member.id, !!member.isProductionHead)}
                    className={`px-3 py-2 rounded-xl transition-all ${member.isProductionHead ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    title={member.isProductionHead ? "Снять статус начальника" : "Сделать начальником"}
                  >
                    <Star size={16} />
                  </button>
                )}
                <button 
                  onClick={() => { setEditingAccess(member.id); setNewPassword(member.password || ''); }}
                  className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
                  title="Управление доступом"
                >
                  <Key size={16} />
                </button>
                <button 
                  onClick={() => toggleLock(member.id, !!member.isLocked)}
                  className={`px-3 py-2 rounded-xl transition-all ${member.isLocked ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  title={member.isLocked ? "Разблокировать" : "Заблокировать"}
                >
                  {member.isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                </button>
              </div>
            </div>

            {editingAccess === member.id && (
              <div className="absolute inset-0 z-30 bg-white p-6 flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4">
                   <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Пароль сотрудника</h4>
                   <button onClick={() => setEditingAccess(null)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
                </div>
                <div className="space-y-4">
                  <input 
                    type="text" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Придумайте пароль..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                    autoFocus
                  />
                  <p className="text-[10px] text-slate-400 italic">Сотрудник будет использовать этот пароль и свой email ({member.email}) для входа в систему.</p>
                  <button 
                    onClick={() => saveAccess(member.id)}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20"
                  >
                    Сохранить доступ
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UsersManagement;
