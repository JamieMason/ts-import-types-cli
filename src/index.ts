import { DefinitionInfo, Project, ts } from 'ts-morph';
import { EOL } from 'os';
import { relative } from 'path';
import chalk from 'chalk';

interface ModuleImports {
  code: string[];
  _default: string;
  types: string[];
}

export interface Options {
  dryRun: boolean;
  organiseImports: boolean;
  sourcePatterns: string[];
  tsConfigFilePath: string;
}

export function tsImportTypes({ dryRun, organiseImports, sourcePatterns, tsConfigFilePath }: Options) {
  console.log(chalk.blue(`- Loading project: ${relative(process.cwd(), tsConfigFilePath)}`));

  const project = new Project({ tsConfigFilePath });
  const sourceFiles = sourcePatterns.length ? project.getSourceFiles(sourcePatterns) : project.getSourceFiles();

  console.log(chalk.blue(`- Found ${sourceFiles.length} files`));

  sourceFiles.forEach(function visitSourceFile(sourceFile) {
    console.log(chalk.blue(`- Processing file: ${relative(process.cwd(), sourceFile.getFilePath())}`));

    const importDeclarations = sourceFile.getImportDeclarations();
    const importsByModuleSpecifierValue: Record<string, ModuleImports> = {};
    const newImports: string[] = [];

    importDeclarations.forEach(function visitImportDeclaration(importDeclaration) {
      const moduleSpecifierValue = importDeclaration.getModuleSpecifierValue();
      const defaultImport = importDeclaration.getDefaultImport();
      const namedImports = importDeclaration.getNamedImports();

      importsByModuleSpecifierValue[moduleSpecifierValue] = importsByModuleSpecifierValue[moduleSpecifierValue] || {
        code: [],
        _default: defaultImport ? defaultImport.getText() : '',
        types: [],
      };

      namedImports.forEach(function visitNamedImport(namedImport) {
        const definitions = namedImport.getNameNode().getDefinitions();
        definitions.forEach(collectImports(moduleSpecifierValue));
      });

      importDeclaration.remove();
    });

    Object.entries(importsByModuleSpecifierValue).forEach(function getReplacementImportsText([
      identifier,
      { code, _default, types },
    ]) {
      if (_default && code.length) {
        newImports.push(`import ${_default}, { ${code.join(', ')} } from '${identifier}'`);
      }
      if (_default && !code.length) {
        newImports.push(`import ${_default} from '${identifier}'`);
      }
      if (!_default && code.length) {
        newImports.push(`import { ${code.join(', ')} } from '${identifier}'`);
      }
      if (types.length) {
        newImports.push(`import type { ${types.join(', ')} } from '${identifier}'`);
      }
    });

    sourceFile.insertText(0, newImports.join(EOL) + EOL + EOL);

    if (organiseImports !== false) {
      sourceFile.organizeImports();
    }

    if (dryRun === true) {
      console.log(sourceFile.getText());
    } else {
      sourceFile.saveSync();
    }

    function collectImports(moduleSpecifierValue: string) {
      return function importCollector(definition: DefinitionInfo<ts.DefinitionInfo>) {
        const definitionName = definition.getName();
        const definitionKind = definition.getKind();
        if (['type', 'interface'].includes(definitionKind)) {
          importsByModuleSpecifierValue[moduleSpecifierValue].types.push(definitionName);
        } else {
          importsByModuleSpecifierValue[moduleSpecifierValue].code.push(definitionName);
        }
      };
    }
  });
}
