#!/usr/bin/env node

import chalk = require('chalk');
import program = require('commander');
import { resolve } from 'path';
import { tsImportTypes } from '.';
import stripJsonComments from 'strip-json-comments';
import fs from 'fs';

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
  .parse(process.argv);

const dryRun = program.dryRun === true;
const organiseImports = program.organiseImports !== false;
const project = program.project || './tsconfig.json';
const tsConfigFilePath = resolve(process.cwd(), project);

try {
  JSON.parse(stripJsonComments(fs.readFileSync(tsConfigFilePath, 'utf8')));
} catch (err) {
  const message = `ts-import-types-cli --project ${tsConfigFilePath} is not a tsconfig.json file`;
  console.error(chalk.red(message));
  process.exit(1);
}

try {
  tsImportTypes({
    dryRun,
    organiseImports,
    sourcePatterns,
    tsConfigFilePath,
  });
} catch (err) {
  console.error(
    chalk.red('! %s\n\n! Please raise an issue at %s\n\n%s'),
    err.message,
    chalk.underline('https://github.com/JamieMason/ts-import-types-cli/issues'),
    String(err.stack).replace(/^/gm, '    '),
  );
  process.exit(1);
}
