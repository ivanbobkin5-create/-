
import React, { useState, useEffect } from 'react';
import { BitrixConfig, BitrixFieldMapping } from '../types';
import { 
  Share2, Link as LinkIcon, Save, 
  RefreshCw, CheckCircle2, Layout, Database, 
  Calendar, ChevronRight, Filter, List, Clock, ChevronDown
} from 'lucide-react';

interface SettingsProps {
  config: BitrixConfig;
  setConfig: (config: BitrixConfig) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onClear: () => void;
}

const Settings: React.FC<SettingsProps> = ({ config, setConfig }) => {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [b24Structure, setB24Structure] = useState<{funnels: any[], stages: any[], fields: any[]}>({ funnels: [], stages: [], fields: [] });
  const [isLoadingStructure, setIsLoadingStructure] = useState(false);
  const [fieldSearch, setFieldSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>("0");

  const safeFetchJson = async (url: string, options: RequestInit) => {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');
    const text = await response.text();

    if (contentType && contentType.includes('application/json')) {
      try {
        return { data: JSON.parse(text), ok: response.ok };
      } catch (e) {
        throw new Error(`Ошибка обработки JSON (${response.status}): ${text.substring(0, 50)}...`);
      }
    }
    
    throw new Error(`Сервер вернул некорректный ответ (${response.status}): ${text.substring(0, 50)}...`);
  };

  const fetchMetadata = async () => {
    if (!config.webhookUrl) return;
    setIsLoadingStructure(true);
    setError(null);
    try {
      const baseUrl = config.webhookUrl.replace(/\/$/, '');
      
      // 1. Fetch Funnels
      const { data: funData, ok: funOk } = await safeFetchJson('/api/b24-proxy', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `${baseUrl}/crm.dealcategory.list.json`, method: 'POST' })
      });
      if (!funOk) throw new Error(funData.message || funData.error_description || "Ошибка получения воронок");
      const funnels = [{ ID: "0", NAME: "Общая воронка" }, ...(funData.result || [])];

      // 2. Fetch Stages
      const { data: stageData, ok: stageOk } = await safeFetchJson('/api/b24-proxy', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: `${baseUrl}/crm.status.list.json`, 
          method: 'POST'
        }) 
      });
      if (!stageOk) throw new Error(stageData.message || stageData.error_description || "Ошибка получения стадий");
      
      const allStages = (stageData.result || []).filter((s: any) => s.ENTITY_ID.startsWith('DEAL_STAGE'));

      // 3. Fetch Fields
      const { data: fieldsData, ok: fieldsOk } = await safeFetchJson('/api/b24-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `${baseUrl}/crm.deal.fields.json`, method: 'POST' })
      });
      if (!fieldsOk) throw new Error(fieldsData.message || fieldsData.error_description || "Ошибка получения полей");
      
      const fields = Object.entries(fieldsData.result || {}).map(([id, info]: [string, any]) => ({
        id,
        title: info.title || info.formLabel || id,
        type: info.type,
        isReadOnly: info.isReadOnly
      }));

      // 4. Fetch Portal Info
      const { data: userData, ok: userOk } = await safeFetchJson('/api/b24-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `${baseUrl}/user.current.json`, method: 'POST' })
      });
      if (userOk && userData.result) {
        setConfig({ 
          ...config, 
          portalName: userData.result.NAME + ' ' + userData.result.LAST_NAME,
          portalLogo: userData.result.PERSONAL_PHOTO
        });
      }
      
      setB24Structure({ funnels, stages: allStages, fields });
    } catch (e: any) {
      console.error("Failed to fetch B24 metadata", e);
      setError(e.message || "Ошибка подключения к Bitrix24");
    } finally {
      setIsLoadingStructure(false);
    }
  };

  useEffect(() => {
    if (config.webhookUrl && b24Structure.funnels.length === 0) fetchMetadata();
  }, [config.webhookUrl]);

  const filteredFields = b24Structure.fields.filter(f => 
    f.title.toLowerCase().includes(fieldSearch.toLowerCase()) || 
    f.id.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  const updateMapping = (key: keyof BitrixFieldMapping, value: string) => {
    setConfig({
      ...config,
      fieldMapping: { ...config.fieldMapping, [key]: value }
    });
    if (saveStatus === 'saved') setSaveStatus('idle');
  };

  const mappingLabels: { key: keyof BitrixFieldMapping; label: string; desc: string }[] = [
    { key: 'orderNumber', label: 'Номер заказа', desc: 'Обычно ID сделки или системное поле' },
    { key: 'clientName', label: 'Имя клиента', desc: 'Название сделки или ФИО контакта' },
    { key: 'deadline', label: 'Крайний срок', desc: 'Дата завершения или кастомное поле даты' },
    { key: 'description', label: 'Описание/Комментарий', desc: 'Текстовое поле с деталями заказа' }
  ];

  const handleSave = () => {
    setSaveStatus('saving');
    localStorage.setItem('woodplan_bitrix_config', JSON.stringify(config));
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  const toggleStage = (stageId: string) => {
    const current = config.triggerStageIds || [];
    const updated = current.includes(stageId) ? current.filter(id => id !== stageId) : [...current, stageId];
    setConfig({ ...config, triggerStageIds: updated });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-in fade-in">
      <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-10 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="p-4 bg-blue-600 text-white rounded-3xl shadow-xl shadow-blue-500/20"><Share2 size={32} /></div>
              <div><h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Интеграция Bitrix24</h2><p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Синхронизация заказов</p></div>
           </div>
           <button onClick={() => setConfig({ ...config, enabled: !config.enabled })} className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${config.enabled ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-200 text-slate-400'}`}>
              {config.enabled ? 'Связь активна' : 'Связь выключена'}
           </button>
        </div>
        
        <div className="p-10 space-y-10">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Webhook URL</label>
                 <div className="relative">
                    <LinkIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input type="text" value={config.webhookUrl} onChange={e => setConfig({ ...config, webhookUrl: e.target.value })} placeholder="https://portal.bitrix24.ru/rest/..." className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none focus:border-blue-500 transition-all" />
                 </div>
              </div>
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Автозавершение смен (время)</label>
                 <div className="relative">
                    <Clock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <select 
                      value={config.autoShiftEndTime || '20:00'} 
                      onChange={e => setConfig({ ...config, autoShiftEndTime: e.target.value })}
                      className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none focus:border-blue-500 transition-all appearance-none"
                    >
                      {Array.from({length: 24}).map((_, i) => {
                        const h = i < 10 ? `0${i}` : `${i}`;
                        return <option key={h} value={`${h}:00`}>{h}:00</option>
                      })}
                    </select>
                 </div>
                 <p className="text-[10px] text-slate-400 px-2 italic">Смена закроется автоматически, если сотрудник забыл нажать кнопку.</p>
              </div>
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Формат оплаты</label>
                 <div className="relative">
                    <select 
                      value={config.paymentFormat || 'rate'} 
                      onChange={e => setConfig({ ...config, paymentFormat: e.target.value as 'rate' | 'salary' })}
                      className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none focus:border-blue-500 transition-all appearance-none"
                    >
                      <option value="rate">Сдельная (Ставка за задачу)</option>
                      <option value="salary">Оклад (Фиксированная оплата)</option>
                    </select>
                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                 </div>
                 <p className="text-[10px] text-slate-400 px-2 italic">При окладе ставки в задачах скрываются.</p>
              </div>
           </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Стадии для импорта</h4>
                    <button onClick={fetchMetadata} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1 hover:underline">
                       <RefreshCw size={12} className={isLoadingStructure ? 'animate-spin' : ''}/> Обновить
                    </button>
                 </div>
                 
                 <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Выберите воронку</label>
                       <select 
                          value={selectedFunnelId} 
                          onChange={e => setSelectedFunnelId(e.target.value)}
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-blue-500 transition-all"
                       >
                          {b24Structure.funnels.map(f => (
                             <option key={f.ID} value={f.ID}>{f.NAME}</option>
                          ))}
                       </select>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4 max-h-[400px] overflow-y-auto custom-scrollbar space-y-2">
                       <div className="px-2 py-1 text-[9px] font-black text-slate-400 uppercase tracking-tighter bg-slate-100 rounded-lg mb-2">
                          Стадии воронки: {b24Structure.funnels.find(f => f.ID === selectedFunnelId)?.NAME || '...'}
                       </div>
                       
                       {b24Structure.stages
                          .filter(s => s.ENTITY_ID === `DEAL_STAGE${selectedFunnelId === "0" ? "" : "_" + selectedFunnelId}`)
                          .map(stage => (
                             <button 
                                key={stage.STATUS_ID} 
                                onClick={() => toggleStage(stage.STATUS_ID)} 
                                className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${config.triggerStageIds.includes(stage.STATUS_ID) ? 'bg-white border-blue-500 shadow-sm' : 'bg-transparent border-transparent hover:bg-slate-100'}`}
                             >
                                <span className="text-xs font-bold text-slate-700">{stage.NAME}</span>
                                {config.triggerStageIds.includes(stage.STATUS_ID) && <CheckCircle2 size={16} className="text-blue-500" />}
                             </button>
                          ))
                       }
                       
                       {b24Structure.funnels.length === 0 && <div className="text-center py-10 text-slate-400 text-xs italic">Введите Webhook URL</div>}
                       {b24Structure.funnels.length > 0 && b24Structure.stages.filter(s => s.ENTITY_ID === `DEAL_STAGE${selectedFunnelId === "0" ? "" : "_" + selectedFunnelId}`).length === 0 && (
                          <div className="text-center py-10 text-slate-400 text-xs italic">Стадии не найдены</div>
                       )}
                    </div>
                 </div>
              </div>

              <div className="lg:col-span-2 space-y-8">
                 <div className="space-y-6">
                    <div className="flex items-center justify-between">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Сопоставление полей</h4>
                       <div className="relative w-48">
                          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                          <input type="text" value={fieldSearch} onChange={e => setFieldSearch(e.target.value)} placeholder="Поиск полей..." className="w-full pl-8 pr-3 py-2 bg-slate-100 border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 ring-blue-500/20" />
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       {mappingLabels.map(m => (
                          <div key={m.key} className="space-y-2">
                             <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">{m.label}</label>
                             <select 
                                value={config.fieldMapping[m.key]} 
                                onChange={e => updateMapping(m.key, e.target.value)}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-blue-500 transition-all"
                             >
                                <option value="">Не выбрано</option>
                                <optgroup label="Системные поля">
                                   {filteredFields.filter(f => !f.id.startsWith('UF_')).map(f => (
                                      <option key={f.id} value={f.id}>{f.title} ({f.id})</option>
                                   ))}
                                </optgroup>
                                <optgroup label="Пользовательские поля (UF_)">
                                   {filteredFields.filter(f => f.id.startsWith('UF_')).map(f => (
                                      <option key={f.id} value={f.id}>{f.title} ({f.id})</option>
                                   ))}
                                </optgroup>
                             </select>
                             <p className="text-[9px] text-slate-400 px-1 italic">{m.desc}</p>
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Дополнительно</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="relative w-full md:col-span-2"><Layout className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="text" value={config.portalName || ''} onChange={e => setConfig({ ...config, portalName: e.target.value })} placeholder="Название портала" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none" /></div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button onClick={handleSave} className="px-12 py-6 bg-blue-600 text-white rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-500/40 hover:bg-blue-700 transition-all flex items-center gap-3 active:scale-95">
           {saveStatus === 'saving' ? <RefreshCw size={20} className="animate-spin" /> : saveStatus === 'saved' ? <CheckCircle2 size={20} /> : <Save size={20} />}
           {saveStatus === 'saving' ? 'Сохранение...' : saveStatus === 'saved' ? 'Сохранено' : 'Применить настройки'}
        </button>
      </div>
    </div>
  );
};

export default Settings;
