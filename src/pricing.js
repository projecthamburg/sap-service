// SAP Service Inc. — central pricing configuration. DEMO ASSUMPTIONS ONLY.
// Every value here is a fictional placeholder for the prototype; none represents SAP's commercial pricing.
// Administrators edit this file; the estimator imports it at runtime.
export const PRICING = {
  version: "demo-2026.10",
  currency: "CAD",
  loadedLaborRate: 46, // $/labour-hour, fully loaded (wages, CNESST/WSIB, supervision)
  crewSize: 4,
  hoursPerCrewDay: 8,
  // Production rates: cleanable sq ft per labour-hour, by phase and space type
  production: {
    rough: {
      default: 650,
      residential: 600,
      commercial: 700,
      hospitality: 550,
      fitness: 650,
      healthcare: 500,
      office: 700,
      common: 800,
      garage: 1800,
    },
    final: {
      default: 220,
      residential: 200,
      commercial: 240,
      hospitality: 170,
      fitness: 210,
      healthcare: 160,
      office: 240,
      common: 300,
      garage: 900,
    },
    touchup: {
      default: 800,
      residential: 750,
      commercial: 850,
      hospitality: 650,
      fitness: 800,
      healthcare: 600,
      office: 850,
      common: 1000,
      garage: 2500,
    },
  },
  // Fixed allowances per visit / per fixture
  fixtureHours: { washroom: 1.5, kitchen: 2.5 },
  glazingSqFtPerHour: 120,
  mobilizationHours: 3, // per visit, per crew
  travelPerVisit: 120,
  consumablesPerSqFt: 0.03,
  equipmentPerCrewDay: 85,
  disposalPerCrewDay: 140,
  overheadPct: 0.12,
  marginPct: 0.15,
  minimumCharge: 650,
  rangeSpread: 0.12, // ± on the midpoint
  // Multipliers on labour hours
  modifiers: {
    dust: { light: 1.0, moderate: 1.12, heavy: 1.3 },
    debris: { low: 1.0, moderate: 1.1, high: 1.25 },
    residue: { none: 1.0, some: 1.12, extensive: 1.3 },
    fixtures: { low: 0.95, standard: 1.0, high: 1.15 },
    ceiling: { standard: 1.0, high: 1.1, veryHigh: 1.25 }, // <10ft, 10–14ft, >14ft
    access: { normal: 1.0, restricted: 1.1, difficult: 1.2 },
    sensitivity: { standard: 1.0, delicate: 1.15 },
    urgency: { normal: 1.0, urgent: 1.2 },
    hours: { normal: 1.0, offHours: 1.12 },
    loading: { easy: 1.0, limited: 1.08 },
    floor: {
      tile: 1.0,
      hardwood: 1.05,
      vinyl: 1.0,
      concrete: 1.0,
      carpet: 1.08,
    },
    noElevator: 1.08,
    noWater: 1.05,
    noPower: 1.05,
    occupied: 1.08,
  },
  // Optional scope items: $ per sq ft of cleanable area, or flat $ per item
  options: {
    glazing: { type: "perSqFt", rate: 0.1, assess: false },
    tracks: { type: "perSqFt", rate: 0.04, assess: false },
    millwork: { type: "perSqFt", rate: 0.12, assess: false },
    fixtures: { type: "perSqFt", rate: 0.06, assess: false },
    floorScrub: { type: "perSqFt", rate: 0.14, assess: false },
    carpet: { type: "perSqFt", rate: 0.18, assess: true },
    adhesive: { type: "perSqFt", rate: 0.08, assess: true },
    highDust: { type: "perSqFt", rate: 0.07, assess: true },
    stairs: { type: "flat", rate: 420, assess: false },
    elevators: { type: "flat", rate: 380, assess: false },
    parking: { type: "perSqFt", rate: 0.05, assess: true },
    deficiency: { type: "flat", rate: 950, assess: false },
  },
};

export function phasesFor(sel) {
  if (!Array.isArray(sel)) return [];
  if (sel.includes("multi")) return ["rough", "final", "touchup"];
  return ["rough", "final", "touchup"].filter((p) => sel.includes(p));
}

// Core engine. Input: normalized sq ft, categories, phases, conditions, options. Returns transparent breakdown.
export function estimate(input, P = PRICING) {
  if (!input || !Array.isArray(input.areas) || !input.areas.length)
    throw new RangeError("At least one cleanable area is required.");
  if (
    input.areas.some(
      (a) => !Number.isFinite(a.sqft) || a.sqft <= 0 || a.sqft > 10000000
    )
  )
    throw new RangeError("Areas must be positive finite square feet.");
  for (const key of ["washrooms", "kitchens", "glazingSqFt", "visits"]) {
    if (
      input[key] !== undefined &&
      (!Number.isFinite(input[key]) || input[key] < 0)
    )
      throw new RangeError("Quantities must be finite and non-negative.");
  }
  const m = P.modifiers;
  const phases = phasesFor(input.phases);
  if (!phases.length)
    throw new RangeError("At least one cleaning phase is required.");
  const rows = [];
  let laborHours = 0;
  const cond = input.conditions || {};
  let mult =
    (m.dust[cond.dust] || 1) *
    (m.debris[cond.debris] || 1) *
    (m.residue[cond.residue] || 1) *
    (m.access[cond.access] || 1) *
    (m.sensitivity[cond.sensitivity] || 1) *
    (m.urgency[cond.urgency] || 1) *
    (m.hours[cond.hours] || 1);
  mult *= m.loading[cond.loading] || 1;
  if (cond.elevator === "no") mult *= m.noElevator;
  if (cond.water === "no") mult *= m.noWater;
  if (cond.power === "no") mult *= m.noPower;
  if (input.occupied) mult *= m.occupied;
  // areas: [{sqft, category, ceiling, fixtures, phases?}]
  for (const ph of phases) {
    let h = 0;
    for (const a of input.areas) {
      if (
        a.phases &&
        a.phases.length &&
        !a.phases.includes(ph) &&
        !a.phases.includes("multi")
      )
        continue;
      const rate = P.production[ph][a.category] || P.production[ph].default;
      h +=
        (a.sqft / rate) *
        (m.ceiling[a.ceiling] || 1) *
        (m.fixtures[a.fixtures] || 1) *
        (m.floor[a.floor] || 1);
    }
    if (ph === "final")
      h +=
        (input.washrooms || 0) * P.fixtureHours.washroom +
        (input.kitchens || 0) * P.fixtureHours.kitchen +
        (input.glazingSqFt || 0) / P.glazingSqFtPerHour;
    h *= mult;
    rows.push({ phase: ph, hours: h });
    laborHours += h;
  }
  const visits = Math.max(
    phases.length,
    Math.ceil(input.visits || phases.length)
  );
  laborHours += visits * P.mobilizationHours;
  const totalSqFt = input.areas.reduce((s, a) => s + a.sqft, 0);
  const crewDays = laborHours / (P.crewSize * P.hoursPerCrewDay);
  const labor = laborHours * P.loadedLaborRate;
  const equipment = Math.ceil(crewDays) * P.equipmentPerCrewDay;
  const disposal = Math.ceil(crewDays) * P.disposalPerCrewDay;
  const consumables = totalSqFt * P.consumablesPerSqFt * phases.length;
  const travel = visits * P.travelPerVisit;
  const optionRows = [];
  let optionsTotal = 0;
  for (const k of new Set(input.options || [])) {
    const o = P.options[k];
    if (!o) continue;
    const amt = o.type === "flat" ? o.rate : o.rate * totalSqFt;
    optionRows.push({ key: k, amount: amt, assess: o.assess });
    optionsTotal += amt;
  }
  const direct =
    labor + equipment + disposal + consumables + travel + optionsTotal;
  const overhead = direct * P.overheadPct;
  const margin = (direct + overhead) * P.marginPct;
  let mid = Math.max(P.minimumCharge, direct + overhead + margin);
  const phaseHours = rows.reduce((sum, r) => sum + r.hours, 0);
  const phaseCost = rows.map((r) => ({
    ...r,
    cost: phaseHours ? mid * (r.hours / phaseHours) : mid / rows.length,
  }));
  return {
    phases,
    rows: phaseCost,
    laborHours,
    crewSize: P.crewSize,
    crewDays,
    visits,
    totalSqFt,
    labor,
    equipment,
    disposal,
    consumables,
    travel,
    optionRows,
    optionsTotal,
    overhead,
    margin,
    minimumAdjustment: mid - direct - overhead - margin,
    mid,
    low: Math.max(P.minimumCharge, mid * (1 - P.rangeSpread)),
    high: mid * (1 + P.rangeSpread),
    perSqFt: mid / totalSqFt,
    multiplier: mult,
    needsAssessment:
      optionRows.some((o) => o.assess) ||
      cond.water === "no" ||
      cond.power === "no" ||
      cond.residue === "extensive" ||
      cond.highReach === "yes" ||
      input.areas.some((a) => a.ceiling === "veryHigh"),
  };
}
export const SQM_PER_SQFT = 0.09290304;
export const toSqFt = (v, unit) => (unit === "m2" ? v / SQM_PER_SQFT : v);
export const fromSqFt = (v, unit) => (unit === "m2" ? v * SQM_PER_SQFT : v);
