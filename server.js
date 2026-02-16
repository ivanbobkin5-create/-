
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Тот же токен, что и в dbService
const SECURE_TOKEN = 'MebelPlan_2025_Secure';

// Конфигурация пула с учетом особенностей Timeweb Cloud
const pool = new pg.Pool({
    host: '9f0f9288b234fa7e684a9441.twc1.net',
    port: 5432,
    database: 'default_db',
    user: 'gen_user',
    password: 'I;L6fAhV|SjsWE',
    // Timeweb часто требует именно такие параметры SSL для NodeJS
    ssl: {
        rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// Глобальный обработчик ошибок пула, чтобы сервер не «падал»
pool.on('error', (err) => {
    console.error('Непредвиденная ошибка в пуле PostgreSQL:', err);
});

// Функция для создания таблиц (вызывается при необходимости)
const ensureTables = async () => {
    let client;
    try {
        client = await pool.connect();
        await client.query(`
            CREATE TABLE IF NOT EXISTS woodplan_data (
                id INT PRIMARY KEY, 
                content TEXT, 
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Структура базы данных проверена/создана');
    } catch (err) {
        console.error('❌ Ошибка инициализации таблиц:', err.message);
        throw err;
    } finally {
        if (client) client.release();
    }
};

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Раздача фронтенда из папки build
app.use(express.static(path.join(__dirname, 'build')));

// Эндпоинт проверки здоровья системы
app.get('/api/health', async (req, res) => {
    try {
        const dbTest = await pool.query('SELECT NOW()');
        res.json({ 
            status: 'ok', 
            database: 'connected', 
            serverTime: dbTest.rows[0].now 
        });
    } catch (err) {
        res.status(500).json({ 
            status: 'error', 
            database: err.message,
            hint: 'Проверьте настройки SSL и пароль в консоли Timeweb'
        });
    }
});

// Регистрация/Вход (упрощенная серверная логика)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        await ensureTables(); // Пробуем создать таблицу, если её нет
        const result = await pool.query('SELECT content FROM woodplan_data WHERE id = 1');
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Компания не зарегистрирована." });
        }

        const data = JSON.parse(result.rows[0].content);
        const staff = data.staff || [];
        const user = staff.find(u => u.email?.toLowerCase() === email?.toLowerCase());
        
        if (!user) return res.status(401).json({ success: false, message: "Пользователь не найден." });
        if (user.password !== password) return res.status(401).json({ success: false, message: "Неверный пароль." });

        res.json({ success: true, user, payload: data });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: "Ошибка базы: " + err.message });
    }
});

app.post('/api/save', async (req, res) => {
    const { payload, token } = req.body;
    if (token !== SECURE_TOKEN) return res.status(403).json({ success: false, message: "Invalid token" });
    
    try {
        await pool.query(
            'INSERT INTO woodplan_data (id, content) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP',
            [JSON.stringify(payload)]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/load', async (req, res) => {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${SECURE_TOKEN}`) return res.status(403).json({ success: false });
    
    try {
        const result = await pool.query('SELECT content FROM woodplan_data WHERE id = 1');
        const data = result.rows[0] ? JSON.parse(result.rows[0].content) : null;
        res.json({ success: true, payload: data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Все остальные запросы шлем на фронтенд
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер МебельПлан готов на порту ${PORT}`);
    // Пробуем создать таблицы один раз при старте
    ensureTables().catch(() => console.log('⚠️ База данных пока не доступна, таблицы будут созданы при первом запросе.'));
});
