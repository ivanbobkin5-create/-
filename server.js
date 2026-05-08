import express from 'express';
import path from 'path';
import cors from 'cors';

async function startServer() {
    const app = express();
    const PORT = process.env.PORT || 3000;
    const isProd = process.env.NODE_ENV === 'production';

    app.use(cors());
    app.use(express.json({ limit: '50mb' }));

    // API proxy or other routes can go here
    app.get('/api/ping', (req, res) => {
        res.json({ status: 'ok' });
    });

    if (isProd) {
        const rootDir = process.cwd();
        const distPath = path.join(rootDir, 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
}

startServer().catch(err => {
    console.error('Failed to start server:', err);
});
