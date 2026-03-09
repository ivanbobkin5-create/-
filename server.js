
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import cors from 'cors';
import http from 'http';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
    const app = express();
    const PORT = process.env.PORT || 3000;
    const SECURE_TOKEN = 'MebelPlan_2025_Secure';
    const isProd = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test';
    const rootDir = process.cwd();

    console.log(`🛠️ РЕЖИМ: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`📂 КОРНЕВАЯ ДИРЕКТОРИЯ: ${rootDir}`);
    console.log(`📂 __dirname: ${__dirname}`);

    // Функция для определения внешнего IP сервера
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

    // API routes
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
        let { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, message: "Email и пароль обязательны" });
        
        email = email.trim();

        try {
            let userRes = await pool.query('SELECT * FROM woodplan_users WHERE LOWER(email) = LOWER($1)', [email]);
            
            if (userRes.rows.length === 0) {
                console.log(`🔍 Пользователь ${email} не найден в woodplan_users. Ищем в данных компаний...`);
                const allDataRes = await pool.query('SELECT company_id, content FROM woodplan_data');
                
                for (const row of allDataRes.rows) {
                    const data = JSON.parse(row.content);
                    const staff = data.staff || [];
                    const foundUser = staff.find(u => u.email?.toLowerCase().trim() === email.toLowerCase());
                    
                    if (foundUser && foundUser.password === password) {
                        console.log(`✨ Нашли пользователя ${email} в данных компании ${row.company_id}. Авто-миграция...`);
                        try {
                            await pool.query(
                                'INSERT INTO woodplan_users (id, email, password, name, role, company_id, company_name, is_production, is_production_head) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password, name = EXCLUDED.name, role = EXCLUDED.role, is_production = EXCLUDED.is_production, is_production_head = EXCLUDED.is_production_head',
                                [
                                    foundUser.id, 
                                    foundUser.email, 
                                    foundUser.password, 
                                    foundUser.name, 
                                    foundUser.role, 
                                    row.company_id, 
                                    foundUser.companyName || 'Моя компания', 
                                    foundUser.isProduction || false,
                                    foundUser.isProductionHead || false
                                ]
                            );
                        } catch (e) {
                            console.error('⚠️ Ошибка авто-миграции пользователя:', e);
                        }

                        return res.json({ 
                            success: true, 
                            user: {
                                id: foundUser.id,
                                email: foundUser.email,
                                name: foundUser.name,
                                role: foundUser.role,
                                companyId: row.company_id,
                                companyName: foundUser.companyName || 'Моя компания',
                                isProduction: foundUser.isProduction,
                                isProductionHead: foundUser.isProductionHead
                            }, 
                            payload: data 
                        });
                    }
                }
            }

            if (userRes.rows.length === 0) return res.status(401).json({ success: false, message: "Пользователь не найден" });
            
            const user = userRes.rows[0];
            if (user.password !== password) return res.status(401).json({ success: false, message: "Неверный пароль" });

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
                    isProduction: user.is_production,
                    isProductionHead: user.is_production_head
                }, 
                payload 
            });
        } catch (err) {
            console.error('❌ Ошибка логина:', err);
            res.status(500).json({ success: false, message: err.message });
        }
    });

    app.post('/api/register', async (req, res) => {
        const { user } = req.body;
        try {
            const check = await pool.query('SELECT id FROM woodplan_users WHERE LOWER(email) = LOWER($1)', [user.email]);
            if (check.rows.length > 0) return res.status(400).json({ success: false, message: "Email уже занят" });

            await pool.query(
                'INSERT INTO woodplan_users (id, email, password, name, role, company_id, company_name, is_production, is_production_head) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                [user.id, user.email, user.password, user.name, user.role, user.companyId, user.companyName, user.isProduction || false, user.isProductionHead || false]
            );

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

    app.post('/api/b24-proxy', async (req, res) => {
        const { url, method, body } = req.body;
        if (!url) return res.status(400).json({ success: false, message: "Missing URL" });

        try {
            const response = await fetch(url, {
                method: method || 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined
            });

            const contentType = response.headers.get('content-type');
            const text = await response.text();
            
            if (contentType && contentType.includes('application/json')) {
                try {
                    const data = JSON.parse(text);
                    res.status(response.status).json(data);
                } catch (e) {
                    console.error('❌ B24 Proxy JSON Parse Error:', text.substring(0, 200));
                    res.status(response.status).json({ 
                        success: false, 
                        message: `Bitrix24 returned invalid JSON (${response.status})`,
                        details: text.substring(0, 100)
                    });
                }
            } else {
                console.error('❌ B24 Proxy Non-JSON Response:', text.substring(0, 200));
                res.status(response.status).json({ 
                    success: false, 
                    message: response.status === 429 ? "Превышен лимит запросов к Bitrix24 (Rate Limit)" : `Bitrix24 вернул некорректный ответ (${response.status})`,
                    details: text.substring(0, 100)
                });
            }
        } catch (err) {
            console.error('❌ B24 Proxy Error:', err);
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // Vite middleware or static serving
    if (!isProd) {
        console.log('🛠️ Запуск Vite в режиме middleware...');
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        const buildPath = path.resolve(rootDir, 'build');
        console.log(`📂 Путь к сборке: ${buildPath}`);
        
        if (fs.existsSync(buildPath)) {
            app.use(express.static(buildPath));
            app.get('*', (req, res) => {
                const indexPath = path.join(buildPath, 'index.html');
                if (fs.existsSync(indexPath)) {
                    res.sendFile(indexPath);
                } else {
                    console.error(`❌ Файл не найден: ${indexPath}`);
                    res.status(404).send("Ошибка: index.html не найден в папке build. Выполните npm run build.");
                }
            });
        } else {
            console.warn(`⚠️ Папка сборки не найдена: ${buildPath}`);
            app.get('*', (req, res) => {
                res.status(500).send("Ошибка: Папка build не найдена. Убедитесь, что проект собран (npm run build).");
            });
        }
    }

    app.listen(PORT, '0.0.0.0', async () => {
        console.log(`🚀 Сервер запущен. Порт: ${PORT}`);
        try {
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
                    is_production_head BOOLEAN DEFAULT FALSE,
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

            const checkColumn = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='woodplan_data' AND column_name='id'
            `);

            if (checkColumn.rows.length > 0) {
                console.log('🔄 Обнаружена старая структура woodplan_data. Мигрируем id -> company_id...');
                await pool.query('ALTER TABLE woodplan_data RENAME COLUMN id TO company_id');
                await pool.query('ALTER TABLE woodplan_data ALTER COLUMN company_id TYPE TEXT');
                console.log('✅ Миграция woodplan_data завершена');
            }

            const checkUsersCol = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='woodplan_users' AND column_name='company_id'
            `);

            if (checkUsersCol.rows.length === 0) {
                console.log('🔄 Добавляем колонку company_id в woodplan_users...');
                await pool.query('ALTER TABLE woodplan_users ADD COLUMN IF NOT EXISTS company_id TEXT');
                await pool.query('ALTER TABLE woodplan_users ADD COLUMN IF NOT EXISTS company_name TEXT');
                await pool.query('ALTER TABLE woodplan_users ADD COLUMN IF NOT EXISTS is_production_head BOOLEAN DEFAULT FALSE');
                console.log('✅ Колонки добавлены в woodplan_users');
            }

            // Дополнительная проверка для is_production_head если company_id уже был
            const checkHeadCol = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='woodplan_users' AND column_name='is_production_head'
            `);
            if (checkHeadCol.rows.length === 0) {
                await pool.query('ALTER TABLE woodplan_users ADD COLUMN is_production_head BOOLEAN DEFAULT FALSE');
                console.log('✅ Колонка is_production_head добавлена');
            }

            console.log('✅ Таблицы базы данных проверены/созданы');
        } catch (e) {
            console.error('❌ Ошибка инициализации БД:', e.message);
        }
    });
}

startServer();

