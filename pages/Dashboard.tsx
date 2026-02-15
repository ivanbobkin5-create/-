
import React, { useMemo } from 'react';
import { Order, ProductionStage, TaskStatus, User, Task } from '../types';
import { STAGE_CONFIG } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, CheckSquare, ListTodo, Users } from 'lucide-react';

interface DashboardProps {
  orders: Order[];
  staff: User[];
}

const Dashboard: React.FC<DashboardProps> = ({ orders, staff }) => {
  // Статистика по участкам
  const statsByStage = useMemo(() => {
    return Object.values(ProductionStage).map((stage: ProductionStage) => {
      const active = orders.flatMap((o: Order) => o.tasks).filter((t: Task) => t.stage === stage && t.status !== TaskStatus.COMPLETED).length;
      return { name: STAGE_CONFIG[stage].label, value: active };
    });
  }, [orders]);

  // Статистика по исполнителям (загрузка)
  const statsByExecutor = useMemo(() => {
    const activeProductionStaff = staff.filter((s: User) => s.isProduction);
    const allActiveTasks = orders.flatMap((o: Order) => o.tasks).filter((t: Task) => t.status !== TaskStatus.COMPLETED);

    return activeProductionStaff.map((member: User) => {
      const tasksCount = allActiveTasks.filter((t: Task) => t.assignedTo === member.id || t.accompliceIds?.includes(member.id)).length;
      return {
        name: member.name.split(' ')[0],
        fullTitle: member.name,
        value: tasksCount
      };
    }).filter(item => item.value > 0).sort((a, b) => b.value - a.value);
  }, [orders, staff]);

  const totalTasks = orders.flatMap((o: Order) => o.tasks).length;
  const completedTasks = orders.flatMap((o: Order) => o.tasks).filter((t: Task) => t.status === TaskStatus.COMPLETED).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-8 pb-10">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Activity size={24} /></div>
            <div>
              <div className="text-sm font-medium text-slate-500">Активных заказов</div>
              <div className="text-2xl font-bold text-slate-800">{orders.length}</div>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><CheckSquare size={24} /></div>
            <div>
              <div className="text-sm font-medium text-slate-500">Завершено задач</div>
              <div className="text-2xl font-bold text-slate-800">{completedTasks}</div>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><ListTodo size={24} /></div>
            <div>
              <div className="text-sm font-medium text-slate-500">Всего подзадач</div>
              <div className="text-2xl font-bold text-slate-800">{totalTasks}</div>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-xl"><Users size={24} /></div>
            <div>
              <div className="text-sm font-medium text-slate-500">Процент готовности</div>
              <div className="text-2xl font-bold text-slate-800">{completionRate}%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Stage Load Chart */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Activity size={16} className="text-blue-500" /> Загрузка участков
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statsByStage}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} fontSize={10} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" name="Активных задач" radius={[6, 6, 0, 0]}>
                    {statsByStage.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#3b82f6', '#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#f43f5e'][index % 6]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Executor Load Chart */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Users size={16} className="text-indigo-500" /> Загрузка исполнителей
            </h3>
            <div className="h-[300px] w-full">
              {statsByExecutor.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statsByExecutor} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" fontSize={10} axisLine={false} tickLine={false} width={60} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      labelStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="value" name="Задач в работе" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 text-xs font-bold uppercase tracking-widest opacity-40">
                  Исполнители не назначены
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
