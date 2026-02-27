
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
    // Если переменной нет, отключаем SSL (так как psql строка не содержит sslmode)
    return false;
};

const connectionString = process.env.DATABASE_URL || 'postgresql://gen_user:I%3BL6fAhV%7CSjsWE@89.23.117.158:5432/default_db';

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
        const dbRes = await client.query('SELECT current_database()');
        client.release();
        res.json({ status: 'success', serverIp: serverPublicIP });
    } catch (err) {
        res.status(500).json({ 
            status: 'error', 
            message: err.message,
            serverIp: serverPublicIP,
            hint: err.message.includes('pg_hba.conf') 
                ? `Добавьте IP ${serverPublicIP} в белый список вашей базы данных Timeweb.` 
                : 'Проверьте пароль и SSL настройки.'
        });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT content FROM woodplan_data WHERE id = 1');
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: "База пуста" });
        const data = JSON.parse(result.rows[0].content);
        const user = (data.staff || []).find(u => u.email?.toLowerCase() === email?.toLowerCase());
        if (!user || user.password !== password) return res.status(401).json({ success: false, message: "Ошибка входа" });
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
    res.sendFile(path.join(buildPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен. Порт: ${PORT}`);
    pool.query(`CREATE TABLE IF NOT EXISTS woodplan_data (id INT PRIMARY KEY, content TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)` )
    .catch(e => console.log('Ожидание подключения к БД для создания таблиц...'));
});
