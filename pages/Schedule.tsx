
import React, { useMemo, useState } from 'react';
import { User, UserRole } from '../types';
import { getEmployeeColor } from '../constants';
import { 
  Calendar, ChevronLeft, ChevronRight, Check, X, 
  Clock, Users, User as UserIcon, AlertCircle 
} from 'lucide-react';

interface ScheduleProps {
  staff: User[];
  currentUser: User;
  shifts: Record<string, Record<string, boolean>>;
  onToggleShift: (userId: string, date: string) => void;
}

const Schedule: React.FC<ScheduleProps> = ({ staff, currentUser, shifts, onToggleShift }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const formatDateKey = (date: Date) => date.toISOString().split('T')[0];

  const nextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); };
  const prevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); };

  const canEditShift = (userId: string) => {
    if (currentUser.role === UserRole.COMPANY_ADMIN || currentUser.isProductionHead) return true;
    return currentUser.id === userId;
  };

  const productionStaff = staff.filter(s => s.isProduction);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">График работы</h2>
          <p className="text-sm text-slate-500">Управление сменами персонала на производстве</p>
        </div>
        <div className="flex bg-slate-50 rounded-xl border border-slate-200 p-1 shadow-sm">
          <button onClick={prevWeek} className="p-2 hover:bg-white rounded-lg text-slate-600 transition-all"><ChevronLeft size={20} /></button>
          <div className="px-6 py-2 text-sm font-bold text-slate-800 flex items-center gap-2">
            <Calendar size={16} className="text-blue-500" />
            {weekDays[0].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — {weekDays[6].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <button onClick={nextWeek} className="p-2 hover:bg-white rounded-lg text-slate-600 transition-all"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="p-6 border-b border-r border-slate-100 w-64 text-[10px] font-black text-slate-400 uppercase tracking-widest">Сотрудник</th>
              {weekDays.map(day => (
                <th key={day.toString()} className="p-4 border-b border-slate-100 text-center">
                  <div className="text-[10px] font-black uppercase text-slate-400 mb-1">{day.toLocaleDateString('ru-RU', { weekday: 'short' })}</div>
                  <div className={`text-sm font-black ${day.toISOString().split('T')[0] === new Date().toISOString().split('T')[0] ? 'text-blue-600' : 'text-slate-700'}`}>
                    {day.getDate()}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {productionStaff.map(member => (
              <tr key={member.id} className="hover:bg-slate-50/30 transition-colors">
                <td className="p-6 border-r border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${getEmployeeColor(member.name)} text-white flex items-center justify-center font-black shadow-sm`}>
                      {member.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">{member.name}</div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase truncate">{member.isProductionHead ? 'Нач. цеха' : 'Сотрудник'}</div>
                    </div>
                  </div>
                </td>
                {weekDays.map(day => {
                  const dateKey = formatDateKey(day);
                  const isWorking = shifts[member.id]?.[dateKey];
                  const editable = canEditShift(member.id);

                  return (
                    <td key={dateKey} className="p-2 text-center">
                      <button 
                        disabled={!editable}
                        onClick={() => onToggleShift(member.id, dateKey)}
                        className={`w-full h-12 rounded-2xl flex items-center justify-center transition-all border-2 ${
                          isWorking 
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-600 shadow-sm' 
                            : 'bg-slate-50 border-transparent text-slate-300 hover:border-slate-200'
                        } ${!editable ? 'cursor-not-allowed opacity-50' : 'active:scale-95'}`}
                      >
                        {isWorking ? <Check size={20} strokeWidth={3} /> : <X size={16} />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {productionStaff.length === 0 && (
          <div className="py-20 text-center space-y-4">
             <div className="p-4 bg-slate-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto"><UserIcon className="text-slate-300" size={32}/></div>
             <p className="text-slate-400 font-bold text-sm">Сотрудники производства не найдены</p>
          </div>
        )}
      </div>

      <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 flex items-start gap-4">
        <AlertCircle className="text-blue-500 shrink-0" size={24} />
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-blue-900">Важно для планирования</h4>
          <p className="text-xs text-blue-700 leading-relaxed">
            Сотрудники, у которых не отмечена смена на выбранную дату в этом графике, не будут доступны для выбора 
            в качестве исполнителей или соисполнителей в разделе <b>Планирование</b>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Schedule;
