import { Router, Response } from 'express';
import prisma from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// 获取指定书籍的所有书签
router.get('/books/:bookId/bookmarks', async (req: AuthRequest, res: Response) => {
  try {
    const { bookId } = req.params;

    // 验证书籍属于当前用户
    const book = await prisma.book.findFirst({
      where: { id: bookId, userId: req.userId },
    });
    if (!book) {
      res.status(404).json({ success: false, error: '书籍不存在' });
      return;
    }

    const bookmarks = await prisma.bookmark.findMany({
      where: { bookId, userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = bookmarks.map((b) => ({
      id: b.id,
      bookId: b.bookId,
      location: b.location,
      chapter: b.chapter,
      progress: b.progress,
      note: b.note,
      createdAt: b.createdAt.getTime(),
    }));

    res.json({ success: true, data: { bookmarks: formatted } });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    res.status(500).json({ success: false, error: '获取书签失败' });
  }
});

// 添加书签
router.post('/books/:bookId/bookmarks', async (req: AuthRequest, res: Response) => {
  try {
    const { bookId } = req.params;
    const { location, chapter, progress, note } = req.body;

    // 验证书籍属于当前用户
    const book = await prisma.book.findFirst({
      where: { id: bookId, userId: req.userId },
    });
    if (!book) {
      res.status(404).json({ success: false, error: '书籍不存在' });
      return;
    }

    const bookmark = await prisma.bookmark.create({
      data: {
        userId: req.userId!,
        bookId,
        location: location || '',
        chapter: chapter || '',
        progress: progress || 0,
        note: note || null,
      },
    });

    res.json({
      success: true,
      data: {
        bookmark: {
          id: bookmark.id,
          bookId: bookmark.bookId,
          location: bookmark.location,
          chapter: bookmark.chapter,
          progress: bookmark.progress,
          note: bookmark.note,
          createdAt: bookmark.createdAt.getTime(),
        },
      },
    });
  } catch (error) {
    console.error('Create bookmark error:', error);
    res.status(500).json({ success: false, error: '添加书签失败' });
  }
});

// 删除书签
router.delete('/bookmarks/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const bookmark = await prisma.bookmark.findFirst({
      where: { id, userId: req.userId },
    });
    if (!bookmark) {
      res.status(404).json({ success: false, error: '书签不存在' });
      return;
    }

    await prisma.bookmark.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Delete bookmark error:', error);
    res.status(500).json({ success: false, error: '删除书签失败' });
  }
});

export default router;
