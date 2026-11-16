// Delivery area and fee rules, shared by the checkout page and the worker so both quote the same fee.
// Fees match Maxim's Cebu motorcycle prices by road distance. City boundaries are OpenStreetMap's
// Cebu City and Mandaue City outlines ([lng, lat] rings).
import AREAS from "./cebuCities.js";

export const COD_MAX = 500;
// Straight line to road distance, used only when Google's road distance isn't available.
export const ROAD_FACTOR = 1.3;
export const INTERCITY_MAX_KM = 30;
export const PAID_METHODS = ["maya", "maya_qr", "qrph"];
export const AREA_LABEL = { cebu_city: "Cebu City", mandaue: "Mandaue City" };

function inRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[j];
    if (y1 > lat !== y2 > lat && lng < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

// "cebu_city", "mandaue", or null when the pin is outside both cities.
export function deliveryArea(lat, lng) {
  for (const [name, rings] of Object.entries(AREAS)) {
    if (rings.some((r) => inRing(lng, lat, r))) return name;
  }
  return null;
}

export function distanceKm(aLat, aLng, bLat, bLng, roadFactor = ROAD_FACTOR) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h)) * roadFactor;
}

// ₱14 + ₱12/km for the first 6 road km, then ₱9.30/km (fitted to Maxim quotes, Nov 2026).
export function deliveryFee(km) {
  return Math.round(14 + 12 * Math.min(km, 6) + 9.3 * Math.max(0, km - 6));
}

// Fee and rules for a pin. roadKm is Google's road distance; without it the straight line is scaled
// by ROAD_FACTOR. Outside both cities orders must be paid online (no COD) and stay within INTERCITY_MAX_KM.
export function deliveryQuote(store, lat, lng, roadKm = null) {
  const km = Math.round((roadKm ?? distanceKm(store.latitude, store.longitude, lat, lng)) * 10) / 10;
  const area = deliveryArea(lat, lng);
  const intercity = !area;
  return {
    km,
    area,
    intercity,
    tooFar: intercity && km > INTERCITY_MAX_KM,
    fee: deliveryFee(km),
  };
}

export const codAllowed = (total) => total <= COD_MAX + 0.001;
