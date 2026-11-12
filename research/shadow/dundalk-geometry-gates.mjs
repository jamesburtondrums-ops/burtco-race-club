export const DUNDALK_GEOMETRY = Object.freeze({
  "6f": Object.freeze({ firstBendYards: 284, bends: 1, direction: "left-handed", character: "sharp, almost level" }),
  "7f": Object.freeze({ firstBendYards: 504, bends: 1, direction: "left-handed", character: "sharp, almost level" }),
  "1m": Object.freeze({ firstBendYards: 708, bends: 1, direction: "left-handed", character: "sharp, almost level" })
});

export const DUNDALK_GEOMETRY_SOURCE = "https://www.racemetrics.co.uk/help/racecourse-profiles/dundalk-racecourse-profile";

export function getDundalkGeometry(trip) {
  const geometry = DUNDALK_GEOMETRY[trip];
  return geometry ? { ...geometry, sourceUrl: DUNDALK_GEOMETRY_SOURCE } : null;
}

// Geometry is descriptive only. It must not create a draw or pace score by itself.
export function evaluateDrawPaceEvidence({ trip, draw, fieldSize, paceStyle, stratifiedSampleSize = 0, minimumSampleSize = 40 }) {
  const geometry = getDundalkGeometry(trip);
  if (!geometry || !Number.isInteger(draw) || !Number.isInteger(fieldSize) || draw < 1 || draw > fieldSize) {
    return { status: "insufficient_or_invalid_inputs", adjustment: 0, applyAdjustment: false, geometry };
  }
  if (!paceStyle || !["front_running", "prominent", "held_up", "mid_division"].includes(paceStyle)) {
    return { status: "pace_style_unknown", adjustment: 0, applyAdjustment: false, geometry };
  }
  if (!Number.isInteger(stratifiedSampleSize) || stratifiedSampleSize < minimumSampleSize) {
    return { status: "hypothesis_only_insufficient_stratified_sample", adjustment: 0, applyAdjustment: false, geometry };
  }
  // The roadmap requires 40+ comparable races before bias estimation. Passing
  // that gate only permits a separate estimation experiment; it never adds a bonus.
  return { status: "eligible_for_estimation_not_scoring", adjustment: 0, applyAdjustment: false, geometry };
}

// One race's in-running comment is not a habitual pace profile.
export function inferHabitualPaceStyle(runObservations, { minimumDistinctRaces = 3, minimumShare = 0.6 } = {}) {
  if (!Array.isArray(runObservations)) return { status: "unknown", style: null, distinctRaces: 0 };
  const valid = runObservations.filter(x => x && x.raceId && ["front_running", "prominent", "held_up", "mid_division"].includes(x.style));
  const byRace = new Map();
  for (const item of valid) if (!byRace.has(item.raceId)) byRace.set(item.raceId, item.style);
  const styles = [...byRace.values()];
  if (styles.length < minimumDistinctRaces) return { status: "unknown_insufficient_runs", style: null, distinctRaces: styles.length };
  const counts = new Map();
  for (const style of styles) counts.set(style, (counts.get(style) || 0) + 1);
  const [style, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const share = count / styles.length;
  if (share < minimumShare) return { status: "mixed_style", style: null, distinctRaces: styles.length, leadingShare: share };
  return { status: "supported_habitual_style", style, distinctRaces: styles.length, leadingShare: share };
}

// Incident tags remain factual annotations. No automatic pounds/score adjustment.
export function incidentImpactGate(incident) {
  if (!incident || typeof incident.category !== "string" || !incident.sourceUrl || !incident.observedAt) {
    return { status: "unverified_incident", adjustment: 0, applyAdjustment: false };
  }
  return { status: "verified_annotation_only", adjustment: 0, applyAdjustment: false };
}
