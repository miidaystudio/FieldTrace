import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Radio,
  Shield,
  Zap,
  CheckCircle2,
  Navigation,
  Activity,
  ArrowRight,
  TrendingUp,
  MapPin,
  Sparkles,
  Smartphone,
  CheckSquare,
  Square,
  Copy,
  Check,
  MousePointer,
  RotateCcw,
  Users,
  Compass,
  Clock,
  Award,
  Star,
  ExternalLink,
  ChevronRight,
  Building2,
  Layers,
  Cpu,
  Calendar,
  X,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const LandingPage: React.FC = () => {
  const [heroTab, setHeroTab] = useState<'timeline' | 'map'>('timeline');
  const [isModalOpen, setIsModalOpen] = useState(false);
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
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 selection:bg-[#E85D38]/20 selection:text-[#E85D38]">
      {/* Floating Island Navigation Header (SaaSync Style) */}
      <div className="pt-4 sm:pt-6 px-4 sticky top-0 z-50">
        <header className="max-w-5xl mx-auto rounded-full bg-white/90 backdrop-blur-xl border border-stone-200/90 shadow-[0_10px_30px_rgba(28,25,23,0.04)] px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#E85D38] to-[#FF8C66] flex items-center justify-center text-white font-black shadow-md shadow-orange-500/25">
              <Radio className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-stone-900 font-sans">
                FLEETORA
              </span>
              <span className="ml-1.5 text-[9px] text-[#E85D38] font-mono px-2 py-0.5 bg-[#FFF2ED] rounded-full border border-[#FCD4C7] font-bold">
                PRO
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-stone-600">
            <a href="#benefits" className="hover:text-[#E85D38] transition-colors">Features</a>
            <a href="#pricing" className="hover:text-[#E85D38] transition-colors">Pricing</a>
            <a href="#process" className="hover:text-[#E85D38] transition-colors">About</a>
            <a href="#results" className="hover:text-[#E85D38] transition-colors">Case Study</a>
            <a href="#checklist" className="hover:text-[#E85D38] transition-colors">Roadmap</a>
          </nav>

          <div className="flex items-center gap-2.5">
            <NavLink to="/driver">
              <Button variant="secondary" size="sm" className="!rounded-full text-xs font-semibold shadow-xs" leftIcon={<Smartphone className="w-3.5 h-3.5 text-[#E85D38]" />}>
                Driver App
              </Button>
            </NavLink>
            <NavLink to="/dashboard">
              <Button variant="primary" size="sm" className="!rounded-full text-xs font-bold shadow-md shadow-orange-500/20" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                Launch Console
              </Button>
            </NavLink>
          </div>
        </header>
      </div>

      {/* Hero Section (SaaSync Style: "Power Up Your Workflow" with 4 3D Floating Squircle Icons) */}
      <section className="relative pt-12 pb-24 overflow-hidden">
        {/* Soft Ambient Radial Glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[950px] h-[550px] bg-gradient-to-tr from-[#E85D38]/8 via-[#FF8C66]/6 to-transparent blur-3xl pointer-events-none rounded-full" />
        <div className="absolute top-10 right-20 w-80 h-80 bg-amber-500/5 blur-3xl pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          {/* Centered Social Proof Pill ("200+ Businesses Scaled" Style) */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white border border-stone-200/90 shadow-[0_2px_12px_rgba(28,25,23,0.04)] text-stone-700 text-xs font-semibold mb-8 hover:border-stone-300 transition-colors">
            <div className="flex items-center -space-x-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-400 to-orange-400 border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-xs">
                JD
              </div>
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-xs">
                AK
              </div>
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-xs">
                VS
              </div>
            </div>
            <span className="font-semibold text-stone-700">200+ Businesses Scaled</span>
          </div>

          {/* Centered Headline with 4 Symmetrical Floating 3D Squircles */}
          <div className="relative max-w-4xl mx-auto pb-4">
            {/* FLOATING SQUIRCLE 1 (Top-Left: Royal Blue with 3-blade organic petal icon) */}
            <div
              style={{ '--rot': '-8deg' } as React.CSSProperties}
              className="hidden lg:flex absolute -left-12 sm:-left-24 top-2 w-20 h-20 sm:w-22 sm:h-22 rounded-[26px] bg-gradient-to-br from-[#4F8DFF] via-[#2F74FF] to-[#1E56D0] p-1 shadow-[0_24px_50px_rgba(37,99,235,0.45),0_10px_20px_rgba(37,99,235,0.25)] items-center justify-center animate-float-slow select-none cursor-default hover:scale-105 transition-transform"
            >
              <div className="w-full h-full rounded-[22px] bg-gradient-to-b from-white/30 via-transparent to-black/20 flex items-center justify-center relative overflow-hidden shadow-inner">
                <div className="absolute top-1 left-2 right-2 h-3 bg-white/30 rounded-full blur-[2px]" />
                <svg className="w-10 h-10 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]" viewBox="0 0 32 32" fill="currentColor">
                  <path d="M16 6a5 5 0 0 1 5 5c0 2.1-1.3 3.9-3.2 4.6l-.8.3.6.6c1.7 1.7 1.7 4.5 0 6.2a4.4 4.4 0 0 1-6.2 0c-1.7-1.7-1.7-4.5 0-6.2l.6-.6-.8-.3C9.3 14.9 8 13.1 8 11a5 5 0 0 1 8-5z" />
                </svg>
              </div>
            </div>

            {/* FLOATING SQUIRCLE 2 (Bottom-Left: Emerald/Sage Green with organic sprout icon) */}
            <div
              style={{ '--rot': '6deg' } as React.CSSProperties}
              className="hidden lg:flex absolute -left-12 sm:-left-24 bottom-4 w-20 h-20 sm:w-22 sm:h-22 rounded-[26px] bg-gradient-to-br from-[#2DD4BF] via-[#10B981] to-[#047857] p-1 shadow-[0_24px_50px_rgba(16,185,129,0.42),0_10px_20px_rgba(16,185,129,0.25)] items-center justify-center animate-float-reverse select-none cursor-default hover:scale-105 transition-transform"
            >
              <div className="w-full h-full rounded-[22px] bg-gradient-to-b from-white/30 via-transparent to-black/20 flex items-center justify-center relative overflow-hidden shadow-inner">
                <div className="absolute top-1 left-2 right-2 h-3 bg-white/30 rounded-full blur-[2px]" />
                <svg className="w-10 h-10 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]" viewBox="0 0 32 32" fill="none">
                  <path d="M16 18C12 18 9 14 9 9C14 9 16 12 16 18Z" fill="currentColor" />
                  <path d="M16 18C20 18 23 14 23 9C18 9 16 12 16 18Z" fill="currentColor" />
                  <circle cx="16" cy="6.5" r="2.5" fill="currentColor" />
                  <path d="M16 18V26" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* FLOATING SQUIRCLE 3 (Top-Right: Porcelain White with modern black asterisk icon) */}
            <div
              style={{ '--rot': '8deg' } as React.CSSProperties}
              className="hidden lg:flex absolute -right-12 sm:-right-24 top-2 w-20 h-20 sm:w-22 sm:h-22 rounded-[26px] bg-gradient-to-b from-white via-stone-50 to-stone-100 border border-stone-200/90 p-1 shadow-[0_24px_50px_rgba(28,25,23,0.14),0_10px_20px_rgba(28,25,23,0.08)] items-center justify-center animate-float-reverse select-none cursor-default hover:scale-105 transition-transform"
            >
              <div className="w-full h-full rounded-[22px] bg-gradient-to-b from-white to-stone-100 flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-1 left-2 right-2 h-3 bg-white/60 rounded-full blur-[1px]" />
                <svg className="w-10 h-10 text-stone-900 drop-shadow-[0_1px_2px_rgba(0,0,0,0.12)]" viewBox="0 0 32 32" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="16" y1="5" x2="16" y2="27" />
                  <line x1="6.5" y1="10.5" x2="25.5" y2="21.5" />
                  <line x1="6.5" y1="21.5" x2="25.5" y2="10.5" />
                </svg>
              </div>
            </div>

            {/* FLOATING SQUIRCLE 4 (Bottom-Right: Sunset Peach-Coral with flower/gear icon) */}
            <div
              style={{ '--rot': '-6deg' } as React.CSSProperties}
              className="hidden lg:flex absolute -right-12 sm:-right-24 bottom-4 w-20 h-20 sm:w-22 sm:h-22 rounded-[26px] bg-gradient-to-br from-[#FF7A50] via-[#E85D38] to-[#FF4B72] p-1 shadow-[0_24px_50px_rgba(232,93,56,0.48),0_10px_20px_rgba(232,93,56,0.25)] items-center justify-center animate-float-slow select-none cursor-default hover:scale-105 transition-transform"
            >
              <div className="w-full h-full rounded-[22px] bg-gradient-to-b from-white/30 via-transparent to-black/20 flex items-center justify-center relative overflow-hidden shadow-inner">
                <div className="absolute top-1 left-2 right-2 h-3 bg-white/30 rounded-full blur-[2px]" />
                <svg className="w-11 h-11 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]" viewBox="0 0 32 32" fill="currentColor">
                  <path d="M16 4a3 3 0 0 1 3 3v.3a8.5 8.5 0 0 1 2.9 1.2l.3-.3a3 3 0 1 1 4.2 4.2l-.3.3c.6.9 1 1.9 1.2 2.9h.3a3 3 0 1 1 0 6h-.3a8.5 8.5 0 0 1-1.2 2.9l.3.3a3 3 0 1 1-4.2 4.2l-.3-.3a8.5 8.5 0 0 1-2.9 1.2v.3a3 3 0 1 1-6 0v-.3a8.5 8.5 0 0 1-2.9-1.2l-.3.3a3 3 0 1 1-4.2-4.2l.3-.3a8.5 8.5 0 0 1-.9-2.3H7a3 3 0 1 1 0-6h.3c.2-1 .6-2 1.2-2.9l-.3-.3A3 3 0 1 1 12.4 8l.3.3A8.5 8.5 0 0 1 15.6 7.1V7a3 3 0 0 1 3-3zm0 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z" />
                </svg>
              </div>
            </div>

            {/* Headline matching SaaSync */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-stone-900 leading-[1.12]">
              Power Up Your <br />
              Workflow
            </h1>

            <p className="mt-6 text-base sm:text-lg text-stone-600 max-w-2xl mx-auto leading-relaxed font-normal">
              Discover a powerful tool designed to streamline your tasks, enhance collaboration, and drive efficiency in real-time.
            </p>

            {/* Prominent Black Pill CTA Button ("Learn More >" Style) */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <NavLink to="/dashboard">
                <Button
                  size="lg"
                  className="!bg-stone-900 hover:!bg-black !text-white !rounded-full px-9 py-3.5 text-sm font-bold shadow-[0_16px_36px_rgba(28,25,23,0.25)] transition-all hover:scale-105"
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  Learn More
                </Button>
              </NavLink>
              <NavLink to="/dashboard/live">
                <Button
                  size="lg"
                  variant="secondary"
                  className="!rounded-full px-7 py-3.5 text-sm font-semibold shadow-xs transition-all hover:bg-stone-100"
                  leftIcon={<Navigation className="w-4 h-4 text-[#E85D38]" />}
                >
                  Live Operations
                </Button>
              </NavLink>
            </div>
            <p className="text-[11px] text-stone-400 mt-3 font-medium">
              Instant setup • No hardware required • 50 live simulated agents
            </p>
          </div>

          {/* MASSIVE HERO PRODUCT MOCKUP WINDOW (The centerpiece of Assemble hero!) */}
          <div className="mt-12 relative max-w-6xl mx-auto rounded-3xl border border-stone-200/90 bg-white shadow-mockup-window overflow-hidden text-left">
            {/* macOS Style Window Header Bar */}
            <div className="px-6 py-3.5 border-b border-stone-100 bg-[#FAF8F5] flex flex-wrap items-center justify-between gap-4">
              {/* Window Dots & Title */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-black/10" />
                  <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-black/10" />
                  <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-black/10" />
                </div>
                <div className="h-4 w-[1px] bg-stone-300 mx-1 hidden sm:block" />
                <span className="text-xs font-bold text-stone-700 hidden sm:inline-block font-mono">
                  Fleetora Dispatch Operations • Bengaluru Metro Sector
                </span>
              </div>

              {/* Center View Switcher Tabs (Dispatch Timeline vs Live Operations Map) */}
              <div className="flex items-center p-1 rounded-full bg-stone-200/70 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setHeroTab('timeline')}
                  className={`px-3.5 py-1.5 rounded-full flex items-center gap-1.5 font-bold transition-all ${
                    heroTab === 'timeline'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-[#E85D38]" />
                  <span>Dispatch Timeline</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHeroTab('map')}
                  className={`px-3.5 py-1.5 rounded-full flex items-center gap-1.5 font-bold transition-all ${
                    heroTab === 'map'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5 text-[#E85D38]" />
                  <span>Live Operations Map</span>
                </button>
              </div>

              {/* Right View Larger Button (Direct Assemble Feature!) */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold hidden md:inline-block">
                  🟢 18ms latency • 50 Active
                </span>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-full bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <span>View larger</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Mockup Window Interior */}
            {heroTab === 'timeline' ? (
              /* TAB 1: DISPATCH TIMELINE CALENDAR (Direct Assemble Gantt View) */
              <div className="relative overflow-x-auto min-h-[460px] bg-white p-4 sm:p-6 select-none">
                {/* Top Calendar Timeline Controls Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-stone-100">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-extrabold text-stone-900 uppercase tracking-wider font-mono flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#E85D38]" />
                      <span>Shift Manifest • Today, 28 Oct</span>
                    </span>
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                      50 Active Telemetry Links
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono text-stone-500">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#E85D38]" /> Moving (42)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Geofence Dwell (5)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500" /> Scheduled (3)</span>
                  </div>
                </div>

                {/* Calendar / Gantt Schedule Grid Container */}
                <div className="min-w-[840px] mt-4 relative">
                  {/* Time Scale Columns Header */}
                  <div className="grid grid-cols-12 border-b border-stone-200/80 pb-2.5 text-[11px] font-mono text-stone-400 font-semibold">
                    <div className="col-span-3 text-stone-600 font-bold uppercase tracking-wider text-[10px]">
                      Resource & Driver
                    </div>
                    <div className="col-span-1 text-center">08:00</div>
                    <div className="col-span-1 text-center">09:00</div>
                    <div className="col-span-1 text-center">10:00</div>
                    <div className="col-span-1 text-center text-[#E85D38] font-bold">11:00</div>
                    <div className="col-span-1 text-center">12:00</div>
                    <div className="col-span-1 text-center">13:00</div>
                    <div className="col-span-1 text-center">14:00</div>
                    <div className="col-span-1 text-center">15:00</div>
                    <div className="col-span-1 text-center">16:00</div>
                  </div>

                  {/* Vertical Red/Coral Scrubber Line at 11:24 AM */}
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none z-20 flex flex-col items-center"
                    style={{ left: '55.5%' }}
                  >
                    <div className="px-2 py-0.5 rounded-full bg-[#E85D38] text-white text-[9px] font-mono font-bold shadow-sm whitespace-nowrap -mt-1">
                      11:24 AM • NOW
                    </div>
                    <div className="w-[2px] flex-1 bg-[#E85D38]/80 shadow-[0_0_8px_rgba(232,93,56,0.6)]" />
                  </div>

                  {/* Grid Timeline Tracks */}
                  <div className="divide-y divide-stone-100 relative">
                    {/* Track 1: Van #12 • Vikram S. */}
                    <div className="grid grid-cols-12 items-center py-3 hover:bg-stone-50/70 transition-colors group">
                      <div className="col-span-3 pr-3 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#E85D38] to-[#FF8C66] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                          VS
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-900 truncate">Van #12 • Vikram S.</p>
                          <p className="text-[10px] text-stone-400 font-mono truncate">Indiranagar Sector A</p>
                        </div>
                      </div>
                      <div className="col-span-9 relative h-12 flex items-center">
                        <div className="absolute inset-0 grid grid-cols-9 divide-x divide-stone-100 pointer-events-none" />
                        <div
                          className="absolute h-10 rounded-2xl bg-gradient-to-r from-orange-50 via-[#FFF2ED] to-orange-100/70 border border-[#FCD4C7] shadow-sm flex items-center justify-between px-3 text-xs text-stone-800 transition-all hover:shadow-md cursor-pointer group-hover:border-[#E85D38]/50"
                          style={{ left: '5%', width: '50%' }}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-2 h-2 rounded-full bg-[#E85D38] animate-pulse shrink-0" />
                            <span className="font-bold text-[11px] truncate">Indiranagar Delivery Run (5/8 Done)</span>
                          </div>
                          <span className="text-[9px] font-mono font-bold text-[#E85D38] bg-white px-2 py-0.5 rounded-full border border-orange-200 shrink-0 hidden sm:inline-block">
                            38.4 km/h
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Track 2: Bike #04 • Priya S. */}
                    <div className="grid grid-cols-12 items-center py-3 hover:bg-stone-50/70 transition-colors group">
                      <div className="col-span-3 pr-3 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                          PS
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-900 truncate">Bike #04 • Priya S.</p>
                          <p className="text-[10px] text-stone-400 font-mono truncate">Express Medical Dispatch</p>
                        </div>
                      </div>
                      <div className="col-span-9 relative h-12 flex items-center">
                        <div className="absolute inset-0 grid grid-cols-9 divide-x divide-stone-100 pointer-events-none" />
                        <div
                          className="absolute h-10 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/70 border border-emerald-200/90 shadow-sm flex items-center justify-between px-3 text-xs text-stone-800 transition-all hover:shadow-md cursor-pointer group-hover:border-emerald-400"
                          style={{ left: '16%', width: '38%' }}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="font-bold text-[11px] truncate">Apollo Pharmacy Dwell (14m)</span>
                          </div>
                          <span className="text-[9px] font-mono font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200 shrink-0 hidden sm:inline-block">
                            Geofence Verified
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Track 3: Truck #08 • Anand P. */}
                    <div className="grid grid-cols-12 items-center py-3 hover:bg-stone-50/70 transition-colors group">
                      <div className="col-span-3 pr-3 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                          AP
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-900 truncate">Truck #08 • Anand P.</p>
                          <p className="text-[10px] text-stone-400 font-mono truncate">North Highway Freight</p>
                        </div>
                      </div>
                      <div className="col-span-9 relative h-12 flex items-center">
                        <div className="absolute inset-0 grid grid-cols-9 divide-x divide-stone-100 pointer-events-none" />
                        <div
                          className="absolute h-10 rounded-2xl bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 border border-blue-200/90 shadow-sm flex items-center justify-between px-3 text-xs text-stone-800 transition-all hover:shadow-md cursor-pointer group-hover:border-blue-400"
                          style={{ left: '22%', width: '62%' }}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Navigation className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="font-bold text-[11px] truncate">Hebbal Logistics → Hosur Linehaul</span>
                          </div>
                          <span className="text-[9px] font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200 shrink-0 hidden sm:inline-block">
                            58 km/h • Green
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Track 4: Van #15 • Rahul K. */}
                    <div className="grid grid-cols-12 items-center py-3 hover:bg-stone-50/70 transition-colors group">
                      <div className="col-span-3 pr-3 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                          RK
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-900 truncate">Van #15 • Rahul K.</p>
                          <p className="text-[10px] text-stone-400 font-mono truncate">Cold Chain Biologicals</p>
                        </div>
                      </div>
                      <div className="col-span-9 relative h-12 flex items-center">
                        <div className="absolute inset-0 grid grid-cols-9 divide-x divide-stone-100 pointer-events-none" />
                        <div
                          className="absolute h-10 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/60 border border-amber-200/90 shadow-sm flex items-center justify-between px-3 text-xs text-stone-800 transition-all hover:shadow-md cursor-pointer group-hover:border-amber-400"
                          style={{ left: '42%', width: '48%' }}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="font-bold text-[11px] truncate">Cold Chain Batch #82 • Temp 4.1°C</span>
                          </div>
                          <span className="text-[9px] font-mono font-bold text-amber-700 bg-white px-2 py-0.5 rounded-full border border-amber-200 shrink-0 hidden sm:inline-block">
                            Secure Seal
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Track 5: Van #22 • Sneha M. */}
                    <div className="grid grid-cols-12 items-center py-3 hover:bg-stone-50/70 transition-colors group">
                      <div className="col-span-3 pr-3 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-fuchsia-400 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                          SM
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-900 truncate">Van #22 • Sneha M.</p>
                          <p className="text-[10px] text-stone-400 font-mono truncate">Afternoon Regional Shift</p>
                        </div>
                      </div>
                      <div className="col-span-9 relative h-12 flex items-center">
                        <div className="absolute inset-0 grid grid-cols-9 divide-x divide-stone-100 pointer-events-none" />
                        <div
                          className="absolute h-10 rounded-2xl bg-gradient-to-r from-purple-50 via-fuchsia-50 to-purple-100/60 border border-purple-200/90 shadow-sm flex items-center justify-between px-3 text-xs text-stone-800 transition-all hover:shadow-md cursor-pointer group-hover:border-purple-400"
                          style={{ left: '55%', width: '42%' }}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                            <span className="font-bold text-[11px] truncate">Regional Depot Transfer Scheduled</span>
                          </div>
                          <span className="text-[9px] font-mono font-bold text-purple-700 bg-white px-2 py-0.5 rounded-full border border-purple-200 shrink-0 hidden sm:inline-block">
                            Pre-Trip OK
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating Assemble Widgets Inside Calendar */}
                {/* Floating Top-Right "View larger" Pill Button */}
                <div className="absolute top-16 right-6 z-30">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="px-4 py-2 rounded-full bg-stone-900/85 hover:bg-stone-900 text-white text-xs font-bold shadow-xl backdrop-blur-md flex items-center gap-2 transition-all hover:scale-105 cursor-pointer border border-white/20"
                  >
                    <span>View larger</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Floating Bottom-Right Circular Rotate/Sync Widget */}
                <div className="absolute bottom-6 right-6 z-30">
                  <button
                    type="button"
                    title="Switch to Map View"
                    onClick={() => setHeroTab('map')}
                    className="w-11 h-11 rounded-full bg-white/95 hover:bg-white text-stone-700 hover:text-stone-900 border border-stone-200/90 shadow-xl backdrop-blur-md flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-stone-700" />
                  </button>
                </div>
              </div>
            ) : (
              /* TAB 2: LIVE OPERATIONS MAP CANVAS */
              <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px] bg-[#FAF8F5]/40">
                {/* Left Column: Active Manifest Sidebar */}
                <div className="lg:col-span-4 border-r border-stone-200/80 bg-white p-5 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                      <span className="text-xs font-extrabold text-stone-900 uppercase tracking-wider font-mono">
                        Active Manifest (50)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FFF2ED] text-[#E85D38] font-bold">
                        Real-time
                      </span>
                    </div>

                    <div className="mt-3 space-y-2.5">
                      {/* Agent Item 1 */}
                      <div className="p-3 rounded-2xl bg-[#FFF2ED]/40 border border-[#FCD4C7] flex items-center justify-between cursor-pointer hover:bg-[#FFF2ED]/70 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#E85D38] text-white flex items-center justify-center text-xs font-bold font-mono">
                            01
                          </div>
                          <div>
                            <p className="text-xs font-bold text-stone-900 leading-tight">Vikram S. • Van #12</p>
                            <p className="text-[10px] text-stone-500 font-mono mt-0.5">MG Road → Indiranagar</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-[#E85D38] bg-white px-2 py-0.5 rounded-full shadow-xs border border-orange-200">
                          38 km/h
                        </span>
                      </div>

                      {/* Agent Item 2 */}
                      <div className="p-3 rounded-2xl bg-white border border-stone-200/80 hover:border-stone-300 flex items-center justify-between cursor-pointer transition-colors shadow-2xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold font-mono">
                            04
                          </div>
                          <div>
                            <p className="text-xs font-bold text-stone-900 leading-tight">Priya S. • Bike #04</p>
                            <p className="text-[10px] text-emerald-600 font-semibold font-mono mt-0.5">Inside Geofence (8m)</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Verified
                        </span>
                      </div>

                      {/* Agent Item 3 */}
                      <div className="p-3 rounded-2xl bg-white border border-stone-200/80 hover:border-stone-300 flex items-center justify-between cursor-pointer transition-colors shadow-2xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold font-mono">
                            08
                          </div>
                          <div>
                            <p className="text-xs font-bold text-stone-900 leading-tight">Anand P. • Truck #08</p>
                            <p className="text-[10px] text-stone-500 font-mono mt-0.5">Hebbal Logistics Park</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full">
                          Stopped
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Switch to Full Live Ops */}
                  <NavLink
                    to="/dashboard/live"
                    className="p-3 rounded-2xl bg-[#FAF8F5] border border-stone-200/70 flex items-center justify-between text-xs text-stone-700 hover:text-[#E85D38] transition-colors font-semibold"
                  >
                    <span>Filter by Team & Vehicle Type</span>
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </NavLink>
                </div>

                {/* Main Area: Rich Interactive Operations Map Canvas */}
                <div className="lg:col-span-8 p-6 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-stone-50 via-white to-orange-50/20">
                  {/* Visual Roadmap Grid Mockup */}
                  <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#D5CEBE 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                  {/* Top Status Bar Inside Map */}
                  <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 bg-white/90 backdrop-blur-md p-3.5 rounded-2xl border border-stone-200/80 shadow-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-stone-900 font-mono">Metro Grid Active</span>
                      <span className="text-stone-300">•</span>
                      <span className="text-[11px] text-stone-500 font-mono">Bengaluru Central</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-stone-600 font-semibold"><strong className="text-stone-900">42</strong> Moving</span>
                      <span className="text-stone-300">•</span>
                      <span className="text-stone-600 font-semibold"><strong className="text-stone-900">5</strong> Geofence Dwells</span>
                      <span className="text-stone-300">•</span>
                      <span className="text-emerald-600 font-bold">0 Anomalies</span>
                    </div>
                  </div>

                  {/* Central Map Illustration with Routes & Live Vehicle Cards */}
                  <div className="relative my-8 h-64 flex items-center justify-center">
                    {/* SVG Route Paths & Geofences */}
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 240" fill="none">
                      <line x1="40" y1="120" x2="560" y2="120" stroke="#E7E2DA" strokeWidth="6" strokeLinecap="round" />
                      <line x1="240" y1="20" x2="240" y2="220" stroke="#E7E2DA" strokeWidth="6" strokeLinecap="round" />
                      <line x1="420" y1="30" x2="420" y2="210" stroke="#E7E2DA" strokeWidth="6" strokeLinecap="round" />
                      <path
                        d="M 60 120 Q 150 120, 240 70 T 420 120"
                        stroke="#E85D38"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeDasharray="6 4"
                      />
                      <circle cx="100" cy="120" r="38" fill="rgba(232, 93, 56, 0.08)" stroke="#E85D38" strokeWidth="1.5" strokeDasharray="3 3" />
                      <circle cx="420" cy="120" r="45" fill="rgba(16, 185, 129, 0.08)" stroke="#10B981" strokeWidth="1.5" strokeDasharray="3 3" />
                    </svg>

                    {/* Geofence Label 1 */}
                    <div className="absolute left-10 top-14 px-2.5 py-1 rounded-full bg-white border border-stone-200/80 shadow-xs text-[10px] font-mono font-bold text-stone-700 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#E85D38]" /> MG Road Pharmacy
                    </div>

                    {/* Geofence Label 2 */}
                    <div className="absolute right-16 top-8 px-2.5 py-1 rounded-full bg-white border border-stone-200/80 shadow-xs text-[10px] font-mono font-bold text-stone-700 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-600" /> Indiranagar Depot
                    </div>

                    {/* Interactive Floating Telemetry Card Over Vehicle */}
                    <div className="relative z-20 p-4 rounded-2xl bg-white border border-stone-200 shadow-xl max-w-xs text-left animate-pulse [animation-duration:4s]">
                      <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#E85D38]" />
                          <span className="text-xs font-bold text-stone-900 font-mono">Agent #01 • Vikram S.</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          Live GPS
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] font-mono">
                        <div>
                          <span className="text-[10px] text-stone-400">Velocity</span>
                          <p className="font-bold text-stone-800">38.4 km/h</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-stone-400">Accuracy</span>
                          <p className="font-bold text-stone-800">± 1.2 meters</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-stone-400">Heading</span>
                          <p className="font-bold text-stone-800">84° East</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-stone-400">Next Site</span>
                          <p className="font-bold text-[#E85D38]">Indiranagar (850m)</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Bar: Direct Action Prompts */}
                  <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-stone-200/70 text-xs">
                    <div className="flex items-center gap-4 text-stone-500 font-mono text-[11px]">
                      <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Auto Proof-of-Visit Ledger</span>
                      <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-[#E85D38]" /> Mock Location Detection</span>
                    </div>
                    <NavLink
                      to="/dashboard/replay"
                      className="text-[#E85D38] hover:text-[#D94F2B] font-bold text-xs flex items-center gap-1 transition-colors"
                    >
                      <span>Inspect Route Playback</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </NavLink>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Expanded Modal (Triggered by "View larger") */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-5xl rounded-3xl border border-stone-200 shadow-2xl overflow-hidden text-left flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-[#FAF8F5]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-[#E85D38] text-white flex items-center justify-center font-bold shadow-md shadow-orange-500/20">
                      <Radio className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-stone-900 font-mono">
                        Fleetora Dispatch Workspace • Expanded View
                      </h3>
                      <p className="text-[11px] text-stone-500 font-mono">
                        50 live metro fleet agents • Sub-50ms WebSocket telemetry • Zero-trust audit log
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <NavLink to="/dashboard/live">
                      <Button size="sm" variant="primary" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                        Open Full Live Console
                      </Button>
                    </NavLink>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-[#FFF2ED] border border-[#FCD4C7]">
                      <p className="text-xs text-stone-500 font-mono">Active Fleet Speed</p>
                      <p className="text-2xl font-black text-stone-900 font-mono mt-1">38.4 km/h</p>
                      <p className="text-[10px] text-[#E85D38] font-bold mt-1">Optimal Metro Pace</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                      <p className="text-xs text-stone-500 font-mono">Geofence Compliance</p>
                      <p className="text-2xl font-black text-emerald-800 font-mono mt-1">98.2%</p>
                      <p className="text-[10px] text-emerald-600 font-bold mt-1">42 / 43 Verified Dwells</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-stone-100 border border-stone-200">
                      <p className="text-xs text-stone-500 font-mono">Signal Drift / Anomaly</p>
                      <p className="text-2xl font-black text-stone-900 font-mono mt-1">0 Flagged</p>
                      <p className="text-[10px] text-stone-500 font-bold mt-1">Zero-Trust Ledger Clean</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-stone-200 overflow-hidden">
                    <div className="bg-[#FAF8F5] px-4 py-2.5 border-b border-stone-200 text-xs font-bold text-stone-700 font-mono flex items-center justify-between">
                      <span>Live Field Units Telemetry Stream</span>
                      <span className="text-emerald-600 font-bold">● Streaming (18ms)</span>
                    </div>
                    <div className="divide-y divide-stone-100 max-h-72 overflow-y-auto font-mono text-xs">
                      <div className="p-3.5 flex items-center justify-between hover:bg-stone-50">
                        <div className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="font-bold text-stone-900">Van #12 (Vikram S.)</span>
                          <span className="text-stone-400">• MG Road → Indiranagar</span>
                        </div>
                        <span className="text-[#E85D38] font-bold">38.4 km/h • 18ms</span>
                      </div>
                      <div className="p-3.5 flex items-center justify-between hover:bg-stone-50">
                        <div className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <span className="font-bold text-stone-900">Bike #04 (Priya S.)</span>
                          <span className="text-stone-400">• Inside Apollo Pharmacy</span>
                        </div>
                        <span className="text-emerald-600 font-bold">Dwell 14m • Verified</span>
                      </div>
                      <div className="p-3.5 flex items-center justify-between hover:bg-stone-50">
                        <div className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                          <span className="font-bold text-stone-900">Truck #08 (Anand P.)</span>
                          <span className="text-stone-400">• Hebbal Logistics Park</span>
                        </div>
                        <span className="text-stone-700 font-bold">58 km/h • Linehaul</span>
                      </div>
                      <div className="p-3.5 flex items-center justify-between hover:bg-stone-50">
                        <div className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          <span className="font-bold text-stone-900">Van #15 (Rahul K.)</span>
                          <span className="text-stone-400">• Airport Corridor</span>
                        </div>
                        <span className="text-amber-700 font-bold">Temp 4.1°C • Vaccine Safe</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Trusted by Hundreds Logo Strip (Direct Reference Style) */}
          <div className="mt-14 pt-8 border-t border-stone-200/60 max-w-4xl mx-auto">
            <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 font-mono">
              Trusted by 50+ Modern Delivery & Logistics Fleets
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-8 sm:gap-14 text-stone-400 font-bold text-sm tracking-wider opacity-80">
              <span className="flex items-center gap-1.5 hover:text-stone-700 transition-colors"><Building2 className="w-4 h-4 text-[#E85D38]" /> ACME LOGISTICS</span>
              <span className="flex items-center gap-1.5 hover:text-stone-700 transition-colors"><Navigation className="w-4 h-4 text-emerald-600" /> SWIFT COURIERS</span>
              <span className="flex items-center gap-1.5 hover:text-stone-700 transition-colors"><Layers className="w-4 h-4 text-blue-600" /> METROFLEET</span>
              <span className="flex items-center gap-1.5 hover:text-stone-700 transition-colors"><Compass className="w-4 h-4 text-purple-600" /> URBAN TRANSIT</span>
              <span className="flex items-center gap-1.5 hover:text-stone-700 transition-colors"><Award className="w-4 h-4 text-amber-600" /> APEX FREIGHT</span>
            </div>
          </div>

          {/* Testimonial Feature Card (Matching Reference's Floating Quote Card) */}
          <div className="mt-14 max-w-3xl mx-auto">
            <div className="p-6 sm:p-8 bg-white rounded-3xl border border-stone-200/80 shadow-[0_16px_40px_rgba(28,25,23,0.05)] flex flex-col sm:flex-row items-center gap-6 text-left -rotate-1 hover:rotate-0 transition-transform duration-300">
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-stone-100 to-stone-200 border-2 border-white shadow-md overflow-hidden flex items-center justify-center text-stone-600">
                  <Users className="w-10 h-10 text-stone-500" />
                </div>
                {/* Coral Pin Indicator */}
                <div className="w-3.5 h-3.5 rounded-full bg-[#E85D38] border-2 border-white shadow absolute -top-1.5 -right-1.5" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="ml-2 text-[11px] font-bold text-stone-700">5.0 Star Fleet Audit</span>
                </div>
                <p className="text-sm sm:text-base font-semibold text-stone-800 leading-relaxed">
                  “Our team loves this system because it’s so dynamic. We can splice our telemetry data in so many different ways and combinations, and ghost check-ins dropped to zero.”
                </p>
                <div className="text-xs text-stone-500 pt-1">
                  <span className="font-bold text-stone-900">David White</span> — Chief of Staff, Pallet Logistics
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1: "Why Choose Us" (3 Interactive Cards matching reference) */}
      <section id="benefits" className="py-24 border-t border-stone-200/70 bg-white">
        <div className="max-w-7xl mx-auto px-6 space-y-16">
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FFF2ED] border border-[#FCD4C7] text-[#E85D38] text-[11px] font-bold uppercase tracking-wider mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E85D38]" />
              Benefits
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              Why Choose Us
            </h2>
            <p className="text-stone-500 mt-2 text-sm sm:text-base">
              A results-focused fleet intelligence partner that moves as fast as you do.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1: Speedometer Gauge (Direct Reference Style) */}
            <div className="p-8 rounded-3xl bg-white border border-stone-200/80 shadow-[0_12px_32px_rgba(28,25,23,0.04)] hover:shadow-[0_20px_45px_rgba(232,93,56,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                {/* Visual Graphic Inset */}
                <div className="h-44 rounded-2xl bg-[#FAF8F5] border border-stone-100 flex flex-col items-center justify-center relative p-4 mb-6">
                  {/* Speedometer SVG Widget */}
                  <div className="relative w-36 h-28 flex items-center justify-center">
                    <svg className="w-full h-full" viewBox="0 0 160 110">
                      {/* Arc Track */}
                      <path
                        d="M 20 90 A 60 60 0 0 1 140 90"
                        fill="none"
                        stroke="#E5E0D8"
                        strokeWidth="8"
                        strokeLinecap="round"
                      />
                      {/* Active Arc Gradient */}
                      <path
                        d="M 20 90 A 60 60 0 0 1 115 42"
                        fill="none"
                        stroke="#E85D38"
                        strokeWidth="8"
                        strokeLinecap="round"
                      />
                      {/* Gauge Needle */}
                      <line
                        x1="80"
                        y1="90"
                        x2="108"
                        y2="48"
                        stroke="#E85D38"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                      <circle cx="80" cy="90" r="6" fill="#1C1917" />
                      <circle cx="80" cy="90" r="2.5" fill="#FFFFFF" />
                      {/* Labels */}
                      <text x="18" y="105" fontSize="10" fill="#A8A29E" fontFamily="sans-serif">01</text>
                      <text x="74" y="20" fontSize="10" fill="#E85D38" fontWeight="bold" fontFamily="sans-serif">02</text>
                      <text x="135" y="105" fontSize="10" fill="#A8A29E" fontFamily="sans-serif">03</text>
                    </svg>
                    <div className="absolute bottom-1 text-center">
                      <span className="text-[10px] font-mono uppercase text-stone-400 font-semibold">Speed</span>
                      <p className="text-xs font-bold text-stone-800 font-mono">42 km/h</p>
                    </div>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-stone-900">Live Performance Tracking</h3>
                <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                  Monitor what matters with always-on, real-time analytics across your field staff and mobile fleets.
                </p>
              </div>
            </div>

            {/* Card 2: Interactive Button Click (Direct Reference Style) */}
            <div className="p-8 rounded-3xl bg-white border border-stone-200/80 shadow-[0_12px_32px_rgba(28,25,23,0.04)] hover:shadow-[0_20px_45px_rgba(232,93,56,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                {/* Visual Graphic Inset */}
                <div className="h-44 rounded-2xl bg-[#FAF8F5] border border-stone-100 flex flex-col items-center justify-center relative p-4 mb-6">
                  {/* Tactile Button Widget */}
                  <div className="relative">
                    <div className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#E85D38] to-[#FF7A50] text-white font-bold text-xs shadow-[0_10px_25px_rgba(232,93,56,0.35)] flex items-center gap-2 border border-white/30">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Verify With AI</span>
                    </div>
                    {/* Hand Pointer Cursor Overlay */}
                    <div className="absolute -bottom-4 right-2 pointer-events-none drop-shadow-md animate-bounce [animation-duration:3s]">
                      <MousePointer className="w-6 h-6 text-stone-900 fill-white" />
                    </div>
                  </div>
                  <span className="mt-4 text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
                    ✓ Cryptographic Audit Match
                  </span>
                </div>

                <h3 className="text-lg font-bold text-stone-900">AI-Powered Business Growth</h3>
                <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                  Make confident decisions backed by intelligent, real-time GPS telemetry data — never guesswork or ghost check-ins.
                </p>
              </div>
            </div>

            {/* Card 3: Instant Team Sync (Direct Reference Style) */}
            <div className="p-8 rounded-3xl bg-white border border-stone-200/80 shadow-[0_12px_32px_rgba(28,25,23,0.04)] hover:shadow-[0_20px_45px_rgba(232,93,56,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                {/* Visual Graphic Inset */}
                <div className="h-44 rounded-2xl bg-[#FAF8F5] border border-stone-100 flex flex-col items-center justify-center relative p-4 mb-6">
                  {/* Team Avatars with Glowing Center Sync */}
                  <div className="relative w-44 h-24 flex items-center justify-center">
                    {/* User Node Left */}
                    <div className="w-9 h-9 rounded-full bg-white border border-stone-200 shadow-sm flex items-center justify-center text-stone-600 absolute left-2 top-3">
                      <Users className="w-4 h-4 text-blue-500" />
                    </div>
                    {/* User Node Right */}
                    <div className="w-9 h-9 rounded-full bg-white border border-stone-200 shadow-sm flex items-center justify-center text-stone-600 absolute right-2 top-3">
                      <Users className="w-4 h-4 text-emerald-500" />
                    </div>
                    {/* Center Sync Pill */}
                    <div className="px-3.5 py-1.5 rounded-full bg-white border border-stone-200 shadow-md flex items-center gap-1.5 text-xs font-bold text-stone-800 z-10">
                      <RotateCcw className="w-3.5 h-3.5 text-[#E85D38] animate-spin [animation-duration:4s]" />
                      <span>Sync</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-stone-400">
                    50 Active Agents Online
                  </span>
                </div>

                <h3 className="text-lg font-bold text-stone-900">Instant Team Sync</h3>
                <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                  Keep your dispatcher desk aligned with live field progress updates and seamless supervisor collaboration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Process Roadmap ("Structured. Scalable.") */}
      <section id="process" className="py-24 border-t border-stone-200/70 bg-[#FAF8F5]">
        <div className="max-w-7xl mx-auto px-6 space-y-16">
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white border border-stone-200/90 text-stone-700 text-[11px] font-bold uppercase tracking-wider mb-3 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E85D38]" />
              Process
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              Structured. Scalable.
            </h2>
            <p className="text-stone-500 mt-2 text-sm sm:text-base">
              A collaborative zero-trust auditing pipeline built on transparency and undeniable proof.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Step 1 */}
            <div className="p-6 rounded-3xl bg-white border border-stone-200/80 shadow-[0_10px_25px_rgba(28,25,23,0.03)] relative space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF2ED] text-[#E85D38] text-[10px] font-bold uppercase font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E85D38]" />
                Step 01
              </div>
              <h3 className="text-base font-bold text-stone-900">Operations Discovery</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                We map all client sites, perimeter polygons, and radial thresholds where automation yields the highest operational impact.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-3xl bg-white border border-stone-200/80 shadow-[0_10px_25px_rgba(28,25,23,0.03)] relative space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF2ED] text-[#E85D38] text-[10px] font-bold uppercase font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E85D38]" />
                Step 02
              </div>
              <h3 className="text-base font-bold text-stone-900">Kinematic Telemetry</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Agents broadcast sub-second GPS samples with speed, accuracy, and bearing markers across metro delivery sectors.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-3xl bg-white border border-stone-200/80 shadow-[0_10px_25px_rgba(28,25,23,0.03)] relative space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF2ED] text-[#E85D38] text-[10px] font-bold uppercase font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E85D38]" />
                Step 03
              </div>
              <h3 className="text-base font-bold text-stone-900">Continuous Verification</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Dwell times are calculated on entry and exit fixes with automated visit creation, eliminating manual paperwork.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-6 rounded-3xl bg-white border border-stone-200/80 shadow-[0_10px_25px_rgba(28,25,23,0.03)] relative space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF2ED] text-[#E85D38] text-[10px] font-bold uppercase font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E85D38]" />
                Step 04
              </div>
              <h3 className="text-base font-bold text-stone-900">Explainable Triage</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Post-dispatch anomaly algorithms flag kinematic teleportation or fake GPS apps so supervisors inspect incidents instantly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Interactive Live Fleet Console Box */}
      <section className="py-20 border-t border-stone-200/70 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FFF2ED] border border-[#FCD4C7] text-[#E85D38] text-[11px] font-bold uppercase tracking-wider mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E85D38]" />
              Live Interactive Map
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
              Operations Center In Action
            </h2>
          </div>

          <div className="relative rounded-3xl border border-stone-200/90 bg-white shadow-[0_20px_60px_rgba(28,25,23,0.06)] p-3 overflow-hidden text-left">
            <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100 bg-[#FAF8F5] rounded-t-2xl text-xs text-stone-600">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-[#E85D38]" />
                <span className="font-bold text-stone-900">Live Fleet Console</span>
              </div>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                SIMULATED LIVE STREAM
              </span>
            </div>

            {/* Metric counters banner */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-[#FAF8F5]/60 border-b border-stone-100 text-center">
              <div className="p-4 bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(28,25,23,0.02)]">
                <span className="text-[10px] text-stone-500 font-mono uppercase font-semibold">Moving Vehicles</span>
                <div className="text-2xl font-bold font-mono text-[#E85D38] mt-0.5">42</div>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(28,25,23,0.02)]">
                <span className="text-[10px] text-stone-500 font-mono uppercase font-semibold">Stationary / Idle</span>
                <div className="text-2xl font-bold font-mono text-stone-900 mt-0.5">5</div>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(28,25,23,0.02)]">
                <span className="text-[10px] text-stone-500 font-mono uppercase font-semibold">Stale / Offline</span>
                <div className="text-2xl font-bold font-mono text-amber-600 mt-0.5">3</div>
              </div>
            </div>

            {/* Visual preview description strip */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-stone-200/70">
                <div className="font-bold text-stone-900 text-xs">Live Agent Manifest</div>
                <p className="text-stone-500 mt-1 text-[11px] leading-relaxed">
                  Search, filter, and inspect 50 active couriers, technicians, and trucks across the metro sector.
                </p>
              </div>
              <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-stone-200/70">
                <div className="font-bold text-stone-900 text-xs">Kinematic Sensor Feed</div>
                <p className="text-stone-500 mt-1 text-[11px] leading-relaxed">
                  Instantaneous speed, compass bearing, battery percentage, and explainable anti-spoofing flags.
                </p>
              </div>
            </div>

            <div className="px-5 py-3 bg-[#FAF8F5] border-t border-stone-100 rounded-b-2xl flex items-center justify-between text-[11px] text-stone-500 font-mono">
              <span>Last server update: 2 seconds ago</span>
              <NavLink to="/dashboard/live" className="text-[#E85D38] hover:underline flex items-center gap-1 font-semibold">
                Open Full Operations Screen &rarr;
              </NavLink>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: Case Study ("Impact That Speaks for Itself" matching reference) */}
      <section id="results" className="py-24 border-t border-stone-200/70 bg-[#FAF8F5]">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white border border-stone-200/90 text-stone-700 text-[11px] font-bold uppercase tracking-wider mb-2 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E85D38]" />
              Projects & Impact
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900">
              Impact That Speaks for Itself
            </h2>
            <p className="text-stone-500 mt-2 text-sm sm:text-base">
              Real-world deployments that demonstrate our AI capabilities and verifiable business ROI.
            </p>
          </div>

          <div className="p-8 sm:p-10 rounded-3xl bg-white border border-stone-200/80 shadow-[0_16px_45px_rgba(28,25,23,0.05)] grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Visual Thumbnail */}
            <div className="md:col-span-5 h-64 rounded-2xl bg-gradient-to-tr from-[#E85D38] to-[#FF8C66] p-6 text-white flex flex-col justify-between shadow-lg shadow-orange-500/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/20 uppercase font-bold tracking-wider">
                  Enterprise Case Study
                </span>
                <Radio className="w-5 h-5 text-white/90" />
              </div>
              <div>
                <p className="text-2xl font-black">SwiftCourier</p>
                <p className="text-xs text-white/80 mt-1">Autonomous 50-Van Metro Verification</p>
              </div>
            </div>

            {/* Case Details */}
            <div className="md:col-span-7 space-y-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-stone-900">
                  VitalTrace — Real-Time Fleet Triage & Proof of Delivery
                </h3>
                <p className="text-xs sm:text-sm text-stone-500 mt-2 leading-relaxed">
                  We engineered an automated zero-trust auditing pipeline that cross-references driver arrival timestamps,
                  GPS micro-geofence dwell, and photo evidence directly into the central dispatch ledger.
                </p>
              </div>

              {/* Stat Counters */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-stone-100">
                <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-stone-100">
                  <div className="text-3xl font-extrabold text-[#E85D38] font-mono">98.4%</div>
                  <p className="text-xs text-stone-500 mt-1">Reduction in ghost check-ins & disputed visits</p>
                </div>
                <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-stone-100">
                  <div className="text-3xl font-extrabold text-stone-900 font-mono">4.8x</div>
                  <p className="text-xs text-stone-500 mt-1">Faster route dispute resolution & audit speed</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: Architectural Checklist Roadmap */}
      <section id="checklist" className="py-24 border-t border-stone-200/70 bg-white">
        <div className="max-w-5xl mx-auto px-6 space-y-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FFF2ED] border border-[#FCD4C7] text-[#E85D38] text-[11px] font-bold uppercase tracking-wider mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E85D38]" />
              Portfolio Roadmap
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-stone-900 mt-1">
              Interactive Architectural Checklist
            </p>
          </div>

          <div className="bg-[#FAF8F5] border border-stone-200/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_15px_40px_rgba(28,25,23,0.04)]">
            {/* Progress Header */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-stone-900 font-mono">
                System Implementation Progress ({checkedItems.length} / {totalItems} completed)
              </span>
              <span className="font-mono text-[#E85D38] font-bold">{progressPercent}%</span>
            </div>

            <div className="w-full bg-stone-200 h-2.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#E85D38] to-[#FF8C66] rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Stages */}
            <div className="space-y-4">
              {stages.map((stage) => (
                <div key={stage.name} className="p-5 bg-white rounded-2xl border border-stone-200/70 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-stone-900">{stage.name}</span>
                      <span className="text-[10px] text-stone-500 font-mono ml-2">({stage.time})</span>
                    </div>
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#FAF8F5] text-stone-700 border border-stone-200 shadow-sm font-semibold">
                      {stage.items.filter((i) => checkedItems.includes(i)).length}/{stage.items.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {stage.items.map((item) => {
                      const isChecked = checkedItems.includes(item);
                      return (
                        <div
                          key={item}
                          onClick={() => toggleCheck(item)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all border ${
                            isChecked
                              ? 'bg-[#FFF2ED] border-[#FCD4C7] text-[#E85D38] font-medium shadow-sm'
                              : 'bg-white border-stone-200/80 text-stone-600 hover:text-stone-900 hover:border-stone-300 hover:bg-stone-50 shadow-sm'
                          }`}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-[#E85D38] shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-stone-400 shrink-0" />
                          )}
                          <span className={isChecked ? 'line-through text-stone-500' : ''}>{item}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-stone-200/60">
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
                leftIcon={copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-stone-600" />}
                onClick={handleCopy}
              >
                {copied ? 'Copied to Clipboard!' : 'Copy Roadmap'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: Pricing Section */}
      <section id="pricing" className="py-24 border-t border-stone-200/70 bg-[#FAF8F5]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white border border-stone-200/90 text-stone-700 text-[11px] font-bold uppercase tracking-wider mb-2 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E85D38]" />
              Transparent Pricing
            </div>
            <p className="text-3xl font-extrabold text-stone-900 mt-1">
              Scalable Plans for Field Teams & Enterprise Operations
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="p-8 rounded-3xl bg-white border border-stone-200/80 flex flex-col justify-between shadow-[0_10px_30px_rgba(28,25,23,0.03)] hover:shadow-[0_20px_45px_rgba(28,25,23,0.07)] transition-all">
              <div>
                <h3 className="text-base font-bold text-stone-900">Starter Fleet</h3>
                <p className="text-xs text-stone-500 mt-1">Up to 15 field agents</p>
                <div className="mt-6 flex items-baseline gap-1 font-mono">
                  <span className="text-3xl font-extrabold text-stone-900">$249</span>
                  <span className="text-xs text-stone-500">/ mo</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-xs text-stone-600">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#E85D38]" /> 5-second GPS updates</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#E85D38]" /> Radial geofencing</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#E85D38]" /> Standard proof of visit</li>
                </ul>
              </div>
              <NavLink to="/dashboard" className="mt-8">
                <Button variant="secondary" className="w-full">Start Free Trial</Button>
              </NavLink>
            </div>

            <div className="p-8 rounded-3xl bg-gradient-to-b from-white to-[#FFF9F6] border-2 border-[#E85D38] relative flex flex-col justify-between shadow-[0_20px_50px_rgba(232,93,56,0.14)]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#E85D38] text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-md">
                Most Popular
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">Operations Pro</h3>
                <p className="text-xs text-stone-500 mt-1">Up to 100 field agents + AI Anomaly Engine</p>
                <div className="mt-6 flex items-baseline gap-1 font-mono">
                  <span className="text-3xl font-extrabold text-stone-900">$699</span>
                  <span className="text-xs text-stone-500">/ mo</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-xs text-stone-600">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#E85D38]" /> Sub-second live WebSocket telemetry</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#E85D38]" /> Polygon custom geofences</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#E85D38]" /> AI Kinematic GPS Spoof Detection</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#E85D38]" /> Route historical playback scrub</li>
                </ul>
              </div>
              <NavLink to="/dashboard" className="mt-8">
                <Button variant="primary" className="w-full font-bold">Deploy Operations Pro</Button>
              </NavLink>
            </div>

            <div className="p-8 rounded-3xl bg-white border border-stone-200/80 flex flex-col justify-between shadow-[0_10px_30px_rgba(28,25,23,0.03)] hover:shadow-[0_20px_45px_rgba(28,25,23,0.07)] transition-all">
              <div>
                <h3 className="text-base font-bold text-stone-900">Global Enterprise</h3>
                <p className="text-xs text-stone-500 mt-1">Unlimited agents, custom SLAs & on-premise</p>
                <div className="mt-6 flex items-baseline gap-1 font-mono">
                  <span className="text-3xl font-extrabold text-stone-900">Custom</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-xs text-stone-600">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#E85D38]" /> Dedicated telemetry clusters</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#E85D38]" /> Custom ERP / SAP dispatch hooks</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#E85D38]" /> 99.99% uptime SLA guarantee</li>
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
      <footer className="py-12 border-t border-stone-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-stone-500">
          <div className="flex items-center gap-3">
            <Radio className="w-4 h-4 text-[#E85D38]" />
            <span>© 2026 Fleetora Technologies Inc. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 font-mono text-[11px]">
            <NavLink to="/dashboard" className="hover:text-[#E85D38] transition-colors">Live Ops Center</NavLink>
            <NavLink to="/driver" className="hover:text-[#E85D38] transition-colors">Driver PWA</NavLink>
            <a href="#benefits" className="hover:text-[#E85D38] transition-colors">Documentation</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
