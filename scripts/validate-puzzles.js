import { puzzles } from "../src/puzzles.js";
import { POSITIONS, enumerateSolutions, forcedMoves, satisfiesClue, validateClueShape, visibleClueIds } from "../src/engine.js";

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

function validatePuzzle(puzzle) {
  const errors = [];
  assert(puzzle.characters.length === 16, "must contain 16 characters", errors);
  assert(puzzle.solution.length === 16, `solution has ${puzzle.solution.length} entries`, errors);
  assert(new Set(puzzle.characters.map((character) => character.position)).size === 16, "character positions are not unique", errors);
  assert(new Set(puzzle.clues.map((clue) => clue.id)).size === puzzle.clues.length, "clue IDs are not unique", errors);
  puzzle.clues.forEach((clue) => validateClueShape(clue, puzzle).forEach((error) => errors.push(`${clue.id}: ${error}`)));
  const clueIds = new Set(puzzle.clues.map((clue) => clue.id));
  puzzle.openingClues.forEach((id) => assert(clueIds.has(id), `missing opening clue ${id}`, errors));
  Object.entries(puzzle.reveals).forEach(([position, ids]) => {
    assert(POSITIONS.includes(position), `unknown reveal position ${position}`, errors);
    ids.forEach((id) => assert(clueIds.has(id), `missing revealed clue ${id}`, errors));
  });
  puzzle.clues.forEach((clue) => assert(satisfiesClue(puzzle.solution, clue, puzzle.characters), `intended solution violates ${clue.id}: ${clue.text}`, errors));

  const finalSolutions = enumerateSolutions(puzzle);
  assert(finalSolutions.length === 1, `expected one solution, found ${finalSolutions.length}`, errors);
  if (finalSolutions.length === 1) assert(finalSolutions[0].join("") === puzzle.solution.join(""), "unique solution does not match intended solution", errors);

  const assignments = {};
  puzzle.intendedPath.forEach((position, step) => {
    const moves = forcedMoves(puzzle, assignments);
    assert(moves.length > 0, `stalls before intended step ${step + 1} (${position})`, errors);
    const move = moves.find((item) => item.position === position);
    assert(Boolean(move), `${position} is not supported at intended step ${step + 1}; supported: ${moves.map((item) => item.position).join(", ") || "none"}`, errors);
    if (move) assignments[position] = move.team;
  });
  assert(Object.keys(assignments).length === 16, `intended path completes only ${Object.keys(assignments).length} assignments`, errors);

  // Explore every state reachable by accepting any currently supported move.
  const queue = [{}];
  const visited = new Set();
  while (queue.length) {
    const state = queue.shift();
    const key = POSITIONS.filter((position) => state[position]).sort().join(",");
    if (visited.has(key)) continue;
    visited.add(key);
    const assignedCount = Object.keys(state).length;
    if (assignedCount === 16) continue;
    const moves = forcedMoves(puzzle, state);
    assert(moves.length > 0, `reachable state stalls after: ${key || "opening"}`, errors);
    moves.forEach((move) => queue.push({ ...state, [move.position]: move.team }));
  }

  const allVisibleAtEnd = visibleClueIds(puzzle, assignments);
  assert(allVisibleAtEnd.length === puzzle.clues.length, `only ${allVisibleAtEnd.length}/${puzzle.clues.length} clues can be revealed`, errors);
  return { errors, states: visited.size, solutions: finalSolutions.length };
}

let failed = false;
console.log("Which Side? exhaustive puzzle validation\n");
for (const puzzle of puzzles) {
  const result = validatePuzzle(puzzle);
  const label = `${puzzle.number}. ${puzzle.title}`;
  if (result.errors.length) {
    failed = true;
    console.error(`FAIL ${label}`);
    result.errors.forEach((error) => console.error(`  - ${error}`));
  } else {
    console.log(`PASS ${label}: unique solution, ${result.states} reachable deduction states, no stalls`);
  }
}

if (failed) process.exitCode = 1;
else console.log("\nAll 8 handcrafted puzzles passed every validation check.");
