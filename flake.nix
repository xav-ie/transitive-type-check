{
  description = "Description for the project";

  inputs = {
    devenv-root.flake = false;
    devenv-root.url = "file+file:///dev/null";
    devenv.url = "github:cachix/devenv";
    flake-parts.url = "github:hercules-ci/flake-parts";
    mk-shell-bin.url = "github:rrbutani/nix-mk-shell-bin";
    nix2container.inputs.nixpkgs.follows = "nixpkgs";
    nix2container.url = "github:nlewo/nix2container";
    nixpkgs.url = "github:cachix/devenv-nixpkgs/rolling";
    nuenv.url = "github:DeterminateSystems/nuenv";
    systems.url = "github:nix-systems/default";
  };

  nixConfig = {
    extra-trusted-public-keys = "devenv.cachix.org-1:w1cLUi8dv3hnoSPGAuibQv+f9TZLr6cv/Hm9XgU50cw=";
    extra-substituters = "https://devenv.cachix.org";
  };

  outputs =
    inputs@{ flake-parts, devenv-root, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [
        inputs.devenv.flakeModule
      ];
      systems = import inputs.systems;

      perSystem =
        {
          config,
          self',
          inputs',
          pkgs,
          system,
          ...
        }:
        {
          # Per-system attributes can be defined here. The self' and inputs'
          # module parameters provide easy access to attributes of the same
          # system.

          packages.default = inputs.nuenv.lib.mkNushellScript pkgs.nushell pkgs.writeTextFile {
            name = "check-transitive-types";
            script = builtins.readFile ./check_transitive_types.nu;
          };

          devenv.shells.default = {
            name = "check-transitive-types-shell";
            languages = {
              javascript = {
                enable = true;
                npm.enable = true;
              };
            };

            imports = [
              # This is just like the imports in devenv.nix.
              # See https://devenv.sh/guides/using-with-flake-parts/#import-a-devenv-module
              # ./devenv-foo.nix
            ];

            packages = [
              config.packages.default
              pkgs.nushell
            ];

          };

        };
      flake = {
        # The usual flake attributes can be defined here, including system-
        # agnostic ones like nixosModule and system-enumerating ones, although
        # those are more easily expressed in perSystem.

      };
    };
}
