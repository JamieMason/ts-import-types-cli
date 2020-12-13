# ts-import-types-cli

> Autofix TypeScript types to be imported using `import type`

## Installation

```
npm install -g ts-import-types-cli
```

## Usage

```
Usage: ts-import-types-cli [options] [patterns...]

Options:
  -V, --version              output the version number
  -d, --dry-run              write output to stdout instead of overwriting files
  -p, --project [path]       path to tsconfig.json
  -O, --no-organise-imports  disable use of VS Code's organise imports refactoring
  -h, --help                 display help for command
```

## Example

```
$ ts-import-types-cli --project ./tsconfig.json 'src/**/*.ts' 'src/**/*.tsx'
```

```ts
import { interpret, StateValue } from 'xstate';
import { sendSearch } from '../../services/search-client/send-search';
import { createAlgoliaMachine } from '../machine';
import { AlgoliaInterpreter, AlgoliaMachine } from '../machine/types';

// ...the rest of the file
```

<p><center>↓↓↓↓↓</center></p>

```ts
import type { StateValue } from 'xstate'
import { interpret } from 'xstate'
import { sendSearch } from '../../services/search-client/send-search'
import { createAlgoliaMachine } from '../machine'
import type { AlgoliaInterpreter, AlgoliaMachine } from '../machine/types'

// ...the rest of the file
```

## Triple-Slash Directives

Moving triple-slash directives such as `/// <reference lib="webworker" />` back
to the top of the file is not yet supported. If you know how to do this using
https://ts-morph.com please [open a
PR](https://github.com/JamieMason/ts-import-types-cli/pulls) or otherwise let me
know.

Unfortunately until then, files will need their triple-slash directives manually
moving back to the top of the file.

`ts-import-types-cli` will output a list of which files are affected.
