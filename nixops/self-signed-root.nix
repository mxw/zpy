{ config, lib, pkgs, ... }:

with lib;

let
  cfg = config.security.self-signed-root;

  cnf = pkgs.writeText "selfsigned.cnf" ''
    [req]
    default_bits = 2048
    default_md = sha256
    prompt = no
    encrypt_key = no
    distinguished_name = dn

    [dn]
    C=US
    O=Joseph Griego
    CN=${config.networking.hostName}
  '';
in

{

  options.security.self-signed-root.enable = mkOption {
    type = types.bool;
    default = false;
  };

  config = {
    users.groups = mkIf cfg.enable {
      certs = {};
    };

    users.users.nginx.extraGroups = [ "certs" ];

    systemd.services.ssr-cert = mkIf cfg.enable {
      enable = cfg.enable;
      wantedBy = [ "multi-user.target" ];
      serviceConfig = {
        Type = "oneshot";
        RuntimeDirectory = "selfsigned";
        RuntimeDirectoryPreserve= "yes";
      };
      path = with pkgs; [ openssl ];
      script = ''
        set -eof pipefail
        cd /run/selfsigned;
        openssl req -newkey rsa:2048 -nodes -keyout host.key -x509 -days 30 -out host.cert -config ${cnf}
        chmod 640 host.key
        chown root:certs host.cert host.key
      '';
    };
  };
}
