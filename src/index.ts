import chalk from 'chalk';
import { EOL } from 'os';
import { relative } from 'path';
import { DefinitionInfo, ImportDeclaration, ImportSpecifier, Project, SourceFile, ts } from 'ts-morph';

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

const getFakeSourceFile = (source: string, path: string, project: Project): SourceFile => {
  return project.createSourceFile(path, source, { overwrite: true });
};

function fixSourceFile(sourceFile: SourceFile, options: { organiseImports: boolean }) {
  const { organiseImports} = options;
  let hasChanged = false;

  const importDeclarations = sourceFile.getImportDeclarations();
  const imports: Record<string, ModuleImports> = {};
  const rewrittenImports: string[] = [];
  const rewrittenDirectives: string[] = [];

  sourceFile.getPathReferenceDirectives().forEach((directive) => {
    rewrittenDirectives.push(`/// <reference path="${directive.getText()}" />`);
  });
  sourceFile.getTypeReferenceDirectives().forEach((directive) => {
    rewrittenDirectives.push(`/// <reference type="${directive.getText()}" />`);
  });
  sourceFile.getLibReferenceDirectives().forEach((directive) => {
    rewrittenDirectives.push(`/// <reference lib="${directive.getText()}" />`);
  });

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
      defaultImport: '',
      typeImports: [],
    };

    if (defaultImport) {
      imports[modulePath].defaultImport = defaultImport.getText();
      hasChanged = true;
    }

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
      if (defaultImport && codeImports.length) {
        rewrittenImports.push(`import ${defaultImport}, { ${codeImports.join(', ')} } from '${identifier}'`);
      }
      if (defaultImport && !codeImports.length) {
        rewrittenImports.push(`import ${defaultImport} from '${identifier}'`);
      }
      if (!defaultImport && codeImports.length) {
        rewrittenImports.push(`import { ${codeImports.join(', ')} } from '${identifier}'`);
      }
      if (typeImports.length) {
        rewrittenImports.push(`import type { ${typeImports.join(', ')} } from '${identifier}'`);
      }
    },
  );

  sourceFile.insertText(0, rewrittenImports.join(EOL) + EOL + EOL);

  if (organiseImports !== false) {
    sourceFile.organizeImports();
  }

  return {
    rewrittenImports,
    rewrittenDirectives,
  }
}

export function tsImportTypesStdio({ source, filePath, tsConfigFilePath }: { source: string, filePath: string, tsConfigFilePath: string }) {
  const project = new Project({ tsConfigFilePath });
  const sourceFile = getFakeSourceFile(source, filePath, project)

  fixSourceFile(sourceFile, { organiseImports: true })

  return sourceFile.getFullText()
}

export function tsImportTypes({ dryRun, organiseImports, sourcePatterns, tsConfigFilePath }: Options) {
  info('Analysing', relative(process.cwd(), tsConfigFilePath));

  const project = new Project({ tsConfigFilePath });
  const sourceFiles = getSourceFiles(sourcePatterns, project);
  const filesWithRewrittenDirectives: string[] = [];

  info('Found', sourceFiles.length, 'files');

  sourceFiles.forEach((sourceFile: SourceFile, i) => {
    try {
      const { rewrittenDirectives, rewrittenImports } = fixSourceFile(sourceFile, { organiseImports })

      // nothing to do
      if (rewrittenImports.length === 0) {
        console.log(chalk.gray('-', getRelativePath(sourceFile)));
        return;
      }

      console.log(chalk.green('✓', getRelativePath(sourceFile)));

      if (rewrittenDirectives.length > 0) {
        filesWithRewrittenDirectives.push(getRelativePath(sourceFile));
        console.log(chalk.yellow('! contains triple-slash directives'));
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

  console.log('');
  console.log(chalk.bgGreen.black(' Complete '));
  console.log('');

  if (filesWithRewrittenDirectives.length > 0) {
    console.log(
      chalk.yellow(
        `
* Moving triple-slash directives such as /// <reference lib="webworker" /> back
  to the top of the file is not yet supported. If you know how to do this using
  https://ts-morph.com please open a PR or otherwise let me know.

  https://github.com/JamieMason/ts-import-types-cli/pulls

  Unfortunately until then, the following files will need their triple-slash
  directives manually moving back to the top of the file:
${filesWithRewrittenDirectives.map((filePath) => `\n  - ${filePath}`).join('')}
`.trim(),
      ),
    );
  }
}
