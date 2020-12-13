import { DefinitionInfo, ImportDeclaration, ImportSpecifier, Project, SourceFile, ts } from 'ts-morph';
import { EOL } from 'os';
import { relative } from 'path';
import chalk from 'chalk';

interface ModuleImports {
  /** import { someImplementation } from './file' */
  codeImports: string[];
  /** import someImplementation from './file' */
  defaultImport: string;
  /** import type { SomeType } from './file' */
  typeImports: string[];
}

export interface Options {
  /** Write output to stdout instead of overwriting files. */
  dryRun: boolean;
  /** Disable use of VS Code's organise imports refactoring. */
  organiseImports: boolean;
  /** Glob patterns to .ts or .tsx files. */
  sourcePatterns: string[];
  /** Path to tsconfig.json file. */
  tsConfigFilePath: string;
}

const info = (...messages: Array<string | number>) => {
  console.log(chalk.blue('i', ...messages));
};

const getRelativePath = (sourceFile: SourceFile): string => {
  return relative(process.cwd(), sourceFile.getFilePath());
};

const getSourceFiles = (sourcePatterns: string[], project: Project): SourceFile[] => {
  return sourcePatterns.length ? project.getSourceFiles(sourcePatterns) : project.getSourceFiles();
};

export function tsImportTypes({ dryRun, organiseImports, sourcePatterns, tsConfigFilePath }: Options) {
  info('Analysing', relative(process.cwd(), tsConfigFilePath));

  const project = new Project({ tsConfigFilePath });
  const sourceFiles = getSourceFiles(sourcePatterns, project);

  info('Found', sourceFiles.length, 'files');

  sourceFiles.forEach((sourceFile: SourceFile, i) => {
    try {
      let hasChanged = false;

      const importDeclarations = sourceFile.getImportDeclarations();
      const imports: Record<string, ModuleImports> = {};
      const rewrittenImports: string[] = [];

      /** import Default, { named1, named2 as alias } from './file' */
      importDeclarations.forEach((importDeclaration: ImportDeclaration) => {
        /** Default */
        const defaultImport = importDeclaration.getDefaultImport();
        /** { named1, named2 as alias } */
        const namedImports = importDeclaration.getNamedImports();
        /** eg './file' or 'some-dependency' */
        const modulePath = importDeclaration.getModuleSpecifierValue();

        imports[modulePath] = imports[modulePath] || {
          codeImports: [],
          defaultImport: defaultImport ? defaultImport.getText() : '',
          typeImports: [],
        };

        namedImports.forEach((namedImport: ImportSpecifier) => {
          /** import { named2 as alias } */
          const alias = namedImport.getAliasNode()?.getText();
          const definitions = namedImport.getNameNode().getDefinitions();
          /** determine whether this import is a type or an implementation */
          definitions.forEach((definition: DefinitionInfo<ts.DefinitionInfo>) => {
            const definitionName = definition.getName();
            const finalName = alias ? `${definitionName} as ${alias}` : definitionName;
            const definitionKind = definition.getKind();
            if (['type', 'interface'].includes(definitionKind)) {
              hasChanged = true;
              imports[modulePath].typeImports.push(finalName);
            } else {
              hasChanged = true;
              imports[modulePath].codeImports.push(finalName);
            }
          });
        });

        if (hasChanged) {
          importDeclaration.remove();
        }
      });

      // write new imports for those we've collected and removed
      Object.entries(imports).forEach(
        ([identifier, { codeImports, defaultImport, typeImports }]: [string, ModuleImports]) => {
          // import Default, { named1, named2 } from './file'
          if (defaultImport && codeImports.length) {
            rewrittenImports.push(`import ${defaultImport}, { ${codeImports.join(', ')} } from '${identifier}'`);
          }
          // import Default from './file'
          if (defaultImport && !codeImports.length) {
            rewrittenImports.push(`import ${defaultImport} from '${identifier}'`);
          }
          // import { named1, named2 } from './file'
          if (!defaultImport && codeImports.length) {
            rewrittenImports.push(`import { ${codeImports.join(', ')} } from '${identifier}'`);
          }
          // import type { SomeType } from './file'
          if (typeImports.length) {
            rewrittenImports.push(`import type { ${typeImports.join(', ')} } from '${identifier}'`);
          }
        },
      );

      // nothing to do
      if (rewrittenImports.length === 0) {
        console.log(chalk.gray('-', getRelativePath(sourceFile)));
        return;
      }

      console.log(chalk.green('✓', getRelativePath(sourceFile)));

      sourceFile.insertText(0, rewrittenImports.join(EOL) + EOL + EOL);

      if (organiseImports !== false) {
        sourceFile.organizeImports();
      }

      if (dryRun === true) {
        console.log(sourceFile.getText());
      } else {
        sourceFile.saveSync();
      }
    } catch (err) {
      console.log(chalk.red('×', getRelativePath(sourceFile)));
    }
  });
}
