import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/store";

let loading = null;
function loadMaps(key) {
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      window.__rcMapsReady = () => resolve(window.google.maps);
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__rcMapsReady&loading=async`;
      s.async = true;
      s.onerror = () => {
        loading = null;
        reject(new Error("The map didn't load. Check your connection and try again."));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

// Google map with a draggable pin. Tapping the map also moves the pin.
// A Google Maps share link can be pasted instead.
export default function MapPin({ mapsKey, pin, onPin }) {
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const onPinRef = useRef(onPin);
  onPinRef.current = onPin;
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const hasPin = !!pin;

  useEffect(() => {
    if (!mapsKey || !hasPin || map.current) return undefined;
    let gone = false;
    loadMaps(mapsKey)
      .then((g) => {
        if (gone || map.current || !box.current) return;
        map.current = new g.Map(box.current, { center: pin, zoom: 17, disableDefaultUI: true, zoomControl: true, gestureHandling: "greedy", clickableIcons: false });
        marker.current = new g.Marker({ position: pin, map: map.current, draggable: true });
        const move = (latLng) => onPinRef.current({ lat: latLng.lat(), lng: latLng.lng() });
        marker.current.addListener("dragend", (e) => move(e.latLng));
        map.current.addListener("click", (e) => {
          marker.current.setPosition(e.latLng);
          move(e.latLng);
        });
      })
      .catch((e) => setError(e.message));
    return () => {
      gone = true;
    };
    // The map is created once; later pin changes are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsKey, hasPin]);

  useEffect(() => {
    if (!marker.current || !pin) return;
    const p = marker.current.getPosition();
    if (p && Math.abs(p.lat() - pin.lat) < 1e-7 && Math.abs(p.lng() - pin.lng) < 1e-7) return;
    marker.current.setPosition(pin);
    map.current.panTo(pin);
  }, [pin]);

  const useLink = async () => {
    if (!link.trim()) return;
    setBusy(true);
    setError("");
    try {
      const p = await api(`/api/store/map-link?url=${encodeURIComponent(link.trim())}`);
      onPin({ lat: p.lat, lng: p.lng });
      setLink("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4">
      {mapsKey ? (
        <>
          <div ref={box} className="h-72 w-full border border-white/15 bg-white/5" />
          <p className="mt-2 text-xs text-paper/50">Drag the pin or tap the map to set exactly where the rider should go.</p>
        </>
      ) : (
        <p className="text-xs text-paper/50">The map isn't available right now. Paste a Google Maps pin below, or use your current location.</p>
      )}
      <div className="mt-3 flex gap-2">
        <input className="field flex-1" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Or paste a Google Maps pin link" maxLength={500} />
        <button type="button" className="btn-outline px-4" onClick={useLink} disabled={busy || !link.trim()}>{busy ? "…" : "Use"}</button>
      </div>
      {error && <p className="mt-2 text-sm text-red-brand">{error}</p>}
    </div>
  );
}
