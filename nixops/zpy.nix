{ config, lib, pkgs, ... }:

with lib;

let
  cfg = config.services.zpy;
  zpy = pkgs.callPackage ../default.nix {};

  tlsConfig =
    if (cfg.tlsSource == "acme")
    then {
      enableACME = true;
      acmeRoot = "/var/www/";
    }
    else {
      sslCertificate = "/run/selfsigned/host.cert";
      sslCertificateKey = "/run/selfsigned/host.key";
    };
in

{

  imports = [ ./self-signed-root.nix ];

  options.services.zpy = {
    enable = mkOption {
      type = types.bool;
      default = false;
    };

    hostname = mkOption {
      type = types.str;
      example = "zpy.example.com";
      description = "The hostname of the zpy server";
    };

    tlsSource = mkOption {
      type = types.enum [ "acme" "selfsigned" ];
      default = "selfsigned";
      example = "selfsigned";
      description = "Where to get TLS certificates";
    };

    acmeEmail = mkOption {
      type = types.str;
      example = "info@example.com";
      description = "The email to use in the ACME cert request";
    };
  };

  config = {
    security.acme.certs.${cfg.hostname} =
      mkIf ((cfg.tlsSource == "acme") && cfg.enable) {
        webroot = "/var/www";
        email = cfg.acmeEmail;
      };

    services.nginx = {
      enable = cfg.enable;
      recommendedProxySettings = true;
      recommendedTlsSettings = true;
      recommendedGzipSettings = true;
      recommendedOptimisation = true;
      virtualHosts.${cfg.hostname} = {
        forceSSL = true;
        locations."/" = {
          proxyPass = "http://localhost:8080";
          proxyWebsockets = true;
        };
      } // tlsConfig;
    };

    security.self-signed-root.enable = cfg.enable && cfg.tlsSource == "selfsigned";

    systemd.services.zpy = {
      enable = cfg.enable;
      wantedBy = [ "multi-user.target" ];
      serviceConfig = {
        User = "nobody";
        Restart = "always";
      };
      script = ''
        exec ${zpy.package}/bin/run.sh
      '';
    };
  };
}
