# Transitive Type Checking 🪲

I found my exported library types were resolving as `any` for users. This is
because an exported type that depends on a library in `devDependencies` does not
get resolved. There's also no easy way to check this (..right?!).

You could try bundling all your exported types, but TypeScript doesn't
recommend it:

https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html#packaging-dependent-declarations

This is because it would blow up your compilation time, recompiling types.

Bundling tools that offer this anyways like `tsup` or `rollup-plugin-ts` also break
source maps:

https://github.com/Swatinem/rollup-plugin-dts/issues/113

So, this script, `check_bad_types.nu`, takes your `./dist` files and finds which
type `dependencies` are incorrectly declared in `devDependencies` when they should
be in `dependencies` or `peerDependencies`!

This happens most often if you derive a type from `devDependencies` and then
export it. This is hard to detect because the type might span many files.

## Harness setup overview 🧱

I have two sample sub-apps here, `test-lib` (the one exporting the bad,
unusable types), and `test-pkg` (the one trying to use `test-lib`).

Inside `test-pkg`, we install `test-lib` how it would be on https://npmjs.org with
`--install-links`. This re-packs the NPM dep as if you got it from npm directly
and better simulates real-world use case. You don't have to add
`--install-links`, this is configured through the `.npmrc` file included.

> [!NOTE]
> If you would like to update `test-lib`, you need to rebuild it, `rm`
>
> `-rf node_modules/test-lib`from`test-pkg`, and then reinstall it.

## To show the issue 🧪

1. Run this in a POSIX (bash, zsh, etc.) shell. You can copy paste all of it.

```bash
(cd test-pkg && npm i && npm run build)
(cd test-lib && npm i && npm run build)
```

2. Then, open `./test-pkg/dist/src/index.d.ts`. Also, open `./test-pkg/src/index.ts`.

3. In the source file, notice there is no complaints from `tsserver`. This is because
   `ForwardedRef` is typed as `any`.

In the dist file, notice it seems to know a little bit more, and complains about
`ForwardedRef` not receiving type arguments, this is what is expected.

Also, notice in `./test-pkg/src/index.ts`, that the `useNothing` is typed to say
it expects the `Parameters<typeof useEffect>`, yet we are somehow able to pass
in `12` when this is clearly wrong.

This is transitive types being elided silently! Very sad. 😞

4. Now, run this in a POSIX shell:

```bash
(cd test-lib && check_bad_types)
```

^ this assumes you use devenv.
If you don't have devenv, try this:

```bash
(cd test-lib && nu ../check_bad_types.nu)
```

^ You need to have Nushell installed. I recommend it. It is great.

https://nushell.sh

5. notice this output:

```sh
 check_bad_types
Found entry points: ./dist/src/index.js
Consider moving these devDependencies into dependencies or peerDependencies.
Not doing so will likely result in bad exported types.
╭───┬──────────────╮
│ 0 │ @types/react │
╰───┴──────────────╯
```

Notice how the script gives actionable feedback about your library.

Other tools I have tested `@arethetypeswrong/cli`, `publint`, and `knip` all
miss this seemingly simple issue with publishing types.

## To use on your libraries 🐁

1. Make sure you have Nushell installed on your system.
2. `cd` to your library
3. `nu check_bad_types.nu` in that folder

It runs relative to invocation, so `check_bad_types.nu` may exist anywhere.

You should receive actionable feedback if you are unexpectedly exporting bad
types.

## Development setup ❄️

I recommend you install devenv at https://devenv.sh.

To get automatic shell start, I also recommend direnv. You can install this on
most any package manager.

Then, all you have to do is go here and type `direnv allow`.

This will ensure we are testing with the exact same dependencies.

You don't have to use direnv. You can start the shell manually with `devenv shell`.

You don't have to use devenv, but then you are now responsible for installing
these deps yourself:

- Nushell - https://nushell.sh
- Node - https://nodejs.org
- NPM - comes with Node (full version)

If these instructions are not clear or you get stuck, please let me know. I
would be happy to help.
