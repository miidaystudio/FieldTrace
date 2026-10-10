import React, { useState } from 'react';
import { useFleetStore } from '../../store/useFleetStore';
import { locationsApi } from '../../api/backend';
import { errorMessage } from '../../api/client';
import { FormError, inputClass } from '../auth/LoginPage';
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
          onClick={openCreate}
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
                    <Badge variant={geo.activeAgentsCount > 0 ? 'moving' : 'slate'} size="sm">
                      {geo.type}
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
        <div className="space-y-4 text-xs">
          <FormError message={createError} />
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
            <label className="block text-gray-300 font-semibold mb-1">Client Contact (optional)</label>
            <input
              type="text"
              placeholder="e.g. Biotech Global Distribution"
              value={newClient}
              onChange={(e) => setNewClient(e.target.value)}
              className="w-full bg-ops-card border border-ops-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-teal"
            />
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-1">Address (optional)</label>
            <input type="text" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-300 font-semibold mb-1">Latitude</label>
              <input type="number" step="0.00001" value={newLat} onChange={(e) => setNewLat(e.target.value)} className={inputClass + ' font-mono'} />
            </div>
            <div>
              <label className="block text-gray-300 font-semibold mb-1">Longitude</label>
              <input type="number" step="0.00001" value={newLng} onChange={(e) => setNewLng(e.target.value)} className={inputClass + ' font-mono'} />
            </div>
            <div>
              <label className="block text-gray-300 font-semibold mb-1">Radius (Meters)</label>
              <input
                type="number"
                min={10}
                max={5000}
                value={newRadius}
                onChange={(e) => setNewRadius(Number(e.target.value))}
                className={inputClass + ' font-mono'}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
