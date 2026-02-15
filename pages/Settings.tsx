
import React, { useState, useRef } from 'react';
import { BitrixConfig, CloudConfig, BitrixFieldMapping } from '../types';
import { 
  Share2, Link as LinkIcon, Save, 
  RefreshCw, Check, AlertCircle, 
  Database, Trash2, Download, Upload, DatabaseZap, ToggleLeft, ToggleRight, Server, ShieldCheck, CheckCircle2, Terminal
} from 'lucide-react';
import { dbService } from '../dbService';

interface SettingsProps {
  config: BitrixConfig;
  setConfig: (config: BitrixConfig) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onClear: () => void;
}

const Settings: React.FC<SettingsProps> = ({ config, setConfig, onExport, onImport, onClear }) => {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    setSaveStatus('saving');
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  const handleTestConnection = async () => {
    if (!config.cloud) return;
    setIsTesting(true);
    setTestResult(null);
    const result = await dbService.testConnection(config.cloud);
    setTestResult(result);
    setIsTesting(false);
  };

  const updateCloudConfig = (updates: Partial<CloudConfig>) => {
    setConfig({
      ...config,
      cloud: { ...(config.cloud || { enabled: false, apiUrl: '', apiToken: '' }), ...updates }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      
      {/* CLOUD DB SECTION */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20"><Server size={24} /></div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">База данных Timeweb</h2>
                <p className="text-sm text-slate-500 font-medium">Облачное хранилище для всех устройств</p>
              </div>
           </div>
           <button onClick={() => updateCloudConfig({ enabled: !config.cloud?.enabled })} className={`flex items-center gap-2 px-5 py-2 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all ${config.cloud?.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            {config.cloud?.enabled ? <><Check size={14}/> Активна</> : 'Выключена'}
          </button>
        </div>
        
        <div className="p-8 space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">API Endpoint URL (api.php)</label>
                 <div className="relative">
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="text" 
                      value={config.cloud?.apiUrl || ''} 
                      onChange={e => updateCloudConfig({ apiUrl: e.target.value })}
                      placeholder="https://mebel-faktura.ru/api.php" 
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-medium" 
                    />
                 </div>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Секретный токен API</label>
                 <div className="relative">
                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="password" 
                      value={config.cloud?.apiToken || ''} 
                      onChange={e => updateCloudConfig({ apiToken: e.target.value })}
                      placeholder="Придумайте пароль для БД..." 
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-medium" 
                    />
                 </div>
              </div>
           </div>

           <div className="flex flex-col md:flex-row items-center gap-4">
              <button 
                onClick={handleTestConnection}
                disabled={isTesting || !config.cloud?.apiUrl}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs hover:bg-black transition-all disabled:opacity-50"
              >
                {isTesting ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />} Проверить связь с Timeweb
              </button>
              
              {testResult && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold border ${testResult.success ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                  {testResult.success ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
                  {testResult.message}
                </div>
              )}
           </div>

           <div className="bg-slate-900 rounded-2xl p-6 text-slate-300 font-mono text-[11px] leading-relaxed relative group">
              <div className="flex items-center gap-2 text-blue-400 mb-3 border-b border-white/5 pb-2">
                 <Terminal size={14}/> <span>Как настроить Timeweb?</span>
              </div>
              <p className="mb-2">1. Создайте файл <span className="text-white font-bold">api.php</span> в корне вашего сайта.</p>
              <p className="mb-2">2. Создайте БД MySQL в панели Timeweb.</p>
              <p className="mb-2">3. Скрипт должен принимать <span className="text-blue-400">POST</span> (save) и <span className="text-blue-400">GET</span> (load) запросы.</p>
              <p className="text-slate-500 mt-4 italic">// Скрипт будет хранить JSON данные в одной таблице MySQL или файле.</p>
           </div>
        </div>
      </div>

      {/* OTHER SECTIONS... */}
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
           {saveStatus === 'saving' ? 'Сохранение...' : saveStatus === 'saved' ? 'Применено' : 'Сохранить все настройки'}
        </button>
      </div>
    </div>
  );
};

export default Settings;
