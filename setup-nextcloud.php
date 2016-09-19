<?php
/**
 * Nextcloud setup wizard
 *
 * @author Frank Karlitschek
 * @copyright 2012 Frank Karlitschek frank@owncloud.org
 * @author Lukas Reschke
 * @copyright 2013-2015 Lukas Reschke lukas@owncloud.com
 * @copyright 2016 Lukas Reschke lukas@statuscode.ch
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU AFFERO GENERAL PUBLIC LICENSE
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU AFFERO GENERAL PUBLIC LICENSE for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this library.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

/**
 * Please copy this file into your webserver root and open it with a browser. The setup wizard checks the dependency, downloads the newest Nextcloud version, unpacks it and redirects to the Nextcloud first run wizard.
 */

// Nextcloud version
define('NC_VERSION', '10.0.0');

// init
ob_start();
error_reporting(E_ERROR | E_WARNING | E_PARSE | E_NOTICE);
ini_set('display_errors', 1);
@set_time_limit(0);

/**
 * Setup class with a few helper functions
 */
class Setup {

	private static $requirements = array(
		array(
			'classes' => array(
				'ZipArchive' => 'zip',
				'DOMDocument' => 'dom',
				'XMLWriter' => 'XMLWriter'
			),
			'functions' => array(
				'xml_parser_create' => 'libxml',
				'mb_detect_encoding' => 'mb multibyte',
				'ctype_digit' => 'ctype',
				'json_encode' => 'JSON',
				'gd_info' => 'GD',
				'gzencode' => 'zlib',
				'iconv' => 'iconv',
				'simplexml_load_string' => 'SimpleXML',
				'hash' => 'HASH Message Digest Framework',
				'curl_init' => 'curl',
			),
			'defined' => array(
				'PDO::ATTR_DRIVER_NAME' => 'PDO'
			),
		)
	);


	/**
	* Checks if all the Nextcloud dependencies are installed
	* @return string with error messages
	*/
	static public function checkDependencies() {
		$error = '';
		$missingDependencies = array();

		// do we have PHP 5.4.0 or newer?
		if(version_compare(PHP_VERSION, '5.4.0', '<')) {
			$error.='PHP 5.4.0 is required. Please ask your server administrator to update PHP to version 5.4.0 or higher.<br/>';
		}

		// running oC on windows is unsupported since 8.1
		if(substr(PHP_OS, 0, 3) === "WIN") {
			$error.='Nextcloud Server does not support Microsoft Windows.<br/>';
		}

		foreach (self::$requirements[0]['classes'] as $class => $module) {
			if (!class_exists($class)) {
				$missingDependencies[] = array($module);
			}
		}
		foreach (self::$requirements[0]['functions'] as $function => $module) {
			if (!function_exists($function)) {
				$missingDependencies[] = array($module);
			}
		}
		foreach (self::$requirements[0]['defined'] as $defined => $module) {
			if (!defined($defined)) {
				$missingDependencies[] = array($module);
			}
		}

		if(!empty($missingDependencies)) {
			$error .= 'The following PHP modules are required to use Nextcloud:<br/>';
		}
		foreach($missingDependencies as $missingDependency) {
			$error .= '<li>'.$missingDependency[0].'</li>';
		}
		if(!empty($missingDependencies)) {
			$error .= '</ul><p style="text-align:center">Please contact your server administrator to install the missing modules.</p>';
		}

		// do we have write permission?
		if(!is_writable('.')) {
			$error.='Can\'t write to the current directory. Please fix this by giving the webserver user write access to the directory.<br/>';
		}

		return($error);
	}


	/**
	* Check the cURL version
	* @return bool status of CURLOPT_CERTINFO implementation
	*/
	static public function isCertInfoAvailable() {
		$curlDetails =  curl_version();
		return version_compare($curlDetails['version'], '7.19.1') != -1;
	}

	/**
	* Performs the Nextcloud install.
	* @return string with error messages
	*/
	static public function install() {
		$error = '';
		$directory = $_GET['directory'];

		// Test if folder already exists
		if(file_exists('./'.$directory.'/status.php')) {
			return 'The selected folder seems to already contain a Nextcloud installation. - You cannot use this script to update existing installations.';
		}

		// downloading latest release
		if (!file_exists('nc.zip')) {
			$error .= Setup::getFile('https://download.nextcloud.com/server/releases/nextcloud-'.NC_VERSION.'.zip','nc.zip');
		}

		// unpacking into nextcloud folder
		$zip = new ZipArchive;
		$res = $zip->open('nc.zip');
		if ($res==true) {
			// Extract it to the tmp dir
			$nextcloud_tmp_dir = 'tmp-nextcloud'.time();
			$zip->extractTo($nextcloud_tmp_dir);
			$zip->close();

			// Move it to the folder
			if ($_GET['directory'] === '.') {
				foreach (array_diff(scandir($nextcloud_tmp_dir.'/nextcloud'), array('..', '.')) as $item) {
					rename($nextcloud_tmp_dir.'/nextcloud/'.$item, './'.$item);
				}
				rmdir($nextcloud_tmp_dir.'/nextcloud');
			} else {
				rename($nextcloud_tmp_dir.'/nextcloud', './'.$directory);
			}
			// Delete the tmp folder
			rmdir($nextcloud_tmp_dir);
		} else {
			$error.='unzip of nextcloud source file failed.<br />';
		}

		// deleting zip file
		$result=@unlink('nc.zip');
		if($result==false) $error.='deleting of nc.zip failed.<br />';
		return($error);
	}


	/**
	* Downloads a file and stores it in the local filesystem
	* @param string $url
	* @param string$path
	* @return string with error messages
	*/
	static public function getFile($url,$path) {
		$error='';

		$fp = fopen ($path, 'w+');
		$ch = curl_init($url);
		curl_setopt($ch, CURLOPT_TIMEOUT, 0);
		curl_setopt($ch, CURLOPT_FILE, $fp);
		curl_setopt($ch, CURLOPT_USERAGENT, $_SERVER['HTTP_USER_AGENT']);
		if (Setup::isCertInfoAvailable()){
			curl_setopt($ch, CURLOPT_CERTINFO, TRUE);
		}
		curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, TRUE);
		$data=curl_exec($ch);
		$curlError=curl_error($ch);
		curl_close($ch);
		fclose($fp);

		if($data==false){
			$error.='download of Nextcloud source file failed.<br />'.$curlError;
		}
		return($error.$curlError);

	}


	/**
	* Shows the html header of the setup page
	*/
	static public function showHeader() {
		echo('
        <!DOCTYPE html>
        <html>
            <head>
                <title>Nextcloud Setup</title>
                <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
                <link rel="icon" type="image/png" href="https://nextcloud.com/wp-content/themes/next/assets/img/common/favicon.png" />
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <meta name="referrer" content="never">
                <meta name="theme-color" content="#0082c9">
				<style type="text/css">
				/* Copyright (c) 2011, Jan-Christoph Borchardt, http://jancborchardt.net
 This file is licensed under the Affero General Public License version 3 or later.
 See the COPYING-README file. */

html, body, div, span, object, iframe, h1, h2, h3, h4, h5, h6, p, blockquote, pre, a, abbr, acronym, address, code, del, dfn, em, img, q, dl, dt, dd, ol, ul, li, fieldset, form, label, legend, table, caption, tbody, tfoot, thead, tr, th, td, article, aside, dialog, figure, footer, header, hgroup, nav, section { margin:0; padding:0; border:0; outline:0; font-weight:inherit; font-size:100%; font-family:inherit; vertical-align:baseline; cursor:default; }
html, body { height:100%; }
article, aside, dialog, figure, footer, header, hgroup, nav, section { display:block; }
body { line-height:1.5; }
table { border-collapse:separate; border-spacing:0; white-space:nowrap; }
caption, th, td { text-align:left; font-weight:normal; }
table, td, th { vertical-align:middle; }
a { border:0; color:#000; text-decoration:none;}
a, a *, input, input *, select, .button span, label { cursor:pointer; }
ul { list-style:none; }

body {
	background-color: #ffffff;
	font-weight: 400;
	font-size: .8em;
	line-height: 1.6em;
	font-family: \'Open Sans\', Frutiger, Calibri, \'Myriad Pro\', Myriad, sans-serif;
	color: #000;
	height: auto;
}

#body-login {
	text-align: center;
	background-color: #0082c9;
	background-image: url(https://github.com/nextcloud/server/blob/master/core/img/background.jpg?raw=true);
	background-position: 50% 50%;
	background-repeat: no-repeat;
	background-size: cover;
}

.float-spinner {
	height: 32px;
	display: none;
}
#body-login .float-spinner {
	margin-top: -32px;
	padding-top: 32px;
}


/* LOG IN & INSTALLATION ------------------------------------------------------------ */

/* Some whitespace to the top */
#body-login #header {
	padding-top: 100px;
}
#body-login {
	background-attachment: fixed; /* fix background gradient */
	height: 100%; /* fix sticky footer */
}

/* Dark subtle label text */
#body-login p.info,
#body-login form fieldset legend,
#body-login #datadirContent label,
#body-login form fieldset .warning-info,
#body-login form input[type="checkbox"]+label {
	text-align: center;
	color: #fff;
}
/* overrides another !important statement that sets this to unreadable black */
#body-login form .warning input[type="checkbox"]:hover+label,
#body-login form .warning input[type="checkbox"]:focus+label,
#body-login form .warning input[type="checkbox"]+label {
	color: #fff !important;
}

#body-login form {
    width: 280px;
    margin: 0 auto;
}
#body-login .infogroup {
	margin-bottom: 15px;
}

#body-login p#message img {
	vertical-align: middle;
	padding: 5px;
}

#body-login div.buttons {
	text-align: center;
}
#body-login p.info {
	width: 22em;
	margin: 0 auto;
	padding-top: 20px;
	-webkit-user-select: none;
	-moz-user-select: none;
	-ms-user-select: none;
	user-select: none;
}
#body-login p.info a {
	font-weight: 600;
	padding: 13px;
	margin: -13px;
}

/* position log in button as confirm icon in right of password field */
#body-login #submit.login {
	position: absolute;
	right: 0;
	top: 0;
	border: none;
	background-color: transparent;
	-ms-filter: "progid:DXImageTransform.Microsoft.Alpha(Opacity=30)";
	opacity: .3;
}
#body-login #submit.login:hover,
#body-login #submit.login:focus {
	-ms-filter: "progid:DXImageTransform.Microsoft.Alpha(Opacity=70)";
	opacity: .7;
}
#body-login input[type="password"] {
	padding-right: 40px;
	box-sizing: border-box;
	min-width: 269px;
}

#body-login form fieldset {
	margin-bottom: 20px;
	text-align: left;
	-webkit-user-select: none;
	-moz-user-select: none;
	-ms-user-select: none;
	user-select: none;
}
#body-login form #sqliteInformation {
	margin-top: -20px;
	margin-bottom: 20px;
}
#body-login form #adminaccount {
	margin-bottom: 15px;
}
#body-login form fieldset legend, #datadirContent label {
	width: 100%;
}
#body-login #datadirContent label {
	display: block;
	margin: 0;
}
#body-login form #datadirField legend {
	margin-bottom: 15px;
}
#body-login #showAdvanced {
	padding: 13px; /* increase clickable area of Advanced dropdown */
}
#body-login #showAdvanced img {
	vertical-align: bottom; /* adjust position of Advanced dropdown arrow */
	margin-left: -4px;
}
#body-login .icon-info-white {
	padding: 10px;
}

/* strengthify wrapper */
#body-login .strengthify-wrapper {
	display: inline-block;
	position: relative;
	left: 15px;
	top: -23px;
	width: 250px;
}

/* tipsy for the strengthify wrapper looks better with following font settings */
#body-login .tipsy-inner {
	font-weight: bold;
	color: #ccc;
}

/* General new input field look */
#body-login input[type="text"],
#body-login input[type="password"],
#body-login input[type="email"] {
	border: none;
	font-weight: 300;
}

/* keep the labels for screen readers but hide them since we use placeholders */
label.infield {
	display: none;
}

#body-login p.info a {
    color: #fff;
}

#body-login footer .info {
	white-space: nowrap;
}

/* Warnings and errors are the same */
#body-login .warning,
#body-login .update,
#body-login .error {
	display: block;
	padding: 10px;
	background-color: rgba(0,0,0,.3);
	color: #fff;
	text-align: left;
	border-radius: 3px;
	cursor: default;
}

#body-login .v-align {
	width: inherit;
}

.warning legend,
.warning a,
.error a {
	color: #fff !important;
	font-weight: 600 !important;
}

.warning-input {
	border-color: #ce3702 !important;
}

/* Fixes for log in page, TODO should be removed some time */
#body-login .warning {
	margin: 0 7px 5px 4px;
}
#body-login .warning legend {
	-ms-filter: "progid:DXImageTransform.Microsoft.Alpha(Opacity=100)";
	opacity: 1;
}
#body-login a.warning {
	cursor: pointer;
}

/* Log in and install button */
#body-login input {
	font-size: 20px;
	margin: 5px;
	padding: 11px 10px 9px;
}
#body-login input[type="text"],
#body-login input[type="password"] {
	width: 249px;
}
#body-login input.login {
	width: auto;
	float: right;
}
#body-login input[type="submit"] {
	padding: 10px 20px; /* larger log in and installation buttons */
}

/* Sticky footer */
#body-login .wrapper {
	min-height: 100%;
	margin: 0 auto -70px;
	width: 300px;
}
#body-login footer, #body-login .push {
	height: 70px;
}


/* INPUTS */

/* specifically override browser styles */
input, textarea, select, button {
	font-family: \'Open Sans\', Frutiger, Calibri, \'Myriad Pro\', Myriad, sans-serif;
}

input[type="text"],
textarea,
select,
button, .button,
input[type="submit"],
input[type="button"],
.pager li a {
	width: 130px;
	margin: 3px 3px 3px 0;
	padding: 7px 6px 5px;
	font-size: 13px;
	background-color: #fff;
	color: #333;
	border: 1px solid #ddd;
	outline: none;
	border-radius: 3px;
}
input[type="hidden"] {
	height: 0;
	width: 0;
}
input[type="text"] {
	background: #fff;
	color: #555;
	cursor: text;
	font-family: inherit; /* use default ownCloud font instead of default textarea monospace */
}
input[type="text"] {
	-webkit-appearance:textfield;
	-moz-appearance:textfield;
	box-sizing:content-box;
}
input[type="text"]:hover, input[type="text"]:focus, input[type="text"]:active {
	color: #333;
	-ms-filter: "progid:DXImageTransform.Microsoft.Alpha(Opacity=100)";
	opacity: 1;
}

input[type="checkbox"].checkbox {
	position: absolute;
	left:-10000px;
	top: auto;
	width: 1px;
	height: 1px;
	overflow: hidden;
}

/* BUTTONS */
input[type="submit"], input[type="button"],
button, .button,
#quota, select, .pager li a {
	width: auto;
	min-width: 25px;
	padding: 5px;
	background-color: rgba(240,240,240,.9);
	font-weight: 600;
	color: #555;
	border: 1px solid rgba(240,240,240,.9);
	cursor: pointer;
}
select, .button.multiselect {
	font-weight: 400;
}
input[type="submit"]:hover, input[type="submit"]:focus,
input[type="button"]:hover, input[type="button"]:focus,
.button:hover, .button:focus,
.button a:focus,
select:hover, select:focus, select:active {
	background-color: rgba(255, 255, 255, .95);
	color: #111;
}
input[type="submit"] img, input[type="button"] img, button img, .button img { cursor:pointer; }
#header .button {
	border: none;
	box-shadow: none;
}

/* Primary action button, use sparingly */
.primary, input[type="submit"].primary, input[type="button"].primary, button.primary, .button.primary {
	border: 1px solid #0082c9;
	background-color: #00a2e9;
	color: #ddd;
}
.primary:hover, input[type="submit"].primary:hover, input[type="button"].primary:hover, button.primary:hover, .button.primary:hover,
.primary:focus, input[type="submit"].primary:focus, input[type="button"].primary:focus, button.primary:focus, .button.primary:focus {
	background-color: #0092d9;
	color: #fff;
}

                </style>
			</head>

			<body id="body-login">
		');
	}


	/**
	* Shows the html footer of the setup page
	*/
	static public function showFooter() {
		echo('
		<footer><p class="info"><a href="https://nextcloud.com/" target="_blank" rel="noreferrer">Nextcloud</a> &ndash; a safe home for all your data</p></footer>
		</body>
		</html>
		');
	}


	/**
	* Shows the html content part of the setup page
	* @param string $title
	* @param string $content
	* @param string $nextpage
	*/
	static public function showContent($title, $content, $nextpage=''){
		echo('
		<script>
			var validateForm = function(){
				if (typeof urlNotExists === "undefined"){
					return true;
				}
				urlNotExists(
					window.location.href, 
					function(){
						window.location.assign(document.forms["install"]["directory"].value);
					}
				);
				return false;
			}
		</script>
		<div id="login" class="wrapper">
		<div class="v-align">
			<header><div id="header">
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xml:space="preserve" height="100" width="210" enable-background="new 0 0 196.6 72" y="0px" x="0px" viewBox="0 0 62.000002 34"><path style="color-rendering:auto;text-decoration-color:#000000;color:#000000;isolation:auto;mix-blend-mode:normal;shape-rendering:auto;solid-color:#000000;block-progression:tb;text-decoration-line:none;image-rendering:auto;white-space:normal;text-indent:0;enable-background:accumulate;text-transform:none;text-decoration-style:solid" fill="#fff" d="m31.6 4.0001c-5.95 0.0006-10.947 4.0745-12.473 9.5549-1.333-2.931-4.266-5.0088-7.674-5.0092-4.6384 0.0005-8.4524 3.8142-8.453 8.4532-0.0008321 4.6397 3.8137 8.4544 8.4534 8.455 3.4081-0.000409 6.3392-2.0792 7.6716-5.011 1.5261 5.4817 6.5242 9.5569 12.475 9.5569 5.918 0.000457 10.89-4.0302 12.448-9.4649 1.3541 2.8776 4.242 4.9184 7.6106 4.9188 4.6406 0.000828 8.4558-3.8144 8.4551-8.455-0.000457-4.6397-3.8154-8.454-8.4551-8.4533-3.3687 0.0008566-6.2587 2.0412-7.6123 4.9188-1.559-5.4338-6.528-9.4644-12.446-9.464zm0 4.9623c4.4687-0.000297 8.0384 3.5683 8.0389 8.0371 0.000228 4.4693-3.5696 8.0391-8.0389 8.0388-4.4687-0.000438-8.0375-3.5701-8.0372-8.0388 0.000457-4.4682 3.5689-8.0366 8.0372-8.0371zm-20.147 4.5456c1.9576 0.000226 3.4908 1.5334 3.4911 3.491 0.000343 1.958-1.533 3.4925-3.4911 3.4927-1.958-0.000228-3.4913-1.5347-3.4911-3.4927 0.0002284-1.9575 1.5334-3.4907 3.4911-3.491zm40.205 0c1.9579-0.000343 3.4925 1.533 3.4927 3.491 0.000457 1.9584-1.5343 3.493-3.4927 3.4927-1.958-0.000228-3.4914-1.5347-3.4911-3.4927 0.000221-1.9575 1.5335-3.4907 3.4911-3.491z"/></svg>

			</div></header><br />
			<p style="text-align:center; font-size:28px; color:#fff; font-weight:bold;">'.$title.'</p><br />
			<form method="get" name="install" onsubmit="return validateForm();">
			    <p class="warning" style="text-align:center; font-size:13px;">'.$content.'</p>
				<input type="hidden" name="step" value="'.$nextpage.'" />
		');

		if($nextpage === 2) {
			echo ('<p class="warning">Enter a single "." to install in the current directory, or enter a subdirectory to install to:</p>
				<input type="text" name="directory" value="nextcloud" required="required" />');
		}
		if($nextpage === 3) {
			echo ('<input type="hidden" value="'.$_GET['directory'].'" name="directory" />');
		}

		if($nextpage<>'') echo('<input type="submit" id="submit" class="primary button" value="Next" />');

		echo('
		</form>
		<div class="push"></div>
		</div>
		</div>
		');
	}

	/**
	 * JS function to check if user deleted this script
	 * N.B. We can't reload the page to check this with PHP:
	 * once script is deleted we end up with 404
	 */
	static public function showJsValidation(){
		echo '
		<script>
			var urlNotExists = function(url, callback){
				var xhr = new XMLHttpRequest();
				xhr.open(\'HEAD\', encodeURI(url));
				xhr.onload = function() {
					if (xhr.status === 404){
						callback();
					}
				};
				xhr.send();
			};
		</script>
		';
	}


	/**
	* Shows the welcome screen of the setup wizard
	*/
	static public function showWelcome() {
		$txt='Welcome to the Setup Wizard for<br /><b>Nextcloud '.NC_VERSION.'</b>!<br /><br />This wizard will:<br />1. Check the server dependencies<br />2. Download Nextcloud<br />3. Install Nextcloud in a few simple steps';
		Setup::showContent('Setup Wizard',$txt,1);
	}


	/**
	* Shows the check dependencies screen
	*/
	static public function showCheckDependencies() {
		$error=Setup::checkDependencies();
		if($error=='') {
			$txt='All Nextcloud dependencies found';
			Setup::showContent('Dependency check',$txt,2);
		}else{
			$txt='Dependencies not found.<br />'.$error;
			Setup::showContent('Dependency check',$txt);
		}
	}


	/**
	* Shows the install screen
	*/
	static public function showInstall() {
		$error=Setup::install();

		if($error=='') {
			$txt='Nextcloud is now installed';
			Setup::showContent('Success',$txt,3);
		}else{
			$txt='Nextcloud is NOT installed<br />'.$error;
			Setup::showContent('Error',$txt);
		}
	}

	/**
	 * Shows the redirect screen
	 */
	static public function showRedirect() {
		// delete own file
		@unlink(__FILE__);
		clearstatcache();
		if (file_exists(__FILE__)){
			Setup::showJsValidation();
			Setup::showContent(
				'Warning',
				'Failed to remove installer script. Please remove ' . __FILE__ . ' manually',
				3
			);
		} else {
			// redirect to Nextcloud
			header("Location: " . $_GET['directory']);
		}
	}

}


// read the step get variable
$step = isset($_GET['step']) ? $_GET['step'] : 0;

// show the header
Setup::showHeader();

// show the right step
if     ($step==0) Setup::showWelcome();
elseif ($step==1) Setup::showCheckDependencies();
elseif ($step==2) Setup::showInstall();
elseif ($step==3) Setup::showRedirect();
else  echo('Internal error. Please try again.');

// show the footer
Setup::showFooter();
