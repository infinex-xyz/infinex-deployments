#!/usr/bin/env npx tsx
// Generates GitHub comment Markdown and outputs to console
// Configurable with various environment variables

import config from "./vitest.config";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const env = process.env.ENV ?? "report";
const baseURL = new URL(process.env.BASE_URL ?? "http://localhost:4173/");
const commitRef = process.env.COMMIT_REF ?? "main";

const icons: Record<string, string> = {
  passed: "✅",
  failed: "❌",
  skipped: "⏩",
  pending: "🤔",
};

async function loadReport() {
  const outputFile = config.test?.outputFile;
  if (typeof outputFile !== "object" || !outputFile.json) {
    throw Error("JSON filename required in config");
  }
  const reportJson = await fs.readFile(outputFile.json, { encoding: "utf-8" });
  return JSON.parse(reportJson);
}

async function run() {
  const reportData = await loadReport();

  const numByStatus: Record<string, number> = {};
  for (const testFile of reportData.testResults) {
    for (const result of testFile.assertionResults) {
      const num = numByStatus[result.status] ?? 0;
      numByStatus[result.status] = num + 1;
    }
  }
  const statusLine = ["passed", "failed", "skipped", "pending"]
    .flatMap((status) =>
      numByStatus[status]
        ? [
            `<span title="${status}">${icons[status]}${numByStatus[status]}</span>`,
          ]
        : [],
    )
    .join(" | ");

  // Add env title with status line and links
  console.log(`## [${env}](${baseURL}) ${statusLine}`);
  console.log(
    `[Markdown](${new URL("./report.md", baseURL)}) | [JSON](${new URL("./report.json", baseURL)})`,
  );

  // Expandable test result details
  for (const testFile of reportData.testResults) {
    if (testFile.status !== "failed") continue;
    const name = path.basename(testFile.name).replace(".test.ts", "");
    const codePath = testFile.name.replace(/^.*infinex-deployments/, "");
    console.log(`<details>`);
    console.log(`<summary>${name}</summary>`);
    for (const result of testFile.assertionResults) {
      if (result.status !== "failed") continue;
      // It would be nice to link directly into the code in the Vitest UI, but the URL scheme uses magic file IDs
      // TODO: maybe try parsing the test file source to get better output
      const codeURL = `https://github.com/infinex-xyz/infinex-deployments/blob/${commitRef}${codePath}#L${result.location.line}`;
      const error = (result.failureMessages[0] ?? "").split("\n", 1)[0];
      console.log(`\n### ${result.fullName}`);
      console.log(codeURL);
      console.log("\n```");
      console.log(error);
      console.log("```");
    }
    console.log("</details>");
  }
  console.log("\n");
}

run();
