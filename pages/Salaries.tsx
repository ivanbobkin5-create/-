
import React, { useMemo, useState } from 'react';
import { Order, User, TaskStatus, Task } from '../types';
import { STAGE_CONFIG } from '../constants';
import { 
  Wallet, TrendingUp, Users, 
  Calendar, Download, ChevronRight, 
  Banknote, PieChart, Search, X, Hash, CalendarDays
} from 'lucide-react';

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

const Salaries: React.FC<{orders: Order[], staff: User[]}> = ({ orders, staff }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const salaryStats = useMemo(() => {
    const stats: Record<string, { totalEarned: number, tasksDetails: any[] }> = {};
    const workerIdsInPeriod = new Set<string>();

    orders.forEach(order => {
      order.tasks.forEach(task => {
        const compDate = task.completedAt || task.plannedDate || order.createdAt;
        const d = new Date(compDate);
        if (d.getMonth() !== selectedMonth || d.getFullYear() !== selectedYear) return;

        if (task.status === TaskStatus.COMPLETED && task.rate) {
          const addStat = (uid: string, amt: number, shr: number) => {
            if (!stats[uid]) stats[uid] = { totalEarned: 0, tasksDetails: [] };
            stats[uid].totalEarned += amt;
            stats[uid].tasksDetails.push({ orderNo: order.orderNumber, client: order.clientName, stage: task.stage, share: shr, amount: Math.round(amt), date: compDate });
            workerIdsInPeriod.add(uid);
          };

          if (task.details && task.details.length > 0) {
            const scanMap: Record<string, number> = {};
            task.details.forEach(det => { if (det.scannedBy) scanMap[det.scannedBy] = (scanMap[det.scannedBy] || 0) + (det.quantity || 1); });
            const totalScans = Object.values(scanMap).reduce((a, b) => a + b, 0);
            if (totalScans > 0) Object.entries(scanMap).forEach(([uid, count]) => addStat(uid, task.rate! * (count / totalScans), Math.round((count / totalScans) * 100)));
            else if (task.assignedTo) addStat(task.assignedTo, task.rate, 100);
          } else if (task.assignedTo) addStat(task.assignedTo, task.rate, 100);
        }
      });
    });

    return Object.entries(stats).map(([uid, data]) => ({
      id: uid, name: staff.find(s => s.id === uid)?.name || `ID:${uid.slice(-4)}`,
      totalEarned: Math.round(data.totalEarned), tasksCount: data.tasksDetails.length, details: data.tasksDetails,
      isCurrentlyProduction: !!staff.find(s => s.id === uid)?.isProduction
    }))
    // В список попадают ЛИБО те кто сейчас "В цеху", ЛИБО те кто работал в этом месяце
    .concat(staff.filter(s => s.isProduction && !stats[s.id]).map(s => ({ id: s.id, name: s.name, totalEarned: 0, tasksCount: 0, details: [], isCurrentlyProduction: true })))
    .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => b.totalEarned - a.totalEarned);
  }, [orders, staff, selectedMonth, selectedYear, searchTerm]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Ведомость выплат</h2><p className="text-slate-500 text-sm">История за {MONTHS[selectedMonth]} {selectedYear}</p></div>
        <div className="flex items-center gap-3">
           <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
              <div className="px-3 border-r border-slate-100 flex items-center"><CalendarDays size={14} className="text-blue-500 mr-2" /><select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent text-xs font-black uppercase outline-none">{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select></div>
              <div className="px-3"><select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent text-xs font-black uppercase outline-none">{[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}</select></div>
           </div>
           <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"><Download size={14} /> Экспорт</button>
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
           <div className="relative flex-1 max-w-sm"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Поиск сотрудника..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" /></div>
        </div>
        <table className="w-full text-left">
           <thead><tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest"><th className="px-8 py-4">Сотрудник</th><th className="px-8 py-4 text-center">Задач</th><th className="px-8 py-4 text-right">Сумма</th></tr></thead>
           <tbody className="divide-y divide-slate-100">
              {salaryStats.map(stat => (
                <tr key={stat.id} onClick={() => setSelectedStaffId(stat.id)} className="hover:bg-slate-50/50 cursor-pointer group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black">{stat.name.charAt(0)}</div><div><div className="font-bold text-slate-800">{stat.name}</div>{!stat.isCurrentlyProduction && <div className="text-[8px] font-black text-amber-600 uppercase">Уволен / Офис</div>}</div></div>
                  </td>
                  <td className="px-8 py-5 text-center"><span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600">{stat.tasksCount}</span></td>
                  <td className="px-8 py-5 text-right"><div className="flex items-center justify-end gap-4"><div className="text-lg font-black text-slate-800">{stat.totalEarned.toLocaleString('ru-RU')} ₽</div><ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1 transition-all" /></div></td>
                </tr>
              ))}
           </tbody>
        </table>
      </div>
      {/* Модалка с деталями selectedStaffId аналогична существующей */}
    </div>
  );
};

export default Salaries;
