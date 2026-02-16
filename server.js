import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Конфигурация PostgreSQL
const pool = new pg.Pool({
    host: '9f0f9288b234fa7e684a9441.twc1.net',
    port: 5432,
    database: 'default_db',
    user: 'gen_user',
    password: 'I;L6fAhV|SjsWE',
    ssl: {
        rejectUnauthorized: false
    }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 1. Раздача фронтенда (папка build после vite build)
app.use(express.static(path.join(__dirname, 'build')));

// 2. API: Проверка связи
app.get('/api/test', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
        res.json({ success: true, message: "Облачный Node.js: БД подключена!" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Ошибка базы: " + err.message });
    }
});

// 3. API: Сохранение
app.post('/api/save', async (req, res) => {
    const { payload, token } = req.body;
    if (token !== 'MebelPlan_2025_Secure') return res.status(403).json({ success: false, message: "Ошибка токена" });

    try {
        await pool.query('CREATE TABLE IF NOT EXISTS woodplan_data (id INT PRIMARY KEY, content TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        await pool.query(
            'INSERT INTO woodplan_data (id, content) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP',
            [JSON.stringify(payload)]
        );
        res.json({ success: true, message: "Данные успешно синхронизированы" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Ошибка сохранения: " + err.message });
    }
});

// 4. API: Загрузка
app.get('/api/load', async (req, res) => {
    const auth = req.headers.authorization;
    if (auth !== 'Bearer MebelPlan_2025_Secure') return res.status(403).json({ success: false });

    try {
        const result = await pool.query('SELECT content FROM woodplan_data WHERE id = 1');
        const data = result.rows[0] ? JSON.parse(result.rows[0].content) : null;
        res.json({ success: true, payload: data });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// 5. Все остальные пути ведут на index.html (для React)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Сервер МебельПлан запущен на порту ${PORT}`);
});
