
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

async function startServer() {
    const app = express();

    const PORT = process.env.PORT || 3000;
    const isProd = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test';
    const rootDir = process.cwd();

    console.log(`🛠️ РЕЖИМ: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}`);

    app.use(cors());
    app.use(express.json({ limit: '50mb' }));

    // Разрешаем встраивание в iframe для Bitrix24
    app.use((req, res, next) => {
        res.removeHeader('X-Frame-Options');
        res.setHeader('Content-Security-Policy', "frame-ancestors *;"); 
        next();
    });

    // API routes
    app.get('/api/ping', (req, res) => {
        res.json({ status: 'ok' });
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
                } catch {
                    res.status(response.status).json({ success: false, message: "Invalid JSON from B24" });
                }
            } else {
                res.status(response.status).json({ success: false, message: "Non-JSON from B24", details: text.substring(0, 100) });
            }
        } catch (err) {
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
            app.post('*', (req, res) => {
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

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Сервер запущен. Порт: ${PORT}`);
        console.log('✅ Используется Firebase Firestore');
    });
}

startServer();

