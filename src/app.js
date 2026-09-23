import { puzzles, getPuzzle } from "./puzzles.js";
import { TEAM, evaluateChoice, forcedMoves, proofForMove, teamName, visibleClueIds } from "./engine.js";

const STORAGE_KEY = "which-side-progress-v2";
const $ = (selector) => document.querySelector(selector);
const elements = {
  puzzleSelect: $("#puzzle-select"), level: $("#level-label"), caseNumber: $("#case-number"), difficulty: $("#difficulty-label"),
  title: $("#case-title"), summary: $("#case-summary"), progress: $("#progress"), board: $("#board"),
  clueList: $("#clue-list"), clueCount: $("#clue-count"), message: $("#message"), hint: $("#hint-button"),
  undo: $("#undo-button"), reset: $("#reset-button"), timerToggle: $("#timer-toggle"),
  timerReadout: $("#timer-readout"), dialog: $("#completion-dialog"), completionDetails: $("#completion-details"),
  shareResult: $("#share-result"), copy: $("#copy-button"), replay: $("#replay-button"), next: $("#next-button"),
  template: $("#character-template"),
};

let saved = loadSaved();
let puzzle = getPuzzle(saved.currentPuzzle);
let state = saved.games[puzzle.id] || freshState();
let messageTimeout;
let timerInterval;
let previousVisible = new Set();

function freshState() {
  return { assignments: {}, history: [], hints: 0, timerEnabled: false, startedAt: null, elapsed: 0, complete: false };
}

function loadSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed?.games) return parsed;
  } catch { /* Start fresh if saved data is unavailable. */ }
  return { currentPuzzle: puzzles[0].id, games: {} };
}

function save() {
  saved.currentPuzzle = puzzle.id;
  saved.games[puzzle.id] = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function currentElapsed() {
  if (!state.timerEnabled || !state.startedAt || state.complete) return state.elapsed || 0;
  return Math.floor((Date.now() - state.startedAt) / 1000) + (state.elapsed || 0);
}

function startTimer() {
  clearInterval(timerInterval);
  if (!state.timerEnabled || state.complete) return;
  if (!state.startedAt) state.startedAt = Date.now();
  timerInterval = setInterval(() => {
    elements.timerReadout.textContent = formatTime(currentElapsed());
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  if (state.startedAt) {
    state.elapsed = currentElapsed();
    state.startedAt = null;
  }
}

function showMessage(text, tone = "neutral") {
  clearTimeout(messageTimeout);
  elements.message.textContent = text;
  elements.message.dataset.tone = tone;
  elements.message.classList.add("is-visible");
  messageTimeout = setTimeout(() => elements.message.classList.remove("is-visible"), 4200);
}

function clueById(id) {
  return puzzle.clues.find((clue) => clue.id === id);
}

function renderPuzzleSelector() {
  elements.puzzleSelect.innerHTML = puzzles.map((item) => `<option value="${item.id}">${item.number}. ${item.title} - ${item.difficulty}</option>`).join("");
  elements.puzzleSelect.value = puzzle.id;
}

function renderClues() {
  const visible = visibleClueIds(puzzle, state.assignments);
  elements.clueList.innerHTML = "";
  puzzle.clues.filter((clue) => visible.includes(clue.id)).forEach((clue) => {
    const item = document.createElement("li");
    item.textContent = clue.text;
    if (!previousVisible.has(clue.id)) item.classList.add("new-clue");
    elements.clueList.append(item);
  });
  elements.clueCount.textContent = visible.length;
  elements.clueCount.setAttribute("aria-label", `${visible.length} visible clues`);
  previousVisible = new Set(visible);
}

function renderBoard() {
  elements.board.innerHTML = "";
  puzzle.characters.forEach((character, index) => {
    const fragment = elements.template.content.cloneNode(true);
    const card = fragment.querySelector(".character-card");
    const portrait = fragment.querySelector(".portrait");
    const plaintiffButton = fragment.querySelector(".plaintiff-choice");
    const defendantButton = fragment.querySelector(".defendant-choice");
    const assigned = state.assignments[character.position];
    const col = character.portrait % 4;
    const row = Math.floor(character.portrait / 4);
    card.dataset.position = character.position;
    if (assigned) card.dataset.team = assigned;
    portrait.style.backgroundPosition = `${col * (100 / 3)}% ${row * (100 / 3)}%`;
    portrait.setAttribute("aria-label", `Illustrated portrait of ${character.name}`);
    fragment.querySelector(".position").textContent = character.position;
    fragment.querySelector(".name").textContent = character.name;
    fragment.querySelector(".role").textContent = character.role;
    plaintiffButton.setAttribute("aria-label", `Assign ${character.name} in ${character.position} to the Plaintiff Team`);
    defendantButton.setAttribute("aria-label", `Assign ${character.name} in ${character.position} to the Defendant Team`);
    plaintiffButton.addEventListener("click", () => choose(character.position, TEAM.PLAINTIFF));
    defendantButton.addEventListener("click", () => choose(character.position, TEAM.DEFENDANT));
    plaintiffButton.addEventListener("keydown", (event) => activateChoiceFromKeyboard(event, character.position, TEAM.PLAINTIFF));
    defendantButton.addEventListener("keydown", (event) => activateChoiceFromKeyboard(event, character.position, TEAM.DEFENDANT));
    plaintiffButton.disabled = Boolean(assigned);
    defendantButton.disabled = Boolean(assigned);
    if (assigned) {
      const stamp = fragment.querySelector(".team-stamp");
      stamp.textContent = assigned === TEAM.PLAINTIFF ? "PLAINTIFF" : "DEFENDANT";
      stamp.setAttribute("aria-hidden", "false");
      fragment.querySelector(".seal-copy").textContent = (puzzle.reveals[character.position] || []).length ? "Clue added" : "File checked";
      card.setAttribute("aria-label", `${character.name}, ${character.role}, ${character.position}, assigned to the ${teamName(assigned)}`);
    }
    card.style.setProperty("--card-index", index);
    elements.board.append(fragment);
  });
}

function activateChoiceFromKeyboard(event, position, team) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  choose(position, team, true);
}

function renderHeader() {
  elements.level.textContent = puzzle.level;
  elements.caseNumber.textContent = `Case ${puzzle.number} of ${puzzles.length}`;
  elements.difficulty.textContent = `Logic ${puzzle.difficultyRank} of ${puzzles.length}: ${puzzle.difficulty}`;
  elements.title.textContent = puzzle.title;
  elements.summary.textContent = puzzle.summary;
  const assignedCount = Object.keys(state.assignments).length;
  elements.progress.textContent = `${assignedCount} of 16 assigned`;
  elements.undo.disabled = !state.history.length;
  elements.hint.disabled = assignedCount === 16;
  elements.timerToggle.checked = state.timerEnabled;
  elements.timerReadout.hidden = !state.timerEnabled;
  elements.timerReadout.textContent = formatTime(currentElapsed());
}

function render() {
  renderHeader();
  renderClues();
  renderBoard();
  save();
  startTimer();
}

function choose(position, team, focusBoard = false) {
  if (state.assignments[position]) return;
  const result = evaluateChoice(puzzle, state.assignments, position, team);
  if (result.status === "unsupported") {
    showMessage("There is not enough information for that choice yet.", "neutral");
    return;
  }
  if (result.status === "contradiction") {
    const conflict = result.proofIds.map((id) => clueById(id).text).join(" Also use: ");
    showMessage(`That conflicts with: ${conflict}`, "conflict");
    return;
  }
  if (state.timerEnabled && !state.startedAt && !state.complete) state.startedAt = Date.now();
  state.assignments[position] = team;
  state.history.push(position);
  showMessage(`${puzzle.characters.find((character) => character.position === position).name} joins the ${teamName(team)}.`, "success");
  if (state.history.length === 16) completePuzzle();
  render();
  if (focusBoard && !state.complete) elements.board.focus({ preventScroll: true });
}

function hintText(move) {
  const character = puzzle.characters.find((item) => item.position === move.position);
  const proofIds = proofForMove(puzzle, state.assignments, move.position, move.team);
  const proof = proofIds.map((id) => clueById(id).text).join(" Also consider: ");
  return `Look at ${character.name} in ${character.position}. ${proof}${proofIds.length === 1 ? " Use the teams already assigned." : " These clues work together."}`;
}

function giveHint() {
  const moves = forcedMoves(puzzle, state.assignments);
  if (!moves.length) return showMessage("No supported move is available. Reset this case to try again.", "conflict");
  const intended = puzzle.intendedPath.find((position) => !state.assignments[position] && moves.some((move) => move.position === position));
  const move = moves.find((candidate) => candidate.position === intended) || moves[0];
  state.hints += 1;
  save();
  showMessage(hintText(move), "hint");
  document.querySelector(`[data-position="${move.position}"]`)?.classList.add("hinted");
}

function undo() {
  const position = state.history.pop();
  if (!position) return;
  delete state.assignments[position];
  state.complete = false;
  elements.dialog.close();
  previousVisible = new Set();
  render();
  showMessage("Last assignment undone.");
}

function reset() {
  stopTimer();
  state = freshState();
  saved.games[puzzle.id] = state;
  previousVisible = new Set();
  if (elements.dialog.open) elements.dialog.close();
  render();
  showMessage("Case reset. Start with any choice the visible clues establish.");
}

function switchPuzzle(id) {
  stopTimer();
  puzzle = getPuzzle(id);
  state = saved.games[puzzle.id] || freshState();
  previousVisible = new Set();
  if (elements.dialog.open) elements.dialog.close();
  renderPuzzleSelector();
  render();
}

function completePuzzle() {
  stopTimer();
  state.complete = true;
  const hintLabel = `${state.hints} ${state.hints === 1 ? "hint" : "hints"} used`;
  const timeLabel = state.timerEnabled ? ` in ${formatTime(state.elapsed)}` : "";
  elements.completionDetails.textContent = `Case ${puzzle.number} complete${timeLabel}. ${hintLabel}.`;
  elements.shareResult.value = `Which Side?\nCase ${puzzle.number}/8: ${puzzle.title} ✓\n${hintLabel}${state.timerEnabled ? ` | ${formatTime(state.elapsed)}` : ""}\nThe case teams are set.`;
  setTimeout(() => elements.dialog.showModal(), 360);
}

elements.puzzleSelect.addEventListener("change", (event) => switchPuzzle(event.target.value));
elements.hint.addEventListener("click", giveHint);
elements.undo.addEventListener("click", undo);
elements.reset.addEventListener("click", reset);
elements.timerToggle.addEventListener("change", (event) => {
  if (!event.target.checked) stopTimer();
  state.timerEnabled = event.target.checked;
  if (state.timerEnabled && state.history.length && !state.complete) state.startedAt = Date.now();
  render();
});
elements.copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(elements.shareResult.value);
    showMessage("Result copied.", "success");
  } catch {
    elements.shareResult.select();
    showMessage("Result selected. Use your device copy command.");
  }
});
elements.replay.addEventListener("click", reset);
elements.next.addEventListener("click", () => switchPuzzle(puzzles[(puzzle.number) % puzzles.length].id));

renderPuzzleSelector();
render();
