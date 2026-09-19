import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function MonitoringPanel() {
  const [mon, setMon] = useState<any>(null);

  useEffect(() => {
    api.getMonitoring().then(r => setMon(r.data)).catch(console.error);
  }, []);

  if (!mon) return null;

  const fmtBytes = (b: number) => b >= 1073741824 ? (b / 1073741824).toFixed(1) + ' GB' : (b / 1048576).toFixed(1) + ' MB';
  const uptime = () => {
    const s = mon.uptimeSec;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };
  const diskPct = mon.disk ? Math.round(((mon.disk.totalBytes - mon.disk.freeBytes) / mon.disk.totalBytes) * 100) : null;

  return (
    <div className="monitor-card">
      <h3>Monitoring</h3>
      <div className="monitor-grid">
        <div className="monitor-item">
          <span className="monitor-label">Jobs active</span>
          <span className="monitor-value">{mon.jobs.running}<em> / {mon.queueDepth} queued</em></span>
        </div>
        <div className="monitor-item">
          <span className="monitor-label">Done / Failed</span>
          <span className="monitor-value">{mon.jobs.done} / {mon.jobs.failed}</span>
        </div>
        <div className="monitor-item">
          <span className="monitor-label">Quota today</span>
          <span className="monitor-value">{mon.quota ? `${mon.quota.quotaUsed} / ${mon.quota.dailyCaps}` : '—'}</span>
        </div>
        <div className="monitor-item">
          <span className="monitor-label">Schedules active</span>
          <span className="monitor-value">{mon.schedules.active}</span>
        </div>
        <div className="monitor-item">
          <span className="monitor-label">Disk used</span>
          <span className="monitor-value">{diskPct !== null ? diskPct + '%' : '—'}</span>
        </div>
        <div className="monitor-item">
          <span className="monitor-label">DB size</span>
          <span className="monitor-value">{fmtBytes(mon.dbSizeBytes)}</span>
        </div>
      </div>
      <div className="monitor-footer">
        PID {mon.pid} · uptime {uptime()} · v{mon.version} · alerts: <code>data/alerts.log</code>
      </div>
    </div>
  );
}