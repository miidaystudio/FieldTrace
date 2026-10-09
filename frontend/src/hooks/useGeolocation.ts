import { useState, useEffect } from 'react';

export interface GeolocationState {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    heading: number | null;
    speed: number | null;
  } | null;
  timestamp: number | null;
  error: string | null;
  isMock: boolean;
}

export function useGeolocation(enableRealGps = false) {
  const [geoState, setGeoState] = useState<GeolocationState>({
    coords: {
      latitude: 37.7897,
      longitude: -122.3972,
      accuracy: 3.5,
      altitude: 18,
      heading: 142,
      speed: 8.2,
    },
    timestamp: Date.now(),
    error: null,
    isMock: true,
  });

  useEffect(() => {
    if (!enableRealGps || !navigator.geolocation) {
      // Keep realistic simulated GPS location
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGeoState({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed,
          },
          timestamp: position.timestamp,
          error: null,
          isMock: false,
        });
      },
      (error) => {
        setGeoState((prev) => ({
          ...prev,
          error: error.message,
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enableRealGps]);

  return geoState;
}
