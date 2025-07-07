# check-transitive-types 🏬

## What is it? 🥚

Exported types from `devDependencies` do not resolve properly. This tool checks that you do not make this mistake.

## How to install? 🐣

It is a cli tool, so I recommend you install globally like this:
`npm i -g @xav-ie/check-transitive-types`

Then, just run like this:
`check-transitive-types` or, `npx check-transitive-types`

> [!NOTE]
> You can also install/run with Nix:
>
> `nix run github:xav-ie/transitive-type-check`

## How to use? 🐥

Running with no options, it will try and use `main`/`module` of your local `package.json` and trace the types that might not be installed properly.

You can also pass `--files` to specify which files to trace:

---

```sh
> npx check-transitive-types --help
Options:
  --version  Show version number               [boolean]
  --files    List of TypeScript files to trace [array]
  --help     Show help                         [boolean]
```
