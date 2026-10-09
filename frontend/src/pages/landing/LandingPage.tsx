import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Radio,
  Shield,
  Zap,
  CheckCircle2,
  Navigation,
  Activity,
  Lock,
  ArrowRight,
  TrendingUp,
  Cpu,
  Layers,
  MapPin,
  ChevronRight,
  Sparkles,
  Smartphone,
  ExternalLink,
  Sliders,
  CheckSquare,
  Square,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const LandingPage: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [checkedItems, setCheckedItems] = useState<string[]>([
    'React layout and responsive sidebar',
    'Interactive map with 50 simulated agents',
    'Client locations and geofence rules',
    'Explainable GPS anomaly rules',
  ]);

  const stages = [
    {
      name: 'Phase 1 — Core Architecture',
      time: 'Foundation',
      items: [
        'React layout and responsive sidebar',
        'Role-based state handling (Manager, Supv, Driver)',
        'TypeScript schemas for agents, visits, and geofences',
        'Seeded 50-agent realistic metro data',
      ],
    },
    {
      name: 'Phase 2 — Live Telemetry Tracking',
      time: 'Real-time Stream',
      items: [
        'Interactive map with 50 simulated agents',
        'Kinematic drift tick loop & directional bearing markers',
        'Simulated WebSocket stream with latency indicators',
        'Active, idle, flagged, and stale state indicators',
      ],
    },
    {
      name: 'Phase 3 — Zero-Trust Verification',
      time: 'Auditing Ledger',
      items: [
        'Client locations and polygon/circle geofence rules',
        'Proof-of-visit check-in & photo watermark dossier',
        'Historical location storage & GPS deviation scoring',
        'Frame-accurate route playback scrubber',
      ],
    },
    {
      name: 'Phase 4 — Explainable AI Intelligence',
      time: 'Security Engine',
      items: [
        'Explainable GPS anomaly rules (Mock location, speed surge)',
        'Incident review and supervisor triage workflow',
        'Operational analytics and turnaround dwell time',
      ],
    },
    {
      name: 'Phase 5 — Driver Mobile PWA',
      time: 'Field Execution',
      items: [
        'Driver mobile PWA viewport with shift toggle',
        'Turn-by-turn stop manifest checklist',
        'One-tap arrival photo proof capture & signature',
        'Emergency SOS panic alert trigger',
      ],
    },
  ];

  const totalItems = stages.reduce((n, s) => n + s.items.length, 0);
  const progressPercent = Math.round((checkedItems.length / totalItems) * 100);

  const toggleCheck = (item: string) => {
    setCheckedItems((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const handleCopy = () => {
    const text = stages
      .map(
        (s) =>
          `${s.name}\n` +
          s.items
            .map((i) => (checkedItems.includes(i) ? '[x] ' : '[ ] ') + i)
            .join('\n')
      )
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-ops-base text-gray-100 selection:bg-brand-teal/30 selection:text-brand-teal">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-ops-base/80 border-b border-ops-border/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-teal to-emerald-500 flex items-center justify-center text-ops-base font-black shadow-lg shadow-teal-950/50">
              <Radio className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white font-sans">
                FLEETORA
              </span>
              <span className="ml-2 text-[10px] text-brand-teal font-mono px-1.5 py-0.5 bg-brand-teal/10 rounded border border-brand-teal/30">
                ENTERPRISE
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-gray-300">
            <a href="#features" className="hover:text-brand-teal transition-colors">
              01. Features
            </a>
            <a href="#verification" className="hover:text-brand-teal transition-colors">
              02. Proof-of-Visit
            </a>
            <a href="#checklist" className="hover:text-brand-teal transition-colors">
              03. Architecture Checklist
            </a>
            <a href="#pricing" className="hover:text-brand-teal transition-colors">
              04. Pricing
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <NavLink to="/driver">
              <Button variant="ghost" size="sm" leftIcon={<Smartphone className="w-4 h-4 text-indigo-400" />}>
                Driver PWA
              </Button>
            </NavLink>
            <NavLink to="/dashboard">
              <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Launch Live Ops Console
              </Button>
            </NavLink>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-brand-teal/15 via-emerald-500/10 to-transparent blur-3xl pointer-events-none rounded-full" />
        <div className="absolute top-10 right-10 w-96 h-96 bg-cyan-500/10 blur-3xl pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-teal/10 border border-brand-teal/30 text-brand-teal text-xs font-semibold uppercase tracking-wider mb-6 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" /> Next-Gen Fleet Intelligence & Micro-Geofence Verification
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.1]">
            Real-Time Fleet Telemetry. <br />
            <span className="bg-gradient-to-r from-brand-teal via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Zero-Trust Field Verification.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed font-light">
            Eliminate GPS spoofing, ghost check-ins, and routing bottlenecks. Fleetora combines sub-second
            kinematic tracking with explainable AI anomaly detection and cryptographically verified proof-of-visit audits.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <NavLink to="/dashboard">
              <Button size="lg" variant="primary" className="px-8 py-3 text-sm shadow-xl shadow-teal-950/60" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Try Interactive Live Ops Demo
              </Button>
            </NavLink>
            <NavLink to="/dashboard/replay">
              <Button size="lg" variant="secondary" className="px-7 py-3 text-sm" leftIcon={<Activity className="w-4 h-4 text-brand-teal" />}>
                Inspect Route Replay
              </Button>
            </NavLink>
          </div>

          {/* Interactive Live Demo Preview Box (from Section 2 of Spec) */}
          <div className="mt-12 relative max-w-5xl mx-auto rounded-2xl border border-ops-borderHighlight bg-ops-panel/90 shadow-2xl p-3 overflow-hidden text-left">
            <div className="flex items-center justify-between px-4 py-2 border-b border-ops-border bg-ops-base/80 rounded-t-xl text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-brand-teal" />
                <span className="font-bold text-white">Live Fleet Console</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                SIMULATED LIVE STREAM
              </span>
            </div>

            {/* Metric counters banner */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-ops-base/60 border-b border-ops-border text-center">
              <div className="p-3 bg-ops-panel rounded-xl border border-ops-border">
                <span className="text-[10px] text-gray-400 font-mono uppercase">Moving Vehicles</span>
                <div className="text-xl font-bold font-mono text-brand-teal mt-0.5">42</div>
              </div>
              <div className="p-3 bg-ops-panel rounded-xl border border-ops-border">
                <span className="text-[10px] text-gray-400 font-mono uppercase">Stationary / Idle</span>
                <div className="text-xl font-bold font-mono text-white mt-0.5">5</div>
              </div>
              <div className="p-3 bg-ops-panel rounded-xl border border-ops-border">
                <span className="text-[10px] text-gray-400 font-mono uppercase">Stale / Offline</span>
                <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">3</div>
              </div>
            </div>

            {/* Visual preview description strip */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-ops-card rounded-xl border border-ops-border">
                <div className="font-bold text-white text-xs">Live Agent Manifest</div>
                <p className="text-gray-400 mt-1 text-[11px]">
                  Search, filter, and inspect 50 active couriers, technicians, and trucks across the metro sector.
                </p>
              </div>
              <div className="p-3 bg-ops-card rounded-xl border border-ops-border">
                <div className="font-bold text-white text-xs">Kinematic Sensor Feed</div>
                <p className="text-gray-400 mt-1 text-[11px]">
                  Instantaneous speed, compass bearing, battery percentage, and explainable anti-spoofing flags.
                </p>
              </div>
            </div>

            <div className="px-4 py-2.5 bg-ops-base/80 border-t border-ops-border flex items-center justify-between text-[11px] text-gray-400 font-mono">
              <span>Last server update: 2 seconds ago</span>
              <NavLink to="/dashboard/live" className="text-brand-teal hover:underline flex items-center gap-1 font-semibold">
                Open Full Operations Screen &rarr;
              </NavLink>
            </div>
          </div>
        </div>
      </section>

      {/* 5-Section Detailed Feature Breakdown (from ChatGPT spec) */}
      <section id="features" className="py-20 border-t border-ops-border bg-ops-panel/40">
        <div className="max-w-7xl mx-auto px-6 space-y-16">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest font-mono">
              Engineered Capabilities
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
              Everything Your Fleet Operations Need in One Platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-ops-panel border border-ops-border hover:border-brand-teal/40 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-brand-teal/10 border border-brand-teal/30 flex items-center justify-center text-brand-teal">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">01. Operations at a Glance</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Live metric cards, shift turnaround times, dispatch bottlenecks, and real-time activity feeds.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-ops-panel border border-ops-border hover:border-brand-teal/40 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Navigation className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">02. Live GPS & Telemetry Tracking</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Dedicated split-view layout rendering 50+ agents with directional bearing icons, speed tags, and telemetry popovers.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-ops-panel border border-ops-border hover:border-brand-teal/40 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">03. Micro-Geofencing & Site Audits</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Polygonal and radial client site perimeters with configurable millimeter auto-check-in tolerances.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-ops-panel border border-ops-border hover:border-brand-teal/40 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">04. Frame-Accurate Route Playback</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Historical timeline scrubber slider with instantaneous speedometer gauges and route deviation flags.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-ops-panel border border-ops-border hover:border-rose-500/40 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">05. Explainable AI Kinematic Anomalies</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Multi-signal fraud detection (kinematic teleportation, mock location provider, prolonged unassigned idle).
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-ops-panel border border-ops-border hover:border-indigo-500/40 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">06. Field Agent Mobile PWA</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Role-based driver experience with sequential route checklist, photo proof capture, and SOS emergency button.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Implementation Checklist (from Section 9 of Spec) */}
      <section id="checklist" className="py-20 border-t border-ops-border">
        <div className="max-w-5xl mx-auto px-6 space-y-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest font-mono">
              Portfolio Roadmap
            </h2>
            <p className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              Interactive Architectural Checklist
            </p>
          </div>

          <div className="bg-ops-panel border border-ops-border rounded-2xl p-6 space-y-6 shadow-xl">
            {/* Progress Header */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white font-mono">
                System Implementation Progress ({checkedItems.length} / {totalItems} completed)
              </span>
              <span className="font-mono text-brand-teal font-bold">{progressPercent}%</span>
            </div>

            <div className="w-full bg-ops-base h-2.5 rounded-full overflow-hidden border border-ops-border">
              <div
                className="h-full bg-gradient-to-r from-brand-teal to-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Stages */}
            <div className="space-y-4">
              {stages.map((stage) => (
                <div key={stage.name} className="p-4 bg-ops-card rounded-xl border border-ops-border space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white">{stage.name}</span>
                      <span className="text-[10px] text-gray-400 font-mono ml-2">({stage.time})</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-ops-base text-gray-300">
                      {stage.items.filter((i) => checkedItems.includes(i)).length}/{stage.items.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {stage.items.map((item) => {
                      const isChecked = checkedItems.includes(item);
                      return (
                        <div
                          key={item}
                          onClick={() => toggleCheck(item)}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-brand-teal/10 text-white'
                              : 'text-gray-400 hover:text-gray-200 hover:bg-ops-base/60'
                          }`}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-brand-teal shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-500 shrink-0" />
                          )}
                          <span className={isChecked ? 'line-through text-gray-300' : ''}>{item}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-ops-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCheckedItems([])}
              >
                Reset Checklist
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                onClick={handleCopy}
              >
                {copied ? 'Copied to Clipboard!' : 'Copy Roadmap'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 border-t border-ops-border bg-ops-panel/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-xs font-bold text-brand-teal uppercase tracking-widest font-mono">
              Transparent Pricing
            </h2>
            <p className="text-3xl font-extrabold text-white mt-1">
              Scalable Plans for Field Teams & Enterprise Operations
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="p-8 rounded-2xl bg-ops-panel border border-ops-border flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Starter Fleet</h3>
                <p className="text-xs text-gray-400 mt-1">Up to 15 field agents</p>
                <div className="mt-6 flex items-baseline gap-1 font-mono">
                  <span className="text-3xl font-extrabold text-white">$249</span>
                  <span className="text-xs text-gray-400">/ mo</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-xs text-gray-300">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-brand-teal" /> 5-second GPS updates</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-brand-teal" /> Radial geofencing</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-brand-teal" /> Standard proof of visit</li>
                </ul>
              </div>
              <NavLink to="/dashboard" className="mt-8">
                <Button variant="secondary" className="w-full">Start Free Trial</Button>
              </NavLink>
            </div>

            <div className="p-8 rounded-2xl bg-ops-card border-2 border-brand-teal relative flex flex-col justify-between shadow-2xl shadow-teal-950/40">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-teal text-ops-base px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                Most Popular
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Operations Pro</h3>
                <p className="text-xs text-gray-400 mt-1">Up to 100 field agents + AI Anomaly Engine</p>
                <div className="mt-6 flex items-baseline gap-1 font-mono">
                  <span className="text-3xl font-extrabold text-white">$699</span>
                  <span className="text-xs text-gray-400">/ mo</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-xs text-gray-300">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-brand-teal" /> Sub-second live WebSocket telemetry</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-brand-teal" /> Polygon custom geofences</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-brand-teal" /> AI Kinematic GPS Spoof Detection</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-brand-teal" /> Route historical playback scrub</li>
                </ul>
              </div>
              <NavLink to="/dashboard" className="mt-8">
                <Button variant="primary" className="w-full font-bold">Deploy Operations Pro</Button>
              </NavLink>
            </div>

            <div className="p-8 rounded-2xl bg-ops-panel border border-ops-border flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Global Enterprise</h3>
                <p className="text-xs text-gray-400 mt-1">Unlimited agents, custom SLAs & on-premise</p>
                <div className="mt-6 flex items-baseline gap-1 font-mono">
                  <span className="text-3xl font-extrabold text-white">Custom</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-xs text-gray-300">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-brand-teal" /> Dedicated telemetry clusters</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-brand-teal" /> Custom ERP / SAP dispatch hooks</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-brand-teal" /> 99.99% uptime SLA guarantee</li>
                </ul>
              </div>
              <NavLink to="/dashboard" className="mt-8">
                <Button variant="secondary" className="w-full">Contact Enterprise Team</Button>
              </NavLink>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-ops-border bg-ops-base">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-3">
            <Radio className="w-4 h-4 text-brand-teal" />
            <span>© 2026 Fleetora Technologies Inc. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 font-mono text-[11px]">
            <NavLink to="/dashboard" className="hover:text-brand-teal">Live Ops Center</NavLink>
            <NavLink to="/driver" className="hover:text-brand-teal">Driver PWA</NavLink>
            <a href="#features" className="hover:text-brand-teal">Documentation</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
