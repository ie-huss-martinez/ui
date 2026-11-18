import type { Reporter, TestModule } from "vitest/node";

/**
 * Logs each browser test file as it starts, with its engine, such as
 * "▶ storybook (firefox) src/components/Dialog.stories.tsx". Vitest's own
 * reporters name a file only when it finishes, so when a browser's page
 * crashes, the file it was running goes unnamed. With this, the last line
 * for that engine names it.
 */
export default class FileStartReporter implements Reporter {
  private root = process.cwd();

  onInit(context: { config: { root: string } }): void {
    this.root = context.config.root;
  }

  onTestModuleStart(testModule: TestModule): void {
    const project = testModule.project.name;
    // Only browser projects, whose names end with their engine in brackets.
    if (!/\(\w+\)$/.test(project)) {
      return;
    }
    const file = testModule.moduleId.startsWith(`${this.root}/`)
      ? testModule.moduleId.slice(this.root.length + 1)
      : testModule.moduleId;
    process.stderr.write(`▶ ${project} ${file}\n`);
  }
}
