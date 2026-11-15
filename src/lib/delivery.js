// Delivery area and fee rules, shared by the checkout page and the worker so both quote the same fee.
// Fees follow Maxim's Cebu bike-delivery tariff. City boundaries are OpenStreetMap's Cebu City and
// Mandaue City outlines ([lng, lat] rings).
import AREAS from "./cebuCities.js";

export const COD_MAX = 500;
export const ROAD_FACTOR = 1.25;
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

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// City: ₱10 covers 0.22 km, ₱23/km up to 1 km, ₱10/km up to 6 km, ₱9/km after.
export function cityFee(km) {
  return Math.round(10 + 23 * clamp(km - 0.22, 0, 0.78) + 10 * clamp(km - 1, 0, 5) + 9 * Math.max(0, km - 6));
}

// Intercity (one way): ₱35 covers 1 km, ₱15/km after.
export function intercityFee(km) {
  return Math.round(35 + 15 * Math.max(0, km - 1));
}

// Fee and rules for a pin. intercity orders must be paid online (no COD) and stay within INTERCITY_MAX_KM.
export function deliveryQuote(store, lat, lng) {
  const km = Math.round(distanceKm(store.latitude, store.longitude, lat, lng) * 10) / 10;
  const area = deliveryArea(lat, lng);
  const intercity = !area;
  return {
    km,
    area,
    intercity,
    tooFar: intercity && km > INTERCITY_MAX_KM,
    fee: intercity ? intercityFee(km) : cityFee(km),
  };
}

export const codAllowed = (total) => total <= COD_MAX + 0.001;
