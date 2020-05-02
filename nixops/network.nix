let

accessKeyId = "default";
region = "us-east-1";

in
{
  webserver =
  { resources, config, pkgs, lib, ...}:
  let
    zpy = pkgs.callPackage ../default.nix {};
  in
  {
    deployment = {
      targetEnv = "ec2";
      ec2 = {
        inherit region accessKeyId;
        instanceType = "t2.micro";
        keyPair = resources.ec2KeyPairs.keypair;
        ebsInitialRootDiskSize = 16;
      };
    };

    boot.loader.grub.device = lib.mkForce "/dev/nvme0n1";

    networking.hostName = lib.mkDefault "zpy-alt.jgriego.net";

    networking.firewall.allowedTCPPorts = [ 80 443 ];

    security.acme.acceptTerms = true;
    security.acme.certs."zpy-alt.jgriego.net" = {
      webroot = "/var/www";
      email = "joseph.j.griego@gmail.com";
    };

    services.nginx = {
      enable = true;
      virtualHosts."zpy-alt.jgriego.net" = {
        forceSSL = true;
        enableACME = true;
        acmeRoot = "/var/www";
        locations."/" = {
          proxyPass = "http://localhost:8080";
          proxyWebsockets = true;
        };
      };
    };

    systemd.services.zpy = {
      enable = true;
      wantedBy = [ "multi-user.target" ];
      script = ''
        exec ${zpy.package}/bin/run.sh
        '';
    };
  };

  network = {
    description = "zpy webserver";
  };

  resources = {
    ec2KeyPairs.keypair = {
      inherit region accessKeyId;
    };
  };
}
