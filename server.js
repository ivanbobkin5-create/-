
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const SECURE_TOKEN = 'MebelPlan_2025_Secure';

// Собираем строку подключения из ваших данных
// Если в Timeweb Apps вы добавите переменную DATABASE_URL, сервер возьмет её
const connectionString = process.env.DATABASE_URL || 'postgresql://gen_user:I%3BL6fAhV%7CSjsWE@9f0f9288b234fa7e684a9441.twc1.net:5432/default_db';

const pool = new pg.Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false // Обход проверки сертификата для Timeweb
    },
    connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
    console.error('❌ Ошибка пула БД:', err.message);
});

// Функция создания таблиц с повторными попытками
const initDatabase = async (retries = 5) => {
    while (retries > 0) {
        try {
            const client = await pool.connect();
            console.log('✅ Успешное подключение к PostgreSQL');
            await client.query(`
                CREATE TABLE IF NOT EXISTS woodplan_data (
                    id INT PRIMARY KEY, 
                    content TEXT, 
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            client.release();
            console.log('✅ Таблица woodplan_data проверена/создана');
            return true;
        } catch (err) {
            retries--;
            console.error(`❌ Ошибка БД (осталось попыток: ${retries}):`, err.message);
            if (retries === 0) return false;
            await new Promise(res => setTimeout(res, 5000)); // Ждем 5 сек перед повтором
        }
    }
};

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'build')));

app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as time');
        res.json({ 
            status: 'ok', 
            database: 'connected', 
            time: result.rows[0].time 
        });
    } catch (err) {
        console.error('Health check failed:', err.message);
        res.status(500).json({ 
            status: 'error', 
            database: err.message 
        });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT content FROM woodplan_data WHERE id = 1');
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "База пуста. Создайте аккаунт через Регистрацию." });
        }
        const data = JSON.parse(result.rows[0].content);
        const user = (data.staff || []).find(u => u.email?.toLowerCase() === email?.toLowerCase());
        
        if (!user || user.password !== password) {
            return res.status(401).json({ success: false, message: "Неверный логин или пароль." });
        }
        res.json({ success: true, user, payload: data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/save', async (req, res) => {
    const { payload, token } = req.body;
    if (token !== SECURE_TOKEN) return res.status(403).json({ success: false });
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
        res.json({ success: true, payload: result.rows[0] ? JSON.parse(result.rows[0].content) : null });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер МебельПлан на порту ${PORT}`);
    initDatabase();
});
