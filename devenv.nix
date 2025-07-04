{ pkgs, ... }:
{
  languages = {
    javascript = {
      enable = true;
      npm.enable = true;
    };
  };
  packages = with pkgs; [ nushell ];
  scripts.check_bad_types = {
    exec = builtins.readFile ./check_bad_types.nu;
    package = pkgs.nushell;
    binary = "nu";
    description = "Check bad TypeScript exports";
  };
}
