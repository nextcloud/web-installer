# 🕸️ Nextcloud Web Installer

The Web Installer is an easy way to install Nextcloud Server in a shared/managed web space (e.g. shared hosting) **if you don't have access to the command line** and **if your environment meets the requirements listed below**.

It downloads the [latest stable release](https://docs.nextcloud.com/server/latest/admin_manual/release_schedule.html), checks PHP dependencies and target folder permissions, unpacks the files with the right permissions, and redirects you to the [Nextcloud Server Installation Wizard](https://docs.nextcloud.com/server/stable/admin_manual/installation/installation_wizard.html).

<img width="1279" alt="web-installer_step_1" src="https://github.com/nextcloud/web-installer/assets/1731941/cb4a9333-268d-4c80-a404-d03c5662ada0">

## Requirements

> [!WARNING]
> These requirements are stricter than the [standard Nextcloud Server System Requirements](https://docs.nextcloud.com/server/stable/admin_manual/installation/system_requirements.html#system-requirements).

* PHP Runtime:
  - [Same as for latest stable version of Nextcloud Server](https://docs.nextcloud.com/server/stable/admin_manual/installation/system_requirements.html#server) (currently PHP 8.x)
* Webserver:
  - Apache 2.4 with `mod_php` or `php-fpm`
  - The `AllowOverride All` option must be enabled for the target installation folder
  - The `mod_rewrite` module must be enabled

It is possible to use this with other web servers, such as nginx, but you will need to prepare your web server configuration ahead of time since the web-install cannot utilize `.htaccess` files. See the [Admin Manual](https://docs.nextcloud.com/server/latest/admin_manual/installation/nginx.html) for the latest nginx config.

> [!NOTE]
> [Other installation methods](https://docs.nextcloud.com/server/stable/admin_manual/installation/source_installation.html) support other web servers (e.g. NGINX) and usage scenarios. See the [Nextcloud Administration Manual](https://docs.nextcloud.com) for further guidance including other [installation methods](https://docs.nextcloud.com/server/stable/admin_manual/installation/source_installation.html) and their [system requirements](https://docs.nextcloud.com/server/stable/admin_manual/installation/system_requirements.html#system-requirements)).

## Usage

Copy this file into your webserver root and open it with a browser by visiting `http(s)://domain.tld/setup-nextcloud.php`. You will be immediately prompted to either install in the same folder or into a subfolder.

<img width="1278" alt="web-installer_step_2" src="https://github.com/nextcloud/web-installer/assets/1731941/f9a13817-2500-4a8f-a8d6-1ec01b41912a">

When the base installation is completed, you will be redirected to the [Nextcloud Server Installation/Setup Wizard](https://docs.nextcloud.com/server/stable/admin_manual/installation/installation_wizard.html) after clicking the *Next* button.

<img width="1279" alt="web-installer_step_3" src="https://github.com/nextcloud/web-installer/assets/1731941/d71a67c2-b0c1-4954-aba4-6cfdb73becb6">

> [!TIP]
> For details about how to answer the questions asked in the setup wizard, see [Installation Wizard](https://docs.nextcloud.com/server/stable/admin_manual/installation/installation_wizard.html#installation-wizard) in the Nextcloud Server Admin Manual.


## Further Documentation

* The Admin Manual has a small section [about the Web Installer](https://docs.nextcloud.com/server/stable/admin_manual/installation/source_installation.html#installation-via-web-installer-on-a-vps-or-web-space).
* [Nextcloud configuration](https://docs.nextcloud.com/server/stable/admin_manual/configuration_server/index.html)
