
import { Order, User, WorkSession, CloudConfig, UserRole } from './types';
import { db, auth } from './services/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  updateDoc, 
  addDoc, 
  serverTimestamp,
  type Unsubscribe 
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  signInAnonymously
} from 'firebase/auth';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In dev, show more info
  throw new Error(JSON.stringify(errInfo));
}

let dataUnsubscribe: Unsubscribe | null = null;

export const dbService = {
  // Реальное время через Firestore
  connect(companyId: string, onUpdate: (data: any) => void, onStatusChange?: (status: 'connected' | 'disconnected') => void) {
    if (dataUnsubscribe) {
      dataUnsubscribe();
    }

    console.log(`🔥 Подключение к Firestore для компании: ${companyId}`);
    onStatusChange?.('connected');

    // Слушаем заказы компании
    const ordersQuery = query(collection(db, 'orders'), where('companyId', '==', companyId));
    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      const orders = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Order));
      onUpdate({ type: 'orders', data: orders });
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'orders'));

    // Слушаем компанию (конфиг, смены)
    const companyRef = doc(db, 'companies', companyId);
    const unsubCompany = onSnapshot(companyRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        onUpdate({ type: 'company_config', data: data.bitrixConfig });
        onUpdate({ type: 'shifts', data: data.shifts || {} });
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `companies/${companyId}`));

    // Слушаем персонал
    const staffQuery = query(collection(db, 'users'), where('companyId', '==', companyId));
    const unsubStaff = onSnapshot(staffQuery, (snapshot) => {
      const staff = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as User));
      onUpdate({ type: 'staff', data: staff });
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    // Слушаем сессии
    const sessionsQuery = query(collection(db, 'sessions'), where('companyId', '==', companyId));
    const unsubSessions = onSnapshot(sessionsQuery, (snapshot) => {
      const sessions = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as WorkSession));
      onUpdate({ type: 'sessions', data: sessions });
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sessions'));

    dataUnsubscribe = () => {
      unsubOrders();
      unsubCompany();
      unsubStaff();
      unsubSessions();
    };

    return dataUnsubscribe;
  },

  async checkHealth(): Promise<{ success: boolean; message: string; details?: string; serverIp?: string }> {
    try {
      await getDoc(doc(db, '_health_', 'check'));
      return { success: true, message: '🔥 Firebase: OK' };
    } catch (err: any) {
      return { success: false, message: '🔥 Firebase: Ошибка', details: err.message };
    }
  },

  async login(email: string, pass: string): Promise<{ success: boolean; user?: User; payload?: any; message?: string }> {
    try {
      if (pass === 'B24_AUTH') {
        // Логин через Bitrix24
        // Ищем пользователя в Firestore по email
        const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase()));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
           return { success: false, message: "Пользователь Bitrix24 не найден в системе. Обратитесь к администратору." };
        }
        const userData = { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as User;
        
        // Входим анонимно в Firebase, чтобы работали правила, основанные на auth.uid
        // Или если мы хотим строгую привязку - нужно было бы создавать Firebase User.
        // Для простоты пока - анонимный вход.
        if (!auth.currentUser) await signInAnonymously(auth);
        
        return { success: true, user: userData };
      }

      const userCredential = await signInWithEmailAndPassword(auth, email.toLowerCase(), pass);
      const uid = userCredential.user.uid;
      
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) {
        return { success: false, message: "Профиль пользователя не найден" };
      }

      const userData = { ...userDoc.data(), id: uid } as User;
      return { success: true, user: userData };
    } catch (err: any) {
      console.error('Login error:', err);
      return { success: false, message: "Неверный логин или пароль" };
    }
  },

  async register(user: User): Promise<{ success: boolean; message?: string }> {
    try {
      // 1. Создаем пользователя в Auth
      const userCredential = await createUserWithEmailAndPassword(auth, user.email.toLowerCase(), user.password || 'default_pass');
      const uid = userCredential.user.uid;

      // 2. Создаем профиль в Firestore
      const userProfile = { ...user, id: uid };
      delete userProfile.password;

      await setDoc(doc(db, 'users', uid), userProfile);

      // 3. Если это новый админ компании, создаем документ компании
      if (user.role === UserRole.COMPANY_ADMIN && user.companyId) {
        await setDoc(doc(db, 'companies', user.companyId), {
           id: user.companyId,
           name: user.companyName || 'Новая компания',
           createdAt: serverTimestamp()
        }, { merge: true });
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  },

  async saveOrder(order: Order) {
    try {
       await setDoc(doc(db, 'orders', order.id), { ...order, updatedAt: serverTimestamp() }, { merge: true });
       return true;
    } catch (e) {
       handleFirestoreError(e, OperationType.WRITE, `orders/${order.id}`);
       return false;
    }
  },

  async saveSessions(sessions: WorkSession[]) {
     // Массовое сохранение сессий (можно оптимизировать через batch)
     for (const s of sessions) {
        await setDoc(doc(db, 'sessions', s.id), { ...s, updatedAt: serverTimestamp() }, { merge: true });
     }
  },

  async saveShifts(companyId: string, shifts: any) {
     await updateDoc(doc(db, 'companies', companyId), { shifts });
  },

  async saveStaff(staff: User[], companyId: string) {
     for (const s of staff) {
        // Мы не можем легко обновлять Auth пароли отсюда, 
        // но можем обновлять профиль в Firestore
        await setDoc(doc(db, 'users', s.id), { ...s, companyId }, { merge: true });
     }
  },

  async saveCompanyConfig(companyId: string, config: any) {
      await updateDoc(doc(db, 'companies', companyId), { bitrixConfig: config });
  },

  async saveToCloud(config: CloudConfig, data: any, companyId?: string) {
    if (!companyId) return false;
    try {
       // В режиме Firebase эта функция может сохранять всё сразу или по частям.
       // Для обратной совместимости с App.tsx сохраним части
       if (data.orders) {
          for (const o of data.orders) await this.saveOrder(o);
       }
       if (data.staff) await this.saveStaff(data.staff, companyId);
       if (data.sessions) await this.saveSessions(data.sessions);
       if (data.shifts) await this.saveShifts(companyId, data.shifts);
       if (data.bitrixConfig) await this.saveCompanyConfig(companyId, data.bitrixConfig);
       
       return true;
    } catch (err) {
      return false;
    }
  },

  async loadFromCloud(config: CloudConfig, companyId?: string) {
    // В Firebase данные приходят через onSnapshot, но для совместимости вернем null
    // Или загрузим один раз
    return null;
  },

  async testConnection(config: CloudConfig) {
    return this.checkHealth();
  }
};
