import React, { useEffect, useCallback } from 'react';

interface FullscreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const FullscreenModal: React.FC<FullscreenModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fullscreen-modal" onClick={onClose}>
      <div className="fullscreen-modal__backdrop" />

      <div
        className="fullscreen-modal__content"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="fullscreen-modal__header">
          {title && <h3 className="fullscreen-modal__title">{title}</h3>}
          <button
            className="fullscreen-modal__close"
            onClick={onClose}
            title="Close (Esc)"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Body */}
        <div className="fullscreen-modal__body">
          {children}
        </div>
      </div>

      <style>{`
        .fullscreen-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: var(--z-modal, 1001);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }

        .fullscreen-modal__backdrop {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(4px);
        }

        .fullscreen-modal__content {
          position: relative;
          width: 100%;
          height: 100%;
          max-width: 1600px;
          background: var(--panel-bg, rgba(10, 18, 30, 0.95));
          border: 1px solid rgba(0, 229, 255, 0.3);
          border-radius: 8px;
          box-shadow: 0 0 40px rgba(0, 229, 255, 0.2);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: modalFadeIn 0.2s ease-out;
        }

        @keyframes modalFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .fullscreen-modal__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(0, 229, 255, 0.2);
          background: linear-gradient(90deg,
            rgba(0, 229, 255, 0.05),
            rgba(0, 229, 255, 0.1),
            rgba(0, 229, 255, 0.05));
        }

        .fullscreen-modal__title {
          color: var(--primary-color, #00e5ff);
          font-size: 16px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 0;
        }

        .fullscreen-modal__close {
          background: rgba(255, 62, 95, 0.2);
          border: 1px solid rgba(255, 62, 95, 0.3);
          color: rgba(255, 255, 255, 0.8);
          border-radius: 4px;
          width: 36px;
          height: 36px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          transition: all 0.2s ease;
        }

        .fullscreen-modal__close:hover {
          background: rgba(255, 62, 95, 0.4);
          border-color: rgba(255, 62, 95, 0.6);
          color: white;
        }

        .fullscreen-modal__body {
          flex: 1;
          padding: 20px;
          overflow: auto;
          min-height: 0;
        }
      `}</style>
    </div>
  );
};

export default FullscreenModal;
