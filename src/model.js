import {
  measurementWarnings,
  measurementFingerprint,
} from "./measurement-checks.js";
import { toSqFt, fromSqFt } from "./pricing.js";
export const freshRoom = () => ({
  id:
    globalThis.crypto?.randomUUID?.() || `room-${Date.now()}-${Math.random()}`,
  name: "",
  category: "residential",
  measurement: "dimensions",
  length: 0,
  width: 0,
  area: 0,
  ceiling: "standard",
  fixtures: "standard",
  floor: "tile",
});
export const initialState = () => ({
  step: 0,
  mode: "project",
  category: "residential",
  name: "",
  budget: 0,
  referredBy: "",
  expectations: "",
  concerns: "",
  additionalInfo: "",
  city: "",
  province: "QC",
  context: "new",
  cleanDate: "",
  handoverDate: "",
  occupied: false,
  measurementConfirmation: "",
  phases: ["final"],
  options: [],
  unit: "ft2",
  area: 0,
  gross: 0,
  common: 0,
  floors: 1,
  units: 1,
  washrooms: 0,
  kitchens: 0,
  glazing: 0,
  ceiling: "standard",
  fixtures: "standard",
  floor: "tile",
  visits: 1,
  rooms: [freshRoom()],
  conditions: {
    dust: "moderate",
    debris: "low",
    residue: "none",
    sensitivity: "standard",
    water: "yes",
    power: "yes",
    elevator: "yes",
    loading: "easy",
    hours: "normal",
    highReach: "no",
    urgency: "normal",
    access: "normal",
  },
});
export const roomSqft = (room) =>
  room.measurement === "area" ? room.area : room.length * room.width;
export const totalSqft = (state) =>
  state.mode === "room"
    ? state.rooms.reduce((sum, room) => sum + roomSqft(room), 0)
    : state.area;
export function estimateInput(state) {
  return {
    phases: [...state.phases],
    areas:
      state.mode === "room"
        ? state.rooms.map((r) => ({
            sqft: roomSqft(r),
            category: r.category,
            ceiling: r.ceiling,
            fixtures: r.fixtures,
            floor: r.floor,
          }))
        : [
            {
              sqft: state.area,
              category: state.category,
              ceiling: state.ceiling,
              fixtures: state.fixtures,
              floor: state.floor,
            },
          ],
    conditions: { ...state.conditions },
    options: [...state.options],
    visits: state.visits,
    washrooms: state.washrooms,
    kitchens: state.kitchens,
    glazingSqFt: state.glazing,
    occupied: state.occupied,
  };
}
export function validateStep(state, step) {
  if (step === 0) {
    if (!state.city.trim()) return { field: "city", message: "missingCity" };
    if (
      state.cleanDate &&
      state.handoverDate &&
      state.cleanDate > state.handoverDate
    )
      return { field: "handoverDate", message: "dateError" };
  }
  if (step === 1 && !state.phases.length)
    return { field: "phases", message: "phaseError" };
  if (step === 2) {
    if (
      state.mode === "room" &&
      (!state.rooms.length ||
        state.rooms.some(
          (r) =>
            !r.name.trim() || !Number.isFinite(roomSqft(r)) || roomSqft(r) <= 0
        ))
    )
      return { field: "rooms", message: "roomError" };
    if (
      !Number.isFinite(totalSqft(state)) ||
      totalSqft(state) <= 0 ||
      totalSqft(state) > 10000000
    )
      return { field: "area", message: "areaError" };
    if (
      state.mode === "project" &&
      ((state.gross > 0 && state.area > state.gross) ||
        state.common > state.area)
    )
      return { field: "gross", message: "grossError" };
    if (
      measurementWarnings(state).length &&
      state.measurementConfirmation !== measurementFingerprint(state)
    )
      return { field: "measurementConfirmation", message: "plausibilityError" };
  }
  return null;
}
export function sampleState(language = "en") {
  const s = initialState();
  Object.assign(s, {
    mode: "room",
    name: "Sample · 1,500 sq ft condominium",
    city: "Montréal",
    kitchens: 1,
    washrooms: 2,
    area: 1500,
  });
  s.rooms = [
    ["Living / dining", 24, 18],
    ["Kitchen", 16, 12],
    ["Primary bedroom", 18, 12],
    ["Bedroom 2", 16, 12],
    ["Bathroom 1", 8, 12],
    ["Bathroom 2", 10, 6],
    ["Corridor", 16, 6],
    ["Laundry", 10, 6],
    ["Storage", 10, 6],
    ["Walk-in closet", 8, 12],
  ].map(([name, length, width]) => ({
    ...freshRoom(),
    name,
    length,
    width,
    category: name === "Corridor" ? "common" : "residential",
  }));
  if (language === "fr") {
    s.name = "Exemple · condominium de 1 500 pi²";
    const labels = [
      "Séjour / salle à manger",
      "Cuisine",
      "Chambre principale",
      "Chambre 2",
      "Salle de bain 1",
      "Salle de bain 2",
      "Corridor",
      "Buanderie",
      "Rangement",
      "Penderie",
    ];
    s.rooms.forEach((room, index) => {
      room.name = labels[index];
    });
  }
  return s;
}
// Restored data is treated as untrusted input and constrained to the editable model.
export function restoreState(raw) {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (
    !parsed ||
    parsed.version !== 1 ||
    !parsed.scope ||
    typeof parsed.scope !== "object"
  )
    throw new Error("Invalid saved scope");
  const base = initialState(),
    source = parsed.scope;
  for (const key of Object.keys(base)) {
    if (typeof base[key] === "string" && typeof source[key] === "string")
      base[key] = source[key].slice(0, ["expectations","concerns","additionalInfo"].includes(key) ? 2000 : 250);
    if (typeof base[key] === "number" && Number.isFinite(source[key]))
      base[key] = Math.max(0, Math.min(10000000, source[key]));
    if (typeof base[key] === "boolean" && typeof source[key] === "boolean")
      base[key] = source[key];
  }
  base.mode = base.mode === "room" ? "room" : "project";
  base.unit = base.unit === "m2" ? "m2" : "ft2";
  base.province = base.province === "ON" ? "ON" : "QC";
  base.phases = Array.isArray(source.phases)
    ? [
        ...new Set(
          source.phases.filter((v) => ["rough", "final", "touchup"].includes(v))
        ),
      ]
    : ["final"];
  base.options = Array.isArray(source.options)
    ? [
        ...new Set(
          source.options.filter(
            (v) => typeof v === "string" && /^[a-zA-Z]{1,20}$/.test(v)
          )
        ),
      ]
    : [];
  for (const key of Object.keys(base.conditions))
    if (
      typeof source.conditions?.[key] === "string" &&
      /^[a-zA-Z]{1,20}$/.test(source.conditions[key])
    )
      base.conditions[key] = source.conditions[key];
  if (
    Array.isArray(source.rooms) &&
    source.rooms.length &&
    source.rooms.length <= 250
  )
    base.rooms = source.rooms.map((sourceRoom) => {
      const room = freshRoom();
      for (const key of Object.keys(room)) {
        if (key === "id") continue;
        if (
          typeof room[key] === "string" &&
          typeof sourceRoom[key] === "string"
        )
          room[key] = sourceRoom[key].slice(0, 150);
        if (typeof room[key] === "number" && Number.isFinite(sourceRoom[key]))
          room[key] = Math.max(0, Math.min(10000000, sourceRoom[key]));
      }
      return room;
    });
  base.step = 0;
  return base;
}
export const serializeScope = (state) =>
  JSON.stringify({ version: 1, scope: { ...state, referredBy:"", expectations:"", concerns:"", additionalInfo:"", step: 0 } });
export const displayArea = (sqft, unit) =>
  Math.round(fromSqFt(sqft, unit) * 100) / 100 || "";
export const parseArea = (value, unit) => toSqFt(Number(value) || 0, unit);
export const displayLength = (ft, unit) =>
  Math.round(ft * (unit === "m2" ? 0.3048 : 1) * 100) / 100 || "";
export const parseLength = (value, unit) =>
  (Number(value) || 0) / (unit === "m2" ? 0.3048 : 1);
