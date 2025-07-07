# Transitive Type Checking 🪲

I found my exported library types were resolving as `any` for users. This is
because an exported type that depends on a library in `devDependencies` does not
get installed. These transitive dependencies can cause suprising type errors
for users of your library.

One way to fix this is to try bundling all your imported/exported exported
types, but TypeScript doesn't recommend it:

https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html#packaging-dependent-declarations

This is because it would blow up your compilation time, recompiling types.

Bundling tools that offer this anyways like `tsup` or `rollup-plugin-ts` also break
source maps:

https://github.com/Swatinem/rollup-plugin-dts/issues/113

So, this package, `check-transitive-types`, takes your `./dist` files and finds which
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
(cd test-lib && npm i && npm run build && npm pack)
(cd test-pkg && npm i && npm run build && npm i ../test-lib/test-lib-1.0.0.tgz)
```

2. Then, open `./test-pkg/dist/src/index.d.ts`. Also, open `./test-pkg/src/index.ts`.

3. In the source file, notice there are no complaints from `tsserver`. This is because
   `ForwardedRef` is typed as `any`.

In the dist file, notice it seems to know a little bit more, and complains about
`ForwardedRef` not receiving type arguments, this is what is expected.

Also, notice in `./test-pkg/src/index.ts`, that the `useNothing` is typed to say
it expects the `Parameters<typeof useEffect>`, yet we are somehow able to pass
in `12` when this is clearly wrong.

This is transitive types being elided silently! Very sad. 😞

4. Now, run this to run the checker:

```bash
(cd test-lib && check-transitive-types)
```

^ this assumes you setup with Nix.
If you don't have Nix, try this:

```bash
(cd check-transitive-types && npm i && npm run build)
(cd test-lib && node ../check-transitive-types/dist/src/index.js)
```

5. notice this output:

```sh
 check-transitive-types
Found entry points: ./dist/src/index.js
✅ Found 1 TypeScript source(s) for ./dist/src/index.js
Consider moving these devDependencies into
dependencies or peerDependencies.
Not doing so will likely result in bad exported types.
[ '@types/react' ]
```

Notice how the script gives actionable feedback about your library.

Other tools I have tested `@arethetypeswrong/cli`, `publint`, and `knip` all
miss this seemingly simple issue with publishing types.

## To use on your libraries 🐁

1. `cd` to your library
2. `npm i -g check-transitive-types` -- you likely don't want this as a
   dependency in your project
3. `check-transitive-types` or `npx @xav-ie/check-transitive-types` in that folder

It runs relative to invocation, so `check-transitive-types` may exist anywhere.

You should receive actionable feedback if you are unexpectedly exporting bad
types.

> [!NOTE]
> If you have `nix`, you can also run this without needing it on your system:
>
> `nix run github:xav-ie/transitive-type-check`

## Development setup ❄️

I recommend you install Nix, the package manager of choice for this project:
https://nixos.org/

Then, just run this:

```bash
nix develop --no-pure-eval
```

This will ensure we are testing with the exact same dependencies.

You don't have to use Nix, but then you are now responsible for installing
these deps yourself:

- Node - https://nodejs.org
- NPM - comes with Node (full version)

If these instructions are not clear or you get stuck, please let me know. I
would be happy to help.

## Why `npm pack`?

You might be tempted to use `npm link` in the test-lib package and then do `npm i ../test-lib --install-links`.

This seems to work mostly correctly except `npm link` never resolves transitive dependencies, even when they are properly declared.

Therefore, please use `npm pack` or another local testing alternative. `yalc` is also good, but requires some more setup. It is worth it when you are doing many tests locally.

- https://github.com/wclr/yalc

In general, you will face many issues with `npm link`, please do not use it. Here is a post on why you should reconsider using it:

- https://hirok.io/posts/avoid-npm-link
