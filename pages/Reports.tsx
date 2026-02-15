
import React, { useMemo, useState } from 'react';
import { Order, User, TaskStatus, ProductionStage, WorkSession } from '../types';
import { STAGE_CONFIG } from '../constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, AreaChart, Area
} from 'recharts';
import { 
  Calendar, Clock, CheckCircle2, TrendingUp, Users, 
  Download, ChevronRight, Timer, Hash, History, LogIn, LogOut as LogOutIcon
} from 'lucide-react';

interface ReportsProps {
  orders: Order[];
  staff: User[];
  workSessions?: WorkSession[];
}

const Reports: React.FC<ReportsProps> = ({ orders, staff, workSessions = [] }) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'time'>('analytics');
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('month');

  const completedTasks = useMemo(() => {
    return orders.flatMap(order => 
      order.tasks
        .filter(t => t.status === TaskStatus.COMPLETED && t.completedAt)
        .map(t => ({ ...t, order }))
    ).sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
  }, [orders]);

  const employeeStats = useMemo(() => {
    const stats: Record<string, { 
      tasksCount: number, 
      totalTime: number, 
      shifts: Set<string>,
      stages: Record<string, number>
    }> = {};

    orders.flatMap(o => o.tasks).forEach(task => {
      const workerId = task.assignedTo;
      if (!workerId) return;
      if (!stats[workerId]) stats[workerId] = { tasksCount: 0, totalTime: 0, shifts: new Set(), stages: {} };
      if (task.startedAt) stats[workerId].shifts.add(task.startedAt.split('T')[0]);
      if (task.status === TaskStatus.COMPLETED && task.completedAt && task.startedAt) {
        stats[workerId].tasksCount += 1;
        stats[workerId].totalTime += new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime();
        stats[workerId].stages[task.stage] = (stats[workerId].stages[task.stage] || 0) + 1;
      }
    });

    return staff.filter(s => s.isProduction && stats[s.id]).map(s => ({
      id: s.id,
      name: s.name,
      tasksCount: stats[s.id].tasksCount,
      shiftsCount: stats[s.id].shifts.size,
      avgTimeMs: stats[s.id].tasksCount > 0 ? stats[s.id].totalTime / stats[s.id].tasksCount : 0,
      stages: stats[s.id].stages
    })).sort((a, b) => b.tasksCount - a.tasksCount);
  }, [orders, staff]);

  const dailyChartData = useMemo(() => {
    const days: Record<string, number> = {};
    const last14Days = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();
    last14Days.forEach(day => { days[day] = 0; });
    completedTasks.forEach(t => {
      const day = t.completedAt!.split('T')[0];
      if (days[day] !== undefined) days[day]++;
    });
    return Object.entries(days).map(([name, value]) => ({ 
      name: new Date(name).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), 
      value 
    }));
  }, [completedTasks]);

  const formatDuration = (ms: number) => {
    if (ms <= 0) return '—';
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`;
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Отчетность</h2>
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm mt-2 w-fit">
            <button onClick={() => setActiveTab('analytics')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'analytics' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Аналитика производства</button>
            <button onClick={() => setActiveTab('time')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'time' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Учет рабочего времени</button>
          </div>
        </div>
        {activeTab === 'analytics' && (
          <div className="flex items-center gap-3">
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
              <button onClick={() => setTimeRange('week')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${timeRange === 'week' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Неделя</button>
              <button onClick={() => setTimeRange('month')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${timeRange === 'month' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Месяц</button>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'analytics' ? (
        <div className="space-y-8 animate-in fade-in">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Выполнено задач', value: completedTasks.length, icon: <CheckCircle2 />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Активных сотрудников', value: employeeStats.length, icon: <Users />, color: 'text-purple-600', bg: 'bg-purple-50' },
                { label: 'Среднее время / задача', value: formatDuration(employeeStats.reduce((acc, s) => acc + s.avgTimeMs, 0) / (employeeStats.length || 1)), icon: <Clock />, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Выпуск (ед. изд)', value: orders.length, icon: <TrendingUp />, color: 'text-blue-600', bg: 'bg-blue-50' },
              ].map((kpi, i) => (
                <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4"><div className={`p-3 rounded-2xl ${kpi.bg} ${kpi.color}`}>{kpi.icon}</div></div>
                  <div className="text-2xl font-black text-slate-800">{kpi.value}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{kpi.label}</div>
                </div>
              ))}
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2"><TrendingUp size={16} className="text-blue-500" /> Динамика выпуска</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyChartData}>
                      <defs><linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                      <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{fill: '#94a3b8'}} />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2"><Hash size={16} className="text-indigo-500" /> По участкам</h3>
                <div className="space-y-4">{Object.values(ProductionStage).map((stage) => {
                    const count = completedTasks.filter(t => t.stage === stage).length;
                    const percent = Math.round((count / (completedTasks.length || 1)) * 100);
                    return (<div key={stage} className="space-y-2"><div className="flex justify-between items-center text-xs"><span className="font-bold text-slate-700">{STAGE_CONFIG[stage].label}</span><span className="text-slate-400">{count} задач ({percent}%)</span></div><div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${STAGE_CONFIG[stage].color} transition-all duration-1000`} style={{ width: `${percent}%` }}></div></div></div>);
                })}</div>
              </div>
           </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
           <div className="p-8 border-b border-slate-100 bg-slate-50/30">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2"><History size={16} className="text-blue-500" /> Журнал рабочих смен</h3>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left">
                 <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                       <th className="px-8 py-5">Сотрудник</th>
                       <th className="px-8 py-5">Дата</th>
                       <th className="px-8 py-5 text-center">Начало</th>
                       <th className="px-8 py-5 text-center">Конец</th>
                       <th className="px-8 py-5 text-right">Длительность</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {workSessions.sort((a,b) => b.startTime.localeCompare(a.startTime)).map(session => {
                       const worker = staff.find(s => s.id === session.userId);
                       const start = new Date(session.startTime);
                       const end = session.endTime ? new Date(session.endTime) : null;
                       const duration = end ? end.getTime() - start.getTime() : null;
                       return (
                          <tr key={session.id} className="hover:bg-slate-50/50 transition-colors">
                             <td className="px-8 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xs">{worker?.name.charAt(0)}</div><div className="font-bold text-slate-800">{worker?.name}</div></div></td>
                             <td className="px-8 py-4 text-sm font-medium text-slate-500">{start.toLocaleDateString('ru-RU')}</td>
                             <td className="px-8 py-4 text-center"><div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold"><LogIn size={14}/> {start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div></td>
                             <td className="px-8 py-4 text-center">{end ? <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold"><LogOutIcon size={14}/> {end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div> : <span className="text-[10px] font-black text-emerald-500 uppercase animate-pulse">В смене</span>}</td>
                             <td className="px-8 py-4 text-right font-mono font-bold text-slate-700">{duration ? formatDuration(duration) : '—'}</td>
                          </tr>
                       );
                    })}
                    {workSessions.length === 0 && (
                       <tr><td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic opacity-50">Нет данных о рабочих сменах</td></tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
