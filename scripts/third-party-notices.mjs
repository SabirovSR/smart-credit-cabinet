import fs from "node:fs";
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const entries = [];
for (const directory of Object.keys(lock.packages).filter((x) =>
  x.startsWith("node_modules/"),
)) {
  const filename = `${directory}/package.json`;
  if (!fs.existsSync(filename)) continue;
  const p = JSON.parse(fs.readFileSync(filename, "utf8"));
  const license =
    typeof p.license === "string"
      ? p.license
      : JSON.stringify(
          p.license ?? p.licenses ?? "Not declared; inspect upstream license",
        );
  entries.push(`${p.name}@${p.version} — ${license}`);
}
fs.writeFileSync(
  "THIRD_PARTY_NOTICES",
  [
    "Third-party packages in the installed dependency tree",
    "Generated from installed package.json files and package-lock.json. Includes development tools.",
    "Full license texts remain in each package; this index does not replace their terms.",
    "",
    ...Array.from(new Set(entries)).sort(),
    "",
    "UI: custom layouts and text; button composition follows shadcn/ui patterns (MIT), using Radix Slot and CVA. No bank logos or proprietary brand assets copied.",
    "Icons: lucide-react (ISC). System fonts are used by the web application.",
    "PDF fixtures: synthetic content generated with ReportLab (BSD); Arial font embedded from the local Windows font installation for these fixtures. Regeneration on Linux uses DejaVu Sans.",
    "News: original synthetic editorial text. Registry and credit history: local deterministic fixtures, no external data.",
    "",
  ].join("\n"),
);
console.log(`Recorded ${new Set(entries).size} installed package notices`);
