import test from "node:test";
import assert from "node:assert/strict";
import { puzzles } from "../src/puzzles.js";
import { TEAM, evaluateChoice, forcedMoves } from "../src/engine.js";

test("unsupported choices are distinguished from contradictions", () => {
  const puzzle = puzzles[0];
  assert.equal(evaluateChoice(puzzle, {}, "B4", TEAM.PLAINTIFF).status, "unsupported");
  const wrong = evaluateChoice(puzzle, {}, "A1", TEAM.DEFENDANT);
  assert.equal(wrong.status, "contradiction");
  assert.deepEqual(wrong.proofIds, ["p1-01"]);
});

test("accepted moves follow the visible deduction chain", () => {
  const puzzle = puzzles[0];
  const assignments = {};
  for (const position of puzzle.intendedPath) {
    const move = forcedMoves(puzzle, assignments).find((candidate) => candidate.position === position);
    assert.ok(move, `${position} should be supported`);
    assert.equal(evaluateChoice(puzzle, assignments, position, move.team).status, "accepted");
    assignments[position] = move.team;
  }
  assert.equal(Object.keys(assignments).length, 16);
});

test("every puzzle rejects the opposite of an established opening move", () => {
  puzzles.forEach((puzzle) => {
    const move = forcedMoves(puzzle, {})[0];
    assert.ok(move, `${puzzle.title} needs an opening move`);
    const opposite = move.team === TEAM.PLAINTIFF ? TEAM.DEFENDANT : TEAM.PLAINTIFF;
    assert.equal(evaluateChoice(puzzle, {}, move.position, opposite).status, "contradiction");
  });
});
