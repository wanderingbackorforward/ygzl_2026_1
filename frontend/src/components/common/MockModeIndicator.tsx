// Mock 模式指示器组件
import React from 'react';
import { isMockMode, setMockMode, getFailedEndpointCount } from '../../utils/apiClient';

export const MockModeIndicator: React.FC = () => {
  const [showIndicator, setShowIndicator] = React.useState(false);
  const [count, setCount] = React.useState(0);
  const [showTooltip, setShowTooltip] = React.useState(false);

  React.useEffect(() => {
    const checkInterval = setInterval(() => {
      setShowIndicator(isMockMode());
      setCount(getFailedEndpointCount());
    }, 1000);

    return () => clearInterval(checkInterval);
  }, []);

  const handleExit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMockMode(false);
    setShowIndicator(false);
    setShowTooltip(false);
    // 刷新页面以重新请求真实 API
    window.location.reload();
  };

  if (!showIndicator) return null;

  return (
    <div style={styles.container}>
      <div
        style={styles.badge}
        onClick={() => setShowTooltip(!showTooltip)}
      >
        <i className="fas fa-flask" style={styles.icon} />
        <span style={styles.text}>演示模式 ({count})</span>
      </div>
      {showTooltip && (
        <div style={styles.tooltipVisible}>
          <div style={{ marginBottom: '8px' }}>
            当前有 {count} 个接口降级为模拟数据。
            <br />
            点击下方按钮尝试重新连接真实服务。
          </div>
          <button
            onClick={handleExit}
            style={styles.exitButton}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0e7490')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#0891b2')}
          >
            <i className="fas fa-sync-alt" style={{ marginRight: '6px' }} />
            退出演示模式
          </button>
        </div>
      )}
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
  tooltipVisible: {
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
  },
  exitButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '8px 12px',
    backgroundColor: '#0891b2',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
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
  `;
  document.head.appendChild(style);
}
