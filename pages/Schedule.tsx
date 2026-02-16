
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

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i); return d;
    });
  }, [currentDate]);

  const formatDateKey = (date: Date) => date.toISOString().split('T')[0];
  const productionStaff = staff.filter(s => s.isProduction);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div><h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">График работы</h2><p className="text-sm text-slate-500">Только сотрудники производства («В цеху»)</p></div>
        <div className="flex bg-slate-50 rounded-xl border border-slate-200 p-1">
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }} className="p-2"><ChevronLeft size={20} /></button>
          <div className="px-6 py-2 text-sm font-bold flex items-center gap-2"><CalendarDays size={16} className="text-blue-500" />{weekDays[0].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — {weekDays[6].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</div>
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }} className="p-2"><ChevronRight size={20} /></button>
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="p-6 border-b border-r border-slate-100 w-64 text-[10px] font-black text-slate-400 uppercase tracking-widest">Сотрудник</th>
              {weekDays.map(day => (<th key={day.toString()} className="p-4 border-b border-slate-100 text-center"><div className="text-sm font-black">{day.getDate()}</div></th>))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {productionStaff.map(member => (
              <tr key={member.id}>
                <td className="p-6 border-r border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${getEmployeeColor(member.name)} text-white flex items-center justify-center font-black`}>{member.name.charAt(0)}</div>
                    <div><div className="text-sm font-bold">{member.name}</div><div className="text-[9px] text-slate-400 font-bold uppercase">{member.isProductionHead ? 'Нач. цеха' : 'Мастер'}</div></div>
                  </div>
                </td>
                {weekDays.map(day => {
                  const dateKey = formatDateKey(day);
                  const isWorking = shifts[member.id]?.[dateKey];
                  return (
                    <td key={dateKey} className="p-2 text-center">
                      <button onClick={() => onToggleShift(member.id, dateKey)} className={`w-full h-12 rounded-2xl flex items-center justify-center border-2 ${isWorking ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-slate-50 border-transparent text-slate-300'}`}>{isWorking ? <Check size={20} /> : <X size={16} />}</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {productionStaff.length === 0 && <div className="py-20 text-center text-slate-400 font-bold uppercase text-[10px]">Нет сотрудников со статусом «В цеху»</div>}
      </div>
    </div>
  );
};

export default Schedule;
