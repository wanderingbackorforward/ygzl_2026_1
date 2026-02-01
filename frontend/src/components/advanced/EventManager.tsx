import React, { useState, useCallback } from 'react';
import {
  useConstructionEvents,
  useEventTypes,
  useEventImpact,
  createEvent,
  deleteEvent,
  type ConstructionEvent,
} from '../../hooks/useAdvancedAnalysis';

interface EventManagerProps {
  onEventSelect?: (event: ConstructionEvent) => void;
}

export const EventManager: React.FC<EventManagerProps> = ({ onEventSelect }) => {
  const { events, loading, refetch } = useConstructionEvents();
  const eventTypes = useEventTypes();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const { analysis: impact, loading: impactLoading } = useEventImpact(selectedEventId);

  const handleEventClick = (event: ConstructionEvent) => {
    setSelectedEventId(event.event_id);
    onEventSelect?.(event);
  };

  const handleAddEvent = async (data: Partial<ConstructionEvent>) => {
    try {
      await createEvent(data);
      setShowAddForm(false);
      refetch();
    } catch (e) {
      console.error('Failed to create event:', e);
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      await deleteEvent(eventId);
      setSelectedEventId(null);
      refetch();
    } catch (e) {
      console.error('Failed to delete event:', e);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>Construction Events</h3>
        <button style={styles.addButton} onClick={() => setShowAddForm(true)}>
          + Add Event
        </button>
      </div>

      <div style={styles.content}>
        {/* Event List */}
        <div style={styles.eventList}>
          {loading ? (
            <div style={styles.loading}>Loading events...</div>
          ) : events.length === 0 ? (
            <div style={styles.empty}>No events recorded</div>
          ) : (
            events.map(event => (
              <EventCard
                key={event.event_id}
                event={event}
                isSelected={selectedEventId === event.event_id}
                onClick={() => handleEventClick(event)}
                onDelete={() => handleDeleteEvent(event.event_id)}
              />
            ))
          )}
        </div>

        {/* Impact Analysis */}
        <div style={styles.impactPanel}>
          {selectedEventId ? (
            impactLoading ? (
              <div style={styles.loading}>Analyzing impact...</div>
            ) : impact ? (
              <ImpactDisplay analysis={impact} />
            ) : (
              <div style={styles.empty}>No impact data</div>
            )
          ) : (
            <div style={styles.placeholder}>
              Select an event to view impact analysis
            </div>
          )}
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddForm && (
        <AddEventModal
          eventTypes={eventTypes}
          onSubmit={handleAddEvent}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
};

// Event Card
const EventCard: React.FC<{
  event: ConstructionEvent;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}> = ({ event, isSelected, onClick, onDelete }) => {
  const typeColors: Record<string, string> = {
    pile: '#ff6b6b',
    excavation: '#ffa94d',
    grouting: '#74c0fc',
    dewatering: '#69db7c',
    loading: '#da77f2',
    other: '#868e96',
  };

  return (
    <div
      style={{
        ...styles.eventCard,
        ...(isSelected ? styles.eventCardSelected : {}),
        borderLeftColor: typeColors[event.event_type] || '#888',
      }}
      onClick={onClick}
    >
      <div style={styles.eventHeader}>
        <span
          style={{
            ...styles.eventType,
            backgroundColor: typeColors[event.event_type] || '#888',
          }}
        >
          {event.event_type.toUpperCase()}
        </span>
        <span style={styles.eventDate}>{event.event_date}</span>
      </div>
      <div style={styles.eventTitle}>{event.title}</div>
      {event.description && (
        <div style={styles.eventDescription}>{event.description}</div>
      )}
      <button
        style={styles.deleteButton}
        onClick={e => {
          e.stopPropagation();
          onDelete();
        }}
      >
        Delete
      </button>
    </div>
  );
};

// Impact Display
const ImpactDisplay: React.FC<{ analysis: any }> = ({ analysis }) => {
  const { event, affected_points, summary } = analysis;

  const impactLevelColors: Record<string, string> = {
    high: '#ff4444',
    medium: '#ffaa00',
    low: '#88cc00',
    none: '#666',
  };

  return (
    <div style={styles.impactContainer}>
      <div style={styles.impactHeader}>
        <h4 style={styles.impactTitle}>Impact Analysis: {event?.title}</h4>
        <div style={styles.impactWindow}>Window: {analysis.window_hours}h</div>
      </div>

      {/* Summary */}
      <div style={styles.summaryGrid}>
        <div style={styles.summaryItem}>
          <div style={styles.summaryValue}>{summary.total_analyzed}</div>
          <div style={styles.summaryLabel}>Points Analyzed</div>
        </div>
        <div style={{ ...styles.summaryItem, ...styles.summaryHigh }}>
          <div style={styles.summaryValue}>{summary.high_impact}</div>
          <div style={styles.summaryLabel}>High Impact</div>
        </div>
        <div style={{ ...styles.summaryItem, ...styles.summaryMedium }}>
          <div style={styles.summaryValue}>{summary.medium_impact}</div>
          <div style={styles.summaryLabel}>Medium Impact</div>
        </div>
        <div style={styles.summaryItem}>
          <div style={styles.summaryValue}>{summary.max_rate_change.toFixed(3)}</div>
          <div style={styles.summaryLabel}>Max Rate Change</div>
        </div>
      </div>

      {/* Affected Points */}
      <div style={styles.pointsHeader}>Affected Points</div>
      <div style={styles.affectedPointsList}>
        {affected_points.slice(0, 10).map((p: any, idx: number) => (
          <div key={idx} style={styles.affectedPoint}>
            <span style={styles.pointName}>{p.point_id}</span>
            <span
              style={{
                ...styles.impactLevel,
                backgroundColor: impactLevelColors[p.impact_level],
              }}
            >
              {p.impact_level}
            </span>
            <span style={styles.rateChange}>
              {p.rate_change > 0 ? '+' : ''}
              {p.rate_change.toFixed(3)} mm/day
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Add Event Modal
const AddEventModal: React.FC<{
  eventTypes: Array<{ value: string; label: string }>;
  onSubmit: (data: Partial<ConstructionEvent>) => void;
  onClose: () => void;
}> = ({ eventTypes, onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    event_date: new Date().toISOString().slice(0, 16),
    event_type: 'pile',
    title: '',
    description: '',
    intensity: 'medium',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Add Construction Event</h3>
          <button style={styles.closeButton} onClick={onClose}>
            x
          </button>
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Event Date/Time</label>
            <input
              type="datetime-local"
              value={formData.event_date}
              onChange={e => setFormData({ ...formData, event_date: e.target.value })}
              style={styles.input}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Event Type</label>
            <select
              value={formData.event_type}
              onChange={e => setFormData({ ...formData, event_type: e.target.value })}
              style={styles.input}
            >
              {eventTypes.map(t => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Pile driving at section 5"
              style={styles.input}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional details..."
              style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Intensity</label>
            <select
              value={formData.intensity}
              onChange={e => setFormData({ ...formData, intensity: e.target.value })}
              style={styles.input}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div style={styles.formActions}>
            <button type="button" style={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" style={styles.submitButton}>
              Add Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'rgba(20, 20, 40, 0.9)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(74, 158, 255, 0.3)',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    color: '#fff',
  },
  addButton: {
    padding: '6px 12px',
    backgroundColor: 'rgba(74, 255, 158, 0.2)',
    border: '1px solid rgba(74, 255, 158, 0.5)',
    borderRadius: '4px',
    color: '#4aff9e',
    cursor: 'pointer',
    fontSize: '13px',
  },
  content: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  eventList: {
    width: '300px',
    borderRight: '1px solid rgba(74, 158, 255, 0.2)',
    overflowY: 'auto',
    padding: '8px',
  },
  impactPanel: {
    flex: 1,
    padding: '16px',
    overflowY: 'auto',
  },
  loading: {
    padding: '20px',
    textAlign: 'center',
    color: '#888',
  },
  empty: {
    padding: '20px',
    textAlign: 'center',
    color: '#666',
  },
  placeholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666',
  },
  eventCard: {
    padding: '12px',
    marginBottom: '8px',
    backgroundColor: 'rgba(40, 40, 60, 0.8)',
    borderRadius: '6px',
    borderLeft: '4px solid #888',
    cursor: 'pointer',
    transition: 'all 0.2s',
    position: 'relative',
  },
  eventCardSelected: {
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
  },
  eventHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  eventType: {
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#fff',
  },
  eventDate: {
    fontSize: '11px',
    color: '#888',
  },
  eventTitle: {
    fontSize: '13px',
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: '4px',
  },
  eventDescription: {
    fontSize: '11px',
    color: '#888',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  deleteButton: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    padding: '2px 6px',
    backgroundColor: 'transparent',
    border: '1px solid #ff4444',
    borderRadius: '3px',
    color: '#ff4444',
    fontSize: '10px',
    cursor: 'pointer',
    opacity: 0.6,
  },
  impactContainer: {
    height: '100%',
  },
  impactHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  impactTitle: {
    margin: 0,
    fontSize: '14px',
    color: '#fff',
  },
  impactWindow: {
    fontSize: '12px',
    color: '#888',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    marginBottom: '20px',
  },
  summaryItem: {
    padding: '12px',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    borderRadius: '6px',
    textAlign: 'center',
  },
  summaryHigh: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    border: '1px solid rgba(255, 68, 68, 0.3)',
  },
  summaryMedium: {
    backgroundColor: 'rgba(255, 170, 0, 0.1)',
    border: '1px solid rgba(255, 170, 0, 0.3)',
  },
  summaryValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryLabel: {
    fontSize: '11px',
    color: '#888',
    marginTop: '4px',
  },
  pointsHeader: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#888',
    marginBottom: '12px',
  },
  affectedPointsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  affectedPoint: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    backgroundColor: 'rgba(40, 40, 60, 0.6)',
    borderRadius: '4px',
  },
  pointName: {
    fontWeight: 'bold',
    color: '#fff',
    minWidth: '40px',
  },
  impactLevel: {
    padding: '2px 8px',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#fff',
  },
  rateChange: {
    marginLeft: 'auto',
    fontSize: '12px',
    color: '#888',
    fontFamily: 'monospace',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    width: '400px',
    backgroundColor: '#1a1a2e',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    borderBottom: '1px solid rgba(74, 158, 255, 0.2)',
  },
  modalTitle: {
    margin: 0,
    fontSize: '16px',
    color: '#fff',
  },
  closeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#888',
    fontSize: '20px',
    cursor: 'pointer',
  },
  form: {
    padding: '16px',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '12px',
    color: '#888',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: 'rgba(40, 40, 60, 0.8)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '13px',
    boxSizing: 'border-box',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '20px',
  },
  cancelButton: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: '1px solid #888',
    borderRadius: '4px',
    color: '#888',
    cursor: 'pointer',
  },
  submitButton: {
    padding: '8px 16px',
    backgroundColor: 'rgba(74, 158, 255, 0.3)',
    border: '1px solid #4a9eff',
    borderRadius: '4px',
    color: '#4a9eff',
    cursor: 'pointer',
  },
};

export default EventManager;
