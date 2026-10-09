import React, { useState } from 'react';
import { DriverShell } from '../../components/layout/DriverShell';
import { mockRouteReplay } from '../../api/mockFleetData';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import {
  Navigation,
  CheckCircle2,
  Camera,
  MapPin,
  Clock,
  ShieldCheck,
  AlertOctagon,
  Sparkles,
  Signature,
  FileCheck,
  Wifi,
  Battery,
  Radio,
  Calendar,
  Layers,
  History,
  Info,
  Check,
} from 'lucide-react';

export const DriverPortal: React.FC = () => {
  const [activeDriverTab, setActiveDriverTab] = useState<'my_day' | 'my_route' | 'checkin' | 'history' | 'status'>('my_day');
  const [isOnShift, setIsOnShift] = useState(true);
  const [activeStopIndex, setActiveStopIndex] = useState(0);
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [checkinSuccess, setCheckinSuccess] = useState(false);
  const [photoCaptured, setPhotoCaptured] = useState(false);
  const [driverNotes, setDriverNotes] = useState('');
  const [completedStops, setCompletedStops] = useState<number[]>([]);

  const stops = mockRouteReplay.stops;
  const currentStop = stops[activeStopIndex] || stops[0];

  const handleCapturePhoto = () => {
    setPhotoCaptured(true);
  };

  const handleCompleteCheckin = () => {
    setCheckinSuccess(true);
    setCompletedStops((prev) => [...prev, activeStopIndex]);
    setTimeout(() => {
      setCheckinSuccess(false);
      setIsCheckinModalOpen(false);
      setPhotoCaptured(false);
      setDriverNotes('');
      if (activeStopIndex < stops.length - 1) {
        setActiveStopIndex((prev) => prev + 1);
      }
    }, 1200);
  };

  return (
    <DriverShell>
      <div className="flex-1 flex flex-col p-4 space-y-4 text-gray-100 pb-20">
        {/* Driver Profile & Shift Status Header */}
        <div className="p-3.5 bg-ops-panel rounded-2xl border border-ops-border flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full border-2 border-brand-teal overflow-hidden bg-ops-card shrink-0">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                alt="Driver Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white leading-tight">Marcus Vance</h2>
              <p className="text-[10px] text-gray-400 font-mono">Van FT-101 • Courier Unit 4</p>
            </div>
          </div>

          <button
            onClick={() => setIsOnShift(!isOnShift)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border font-mono ${
              isOnShift
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                : 'bg-ops-card text-gray-400 border-ops-border'
            }`}
          >
            {isOnShift ? '● ON SHIFT' : '○ OFF DUTY'}
          </button>
        </div>

        {/* Tab Content */}
        {activeDriverTab === 'my_day' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Shift Progress Summary Card */}
            <div className="p-4 bg-gradient-to-br from-ops-panel via-ops-panel to-teal-950/30 rounded-2xl border border-brand-teal/40 space-y-3 shadow-xl">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-brand-teal font-bold flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 animate-pulse" />
                  NEXT TARGET: STOP #{activeStopIndex + 1}
                </span>
                <span className="text-emerald-400 font-bold">
                  {completedStops.length} / {stops.length} DONE
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-white">{currentStop.siteName}</h3>
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                  <span>{currentStop.address}</span>
                </p>
              </div>

              <div className="pt-2 border-t border-ops-border/60 flex items-center justify-between text-xs font-mono text-gray-400">
                <span>Sched: {currentStop.scheduledArrival}</span>
                <span className="text-brand-teal">Dwell: ~{currentStop.estDurationMinutes}m</span>
              </div>

              <Button
                variant="primary"
                size="md"
                className="w-full font-bold shadow-lg shadow-teal-950/60"
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                onClick={() => setIsCheckinModalOpen(true)}
              >
                Arrived & Verify Check-In
              </Button>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-ops-panel border border-ops-border rounded-xl">
                <span className="text-gray-400 text-[10px]">Today's Route Odometer</span>
                <div className="text-base font-bold text-white mt-0.5">42.6 km</div>
              </div>
              <div className="p-3 bg-ops-panel border border-ops-border rounded-xl">
                <span className="text-gray-400 text-[10px]">Geofence Accuracy</span>
                <div className="text-base font-bold text-emerald-400 mt-0.5">±3.2m GPS</div>
              </div>
            </div>
          </div>
        )}

        {activeDriverTab === 'my_route' && (
          <div className="space-y-3 animate-in fade-in">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">
              Today's Sequential Itinerary
            </div>

            <div className="space-y-2.5">
              {stops.map((stop, idx) => {
                const isCompleted = completedStops.includes(idx);
                const isCurrent = idx === activeStopIndex && !isCompleted;

                return (
                  <div
                    key={stop.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                      isCurrent
                        ? 'bg-ops-card border-brand-teal ring-1 ring-brand-teal/40'
                        : isCompleted
                        ? 'bg-ops-base border-ops-border opacity-60'
                        : 'bg-ops-panel border-ops-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                          isCompleted
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : isCurrent
                            ? 'bg-brand-teal text-ops-base'
                            : 'bg-ops-card text-gray-400 border border-ops-border'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white leading-tight">{stop.siteName}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                          Arrival: {stop.scheduledArrival} • {stop.address}
                        </div>
                      </div>
                    </div>

                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <Clock className="w-5 h-5 text-gray-500 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeDriverTab === 'history' && (
          <div className="space-y-3 animate-in fade-in">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">
              Completed Attestation History
            </div>

            <div className="p-3.5 bg-ops-panel rounded-xl border border-ops-border space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-emerald-400 font-bold">
                <span>Salesforce Tower Bay 4</span>
                <span>VERIFIED</span>
              </div>
              <div className="text-gray-400 text-[10px]">
                Check-in: 08:32:14 UTC • Dwell: 26 mins • GPS ±3.2m
              </div>
              <div className="text-gray-300 text-[11px] bg-ops-base p-2 rounded border border-ops-border">
                "Delivered 14 server enclosures. Signed by Shift Supervisor Reynolds."
              </div>
            </div>
          </div>
        )}

        {activeDriverTab === 'status' && (
          <div className="space-y-3 animate-in fade-in">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">
              Device Diagnostics & Telemetry Uplink
            </div>

            <div className="p-4 bg-ops-panel border border-ops-border rounded-xl space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-ops-border">
                <span className="text-gray-400">GPS Permission:</span>
                <span className="text-emerald-400 font-bold">GRANTED (High Precision)</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-ops-border">
                <span className="text-gray-400">Cellular Signal:</span>
                <span className="text-cyan-400 font-bold">-62 dBm (5G Active)</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-ops-border">
                <span className="text-gray-400">Battery Health:</span>
                <span className="text-amber-400 font-bold">88% (Charging)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Offline Queue:</span>
                <span className="text-brand-teal font-bold">0 Pending Packets</span>
              </div>
            </div>

            <button
              onClick={() => alert('Emergency SOS alert dispatched to Central Operations Control!')}
              className="w-full py-3 bg-rose-950/50 hover:bg-rose-950/80 border border-rose-500/60 rounded-xl text-rose-300 font-mono text-xs font-bold flex items-center justify-center gap-2 transition-colors mt-4"
            >
              <AlertOctagon className="w-4 h-4 text-rose-400" />
              DISPATCH EMERGENCY SOS
            </button>
          </div>
        )}
      </div>

      {/* Bottom PWA Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-ops-panel/95 backdrop-blur-xl border-t border-ops-border p-2 grid grid-cols-4 gap-1 text-[10px] font-mono z-40">
        <button
          onClick={() => setActiveDriverTab('my_day')}
          className={`flex flex-col items-center gap-1 py-1 rounded-lg transition-colors ${
            activeDriverTab === 'my_day' ? 'text-brand-teal font-bold' : 'text-gray-400'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>My Day</span>
        </button>
        <button
          onClick={() => setActiveDriverTab('my_route')}
          className={`flex flex-col items-center gap-1 py-1 rounded-lg transition-colors ${
            activeDriverTab === 'my_route' ? 'text-brand-teal font-bold' : 'text-gray-400'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>Route</span>
        </button>
        <button
          onClick={() => setActiveDriverTab('history')}
          className={`flex flex-col items-center gap-1 py-1 rounded-lg transition-colors ${
            activeDriverTab === 'history' ? 'text-brand-teal font-bold' : 'text-gray-400'
          }`}
        >
          <History className="w-4 h-4" />
          <span>History</span>
        </button>
        <button
          onClick={() => setActiveDriverTab('status')}
          className={`flex flex-col items-center gap-1 py-1 rounded-lg transition-colors ${
            activeDriverTab === 'status' ? 'text-brand-teal font-bold' : 'text-gray-400'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Status</span>
        </button>
      </nav>

      {/* Driver Check-in Evidence Modal */}
      <Modal
        isOpen={isCheckinModalOpen}
        onClose={() => setIsCheckinModalOpen(false)}
        title="Field Verification Check-In"
        subtitle={currentStop.siteName}
        size="sm"
      >
        <div className="space-y-4 text-xs">
          {checkinSuccess ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-white">Proof of Visit Attested!</h3>
              <p className="text-xs text-gray-400 font-mono">
                Cryptographic hash generated. Syncing with Ops Control...
              </p>
            </div>
          ) : (
            <>
              {/* Geofence GPS Validation confirmation */}
              <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-xl text-emerald-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Geofence Boundary Match: 100% (Within 4.2m)</span>
              </div>

              {/* Photo Evidence Capture Simulation */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1.5">
                  Capture Site Delivery Photo Proof
                </label>
                {photoCaptured ? (
                  <div className="relative rounded-xl overflow-hidden border border-brand-teal">
                    <img
                      src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80"
                      alt="Captured delivery proof"
                      className="w-full h-40 object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-emerald-500 text-ops-base px-2 py-0.5 rounded text-[10px] font-bold">
                      PHOTO ATTACHED
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleCapturePhoto}
                    className="w-full h-32 border-2 border-dashed border-ops-border rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-white hover:border-brand-teal bg-ops-base/40 transition-colors"
                  >
                    <Camera className="w-6 h-6 text-brand-teal" />
                    <span className="text-xs font-semibold">Tap to Take Proof Photo</span>
                  </button>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Delivery Notes / Recipient Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Received by Bay 4 Supervisor"
                  value={driverNotes}
                  onChange={(e) => setDriverNotes(e.target.value)}
                  className="w-full bg-ops-card border border-ops-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-teal"
                />
              </div>

              <Button
                variant="primary"
                size="md"
                className="w-full font-bold mt-2"
                disabled={!photoCaptured}
                onClick={handleCompleteCheckin}
              >
                Submit Cryptographic Check-in
              </Button>
            </>
          )}
        </div>
      </Modal>
    </DriverShell>
  );
};
