import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import bookRoutes from './routes/books.js';
import bookmarkRoutes from './routes/bookmarks.js';
import highlightRoutes from './routes/highlights.js';

const app = express();

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 确保上传目录存在
const uploadDir = path.resolve(config.uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/highlights', highlightRoutes);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

// 启动服务
app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
