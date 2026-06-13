import { Router, Response } from 'express';
import prisma from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// 获取指定书籍的所有标注
router.get('/books/:bookId/highlights', async (req: AuthRequest, res: Response) => {
  try {
    const { bookId } = req.params;

    const book = await prisma.book.findFirst({
      where: { id: bookId, userId: req.userId },
    });
    if (!book) {
      res.status(404).json({ success: false, error: '书籍不存在' });
      return;
    }

    const highlights = await prisma.highlight.findMany({
      where: { bookId, userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = highlights.map((h) => ({
      id: h.id,
      bookId: h.bookId,
      location: h.location,
      text: h.text,
      color: h.color,
      note: h.note,
      chapter: h.chapter,
      paragraphIndex: h.paragraphIndex,
      offsetInParagraph: h.offsetInParagraph,
      createdAt: h.createdAt.getTime(),
    }));

    res.json({ success: true, data: { highlights: formatted } });
  } catch (error) {
    console.error('Get highlights error:', error);
    res.status(500).json({ success: false, error: '获取标注失败' });
  }
});

// 添加标注
router.post('/books/:bookId/highlights', async (req: AuthRequest, res: Response) => {
  try {
    const { bookId } = req.params;
    const { location, text, color, note, chapter, paragraphIndex, offsetInParagraph } = req.body;

    const book = await prisma.book.findFirst({
      where: { id: bookId, userId: req.userId },
    });
    if (!book) {
      res.status(404).json({ success: false, error: '书籍不存在' });
      return;
    }

    const highlight = await prisma.highlight.create({
      data: {
        userId: req.userId!,
        bookId,
        location: location || '',
        text: text || '',
        color: color || 'yellow',
        note: note || null,
        chapter: chapter || '',
        paragraphIndex: paragraphIndex ?? null,
        offsetInParagraph: offsetInParagraph ?? null,
      },
    });

    res.json({
      success: true,
      data: {
        highlight: {
          id: highlight.id,
          bookId: highlight.bookId,
          location: highlight.location,
          text: highlight.text,
          color: highlight.color,
          note: highlight.note,
          chapter: highlight.chapter,
          paragraphIndex: highlight.paragraphIndex,
          offsetInParagraph: highlight.offsetInParagraph,
          createdAt: highlight.createdAt.getTime(),
        },
      },
    });
  } catch (error) {
    console.error('Create highlight error:', error);
    res.status(500).json({ success: false, error: '添加标注失败' });
  }
});

// 更新标注
router.put('/highlights/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { color, note } = req.body;

    const existing = await prisma.highlight.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: '标注不存在' });
      return;
    }

    const data: Record<string, unknown> = {};
    if (color !== undefined) data.color = color;
    if (note !== undefined) data.note = note;

    const highlight = await prisma.highlight.update({ where: { id }, data });

    res.json({
      success: true,
      data: {
        highlight: {
          id: highlight.id,
          bookId: highlight.bookId,
          location: highlight.location,
          text: highlight.text,
          color: highlight.color,
          note: highlight.note,
          chapter: highlight.chapter,
          paragraphIndex: highlight.paragraphIndex,
          offsetInParagraph: highlight.offsetInParagraph,
          createdAt: highlight.createdAt.getTime(),
        },
      },
    });
  } catch (error) {
    console.error('Update highlight error:', error);
    res.status(500).json({ success: false, error: '更新标注失败' });
  }
});

// 删除标注
router.delete('/highlights/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.highlight.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: '标注不存在' });
      return;
    }

    await prisma.highlight.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Delete highlight error:', error);
    res.status(500).json({ success: false, error: '删除标注失败' });
  }
});

export default router;
