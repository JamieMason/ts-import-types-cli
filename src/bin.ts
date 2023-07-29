#!/usr/bin/env node

import chalk = require('chalk');
import program = require('commander');
import { resolve } from 'path';
import { readStdin } from './helpers';
import { tsImportTypes, tsImportTypesStdio } from '.';

const sourcePatterns: string[] = [];

program
  .version(require('../package.json').version)
  .arguments('[patterns...]')
  .action((args: string[]) => {
    sourcePatterns.push(...args.filter((arg) => arg && typeof arg === 'string'));
  })
  .option('-d, --dry-run', 'write output to stdout instead of overwriting files')
  .option('-p, --project [path]', 'path to tsconfig.json')
  .option('-O, --no-organise-imports', "disable use of VS Code's organise imports refactoring")
  .option('--stdio', 'read from stdin and write to stdout')
  .option('--file-path [path]', 'file location to use for --stdio source code')
  .parse(process.argv);

const dryRun = program.dryRun === true;
const organiseImports = program.organiseImports !== false;
const stdio = program.stdio === true;
const filePath = program.filePath;
const project = program.project || './tsconfig.json';
const tsConfigFilePath = resolve(process.cwd(), project);

try {
  require(tsConfigFilePath);
} catch (err) {
  const message = `ts-import-types-cli --project ${tsConfigFilePath} is not a tsconfig.json file`;
  console.error(chalk.red(message));
  process.exit(1);
}

async function main() {
  if (stdio) {
    const source = await readStdin();
    const result = tsImportTypesStdio({ filePath, source, tsConfigFilePath });
    process.stdout.write(result);
    return;
  }
  tsImportTypes({
    dryRun,
    organiseImports,
    sourcePatterns,
    tsConfigFilePath,
  });
}

main().catch(err => {
  console.error(
    chalk.red('! %s\n\n! Please raise an issue at %s\n\n%s'),
    err.message,
    chalk.underline('https://github.com/JamieMason/ts-import-types-cli/issues'),
    String(err.stack).replace(/^/gm, '    '),
  );
  process.exit(1);
});
