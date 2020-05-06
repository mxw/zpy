{
  acmeEmail
  hostname
}:

let

accessKeyId = "default";
region = "us-east-1";

in
{
  webserver =
  { resources, config, pkgs, lib, ...}:
  {
    imports = [ ./zpy.nix ];
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
    boot.kernel.sysctl = {
      "net.ipv4.tcp_syncookies" = 1;
    };

    networking.hostName = lib.mkDefault hostname;
    networking.firewall.allowedTCPPorts = [ 80 443 ];
    security.acme.acceptTerms = true;

    services.zpy = {
      enable = true;
      inherit hostname acmeEmail;
    };

    services.fail2ban = {
      enable = true;
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
