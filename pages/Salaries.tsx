
import React, { useMemo, useState } from 'react';
import { Order, User, TaskStatus, ProductionStage, Task } from '../types';
import { STAGE_CONFIG } from '../constants';
import { 
  Wallet, TrendingUp, Users, 
  Calendar, Download, ChevronRight, 
  Banknote, PieChart, Info, Search, X, Clock, Timer, Hash, CalendarDays
} from 'lucide-react';

interface SalariesProps {
  orders: Order[];
  staff: User[];
}

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

const Salaries: React.FC<SalariesProps> = ({ orders, staff }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  // Фильтрация заказов по выбранному месяцу и году
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const d = new Date(o.createdAt);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [orders, selectedMonth, selectedYear]);

  // Расчет статистики выплат
  const salaryStats = useMemo(() => {
    const stats: Record<string, { 
      totalEarned: number, 
      tasksDetails: { orderNo: string, client: string, stage: ProductionStage, share: number, amount: number, date: string }[]
    }> = {};

    // Инициализируем тех, кто СЕЙЧАС в цеху (они всегда в списке)
    staff.filter(s => s.isProduction).forEach(s => {
      stats[s.id] = { totalEarned: 0, tasksDetails: [] };
    });

    // Обрабатываем заказы и ищем всех, кто работал
    orders.forEach(order => {
      order.tasks.forEach(task => {
        // Проверяем, попадает ли задача в выбранный период
        const completionDate = task.completedAt || task.plannedDate || order.createdAt;
        const compD = new Date(completionDate);
        if (compD.getMonth() !== selectedMonth || compD.getFullYear() !== selectedYear) return;

        if (task.status === TaskStatus.COMPLETED && task.rate && task.rate > 0) {
          const totalRate = task.rate;
          const details = task.details || [];
          
          if (details.length > 0) {
            const scanMap: Record<string, number> = {};
            details.forEach(d => {
              if (d.scannedBy) {
                // Если сотрудника нет в инициализированных (т.е. он уже не "в цеху"), добавляем его
                if (!stats[d.scannedBy]) stats[d.scannedBy] = { totalEarned: 0, tasksDetails: [] };
                scanMap[d.scannedBy] = (scanMap[d.scannedBy] || 0) + (d.quantity || 1);
              }
            });

            const totalScans = Object.values(scanMap).reduce((a, b) => a + b, 0);
            
            if (totalScans > 0) {
              Object.entries(scanMap).forEach(([userId, count]) => {
                const share = count / totalScans;
                const amount = totalRate * share;
                stats[userId].totalEarned += amount;
                stats[userId].tasksDetails.push({
                  orderNo: order.orderNumber,
                  client: order.clientName,
                  stage: task.stage,
                  share: Math.round(share * 100),
                  amount: Math.round(amount),
                  date: completionDate
                });
              });
            } else if (task.assignedTo) {
              if (!stats[task.assignedTo]) stats[task.assignedTo] = { totalEarned: 0, tasksDetails: [] };
              stats[task.assignedTo].totalEarned += totalRate;
              stats[task.assignedTo].tasksDetails.push({
                orderNo: order.orderNumber,
                client: order.clientName,
                stage: task.stage,
                share: 100,
                amount: totalRate,
                date: completionDate
              });
            }
          } else if (task.assignedTo) {
            if (!stats[task.assignedTo]) stats[task.assignedTo] = { totalEarned: 0, tasksDetails: [] };
            stats[task.assignedTo].totalEarned += totalRate;
            stats[task.assignedTo].tasksDetails.push({
              orderNo: order.orderNumber,
              client: order.clientName,
              stage: task.stage,
              share: 100,
              amount: totalRate,
              date: completionDate
            });
          }
        }
      });
    });

    return Object.entries(stats).map(([userId, data]) => {
      const user = staff.find(s => s.id === userId);
      return {
        id: userId,
        name: user?.name || `Сотрудник #${userId.slice(-4)}`,
        totalEarned: Math.round(data.totalEarned),
        tasksCount: data.tasksDetails.length,
        details: data.tasksDetails
      };
    })
    .filter(s => s.tasksCount > 0 || (staff.find(u => u.id === s.id)?.isProduction)) // Оставляем либо работавших, либо активных в цеху
    .sort((a, b) => b.totalEarned - a.totalEarned);
  }, [orders, staff, selectedMonth, selectedYear]);

  const handleExportExcel = () => {
    const header = ["Имя сотрудника", "Всего задач", "Общая сумма (руб)", "Период"];
    const rows = salaryStats.map(s => [
      s.name,
      s.tasksCount,
      s.totalEarned,
      `${MONTHS[selectedMonth]} ${selectedYear}`
    ]);

    let csvContent = "\uFEFF"; 
    csvContent += [header, ...rows].map(e => e.join(";")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Vedomost_${MONTHS[selectedMonth]}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedStaffDetails = useMemo(() => {
    return salaryStats.find(s => s.id === selectedStaffId);
  }, [salaryStats, selectedStaffId]);

  const filteredSalaries = useMemo(() => {
    return salaryStats.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [salaryStats, searchTerm]);

  const totalPayout = useMemo(() => salaryStats.reduce((acc, s) => acc + s.totalEarned, 0), [salaryStats]);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Заработная плата</h2>
          <p className="text-slate-500 text-sm">Расчет по КТУ на основе сканирований</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
              <div className="relative flex items-center px-3 border-r border-slate-100">
                 <CalendarDays size={14} className="text-blue-500 mr-2" />
                 <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent text-xs font-black uppercase outline-none cursor-pointer">
                    {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                 </select>
              </div>
              <div className="px-3 py-1.5">
                 <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent text-xs font-black uppercase outline-none cursor-pointer">
                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                 </select>
              </div>
           </div>
           <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">
            <Download size={14} /> Ведомость (Excel)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Wallet size={20} /></div>
            <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Фонд: {MONTHS[selectedMonth]}</div>
          </div>
          <div className="text-3xl font-black text-slate-800">{totalPayout.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Banknote size={20} /></div>
            <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Средняя выплата</div>
          </div>
          <div className="text-3xl font-black text-slate-800">
            {Math.round(totalPayout / (salaryStats.length || 1)).toLocaleString('ru-RU')} ₽
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><PieChart size={20} /></div>
            <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Задач закрыто</div>
          </div>
          <div className="text-3xl font-black text-slate-800">
            {salaryStats.reduce((acc, s) => acc + s.tasksCount, 0)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="relative flex-1 max-w-sm">
             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input type="text" placeholder="Поиск сотрудника..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Найдено: {filteredSalaries.length}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-4">Сотрудник</th>
                <th className="px-8 py-4 text-center">Задач</th>
                <th className="px-8 py-4">Активность в периоде</th>
                <th className="px-8 py-4 text-right">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSalaries.map(stat => (
                <tr key={stat.id} onClick={() => setSelectedStaffId(stat.id)} className="hover:bg-slate-50/50 cursor-pointer transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black overflow-hidden shadow-sm">
                        {stat.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{stat.name}</div>
                        {!staff.find(u => u.id === stat.id)?.isProduction && <div className="text-[8px] font-black text-amber-600 uppercase">Не в цеху (архив работ)</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600">{stat.tasksCount}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex gap-2">
                      {stat.details.slice(0, 3).map((d, i) => (
                        <div key={i} className="flex flex-col">
                          <span className="text-[10px] font-bold text-emerald-600">+{d.amount} ₽</span>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter truncate w-20">{d.client}</span>
                        </div>
                      ))}
                      {stat.details.length > 3 && <div className="text-[9px] font-black text-slate-300 self-center">+{stat.details.length - 3}</div>}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-4">
                      <div className="text-lg font-black text-slate-800">{stat.totalEarned.toLocaleString('ru-RU')} ₽</div>
                      <ChevronRight size={14} className="text-slate-300 transition-transform group-hover:translate-x-1" />
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSalaries.length === 0 && (
                <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest opacity-30 italic">Нет данных за выбранный месяц</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedStaffId && selectedStaffDetails && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-2xl">
                    {selectedStaffDetails.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">{selectedStaffDetails.name}</h3>
                    <div className="flex items-center gap-4 mt-1">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><PieChart size={14}/> {selectedStaffDetails.tasksCount} задач в периоде</div>
                      <div className="text-xs font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1"><Banknote size={14}/> {selectedStaffDetails.totalEarned.toLocaleString('ru-RU')} ₽</div>
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
                      <th className="pb-4">Клиент (Сделка)</th>
                      <th className="pb-4">Участок</th>
                      <th className="pb-4 text-center">КТУ %</th>
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
                             <div className={`p-1.5 rounded-lg text-white ${STAGE_CONFIG[d.stage].color}`}>{STAGE_CONFIG[d.stage].icon}</div>
                             <span className="text-xs font-bold text-slate-600">{STAGE_CONFIG[d.stage].label}</span>
                           </div>
                        </td>
                        <td className="py-4 text-center">
                           <div className="inline-flex items-center gap-1.5 text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                             {d.share}%
                           </div>
                        </td>
                        <td className="py-4 text-right">
                           <div className="text-sm font-black text-slate-800">{d.amount.toLocaleString('ru-RU')} ₽</div>
                        </td>
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
