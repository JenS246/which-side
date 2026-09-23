export const TEAM = Object.freeze({ PLAINTIFF: "P", DEFENDANT: "D" });
export const POSITIONS = [
  "A1", "B1", "C1", "D1",
  "A2", "B2", "C2", "D2",
  "A3", "B3", "C3", "D3",
  "A4", "B4", "C4", "D4",
];

const positionIndex = Object.fromEntries(POSITIONS.map((position, index) => [position, index]));
const allTeams = Array.from({ length: 65536 }, (_, mask) => POSITIONS.map((__, index) => (mask & (1 << index) ? TEAM.PLAINTIFF : TEAM.DEFENDANT)));
const cluePassCache = new WeakMap();

export function teamName(team) {
  return team === TEAM.PLAINTIFF ? "Plaintiff Team" : "Defendant Team";
}

export function indicesForGroup(clue, characters) {
  if (clue.group === "positions") return clue.positions.map((position) => positionIndex[position]);
  if (clue.group === "row") return POSITIONS.map((position, index) => ({ position, index })).filter(({ position }) => Number(position[1]) === clue.value).map(({ index }) => index);
  if (clue.group === "column") return POSITIONS.map((position, index) => ({ position, index })).filter(({ position }) => position[0] === clue.value).map(({ index }) => index);
  if (clue.group === "corners") return [0, 3, 12, 15];
  if (clue.group === "role") return characters.map((character, index) => ({ character, index })).filter(({ character }) => character.role === clue.value).map(({ index }) => index);
  if (clue.group === "neighbors") return neighborIndices(positionIndex[clue.value]);
  if (clue.group === "beside") {
    const index = positionIndex[clue.value];
    const col = index % 4;
    return [col > 0 ? index - 1 : -1, col < 3 ? index + 1 : -1].filter((value) => value >= 0);
  }
  throw new Error(`Unknown group: ${clue.group}`);
}

export function neighborIndices(index) {
  const row = Math.floor(index / 4);
  const col = index % 4;
  const result = [];
  for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
    for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
      if (rowDelta === 0 && colDelta === 0) continue;
      const nextRow = row + rowDelta;
      const nextCol = col + colDelta;
      if (nextRow >= 0 && nextRow < 4 && nextCol >= 0 && nextCol < 4) result.push(nextRow * 4 + nextCol);
    }
  }
  return result;
}

export function satisfiesClue(teams, clue, characters) {
  switch (clue.type) {
    case "direct":
      return teams[positionIndex[clue.position]] === clue.team;
    case "same":
      return teams[positionIndex[clue.a]] === teams[positionIndex[clue.b]];
    case "opposite":
      return teams[positionIndex[clue.a]] !== teams[positionIndex[clue.b]];
    case "count": {
      const indices = indicesForGroup(clue, characters);
      return indices.filter((index) => teams[index] === clue.team).length === clue.count;
    }
    case "belowOpposite": {
      const upper = positionIndex[clue.position];
      return teams[upper] !== teams[upper + 4];
    }
    default:
      throw new Error(`Unknown clue type: ${clue.type}`);
  }
}

export function enumerateSolutions(puzzle, clueIds = puzzle.clues.map((clue) => clue.id), assignments = {}) {
  const active = clueIds.map((id) => puzzle.clues.find((clue) => clue.id === id));
  let puzzleCache = cluePassCache.get(puzzle);
  if (!puzzleCache) {
    puzzleCache = new Map();
    cluePassCache.set(puzzle, puzzleCache);
  }
  active.forEach((clue) => {
    if (!puzzleCache.has(clue.id)) puzzleCache.set(clue.id, Uint8Array.from(allTeams, (teams) => satisfiesClue(teams, clue, puzzle.characters) ? 1 : 0));
  });
  const results = [];
  for (let mask = 0; mask < 65536; mask += 1) {
    const assignmentsMatch = Object.entries(assignments).every(([position, team]) => Boolean(mask & (1 << positionIndex[position])) === (team === TEAM.PLAINTIFF));
    if (assignmentsMatch && active.every((clue) => puzzleCache.get(clue.id)[mask])) results.push(allTeams[mask]);
  }
  return results;
}

export function visibleClueIds(puzzle, assignments) {
  const ids = new Set(puzzle.openingClues);
  Object.keys(assignments).forEach((position) => (puzzle.reveals[position] || []).forEach((id) => ids.add(id)));
  return [...ids];
}

export function forcedMoves(puzzle, assignments) {
  const clueIds = visibleClueIds(puzzle, assignments);
  const solutions = enumerateSolutions(puzzle, clueIds, assignments);
  if (!solutions.length) return [];
  return POSITIONS.flatMap((position, index) => {
    if (assignments[position]) return [];
    const first = solutions[0][index];
    return solutions.every((solution) => solution[index] === first) ? [{ position, team: first }] : [];
  });
}

export function proofForMove(puzzle, assignments, position, team) {
  const clueIds = visibleClueIds(puzzle, assignments);
  const targetIndex = positionIndex[position];
  const contradictingTeam = team === TEAM.PLAINTIFF ? TEAM.DEFENDANT : TEAM.PLAINTIFF;
  const relevant = clueIds.filter((id) => {
    const clue = puzzle.clues.find((item) => item.id === id);
    if (clue.type === "direct") return clue.position === position;
    if (["same", "opposite"].includes(clue.type)) return [clue.a, clue.b].includes(position);
    if (clue.type === "belowOpposite") return [clue.position, POSITIONS[positionIndex[clue.position] + 4]].includes(position);
    if (clue.type === "count") return indicesForGroup(clue, puzzle.characters).includes(targetIndex);
    return false;
  });
  const ordered = [...relevant, ...clueIds.filter((id) => !relevant.includes(id))];
  for (const id of ordered) {
    if (enumerateSolutions(puzzle, [id], { ...assignments, [position]: contradictingTeam }).length === 0) return [id];
  }
  for (let a = 0; a < ordered.length; a += 1) {
    for (let b = a + 1; b < ordered.length; b += 1) {
      if (enumerateSolutions(puzzle, [ordered[a], ordered[b]], { ...assignments, [position]: contradictingTeam }).length === 0) return [ordered[a], ordered[b]];
    }
  }
  return clueIds;
}

export function evaluateChoice(puzzle, assignments, position, team) {
  const solutions = enumerateSolutions(puzzle, visibleClueIds(puzzle, assignments), assignments);
  const index = positionIndex[position];
  const possibleTeams = new Set(solutions.map((solution) => solution[index]));
  if (possibleTeams.size > 1) return { status: "unsupported" };
  const established = [...possibleTeams][0];
  if (established !== team) return { status: "contradiction", proofIds: proofForMove(puzzle, assignments, position, established) };
  return { status: "accepted", team: established };
}

export function validateClueShape(clue, puzzle) {
  const errors = [];
  const positions = new Set(POSITIONS);
  const teams = new Set(Object.values(TEAM));
  if (!["direct", "same", "opposite", "count", "belowOpposite"].includes(clue.type)) errors.push(`unknown type ${clue.type}`);
  if (clue.team && !teams.has(clue.team)) errors.push(`unknown team ${clue.team}`);
  [clue.position, clue.a, clue.b].filter(Boolean).forEach((position) => { if (!positions.has(position)) errors.push(`unknown position ${position}`); });
  if (clue.type === "count") {
    if (!["positions", "row", "column", "corners", "role", "neighbors", "beside"].includes(clue.group)) errors.push(`unknown group ${clue.group}`);
    try { indicesForGroup(clue, puzzle.characters); } catch (error) { errors.push(error.message); }
  }
  if (!clue.text || !clue.text.trim()) errors.push("missing text");
  return errors;
}
