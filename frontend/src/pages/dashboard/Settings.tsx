import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { PhaseNotice } from '../../components/common/PhaseNotice';
import { Settings as SettingsIcon, Shield, Radio, Save, Clock } from 'lucide-react';
import { organizationApi, type OrganizationSettings } from '../../api/backend';
import { errorMessage } from '../../api/client';
import { useAuthStore } from '../../store/useAuthStore';
import { FormError } from '../auth/LoginPage';

const input = 'w-full bg-ops-base border border-ops-border rounded-lg px-3 py-2 text-white font-mono disabled:opacity-60';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

      <PhaseNotice phase={4} feature="Anomaly scoring thresholds">
        Speed and GPS-jump thresholds become configurable together with the explainable anomaly rules.
      </PhaseNotice>
    </div>
  );
};
