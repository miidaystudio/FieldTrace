import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Settings as SettingsIcon, Shield, Radio, Save, Clock, Zap } from 'lucide-react';
import { organizationApi, type AnomalyRules, type OrganizationSettings } from '../../api/backend';
import { errorMessage } from '../../api/client';
import { useAuthStore } from '../../store/useAuthStore';
import { FormError } from '../auth/LoginPage';
import { MyNotificationsCard, WebhookCard } from './NotificationSettings';

const input = 'w-full bg-ops-base border border-ops-border rounded-lg px-3 py-2 text-white font-mono disabled:opacity-60';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type RuleKey = keyof AnomalyRules;
interface RuleField {
  key: string;
  label: string;
  min: number;
  max: number;
}

/** UI description of each anomaly rule; limits mirror the backend validation. */
const RULES: { key: RuleKey; title: string; help: string; fields: RuleField[] }[] = [
  {
    key: 'impossibleSpeed',
    title: 'Impossible speed',
    help: 'Travel between two fixes faster than this (after allowing for GPS accuracy).',
    fields: [{ key: 'maxSpeedKmh', label: 'Max speed (km/h)', min: 60, max: 1000 }],
  },
  {
    key: 'gpsJump',
    title: 'GPS jump',
    help: 'A sudden displacement — typical of spoofing apps or bad fixes.',
    fields: [
      { key: 'minDistanceM', label: 'Min distance (m)', min: 200, max: 50000 },
      { key: 'maxIntervalSec', label: 'Within (seconds)', min: 5, max: 600 },
    ],
  },
  { key: 'mockLocation', title: 'Mock location', help: 'The phone reports a simulated location.', fields: [] },
  {
    key: 'signalGap',
    title: 'Signal gap',
    help: 'No GPS while on shift (breaks are ignored).',
    fields: [{ key: 'minGapMin', label: 'After (minutes)', min: 2, max: 240 }],
  },
  {
    key: 'longUnplannedStop',
    title: 'Long unplanned stop',
    help: 'Stationary away from every client geofence.',
    fields: [{ key: 'minStopMin', label: 'After (minutes)', min: 5, max: 480 }],
  },
  { key: 'visitIssues', title: 'Visit issues', help: 'Visits sent to review or missed become anomalies.', fields: [] },
  { key: 'offHours', title: 'Off-hours activity', help: 'Tracking outside the working hours above.', fields: [] },
];

export const Settings: React.FC = () => {
  const organization = useAuthStore((state) => state.organization);
  const setOrganization = useAuthStore((state) => state.setOrganization);
  const isAdmin = useAuthStore((state) => state.user?.role === 'admin');

  const [name, setName] = useState(organization?.name ?? '');
  const [timezone, setTimezone] = useState(organization?.timezone ?? 'UTC');
  const [settings, setSettings] = useState<OrganizationSettings | null>(organization?.settings ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Always show the latest stored values.
  useEffect(() => {
    organizationApi
      .get()
      .then((org) => {
        setOrganization(org);
        setName(org.name);
        setTimezone(org.timezone);
        setSettings(org.settings);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [setOrganization]);

  if (!settings) return <div className="p-6 text-xs text-gray-400">Loading settings…</div>;

  const update = <K extends keyof OrganizationSettings>(key: K, value: OrganizationSettings[K]) =>
    setSettings({ ...settings, [key]: value });

  const updateRule = (key: RuleKey, patch: Record<string, number | boolean>) =>
    update('anomalyRules', {
      ...settings.anomalyRules,
      [key]: { ...settings.anomalyRules[key], ...patch },
    } as AnomalyRules);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const org = await organizationApi.update({ name, timezone, settings });
      setOrganization(org);
      setSettings(org.settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto text-gray-100 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-brand-teal" />
            <span>Organization Settings</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Stored in the backend and applied to live tracking (connectivity status) and new geofences.
            {!isAdmin && ' Read-only: only admins can change settings.'}
          </p>
        </div>
        {isAdmin && (
          <Button variant="primary" size="sm" leftIcon={<Save className="w-4 h-4" />} disabled={saving} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : saved ? 'Settings Saved!' : 'Save Changes'}
          </Button>
        )}
      </div>

      <FormError message={error} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card header={<div className="flex items-center gap-2"><SettingsIcon className="w-4 h-4 text-brand-teal" /><span>Organization</span></div>}>
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-gray-300 mb-1">Name</label>
              <input className={input} disabled={!isAdmin} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block font-semibold text-gray-300 mb-1">Timezone (IANA)</label>
              <input className={input} disabled={!isAdmin} value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              <span className="text-[11px] text-gray-400 mt-1 block">Assignment dates and "today" use this timezone.</span>
            </div>
          </div>
        </Card>

        <Card header={<div className="flex items-center gap-2"><Radio className="w-4 h-4 text-brand-teal" /><span>Live Tracking Freshness</span></div>}>
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-gray-300 mb-1">Mark stale after (seconds without GPS)</label>
              <input type="number" className={input} disabled={!isAdmin} value={settings.staleAfterSec} onChange={(e) => update('staleAfterSec', Number(e.target.value))} />
            </div>
            <div>
              <label className="block font-semibold text-gray-300 mb-1">Mark offline after (seconds without GPS)</label>
              <input type="number" className={input} disabled={!isAdmin} value={settings.offlineAfterSec} onChange={(e) => update('offlineAfterSec', Number(e.target.value))} />
              <span className="text-[11px] text-gray-400 mt-1 block">Must be greater than the stale threshold.</span>
            </div>
            <div>
              <label className="block font-semibold text-gray-300 mb-1">Telemetry retention (days)</label>
              <input type="number" className={input} disabled={!isAdmin} value={settings.telemetryRetentionDays} onChange={(e) => update('telemetryRetentionDays', Number(e.target.value))} />
            </div>
          </div>
        </Card>

        <Card header={<div className="flex items-center gap-2"><Shield className="w-4 h-4 text-brand-teal" /><span>Geofence Defaults (new locations)</span></div>}>
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-gray-300 mb-1">Default radius (meters)</label>
              <input
                type="number"
                className={input}
                disabled={!isAdmin}
                value={settings.geofenceDefaults.radiusM}
                onChange={(e) => update('geofenceDefaults', { ...settings.geofenceDefaults, radiusM: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-300 mb-1">Minimum dwell for a visit (seconds)</label>
              <input
                type="number"
                className={input}
                disabled={!isAdmin}
                value={settings.geofenceDefaults.minDwellSec}
                onChange={(e) => update('geofenceDefaults', { ...settings.geofenceDefaults, minDwellSec: Number(e.target.value) })}
              />
            </div>
          </div>
        </Card>

        <Card header={<div className="flex items-center gap-2"><Clock className="w-4 h-4 text-brand-teal" /><span>Working Hours</span></div>}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-gray-300 mb-1">Start</label>
                <input type="time" className={input} disabled={!isAdmin} value={settings.workingHours.start} onChange={(e) => update('workingHours', { ...settings.workingHours, start: e.target.value })} />
              </div>
              <div>
                <label className="block font-semibold text-gray-300 mb-1">End</label>
                <input type="time" className={input} disabled={!isAdmin} value={settings.workingHours.end} onChange={(e) => update('workingHours', { ...settings.workingHours, end: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((label, index) => {
                const day = index + 1;
                const active = settings.workingHours.days.includes(day);
                return (
                  <button
                    key={label}
                    disabled={!isAdmin}
                    onClick={() =>
                      update('workingHours', {
                        ...settings.workingHours,
                        days: active
                          ? settings.workingHours.days.filter((d) => d !== day)
                          : [...settings.workingHours.days, day].sort(),
                      })
                    }
                    className={`px-2.5 py-1 rounded-lg border font-mono ${
                      active ? 'bg-brand-teal text-ops-base border-brand-teal font-bold' : 'text-gray-400 border-ops-border'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      <Card header={<div className="flex items-center gap-2"><Zap className="w-4 h-4 text-brand-teal" /><span>Anomaly Rules</span></div>}>
        <p className="text-[11px] text-gray-400 mb-4">
          Explainable rules that raise items in the Anomaly Center. They flag signals for a person to review —
          nothing is rejected automatically. Changes apply to new GPS data within ~30 seconds.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {RULES.map((rule) => {
            const config = settings.anomalyRules[rule.key] as Record<string, number | boolean>;
            const enabled = Boolean(config.enabled);
            return (
              <div key={rule.key} className={`p-3 rounded-xl border ${enabled ? 'border-ops-border bg-ops-card' : 'border-ops-border/50 opacity-70'}`}>
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="font-semibold text-gray-200">{rule.title}</span>
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={enabled}
                    onChange={(e) => updateRule(rule.key, { enabled: e.target.checked })}
                    className="accent-teal-400 w-4 h-4"
                  />
                </label>
                <p className="text-[11px] text-gray-400 mt-1">{rule.help}</p>
                {rule.fields.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {rule.fields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-[11px] text-gray-400 mb-1">{field.label}</label>
                        <input
                          type="number"
                          min={field.min}
                          max={field.max}
                          className={input}
                          disabled={!isAdmin || !enabled}
                          value={Number(config[field.key])}
                          onChange={(e) => updateRule(rule.key, { [field.key]: Number(e.target.value) })}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MyNotificationsCard />
        {isAdmin && <WebhookCard />}
      </div>
    </div>
  );
};
