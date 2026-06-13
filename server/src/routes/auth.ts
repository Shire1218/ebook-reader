import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import prisma from '../db/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// 注册
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ success: false, error: '用户名、邮箱和密码不能为空' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, error: '密码长度不能少于6位' });
      return;
    }

    // 检查用户名和邮箱是否已存在
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (existing) {
      const field = existing.username === username ? '用户名' : '邮箱';
      res.status(409).json({ success: false, error: `${field}已被注册` });
      return;
    }

    // 创建用户
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, email, passwordHash },
    });

    // 生成 token
    const accessToken = jwt.sign({ userId: user.id }, config.jwtSecret, {
      expiresIn: config.accessTokenExpiry,
    });
    const refreshToken = jwt.sign({ userId: user.id }, config.jwtRefreshSecret, {
      expiresIn: config.refreshTokenExpiry,
    });

    res.json({
      success: true,
      data: {
        user: { id: user.id, username: user.username, email: user.email },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: '注册失败，请稍后重试' });
  }
});

// 登录
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ success: false, error: '用户名和密码不能为空' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }

    const accessToken = jwt.sign({ userId: user.id }, config.jwtSecret, {
      expiresIn: config.accessTokenExpiry,
    });
    const refreshToken = jwt.sign({ userId: user.id }, config.jwtRefreshSecret, {
      expiresIn: config.refreshTokenExpiry,
    });

    res.json({
      success: true,
      data: {
        user: { id: user.id, username: user.username, email: user.email },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: '登录失败，请稍后重试' });
  }
});

// 刷新 token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ success: false, error: '缺少 refreshToken' });
      return;
    }

    const payload = jwt.verify(refreshToken, config.jwtRefreshSecret) as { userId: string };

    const accessToken = jwt.sign({ userId: payload.userId }, config.jwtSecret, {
      expiresIn: config.accessTokenExpiry,
    });
    const newRefreshToken = jwt.sign({ userId: payload.userId }, config.jwtRefreshSecret, {
      expiresIn: config.refreshTokenExpiry,
    });

    res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
  } catch {
    res.status(401).json({ success: false, error: 'refreshToken 无效或已过期' });
  }
});

// 获取当前用户
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, username: true, email: true, createdAt: true },
    });
    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }
    res.json({ success: true, data: { user } });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ success: false, error: '获取用户信息失败' });
  }
});

export default router;
