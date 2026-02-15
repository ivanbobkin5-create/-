
import React, { useState, useMemo, useRef } from 'react';
import { BitrixConfig, BitrixFunnel, BitrixStage, BitrixFieldMapping } from '../types';
import { 
  Share2, Link as LinkIcon, Info, ToggleLeft, ToggleRight, Save, 
  RefreshCw, Check, AlertCircle, Search, Tag, 
  Database, Image as ImageIcon, Upload, Trash2, LayoutList, ChevronDown, ChevronRight, MessageSquare, UserCircle, Building2
} from 'lucide-react';

interface SettingsProps {
  config: BitrixConfig;
  setConfig: (config: BitrixConfig) => void;
}

interface B24Field {
  id: string;
  name: string;
  type: string;
  isReadOnly?: boolean;
  entity?: 'DEAL' | 'CONTACT' | 'COMPANY' | 'SYSTEM';
}

const Settings: React.FC<SettingsProps> = ({ config, setConfig }) => {
  const [isFetching, setIsFetching] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [availableFunnels, setAvailableFunnels] = useState<BitrixFunnel[]>([]);
  const [availableStages, setAvailableStages] = useState<BitrixStage[]>([]);
  const [availableFields, setAvailableFields] = useState<B24Field[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fieldSearch, setFieldSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMetadata = async () => {
    if (!config.webhookUrl) {
      setFetchError("Сначала введите Webhook URL");
      return;
    }

    let url = config.webhookUrl.trim();
    if (!url.endsWith('/')) url += '/';

    setIsFetching(true);
    setFetchError(null);

    try {
      // 1. Fetch Categories (Funnels)
      const funnelRes = await fetch(`${url}crm.dealcategory.list`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      // 2. Fetch Stages
      const stagesRes = await fetch(`${url}crm.status.list`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      // 3. Fetch Entity Fields
      const dealFieldsRes = await fetch(`${url}crm.deal.fields`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const contactFieldsRes = await fetch(`${url}crm.contact.fields`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const companyFieldsRes = await fetch(`${url}crm.company.fields`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });

      if (!funnelRes.ok || !dealFieldsRes.ok || !stagesRes.ok) throw new Error(`Ошибка подключения. Проверьте Webhook URL.`);

      const funnelData = await funnelRes.json();
      const stagesData = await stagesRes.json();
      const dealFieldsData = await dealFieldsRes.json();
      const contactFieldsData = await contactFieldsRes.json();
      const companyFieldsData = await companyFieldsRes.json();

      if (funnelData.error) throw new Error(funnelData.error_description || "Ошибка API Битрикс24");

      const b24Funnels: BitrixFunnel[] = [{ id: '0', name: 'Общая воронка' }, ...(funnelData.result || []).map((item: any) => ({ id: String(item.ID), name: item.NAME }))];
      const b24Stages: BitrixStage[] = (stagesData.result || []).filter((s: any) => s.ENTITY_ID && (s.ENTITY_ID === 'DEAL_STAGE' || s.ENTITY_ID.startsWith('DEAL_STAGE_'))).map((s: any) => {
        let funnelId = '0';
        if (s.ENTITY_ID.startsWith('DEAL_STAGE_')) funnelId = s.ENTITY_ID.replace('DEAL_STAGE_', '');
        return { id: s.STATUS_ID, name: s.NAME, funnelId: funnelId };
      });

      const allFields: B24Field[] = [];

      // Обработка полей сделок
      if (dealFieldsData.result) {
        Object.entries(dealFieldsData.result).forEach(([key, value]: [string, any]) => {
          allFields.push({
            id: key,
            name: value.title || value.formLabel || key,
            type: value.type || 'string',
            entity: 'DEAL'
          });
        });
      }

      // Обработка полей контактов (префикс CONTACT_)
      if (contactFieldsData.result) {
        Object.entries(contactFieldsData.result).forEach(([key, value]: [string, any]) => {
          allFields.push({
            id: `CONTACT_${key}`,
            name: `[Контакт] ${value.title || value.formLabel || key}`,
            type: value.type || 'string',
            entity: 'CONTACT'
          });
        });
      }

      // Обработка полей компаний (префикс COMPANY_)
      if (companyFieldsData.result) {
        Object.entries(companyFieldsData.result).forEach(([key, value]: [string, any]) => {
          allFields.push({
            id: `COMPANY_${key}`,
            name: `[Компания] ${value.title || value.formLabel || key}`,
            type: value.type || 'string',
            entity: 'COMPANY'
          });
        });
      }

      // Добавление специфических системных полей реквизитов, если их нет
      const commonReqs = [
        { id: 'RequisiteRqLastName', name: '[Реквизиты] Фамилия' },
        { id: 'RequisiteRqFirstName', name: '[Реквизиты] Имя' },
        { id: 'RequisiteRqCompanyName', name: '[Реквизиты] Название организации' }
      ];
      
      commonReqs.forEach(req => {
        if (!allFields.find(f => f.id === req.id)) {
          allFields.push({ id: req.id, name: req.name, type: 'string', entity: 'SYSTEM' });
        }
      });

      setAvailableFunnels(b24Funnels);
      setAvailableFields(allFields.sort((a, b) => a.name.localeCompare(b.name)));
      setAvailableStages(b24Stages);
      
      if (!config.portalName) setConfig({ ...config, portalName: new URL(url).hostname.split('.')[0].toUpperCase() });
    } catch (err: any) { setFetchError(`Ошибка: ${err.message}`); } finally { setIsFetching(false); }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setConfig({ ...config, portalLogo: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    setSaveStatus('saving');
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }, 600);
  };

  const updateMapping = (field: keyof BitrixFieldMapping, value: string) => {
    setConfig({ ...config, fieldMapping: { ...config.fieldMapping, [field]: value } });
    if (saveStatus === 'saved') setSaveStatus('idle');
  };

  const toggleFunnel = (id: string) => {
    const current = config.selectedFunnelIds || [];
    const next = current.includes(id) ? current.filter(i => i !== id) : [...current, id];
    
    let nextTriggerStages = config.triggerStageIds || [];
    if (current.includes(id)) {
        const stagesToRemove = availableStages.filter(s => s.funnelId === id).map(s => s.id);
        nextTriggerStages = nextTriggerStages.filter(sid => !stagesToRemove.includes(sid));
    }
    
    setConfig({ ...config, selectedFunnelIds: next, triggerStageIds: nextTriggerStages });
  };

  const toggleStage = (id: string) => {
    const current = config.triggerStageIds || [];
    const next = current.includes(id) ? current.filter(i => i !== id) : [...current, id];
    setConfig({ ...config, triggerStageIds: next });
  };

  const filteredFields = useMemo(() => {
    if (!fieldSearch) return availableFields;
    const s = fieldSearch.toLowerCase();
    return availableFields.filter(f => f.name.toLowerCase().includes(s) || f.id.toLowerCase().includes(s));
  }, [availableFields, fieldSearch]);

  const mappingLabels = [
    { id: 'orderNumber', label: 'Номер заказа', desc: 'Напр. "ID" или "Заголовок"' },
    { id: 'clientName', label: 'Клиент', desc: 'Напр. Фамилия, Имя или Название' },
    { id: 'deadline', label: 'Дедлайн', desc: 'Дата завершения' },
    { id: 'description', label: 'Техзадание', desc: 'Комментарий или доп. поле' }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10 animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Share2 size={24} /></div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Интеграция и Связь</h2>
              <p className="text-sm text-slate-500">Битрикс24 и настройки чата</p>
            </div>
          </div>
          <button onClick={() => setConfig({ ...config, enabled: !config.enabled })} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${config.enabled ? 'bg-emerald-100 text-emerald-700 shadow-inner' : 'bg-slate-100 text-slate-600'}`}>{config.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}{config.enabled ? 'Активна' : 'Выключена'}</button>
        </div>

        <div className="p-8 space-y-10">
          <section className="space-y-4">
             <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2"><span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px]">1</span>Авторизация</h3>
             <div className="flex gap-3">
                <div className="flex-1">
                   <div className="relative"><LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" value={config.webhookUrl} onChange={e => setConfig({ ...config, webhookUrl: e.target.value })} placeholder="Webhook URL..." className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" /></div>
                   {fetchError && <div className="mt-2 text-rose-600 text-[11px] font-bold flex items-center gap-2"><AlertCircle size={14} />{fetchError}</div>}
                </div>
                <button onClick={fetchMetadata} disabled={isFetching || !config.webhookUrl} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50 h-[46px]">{isFetching ? <RefreshCw size={18} className="animate-spin" /> : <Database size={18} />}Загрузить данные</button>
             </div>
          </section>

          <section className="space-y-4">
             <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2"><span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px]">2</span>Настройка чата</h3>
             <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 space-y-4">
                <p className="text-xs text-blue-700">Укажите ссылку на групповой чат производства. Она будет открываться в новой вкладке при нажатии на раздел "Чат".</p>
                <div className="relative"><MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" value={config.chatUrl || ''} onChange={e => setConfig({ ...config, chatUrl: e.target.value })} placeholder="https://mebelfaktura.bitrix24.ru/online/?IM_DIALOG=chat..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" /></div>
             </div>
          </section>

          {availableFunnels.length > 0 && (
            <section className="space-y-4 animate-in slide-in-from-top-4">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px]">3</span>
                Выбор воронок (направлений)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {availableFunnels.map(funnel => {
                  const isActive = config.selectedFunnelIds?.includes(funnel.id);
                  return (
                    <button
                      key={funnel.id}
                      onClick={() => toggleFunnel(funnel.id)}
                      className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
                        isActive ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                      }`}
                    >
                      <LayoutList size={20} className={isActive ? 'text-white' : 'text-slate-400'} />
                      <span className="text-xs font-bold truncate">{funnel.name}</span>
                      {isActive && <Check size={16} className="ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {config.selectedFunnelIds?.length > 0 && (
            <section className="space-y-4 animate-in slide-in-from-top-4">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px]">4</span>
                Триггерные стадии (Импорт сделок)
              </h3>
              <div className="space-y-6">
                {config.selectedFunnelIds.map(funnelId => {
                  const funnel = availableFunnels.find(f => f.id === funnelId);
                  const stages = availableStages.filter(s => s.funnelId === funnelId);
                  if (!funnel || stages.length === 0) return null;
                  
                  return (
                    <div key={funnelId} className="bg-slate-50 border border-slate-100 rounded-2xl p-6">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        Воронка: <span className="text-slate-800">{funnel.name}</span>
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {stages.map(stage => {
                          const isActive = config.triggerStageIds?.includes(stage.id);
                          return (
                            <button
                              key={stage.id}
                              onClick={() => toggleStage(stage.id)}
                              className={`px-3 py-2 rounded-xl border text-[10px] font-bold transition-all ${
                                isActive ? 'bg-emerald-600 border-emerald-500 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              {stage.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex justify-between items-end">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2"><span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px]">5</span>Сопоставление полей</h3>
              <div className="relative w-64"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Поиск поля (ID или Название)..." value={fieldSearch} onChange={(e) => setFieldSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl outline-none shadow-sm focus:ring-2 focus:ring-blue-500/10" /></div>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {mappingLabels.map((item) => (
                <div key={item.id} className="space-y-2">
                  <div className="flex justify-between items-center px-1"><label className="text-xs font-bold text-slate-700">{item.label}</label><span className="text-[10px] text-slate-400 font-medium">{item.desc}</span></div>
                  <select value={config.fieldMapping[item.id as keyof BitrixFieldMapping]} onChange={(e) => updateMapping(item.id as keyof BitrixFieldMapping, e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none cursor-pointer shadow-sm truncate font-medium text-slate-700">
                    <option value="">-- Выберите поле --</option>
                    <optgroup label="Сделки">
                      {filteredFields.filter(f => f.entity === 'DEAL').map(f => (<option key={f.id} value={f.id}>{f.name} ({f.id})</option>))}
                    </optgroup>
                    <optgroup label="Контакты / Компании">
                      {filteredFields.filter(f => f.entity === 'CONTACT' || f.entity === 'COMPANY').map(f => (<option key={f.id} value={f.id}>{f.name} ({f.id})</option>))}
                    </optgroup>
                    <optgroup label="Системные / Реквизиты">
                      {filteredFields.filter(f => f.entity === 'SYSTEM').map(f => (<option key={f.id} value={f.id}>{f.name} ({f.id})</option>))}
                    </optgroup>
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
             <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2"><span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px]">6</span>Брендинг</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 px-1">Название портала</label>
                  <input type="text" value={config.portalName || ''} onChange={e => setConfig({ ...config, portalName: e.target.value })} placeholder="МОЯ КОМПАНИЯ" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 px-1">Логотип портала</label>
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden">
                        {config.portalLogo ? <img src={config.portalLogo} className="w-full h-full object-contain" /> : <ImageIcon size={24} className="text-slate-300" />}
                     </div>
                     <input type="file" ref={fileInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
                     <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all flex items-center gap-2"><Upload size={14}/> Загрузить</button>
                     {config.portalLogo && <button onClick={() => setConfig({ ...config, portalLogo: undefined })} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button>}
                  </div>
                </div>
             </div>
          </section>

          <div className="pt-6 border-t border-slate-100 flex justify-end gap-4">
            <button onClick={handleSave} disabled={saveStatus !== 'idle'} className={`min-w-[240px] px-10 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95 ${saveStatus === 'saved' ? 'bg-emerald-600 text-white shadow-emerald-500/30' : 'bg-blue-600 text-white shadow-blue-500/30 hover:bg-blue-700 disabled:opacity-70'}`}>{saveStatus === 'idle' && <><Save size={20} /> Сохранить настройки</>}{saveStatus === 'saving' && <><RefreshCw size={20} className="animate-spin" /> Сохранение...</>}{saveStatus === 'saved' && <><Check size={20} /> Сохранено!</>}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
