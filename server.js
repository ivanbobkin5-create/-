
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

// Прямая конфигурация PostgreSQL
const pool = new pg.Pool({
    host: '9f0f9288b234fa7e684a9441.twc1.net',
    port: 5432,
    database: 'default_db',
    user: 'gen_user',
    password: 'I;L6fAhV|SjsWE',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000 // Ждем максимум 5 секунд
});

// Проверка связи с БД при старте сервера
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ ОШИБКА ПОДКЛЮЧЕНИЯ К POSTGRESQL:', err.stack);
    } else {
        console.log('✅ СВЯЗЬ С POSTGRESQL УСТАНОВЛЕНА');
        client.query('CREATE TABLE IF NOT EXISTS woodplan_data (id INT PRIMARY KEY, content TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)', (err) => {
            release();
            if (err) console.error('❌ Ошибка создания таблицы:', err);
            else console.log('✅ Таблица woodplan_data готова');
        });
    }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Раздача фронтенда (папка build)
app.use(express.static(path.join(__dirname, 'build')));

// Эндпоинт проверки статуса системы
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT NOW()');
        res.json({ status: 'ok', database: 'connected' });
    } catch (err) {
        res.status(500).json({ status: 'error', database: err.message });
    }
});

// Серверная авторизация
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT content FROM woodplan_data WHERE id = 1');
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "База данных пуста. Зарегистрируйте компанию." });
        }
        const data = JSON.parse(result.rows[0].content);
        const staff = data.staff || [];
        const user = staff.find(u => u.email?.toLowerCase() === email?.toLowerCase());
        
        if (!user) return res.status(401).json({ success: false, message: "Пользователь не найден." });
        if (user.password !== password) return res.status(401).json({ success: false, message: "Неверный пароль." });

        res.json({ success: true, user, payload: data });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: "Ошибка БД: " + err.message });
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
        const data = result.rows[0] ? JSON.parse(result.rows[0].content) : null;
        res.json({ success: true, payload: data });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер МебельПлан запущен на порту ${PORT}`);
});
