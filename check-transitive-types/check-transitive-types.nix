{
  lib,
  buildNpmPackage,
}:

buildNpmPackage (finalAttrs: {
  pname = "check-transitive-types";
  version = "1.0.0";

  src = ./.;

  npmDepsHash = "sha256-O7BoNFAk1ZUHWUdFJFFkHTitampq/vNfh+KXX8iO3Pk=";

  # The prepack script runs the build script, which we'd rather do in the build phase.
  npmPackFlags = [ "--ignore-scripts" ];

  NODE_OPTIONS = "--openssl-legacy-provider";

  meta = {
    description = "Exported types from `devDependencies` do not resolve properly. This checks that you do not make this mistake.";
    license = lib.licenses.mit;
  };
})
