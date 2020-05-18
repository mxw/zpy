ZPY
===

ZPY is an online implementation of the Chinese playing card game "zhao peng
you", a.k.a. "找朋友", "finding friends", "拖拉机", or "tractor".  it is the
fluid partnership variant of the game outlined [here][wk].

the author's ZPY server can be found at [https://zpy.mxawng.com][zpy].

setup
-----

it's possible to host your own ZPY server if you wish.  the following
instructions assume a debian/ubuntu linux distro, but only very slightly.

ZPY requires nodejs and postgres, and the instructions here assume you have an
nginx server on a host which runs systemd.

begin by cloning the zpy repository:

    git clone https://github.com/mxw/zpy.git

then install npm packages and run webpack:

    cd zpy
    npm install
    npm run build

next, make a unix user which the node server will run as:

    sudo adduser zpy

then create the database and set appropriate permissions:

    su - postgres
    createdb zpydb
    createuser zpy
    psql

    # in psql client
    GRANT CONNECT ON DATABASE zpydb TO zpy;
    \q

note that ZPY's out-of-box configuration assumes postgres is configured with
peer authentication.  if this is undesirable on your system, simply add the
relevant environment variables to the `zpy.service` you deploy.

for whatever reason, the out-of-box configuration assumes your files all live
in `/usr/local/lib`, so copy them there:

    sudo mkdir /usr/local/lib/zpy
    sudo cp -rf dist /usr/local/lib/zpy
    sudo cp -rf assets /usr/local/lib/zpy

publish the nginx and systemd configs:

    sudo cp conf/zpy.nginx /etc/nginx/sites-available/zpy
    sudo ln -s /etc/nginx/sites-available/zpy /etc/nginx/sites-enabled/zpy
    sudo cp conf/zpy.service /lib/systemd/system/zpy.service

you'll probably want to change the nginx `server_name` and obtain TLS certs.

finally, start the ZPY server:

    sudo systemctl reload nginx
    sudo systemctl start zpy

logs can be monitored via

    sudo journalctl -u zpy

nixops
------

it's possible to spin up a ZPY instance using nix.  i have no idea how, though.


[wk]: https://en.wikipedia.org/wiki/Sheng_ji
[zpy]: https://zpy.mxawng.com
