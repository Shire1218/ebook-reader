import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';
import prisma from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// 文件上传配置
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.resolve(config.uploadDir);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSize },
});

// 所有书籍接口需要认证
router.use(authMiddleware);

// 获取当前用户所有书籍
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const books = await prisma.book.findMany({
      where: { userId: req.userId },
      orderBy: { importTime: 'desc' },
    });

    // 转换 DateTime 为时间戳，与前端 Book 接口对齐
    const formatted = books.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      format: b.format,
      coverUrl: b.coverUrl,
      fileSize: b.fileSize,
      progress: b.progress,
      currentLocation: b.currentLocation,
      currentChapter: b.currentChapter,
      category: b.category,
      lastReadTime: b.lastReadTime.getTime(),
      importTime: b.importTime.getTime(),
    }));

    res.json({ success: true, data: { books: formatted } });
  } catch (error) {
    console.error('Get books error:', error);
    res.status(500).json({ success: false, error: '获取书籍列表失败' });
  }
});

// 上传新书籍
router.post('/', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { book: bookJson } = req.body;
    let bookData;
    try {
      bookData = JSON.parse(bookJson || '{}');
    } catch {
      bookData = {};
    }

    const file = req.file;
    const filePath = file ? path.relative(process.cwd(), file.path) : null;

    const book = await prisma.book.create({
      data: {
        userId: req.userId!,
        title: bookData.title || '未命名书籍',
        author: bookData.author || '未知作者',
        format: bookData.format || 'txt',
        coverUrl: bookData.coverUrl || '',
        fileSize: file ? file.size : (bookData.fileSize || 0),
        progress: bookData.progress || 0,
        currentLocation: bookData.currentLocation || '',
        currentChapter: bookData.currentChapter || '',
        category: bookData.category || '',
        filePath,
        lastReadTime: new Date(bookData.lastReadTime || Date.now()),
        importTime: new Date(bookData.importTime || Date.now()),
      },
    });

    res.json({
      success: true,
      data: {
        book: {
          id: book.id,
          title: book.title,
          author: book.author,
          format: book.format,
          coverUrl: book.coverUrl,
          fileSize: book.fileSize,
          progress: book.progress,
          currentLocation: book.currentLocation,
          currentChapter: book.currentChapter,
          category: book.category,
          lastReadTime: book.lastReadTime.getTime(),
          importTime: book.importTime.getTime(),
        },
      },
    });
  } catch (error) {
    console.error('Create book error:', error);
    res.status(500).json({ success: false, error: '上传书籍失败' });
  }
});

// 更新书籍信息
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // 验证书籍属于当前用户
    const existing = await prisma.book.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: '书籍不存在' });
      return;
    }

    // 构建更新数据，只允许更新特定字段
    const data: Record<string, unknown> = {};
    if (updates.title !== undefined) data.title = updates.title;
    if (updates.author !== undefined) data.author = updates.author;
    if (updates.coverUrl !== undefined) data.coverUrl = updates.coverUrl;
    if (updates.progress !== undefined) data.progress = updates.progress;
    if (updates.currentLocation !== undefined) data.currentLocation = updates.currentLocation;
    if (updates.currentChapter !== undefined) data.currentChapter = updates.currentChapter;
    if (updates.category !== undefined) data.category = updates.category;
    if (updates.lastReadTime !== undefined) data.lastReadTime = new Date(updates.lastReadTime);

    const book = await prisma.book.update({ where: { id }, data });

    res.json({
      success: true,
      data: {
        book: {
          id: book.id,
          title: book.title,
          author: book.author,
          format: book.format,
          coverUrl: book.coverUrl,
          fileSize: book.fileSize,
          progress: book.progress,
          currentLocation: book.currentLocation,
          currentChapter: book.currentChapter,
          category: book.category,
          lastReadTime: book.lastReadTime.getTime(),
          importTime: book.importTime.getTime(),
        },
      },
    });
  } catch (error) {
    console.error('Update book error:', error);
    res.status(500).json({ success: false, error: '更新书籍失败' });
  }
});

// 删除书籍
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.book.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: '书籍不存在' });
      return;
    }

    // 删除关联文件
    if (existing.filePath) {
      const fullPath = path.resolve(existing.filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    // 删除书籍（级联删除书签和标注）
    await prisma.book.delete({ where: { id } });

    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Delete book error:', error);
    res.status(500).json({ success: false, error: '删除书籍失败' });
  }
});

// 下载书籍文件
router.get('/:id/file', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const book = await prisma.book.findFirst({
      where: { id, userId: req.userId },
    });
    if (!book || !book.filePath) {
      res.status(404).json({ success: false, error: '文件不存在' });
      return;
    }

    const fullPath = path.resolve(book.filePath);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ success: false, error: '文件已丢失' });
      return;
    }

    res.download(fullPath, `${book.title}.${book.format}`);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ success: false, error: '下载文件失败' });
  }
});

export default router;
