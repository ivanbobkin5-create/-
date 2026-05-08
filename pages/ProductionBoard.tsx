
import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Order, ProductionStage, TaskStatus, Task, User, Detail, Package, UserRole, BitrixConfig } from '../types';
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
  onAddB24Comment: (order: Order, task: Task, message: string) => Promise<void>;
  isShiftActive: boolean;
  shifts: Record<string, Record<string, boolean>>;
  onTriggerShiftFlash: () => void;
  bitrixConfig?: BitrixConfig;
}

const generateId = (prefix: string = '') => {
  return prefix + Math.random().toString(36).substring(2, 11);
};

const ProductionBoard: React.FC<ProductionBoardProps> = ({ 
  orders, onUpdateTask, onAddAccomplice, onUpdateDetails, 
  staff = [], currentUser, onAddB24Comment, isShiftActive, shifts, onTriggerShiftFlash, bitrixConfig 
}) => {
  const [activeStage, setActiveStage] = useState<ProductionStage>(ProductionStage.SAWING);
  const [selectedTaskIds, setSelectedTaskIds] = useState<{orderId: string, taskId: string} | null>(null);
  const [scanInput, setScanInput] = useState('');
  const [feedback, setFeedback] = useState<{type: 'success' | 'error', msg: string} | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'mine'>('all');
  const [activePackageId, setActivePackageId] = useState<string | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultComment, setResultComment] = useState('');
  const [driverNameModal, setDriverNameModal] = useState(false);
  const [driverName, setDriverName] = useState('');
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
       const baseList = [...sawingDetails].filter(d => !d.wasSplit);
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
      showFeedback('error', 'Вас нет в графике на сегодня. Работать запрещено.');
      return false;
    }

    if (!isKit && !isShiftActive) {
      showFeedback('error', 'Смена не начата. Нажмите "Начать смену" в шапке.');
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

  const findDetailMatch = (details: Detail[], scanCode: string) => {
    const code = scanCode.trim().toLowerCase();
    return details.findIndex(d => 
      d.code.toLowerCase() === code || 
      d.code.toLowerCase().endsWith('_' + code) || 
      code.endsWith('_' + d.code.toLowerCase())
    );
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
       const existingIdx = findDetailMatch(currentDetails, code);
       if (existingIdx !== -1) {
          const updated = [...currentDetails];
          const planQty = updated[existingIdx].planQuantity || 1;
          const currentScanned = updated[existingIdx].quantity || 0;
          if (currentScanned >= planQty) {
             showFeedback('error', `Лимит превышен: ${code} (${planQty})`);
          } else {
             const newScanned = currentScanned + 1;
             updated[existingIdx] = { ...updated[existingIdx], quantity: newScanned, status: newScanned >= planQty ? 'SCANNED' : 'PENDING', scannedBy, scannedAt: new Date().toISOString() };
             onUpdateDetails(order.id, task.id, updated);
             showFeedback('success', `Принято ${newScanned}/${planQty}`);
          }
       } else {
          showFeedback('error', `Деталь ${code} не найдена в плане`);
       }
    } else if (task.stage === ProductionStage.PACKAGING) {
      if (!activePackageId) { showFeedback('error', 'Выберите упаковку'); setScanInput(''); return; }
      
      const planIdx = findDetailMatch(effectiveDetails, code);
      if (planIdx !== -1) {
        const planDetail = effectiveDetails[planIdx];
        const actualCode = planDetail.code;

        const currentPkgs = task.packages || [];
        if (currentPkgs.find(p => p.id === activePackageId && p.detailIds.includes(actualCode))) { showFeedback('error', `Деталь уже в этой упаковке`); setScanInput(''); return; }

        const updatedDetails = [...(task.details || [])];
        const existingIdx = findDetailMatch(updatedDetails, actualCode);
        const currentScanned = existingIdx !== -1 ? (updatedDetails[existingIdx].quantity || 0) : 0;
        const planQty = planDetail.planQuantity || 1;

        if (currentScanned >= planQty) {
          showFeedback('error', `Все единицы ${actualCode} уже упакованы (${planQty})`);
        } else {
          const newScanned = currentScanned + 1;
          const detailToSave = { ...planDetail, quantity: newScanned, status: (newScanned === planQty ? 'VERIFIED' : 'SCANNED') as any, scannedBy, scannedAt: new Date().toISOString() };
          
          if (existingIdx !== -1) updatedDetails[existingIdx] = detailToSave;
          else updatedDetails.push(detailToSave);

          const updatedPkgs = currentPkgs.map(p => p.id === activePackageId ? { ...p, detailIds: [...new Set([...p.detailIds, actualCode])] } : p);
          onUpdateDetails(order.id, task.id, updatedDetails, updatedPkgs);
          showFeedback('success', `Упаковано ${newScanned}/${planQty}`);
        }
      } else showFeedback('error', 'Деталь не из этого заказа');
    } else if (task.stage === ProductionStage.SHIPMENT) {
      const pkgIdx = allPackages.findIndex(p => p.qr === code || p.qr.endsWith('_' + code) || code.endsWith('_' + p.qr));
      if (pkgIdx !== -1) {
        const actualCode = allPackages[pkgIdx].qr;
        const updatedDetails = [...(task.details || [])];
        if (updatedDetails.some(d => d.code === actualCode)) showFeedback('error', 'Уже в машине');
        else {
          updatedDetails.push({ id: generateId(), code: actualCode, status: 'VERIFIED', scannedBy, scannedAt: new Date().toISOString(), quantity: 1 });
          onUpdateDetails(order.id, task.id, updatedDetails);
          showFeedback('success', 'Упаковка загружена');
        }
      } else showFeedback('error', 'QR упаковки не найден');
    } else {
      const planIdx = findDetailMatch(effectiveDetails, code);
      if (planIdx !== -1) {
        const planDetail = effectiveDetails[planIdx];
        const updatedDetails = [...(task.details || [])];
        const existingIdx = findDetailMatch(updatedDetails, code);
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
     if (!checkShift(activeStage === ProductionStage.KIT_ASSEMBLY)) return;
     
     const order = orders.find(o => o.id === orderId);
     if (!order) return;

     // Находим целевую задачу
     const targetTask = order.tasks.find(t => t.stage === targetStage);
     if (!targetTask) return;

     // Обновляем целевую задачу: сбрасываем статус детали до PENDING и переоткрываем задачу
     const currentDetails = targetTask.details || [];
     const existingIdx = currentDetails.findIndex(d => d.code === detail.code);
     
     const updatedDetails = [...currentDetails];
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
        await onAddB24Comment(order, targetTask, `🚨 ВНИМАНИЕ: Деталь #${detail.code} возвращена на переделку (БРАК) с участка ${STAGE_CONFIG[activeStage].label}`);
     }

     setDefectModal(null);
     showFeedback('error', `Деталь #${detail.code} возвращена на ${STAGE_CONFIG[targetStage].label}`);
  };

  const handleSplitSubmit = () => {
    if (!splitModal) return;
    const { detail, orderId, taskId } = splitModal;
    if (!checkShift(activeStage === ProductionStage.KIT_ASSEMBLY)) return;
    
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const sawingTask = order.tasks.find(t => t.stage === ProductionStage.SAWING);
    if (!sawingTask || !sawingTask.details) return;

    const newDetails: Detail[] = [];
    for (let i = 0; i < splitCount; i++) {
      newDetails.push({
        id: generateId(),
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
    if (!checkShift(task.stage === ProductionStage.KIT_ASSEMBLY)) return;

    const currentPkgs = task.packages || [];
    const nextNum = currentPkgs.length + 1;
    const qr = `K-${order.orderNumber}-${nextNum}`;
    const newPkg: Package = { id: generateId('PKG-'), name: newPackageName, sequenceNumber: nextNum, qr, createdAt: new Date().toISOString(), detailIds: [], type: 'FITTINGS' };
    onUpdateDetails(order.id, task.id, task.details || [], [...currentPkgs, newPkg]);
    setNewPackageName('');
    if (task.externalTaskId) await onAddB24Comment(order, task, `Создана упаковка фурнитуры: ${newPackageName} (QR: ${qr})`);
  };

  const deletePackage = async (orderId: string, taskId: string, pkgId: string) => {
    const order = orders.find(o => o.id === orderId);
    const task = order?.tasks.find(t => t.id === taskId);
    if (task && task.packages) {
      if (!checkShift(task.stage === ProductionStage.KIT_ASSEMBLY)) return;
      
      const pkg = task.packages.find(p => p.id === pkgId);
      onUpdateDetails(orderId, taskId, task.details || [], task.packages.filter(p => p.id !== pkgId));
      if (task.externalTaskId && pkg) await onAddB24Comment(order!, task, `Удалена упаковка: ${pkg.name}`);
    }
  };

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleCompleteRequest = () => {
    if (!activeSelection) return;
    const { task, order, effectiveDetails, allPackages } = activeSelection;
    
    if (!checkShift(task.stage === ProductionStage.KIT_ASSEMBLY)) return;

    const scannedTotal = (task.details || []).reduce((sum, d) => sum + (d.quantity || 0), 0);
    const planTotal = task.stage === ProductionStage.SAWING ? scannedTotal : (task.stage === ProductionStage.SHIPMENT ? allPackages.length : effectiveDetails.reduce((sum, d) => sum + (d.planQuantity || 1), 0));

    if (task.stage === ProductionStage.SHIPMENT && scannedTotal < planTotal) {
       alert(`Ошибка: Нельзя завершить отгрузку! Отсканировано ${scannedTotal} из ${planTotal} упаковок. Загрузите всё в машину.`);
       return;
    }

    if (task.stage === ProductionStage.SHIPMENT) {
      setDriverNameModal(true);
      return;
    }

    let comment = `Задача завершена в полном объеме.`;
    if (task.stage === ProductionStage.SAWING || task.stage === ProductionStage.EDGE_BANDING) {
      const registered = (task.details || []).reduce((sum, d) => sum + (d.quantity || 0), 0);
      const returns = (task.details || []).filter(d => d.returnAfterEdge).map(d => d.code).join(', ');
      comment = `Зарегистрировано деталей: ${registered}. К возврат: ${returns || 'нет'}`;
    } else if (scannedTotal < planTotal) {
       const missing = planTotal - scannedTotal;
       if (!window.confirm(`Внимание: не хватает ${missing} ед. деталей. Всё равно завершить этап?`)) return;
       comment = `ВНИМАНИЕ: Задача завершена с нехваткой ${missing} ед. деталей.`;
    }

    onUpdateTask(order.id, task.id, TaskStatus.COMPLETED, comment);
    setSelectedTaskIds(null);
  };

  const groupedTasks = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    const result = { overdue: [] as any[], today: [] as any[], tomorrow: [] as any[], planned: [] as any[] };

    const isOrderDone = (order: Order) => {
      const shipmentTask = order.tasks.find(t => t.stage === ProductionStage.SHIPMENT);
      if (shipmentTask && shipmentTask.status === TaskStatus.COMPLETED) return true;
      return order.tasks.length > 0 && order.tasks.every(t => t.status === TaskStatus.COMPLETED);
    };

    orders.forEach(order => {
      if (isOrderDone(order)) return;
      
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
          let prevStage = STAGE_SEQUENCE[stageIdx - 1];
          
          // Custom dependency logic
          if (activeStage === ProductionStage.ASSEMBLY || activeStage === ProductionStage.PACKAGING) {
            prevStage = ProductionStage.DRILLING;
          }
          
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
    if (!checkShift(task.stage === ProductionStage.KIT_ASSEMBLY)) return;

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
                <div className="flex justify-between items-start mb-4">
                  <div className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[100px]">{task.assignee?.name || '—'}</div>
                  {task.externalTaskId && task.externalTaskId !== 'undefined' && bitrixConfig?.webhookUrl ? (
                    <a 
                      href={`${bitrixConfig.webhookUrl.split('/rest/')[0]}/company/personal/user/0/tasks/task/view/${task.externalTaskId}/`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all"
                      title="Открыть в Битрикс24"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-[8px] font-black uppercase tracking-widest">B24</span>
                    </a>
                  ) : (
                    <div className="px-2 py-1 bg-slate-50 text-slate-300 rounded-lg opacity-50" title="Не привязано к Bitrix24">
                      <span className="text-[8px] font-black uppercase tracking-widest">B24</span>
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-slate-800 mb-2 leading-snug text-lg">{task.order.clientName}</h3>
                {(task.notes || task.order.description) && (
                  <p className="text-[10px] text-slate-500 line-clamp-2 mb-2 italic">
                    {task.notes ? (
                      <span dangerouslySetInnerHTML={{ __html: task.notes.length > 100 ? task.notes.substring(0, 100) + '...' : task.notes }} />
                    ) : (
                      task.order.description
                    )}
                  </p>
                )}
                {task.isLocked && <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl text-[10px] font-bold border border-amber-100 uppercase">Ожидает: {task.prevStageLabel}</div>}
              </div>
              <div className="p-4 bg-slate-50 border-t flex gap-2">
                {!task.isLocked && task.canUserStart ? (
                  <button 
                    onClick={() => handleOpenTask(task.order.id, task.id)} 
                    disabled={!isShiftActive && task.stage !== ProductionStage.KIT_ASSEMBLY}
                    className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${!isShiftActive && task.stage !== ProductionStage.KIT_ASSEMBLY ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : (task.status === TaskStatus.PAUSED ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white hover:bg-black')}`}
                  >
                    {task.status === TaskStatus.PAUSED ? <RefreshCw size={16}/> : task.status === TaskStatus.PENDING ? <PlayCircle size={16} /> : <QrCode size={16} />}
                    {task.status === TaskStatus.PAUSED ? 'Продолжить' : task.status === TaskStatus.PENDING ? 'Приступить' : 'В работу'}
                  </button>
                ) : !task.isLocked ? (
                  <button 
                    onClick={() => takeResponsibility(task.order.id, task.id)} 
                    disabled={!isShiftActive && task.stage !== ProductionStage.KIT_ASSEMBLY}
                    className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${!isShiftActive && task.stage !== ProductionStage.KIT_ASSEMBLY ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-600 hover:text-white'}`}
                  >
                    <UserPlus size={16} /> Взять на себя
                  </button>
                ) : <div className="flex-1 py-3 text-center text-slate-400 text-[10px] font-black uppercase">Заблокировано</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSelection) return;

    const { order, task } = activeSelection;
    if (!checkShift(task.stage === ProductionStage.KIT_ASSEMBLY)) {
      e.target.value = '';
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Попытка получить номер заказа из ячейки B1
      const cellB1 = worksheet['B1'] ? worksheet['B1'].v : null;
      const orderNumberFromFile = cellB1 ? String(cellB1).trim() : order.orderNumber;

      let hasMdf = false;
      const parsedDetails: Detail[] = [];

      for (let i = 0; i < json.length; i++) {
        const row = json[i];
        if (!row || !Array.isArray(row) || row.length === 0) continue;
        
        const designation = row[0];
        const material = row[2];
        const quantity = row[3] || row[1]; // Try row[1] if row[3] is empty
        const length = row[4];
        const width = row[5];

        const designationStr = String(designation || '').trim();
        const matStr = material ? String(material).trim() : '';
        const matUpper = matStr.toUpperCase();
        
        if (!designationStr) continue;

        // More robust quantity detection: try row[3] first, then row[1]
        let rawQty = row[3];
        let parsedQty = parseInt(String(rawQty || '').replace(/\s/g, ''), 10);
        if (isNaN(parsedQty) || parsedQty <= 0) {
          rawQty = row[1];
          parsedQty = parseInt(String(rawQty || '').replace(/\s/g, ''), 10);
        }

        const isDetailMaterial = 
          matUpper.includes('ХДФ') || 
          matUpper.includes('ЛДСП') || 
          matUpper.includes('МДФ') || 
          matUpper.includes('HDF') || 
          matUpper.includes('MDF') || 
          matUpper.includes('LAMINATED') ||
          matUpper.includes('ДВП') ||
          matUpper.includes('ПЛИТА');

        if (!isDetailMaterial) continue;

        if (isNaN(parsedQty) || parsedQty <= 0) continue;

        if (matUpper.includes('МДФ')) hasMdf = true;
        
        const detailCode = `${orderNumberFromFile}_${designationStr}`;
        
        const lenStr = String(length || '').trim();
        const widStr = String(width || '').trim();
        const sizeStr = (lenStr && widStr) ? `${lenStr}х${widStr}` : (lenStr || '');

        const formattedName = `${designationStr} | ${matStr} | ${parsedQty} | ${sizeStr}`;
        
        const existingIdx = parsedDetails.findIndex(d => d.code === detailCode);
        if (existingIdx >= 0) {
          parsedDetails[existingIdx].planQuantity = (parsedDetails[existingIdx].planQuantity || 0) + parsedQty;
          parsedDetails[existingIdx].name = `${designationStr} | ${matStr} | ${parsedDetails[existingIdx].planQuantity} | ${sizeStr}`;
        } else {
          parsedDetails.push({
            id: generateId('det-'),
            code: detailCode,
            name: formattedName,
            material: matStr,
            size: sizeStr,
            quantity: 0,
            planQuantity: parsedQty,
            status: 'PENDING',
            scannedAt: '',
            _material: matUpper 
          } as any);
        }
      }

      if (parsedDetails.length === 0) {
        setFeedback({ type: 'error', msg: 'Не найдено ни одной детали в файле' });
        setTimeout(() => setFeedback(null), 3000);
        return;
      }

      let finalDetails = parsedDetails;
      if (hasMdf) {
        const includeMdf = window.confirm('В файле найден материал МДФ. Пилим МДФ? (ОК - да, Отмена - нет)');
        if (!includeMdf) {
          finalDetails = parsedDetails.filter(d => !(d as any)._material.includes('МДФ'));
        }
      }

      finalDetails = finalDetails.map(d => {
        const { _material, ...rest } = d as any;
        return rest;
      });

      const existingDetails = task.details || [];
      const mergedDetails = [...existingDetails];

      finalDetails.forEach(newDet => {
        const existingIdx = mergedDetails.findIndex(e => e.code === newDet.code);
        if (existingIdx >= 0) {
          mergedDetails[existingIdx] = {
            ...mergedDetails[existingIdx],
            name: newDet.name,
            planQuantity: newDet.planQuantity,
            material: newDet.material,
            size: newDet.size
          };
        } else {
          mergedDetails.push(newDet);
        }
      });

      onUpdateDetails(order.id, task.id, mergedDetails);
      setFeedback({ type: 'success', msg: `Загружено ${finalDetails.length} деталей` });
      setTimeout(() => setFeedback(null), 3000);

    } catch (error) {
      console.error(error);
      alert('Ошибка при чтении файла');
    }
    
    e.target.value = '';
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
            <div className="flex items-center gap-6">
              <button onClick={() => setSelectedTaskIds(null)} className="p-3 bg-slate-700 text-white rounded-2xl">
                <ArrowLeft size={24} />
              </button>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                {STAGE_CONFIG[task.stage].icon}
                {STAGE_CONFIG[task.stage].label}
              </h2>
            </div>
            <button onClick={handleCompleteRequest} className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase shadow-xl">Завершить этап</button>
          </header>
          <div className="flex-1 p-10 flex gap-10 overflow-hidden">
            <div className="w-1/4 space-y-6 shrink-0">
               {(task.notes || order.description) && (
                 <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-700">
                   <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Описание задачи</h3>
                   <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed prose prose-invert prose-sm max-w-none">
                      {task.notes ? (
                        <div dangerouslySetInnerHTML={{ __html: task.notes }} />
                      ) : (
                        <p>{order.description}</p>
                      )}
                   </div>
                 </div>
               )}
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
            <div className="flex items-center gap-6">
              <button onClick={() => setSelectedTaskIds(null)} className="p-3 bg-slate-700 text-white rounded-2xl">
                <ArrowLeft size={24} />
              </button>
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                  {STAGE_CONFIG[task.stage].icon}
                  {STAGE_CONFIG[task.stage].label}
                </h2>
                {task.externalTaskId && task.externalTaskId !== 'undefined' && bitrixConfig?.webhookUrl ? (
                  <a 
                    href={`${bitrixConfig.webhookUrl.split('/rest/')[0]}/company/personal/user/0/tasks/task/view/${task.externalTaskId}/`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/40 transition-colors"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    B24
                  </a>
                ) : (
                  <div className="px-3 py-1.5 bg-slate-700 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest opacity-50">
                    B24
                  </div>
                )}
              </div>
            </div>
          <div className="flex items-center gap-4">
             <button onClick={() => setShowResultModal(true)} className="px-6 py-4 bg-slate-700 text-slate-300 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-600 flex items-center gap-2"><MessageSquare size={16}/> Промежуточный итог</button>
             <div className="text-right"><div className="text-[10px] font-black text-slate-500 uppercase mb-1">Готовность (ед.)</div><div className="flex items-center gap-3"><div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-blue-50 transition-all duration-500" style={{ width: `${Math.min(100, progress)}%` }}></div></div><span className="text-lg font-black text-white">{scannedUnits}/{totalUnits || '?'}</span></div></div>
             <button onClick={handleCompleteRequest} className={`ml-4 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest ${scannedUnits >= totalUnits ? 'bg-emerald-600 shadow-emerald-900/20' : 'bg-slate-600 opacity-50'} text-white shadow-xl transition-all`}>Завершить этап</button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-[350px] bg-slate-800 p-8 border-r border-slate-700 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
             {feedback && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm bg-emerald-500 text-white animate-bounce">{feedback.msg}</div>}
             
             {(task.notes || order.description) && (
               <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-700">
                 <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Описание задачи</h3>
                 <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed prose prose-invert prose-sm max-w-none">
                    {task.notes ? (
                      <div dangerouslySetInnerHTML={{ __html: task.notes }} />
                    ) : (
                      <p>{order.description}</p>
                    )}
                 </div>
               </div>
             )}

             {task.stage === ProductionStage.SAWING && (
               <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-700 flex flex-col gap-3">
                 <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Загрузка деталей</h3>
                 <label className="w-full py-4 bg-blue-600/20 text-blue-400 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 hover:bg-blue-600 hover:text-white transition-colors cursor-pointer border border-blue-500/30 hover:border-blue-500">
                   <PlusCircle size={18}/>
                   <span>Загрузить Excel</span>
                   <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                 </label>
               </div>
             )}

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
             <div className="bg-slate-900 p-8 rounded-3xl border border-slate-700 flex flex-col items-center justify-center text-center gap-4 shadow-2xl relative overflow-hidden">
                {!isShiftActive && (
                  <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center">
                    <Ban size={32} className="text-rose-500 mb-2" />
                    <div className="text-white font-black text-xs uppercase tracking-widest leading-tight">Смена не начата</div>
                    <div className="text-slate-400 text-[8px] uppercase mt-1">Работа заблокирована</div>
                  </div>
                )}
                <div className="w-20 h-20 bg-blue-600/20 text-blue-500 rounded-3xl flex items-center justify-center relative"><QrCode size={40} /><ScanLine size={40} className="absolute text-blue-400 animate-bounce" /></div>
                <div><h3 className="text-white font-bold text-lg">Сканирование</h3><p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">QR-код детали</p></div>
                <form onSubmit={handleScan} className="w-full">
                  <input 
                    ref={scanInputRef} 
                    autoFocus 
                    type="text" 
                    value={scanInput} 
                    onChange={e => setScanInput(e.target.value)} 
                    disabled={!isShiftActive}
                    placeholder={!isShiftActive ? "ЗАБЛОКИРОВАНО" : "СКАНИРУЙТЕ..."} 
                    className={`w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-4 py-3 text-white text-xl font-bold text-center outline-none focus:border-blue-500 placeholder:opacity-20 ${!isShiftActive ? 'opacity-50 grayscale' : ''}`} 
                  />
                </form>
             </div>
          </div>

          <div className="flex-1 bg-slate-950 overflow-y-auto custom-scrollbar">
             <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-800 border-b border-slate-700 z-10">
                  <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="px-10 py-6">Деталь</th>
                    <th className="px-10 py-6">Материал</th>
                    <th className="px-10 py-6">Размер</th>
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
                   <tr key={detail.id} className={`${(detail.quantity || 0) >= (detail.planQuantity || 1) ? 'bg-emerald-500/5' : ''}`}>
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-6">
                        <div className={`p-4 rounded-2xl ${(detail.quantity || 0) >= (detail.planQuantity || 1) ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-600'}`}><Hash size={24} /></div>
                        <div><div className="text-white font-black text-2xl leading-none">{detail.code}</div></div>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-slate-400 font-bold text-sm">{detail.material || '—'}</td>
                    <td className="px-10 py-6 text-slate-400 font-bold text-sm">{detail.size || '—'}</td>
                    <td className="px-10 py-6 text-center">
                       <div className="flex flex-col items-center gap-1">
                         <span className="text-[10px] text-slate-500 font-bold uppercase">План: {detail.planQuantity || 1}</span>
                         <input
                           type="number"
                           value={detail.quantity || 0}
                           onChange={(e) => {
                             const val = parseInt(e.target.value) || 0;
                             const updatedDetails = (task.details || []).map(d => 
                               d.id === detail.id ? { ...d, quantity: val, scannedBy: currentUser?.id, scannedAt: new Date().toISOString() } : d
                             );
                             onUpdateDetails(order.id, task.id, updatedDetails);
                           }}
                           className="w-16 h-10 bg-slate-900 border border-slate-700 rounded-xl text-white font-black text-center focus:border-emerald-500 outline-none transition-colors"
                         />
                       </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full ${worker ? getEmployeeColor(worker.name) : 'bg-blue-600'} text-white flex items-center justify-center text-[8px] font-bold`}>
                          {worker?.name.charAt(0) || ''}
                        </div>
                        <span className="text-xs text-slate-400 font-bold">{worker?.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex flex-col gap-1">
                        <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-xl w-fit ${(detail.quantity || 0) >= (detail.planQuantity || 1) ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                          {(detail.quantity || 0) >= (detail.planQuantity || 1) ? 'ГОТОВО' : 'В ПРОЦЕССЕ'}
                        </span>
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
                    
                    // Находим материал и размер из первой детали в этой упаковке
                    const firstDetailCode = pkg.detailIds[0];
                    const sawingTask = order.tasks.find(t => t.stage === ProductionStage.SAWING);
                    const sourceDetail = sawingTask?.details?.find(d => d.code === firstDetailCode);
                    const material = sourceDetail?.material || '—';
                    const size = sourceDetail?.size || '—';

                    return (
                      <tr key={pkg.id} className={`${isShipped ? 'bg-emerald-500/5' : ''}`}>
                        <td className="px-10 py-8 text-white font-bold text-xl">{pkg.name}</td>
                        <td className="px-10 py-8 text-slate-400 font-bold text-sm">{material}</td>
                        <td className="px-10 py-8 text-slate-400 font-bold text-sm">{size}</td>
                        <td className="px-10 py-8 text-center">
                          <div className="inline-flex items-center justify-center w-12 h-10 bg-slate-900 border border-slate-700 rounded-xl text-white font-black">
                            {isShipped ? '1' : '0'}
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full ${worker ? getEmployeeColor(worker.name) : 'bg-blue-600'} text-white flex items-center justify-center text-[8px] font-bold`}>
                              {worker?.name.charAt(0) || ''}
                            </div>
                            <span className="text-xs text-slate-400 font-bold">{worker?.name || '—'}</span>
                          </div>
                        </td>
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
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-6">
                            <div className={`p-4 rounded-2xl ${isV ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-600'}`}><Hash size={24} /></div>
                            <div><div className="text-white font-black text-2xl leading-none">{detail.code}</div></div>
                          </div>
                        </td>
                        <td className="px-10 py-6 text-slate-400 font-bold text-sm">{detail.material || '—'}</td>
                        <td className="px-10 py-6 text-slate-400 font-bold text-sm">{detail.size || '—'}</td>
                        <td className="px-10 py-6 text-center">
                          <div className="inline-flex items-center justify-center w-20 h-10 bg-slate-900 border border-slate-700 rounded-xl text-white font-black">
                            {planQty} / <span className={currentScanned < planQty ? 'text-amber-500' : 'text-emerald-500'}>{currentScanned}</span>
                          </div>
                        </td>
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full ${worker ? getEmployeeColor(worker.name) : 'bg-blue-600'} text-white flex items-center justify-center text-[8px] font-bold`}>
                              {worker?.name.charAt(0) || ''}
                            </div>
                            <span className="text-xs text-slate-400 font-bold">{worker?.name || '—'}</span>
                          </div>
                        </td>
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
        {driverNameModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">Водитель</h3>
                <button onClick={() => setDriverNameModal(false)} className="p-2 hover:bg-white rounded-xl transition-colors"><X size={20} className="text-slate-400" /></button>
              </div>
              <div className="p-6 space-y-4">
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm"
                  placeholder="Введите имя водителя..."
                  autoFocus
                />
                <div className="flex gap-3">
                  <button onClick={() => setDriverNameModal(false)} className="flex-1 py-3 px-4 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-colors">Отмена</button>
                  <button 
                    onClick={() => {
                      if (!activeSelection || !driverName) return;
                      onUpdateTask(activeSelection.order.id, activeSelection.task.id, TaskStatus.COMPLETED, `Отгрузка выполнена. Водитель: ${driverName}`);
                      setDriverNameModal(false);
                      setDriverName('');
                      setSelectedTaskIds(null);
                    }}
                    className="flex-1 py-3 px-4 rounded-2xl font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all"
                  >
                    Завершить
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="bg-white p-1 rounded-2xl border border-slate-200 flex overflow-x-auto gap-1 shadow-sm">
          {STAGE_SEQUENCE.map(stage => {
            const isOrderDone = (order: Order) => {
              const shipmentTask = order.tasks.find(t => t.stage === ProductionStage.SHIPMENT);
              if (shipmentTask && shipmentTask.status === TaskStatus.COMPLETED) return true;
              return order.tasks.length > 0 && order.tasks.every(t => t.status === TaskStatus.COMPLETED);
            };

            const count = orders.filter(o => !isOrderDone(o)).flatMap(o => o.tasks).filter(t => {
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
