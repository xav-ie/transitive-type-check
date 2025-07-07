#!/usr/bin/env node
import {
  readFile,
  writeFile,
  unlink,
  access,
  readdir,
  stat,
} from "node:fs/promises";
import nodePath from "node:path";
import { execSync } from "node:child_process";
import { checkbox, input } from "@inquirer/prompts";
import dedent from "dedent";
import { type } from "arktype";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const PackageJsonSchema = type({
  "main?": "string",
  "module?": "string",
  "dependencies?": "Record<string, string>",
  "devDependencies?": "Record<string, string>",
  "peerDependencies?": "Record<string, string>",
});

const TsConfigSchema = type({
  extends: "string",
  include: "string[]",
});

const SourceMapSchema = type({
  sources: "string[]",
});

type TsConfig = typeof TsConfigSchema.infer;

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findTsFiles(directory = ".", prefix = ""): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(directory);
    for (const entry of entries) {
      if (entry.startsWith(".") || entry === "node_modules" || entry === "dist")
        continue;

      const fullPath = nodePath.join(directory, entry);
      const relativePath = prefix ? `${prefix}/${entry}` : entry;

      const stats = await stat(fullPath);
      if (stats.isDirectory()) {
        files.push(...(await findTsFiles(fullPath, relativePath)));
      } else if (
        nodePath.extname(entry) === ".ts" ||
        nodePath.extname(entry) === ".tsx"
      ) {
        files.push(relativePath);
      }
    }
  } catch {
    // Ignore errors
    console.error(`❌ Error reading directory: ${directory}`);
  }

  return files;
}

async function findSourceFiles(jsFile: string): Promise<string[]> {
  if (!(await fileExists(jsFile))) {
    console.error(`❌ Entry point not found: ${jsFile}`);
    return [];
  }

  const mapFile = jsFile + ".map";

  if (!(await fileExists(mapFile))) {
    console.log(
      `⚠️  No source map found for ${jsFile}, cannot trace to TypeScript sources`,
    );
    return [];
  }

  try {
    const mapContent = await readFile(mapFile, "utf8");
    const mapData = JSON.parse(mapContent) as unknown;
    const sourceMapResult = SourceMapSchema(mapData);

    if (sourceMapResult instanceof type.errors) {
      console.error(
        `❌ Invalid source map format in ${mapFile}:`,
        sourceMapResult.summary,
      );
      return [];
    }

    const sourceMap = sourceMapResult;
    const jsDirectory = nodePath.dirname(jsFile);

    const tsFiles: string[] = [];
    for (const source of sourceMap.sources) {
      if (source.endsWith(".ts") || source.endsWith(".tsx")) {
        const resolvedPath = nodePath.resolve(jsDirectory, source);
        if (await fileExists(resolvedPath)) {
          tsFiles.push(resolvedPath);
        }
      }
    }

    if (tsFiles.length === 0) {
      console.log(
        `⚠️  No TypeScript sources found in source map for ${jsFile}`,
      );
      return [];
    }

    console.log(
      `✅ Found ${tsFiles.length.toString()} TypeScript source(s) for ${jsFile}`,
    );
    return tsFiles;
  } catch (error) {
    console.error(`❌ Error reading source map ${mapFile}:`, error);
    return [];
  }
}

async function promptForFiles(): Promise<string[]> {
  const tsFiles = await findTsFiles();

  if (tsFiles.length === 0) {
    const manualInput = await input({
      message:
        "No TypeScript files found. Enter files to trace (comma-separated):",
    });
    return manualInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const selected = await checkbox({
    message: "Select TypeScript files to trace:",
    choices: tsFiles.map((file) => ({ name: file, value: file })),
    required: true,
  });

  return selected;
}

async function findPackageRoot(directory: string): Promise<string | undefined> {
  let currentDirectory = directory;
  while (currentDirectory !== "/") {
    if (await fileExists(nodePath.join(currentDirectory, "package.json"))) {
      return currentDirectory;
    }
    currentDirectory = nodePath.dirname(currentDirectory);
  }
  return undefined;
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("files", {
      type: "array",
      describe: "List of TypeScript files to trace",
      string: true,
    })
    .help()
    .parse();

  const tsconfigCheck = "tsconfig-check.json";

  const packageContent = await readFile("package.json", "utf8");
  const packageData = JSON.parse(packageContent) as unknown;
  const packageResult = PackageJsonSchema(packageData);

  if (packageResult instanceof type.errors) {
    console.error("❌ Invalid package.json format:", packageResult.summary);
    return;
  }

  const package_ = packageResult;
  let filesToTrace: string[];

  if (argv.files && argv.files.length > 0) {
    filesToTrace = argv.files;
    console.log(`Using provided files: ${filesToTrace.join(", ")}`);
  } else {
    const entries = [package_.main, package_.module]
      .filter((x): x is string => x !== undefined)
      .filter((v, index, a) => a.indexOf(v) === index);

    if (entries.length === 0) {
      console.log("No main/module found in package.json.");
      filesToTrace = await promptForFiles();
    } else {
      console.log(`Found entry points: ${entries.join(", ")}`);
      const tracedFiles = await Promise.all(
        entries.map((element) => findSourceFiles(element)),
      );
      filesToTrace = tracedFiles.flat().filter(Boolean);

      if (filesToTrace.length === 0) {
        console.log(
          "\nCould not trace TypeScript files from package.json entry points.",
        );
        console.log("Possible issues:");
        console.log("- Entry points do not exist");
        console.log("- No source maps available");
        console.log("- Source maps do not reference TypeScript files");
        filesToTrace = await promptForFiles();
      }
    }
  }

  if (filesToTrace.length === 0) {
    console.error("\n❌ No files provided to trace");
    return;
  }

  const traceConfig: TsConfig = {
    extends: nodePath.join(process.cwd(), "tsconfig.json"),
    include: filesToTrace,
  };

  const configResult = TsConfigSchema(traceConfig);
  if (configResult instanceof type.errors) {
    console.error("❌ Invalid tsconfig format:", configResult.summary);
    return;
  }

  await writeFile(tsconfigCheck, JSON.stringify(configResult, undefined, 2));

  try {
    const output = execSync(
      `npx tsc --listFiles --noEmit --project ${tsconfigCheck}`,
      { encoding: "utf8" },
    );

    const packageRoots = await Promise.all(
      output
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((file) => nodePath.dirname(file))
        .filter((directory, index, array) => array.indexOf(directory) === index)
        .map((element) => findPackageRoot(element)),
    );

    const badDeps = packageRoots
      .filter((directory): directory is string => directory !== undefined)
      .filter((directory, index, array) => array.indexOf(directory) === index)
      .map((directory) => directory.replace(/^.*\/node_modules\//, ""))
      .filter((packageName) => {
        const peerDeps = Object.keys(package_.peerDependencies || {});
        const deps = Object.keys(package_.dependencies || {});
        const devDependencies = Object.keys(package_.devDependencies || {});
        return (
          !peerDeps.includes(packageName) &&
          !deps.includes(packageName) &&
          devDependencies.includes(packageName)
        );
      })
      .filter((packageName) => packageName !== "typescript");

    const colors = {
      cyan: (text: string) => `\u001B[36m${text}\u001B[0m`,
      yellow: (text: string) => `\u001B[33m${text}\u001B[0m`,
    };
    console.log(dedent`
      Consider moving these ${colors.cyan("devDependencies")} into
      ${colors.cyan("dependencies")} or ${colors.cyan("peerDependencies")}.
      ${colors.yellow("Not doing so will likely result in bad exported types.")}
    `);
    console.log(badDeps);
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 2) {
      console.error("\n❌ TypeScript compilation failed");
      console.error("   Files being traced:", filesToTrace);
      if ("stdout" in error && typeof error.stdout === "string") {
        console.error("   TypeScript error:", error.stdout.trim());
      }
    } else {
      throw error;
    }
  } finally {
    if (await fileExists(tsconfigCheck)) {
      await unlink(tsconfigCheck);
    }
  }
}

await main().catch(console.error);
