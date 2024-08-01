import { defineConfig } from "vitest/config";
import { VitestMarkdownReporter } from "vitest-markdown-reporter";

const env = process.env.ENV ?? "";
const reportDir = process.env.REPORT_DIR ?? "./report";

const markdownReporter = new VitestMarkdownReporter({
  title: `${env.replace(/^./, (s) => s.toUpperCase())} Report`,
  permalinkBaseUrl: "https://github.com/infinex-xyz/infinex-deployments/test/",
});

export default defineConfig({
  test: {
    reporters: ["default", "html", "json", markdownReporter],
    outputFile: {
      markdown: `${reportDir}/report.md`,
      json: `${reportDir}/report.json`,
      html: `${reportDir}/index.html`,
    },
  },
});
