import React, { useState } from 'react';
import { useFleetStore } from '../../store/useFleetStore';
import { Geofence } from '../../api/types';
import { FleetMap } from '../../components/map/FleetMap';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import {
  Shield,
  Plus,
  Search,
  MapPin,
  CheckCircle2,
  Users,
  AlertTriangle,
  Sliders,
  Sparkles,
} from 'lucide-react';

export const Geofences: React.FC = () => {
  const geofences = useFleetStore((state) => state.geofences);
  const agents = useFleetStore((state) => state.agents);
  const addGeofence = useFleetStore((state) => state.addGeofence);

  const [selectedGeoId, setSelectedGeoId] = useState<string | null>(geofences[0]?.id || null);
  const [search, setSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Geofence Form State
  const [newName, setNewName] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newRadius, setNewRadius] = useState(250);
  const [newRisk, setNewRisk] = useState<'low' | 'medium' | 'high'>('low');

  const filteredGeofences = geofences.filter(
    (g) =>
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.clientName.toLowerCase().includes(search.toLowerCase()) ||
      g.code.toLowerCase().includes(search.toLowerCase())
  );

  const selectedGeofence = geofences.find((g) => g.id === selectedGeoId) || geofences[0];

  const handleCreateGeofence = () => {
    if (!newName || !newClient) return;

    const newGeo: Geofence = {
      id: `geo-${Date.now().toString().slice(-4)}`,
      name: newName,
      clientName: newClient,
      code: `GF-NEW-${Math.floor(100 + Math.random() * 900)}`,
      type: 'circle',
      center: [37.7790 + (Math.random() - 0.5) * 0.04, -122.4180 + (Math.random() - 0.5) * 0.04],
      radiusMeters: newRadius,
      address: 'Simulated Zone, San Francisco Metro Area, CA',
      activeAgentsCount: 1,
      riskLevel: newRisk,
      tags: ['Custom Perimeter', 'Auto-Checkin'],
      autoVerifyToleranceMeters: 30,
      gracePeriodMinutes: 5,
      color: newRisk === 'high' ? '#F43F5E' : newRisk === 'medium' ? '#FBBF24' : '#5EEAD4',
    };

    addGeofence(newGeo);
    setIsCreateModalOpen(false);
    setSelectedGeoId(newGeo.id);
    setNewName('');
    setNewClient('');
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-400" />
            <span>Geofence Perimeter & Site Manager</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Configure sub-meter polygonal and radial boundary perimeters with auto-verification tolerance rules.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsCreateModalOpen(true)}
        >
          Create New Geofence
        </Button>
      </div>

      {/* Main Split: Directory Sidebar + Interactive Map View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Directory */}
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search geofences by name or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-ops-panel border border-ops-border rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-teal"
            />
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredGeofences.map((geo) => {
              const isSelected = selectedGeoId === geo.id;

              return (
                <div
                  key={geo.id}
                  onClick={() => setSelectedGeoId(geo.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-ops-card border-brand-teal ring-1 ring-brand-teal/40'
                      : 'bg-ops-panel border-ops-border hover:border-ops-borderHighlight'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">{geo.code}</span>
                      <h3 className="text-sm font-bold text-white mt-0.5">{geo.name}</h3>
                      <div className="text-xs text-gray-400 mt-0.5">{geo.clientName}</div>
                    </div>
                    <Badge
                      variant={geo.riskLevel === 'high' ? 'flagged' : geo.riskLevel === 'medium' ? 'idle' : 'verified'}
                      size="sm"
                    >
                      {geo.riskLevel} risk
                    </Badge>
                  </div>

                  <div className="mt-3 pt-3 border-t border-ops-border/60 flex items-center justify-between text-xs text-gray-300 font-mono">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-brand-teal" />
                      <span>{geo.activeAgentsCount} Agents Inside</span>
                    </div>
                    <span className="text-gray-400">
                      {geo.type === 'circle' ? `Radius: ${geo.radiusMeters}m` : 'Polygon'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Map & Zone Inspector */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="h-[440px] rounded-2xl overflow-hidden border border-ops-border shadow-2xl relative">
            <FleetMap
              geofences={geofences}
              agents={agents.slice(0, 20)}
              selectedGeofenceId={selectedGeoId}
              onSelectGeofence={(g) => setSelectedGeoId(g.id)}
            />
          </div>

          {/* Selected Geofence Inspector Card */}
          {selectedGeofence && (
            <Card
              header={
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-brand-teal" />
                    <span>Perimeter Rules: {selectedGeofence.name}</span>
                  </div>
                  <span className="font-mono text-xs text-gray-400">{selectedGeofence.code}</span>
                </div>
              }
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                <div className="p-3 bg-ops-base border border-ops-border rounded-xl">
                  <span className="text-[10px] text-gray-400">Auto-Checkin Tolerance</span>
                  <div className="text-base font-bold text-brand-teal mt-0.5">±{selectedGeofence.autoVerifyToleranceMeters}m</div>
                </div>
                <div className="p-3 bg-ops-base border border-ops-border rounded-xl">
                  <span className="text-[10px] text-gray-400">Departure Grace Period</span>
                  <div className="text-base font-bold text-white mt-0.5">{selectedGeofence.gracePeriodMinutes} mins</div>
                </div>
                <div className="p-3 bg-ops-base border border-ops-border rounded-xl">
                  <span className="text-[10px] text-gray-400">Perimeter Type</span>
                  <div className="text-base font-bold text-emerald-400 mt-0.5 capitalize">{selectedGeofence.type}</div>
                </div>
                <div className="p-3 bg-ops-base border border-ops-border rounded-xl">
                  <span className="text-[10px] text-gray-400">Risk Policy</span>
                  <div className="text-base font-bold text-amber-400 mt-0.5 uppercase">{selectedGeofence.riskLevel}</div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Create Geofence Wizard Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Deploy New Micro-Geofence Perimeter"
        subtitle="Establish automated client site check-in boundaries"
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateGeofence}>
              Create Geofence Zone
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-gray-300 font-semibold mb-1">Perimeter Name / Facility</label>
            <input
              type="text"
              placeholder="e.g. San Francisco Marina Logistics Bay"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-ops-card border border-ops-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-teal"
            />
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-1">Client Organization</label>
            <input
              type="text"
              placeholder="e.g. Biotech Global Distribution"
              value={newClient}
              onChange={(e) => setNewClient(e.target.value)}
              className="w-full bg-ops-card border border-ops-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-teal"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 font-semibold mb-1">Radius (Meters)</label>
              <input
                type="number"
                value={newRadius}
                onChange={(e) => setNewRadius(Number(e.target.value))}
                className="w-full bg-ops-card border border-ops-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-teal font-mono"
              />
            </div>
            <div>
              <label className="block text-gray-300 font-semibold mb-1">Risk Profile</label>
              <select
                value={newRisk}
                onChange={(e) => setNewRisk(e.target.value as any)}
                className="w-full bg-ops-card border border-ops-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-teal"
              >
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Security / Sensitive</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
