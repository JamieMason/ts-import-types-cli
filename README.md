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

## Project Status

Version 0.3.0 was written in 3-4 hours and although I've run it on some very
large projects and not run into issues yet, there'll surely be some edge cases
out there I've not yet encountered.

Pull Requests are welcome.
