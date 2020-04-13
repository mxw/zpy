
node-packages.devel.nix: package.json
	nix-shell -p nodePackages.node2nix --command "node2nix -d . -o node-packages.devel.nix -c /dev/null"
node-packages.prod.nix: package.json
	nix-shell -p nodePackages.node2nix --command "node2nix . -o node-packages.prod.nix -c /dev/null"

node2nix: node-packages.devel.nix node-packages.prod.nix

