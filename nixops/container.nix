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
        database = {
          host = "/run/postgresql";
          user = config.services.zpy.user;
          db = config.services.zpy.user;
        };
      };

      services.postgresql = {
        enable = true;
        authentication = lib.mkForce "local all all peer";
        ensureDatabases = [ config.services.zpy.user];
        ensureUsers = [{
          name = config.services.zpy.user;
          ensurePermissions = {
            "DATABASE ${config.services.zpy.user}" = "ALL PRIVILEGES";
          };
        }];
        enableTCPIP = false;
      };
    };

  network = {
    description = "zpy container";
  };
}
