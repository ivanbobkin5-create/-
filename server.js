
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import cors from 'cors';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const SECURE_TOKEN = 'MebelPlan_2025_Secure';

// Тщательная настройка SSL для Timeweb Cloud
const getSslConfig = () => {
    // Если пользователь передал содержимое сертификата через ENV (самый надежный способ в Apps)
    if (process.env.DB_CA_CERT) {
        console.log('📜 Используется предоставленный SSL CA сертификат');
        return {
            rejectUnauthorized: true,
            ca: process.env.DB_CA_CERT,
        };
    }
    // По умолчанию используем мягкий режим, если сертификат не задан
    return {
        rejectUnauthorized: false
    };
};

// Собираем строку подключения
// Символы в пароле I;L6fAhV|SjsWE уже экранированы в строке ниже как I%3BL6fAhV%7CSjsWE
const connectionString = process.env.DATABASE_URL || 'postgresql://gen_user:I%3BL6fAhV%7CSjsWE@9f0f9288b234fa7e684a9441.twc1.net:5432/default_db';

const pool = new Pool({
    connectionString,
    ssl: getSslConfig(),
    connectionTimeoutMillis: 15000, // Увеличим тайм-аут для облачных баз
});

pool.on('error', (err) => {
    console.error('❌ Неожиданная ошибка пула БД:', err.message);
});

// Инициализация БД
const initDatabase = async (retries = 5) => {
    console.log('🔄 Попытка инициализации базы данных...');
    while (retries > 0) {
        let client;
        try {
            client = await pool.connect();
            console.log('✅ Соединение с PostgreSQL установлено успешно!');
            
            // Проверяем/создаем таблицу
            await client.query(`
                CREATE TABLE IF NOT EXISTS woodplan_data (
                    id INT PRIMARY KEY, 
                    content TEXT, 
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Структура таблиц подтверждена.');
            
            // Проверка наличия данных
            const res = await client.query('SELECT COUNT(*) FROM woodplan_data');
            console.log(`📊 Текущее количество записей в базе: ${res.rows[0].count}`);
            
            return true;
        } catch (err) {
            retries--;
            console.error(`❌ Ошибка подключения (${retries} попыток осталось):`, err.message);
            if (err.code) console.error(`🔍 Код ошибки: ${err.code}`);
            
            if (retries === 0) {
                console.error('🛑 Все попытки подключения исчерпаны. Проверьте HOST, PORT и SSL в панели Timeweb.');
                return false;
            }
            await new Promise(res => setTimeout(res, 5000));
        } finally {
            if (client) client.release();
        }
    }
};

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'build')));

app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as time, current_database() as db');
        res.json({ 
            status: 'ok', 
            database: 'connected', 
            dbName: result.rows[0].db,
            time: result.rows[0].time 
        });
    } catch (err) {
        console.error('API Health Error:', err.message);
        res.status(500).json({ 
            status: 'error', 
            database: err.message,
            hint: 'Убедитесь, что IP сервера добавлен в белый список БД или SSL настроен верно.'
        });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT content FROM woodplan_data WHERE id = 1');
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "База данных пуста. Пожалуйста, используйте 'Регистрацию' для создания первой учетной записи." 
            });
        }
        const data = JSON.parse(result.rows[0].content);
        const user = (data.staff || []).find(u => u.email?.toLowerCase() === email?.toLowerCase());
        
        if (!user || user.password !== password) {
            return res.status(401).json({ success: false, message: "Неверный e-mail или пароль." });
        }
        res.json({ success: true, user, payload: data });
    } catch (err) {
        console.error('API Login Error:', err.message);
        res.status(500).json({ success: false, message: "Ошибка сервера БД: " + err.message });
    }
});

app.post('/api/save', async (req, res) => {
    const { payload, token } = req.body;
    if (token !== SECURE_TOKEN) return res.status(403).json({ success: false, message: "Invalid security token" });
    try {
        await pool.query(
            'INSERT INTO woodplan_data (id, content) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP',
            [JSON.stringify(payload)]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('API Save Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/load', async (req, res) => {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${SECURE_TOKEN}`) return res.status(403).json({ success: false });
    try {
        const result = await pool.query('SELECT content FROM woodplan_data WHERE id = 1');
        res.json({ success: true, payload: result.rows[0] ? JSON.parse(result.rows[0].content) : null });
    } catch (err) {
        console.error('API Load Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер МебельПлан запущен на порту ${PORT}`);
    initDatabase();
});
