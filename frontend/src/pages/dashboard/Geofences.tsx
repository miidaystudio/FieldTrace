import React, { useState } from 'react';
import { useFleetStore } from '../../store/useFleetStore';
import { locationsApi } from '../../api/backend';
import { errorMessage } from '../../api/client';
import { DarkFormError, darkInputClass } from '../../components/common/FormInputs';
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
  const reloadLocations = useFleetStore((state) => state.reloadLocations);
  const locations = useFleetStore((state) => state.locations);

  const [selectedGeoId, setSelectedGeoId] = useState<string | null>(geofences[0]?.id || null);
  const [search, setSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Geofence Form State
  const [newName, setNewName] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newRadius, setNewRadius] = useState(150);
  const [newAddress, setNewAddress] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const filteredGeofences = geofences.filter(
    (g) =>
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.clientName.toLowerCase().includes(search.toLowerCase()) ||
      g.code.toLowerCase().includes(search.toLowerCase())
  );

  const selectedGeofence = geofences.find((g) => g.id === selectedGeoId) || geofences[0];

  const openCreate = () => {
    // Prefill with the selected (or first) site so the new zone starts nearby.
    const anchor = geofences.find((g) => g.id === selectedGeoId) ?? geofences[0];
    setNewLat(anchor ? anchor.center[0].toFixed(5) : '');
    setNewLng(anchor ? anchor.center[1].toFixed(5) : '');
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateGeofence = async () => {
    const lat = Number(newLat);
    const lng = Number(newLng);
    if (!newName || Number.isNaN(lat) || Number.isNaN(lng) || newLat === '' || newLng === '') {
      setCreateError('Name, latitude and longitude are required.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const created = await locationsApi.create({
        name: newName.trim(),
        address: newAddress.trim() || null,
        position: { lat, lng },
        geofence: { shape: 'circle', radiusM: newRadius },
        contact: newClient.trim() ? { name: newClient.trim() } : undefined,
      });
      await reloadLocations();
      setIsCreateModalOpen(false);
      setSelectedGeoId(created.id);
      setNewName('');
      setNewClient('');
      setNewAddress('');
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const selectedLocation = locations.find((l) => l.id === selectedGeofence?.id);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-white" />
            <span>Geofence Perimeter & Site Manager</span>
          </h1>
          <p className="text-xs text-[#8E96A4] mt-1">
            Configure sub-meter polygonal and radial boundary perimeters with auto-verification tolerance rules.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="bg-white hover:bg-slate-200 text-black font-semibold rounded-full px-5 py-2 text-xs flex items-center gap-2 transition-colors shadow-none"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Create New Geofence</span>
        </button>
      </div>

      {/* Main Split: Directory Sidebar + Interactive Map View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Directory */}
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search geofences by name or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#1D212B] border border-white/[0.08] rounded-full pl-9 pr-4 py-2 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {filteredGeofences.map((geo) => {
              const isSelected = selectedGeoId === geo.id;

              return (
                <div
                  key={geo.id}
                  onClick={() => setSelectedGeoId(geo.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white/[0.08] border-white/40 shadow-sm'
                      : 'bg-[#161920] border-white/[0.05] hover:border-white/[0.1] hover:bg-[#1D212B]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-[#8E96A4] uppercase tracking-wider">{geo.code}</span>
                      <h3 className="text-sm font-bold text-white mt-0.5">{geo.name}</h3>
                      <div className="text-xs text-[#8E96A4] mt-0.5">{geo.clientName}</div>
                    </div>
                    <Badge variant={geo.activeAgentsCount > 0 ? 'moving' : 'slate'} size="sm">
                      {geo.type}
                    </Badge>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center justify-between text-xs text-[#8E96A4] font-mono">
                    <div className="flex items-center gap-1.5 text-white">
                      <Users className="w-3.5 h-3.5" />
                      <span>{geo.activeAgentsCount} Agents Inside</span>
                    </div>
                    <span>
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
              agents={agents}
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
                  <span className="text-[10px] text-gray-400">
                    {selectedGeofence.type === 'circle' ? 'Radius' : 'Polygon Vertices'}
                  </span>
                  <div className="text-base font-bold text-brand-teal mt-0.5">
                    {selectedGeofence.type === 'circle'
                      ? `${selectedGeofence.radiusMeters}m`
                      : selectedGeofence.coordinates?.length ?? 0}
                  </div>
                </div>
                <div className="p-3 bg-ops-base border border-ops-border rounded-xl">
                  <span className="text-[10px] text-gray-400">Min. Dwell for a Visit</span>
                  <div className="text-base font-bold text-white mt-0.5">{selectedGeofence.gracePeriodMinutes} mins</div>
                </div>
                <div className="p-3 bg-ops-base border border-ops-border rounded-xl">
                  <span className="text-[10px] text-gray-400">Agents Inside Now</span>
                  <div className="text-base font-bold text-emerald-400 mt-0.5">{selectedGeofence.activeAgentsCount}</div>
                </div>
                <div className="p-3 bg-ops-base border border-ops-border rounded-xl">
                  <span className="text-[10px] text-gray-400">Required Evidence</span>
                  <div className="text-base font-bold text-amber-400 mt-0.5">
                    {[
                      selectedLocation?.visitRules.requireQr && 'QR',
                      selectedLocation?.visitRules.requirePhoto && 'Photo',
                    ]
                      .filter(Boolean)
                      .join(' + ') || 'GPS only'}
                  </div>
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
        title="New Client Location & Geofence"
        subtitle="Creates a client site with a circular geofence (10–5000 m)"
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={creating} onClick={() => void handleCreateGeofence()}>
              {creating ? 'Creating…' : 'Create Geofence Zone'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs text-white">
          <DarkFormError message={createError} />
          <div>
            <label className="block text-[#8E96A4] font-semibold mb-1.5">Perimeter Name / Facility</label>
            <input
              type="text"
              placeholder="e.g. San Francisco Marina Logistics Bay"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={darkInputClass}
            />
          </div>

          <div>
            <label className="block text-[#8E96A4] font-semibold mb-1.5">Client Contact (optional)</label>
            <input
              type="text"
              placeholder="e.g. Biotech Global Distribution"
              value={newClient}
              onChange={(e) => setNewClient(e.target.value)}
              className={darkInputClass}
            />
          </div>

          <div>
            <label className="block text-[#8E96A4] font-semibold mb-1.5">Address (optional)</label>
            <input type="text" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} className={darkInputClass} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[#8E96A4] font-semibold mb-1.5">Latitude</label>
              <input type="number" step="0.00001" value={newLat} onChange={(e) => setNewLat(e.target.value)} className={darkInputClass} />
            </div>
            <div>
              <label className="block text-[#8E96A4] font-semibold mb-1.5">Longitude</label>
              <input type="number" step="0.00001" value={newLng} onChange={(e) => setNewLng(e.target.value)} className={darkInputClass} />
            </div>
            <div>
              <label className="block text-[#8E96A4] font-semibold mb-1.5">Radius (Meters)</label>
              <input
                type="number"
                min={10}
                max={5000}
                value={newRadius}
                onChange={(e) => setNewRadius(Number(e.target.value))}
                className={darkInputClass}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
