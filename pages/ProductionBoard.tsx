
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Order, ProductionStage, TaskStatus, Task, User, Detail, Package, UserRole } from '../types';
import { STAGE_CONFIG, STAGE_SEQUENCE, getEmployeeColor } from '../constants';
import { 
  Clock, AlertCircle, Lock, 
  Calendar as CalendarIcon, User as UserIcon, AlertTriangle,
  QrCode, ScanLine, ArrowLeft, Trash2, CheckCircle, PlayCircle,
  Hash, Filter, CheckCircle2, X, LayoutList, Box, PlusCircle, Package as PackageIcon, RefreshCw, Printer, Undo2, GitFork, MessageSquare, Send, UserPlus, Eye, GitBranch, Ban,
  // Fix: Added missing ChevronRight import
  ChevronRight
} from 'lucide-react';

interface ProductionBoardProps {
  orders: Order[];
  onUpdateTask: (orderId: string, taskId: string, status: TaskStatus | 'RESUME', comment?: string) => void;
  onAddAccomplice: (orderId: string, taskId: string, userId: string) => void;
  onUpdateDetails: (orderId: string, taskId: string, details: Detail[], packages?: Package[]) => void;
  staff?: User[];
  currentUser: User;
  onAddB24Comment: (taskId: string, message: string) => Promise<void>;
  isShiftActive: boolean;
  shifts: Record<string, Record<string, boolean>>;
  onTriggerShiftFlash: () => void;
}

const ProductionBoard: React.FC<ProductionBoardProps> = ({ 
  orders, onUpdateTask, onAddAccomplice, onUpdateDetails, 
  staff = [], currentUser, onAddB24Comment, isShiftActive, shifts, onTriggerShiftFlash 
}) => {
  const [activeStage, setActiveStage] = useState<ProductionStage>(ProductionStage.SAWING);
  const [selectedTaskIds, setSelectedTaskIds] = useState<{orderId: string, taskId: string} | null>(null);
  const [scanInput, setScanInput] = useState('');
  const [feedback, setFeedback] = useState<{type: 'success' | 'error', msg: string} | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'mine'>('all');
  const [activePackageId, setActivePackageId] = useState<string | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultComment, setResultComment] = useState('');
  const [newPackageName, setNewPackageName] = useState('');
  const [viewPackage, setViewPackage] = useState<Package | null>(null);
  
  const [splitModal, setSplitModal] = useState<{ detail: Detail, orderId: string, taskId: string } | null>(null);
  const [splitCount, setSplitCount] = useState(2);
  const [splitPrefix, setSplitPrefix] = useState('');

  // Состояние для модального окна брака
  const [defectModal, setDefectModal] = useState<{ detail: Detail, orderId: string, sourceTaskId: string } | null>(null);

  const scanInputRef = useRef<HTMLInputElement>(null);

  const activeSelection = useMemo(() => {
    if (!selectedTaskIds) return null;
    const order = orders.find(o => o.id === selectedTaskIds.orderId);
    if (!order) return null;
    const task = order.tasks.find(t => t.id === selectedTaskIds.taskId);
    if (!task) return null;

    let effectiveDetails: Detail[] = [];
    const sawingTask = order.tasks.find(t => t.stage === ProductionStage.SAWING);
    const sawingDetails = sawingTask?.details || [];

    if (task.stage === ProductionStage.SAWING) {
      effectiveDetails = task.details || [];
    } else if (task.stage !== ProductionStage.KIT_ASSEMBLY && task.stage !== ProductionStage.SHIPMENT) {
       let baseList = [...sawingDetails].filter(d => !d.wasSplit);
       effectiveDetails = baseList.map(d => {
         const existingInCurrent = (task.details || []).find(td => td.code === d.code);
         return existingInCurrent ? { ...existingInCurrent, planQuantity: d.planQuantity || d.quantity } : { ...d, status: 'PENDING' as const, scannedBy: undefined, scannedAt: '', planQuantity: d.quantity, quantity: 0 };
       });
    }

    let allPackages: Package[] = [];
    if (task.stage === ProductionStage.SHIPMENT) {
      const packagingTask = order.tasks.find(t => t.stage === ProductionStage.PACKAGING);
      const kitTask = order.tasks.find(t => t.stage === ProductionStage.KIT_ASSEMBLY);
      allPackages = [...(packagingTask?.packages || []), ...(kitTask?.packages || [])];
    }

    return { order, task, effectiveDetails, allPackages };
  }, [orders, selectedTaskIds]);

  const checkShift = (isKit: boolean = false) => {
    const today = new Date().toISOString().split('T')[0];
    const isScheduled = shifts[currentUser.id]?.[today];

    if (!isScheduled && currentUser.role !== UserRole.COMPANY_ADMIN) {
      alert('Ошибка: Вас нет в графике на сегодня. Работать с задачами запрещено. Обратитесь к администратору.');
      return false;
    }

    if (!isKit && !isShiftActive) {
      alert('Ошибка: Смена не начата. Нажмите кнопку "Начать смену" в шапке сайта.');
      onTriggerShiftFlash();
      return false;
    }
    return true;
  };

  const handleOpenTask = (orderId: string, taskId: string) => {
    const task = orders.find(o => o.id === orderId)?.tasks.find(t => t.id === taskId);
    const isKit = task?.stage === ProductionStage.KIT_ASSEMBLY;
    
    if (checkShift(isKit)) {
      setSelectedTaskIds({ orderId, taskId });
    }
  };

  const printLabel = (pkg: Package, clientName: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const dateStr = new Date().toLocaleString('ru-RU');
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pkg.qr)}`;

    printWindow.document.write(`
      <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@900&display=swap');
            body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background: #fff; color: #000; overflow: hidden; }
            #thermal-label {
              width: 120mm;
              height: 75mm;
              padding: 4mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              overflow: hidden;
            }
            .left-side {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              min-width: 0;
            }
            .right-side {
              width: 35mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 2mm;
            }
            .order-title {
              font-size: 24pt;
              font-weight: 900;
              line-height: 1.0;
              text-transform: uppercase;
              color: #000;
              margin-bottom: 2mm;
              display: -webkit-box;
              -webkit-line-clamp: 3;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
            .package-name {
              font-size: 16pt;
              font-weight: 900;
              color: #000;
              border-top: 3px solid #000;
              padding-top: 2mm;
              margin-top: 2mm;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .info-grid {
              font-size: 11pt;
              font-weight: 900;
              line-height: 1.2;
              color: #000;
            }
            .qr-code { width: 32mm; height: 32mm; }
            .qr-text {
              font-size: 12pt;
              font-weight: 900;
              background: #000;
              color: #fff;
              padding: 1mm;
              text-align: center;
              width: 100%;
              box-sizing: border-box;
              white-space: nowrap;
              overflow: hidden;
            }
            @media print {
              body { width: 120mm; height: 75mm; }
              @page { size: 120mm 75mm; margin: 0; }
            }
          </style>
        </head>
        <body onload="setTimeout(() => { window.print(); window.close(); }, 500);">
          <div id="thermal-label">
            <div style="display: flex; flex-direction: row; align-items: stretch; gap: 4mm; flex: 1;">
              <div class="left-side">
                <div class="order-title">${clientName}</div>
                <div class="info-grid">
                  <div>Сотрудник: <b>${currentUser.name.toUpperCase()}</b></div>
                  <div>Дата: <b>${dateStr}</b></div>
                  <div>ID: <b>${pkg.qr}</b></div>
                  <div class="package-name">${pkg.name.toUpperCase()}</div>
                </div>
              </div>
              <div class="right-side">
                <img class="qr-code" src="${qrImageUrl}" alt="QR" />
                <div class="qr-text">${pkg.qr}</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    const code = scanInput.trim();
    if (!code || !activeSelection) return;
    const { order, task, effectiveDetails, allPackages } = activeSelection;
    
    if (!checkShift(task.stage === ProductionStage.KIT_ASSEMBLY)) {
      setScanInput('');
      return;
    }

    const scannedBy = currentUser.id;
    if (task.status === TaskStatus.PENDING || task.status === TaskStatus.PAUSED) onUpdateTask(order.id, task.id, TaskStatus.IN_PROGRESS);

    if (task.stage === ProductionStage.SAWING) {
       const currentDetails = task.details || [];
       const existingIdx = currentDetails.findIndex(d => d.code === code);
       if (existingIdx !== -1) {
          const updated = [...currentDetails];
          updated[existingIdx] = { ...updated[existingIdx], quantity: (updated[existingIdx].quantity || 1) + 1, scannedBy };
          onUpdateDetails(order.id, task.id, updated);
          showFeedback('success', `Кол-во ${code}: ${updated[existingIdx].quantity}`);
       } else {
          onUpdateDetails(order.id, task.id, [...currentDetails, { id: Math.random().toString(36).substr(2, 9), code, scannedAt: new Date().toISOString(), scannedBy, status: 'SCANNED', quantity: 1 }]);
          showFeedback('success', `Принято: ${code}`);
       }
    } else if (task.stage === ProductionStage.PACKAGING) {
      if (!activePackageId) { showFeedback('error', 'Выберите упаковку'); setScanInput(''); return; }
      const currentPkgs = task.packages || [];
      if (currentPkgs.find(p => p.detailIds.includes(code))) { showFeedback('error', `Деталь уже упакована`); setScanInput(''); return; }
      
      const planDetail = effectiveDetails.find(d => d.code === code);
      if (planDetail) {
        const updatedDetails = [...(task.details || [])];
        const existingIdx = updatedDetails.findIndex(d => d.code === code);
        const currentScanned = existingIdx !== -1 ? (updatedDetails[existingIdx].quantity || 0) : 0;
        const planQty = planDetail.planQuantity || 1;

        if (currentScanned >= planQty) {
          showFeedback('error', `Все единицы ${code} уже упакованы (${planQty})`);
        } else {
          const newScanned = currentScanned + 1;
          const detailToSave = { ...planDetail, quantity: newScanned, status: (newScanned === planQty ? 'VERIFIED' : 'SCANNED') as any, scannedBy, scannedAt: new Date().toISOString() };
          
          if (existingIdx !== -1) updatedDetails[existingIdx] = detailToSave;
          else updatedDetails.push(detailToSave);

          const updatedPkgs = currentPkgs.map(p => p.id === activePackageId ? { ...p, detailIds: [...new Set([...p.detailIds, code])] } : p);
          onUpdateDetails(order.id, task.id, updatedDetails, updatedPkgs);
          showFeedback('success', `Упаковано ${newScanned}/${planQty}`);
        }
      } else showFeedback('error', 'Деталь не из этого заказа');
    } else if (task.stage === ProductionStage.SHIPMENT) {
      const pkgIdx = allPackages.findIndex(p => p.qr === code);
      if (pkgIdx !== -1) {
        const updatedDetails = [...(task.details || [])];
        if (updatedDetails.some(d => d.code === code)) showFeedback('error', 'Уже в машине');
        else {
          updatedDetails.push({ id: Math.random().toString(36).substr(2, 9), code, status: 'VERIFIED', scannedBy, scannedAt: new Date().toISOString(), quantity: 1 });
          onUpdateDetails(order.id, task.id, updatedDetails);
          showFeedback('success', 'Упаковка загружена');
        }
      } else showFeedback('error', 'QR упаковки не найден');
    } else {
      const planDetail = effectiveDetails.find(d => d.code === code);
      if (planDetail) {
        const updatedDetails = [...(task.details || [])];
        const existingIdx = updatedDetails.findIndex(d => d.code === code);
        const currentScanned = existingIdx !== -1 ? (updatedDetails[existingIdx].quantity || 0) : 0;
        const planQty = planDetail.planQuantity || 1;

        if (currentScanned >= planQty) {
          showFeedback('error', `Лимит превышен: ${code} (${planQty})`);
        } else {
          const newScanned = currentScanned + 1;
          const detailToSave = { ...planDetail, quantity: newScanned, status: (newScanned === planQty ? 'VERIFIED' : 'SCANNED') as any, scannedBy, scannedAt: new Date().toISOString() };
          if (existingIdx !== -1) updatedDetails[existingIdx] = detailToSave;
          else updatedDetails.push(detailToSave);
          onUpdateDetails(order.id, task.id, updatedDetails);
          showFeedback('success', `Принято ${newScanned}/${planQty}`);
        }
      } else showFeedback('error', 'Деталь не найдена');
    }
    setScanInput('');
  };

  const removeDetail = (orderId: string, taskId: string, detailId: string) => {
    const task = orders.find(o => o.id === orderId)?.tasks.find(t => t.id === taskId);
    if (task && task.details) {
      onUpdateDetails(orderId, taskId, task.details.filter(d => d.id !== detailId));
      showFeedback('success', 'Деталь удалена');
    }
  };

  const toggleReturnFlag = (orderId: string, taskId: string, detailId: string) => {
     const order = orders.find(o => o.id === orderId);
     const task = order?.tasks.find(t => t.id === taskId);
     if (task && task.details) {
        const updated = task.details.map(d => d.id === detailId ? { ...d, returnAfterEdge: !d.returnAfterEdge } : d);
        onUpdateDetails(orderId, taskId, updated);
     }
  };

  const handleDefectReturn = async (targetStage: ProductionStage) => {
     if (!defectModal) return;
     const { detail, orderId, sourceTaskId } = defectModal;
     const order = orders.find(o => o.id === orderId);
     if (!order) return;

     // Находим целевую задачу
     const targetTask = order.tasks.find(t => t.stage === targetStage);
     if (!targetTask) return;

     // Обновляем целевую задачу: сбрасываем статус детали до PENDING и переоткрываем задачу
     const currentDetails = targetTask.details || [];
     const existingIdx = currentDetails.findIndex(d => d.code === detail.code);
     
     let updatedDetails = [...currentDetails];
     if (existingIdx !== -1) {
        updatedDetails[existingIdx] = { ...updatedDetails[existingIdx], status: 'PENDING', quantity: 0, scannedBy: undefined, scannedAt: '' };
     } else {
        // Если детали нет на том участке (странно, но добавим)
        updatedDetails.push({ ...detail, status: 'PENDING', quantity: 0, scannedBy: undefined, scannedAt: '' });
     }

     onUpdateDetails(orderId, targetTask.id, updatedDetails);
     // Переоткрываем задачу, если она была завершена
     if (targetTask.status === TaskStatus.COMPLETED) {
        onUpdateTask(orderId, targetTask.id, 'RESUME' as any);
     }

     // Добавляем комментарий в Битрикс
     if (targetTask.externalTaskId) {
        await onAddB24Comment(targetTask.externalTaskId, `🚨 ВНИМАНИЕ: Деталь #${detail.code} возвращена на переделку (БРАК) с участка ${STAGE_CONFIG[activeStage].label}`);
     }

     setDefectModal(null);
     showFeedback('error', `Деталь #${detail.code} возвращена на ${STAGE_CONFIG[targetStage].label}`);
  };

  const handleSplitSubmit = () => {
    if (!splitModal) return;
    const { detail, orderId, taskId } = splitModal;
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const sawingTask = order.tasks.find(t => t.stage === ProductionStage.SAWING);
    if (!sawingTask || !sawingTask.details) return;

    const newDetails: Detail[] = [];
    for (let i = 0; i < splitCount; i++) {
      newDetails.push({
        id: Math.random().toString(36).substr(2, 9),
        code: `${splitPrefix}${i + 1}`,
        status: 'PENDING',
        scannedAt: '',
        parentDetailId: detail.id,
        quantity: 1,
        planQuantity: 1
      });
    }

    const updatedSawingDetails = sawingTask.details.map(d => 
       d.id === detail.id ? { ...d, wasSplit: true } : d
    );
    
    onUpdateDetails(orderId, sawingTask.id, [...updatedSawingDetails, ...newDetails]);
    setSplitModal(null);
    setSplitCount(2);
    setSplitPrefix('');
    showFeedback('success', `Деталь разделена на ${splitCount} шт.`);
  };

  const createPackageKit = async () => {
    if (!activeSelection || !newPackageName) return;
    const { order, task } = activeSelection;
    const currentPkgs = task.packages || [];
    const nextNum = currentPkgs.length + 1;
    const qr = `K-${order.orderNumber}-${nextNum}`;
    const newPkg: Package = { id: 'PKG-' + Math.random().toString(36).substr(2, 9), name: newPackageName, sequenceNumber: nextNum, qr, createdAt: new Date().toISOString(), detailIds: [], type: 'FITTINGS' };
    onUpdateDetails(order.id, task.id, task.details || [], [...currentPkgs, newPkg]);
    setNewPackageName('');
    if (task.externalTaskId) await onAddB24Comment(task.externalTaskId, `Создана упаковка фурнитуры: ${newPackageName} (QR: ${qr})`);
  };

  const deletePackage = async (orderId: string, taskId: string, pkgId: string) => {
    const task = orders.find(o => o.id === orderId)?.tasks.find(t => t.id === taskId);
    if (task && task.packages) {
      const pkg = task.packages.find(p => p.id === pkgId);
      onUpdateDetails(orderId, taskId, task.details || [], task.packages.filter(p => p.id !== pkgId));
      if (task.externalTaskId && pkg) await onAddB24Comment(task.externalTaskId, `Удалена упаковка: ${pkg.name}`);
    }
  };

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleCompleteRequest = () => {
    if (!activeSelection) return;
    const { task, order, effectiveDetails, allPackages } = activeSelection;
    
    const scannedTotal = (task.details || []).reduce((sum, d) => sum + (d.quantity || 0), 0);
    const planTotal = task.stage === ProductionStage.SAWING ? scannedTotal : (task.stage === ProductionStage.SHIPMENT ? allPackages.length : effectiveDetails.reduce((sum, d) => sum + (d.planQuantity || 1), 0));

    if (task.stage === ProductionStage.SHIPMENT && scannedTotal < planTotal) {
       alert(`Ошибка: Нельзя завершить отгрузку! Отсканировано ${scannedTotal} из ${planTotal} упаковок. Загрузите всё в машину.`);
       return;
    }

    if (task.stage !== ProductionStage.KIT_ASSEMBLY && scannedTotal < planTotal) {
       const missing = planTotal - scannedTotal;
       if (!window.confirm(`Внимание: не хватает ${missing} ед. деталей. Всё равно завершить этап?`)) return;
    }

    onUpdateTask(order.id, task.id, TaskStatus.COMPLETED);
    setSelectedTaskIds(null);
  };

  const groupedTasks = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    const result = { overdue: [] as any[], today: [] as any[], tomorrow: [] as any[], planned: [] as any[] };

    orders.forEach(order => {
      order.tasks.forEach(task => {
        const baseMatch = task.stage === activeStage && task.status !== TaskStatus.COMPLETED && !!task.plannedDate;
        if (!baseMatch) return;

        const isMine = task.assignedTo === currentUser.id || (task.accompliceIds || []).includes(currentUser.id);
        if (filterType === 'mine' && !isMine) return;

        const assignee = staff.find(s => s.id === task.assignedTo);
        const stageIdx = STAGE_SEQUENCE.indexOf(activeStage);
        let isLocked = false;
        let prevStageLabel = '';
        if (stageIdx > 0) {
          const prevStage = STAGE_SEQUENCE[stageIdx - 1];
          const prevTask = order.tasks.find(t => t.stage === prevStage);
          if (prevTask && prevTask.status !== TaskStatus.COMPLETED) {
            isLocked = true;
            prevStageLabel = STAGE_CONFIG[prevStage].label;
          }
        }
        if (task.stage === ProductionStage.KIT_ASSEMBLY) isLocked = false;

        const item = {
          ...task,
          order,
          assignee,
          isLocked,
          prevStageLabel,
          canUserStart: task.assignedTo === currentUser.id || (task.accompliceIds || []).includes(currentUser.id) || !task.assignedTo || currentUser.role === UserRole.COMPANY_ADMIN
        };

        if (task.plannedDate! < todayStr) result.overdue.push(item);
        else if (task.plannedDate === todayStr) result.today.push(item);
        else if (task.plannedDate === tomorrowStr) result.tomorrow.push(item);
        else result.planned.push(item);
      });
    });
    return result;
  }, [orders, activeStage, filterType, staff, currentUser]);

  const handleIntermediateSubmit = async () => {
    if (!activeSelection || !resultComment) return;
    const { order, task } = activeSelection;
    onUpdateTask(order.id, task.id, TaskStatus.PAUSED, resultComment);
    setShowResultModal(false);
    setResultComment('');
    setSelectedTaskIds(null);
  };

  const takeResponsibility = (orderId: string, taskId: string) => {
    onAddAccomplice(orderId, taskId, currentUser.id);
    showFeedback('success', 'Вы назначены исполнителем');
  };

  const renderTaskGrid = (items: any[], title: string, colorClass: string = 'text-slate-400') => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <h4 className={`text-[10px] font-black ${colorClass} uppercase tracking-[0.2em] whitespace-nowrap`}>{title}</h4>
          <div className="h-px bg-slate-200 flex-1"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-max">
          {items.map(task => (
            <div key={task.id} className={`bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all group ${task.isLocked ? 'opacity-50 grayscale' : 'hover:shadow-xl hover:-translate-y-1'}`}>
              <div className={`h-2 ${STAGE_CONFIG[activeStage].color}`}></div>
              <div className="p-6 flex-1 relative">
                {task.isLocked && <div className="absolute top-4 right-4 bg-slate-900 text-white p-2 rounded-xl shadow-lg"><Lock size={16} /></div>}
                {task.status === TaskStatus.PAUSED && <div className="absolute top-4 right-4 bg-amber-500 text-white px-3 py-1 rounded-xl shadow-lg text-[8px] font-black uppercase">ПАУЗА</div>}
                <div className="flex justify-between items-start mb-4"><span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg uppercase">{task.order.orderNumber}</span><div className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[100px]">{task.assignee?.name || '—'}</div></div>
                <h3 className="font-bold text-slate-800 mb-2 leading-snug text-lg">{task.order.clientName}</h3>
                {task.isLocked && <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl text-[10px] font-bold border border-amber-100 uppercase">Ожидает: {task.prevStageLabel}</div>}
              </div>
              <div className="p-4 bg-slate-50 border-t flex gap-2">
                {!task.isLocked && task.canUserStart ? (
                  <button onClick={() => handleOpenTask(task.order.id, task.id)} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${task.status === TaskStatus.PAUSED ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white hover:bg-black'}`}>
                    {task.status === TaskStatus.PAUSED ? <RefreshCw size={16}/> : task.status === TaskStatus.PENDING ? <PlayCircle size={16} /> : <QrCode size={16} />}
                    {task.status === TaskStatus.PAUSED ? 'Продолжить' : task.status === TaskStatus.PENDING ? 'Приступить' : 'В работу'}
                  </button>
                ) : !task.isLocked ? (
                  <button onClick={() => takeResponsibility(task.order.id, task.id)} className="flex-1 py-3 bg-blue-50 text-blue-600 rounded-2xl text-xs font-black uppercase tracking-widest border border-blue-100 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"><UserPlus size={16} /> Взять на себя</button>
                ) : <div className="flex-1 py-3 text-center text-slate-400 text-[10px] font-black uppercase">Заблокировано</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (activeSelection) {
    const { task, order, effectiveDetails, allPackages } = activeSelection;
    const packages = task.packages || [];
    const scannedUnits = (task.details || []).reduce((sum, d) => sum + (d.quantity || 0), 0);
    const totalUnits = task.stage === ProductionStage.SAWING ? scannedUnits : (task.stage === ProductionStage.SHIPMENT ? allPackages.length : effectiveDetails.reduce((sum, d) => sum + (d.planQuantity || 1), 0));
    const progress = totalUnits > 0 ? Math.round((scannedUnits / totalUnits) * 100) : 0;

    if (task.stage === ProductionStage.KIT_ASSEMBLY) {
      return (
        <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col animate-in fade-in duration-300">
          <header className="h-20 bg-slate-800 border-b border-slate-700 px-8 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-6"><button onClick={() => setSelectedTaskIds(null)} className="p-3 bg-slate-700 text-white rounded-2xl"><ArrowLeft size={24} /></button>
            <div><div className="flex items-center gap-2"><span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded uppercase">{order.orderNumber}</span><h2 className="text-xl font-bold text-white">{order.clientName}</h2></div><div className="text-xs text-slate-400 font-bold uppercase">Комплектация фурнитуры</div></div></div>
            <button onClick={handleCompleteRequest} className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase shadow-xl">Завершить этап</button>
          </header>
          <div className="flex-1 p-10 flex gap-10 overflow-hidden">
            <div className="w-1/4 space-y-6 shrink-0">
               <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 space-y-4">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest text-center">Новая упаковка</h3>
                  <input type="text" value={newPackageName} onChange={e => setNewPackageName(e.target.value)} placeholder="Название..." className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-blue-500" />
                  <button onClick={createPackageKit} className="w-full bg-blue-600 text-white p-3 rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"><PlusCircle size={16}/> Добавить</button>
               </div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-6 content-start overflow-y-auto custom-scrollbar pr-4">
               {packages.map(pkg => (
                  <div key={pkg.id} className="bg-slate-800 border border-slate-700 p-6 rounded-3xl flex justify-between items-center group">
                    <div><div className="text-white font-bold text-lg mb-1">{pkg.name}</div><div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{pkg.qr}</div></div>
                    <div className="flex gap-2">
                       <button onClick={() => printLabel(pkg, order.clientName)} className="p-4 bg-white/5 text-white rounded-2xl hover:bg-blue-600 transition-all flex flex-col items-center gap-1"><Printer size={20} /><span className="text-[8px] font-black uppercase">Печать</span></button>
                       <button onClick={() => deletePackage(order.id, task.id, pkg.id)} className="p-4 bg-white/5 text-rose-500 rounded-2xl hover:bg-rose-600 hover:text-white transition-all"><Trash2 size={20} /></button>
                    </div>
                  </div>
               ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col animate-in fade-in duration-300">
        <header className="h-20 bg-slate-800 border-b border-slate-700 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6"><button onClick={() => setSelectedTaskIds(null)} className="p-3 bg-slate-700 text-white rounded-2xl"><ArrowLeft size={24} /></button>
          <div><div className="flex items-center gap-2"><span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded uppercase">{order.orderNumber}</span><h2 className="text-xl font-bold text-white">{order.clientName}</h2></div><div className="text-xs text-slate-400 font-bold uppercase flex items-center gap-2">{STAGE_CONFIG[task.stage].icon} {STAGE_CONFIG[task.stage].label}</div></div></div>
          <div className="flex items-center gap-4">
             <button onClick={() => setShowResultModal(true)} className="px-6 py-4 bg-slate-700 text-slate-300 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-600 flex items-center gap-2"><MessageSquare size={16}/> Промежуточный итог</button>
             <div className="text-right"><div className="text-[10px] font-black text-slate-500 uppercase mb-1">Готовность (ед.)</div><div className="flex items-center gap-3"><div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-blue-50 transition-all duration-500" style={{ width: `${Math.min(100, progress)}%` }}></div></div><span className="text-lg font-black text-white">{scannedUnits}/{totalUnits || '?'}</span></div></div>
             <button onClick={handleCompleteRequest} className={`ml-4 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest ${scannedUnits >= totalUnits ? 'bg-emerald-600 shadow-emerald-900/20' : 'bg-slate-600 opacity-50'} text-white shadow-xl transition-all`}>Завершить этап</button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/3 bg-slate-800 p-8 border-r border-slate-700 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
             {feedback && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm bg-emerald-500 text-white animate-bounce">{feedback.msg}</div>}
             {task.stage === ProductionStage.PACKAGING && (
                <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-700 space-y-4">
                   <button onClick={() => {
                      const nextNum = (task.packages || []).length + 1;
                      const pkg: Package = { id: 'PKG-' + Math.random().toString(36).substr(2, 9), name: `Место №${nextNum}`, sequenceNumber: nextNum, qr: `P-${order.orderNumber}-${nextNum}`, createdAt: new Date().toISOString(), detailIds: [], type: 'FURNITURE' };
                      onUpdateDetails(order.id, task.id, task.details || [], [...(task.packages || []), pkg]);
                      setActivePackageId(pkg.id);
                   }} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-lg"><PlusCircle size={18}/> Новая упаковка</button>
                   <div className="space-y-2">{packages.map(p => (
                      <div key={p.id} onClick={() => setActivePackageId(p.id)} className={`p-4 rounded-2xl border cursor-pointer transition-all flex justify-between items-center ${activePackageId === p.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                         <div className="min-w-0"><div className="font-bold text-sm truncate">{p.name}</div><div className="text-[9px] font-black opacity-60 uppercase">{p.qr} | {p.detailIds.length} дет.</div></div>
                         <div className="flex gap-1">
                            <button onClick={(e) => {e.stopPropagation(); setViewPackage(p)}} className="p-2 hover:bg-white/20 rounded-lg"><Eye size={16}/></button>
                            <button onClick={(e) => {e.stopPropagation(); printLabel(p, order.clientName)}} className="p-2 hover:bg-white/20 rounded-lg"><Printer size={16}/></button>
                            <button onClick={(e) => {e.stopPropagation(); deletePackage(order.id, task.id, p.id)}} className="p-2 hover:bg-rose-500 hover:text-white rounded-lg"><Trash2 size={16}/></button>
                         </div>
                      </div>
                   ))}</div>
                </div>
             )}
             <div className="bg-slate-900 p-8 rounded-3xl border border-slate-700 flex flex-col items-center justify-center text-center gap-4 shadow-2xl">
                <div className="w-20 h-20 bg-blue-600/20 text-blue-500 rounded-3xl flex items-center justify-center relative"><QrCode size={40} /><ScanLine size={40} className="absolute text-blue-400 animate-bounce" /></div>
                <div><h3 className="text-white font-bold text-lg">Сканирование</h3><p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">QR-код детали</p></div>
                <form onSubmit={handleScan} className="w-full"><input ref={scanInputRef} autoFocus type="text" value={scanInput} onChange={e => setScanInput(e.target.value)} placeholder="СКАНИРУЙТЕ..." className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-4 py-3 text-white text-xl font-bold text-center outline-none focus:border-blue-500 placeholder:opacity-20" /></form>
             </div>
          </div>

          <div className="flex-1 bg-slate-950 overflow-y-auto custom-scrollbar">
             <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-800 border-b border-slate-700 z-10">
                  <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="px-10 py-6">Деталь</th>
                    <th className="px-10 py-6 text-center">План / Факт</th>
                    <th className="px-10 py-6">Кто</th>
                    <th className="px-10 py-6">Статус</th>
                    <th className="px-10 py-6 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                {task.stage === ProductionStage.SAWING ? (task.details || []).map(detail => {
                   const worker = staff.find(s => s.id === detail.scannedBy);
                   return (
                   <tr key={detail.id} className="bg-emerald-500/5">
                    <td className="px-10 py-6"><div className="flex items-center gap-4"><div className="p-2 rounded-lg bg-emerald-500 text-white"><Hash size={18} /></div><div className="text-white font-black text-xl">{detail.code}</div></div></td>
                    <td className="px-10 py-6 text-center text-white font-black">
                       <input type="number" value={detail.quantity || 1} onChange={e => {
                         const val = parseInt(e.target.value);
                         onUpdateDetails(order.id, task.id, (task.details || []).map(d => d.id === detail.id ? { ...d, quantity: val, scannedBy: currentUser.id } : d));
                       }} className="w-16 bg-slate-900 border border-slate-700 rounded-lg py-1 text-center font-bold" />
                    </td>
                    <td className="px-10 py-6"><div className="flex items-center gap-2"><div className={`w-6 h-6 rounded-full ${getEmployeeColor(worker?.name || '')} text-white flex items-center justify-center text-[8px] font-bold`}>{worker?.name.charAt(0)}</div><span className="text-xs text-slate-400 font-bold">{worker?.name.split(' ')[0] || '—'}</span></div></td>
                    <td className="px-10 py-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase bg-emerald-500 text-white px-3 py-1 rounded-xl w-fit">ГОТОВО</span>
                        {detail.returnAfterEdge && <span className="text-[9px] font-bold text-amber-500 flex items-center gap-1 uppercase tracking-tighter"><RefreshCw size={10}/> Возврат после кромки</span>}
                      </div>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => toggleReturnFlag(order.id, task.id, detail.id)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${detail.returnAfterEdge ? 'bg-amber-600 border-amber-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>Вернуть после кромки</button>
                        <button onClick={() => removeDetail(order.id, task.id, detail.id)} className="p-3 text-rose-500 hover:bg-rose-500/20 rounded-xl"><Trash2 size={20}/></button>
                      </div>
                    </td>
                   </tr>
                )}) : task.stage === ProductionStage.SHIPMENT ? allPackages.map(pkg => {
                    const saved = (task.details || []).find(d => d.code === pkg.qr);
                    const isShipped = !!saved;
                    const worker = staff.find(s => s.id === saved?.scannedBy);
                    return (
                      <tr key={pkg.id} className={`${isShipped ? 'bg-emerald-500/5' : ''}`}>
                        <td className="px-10 py-8 text-white font-bold text-xl">{pkg.name}</td>
                        <td className="px-10 py-8 text-center text-slate-500 font-black">1 / {isShipped ? '1' : '0'}</td>
                        <td className="px-10 py-8"><div className="flex items-center gap-2"><div className={`w-6 h-6 rounded-full ${getEmployeeColor(worker?.name || '')} text-white flex items-center justify-center text-[8px] font-bold`}>{worker?.name.charAt(0)}</div><span className="text-xs text-slate-400 font-bold">{worker?.name.split(' ')[0] || '—'}</span></div></td>
                        <td className="px-10 py-8"><span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${isShipped ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-600'}`}>{isShipped ? 'ЗАГРУЖЕНО' : 'ОЖИДАНИЕ'}</span></td>
                        <td className="px-10 py-8 text-right font-mono text-xs text-slate-600">{pkg.qr}</td>
                      </tr>
                    );
                }) : effectiveDetails.map(detail => {
                    const saved = (task.details || []).find(d => d.code === detail.code);
                    const currentScanned = saved?.quantity || 0;
                    const planQty = detail.planQuantity || 1;
                    const isV = currentScanned >= planQty;
                    const pkg = packages.find(p => p.detailIds.includes(detail.code));
                    const worker = staff.find(s => s.id === saved?.scannedBy);
                    const isEdge = task.stage === ProductionStage.EDGE_BANDING;
                    const canRework = task.stage !== ProductionStage.KIT_ASSEMBLY && task.stage !== ProductionStage.SHIPMENT;

                    return (
                      <tr key={detail.id} className={`${isV ? 'bg-emerald-500/5' : ''}`}>
                        <td className="px-10 py-6"><div className="flex items-center gap-6"><div className={`p-4 rounded-2xl ${isV ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-600'}`}><Hash size={24} /></div><div><div className="text-white font-black text-2xl leading-none">{detail.code}</div></div></div></td>
                        <td className="px-10 py-6 text-center text-white font-black text-xl">{planQty} / <span className={currentScanned < planQty ? 'text-amber-500' : 'text-emerald-500'}>{currentScanned}</span></td>
                        <td className="px-10 py-6"><div className="flex items-center gap-2"><div className={`w-6 h-6 rounded-full ${getEmployeeColor(worker?.name || '')} text-white flex items-center justify-center text-[8px] font-bold`}>{worker?.name.charAt(0)}</div><span className="text-xs text-slate-400 font-bold">{worker?.name.split(' ')[0] || '—'}</span></div></td>
                        <td className="px-10 py-6">
                           <div className="flex flex-col gap-1">
                              <span className={`text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-xl w-fit ${isV ? 'bg-emerald-500 text-white' : currentScanned > 0 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{isV ? 'ГОТОВО' : currentScanned > 0 ? 'В ПРОЦЕССЕ' : 'ОЖИДАНИЕ'}</span>
                              {detail.returnAfterEdge && <span className="text-[9px] font-bold text-amber-500 flex items-center gap-1 uppercase tracking-tighter"><RefreshCw size={10}/> Будет возврат в распил</span>}
                           </div>
                        </td>
                        <td className="px-10 py-6 text-right">
                           <div className="flex justify-end gap-2 items-center">
                              {isEdge && detail.returnAfterEdge && isV && !detail.wasSplit && (
                                <button onClick={() => setSplitModal({ detail, orderId: order.id, taskId: task.id })} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20"><GitBranch size={16}/> Получить (Разделить)</button>
                              )}
                              
                              {canRework && (
                                <button onClick={() => setDefectModal({ detail, orderId: order.id, sourceTaskId: task.id })} className="bg-rose-100 text-rose-600 p-3 rounded-xl hover:bg-rose-600 hover:text-white transition-all" title="Брак / Переделка">
                                   <Ban size={20}/>
                                </button>
                              )}

                              {pkg && (
                                <span className="text-[10px] font-black text-blue-400 border border-blue-400/30 px-3 py-1.5 rounded-xl uppercase">{pkg.name}</span>
                              )}
                           </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
             </table>
          </div>
        </div>

        {defectModal && (
          <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in zoom-in duration-300">
             <div className="bg-slate-800 border border-slate-700 rounded-[40px] p-10 max-w-md w-full shadow-2xl text-center space-y-8">
                <div className="w-20 h-20 bg-rose-600 text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl"><Ban size={40}/></div>
                <div>
                   <h3 className="text-2xl font-black text-white mb-2">Брак: Деталь #{defectModal.detail.code}</h3>
                   <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Выберите участок для возврата детали</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                   {STAGE_SEQUENCE.slice(0, STAGE_SEQUENCE.indexOf(activeStage) + 1).map(stage => (
                      <button key={stage} onClick={() => handleDefectReturn(stage)} className="w-full p-4 bg-slate-900 border border-slate-700 rounded-2xl text-left hover:border-rose-500 transition-all group">
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                               <div className={`p-2 rounded-lg ${STAGE_CONFIG[stage].color} text-white`}>{STAGE_CONFIG[stage].icon}</div>
                               <span className="text-sm font-bold text-white uppercase">{STAGE_CONFIG[stage].label}</span>
                            </div>
                            <ChevronRight size={18} className="text-slate-600 group-hover:text-rose-500 transition-colors" />
                         </div>
                      </button>
                   ))}
                </div>
                <button onClick={() => setDefectModal(null)} className="w-full py-4 text-slate-500 font-black text-[10px] uppercase hover:text-white transition-colors tracking-widest">Отмена</button>
             </div>
          </div>
        )}

        {splitModal && (
          <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in zoom-in duration-300">
             <div className="bg-slate-800 border border-slate-700 rounded-[40px] p-10 max-w-md w-full shadow-2xl text-center space-y-8">
                <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl"><GitBranch size={40}/></div>
                <div><h3 className="text-2xl font-black text-white mb-2">Разделение детали</h3><p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Деталь {splitModal.detail.code} после кромки</p></div>
                <div className="space-y-6">
                   <div className="text-left"><label className="text-[10px] font-black text-slate-500 uppercase px-2 mb-2 block">Количество новых деталей</label><input type="number" value={splitCount} onChange={e => setSplitCount(Math.max(2, parseInt(e.target.value) || 0))} className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-6 py-4 text-white text-xl font-bold outline-none focus:border-blue-500 transition-all" /></div>
                   <div className="text-left"><label className="text-[10px] font-black text-slate-500 uppercase px-2 mb-2 block">Префикс/Номера (напр. D-101-)</label><input type="text" value={splitPrefix} onChange={e => setSplitPrefix(e.target.value)} placeholder="Напр: 101-" className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-6 py-4 text-white text-xl font-bold outline-none focus:border-blue-500 transition-all" /></div>
                </div>
                <div className="flex gap-4 pt-4">
                   <button onClick={() => setSplitModal(null)} className="flex-1 py-5 bg-slate-700 text-slate-300 font-black rounded-2xl text-xs uppercase tracking-widest">Отмена</button>
                   <button onClick={handleSplitSubmit} className="flex-1 py-5 bg-blue-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-blue-900/40">Подтвердить</button>
                </div>
             </div>
          </div>
        )}

        {showResultModal && (
          <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
             <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
                <div className="flex items-center gap-4 mb-6 text-slate-800">
                   <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl"><MessageSquare size={24}/></div>
                   <h3 className="text-xl font-bold">Промежуточный итог</h3>
                </div>
                <textarea value={resultComment} onChange={e => setResultComment(e.target.value)} placeholder="Результат будет отправлен в чат Bitrix24..." className="w-full h-40 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm outline-none focus:border-blue-500 mb-6 text-slate-800"></textarea>
                <div className="flex gap-4">
                   <button onClick={() => setShowResultModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl text-[10px] uppercase">Отмена</button>
                   <button onClick={handleIntermediateSubmit} className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-2xl text-[10px] uppercase flex items-center justify-center gap-2"><Send size={14}/> Отправить</button>
                </div>
             </div>
          </div>
        )}

        {viewPackage && (
           <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in">
              <div className="bg-slate-800 rounded-3xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl border border-slate-700">
                 <div className="p-6 bg-slate-900 flex justify-between items-center">
                    <div><h3 className="text-xl font-black text-white">{viewPackage.name}</h3><p className="text-xs text-slate-500 uppercase font-black">{viewPackage.qr}</p></div>
                    <button onClick={() => setViewPackage(null)} className="p-2 text-slate-500 hover:text-white"><X size={24}/></button>
                 </div>
                 <div className="p-6 flex-1 overflow-y-auto custom-scrollbar min-h-[300px]">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Состав упаковки:</h4>
                    <div className="space-y-2">{viewPackage.detailIds.map(code => (
                       <div key={code} className="p-4 bg-slate-900 border border-slate-700 rounded-2xl flex items-center justify-between"><div className="flex items-center gap-4"><Hash className="text-blue-500" size={18}/><span className="text-white font-bold text-lg">{code}</span></div></div>
                    ))}</div>
                    {viewPackage.detailIds.length === 0 && <div className="text-center py-10 text-slate-500 italic">Упаковка пуста</div>}
                 </div>
              </div>
           </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div className="bg-white p-1 rounded-2xl border border-slate-200 flex overflow-x-auto gap-1 shadow-sm">
          {STAGE_SEQUENCE.map(stage => {
            const count = orders.flatMap(o => o.tasks).filter(t => {
               const baseMatch = t.stage === stage && t.status !== TaskStatus.COMPLETED && !!t.plannedDate;
               if (filterType === 'mine') return baseMatch && (t.assignedTo === currentUser.id || (t.accompliceIds || []).includes(currentUser.id));
               return baseMatch;
            }).length;
            return (
              <button key={stage} onClick={() => setActiveStage(stage)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl whitespace-nowrap transition-all ${activeStage === stage ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-600 hover:bg-slate-100'}`}>
                {STAGE_CONFIG[stage].icon} <span className="font-bold text-sm">{STAGE_CONFIG[stage].label}</span>
                {count > 0 && <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${activeStage === stage ? 'bg-white text-blue-600' : 'bg-slate-200 text-slate-600'}`}>{count}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
           <button onClick={() => setFilterType('all')} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${filterType === 'all' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><LayoutList size={14}/> Все</button>
           <button onClick={() => setFilterType('mine')} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${filterType === 'mine' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}`}><UserIcon size={14}/> Мои</button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 space-y-12">
        {renderTaskGrid(groupedTasks.overdue, 'Просрочено', 'text-rose-500')}
        {renderTaskGrid(groupedTasks.today, 'Сегодня', 'text-emerald-500')}
        {renderTaskGrid(groupedTasks.tomorrow, 'Завтра', 'text-blue-500')}
        {renderTaskGrid(groupedTasks.planned, 'Планируемые', 'text-slate-400')}
        
        {groupedTasks.overdue.length === 0 && groupedTasks.today.length === 0 && groupedTasks.tomorrow.length === 0 && groupedTasks.planned.length === 0 && (
          <div className="py-40 text-center opacity-30 text-slate-400 font-black uppercase tracking-widest">Нет активных задач на этом участке</div>
        )}
      </div>
    </div>
  );
};

export default ProductionBoard;
