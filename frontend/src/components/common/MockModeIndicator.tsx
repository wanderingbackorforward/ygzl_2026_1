// Mock 模式指示器组件
import React from 'react';
import { isMockMode } from '../../utils/apiClient';

export const MockModeIndicator: React.FC = () => {
  const [showIndicator, setShowIndicator] = React.useState(false);

  React.useEffect(() => {
    // 检查是否在 Mock 模式
    const checkInterval = setInterval(() => {
      setShowIndicator(isMockMode());
    }, 1000);

    return () => clearInterval(checkInterval);
  }, []);

  if (!showIndicator) return null;

  return (
    <div style={styles.container}>
      <div style={styles.badge}>
        <i className="fas fa-flask" style={styles.icon} />
        <span style={styles.text}>演示模式</span>
      </div>
      <div style={styles.tooltip}>
        当前显示的是模拟数据，用于功能演示。
        <br />
        生产环境将连接真实的机器学习服务。
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: 9999,
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: 'rgba(255, 152, 0, 0.9)',
    borderRadius: '20px',
    border: '2px solid rgba(255, 152, 0, 1)',
    boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)',
    cursor: 'pointer',
    animation: 'pulse 2s ease-in-out infinite',
  },
  icon: {
    fontSize: '14px',
    color: '#fff',
  },
  text: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: '0.5px',
  },
  tooltip: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '8px',
    padding: '12px',
    backgroundColor: 'rgba(20, 20, 40, 0.95)',
    border: '1px solid rgba(255, 152, 0, 0.5)',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#fff',
    lineHeight: '1.6',
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    opacity: 0,
    pointerEvents: 'none',
    transition: 'opacity 0.2s',
  },
};

// 添加 CSS 动画
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
        opacity: 1;
      }
      50% {
        transform: scale(1.05);
        opacity: 0.9;
      }
    }

    div[style*="position: fixed"][style*="top: 16px"] > div:first-child:hover + div {
      opacity: 1 !important;
    }
  `;
  document.head.appendChild(style);
}
