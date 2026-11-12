import test from "node:test";
import assert from "node:assert/strict";
import {
  getDundalkGeometry,
  evaluateDrawPaceEvidence,
  inferHabitualPaceStyle,
  incidentImpactGate
} from "../research/shadow/dundalk-geometry-gates.mjs";

test("Dundalk 6f and 7f geometry is kept distinct", () => {
  assert.equal(getDundalkGeometry("6f").firstBendYards, 284);
  assert.equal(getDundalkGeometry("7f").firstBendYards, 504);
});

test("unknown trip does not invent geometry", () => {
  assert.equal(getDundalkGeometry("10f"), null);
});

test("one race result cannot create a draw/pace bonus", () => {
  const result = evaluateDrawPaceEvidence({ trip: "7f", draw: 5, fieldSize: 14, paceStyle: "prominent", stratifiedSampleSize: 1 });
  assert.equal(result.adjustment, 0);
  assert.equal(result.applyAdjustment, false);
  assert.equal(result.status, "hypothesis_only_insufficient_stratified_sample");
});

test("40 comparable races only permit estimation, not automatic scoring", () => {
  const result = evaluateDrawPaceEvidence({ trip: "6f", draw: 6, fieldSize: 8, paceStyle: "front_running", stratifiedSampleSize: 40 });
  assert.equal(result.adjustment, 0);
  assert.equal(result.applyAdjustment, false);
  assert.equal(result.status, "eligible_for_estimation_not_scoring");
});

test("habitual style requires three distinct races and 60% agreement", () => {
  assert.equal(inferHabitualPaceStyle([{ raceId: "a", style: "held_up" }]).status, "unknown_insufficient_runs");
  const result = inferHabitualPaceStyle([
    { raceId: "a", style: "held_up" },
    { raceId: "b", style: "held_up" },
    { raceId: "c", style: "prominent" }
  ]);
  assert.equal(result.status, "supported_habitual_style");
  assert.equal(result.style, "held_up");
});

test("mixed pace history remains unknown", () => {
  const result = inferHabitualPaceStyle([
    { raceId: "a", style: "held_up" },
    { raceId: "b", style: "front_running" },
    { raceId: "c", style: "prominent" }
  ]);
  assert.equal(result.status, "mixed_style");
  assert.equal(result.style, null);
});

test("incident annotations never apply automatic score adjustments", () => {
  const result = incidentImpactGate({ category: "slow_start", sourceUrl: "https://example.test", observedAt: "2026-11-12T09:20:19Z" });
  assert.equal(result.status, "verified_annotation_only");
  assert.equal(result.adjustment, 0);
  assert.equal(result.applyAdjustment, false);
});
