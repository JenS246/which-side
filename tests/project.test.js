import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { puzzles, characters } from "../src/puzzles.js";

test("launch set has the requested puzzle mix", () => {
  assert.equal(puzzles.length, 8);
  assert.deepEqual(puzzles.map((puzzle) => puzzle.level), ["Tutorial", "Tutorial", "Standard", "Standard", "Standard", "Standard", "Challenge", "Challenge"]);
});

test("characters use permitted party-team roles", () => {
  const forbidden = /judge|juror|court clerk|court reporter/i;
  characters.forEach((character) => assert.doesNotMatch(character.role, forbidden));
  assert.equal(new Set(characters.map((character) => character.role)).size, 16);
});

test("page includes accessibility and reduced-motion essentials", async () => {
  const [html, css] = await Promise.all([readFile(new URL("../index.html", import.meta.url), "utf8"), readFile(new URL("../styles.css", import.meta.url), "utf8")]);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /Skip to the board/);
  assert.match(html, /Board-language guide/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /focus-visible/);
  assert.match(css, /grid-template-columns: repeat\(4/);
});

test("visible product copy avoids prohibited category language and long dash characters", async () => {
  const files = await Promise.all(["../index.html", "../src/app.js", "../src/puzzles.js"].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  const copy = files.join("\n");
  assert.doesNotMatch(copy, /guilty|not guilty|\bliable\b|not liable/i);
  assert.doesNotMatch(copy, /[—–]/);
});
