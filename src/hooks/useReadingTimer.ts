import { useEffect, useRef, useCallback } from 'react';
import { useReadingStatsStore } from '@/stores/readingStatsStore';
import { useAuthStore } from '@/stores/authStore';

interface UseReadingTimerOptions {
  bookId: string;
  currentPage?: string;
  currentChapter?: string;
  isActive?: boolean; // 是否处于活跃阅读状态
}

// 空闲超时时间：3分钟（毫秒）
const IDLE_TIMEOUT = 3 * 60 * 1000;
// 用户活动检测节流时间：500毫秒
const ACTIVITY_THROTTLE = 500;
// 最小记录阈值：30秒
const MIN_RECORD_DURATION = 30;
// 会话合并间隔：5分钟（毫秒）
const SESSION_MERGE_INTERVAL = 5 * 60 * 1000;

export function useReadingTimer(options: UseReadingTimerOptions) {
  const { bookId, currentPage, currentChapter, isActive = true } = options;
  const user = useAuthStore((s) => s.user);
  const userId = user?.id || 'local_user';

  const {
    activeSession,
    startSession,
    endSession,
  } = useReadingStatsStore();

  // 使用 ref 存储状态，避免不必要的重渲染
  const isActiveRef = useRef(isActive);
  const isPausedRef = useRef(false);
  const lastActivityTimeRef = useRef(Date.now());
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);

  // 更新活跃状态 ref
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // 检测用户活动
  const handleUserActivity = useCallback(() => {
    // 节流处理
    if (activityThrottleRef.current) return;

    activityThrottleRef.current = setTimeout(() => {
      activityThrottleRef.current = null;
    }, ACTIVITY_THROTTLE);

    const now = Date.now();
    lastActivityTimeRef.current = now;

    // 如果处于暂停状态，恢复会话
    if (isPausedRef.current && activeSession) {
      isPausedRef.current = false;
    }

    // 重置空闲计时器
    resetIdleTimer();
  }, [activeSession]);

  // 重置空闲计时器
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    idleTimerRef.current = setTimeout(() => {
      // 空闲超时，暂停计时
      if (isActiveRef.current && !isPausedRef.current) {
        isPausedRef.current = true;
      }
    }, IDLE_TIMEOUT);
  }, []);

  // 清理空闲计时器
  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  // 开始新会话
  const startNewSession = useCallback(() => {
    if (!isActiveRef.current) return;

    // 检查是否需要合并会话（同一本书，间隔 < 5分钟）
    const now = Date.now();
    if (activeSession && activeSession.bookId === bookId) {
      const timeSinceLastSession = now - activeSession.startTime;
      if (timeSinceLastSession < SESSION_MERGE_INTERVAL) {
        // 恢复之前的会话
        isPausedRef.current = false;
        sessionStartTimeRef.current = activeSession.startTime;
        resetIdleTimer();
        return;
      }
    }

    // 结束之前的会话（如果有）
    if (activeSession) {
      endSession();
    }

    // 开始新会话
    startSession(bookId, userId, currentPage, currentChapter);
    sessionStartTimeRef.current = now;
    isPausedRef.current = false;
    lastActivityTimeRef.current = now;
    resetIdleTimer();
  }, [bookId, userId, currentPage, currentChapter, activeSession, startSession, endSession, resetIdleTimer]);

  // 结束当前会话
  const endCurrentSession = useCallback(async () => {
    clearIdleTimer();

    if (!activeSession || !sessionStartTimeRef.current) return;

    const now = Date.now();
    const duration = Math.floor((now - sessionStartTimeRef.current) / 1000);

    // 只保存时长 >= 30秒的会话
    if (duration >= MIN_RECORD_DURATION) {
      await endSession();
    } else {
      // 时长太短，直接清理状态
      useReadingStatsStore.setState({ activeSession: null, currentSessionDuration: 0 });
    }

    sessionStartTimeRef.current = null;
    isPausedRef.current = false;
  }, [activeSession, endSession, clearIdleTimer]);

  // 组件挂载时开始会话
  useEffect(() => {
    if (isActive && bookId) {
      startNewSession();
    }

    return () => {
      // 组件卸载时结束会话
      endCurrentSession();
    };
  }, [bookId, isActive]); // 依赖 bookId 和 isActive

  // 监听用户活动事件
  useEffect(() => {
    if (!isActive) return;

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    events.forEach((event) => {
      document.addEventListener(event, handleUserActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleUserActivity);
      });
    };
  }, [isActive, handleUserActivity]);

  // 监听页面可见性变化
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 页面隐藏，暂停计时
        if (!isPausedRef.current) {
          isPausedRef.current = true;
          clearIdleTimer();
        }
      } else {
        // 页面显示，恢复计时
        if (isActiveRef.current) {
          // 检查是否空闲太久
          const now = Date.now();
          const timeSinceLastActivity = now - lastActivityTimeRef.current;

          if (timeSinceLastActivity > IDLE_TIMEOUT) {
            // 空闲太久，结束旧会话，开始新会话
            endCurrentSession().then(() => {
              startNewSession();
            });
          } else {
            isPausedRef.current = false;
            lastActivityTimeRef.current = now;
            resetIdleTimer();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startNewSession, endCurrentSession, clearIdleTimer, resetIdleTimer]);

  // 监听页面关闭/刷新
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 同步结束会话
      if (activeSession && sessionStartTimeRef.current) {
        const now = Date.now();
        const duration = Math.floor((now - sessionStartTimeRef.current) / 1000);

        if (duration >= MIN_RECORD_DURATION) {
          // 使用 sendBeacon 发送数据（如果浏览器支持）
          // 否则尝试同步 XMLHttpRequest
          // 这里我们只清理状态，实际保存由 endSession 处理
          endSession();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeSession, endSession]);

  // 位置变化时更新会话
  useEffect(() => {
    if (activeSession && currentPage && isActive && !isPausedRef.current) {
      // 位置变化时记录用户活动
      lastActivityTimeRef.current = Date.now();
      resetIdleTimer();
    }
  }, [currentPage, currentChapter, activeSession, isActive, resetIdleTimer]);

  // 返回当前会话状态
  return {
    isRecording: !!activeSession && !isPausedRef.current,
    isPaused: isPausedRef.current,
    sessionStartTime: sessionStartTimeRef.current,
  };
}

export default useReadingTimer;
