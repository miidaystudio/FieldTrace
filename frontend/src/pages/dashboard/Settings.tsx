import React, { useState } from 'react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Settings as SettingsIcon, Shield, Sliders, Bell, Radio, Key, Save } from 'lucide-react';

export const Settings: React.FC = () => {
  const [toleranceMeters, setToleranceMeters] = useState(30);
  const [speedThreshold, setSpeedThreshold] = useState(90);
  const [jumpDistanceThreshold, setJumpDistanceThreshold] = useState(1500);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto text-gray-100 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-brand-teal" />
            <span>Platform Configuration & Security Thresholds</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Tune algorithmic sensitivity for GPS spoofing detection, geofence buffers, and notification pipelines.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Save className="w-4 h-4" />}
          onClick={handleSave}
        >
          {saved ? 'Settings Saved!' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Geofence & Check-In Rules */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-teal" />
              <span>Geofencing & Verification Engine</span>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-gray-300 mb-1">
                Default Auto-Verification Tolerance (Meters)
              </label>
              <input
                type="number"
                value={toleranceMeters}
                onChange={(e) => setToleranceMeters(Number(e.target.value))}
                className="w-full bg-ops-base border border-ops-border rounded-lg px-3 py-2 text-white font-mono"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Allowable GPS jitter around site perimeter before flagging check-in.
              </span>
            </div>

            <div>
              <label className="block font-semibold text-gray-300 mb-1">
                Minimum Dwell Time for Auto-Attendance
              </label>
              <input
                type="number"
                defaultValue={3}
                className="w-full bg-ops-base border border-ops-border rounded-lg px-3 py-2 text-white font-mono"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Minutes an agent must remain inside perimeter before visit is recorded.
              </span>
            </div>
          </div>
        </Card>

        {/* Kinematic Anomaly Sensitivity */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-rose-400" />
              <span>AI Kinematic Anomaly Scoring Thresholds</span>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-gray-300 mb-1">
                Max Kinematic Jump Distance (Meters in &lt; 2s)
              </label>
              <input
                type="number"
                value={jumpDistanceThreshold}
                onChange={(e) => setJumpDistanceThreshold(Number(e.target.value))}
                className="w-full bg-ops-base border border-ops-border rounded-lg px-3 py-2 text-white font-mono"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Triggers instant Mock-Location / Teleportation threat alert.
              </span>
            </div>

            <div>
              <label className="block font-semibold text-gray-300 mb-1">
                Urban Speed Limit Exceedance Threshold (km/h)
              </label>
              <input
                type="number"
                value={speedThreshold}
                onChange={(e) => setSpeedThreshold(Number(e.target.value))}
                className="w-full bg-ops-base border border-ops-border rounded-lg px-3 py-2 text-white font-mono"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Velocity limit above which high-risk speeding incidents are created.
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
