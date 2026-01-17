import React from 'react';
import type { CardComponentProps } from '../../types/layout';
import { useVibration } from '../../contexts/VibrationContext';

export const ChannelDetails: React.FC<CardComponentProps> = () => {
  const { selectedDatasetId, selectedChannelId, channels } = useVibration();
  const channel = channels.find(c => c.channel_id === selectedChannelId) || null;
  return (
    <div className="channel-details">
      <div className="channel-details__header">
        <h4 className="channel-details__title">
          <i className="fas fa-wave-square" />
          {selectedDatasetId || 'Dataset'} / {selectedChannelId || 'Channel'}
        </h4>
      </div>
      <div className="channel-details__grid">
        <div className="channel-details__item">
          <span className="channel-details__label">名称</span>
          <span className="channel-details__value">{channel?.name || '-'}</span>
        </div>
        <div className="channel-details__item">
          <span className="channel-details__label">单位</span>
          <span className="channel-details__value">{channel?.unit || '-'}</span>
        </div>
      </div>
      <style>{`
        .channel-details { height: 100%; display: flex; flex-direction: column; }
        .channel-details__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(0, 229, 255, 0.15); }
        .channel-details__title { color: var(--primary-color); font-size: 16px; font-weight: 500; margin: 0; display: flex; align-items: center; gap: 8px; }
        .channel-details__grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .channel-details__item { background: rgba(0, 20, 40, 0.5); border: 1px solid rgba(0, 229, 255, 0.1); border-radius: 4px; padding: 10px; }
        .channel-details__label { display: block; font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .channel-details__value { display: block; font-size: 14px; font-weight: 500; color: var(--text-color); font-family: 'Consolas', monospace; }
      `}</style>
    </div>
  );
};

export default ChannelDetails;
