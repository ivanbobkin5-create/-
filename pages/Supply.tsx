import React, { useState, useMemo } from 'react';
import { Order, ProductionStage, TaskStatus, SupplyCategory, SupplyStatus, SupplyData, SupplyItem, BitrixConfig } from '../types';
import { STAGE_SEQUENCE } from '../constants';
import { Search, X, Check, AlertCircle, Plus, Trash2 } from 'lucide-react';

interface SupplyProps {
  orders: Order[];
  onUpdateSupplyData: (orderId: string, taskId: string, category: SupplyCategory, data: SupplyItem) => void;
  bitrixConfig?: BitrixConfig;
}

const SUPPLY_COLUMNS = [
  { id: SupplyCategory.FACADES, label: 'Фасады' },
  { id: SupplyCategory.GLASS_METAL, label: 'Стекла/металл' },
  { id: SupplyCategory.COUNTERTOPS, label: 'Столешницы и стеновые' },
  { id: SupplyCategory.CHIPBOARD, label: 'ЛДСП/Кромка/ХДФ' },
  { id: SupplyCategory.FITTINGS, label: 'Фурнитура' }
];

const STATUS_COLORS = {
  [SupplyStatus.NOT_ORDERED]: 'bg-slate-100 text-slate-500',
  [SupplyStatus.ORDERED]: 'bg-blue-100 text-blue-600',
  [SupplyStatus.RECEIVED]: 'bg-emerald-100 text-emerald-600'
};

const STATUS_LABELS = {
  [SupplyStatus.NOT_ORDERED]: 'Не заказано',
  [SupplyStatus.ORDERED]: 'Заказано',
  [SupplyStatus.RECEIVED]: 'Получено'
};

const Supply: React.FC<SupplyProps> = ({ orders, onUpdateSupplyData, bitrixConfig }) => {
  const [search, setSearch] = useState('');
  const [editingCell, setEditingCell] = useState<{ orderId: string, taskId: string, category: SupplyCategory, data: SupplyItem } | null>(null);

  const supplyOrders = useMemo(() => {
    return orders.filter(order => {
      // Find the last production task (excluding MATERIAL_ORDER)
      const productionTasks = order.tasks.filter(t => t.stage !== ProductionStage.MATERIAL_ORDER);
      const lastProdTask = productionTasks.sort((a, b) => STAGE_SEQUENCE.indexOf(b.stage) - STAGE_SEQUENCE.indexOf(a.stage))[0];
      
      // If the last production task is completed, the order is fully done
      if (lastProdTask?.status === TaskStatus.COMPLETED) return false;

      const hasMaterialTask = order.tasks.some(t => t.stage === ProductionStage.MATERIAL_ORDER);
      if (!hasMaterialTask) return false;
      
      if (search) {
        const s = search.toLowerCase();
        return order.orderNumber.toLowerCase().includes(s) || order.clientName.toLowerCase().includes(s);
      }
      return true;
    }).map(order => {
      const materialTask = order.tasks.find(t => t.stage === ProductionStage.MATERIAL_ORDER)!;
      return { order, task: materialTask };
    });
  }, [orders, search]);

  const handleSave = () => {
    if (editingCell) {
      const dataToSave = { ...editingCell.data };
      if (dataToSave.invoices) {
        dataToSave.amount = dataToSave.invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      }
      onUpdateSupplyData(editingCell.orderId, editingCell.taskId, editingCell.category, dataToSave);
      setEditingCell(null);
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Поиск по сделкам..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/10" 
          />
        </div>
      </div>

      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto custom-scrollbar flex-1">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-bold text-slate-700 text-sm w-64 sticky left-0 bg-slate-50 z-10 shadow-[1px_0_0_0_#e2e8f0]">Сделка (Задача)</th>
                {SUPPLY_COLUMNS.map(col => (
                  <th key={col.id} className="p-4 font-bold text-slate-700 text-sm min-w-[160px]">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {supplyOrders.map(({ order, task }) => (
                <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 sticky left-0 bg-white group-hover:bg-slate-50/50 z-10 shadow-[1px_0_0_0_#f1f5f9]">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded uppercase">{order.orderNumber}</span>
                        {order.externalId && bitrixConfig?.webhookUrl && (
                          <a 
                            href={`${bitrixConfig.webhookUrl.split('/rest/')[0]}/crm/deal/details/${order.externalId}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-all"
                            onClick={e => e.stopPropagation()}
                          >
                            <span className="text-[8px] font-black uppercase">B24</span>
                          </a>
                        )}
                      </div>
                      <div className="font-bold text-slate-800 text-sm">{order.clientName}</div>
                      <div className="text-xs text-slate-500 line-clamp-1">{task.title || 'Заказ материалов'}</div>
                    </div>
                  </td>
                  {SUPPLY_COLUMNS.map(col => {
                    const cellData = task.supplyData?.[col.id as SupplyCategory] || {
                      info: '',
                      status: SupplyStatus.NOT_ORDERED,
                      supplier: '',
                      amount: 0,
                      invoices: []
                    };
                    
                    const invoices = cellData.invoices || [];
                    if (!cellData.invoices && cellData.amount) {
                      invoices.push({
                        id: 'inv-legacy',
                        status: cellData.status || SupplyStatus.NOT_ORDERED,
                        supplier: cellData.supplier || '',
                        amount: cellData.amount || 0,
                        info: cellData.info || ''
                      });
                    }

                    const totalSpent = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
                    
                    const getCategoryBudget = (order: Order, category: SupplyCategory) => {
                      if (!order.budgets) return 0;
                      const b = order.budgets;
                      switch (category) {
                        case SupplyCategory.CHIPBOARD:
                          return (b.chipboard || 0) + (b.chipboardReserve || 0) + (b.mdf || 0) + (b.mdfReserve || 0);
                        case SupplyCategory.FACADES:
                          return b.facades || 0;
                        case SupplyCategory.FITTINGS:
                          return b.fittings || 0;
                        case SupplyCategory.COUNTERTOPS:
                          return (b.countertops || 0) + (b.stone || 0);
                        case SupplyCategory.GLASS_METAL:
                          return b.glassMetal || 0;
                        default:
                          return 0;
                      }
                    };

                    const budget = getCategoryBudget(order, col.id as SupplyCategory);
                    const isOverBudget = budget > 0 && totalSpent > budget;
                    
                    return (
                      <td key={col.id} className="p-2">
                        <div 
                          onClick={() => setEditingCell({ orderId: order.id, taskId: task.id, category: col.id as SupplyCategory, data: { ...cellData, invoices } })}
                          className={`p-3 rounded-xl border hover:shadow-sm cursor-pointer transition-all bg-white h-full min-h-[80px] flex flex-col gap-2 ${isOverBudget ? 'border-red-300 bg-red-50/30 hover:border-red-400' : 'border-slate-100 hover:border-blue-300'}`}
                        >
                          <div className="flex justify-between items-start">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${STATUS_COLORS[cellData.status || SupplyStatus.NOT_ORDERED]}`}>
                              {STATUS_LABELS[cellData.status || SupplyStatus.NOT_ORDERED]}
                            </span>
                            <div className="flex flex-col items-end">
                              {totalSpent > 0 && (
                                <span className={`text-[10px] font-bold ${isOverBudget ? 'text-red-600' : 'text-slate-600'}`}>{totalSpent.toLocaleString('ru-RU')} ₽</span>
                              )}
                              {budget > 0 && (
                                <span className="text-[8px] font-bold text-slate-400 uppercase">Бюджет: {budget.toLocaleString('ru-RU')} ₽</span>
                              )}
                            </div>
                          </div>
                          
                          {invoices.length > 0 ? (
                            <div className="space-y-1 mt-1">
                              {invoices.map((inv, idx) => (
                                <div key={inv.id || idx} className="text-[10px] bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                  <div className="flex justify-between font-bold text-slate-600">
                                    <span className="uppercase tracking-wider truncate mr-2">{inv.supplier || 'Без поставщика'}</span>
                                    <span>{inv.amount?.toLocaleString('ru-RU')} ₽</span>
                                  </div>
                                  {inv.info && <div className="text-slate-500 line-clamp-1 mt-0.5">{inv.info}</div>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <>
                              {cellData.supplier && (
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{cellData.supplier}</div>
                              )}
                              {cellData.info && (
                                <div className="text-xs text-slate-700 line-clamp-2">{cellData.info}</div>
                              )}
                              {!cellData.supplier && !cellData.info && cellData.status === SupplyStatus.NOT_ORDERED && (
                                <div className="text-xs text-slate-300 italic mt-auto">Нажмите для заполнения</div>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {supplyOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                    Нет задач на заказ материалов
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingCell && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <AlertCircle size={18} className="text-blue-600"/> 
                {SUPPLY_COLUMNS.find(c => c.id === editingCell.category)?.label}
              </h3>
              <button onClick={() => setEditingCell(null)} className="p-2 hover:bg-white rounded-xl transition-colors"><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Статус категории</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(SupplyStatus).map(status => (
                    <button
                      key={status}
                      onClick={() => setEditingCell({ ...editingCell, data: { ...editingCell.data, status } })}
                      className={`p-2 rounded-xl text-xs font-bold transition-all border ${
                        editingCell.data.status === status 
                          ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Счета от поставщиков</label>
                  <button 
                    onClick={() => {
                      const newInvoices = [...(editingCell.data.invoices || []), { id: 'inv-' + Math.random().toString(36).substr(2, 9), status: SupplyStatus.NOT_ORDERED, supplier: '', amount: 0, info: '' }];
                      setEditingCell({ ...editingCell, data: { ...editingCell.data, invoices: newInvoices } });
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    <Plus size={14} /> Добавить счет
                  </button>
                </div>

                {(!editingCell.data.invoices || editingCell.data.invoices.length === 0) && (
                  <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100 border-dashed text-sm text-slate-400">
                    Нет добавленных счетов
                  </div>
                )}

                {(editingCell.data.invoices || []).map((inv, idx) => (
                  <div key={inv.id || idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 relative group">
                    <button 
                      onClick={() => {
                        const newInvoices = editingCell.data.invoices!.filter((_, i) => i !== idx);
                        setEditingCell({ ...editingCell, data: { ...editingCell.data, invoices: newInvoices } });
                      }}
                      className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                    
                    <div className="space-y-1 pr-8">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Поставщик</label>
                      <input
                        type="text"
                        list="suppliers-list"
                        value={inv.supplier}
                        onChange={(e) => {
                          const newInvoices = [...editingCell.data.invoices!];
                          newInvoices[idx].supplier = e.target.value;
                          setEditingCell({ ...editingCell, data: { ...editingCell.data, invoices: newInvoices } });
                        }}
                        className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm bg-white"
                        placeholder="Название поставщика"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Сумма счета (₽)</label>
                      <input
                        type="number"
                        value={inv.amount || ''}
                        onChange={(e) => {
                          const newInvoices = [...editingCell.data.invoices!];
                          newInvoices[idx].amount = Number(e.target.value);
                          setEditingCell({ ...editingCell, data: { ...editingCell.data, invoices: newInvoices } });
                        }}
                        className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm bg-white"
                        placeholder="0"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Информация</label>
                      <input
                        type="text"
                        value={inv.info}
                        onChange={(e) => {
                          const newInvoices = [...editingCell.data.invoices!];
                          newInvoices[idx].info = e.target.value;
                          setEditingCell({ ...editingCell, data: { ...editingCell.data, invoices: newInvoices } });
                        }}
                        className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm bg-white"
                        placeholder="Дополнительная информация..."
                      />
                    </div>
                  </div>
                ))}
                <datalist id="suppliers-list">
                  {(bitrixConfig?.suppliers || []).map((sup, idx) => (
                    <option key={idx} value={sup} />
                  ))}
                </datalist>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 mt-4">
                <button onClick={() => setEditingCell(null)} className="flex-1 p-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Отмена</button>
                <button onClick={handleSave} className="flex-1 p-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                  <Check size={18} /> Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Supply;
