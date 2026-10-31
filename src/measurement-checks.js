// Review thresholds, not pricing rules or proof that an entered number is wrong.
export const MEASUREMENT_GUARDS = {
  residentialProjectPerUnit: { min: 200, max: 8000 },
  otherProject: { min: 100, max: 250000 },
  residentialRoom: { min: 20, max: 1500 },
  otherRoom: { min: 15, max: 25000 },
  minCleanableShareOfGross: 0.08,
  minAreaPerKitchenOrWashroom: 25,
};
export function measurementWarnings(scope) {
  const warnings = [],
    areas =
      scope.mode === "room"
        ? scope.rooms.map((room) => ({
            name: room.name,
            category: room.category,
            area:
              room.measurement === "area"
                ? room.area
                : room.length * room.width,
          }))
        : [{ name: scope.name, category: scope.category, area: scope.area }];
  const total = areas.reduce((sum, a) => sum + a.area, 0);
  for (const a of areas) {
    if (!Number.isFinite(a.area) || a.area <= 0) continue;
    const perUnit = scope.mode === "project" && a.category === "residential";
    const area = perUnit ? a.area / Math.max(1, scope.units || 1) : a.area;
    const limits =
      scope.mode === "room"
        ? a.category === "residential"
          ? MEASUREMENT_GUARDS.residentialRoom
          : MEASUREMENT_GUARDS.otherRoom
        : perUnit
        ? MEASUREMENT_GUARDS.residentialProjectPerUnit
        : MEASUREMENT_GUARDS.otherProject;
    if (area < limits.min || area > limits.max)
      warnings.push({
        code: area < limits.min ? "small" : "large",
        name: a.name || "",
        area: a.area,
        perUnit,
        units: scope.units || 1,
        suggestion: area < limits.min ? a.area * 10 : a.area / 10,
      });
  }
  if (
    scope.mode === "project" &&
    scope.gross > 0 &&
    scope.area > 0 &&
    scope.area / scope.gross < MEASUREMENT_GUARDS.minCleanableShareOfGross
  )
    warnings.push({ code: "grossShare", area: scope.area, gross: scope.gross });
  if (
    total > 0 &&
    scope.kitchens + scope.washrooms > 0 &&
    total / (scope.kitchens + scope.washrooms) <
      MEASUREMENT_GUARDS.minAreaPerKitchenOrWashroom
  )
    warnings.push({
      code: "fixtures",
      area: total,
      count: scope.kitchens + scope.washrooms,
    });
  return warnings;
}
export function measurementFingerprint(scope) {
  const value = JSON.stringify([
    scope.mode,
    scope.unit,
    scope.category,
    scope.units,
    scope.area,
    scope.gross,
    scope.common,
    scope.kitchens,
    scope.washrooms,
    scope.rooms.map((r) => [
      r.category,
      r.measurement,
      r.length,
      r.width,
      r.area,
    ]),
  ]);
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return "v1-" + (hash >>> 0).toString(16);
}
export function measurementWarningText(warning, language = "en", unit = "ft2") {
  const fr = language === "fr",
    fmt = (n) =>
      new Intl.NumberFormat(fr ? "fr-CA" : "en-CA", {
        maximumFractionDigits: 2,
      }).format(unit === "m2" ? n * 0.09290304 : n),
    label = unit === "m2" ? "m²" : fr ? "pi²" : "sq ft";
  if (warning.code === "grossShare")
    return fr
      ? `La superficie à nettoyer (${fmt(
          warning.area
        )} ${label}) représente moins de 8 % de la superficie brute. Confirmez qu’il s’agit d’une portée partielle et vérifiez les unités.`
      : `The cleanable area (${fmt(
          warning.area
        )} ${label}) is under 8% of the gross area. Confirm a partial scope and check the units.`;
  if (warning.code === "fixtures")
    return fr
      ? `${warning.count} cuisines/salles de bain pour ${fmt(
          warning.area
        )} ${label} : vérifiez le nombre et la superficie.`
      : `${warning.count} kitchens/washrooms for ${fmt(
          warning.area
        )} ${label}: check the quantities and area.`;
  return fr
    ? `${warning.name ? warning.name + " : " : ""}${fmt(
        warning.area
      )} ${label}${
        warning.perUnit ? ` pour ${warning.units} unité(s)` : ""
      } semble ${
        warning.code === "small" ? "petit" : "grand"
      } pour cette sélection. Un zéro manque-t-il ou est-il en trop (p. ex. ${fmt(
        warning.suggestion
      )} ${label})? Vérifiez les unités et la portée.`
    : `${warning.name ? warning.name + ": " : ""}${fmt(warning.area)} ${label}${
        warning.perUnit ? ` across ${warning.units} unit(s)` : ""
      } looks ${
        warning.code === "small" ? "small" : "large"
      } for this selection. Could a zero be missing or extra (for example, ${fmt(
        warning.suggestion
      )} ${label})? Check the units and scope.`;
}
