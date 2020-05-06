{
  hostname
}:

{
  webserver =
    {resources, config, pkgs, lib, ...}:
    {
      imports = [./zpy.nix ];

      deployment.targetEnv = "container";

      networking.firewall.allowedTCPPorts = [ 80 443 ];

      networking.hostName = "zpy.jgriego.net";

      services.zpy = {
        enable = true;
        hostname = config.networking.hostName;
      };
    };

  network = {
    description = "zpy container";
  };
}
