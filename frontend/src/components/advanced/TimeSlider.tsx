import React, { useState, useCallback, useEffect, useRef } from 'react';

interface TimeSliderProps {
  dates: string[];
  currentDate: string | null;
  onDateChange: (date: string) => void;
  isPlaying?: boolean;
  onPlayToggle?: () => void;
  playInterval?: number;
}

export const TimeSlider: React.FC<TimeSliderProps> = ({
  dates,
  currentDate,
  onDateChange,
  isPlaying = false,
  onPlayToggle,
  playInterval = 1000,
}) => {
  const [sliderValue, setSliderValue] = useState(0);
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync slider with currentDate
  useEffect(() => {
    if (currentDate && dates.length > 0) {
      const idx = dates.indexOf(currentDate);
      if (idx >= 0) {
        setSliderValue(idx);
      }
    }
  }, [currentDate, dates]);

  // Handle auto-play
  useEffect(() => {
    if (isPlaying && dates.length > 0) {
      playTimerRef.current = setInterval(() => {
        setSliderValue(prev => {
          const next = (prev + 1) % dates.length;
          onDateChange(dates[next]);
          return next;
        });
      }, playInterval);
    } else {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    }

    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
      }
    };
  }, [isPlaying, dates, onDateChange, playInterval]);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const idx = parseInt(e.target.value, 10);
      setSliderValue(idx);
      if (dates[idx]) {
        onDateChange(dates[idx]);
      }
    },
    [dates, onDateChange]
  );

  const handleStepBack = useCallback(() => {
    if (sliderValue > 0) {
      const newIdx = sliderValue - 1;
      setSliderValue(newIdx);
      onDateChange(dates[newIdx]);
    }
  }, [sliderValue, dates, onDateChange]);

  const handleStepForward = useCallback(() => {
    if (sliderValue < dates.length - 1) {
      const newIdx = sliderValue + 1;
      setSliderValue(newIdx);
      onDateChange(dates[newIdx]);
    }
  }, [sliderValue, dates, onDateChange]);

  if (dates.length === 0) {
    return <div style={styles.container}>正在加载日期...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.controls}>
        <button
          style={styles.button}
          onClick={handleStepBack}
          disabled={sliderValue === 0}
          title="上一个"
        >
          {'<<'}
        </button>

        {onPlayToggle && (
          <button
            style={{ ...styles.button, ...styles.playButton }}
            onClick={onPlayToggle}
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? '||' : '>'}
          </button>
        )}

        <button
          style={styles.button}
          onClick={handleStepForward}
          disabled={sliderValue === dates.length - 1}
          title="下一个"
        >
          {'>>'}
        </button>
      </div>

      <div style={styles.sliderContainer}>
        <input
          type="range"
          min={0}
          max={dates.length - 1}
          value={sliderValue}
          onChange={handleSliderChange}
          style={styles.slider}
        />
      </div>

      <div style={styles.dateDisplay}>
        <span style={styles.dateLabel}>日期：</span>
        <span style={styles.dateValue}>{dates[sliderValue] || '-'}</span>
        <span style={styles.dateIndex}>
          ({sliderValue + 1} / {dates.length})
        </span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'rgba(30, 30, 50, 0.8)',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.3)',
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
  },
  button: {
    padding: '8px 16px',
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    border: '1px solid rgba(74, 158, 255, 0.5)',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  playButton: {
    backgroundColor: 'rgba(74, 255, 158, 0.2)',
    borderColor: 'rgba(74, 255, 158, 0.5)',
    minWidth: '50px',
  },
  sliderContainer: {
    padding: '0 8px',
  },
  slider: {
    width: '100%',
    height: '8px',
    cursor: 'pointer',
    accentColor: '#4a9eff',
  },
  dateDisplay: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
  },
  dateLabel: {
    color: '#888',
  },
  dateValue: {
    color: '#4a9eff',
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  dateIndex: {
    color: '#666',
    fontSize: '12px',
  },
};

export default TimeSlider;
