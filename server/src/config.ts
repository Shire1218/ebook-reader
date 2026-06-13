import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  accessTokenExpiry: 7200,       // 2h in seconds
  refreshTokenExpiry: 604800,    // 7d in seconds
  uploadDir: 'uploads',
  maxFileSize: 200 * 1024 * 1024, // 200MB
};
