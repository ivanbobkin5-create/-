
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import cors from 'cors';
import http from 'http';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const SECURE_TOKEN = 'MebelPlan_2025_Secure';

let serverPublicIP = 'Определяется...';

// Функция для определения внешнего IP сервера (чтобы юзер знал, что добавлять в белый список)
const fetchPublicIP = () => {
  http.get('http://api.ipify.org', (res) => {
    res.on('data', (chunk) => {
      serverPublicIP = chunk.toString();
      console.log(`🌍 ПУБЛИЧНЫЙ IP СЕРВЕРА: ${serverPublicIP}`);
    });
  }).on('error', () => {
    serverPublicIP = 'Не удалось определить';
  });
};
fetchPublicIP();

const getSslConfig = () => {
    if (process.env.DB_CA_CERT) {
        return { 
            rejectUnauthorized: true, 
            ca: process.env.DB_CA_CERT.replace(/\\n/g, '\n').trim() 
        };
    }
    // Возвращаем SSL для облачной БД
    return { rejectUnauthorized: false };
};

const connectionString = process.env.DATABASE_URL || 'postgresql://gen_user:I%3BL6fAhV%7CSjsWE@9f0f9288b234fa7e684a9441.twc1.net:5432/default_db';

const pool = new Pool({
    connectionString,
    ssl: getSslConfig(),
    connectionTimeoutMillis: 5000,
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const buildPath = path.join(__dirname, 'build');
app.use(express.static(buildPath));

app.get('/api/ping', (req, res) => {
    res.json({ status: 'ok', ip: serverPublicIP });
});

app.get('/api/test-db', async (req, res) => {
    try {
        const client = await pool.connect();
        await client.query('SELECT current_database()');
        client.release();
        res.json({ status: 'success', serverIp: serverPublicIP });
    } catch (err) {
        res.status(500).json({ 
            status: 'error', 
            message: err.message,
            serverIp: serverPublicIP
        });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Ищем пользователя в таблице пользователей
        const userRes = await pool.query('SELECT * FROM woodplan_users WHERE LOWER(email) = LOWER($1)', [email]);
        if (userRes.rows.length === 0) return res.status(401).json({ success: false, message: "Пользователь не найден" });
        
        const user = userRes.rows[0];
        if (user.password !== password) return res.status(401).json({ success: false, message: "Неверный пароль" });

        // Загружаем данные компании
        const dataRes = await pool.query('SELECT content FROM woodplan_data WHERE company_id = $1', [user.company_id]);
        const payload = dataRes.rows[0] ? JSON.parse(dataRes.rows[0].content) : null;

        res.json({ 
            success: true, 
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                companyId: user.company_id,
                companyName: user.company_name,
                isProduction: user.is_production
            }, 
            payload 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/register', async (req, res) => {
    const { user } = req.body;
    try {
        // Проверяем, нет ли уже такого email
        const check = await pool.query('SELECT id FROM woodplan_users WHERE LOWER(email) = LOWER($1)', [user.email]);
        if (check.rows.length > 0) return res.status(400).json({ success: false, message: "Email уже занят" });

        // Создаем пользователя
        await pool.query(
            'INSERT INTO woodplan_users (id, email, password, name, role, company_id, company_name, is_production) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [user.id, user.email, user.password, user.name, user.role, user.companyId, user.companyName, user.isProduction || false]
        );

        // Инициализируем пустые данные для компании
        await pool.query(
            'INSERT INTO woodplan_data (company_id, content) VALUES ($1, $2) ON CONFLICT (company_id) DO NOTHING',
            [user.companyId, JSON.stringify({ orders: [], staff: [user], sessions: [], shifts: {} })]
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/save', async (req, res) => {
    const { payload, token, companyId } = req.body;
    if (token !== SECURE_TOKEN) return res.status(403).json({ success: false });
    if (!companyId) return res.status(400).json({ success: false, message: "Missing companyId" });

    try {
        await pool.query(
            'INSERT INTO woodplan_data (company_id, content) VALUES ($1, $2) ON CONFLICT (company_id) DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP',
            [companyId, JSON.stringify(payload)]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/load', async (req, res) => {
    const auth = req.headers.authorization;
    const companyId = req.headers['x-company-id'];
    
    if (auth !== `Bearer ${SECURE_TOKEN}`) return res.status(403).json({ success: false });
    if (!companyId) return res.status(400).json({ success: false, message: "Missing companyId" });

    try {
        const result = await pool.query('SELECT content FROM woodplan_data WHERE company_id = $1', [companyId]);
        res.json({ success: true, payload: result.rows[0] ? JSON.parse(result.rows[0].content) : null });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Сервер запущен. Порт: ${PORT}`);
    try {
        // Создаем таблицы если их нет
        await pool.query(`
            CREATE TABLE IF NOT EXISTS woodplan_users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE,
                password TEXT,
                name TEXT,
                role TEXT,
                company_id TEXT,
                company_name TEXT,
                is_production BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS woodplan_data (
                company_id TEXT PRIMARY KEY,
                content TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблицы базы данных проверены/созданы');
    } catch (e) {
        console.error('❌ Ошибка инициализации БД:', e.message);
    }
});
