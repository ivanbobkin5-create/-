
import React, { useState, useEffect } from 'react';
import { BitrixConfig, BitrixFieldMapping } from '../types';
import { 
  Share2, Link as LinkIcon, Save, 
  RefreshCw, CheckCircle2, Layout, Database, 
  MessageSquare, Calendar, ChevronRight, Filter, List
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
  const [b24Structure, setB24Structure] = useState<{funnels: any[], stages: any[]}>({ funnels: [], stages: [] });
  const [isLoadingStructure, setIsLoadingStructure] = useState(false);

  const fetchB24Structure = async () => {
    if (!config.webhookUrl) return;
    setIsLoadingStructure(true);
    try {
      const baseUrl = config.webhookUrl.replace(/\/$/, '');
      
      const funResponse = await fetch(`${baseUrl}/crm.dealcategory.list.json`, { method: 'POST' });
      const funData = await funResponse.json();
      const funnels = [{ ID: "0", NAME: "Общая воронка" }, ...(funData.result || [])];

      const stageResponse = await fetch(`${baseUrl}/crm.status.list.json`, { 
        method: 'POST', 
        body: JSON.stringify({ filter: { "ENTITY_ID": "DEAL_STAGE" } }) 
      });
      const stageData = await stageResponse.json();
      
      setB24Structure({ funnels, stages: stageData.result || [] });
    } catch (e) {
      console.error("Failed to fetch B24 structure", e);
    } finally {
      setIsLoadingStructure(false);
    }
  };

  useEffect(() => {
    if (config.webhookUrl && b24Structure.funnels.length === 0) fetchB24Structure();
  }, [config.webhookUrl]);

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
           <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Webhook URL</label>
              <div className="relative">
                 <LinkIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                 <input type="text" value={config.webhookUrl} onChange={e => setConfig({ ...config, webhookUrl: e.target.value })} placeholder="https://portal.bitrix24.ru/rest/..." className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none focus:border-blue-500 transition-all" />
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Стадии для импорта</h4>
                    <button onClick={fetchB24Structure} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1 hover:underline">
                       <RefreshCw size={12} className={isLoadingStructure ? 'animate-spin' : ''}/> Обновить структуру
                    </button>
                 </div>
                 <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4 max-h-[400px] overflow-y-auto custom-scrollbar space-y-2">
                    {b24Structure.funnels.map(funnel => (
                       <div key={funnel.ID} className="space-y-2">
                          <div className="px-2 py-1 text-[9px] font-black text-slate-400 uppercase tracking-tighter bg-slate-100 rounded-lg">{funnel.NAME}</div>
                          {b24Structure.stages.filter(s => s.ENTITY_ID === `DEAL_STAGE${funnel.ID === "0" ? "" : "_" + funnel.ID}`).map(stage => (
                             <button key={stage.STATUS_ID} onClick={() => toggleStage(stage.STATUS_ID)} className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${config.triggerStageIds.includes(stage.STATUS_ID) ? 'bg-white border-blue-500 shadow-sm' : 'bg-transparent border-transparent hover:bg-slate-100'}`}>
                                <span className="text-xs font-bold text-slate-700">{stage.NAME}</span>
                                {config.triggerStageIds.includes(stage.STATUS_ID) && <CheckCircle2 size={16} className="text-blue-500" />}
                             </button>
                          ))}
                       </div>
                    ))}
                    {b24Structure.funnels.length === 0 && <div className="text-center py-10 text-slate-400 text-xs italic">Введите Webhook URL для загрузки стадий</div>}
                 </div>
              </div>

              <div className="space-y-8">
                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Основные поля</h4>
                    <div className="grid grid-cols-1 gap-4">
                       <div className="relative"><MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="text" value={config.chatUrl || ''} onChange={e => setConfig({ ...config, chatUrl: e.target.value })} placeholder="URL чата компании" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none" /></div>
                       <div className="relative"><Layout className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="text" value={config.portalName || ''} onChange={e => setConfig({ ...config, portalName: e.target.value })} placeholder="Название портала" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none" /></div>
                    </div>
                 </div>
                 <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                    <h5 className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-2">Облачное хранилище</h5>
                    <p className="text-[11px] text-blue-700 leading-relaxed font-medium">Ваши данные автоматически синхронизируются с защищенным сервером PostgreSQL для обеспечения совместной работы.</p>
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
