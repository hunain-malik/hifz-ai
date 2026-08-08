// The SANAD gate — second half. Runs the SAME verification engine that
// grades students over every generated sample's transcript. A sample passes
// only with a perfect verified score and nothing uncertain: the neural
// voice is held to a stricter bar than any student.
//
// Run from the repo root:
//   npx tsx training/voice/gate.ts training/voice/transcripts.jsonl
//
// Exit code 0 = every sample passed; 1 = failures (listed, with reasons) —
// wire it straight into the training loop as the acceptance test.

import { readFileSync } from "node:fs";
import { judgeRecitation } from "../../src/lib/sanad";

type Row = {
  verse_key: string;
  expected: string;
  transcript: string;
  file: string;
};

const path = process.argv[2];
if (!path) {
  console.error("usage: npx tsx training/voice/gate.ts <transcripts.jsonl>");
  process.exit(2);
}

const rows: Row[] = readFileSync(path, "utf-8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));

let passed = 0;
const failures: { row: Row; why: string[] }[] = [];

for (const row of rows) {
  const report = judgeRecitation(row.expected, row.transcript);
  const why: string[] = [];
  if (report.score < 100) why.push(`verified score ${report.score}`);
  if (report.issues.length > 0) why.push(...report.issues);
  if (report.uncertain.length > 0) {
    // For students, "uncertain" earns a re-recite. For a machine voice it
    // is a failure: a generated ayah must be unambiguously verifiable.
    why.push(
      ...report.uncertain.map((u) => `uncertain: ${u.word} — ${u.reason}`)
    );
  }
  if (why.length === 0) passed++;
  else failures.push({ row, why });
}

console.log(`SANAD gate: ${passed}/${rows.length} samples verified`);
for (const f of failures) {
  console.log(`\n✗ ${f.row.verse_key} (${f.row.file})`);
  for (const w of f.why) console.log(`   ${w}`);
}
process.exit(failures.length === 0 ? 0 : 1);
