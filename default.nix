{
  pkgs ? import <nixpkgs> {
    inherit system;
  },
  system ? builtins.currentSystem,
  nodejs_latest ? pkgs."nodejs_latest"
}:

let
  nodejs = nodejs_latest;
  nodeEnv = import ./node-env.nix {
    inherit (pkgs) stdenv python2 utillinux runCommand writeTextFile;
    inherit nodejs;
    libtool = if pkgs.stdenv.isDarwin then pkgs.darwin.cctools else null;
  };
  prodPkgs = import ./node-packages.prod.nix {
    inherit (pkgs) fetchurl fetchgit;
    inherit nodeEnv;
  };
  develPkgs = import ./node-packages.devel.nix {
    inherit (pkgs) fetchurl fetchgit;
    inherit nodeEnv;
  };

  depsOnly = {args, type ? "prod"}: args // {
    name = "${args.packageName}-${type}-deps";
    src = pkgs.lib.sourceByRegex ./. ["^package.json"];
  };

  buildDeps = nodeEnv.buildNodePackage (
    depsOnly {inherit (develPkgs) args; type = "build";}
  );
  prodDeps = nodeEnv.buildNodePackage (
    depsOnly {inherit (prodPkgs) args; type = "prod";}
  );

  build = pkgs.stdenv.mkDerivation rec {
    name = "${prodPkgs.args.packageName}-${version}";
    version = prodPkgs.args.version;

    src = pkgs.lib.sourceByRegex ./. [
      "^src.*"
      "^test.*"
      "^assets.*"
      "^package.json"
      "^tsconfig.json"
      "^webpack.config.js"
    ];

    buildInputs = [nodejs];

    buildPhase = ''
      ln -s "${buildDeps}/lib/node_modules/zhaopengyou/node_modules" .
      npx webpack
    '';

    installPhase = ''
      mkdir -p $out/bin;
      cp -R dist $out
      cp -R assets $out

      cat >$out/bin/run.sh <<eof
      #!/usr/bin/env sh
      cd $out
      exec env NODE_PATH=${prodDeps}/lib/node_modules/zhaopengyou/node_modules ${nodejs}/bin/node dist/app/main.js
      eof

      chmod +x $out/bin/run.sh
    '';
  };
in
{
  shell = nodeEnv.buildNodeShell develPkgs.args;
  package = build;
}
