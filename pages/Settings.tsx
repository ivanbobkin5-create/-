
import React, { useState, useRef } from 'react';
import { BitrixConfig, CloudConfig, BitrixFieldMapping } from '../types';
import { 
  Share2, Link as LinkIcon, Save, 
  RefreshCw, Check, AlertCircle, 
  Database, Trash2, Download, Upload, DatabaseZap, ToggleLeft, ToggleRight, Server, ShieldCheck, CheckCircle2, Terminal
} from 'lucide-react';

interface SettingsProps {
  config: BitrixConfig;
  setConfig: (config: BitrixConfig) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onClear: () => void;
}

const Settings: React.FC<SettingsProps> = ({ config, setConfig, onExport, onImport, onClear }) => {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    setSaveStatus('saving');
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      
      {/* Bitrix24 Integration (Example Placeholder) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-blue-50/30 flex items-center gap-3">
           <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20"><Share2 size={24} /></div>
           <h2 className="text-xl font-bold text-slate-800">Интеграция Bitrix24</h2>
        </div>
        <div className="p-8 space-y-6">
           <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                 <h4 className="font-bold text-slate-800">Статус подключения</h4>
                 <p className="text-xs text-slate-500">Обмен данными со сделками</p>
              </div>
              <button 
                onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${config.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
              >
                {config.enabled ? 'Включено' : 'Выключено'}
              </button>
           </div>

           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Webhook URL</label>
              <div className="relative">
                 <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                 <input 
                   type="text" 
                   value={config.webhookUrl}
                   onChange={e => setConfig({ ...config, webhookUrl: e.target.value })}
                   placeholder="https://your.bitrix24.ru/rest/1/..." 
                   className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-medium" 
                 />
              </div>
           </div>
        </div>
      </div>

      {/* LOCAL DATA SECTION */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-amber-50/30 flex items-center gap-3">
           <div className="p-2 bg-amber-500 text-white rounded-xl"><DatabaseZap size={24} /></div>
           <h2 className="text-xl font-bold text-slate-800">Локальные данные</h2>
        </div>
        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-4">
           <button onClick={onExport} className="flex items-center justify-center gap-2 py-4 bg-slate-100 text-slate-700 rounded-2xl font-bold text-xs hover:bg-slate-200 transition-all border border-slate-200">
              <Download size={16}/> Скачать JSON
           </button>
           <button onClick={() => importInputRef.current?.click()} className="flex items-center justify-center gap-2 py-4 bg-slate-100 text-slate-700 rounded-2xl font-bold text-xs hover:bg-slate-200 transition-all border border-slate-200">
              <Upload size={16}/> Импорт JSON
           </button>
           <button onClick={onClear} className="flex items-center justify-center gap-2 py-4 bg-rose-50 text-rose-600 rounded-2xl font-bold text-xs hover:bg-rose-100 transition-all border border-rose-100">
              <Trash2 size={16}/> Сбросить базу
           </button>
           <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={e => {
             const file = e.target.files?.[0];
             if (file) onImport(file);
           }} />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button onClick={handleSave} className="px-10 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-500/40 hover:bg-blue-700 transition-all flex items-center gap-3 active:scale-95">
           {saveStatus === 'saving' ? <RefreshCw size={18} className="animate-spin" /> : saveStatus === 'saved' ? <CheckCircle2 size={18} /> : <Save size={18} />}
           {saveStatus === 'saving' ? 'Сохранение...' : saveStatus === 'saved' ? 'Применено' : 'Сохранить изменения'}
        </button>
      </div>
    </div>
  );
};

export default Settings;
