import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../lib/api';

// Types
export interface ProfilePoint {
  point_id: string;
  chainage_m: number;
  value: number | null;
  cumulative_change: number | null;
  daily_change: number | null;
}

export interface GeologicalLayer {
  layer_id: number;
  layer_number: string;
  layer_name: string;
  depth_top: number;
  depth_bottom: number;
  thickness: number;
  color: string;
}

export interface ProfileData {
  date: string | null;
  profile: ProfilePoint[];
  layers: GeologicalLayer[];
}

export interface JointMapping {
  settlement_point: string;
  crack_point: string;
  distance_m: number;
  correlation_strength: string;
}

export interface JointData {
  settlement_point: string;
  settlement_data: Array<{
    measurement_date: string;
    value: number;
    cumulative_change: number;
    daily_change: number;
  }>;
  related_cracks: Array<{
    crack_point: string;
    crack_id: string;
    correlation_strength: string;
    distance_m: number;
    data: Array<{
      measurement_date: string;
      value: number;
    }>;
  }>;
}

export interface JointAlert {
  settlement_point: string;
  crack_point: string;
  severity: string;
  settlement_alert_level: string;
  settlement_trend: string;
  settlement_rate: number;
  crack_rate: number;
  message: string;
  recommendation: string;
}

export interface ConstructionEvent {
  event_id: number;
  event_date: string;
  event_end_date?: string;
  event_type: string;
  event_subtype?: string;
  title: string;
  description?: string;
  location_chainage_start?: number;
  location_chainage_end?: number;
  affected_points?: string[];
  intensity?: string;
}

export interface EventType {
  value: string;
  label: string;
  label_cn: string;
}

export interface EventImpactAnalysis {
  event: ConstructionEvent;
  window_hours: number;
  affected_points: Array<{
    point_id: string;
    before_rate: number;
    after_rate: number;
    rate_change: number;
    impact_level: string;
  }>;
  summary: {
    total_analyzed: number;
    high_impact: number;
    medium_impact: number;
    max_rate_change: number;
  };
}

// Hook: Profile Data
export function useProfileData(date?: string) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = date
        ? `${API_BASE}/advanced/profile/data?date=${date}`
        : `${API_BASE}/advanced/profile/data`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch profile data');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Hook: Available Dates
export function useAvailableDates() {
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/advanced/profile/dates`)
      .then(res => res.json())
      .then(json => setDates(json.dates || []))
      .catch(() => setDates([]))
      .finally(() => setLoading(false));
  }, []);

  return { dates, loading };
}

// Hook: Geological Layers
export function useGeologicalLayers() {
  const [layers, setLayers] = useState<GeologicalLayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/advanced/profile/layers`)
      .then(res => res.json())
      .then(json => setLayers(json))
      .catch(() => setLayers([]))
      .finally(() => setLoading(false));
  }, []);

  return { layers, loading };
}

// Hook: Joint Mapping
export function useJointMapping() {
  const [mapping, setMapping] = useState<JointMapping[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/advanced/joint/mapping`)
      .then(res => res.json())
      .then(json => setMapping(json))
      .catch(() => setMapping([]))
      .finally(() => setLoading(false));
  }, []);

  return { mapping, loading };
}

// Hook: Joint Data for a settlement point
export function useJointData(settlementPoint: string | null) {
  const [data, setData] = useState<JointData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!settlementPoint) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/advanced/joint/data/${settlementPoint}`)
      .then(res => res.json())
      .then(json => setData(json))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [settlementPoint]);

  return { data, loading, error };
}

// Hook: Joint Alerts
export function useJointAlerts() {
  const [alerts, setAlerts] = useState<JointAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/advanced/joint/alerts`);
      const json = await res.json();
      setAlerts(json.alerts || []);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, loading, refetch: fetchAlerts };
}

// Hook: Construction Events
export function useConstructionEvents(filters?: { start?: string; end?: string; type?: string }) {
  const [events, setEvents] = useState<ConstructionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.start) params.set('start', filters.start);
      if (filters?.end) params.set('end', filters.end);
      if (filters?.type) params.set('type', filters.type);

      const url = `${API_BASE}/advanced/events?${params.toString()}`;
      const res = await fetch(url);
      const json = await res.json();
      setEvents(json.events || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [filters?.start, filters?.end, filters?.type]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, refetch: fetchEvents };
}

// Hook: Event Types
export function useEventTypes() {
  const [types, setTypes] = useState<EventType[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/advanced/events/types`)
      .then(res => res.json())
      .then(json => setTypes(json))
      .catch(() => setTypes([]));
  }, []);

  return types;
}

// Hook: Event Impact Analysis
export function useEventImpact(eventId: number | null, windowHours?: number) {
  const [analysis, setAnalysis] = useState<EventImpactAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setAnalysis(null);
      return;
    }

    setLoading(true);
    setError(null);
    const url = windowHours
      ? `${API_BASE}/advanced/events/${eventId}/impact?window=${windowHours}`
      : `${API_BASE}/advanced/events/${eventId}/impact`;

    fetch(url)
      .then(res => res.json())
      .then(json => setAnalysis(json))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [eventId, windowHours]);

  return { analysis, loading, error };
}

// Event CRUD operations
export async function createEvent(data: Partial<ConstructionEvent>): Promise<ConstructionEvent> {
  const res = await fetch(`${API_BASE}/advanced/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create event');
  return res.json();
}

export async function updateEvent(eventId: number, data: Partial<ConstructionEvent>): Promise<ConstructionEvent> {
  const res = await fetch(`${API_BASE}/advanced/events/${eventId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update event');
  return res.json();
}

export async function deleteEvent(eventId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/advanced/events/${eventId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete event');
}
