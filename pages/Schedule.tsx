
import React, { useMemo, useState } from 'react';
import { User, UserRole } from '../types';
import { getEmployeeColor } from '../constants';
import { 
  Calendar, ChevronLeft, ChevronRight, Check, X, 
  CalendarDays, AlertCircle 
} from 'lucide-react';

interface ScheduleProps {
  staff: User[];
  currentUser: User;
  shifts: Record<string, Record<string, boolean>>;
  onToggleShift: (userId: string, date: string) => void;
}

const Schedule: React.FC<ScheduleProps> = ({ staff, currentUser, shifts, onToggleShift }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i); return d;
    });
  }, [currentDate]);

  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
  }, [currentDate]);

  const days = viewMode === 'week' ? weekDays : monthDays;

  const formatDateKey = (date: Date) => date.toISOString().split('T')[0];
  
  // В графике отображаем ТОЛЬКО тех, кто отмечен "В цеху" в разделе Сотрудники
  const productionStaff = useMemo(() => staff.filter(s => s.isProduction), [staff]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div><h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">График работы</h2><p className="text-sm text-slate-500">Только сотрудники со статусом «В цеху»</p></div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-50 rounded-xl border border-slate-200 p-1">
            <button onClick={() => setViewMode('week')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${viewMode === 'week' ? 'bg-white shadow-sm' : ''}`}>Неделя</button>
            <button onClick={() => setViewMode('month')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${viewMode === 'month' ? 'bg-white shadow-sm' : ''}`}>Месяц</button>
          </div>
          <div className="flex bg-slate-50 rounded-xl border border-slate-200 p-1">
            <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - (viewMode === 'week' ? 7 : 30)); setCurrentDate(d); }} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronLeft size={20} /></button>
            <div className="px-6 py-2 text-sm font-bold flex items-center gap-2"><CalendarDays size={16} className="text-blue-500" />{days[0].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — {days[days.length - 1].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</div>
            <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + (viewMode === 'week' ? 7 : 30)); setCurrentDate(d); }} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronRight size={20} /></button>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="p-6 border-b border-r border-slate-100 w-64 text-[10px] font-black text-slate-400 uppercase tracking-widest">Сотрудник</th>
              {days.map(day => (<th key={day.toString()} className={`p-2 border-b border-slate-100 text-center ${viewMode === 'month' ? 'p-1' : ''}`}><div className="text-[10px] font-black uppercase text-slate-400 mb-1">{day.toLocaleDateString('ru-RU', { weekday: 'short' })}</div><div className={`text-sm font-black ${formatDateKey(day) === formatDateKey(new Date()) ? 'text-blue-600' : ''}`}>{day.getDate()}</div></th>))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {productionStaff.map(member => (
              <tr key={member.id} className="hover:bg-slate-50/30 transition-colors">
                <td className="p-6 border-r border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${getEmployeeColor(member.name)} text-white flex items-center justify-center font-black`}>{member.name.charAt(0)}</div>
                    <div><div className="text-sm font-bold">{member.name}</div><div className="text-[9px] text-slate-400 font-bold uppercase">{member.isProductionHead ? 'Нач. цеха' : 'Мастер'}</div></div>
                  </div>
                </td>
                {days.map(day => {
                  const dateKey = formatDateKey(day);
                  const isWorking = shifts[member.id]?.[dateKey];
                  const canEdit = currentUser.role === UserRole.COMPANY_ADMIN || 
                                  currentUser.isProductionHead || 
                                  currentUser.id === member.id;

                  return (
                    <td key={dateKey} className="p-1 text-center">
                      <button 
                        onClick={() => onToggleShift(member.id, dateKey)} 
                        disabled={!canEdit}
                        className={`w-full h-10 rounded-xl flex items-center justify-center border-2 transition-all ${
                          isWorking 
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-600' 
                            : 'bg-slate-50 border-transparent text-slate-300 hover:border-slate-200'
                        } ${!canEdit ? 'opacity-40 cursor-not-allowed grayscale' : ''}`}
                        title={!canEdit ? "Нет прав для редактирования" : ""}
                      >
                        {isWorking ? <Check size={16} /> : <X size={12} />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {productionStaff.length === 0 && <div className="py-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest opacity-30 italic">Список сотрудников производства пуст</div>}
      </div>
    </div>
  );
};

export default Schedule;
