
import React, { useState } from 'react';
import { Order, TaskStatus } from '../types';
import { STAGE_CONFIG } from '../constants';
import { CheckCircle, Search, History, ChevronDown, Package as PackageIcon, Hash } from 'lucide-react';

interface ArchiveProps {
  orders: Order[];
}

const Archive: React.FC<ArchiveProps> = ({ orders }) => {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const completedOrders = orders.filter(order => 
    order.tasks.find(t => t.stage === 'SHIPMENT')?.status === TaskStatus.COMPLETED
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Поиск в архиве..." className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/10" />
        </div>
        <div className="text-slate-500 text-xs font-bold bg-white px-4 py-2 rounded-xl border border-slate-200 flex items-center gap-2 uppercase tracking-widest">
          <History size={16} /> Всего отгружено: {completedOrders.length}
        </div>
      </div>

      <div className="space-y-4">
        {completedOrders.map((order) => (
          <div key={order.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50/50" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-black"><CheckCircle size={24}/></div>
                <div>
                   <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded uppercase">{order.orderNumber}</span>
                      <h3 className="text-lg font-bold text-slate-800">{order.clientName}</h3>
                   </div>
                   <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Отгружен {new Date(order.tasks.find(t => t.stage === 'SHIPMENT')?.completedAt || '').toLocaleDateString('ru-RU')}</div>
                </div>
              </div>
              <ChevronDown size={20} className={`text-slate-400 transition-transform ${expandedOrder === order.id ? 'rotate-180' : ''}`} />
            </div>
            
            {expandedOrder === order.id && (
              <div className="p-8 pt-0 border-t border-slate-50 animate-in slide-in-from-top-2">
                 <div className="grid grid-cols-2 gap-8 mt-6">
                    <div>
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><PackageIcon size={14}/> Упаковочные листы</h4>
                       <div className="space-y-2">
                          {order.tasks.flatMap(t => t.packages || []).map(pkg => (
                            <div key={pkg.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                               <div><div className="text-xs font-bold text-slate-700">{pkg.name}</div><div className="text-[8px] text-slate-400 font-black uppercase">{pkg.qr}</div></div>
                               <div className="text-[10px] font-black text-blue-500 bg-white px-2 py-1 rounded-lg border border-blue-100">{pkg.detailIds.length} дет.</div>
                            </div>
                          ))}
                       </div>
                    </div>
                    <div>
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Hash size={14}/> Детали заказа</h4>
                       <div className="grid grid-cols-3 gap-2">
                          {order.tasks.find(t => t.stage === 'SAWING')?.details?.map(d => (
                             <div key={d.id} className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-bold text-slate-500 truncate text-center uppercase tracking-tighter">#{d.code}</div>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>
            )}
          </div>
        ))}
        {completedOrders.length === 0 && (
          <div className="py-20 text-center opacity-30 text-slate-400 font-black uppercase tracking-widest">Архив пуст</div>
        )}
      </div>
    </div>
  );
};

export default Archive;
