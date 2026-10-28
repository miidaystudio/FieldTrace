import React, { useEffect, useState } from 'react';
import { Bell, Copy, KeyRound, Send, Trash2, Webhook } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import {
  notificationsApi,
  type NotificationPrefs,
  type Severity,
  type WebhookConfigDto,
  type WebhookDeliveryDto,
} from '../../api/backend';
import { ApiError, errorMessage } from '../../api/client';

const input =
  'w-full bg-ops-base border border-ops-border rounded-lg px-3 py-2 text-white font-mono disabled:opacity-60';
const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: 'low', label: 'Low and above' },
  { value: 'medium', label: 'Medium and above' },
  { value: 'high', label: 'High only' },
];

/** Every staff user: which alerts reach them and which are also emailed. */
export const MyNotificationsCard: React.FC = () => {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    notificationsApi.prefs().then(setPrefs).catch((err) => setMessage(errorMessage(err)));
  }, []);

  const save = async (patch: Parameters<typeof notificationsApi.updatePrefs>[0]) => {
    try {
      setPrefs(await notificationsApi.updatePrefs(patch));
      setMessage('Saved');
      setTimeout(() => setMessage(null), 1500);
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  return (
    <Card header={<div className="flex items-center gap-2"><Bell className="w-4 h-4 text-brand-teal" /><span>My Notifications</span></div>}>
      {!prefs ? (
        <p className="text-gray-400">{message ?? 'Loading…'}</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="flex items-center justify-between gap-2">
              <span className="text-gray-300">New anomalies in my scope</span>
              <input
                type="checkbox"
                className="accent-teal-400 w-4 h-4"
                checked={prefs.events.anomaly}
                onChange={(e) => void save({ events: { anomaly: e.target.checked } })}
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-gray-300">Assignments becoming overdue</span>
              <input
                type="checkbox"
                className="accent-teal-400 w-4 h-4"
                checked={prefs.events.assignment_overdue}
                onChange={(e) => void save({ events: { assignment_overdue: e.target.checked } })}
              />
            </label>
          </div>
          <div className="pt-3 border-t border-ops-border space-y-2">
            <label className="flex items-center justify-between gap-2">
              <span className="text-gray-300">Also send by email</span>
              <input
                type="checkbox"
                className="accent-teal-400 w-4 h-4"
                checked={prefs.email.enabled}
                onChange={(e) => void save({ email: { enabled: e.target.checked } })}
              />
            </label>
            <select
              className={input}
              disabled={!prefs.email.enabled}
              value={prefs.email.minSeverity}
              onChange={(e) => void save({ email: { minSeverity: e.target.value as Severity } })}
            >
              {SEVERITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  Email: {o.label}
                </option>
              ))}
            </select>
          </div>
          {message && <p className="text-[11px] text-gray-400">{message}</p>}
        </div>
      )}
    </Card>
  );
};

/** Admin only: organization webhook (signed POST for each alert). */
export const WebhookCard: React.FC = () => {
  const [config, setConfig] = useState<WebhookConfigDto | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [url, setUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [minSeverity, setMinSeverity] = useState<Severity>('medium');
  const [secret, setSecret] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryDto[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = (dto: WebhookConfigDto | null) => {
    setConfig(dto);
    if (dto) {
      setUrl(dto.url);
      setEnabled(dto.enabled);
      setMinSeverity(dto.minSeverity);
      if (dto.secret) setSecret(dto.secret);
    }
  };

  const load = async () => {
    try {
      apply(await notificationsApi.webhook());
      setDeliveries(await notificationsApi.deliveries());
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) setMessage(errorMessage(err));
      apply(null);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card header={<div className="flex items-center gap-2"><Webhook className="w-4 h-4 text-brand-teal" /><span>Alert Webhook (Slack, Teams, PagerDuty…)</span></div>}>
      {!loaded ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-3">
          <p className="text-[11px] text-gray-400">
            Each alert at or above the chosen severity is POSTed as JSON, signed with
            <code className="mx-1 text-gray-300">X-FieldTrace-Signature: sha256=HMAC(secret, timestamp.body)</code>.
            Production requires an HTTPS URL on a public host.
          </p>
          <input className={input} placeholder="https://hooks.example.com/fieldtrace" value={url} onChange={(e) => setUrl(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <select className={input} value={minSeverity} onChange={(e) => setMinSeverity(e.target.value as Severity)}>
              {SEVERITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-gray-300">
              <input type="checkbox" className="accent-teal-400 w-4 h-4" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Enabled
            </label>
          </div>

          {secret && (
            <div className="p-2 rounded-lg border border-amber-500/40 bg-amber-950/30 text-[11px] text-amber-200 space-y-1">
              <div>Signing secret — copy it now, it will not be shown again:</div>
              <div className="flex items-center gap-2">
                <code className="break-all text-white">{secret}</code>
                <button title="Copy" onClick={() => void navigator.clipboard?.writeText(secret)}>
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
          {config && !secret && <p className="text-[11px] text-gray-500">Secret ends with …{config.secretHint}</p>}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy || url.trim().length === 0}
              onClick={() => void run(async () => apply(await notificationsApi.putWebhook({ url: url.trim(), enabled, minSeverity })))}
            >
              {config ? 'Save' : 'Create webhook'}
            </Button>
            {config && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  leftIcon={<Send className="w-3.5 h-3.5" />}
                  onClick={() =>
                    void run(async () => {
                      const result = await notificationsApi.testWebhook();
                      setMessage(result.ok ? `Test delivered (HTTP ${result.status})` : `Test failed: ${result.error}`);
                    })
                  }
                >
                  Send test
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  leftIcon={<KeyRound className="w-3.5 h-3.5" />}
                  onClick={() => void run(async () => apply(await notificationsApi.rotateSecret()))}
                >
                  Rotate secret
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() =>
                    void run(async () => {
                      await notificationsApi.deleteWebhook();
                      apply(null);
                      setSecret(null);
                      setUrl('');
                      setDeliveries([]);
                    })
                  }
                >
                  Remove
                </Button>
              </>
            )}
          </div>
          {message && <p className="text-[11px] text-gray-300">{message}</p>}

          {deliveries.length > 0 && (
            <div className="pt-2 border-t border-ops-border">
              <div className="text-[10px] uppercase text-gray-500 font-mono mb-1">Recent deliveries</div>
              <div className="max-h-40 overflow-y-auto space-y-1 font-mono text-[10px]">
                {deliveries.slice(0, 15).map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2">
                    <span className="text-gray-300 truncate">{d.event}</span>
                    <span
                      className={
                        d.status === 'sent' ? 'text-emerald-400' : d.status === 'failed' ? 'text-rose-300' : 'text-amber-300'
                      }
                      title={d.lastError ?? undefined}
                    >
                      {d.status} ×{d.attempts}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
