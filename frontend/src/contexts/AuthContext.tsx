import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface User {
  username: string;
  displayName: string;
  role: string;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  user: User | null;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  skipLogin: () => void;
  isAuthEnabled: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// 从环境变量读取是否启用登录（默认禁用）
const IS_AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true';

// 简单的用户数据库（生产环境应该从后端获取）
const USERS = [
  { username: 'admin', password: 'admin123', displayName: '管理员', role: 'admin' },
  { username: 'user', password: 'user123', displayName: '普通用户', role: 'user' },
  { username: 'guest', password: 'guest123', displayName: '访客', role: 'guest' },
];

const AUTH_STORAGE_KEY = 'auth_user';
const AUTH_SKIP_KEY = 'auth_skip';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // 初始化：检查是否已登录或已跳过
  useEffect(() => {
    if (!IS_AUTH_ENABLED) {
      // 如果未启用认证，直接设置为已认证
      setIsAuthenticated(true);
      setUser({ username: 'anonymous', displayName: '匿名用户', role: 'user' });
      return;
    }

    // 检查是否已跳过登录
    const skipped = localStorage.getItem(AUTH_SKIP_KEY);
    if (skipped === 'true') {
      setIsAuthenticated(true);
      setUser({ username: 'guest', displayName: '访客（已跳过登录）', role: 'guest' });
      return;
    }

    // 检查是否有保存的登录状态
    const savedUser = localStorage.getItem(AUTH_STORAGE_KEY);
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setIsAuthenticated(true);
      } catch (e) {
        console.error('Failed to parse saved user data:', e);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    // 模拟异步验证
    await new Promise(resolve => setTimeout(resolve, 500));

    const foundUser = USERS.find(u => u.username === username && u.password === password);

    if (foundUser) {
      const userData: User = {
        username: foundUser.username,
        displayName: foundUser.displayName,
        role: foundUser.role,
      };

      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
      localStorage.removeItem(AUTH_SKIP_KEY);

      return { success: true };
    } else {
      return { success: false, message: '用户名或密码错误' };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_SKIP_KEY);
  }, []);

  const skipLogin = useCallback(() => {
    setIsAuthenticated(true);
    setUser({ username: 'guest', displayName: '访客（已跳过登录）', role: 'guest' });
    localStorage.setItem(AUTH_SKIP_KEY, 'true');
  }, []);

  const value: AuthContextValue = {
    isAuthenticated,
    user,
    login,
    logout,
    skipLogin,
    isAuthEnabled: IS_AUTH_ENABLED,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
