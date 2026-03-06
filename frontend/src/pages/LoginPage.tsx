import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login, skipLogin, isAuthEnabled } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password);
      if (!result.success) {
        setError(result.message || '登录失败');
      }
    } catch (err) {
      setError('登录过程中发生错误');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    skipLogin();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, #0a192f 0%, #040b14 100%)',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'linear-gradient(135deg, rgba(10, 25, 47, 0.95) 0%, rgba(17, 34, 64, 0.95) 100%)',
          borderRadius: 16,
          border: '1px solid rgba(100, 255, 218, 0.2)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '32px 32px 24px',
            borderBottom: '1px solid rgba(100, 255, 218, 0.15)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              margin: '0 auto 16px',
              background: 'linear-gradient(135deg, rgba(100, 255, 218, 0.2) 0%, rgba(0, 229, 255, 0.2) 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(100, 255, 218, 0.3)',
            }}
          >
            <i className="fas fa-shield-alt" style={{ fontSize: 28, color: '#64ffda' }} />
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#e6f7ff', marginBottom: 8 }}>
            数字孪生沉降监测系统
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#8ba0b6' }}>
            Digital Twin Terrain Settlement Monitoring
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: 32 }}>
          {error && (
            <div
              style={{
                marginBottom: 20,
                padding: 12,
                background: 'rgba(255, 62, 95, 0.1)',
                border: '1px solid rgba(255, 62, 95, 0.3)',
                borderRadius: 8,
                color: '#ff3e5f',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <i className="fas fa-exclamation-circle" />
              <span>{error}</span>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 8,
                fontSize: 14,
                fontWeight: 500,
                color: '#e6f7ff',
              }}
            >
              用户名
            </label>
            <div style={{ position: 'relative' }}>
              <i
                className="fas fa-user"
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#8ba0b6',
                  fontSize: 14,
                }}
              />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 40px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(100, 255, 218, 0.2)',
                  borderRadius: 8,
                  color: '#e6f7ff',
                  fontSize: 14,
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(100, 255, 218, 0.5)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(100, 255, 218, 0.2)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 8,
                fontSize: 14,
                fontWeight: 500,
                color: '#e6f7ff',
              }}
            >
              密码
            </label>
            <div style={{ position: 'relative' }}>
              <i
                className="fas fa-lock"
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#8ba0b6',
                  fontSize: 14,
                }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 40px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(100, 255, 218, 0.2)',
                  borderRadius: 8,
                  color: '#e6f7ff',
                  fontSize: 14,
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(100, 255, 218, 0.5)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(100, 255, 218, 0.2)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: loading || !username || !password
                ? 'rgba(100, 255, 218, 0.2)'
                : 'linear-gradient(135deg, rgba(100, 255, 218, 0.3) 0%, rgba(0, 229, 255, 0.3) 100%)',
              border: '1px solid rgba(100, 255, 218, 0.4)',
              borderRadius: 8,
              color: loading || !username || !password ? '#8ba0b6' : '#64ffda',
              fontSize: 15,
              fontWeight: 600,
              cursor: loading || !username || !password ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onMouseEnter={(e) => {
              if (!loading && username && password) {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(100, 255, 218, 0.4) 0%, rgba(0, 229, 255, 0.4) 100%)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && username && password) {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(100, 255, 218, 0.3) 0%, rgba(0, 229, 255, 0.3) 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin" />
                <span>登录中...</span>
              </>
            ) : (
              <>
                <i className="fas fa-sign-in-alt" />
                <span>登录</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            style={{
              width: '100%',
              marginTop: 12,
              padding: '10px 20px',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 8,
              color: '#8ba0b6',
              fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.color = '#e6f7ff';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.color = '#8ba0b6';
              }
            }}
          >
            <i className="fas fa-forward" style={{ marginRight: 6 }} />
            跳过登录
          </button>
        </form>

        {/* Footer */}
        <div
          style={{
            padding: '16px 32px',
            borderTop: '1px solid rgba(100, 255, 218, 0.1)',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <details style={{ cursor: 'pointer' }}>
            <summary
              style={{
                fontSize: 13,
                color: '#8ba0b6',
                userSelect: 'none',
                listStyle: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <i className="fas fa-info-circle" />
              <span>测试账号</span>
            </summary>
            <div
              style={{
                marginTop: 12,
                padding: 12,
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 6,
                fontSize: 12,
                color: '#8ba0b6',
                lineHeight: 1.8,
              }}
            >
              <div>管理员：admin / admin123</div>
              <div>普通用户：user / user123</div>
              <div>访客：guest / guest123</div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
