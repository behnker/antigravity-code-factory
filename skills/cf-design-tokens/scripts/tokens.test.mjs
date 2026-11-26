import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileTokens, contrastRatio, parseArgs as parseGenArgs } from "./generate-tokens.mjs";
import { scanSourceText, parseArgs as parseValArgs } from "./validate-tokens.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(__dirname, "../resources/tokens.template.json");

test("compileTokens compiles starter template to Tailwind v4 @theme with WCAG AA pass", () => {
  const starter = JSON.parse(fs.readFileSync(TEMPLATE_PATH, "utf8"));
  const out = compileTokens(starter, { format: "tailwind-v4" });

  assert.ok(out.css.includes(":root {"));
  assert.ok(out.css.includes(".dark {"));
  assert.ok(out.css.includes("@theme inline {"));
  assert.ok(out.css.includes("--color-primary: #0F5E57;"));
  assert.ok(out.css.includes("--color-primary: var(--color-primary);"));
  assert.ok(out.contrastResults.length >= 6);
});

test("compileTokens rejects cyclic token references", () => {
  const cyclic = {
    primitive: {
      a: { $value: "{primitive.b}" },
      b: { $value: "{primitive.a}" },
    },
  };
  assert.throws(() => compileTokens(cyclic), /Cyclic token reference/);
});

test("compileTokens rejects unresolved token references instead of emitting raw braces", () => {
  const missing = {
    semantic: {
      color: {
        primary: { $value: "{primitive.color.nonexistent}" },
      },
    },
  };
  assert.throws(() => compileTokens(missing), /Unresolved token reference/);
});

test("compileTokens rejects prototype pollution keys, inherited chain traversal, and array root", () => {
  assert.throws(() => compileTokens([]), /plain JSON object/);

  const protoPayload = JSON.parse(
    '{"primitive":{"__proto__":{"a":{"$value":"#111111"}}}}'
  );
  assert.throws(() => compileTokens(protoPayload), /Forbidden prototype key/);

  const ctorRef = {
    primitive: { a: { $value: "{primitive.constructor.name}" } },
  };
  assert.throws(() => compileTokens(ctorRef), /Forbidden prototype key/);
});

test("compileTokens rejects CSS injection characters (braces, comments, newlines, data URLs)", () => {
  for (const badVal of [
    "#fff; } body { display: none",
    "#fff /* break out",
    "#fff\n} body {}",
    "url(data:text/css,evil)",
    "url('javascript:alert(1)')",
  ]) {
    const unsafe = { primitive: { color: { evil: { $value: badVal } } } };
    assert.throws(() => compileTokens(unsafe), /Unsafe CSS value rejected/);
  }
});

test("compileTokens enforces WCAG 2.1 AA >= 4.5:1 contrast on semantic pairs", () => {
  const lowContrast = {
    primitive: {
      color: {
        light: { $value: "#EEEEEE" },
        alsoLight: { $value: "#FFFFFF" },
      },
    },
    semantic: {
      color: {
        background: { $value: "{primitive.color.alsoLight}" },
        foreground: { $value: "{primitive.color.light}" },
      },
    },
  };
  assert.ok(contrastRatio("#EEEEEE", "#FFFFFF") < 4.5);
  assert.throws(() => compileTokens(lowContrast), /WCAG contrast check failed/);
});

test("CLI parsers reject missing flag values", () => {
  assert.throws(() => parseGenArgs(["--config", "tokens.json", "--out"]), /Missing value for --out/);
  assert.throws(() => parseValArgs(["--dir", "src", "--ignore"]), /Missing value for --ignore/);
});

test("validate-tokens detects arbitrary Tailwind brackets & raw CSS colors without #anchor or multiline comment false positives", () => {
  const badSource = `
    /*
      color: #123456;
      bg-[#abcdef]
    */
    export function Card() {
      const docText = "Use @tokens-ignore-file only as a comment directive";
      return (
        <a href="#features" className="bg-[#123456] p-[17px]" style={{ color: '#abcdef' }}>
          Jump to #abc section {docText}
        </a>
      );
    }
  `;
  const violations = scanSourceText(badSource, "Card.tsx");
  const ids = violations.map((v) => v.ruleId);
  assert.ok(ids.includes("tailwind-arbitrary-color"));
  assert.ok(ids.includes("tailwind-arbitrary-size"));
  assert.ok(ids.includes("inline-style-hex"));
  assert.equal(violations.length, 3);

  const cleanSource = `
    export function Nav() {
      return <a href="#abc" className="bg-primary text-primary-foreground px-6 py-3">Play</a>;
    }
  `;
  assert.equal(scanSourceText(cleanSource, "Nav.tsx").length, 0);
});
