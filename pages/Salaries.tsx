
import React, { useMemo, useState } from 'react';
import { Order, User, TaskStatus, Task, ProductionStage } from '../types';
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

    orders.forEach(order => {
      order.tasks.forEach(task => {
        const compDate = task.completedAt || task.plannedDate || order.createdAt;
        const d = new Date(compDate);
        if (d.getMonth() !== selectedMonth || d.getFullYear() !== selectedYear) return;

        if (task.status === TaskStatus.COMPLETED && task.rate) {
          const addStat = (uid: string, amt: number, shr: number) => {
            if (!stats[uid]) stats[uid] = { totalEarned: 0, tasksDetails: [] };
            stats[uid].totalEarned += amt;
            stats[uid].tasksDetails.push({ 
              orderNo: order.orderNumber, 
              client: order.clientName, 
              stage: task.stage, 
              share: shr, 
              amount: Math.round(amt), 
              date: compDate 
            });
          };

          if (task.details && task.details.length > 0) {
            const scanMap: Record<string, number> = {};
            task.details.forEach(det => { 
              if (det.scannedBy) scanMap[det.scannedBy] = (scanMap[det.scannedBy] || 0) + (det.quantity || 1); 
            });
            const totalScans = Object.values(scanMap).reduce((a, b) => a + b, 0);
            if (totalScans > 0) {
              Object.entries(scanMap).forEach(([uid, count]) => {
                const share = count / totalScans;
                addStat(uid, task.rate! * share, Math.round(share * 100));
              });
            } else if (task.assignedTo) {
              addStat(task.assignedTo, task.rate, 100);
            }
          } else if (task.assignedTo) {
            addStat(task.assignedTo, task.rate, 100);
          }
        }
      });
    });

    const results = Object.entries(stats).map(([uid, data]) => {
      const user = staff.find(s => s.id === uid);
      return {
        id: uid, 
        name: user?.name || `ID:${uid.slice(-4)}`,
        totalEarned: Math.round(data.totalEarned), 
        tasksCount: data.tasksDetails.length, 
        details: data.tasksDetails,
        isCurrentlyProduction: !!user?.isProduction
      };
    });

    staff.filter(s => s.isProduction && !stats[s.id]).forEach(s => {
      results.push({
        id: s.id, name: s.name, totalEarned: 0, tasksCount: 0, details: [], isCurrentlyProduction: true
      });
    });

    return results
      .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.totalEarned - a.totalEarned);
  }, [orders, staff, selectedMonth, selectedYear, searchTerm]);

  const selectedStaffDetails = useMemo(() => {
    return salaryStats.find(s => s.id === selectedStaffId);
  }, [salaryStats, selectedStaffId]);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Зарплата</h2>
          <p className="text-slate-500 text-sm">Ведомость за {MONTHS[selectedMonth]} {selectedYear}</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
              <div className="px-3 border-r border-slate-100 flex items-center">
                <CalendarDays size={14} className="text-blue-500 mr-2" />
                <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent text-xs font-black uppercase outline-none">
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
              </div>
              <div className="px-3">
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent text-xs font-black uppercase outline-none">
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
           <div className="relative flex-1 max-w-sm">
             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input type="text" placeholder="Поиск сотрудника..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20" />
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
             <thead>
               <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                 <th className="px-8 py-4">Сотрудник</th>
                 <th className="px-8 py-4 text-center">Задач</th>
                 <th className="px-8 py-4 text-right">Сумма</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
                {salaryStats.map(stat => (
                  <tr key={stat.id} onClick={() => setSelectedStaffId(stat.id)} className="hover:bg-slate-50/50 cursor-pointer group transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black">{stat.name.charAt(0)}</div>
                        <div>
                          <div className="font-bold text-slate-800">{stat.name}</div>
                          {!stat.isCurrentlyProduction && <div className="text-[8px] font-black text-amber-600 uppercase">Архив (работал в {MONTHS[selectedMonth]})</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600">{stat.tasksCount}</span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-4">
                        <div className="text-lg font-black text-slate-800">{stat.totalEarned.toLocaleString('ru-RU')} ₽</div>
                        <ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1" />
                      </div>
                    </td>
                  </tr>
                ))}
             </tbody>
          </table>
        </div>
      </div>

      {selectedStaffId && selectedStaffDetails && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-2xl">{selectedStaffDetails.name.charAt(0)}</div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">{selectedStaffDetails.name}</h3>
                    <div className="flex items-center gap-4 mt-1 text-xs font-bold text-slate-400 uppercase tracking-widest">
                       <span>{MONTHS[selectedMonth]} {selectedYear}</span>
                       <span className="text-emerald-600">ИТОГО: {selectedStaffDetails.totalEarned.toLocaleString('ru-RU')} ₽</span>
                    </div>
                  </div>
               </div>
               <button onClick={() => setSelectedStaffId(null)} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"><X size={24} className="text-slate-400"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
               <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-4">Дата</th>
                      <th className="pb-4">Клиент</th>
                      <th className="pb-4">Этап</th>
                      <th className="pb-4 text-center">КТУ (%)</th>
                      <th className="pb-4 text-right">Начислено</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedStaffDetails.details.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 text-xs font-medium text-slate-400">{new Date(d.date).toLocaleDateString('ru-RU')}</td>
                        <td className="py-4">
                           <div className="text-sm font-black text-slate-800">{d.client}</div>
                           <div className="text-[9px] text-slate-400 font-bold uppercase">Заказ #{d.orderNo}</div>
                        </td>
                        <td className="py-4">
                           <div className="flex items-center gap-2">
                             <div className={`p-1.5 rounded-lg text-white ${STAGE_CONFIG[d.stage as ProductionStage].color}`}>{STAGE_CONFIG[d.stage as ProductionStage].icon}</div>
                             <span className="text-xs font-bold text-slate-600">{STAGE_CONFIG[d.stage as ProductionStage].label}</span>
                           </div>
                        </td>
                        <td className="py-4 text-center"><div className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{d.share}%</div></td>
                        <td className="py-4 text-right"><div className="text-sm font-black text-slate-800">{d.amount.toLocaleString('ru-RU')} ₽</div></td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Salaries;
