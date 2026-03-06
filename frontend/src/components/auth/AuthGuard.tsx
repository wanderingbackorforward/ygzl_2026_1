import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import LoginPage from '../../pages/LoginPage';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isAuthEnabled } = useAuth();

  // 如果未启用认证，直接渲染子组件
  if (!isAuthEnabled) {
    return <>{children}</>;
  }

  // 如果已认证，渲染子组件
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // 未认证，显示登录页面
  return <LoginPage />;
}
