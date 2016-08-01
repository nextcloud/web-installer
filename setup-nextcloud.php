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
			$error .= Setup::getFile('https://download.nextcloud.com/server/releases/nextcloud-9.0.53.zip','nc.zip');
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
				<style type="text/css">
				body {
					text-align:center;
					font-size:13px;
					color:#666;
					font-weight:bold;
				}
				html, body, div, span, object, iframe, h1, h2, h3, h4, h5, h6, p, blockquote, pre, a, abbr, acronym, address, code, del, dfn, em, img, q, dl, dt, dd, ol, ul, li, fieldset, form, label, legend, table, caption, tbody, tfoot, thead, tr, th, td, article, aside, dialog, figure, footer, header, hgroup, nav, section { 
					margin:0; 
					padding:0; 
					border:0; 
					outline:0; 
					font-weight:inherit; 
					font-size:100%; 
					font-family:inherit; 
					vertical-align:baseline; 
					cursor:default; 
				}
				html, body { 
					height: 100%; 
				}
				article, aside, dialog, figure, footer, header, hgroup, nav, section { 
					display:block;
				}
				body { 
					line-height:1.5;
				}
				table {
				    border-collapse: separate;
				    border-spacing: 0;
				    white-space: nowrap;
				}
				caption,
				th,
				td {
				    text-align: left;
				    font-weight: normal;
				}
				table,
				td,
				th {
				    vertical-align: middle;
				}
				a {
				    border: 0;
				    color: #000;
				    text-decoration: none;
				}
				a,
				a *,
				input,
				input *,
				select,
				.button span,
				li,
				label {
				    cursor: pointer;
				}
				ul {
				    list-style: none;
				}
				body {
				    background: #fefefe;
				    font: normal .8em/1.6em "Lucida Grande", Arial, Verdana, sans-serif;
				    color: #000;
				}
				/* HEADERS */
				
				#body-user #header,
				#body-settings #header {
				    position: fixed;
				    top: 0;
				    left: 0;
				    right: 0;
				    z-index: 100;
				    height: 2.5em;
				    line-height: 2.5em;
				    padding: .5em;
				    background: #1d2d44;
				    -moz-box-shadow: 0 0 10px rgba(0, 0, 0, .5), inset 0 -2px 10px #222;
				    -webkit-box-shadow: 0 0 10px rgba(0, 0, 0, .5), inset 0 -2px 10px #222;
				    box-shadow: 0 0 10px rgba(0, 0, 0, .5), inset 0 -2px 10px #222;
				}
				#body-login #header {
				    margin: -2em auto 0;
				    text-align: center;
				    height: 10em;
				    padding: 1em 0 .5em;
				    -moz-box-shadow: 0 0 1em rgba(0, 0, 0, .5);
				    -webkit-box-shadow: 0 0 1em rgba(0, 0, 0, .5);
				    box-shadow: 0 0 1em rgba(0, 0, 0, .5);
				    background: #1d2d44;
				    /* Old browsers */
				    
				    background: -moz-linear-gradient(top, #35537a 0%, #1d2d42 100%);
				    /* FF3.6+ */
				    
				    background: -webkit-gradient(linear, left top, left bottom, color-stop(0%, #35537a), color-stop(100%, #1d2d42));
				    /* Chrome,Safari4+ */
				    
				    background: -webkit-linear-gradient(top, #35537a 0%, #1d2d42 100%);
				    /* Chrome10+,Safari5.1+ */
				    
				    background: -o-linear-gradient(top, #35537a 0%, #1d2d42 100%);
				    /* Opera11.10+ */
				    
				    background: -ms-linear-gradient(top, #35537a 0%, #1d2d42 100%);
				    /* IE10+ */
				    
				    background: linear-gradient(top, #35537a 0%, #1d2d42 100%);
				    /* W3C */
				    
				    filter: progid: DXImageTransform.Microsoft.gradient( startColorstr="#35537a", endColorstr="#1d2d42", GradientType=0);
				    /* IE6-9 */
				}
				.header-right {
				    float: right;
				    vertical-align: middle;
				    padding: 0 0.5em;
				}
				.header-right > * {
				    vertical-align: middle;
				}
				/* INPUTS */
				
				input[type="text"],
				input[type="password"] {
				    cursor: text;
				}
				input,
				textarea,
				select,
				button,
				.button,
				#quota,
				div.jp-progress,
				.pager li a {
				    font-size: 1em;
				    width: 10em;
				    margin: .3em;
				    padding: .6em .5em .4em;
				    background: #fff;
				    color: #333;
				    border: 1px solid #ddd;
				    -moz-box-shadow: 0 1px 1px #fff, 0 2px 0 #bbb inset;
				    -webkit-box-shadow: 0 1px 1px #fff, 0 1px 0 #bbb inset;
				    box-shadow: 0 1px 1px #fff, 0 1px 0 #bbb inset;
				    -moz-border-radius: .5em;
				    -webkit-border-radius: .5em;
				    border-radius: .5em;
				    outline: none;
				}
				input[type="text"],
				input[type="password"],
				input[type="search"] {
				    background: #f8f8f8;
				    color: #555;
				    cursor: text;
				}
				input[type="text"],
				input[type="password"],
				input[type="search"] {
				    -webkit-appearance: textfield;
				    -moz-appearance: textfield;
				    -webkit-box-sizing: content-box;
				    -moz-box-sizing: content-box;
				    box-sizing: content-box;
				}
				input[type="text"]:hover,
				input[type="text"]:focus,
				input[type="text"]:active,
				input[type="password"]:hover,
				input[type="password"]:focus,
				input[type="password"]:active,
				.searchbox input[type="search"]:hover,
				.searchbox input[type="search"]:focus,
				.searchbox input[type="search"]:active {
				    background-color: #fff;
				    color: #333;
				    -ms-filter: "progid:DXImageTransform.Microsoft.Alpha(Opacity=100)";
				    filter: alpha(opacity=100);
				    opacity: 1;
				}
				input[type="submit"],
				input[type="button"],
				button,
				.button,
				#quota,
				div.jp-progress,
				select,
				.pager li a {
				    width: auto;
				    padding: .4em;
				    border: 1px solid #ddd;
				    font-weight: bold;
				    cursor: pointer;
				    background: #f8f8f8;
				    color: #555;
				    text-shadow: #fff 0 1px 0;
				    -moz-box-shadow: 0 1px 1px #fff, 0 1px 1px #fff inset;
				    -webkit-box-shadow: 0 1px 1px #fff, 0 1px 1px #fff inset;
				    -moz-border-radius: .5em;
				    -webkit-border-radius: .5em;
				    border-radius: .5em;
				}
				input[type="submit"]:hover,
				input[type="submit"]:focus,
				input[type="button"]:hover,
				select:hover,
				select:focus,
				select:active,
				input[type="button"]:focus,
				.button:hover {
				    background: #fff;
				    color: #333;
				}
				input[type="checkbox"] {
				    width: auto;
				}
				#quota {
				    cursor: default;
				}
				#body-login input {
				    font-size: 1.5em;
				}
				#body-login input[type="text"],
				#body-login input[type="password"] {
				    width: 13em;
				}
				#body-login input.login {
				    width: auto;
				    float: right;
				}
				#remember_login {
				    margin: .8em .2em 0 1em;
				}
				input[type="submit"].enabled {
				    background: #66f866;
				    border: 1px solid #5e5;
				    -moz-box-shadow: 0 1px 1px #f8f8f8, 0 1px 1px #cfc inset;
				    -webkit-box-shadow: 0 1px 1px #f8f8f8, 0 1px 1px #cfc inset;
				    box-shadow: 0 1px 1px #f8f8f8, 0 1px 1px #cfc inset;
				}
				input[type="submit"].highlight {
				    background: #ffc100;
				    border: 1px solid #db0;
				    text-shadow: #ffeedd 0 1px 0;
				    -moz-box-shadow: 0 1px 1px #f8f8f8, 0 1px 1px #ffeedd inset;
				    -webkit-box-shadow: 0 1px 1px #f8f8f8, 0 1px 1px #ffeedd inset;
				    box-shadow: 0 1px 1px #f8f8f8, 0 1px 1px #ffeedd inset;
				}
				#select_all {
				    margin-top: .4em !important;
				}
				/* CONTENT ------------------------------------------------------------------ */
				
				#controls {
				    padding: 0 0.5em;
				    width: 100%;
				    top: 3.5em;
				    height: 2.8em;
				    margin: 0;
				    background: #f7f7f7;
				    border-bottom: 1px solid #eee;
				    position: fixed;
				    z-index: 50;
				    -moz-box-shadow: 0 -3px 7px #000;
				    -webkit-box-shadow: 0 -3px 7px #000;
				    box-shadow: 0 -3px 7px #000;
				}
				#controls .button {
				    display: inline-block;
				}
				#content {
				    top: 3.5em;
				    left: 12.5em;
				    position: absolute;
				}
				#leftcontent,
				.leftcontent {
				    position: fixed;
				    overflow: auto;
				    top: 6.4em;
				    width: 20em;
				    background: #f8f8f8;
				    border-right: 1px solid #ddd;
				}
				#leftcontent li,
				.leftcontent li {
				    background: #f8f8f8;
				    padding: .5em .8em;
				    white-space: nowrap;
				    overflow: hidden;
				    text-overflow: ellipsis;
				    -webkit-transition: background-color 200ms;
				    -moz-transition: background-color 200ms;
				    -o-transition: background-color 200ms;
				    transition: background-color 200ms;
				}
				#leftcontent li:hover,
				#leftcontent li:active,
				#leftcontent li.active,
				.leftcontent li:hover,
				.leftcontent li:active,
				.leftcontent li.active {
				    background: #eee;
				}
				#leftcontent li.active,
				.leftcontent li.active {
				    font-weight: bold;
				}
				#leftcontent li:hover,
				.leftcontent li:hover {
				    color: #333;
				    background: #ddd;
				}
				#leftcontent a {
				    height: 100%;
				    display: block;
				    margin: 0;
				    padding: 0 1em 0 0;
				    float: left;
				}
				#rightcontent,
				.rightcontent {
				    position: fixed;
				    top: 6.4em;
				    left: 32.5em;
				    overflow: auto
				}
				/* LOG IN & INSTALLATION ------------------------------------------------------------ */
				
				#body-login {
				    background: #ddd;
				}
				#body-login div.buttons {
				    text-align: center;
				}
				#body-login p.info {
				    width: 22em;
				    text-align: center;
				    margin: 2em auto;
				    color: #777;
				    text-shadow: #fff 0 1px 0;
				}
				#body-login p.info a {
				    font-weight: bold;
				    color: #777;
				}
				#login {
				    min-height: 30em;
				    margin: 2em auto 0;
				    border-bottom: 1px solid #f8f8f8;
				    background: #eee;
				}
				#login form {
				    width: 22em;
				    margin: 2em auto 2em;
				    padding: 0;
				}
				#login form fieldset {
				    background: 0;
				    border: 0;
				    margin-bottom: 2em;
				    padding: 0;
				}
				#login form fieldset legend {
				    font-weight: bold;
				}
				#login form label {
				    margin: .95em 0 0 .85em;
				    color: #666;
				}
				/* NEEDED FOR INFIELD LABELS */
				
				p.infield {
				    position: relative;
				}
				label.infield {
				    cursor: text !important;
				}
				#login form label.infield {
				    position: absolute;
				    font-size: 1.5em;
				    color: #AAA;
				}
				#login #dbhostlabel,
				#login #directorylabel {
				    display: block;
				    margin: .95em 0 .8em -8em;
				}
				#login form input[type="checkbox"]+label {
				    position: relative;
				    margin: 0;
				    font-size: 1em;
				    text-shadow: #fff 0 1px 0;
				}
				#login form .errors {
				    background: #fed7d7;
				    border: 1px solid #f00;
				    list-style-indent: inside;
				    margin: 0 0 2em;
				    padding: 1em;
				}
				#login form #selectDbType {
				    text-align: center;
				}
				#login form #selectDbType label {
				    position: static;
				    font-size: 1em;
				    margin: 0 -.3em 1em;
				    cursor: pointer;
				    padding: .4em;
				    border: 1px solid #ddd;
				    font-weight: bold;
				    background: #f8f8f8;
				    color: #555;
				    text-shadow: #eee 0 1px 0;
				    -moz-box-shadow: 0 1px 1px #fff, 0 1px 1px #fff inset;
				    -webkit-box-shadow: 0 1px 1px #fff, 0 1px 1px #fff inset;
				}
				#login form #selectDbType label span {
				    cursor: pointer;
				    font-size: 0.9em;
				}
				#login form #selectDbType label.ui-state-hover span,
				#login form #selectDbType label.ui-state-active span {
				    color: #000;
				}
				#login form #selectDbType label.ui-state-hover,
				#login form #selectDbType label.ui-state-active {
				    color: #333;
				    background-color: #ccc;
				}
				/* NAVIGATION ------------------------------------------------------------- */
				
				#navigation {
				    position: fixed;
				    top: 3.5em;
				    float: left;
				    width: 12.5em;
				    padding: 0;
				    z-index: 75;
				    height: 100%;
				    background: #eee;
				    border-right: 1px #ccc solid;
				    -moz-box-shadow: -3px 0 7px #000;
				    -webkit-box-shadow: -3px 0 7px #000;
				    box-shadow: -3px 0 7px #000;
				    overflow: hidden;
				}
				#navigation a {
				    display: block;
				    padding: .6em .5em .4em 2.5em;
				    background: #eee 1em center no-repeat;
				    border-bottom: 1px solid #ddd;
				    border-top: 1px solid #fff;
				    text-decoration: none;
				    font-size: 1.2em;
				    color: #666;
				    text-shadow: #f8f8f8 0 1px 0;
				    -webkit-transition: background 300ms;
				    -moz-transition: background 300ms;
				    -o-transition: background 300ms;
				    transition: background 300ms;
				}
				#navigation a.active,
				#navigation a:hover,
				#navigation a:focus {
				    background-color: #dbdbdb;
				    border-top: 1px solid #d4d4d4;
				    border-bottom: 1px solid #ccc;
				    color: #333;
				}
				#navigation a.active {
				    background-color: #ddd;
				}
				#navigation #settings {
				    position: absolute;
				    bottom: 3.5em;
				    width: 100%;
				}
				#expand {
				    position: relative;
				    z-index: 100;
				    margin-bottom: -.5em;
				    padding: .5em 10.1em .7em 1.2em;
				    cursor: pointer;
				}
				#expand+span {
				    position: absolute;
				    z-index: 99;
				    margin: -1.7em 0 0 2.5em;
				    font-size: 1.2em;
				    color: #666;
				    text-shadow: #f8f8f8 0 1px 0;
				    -ms-filter: "progid:DXImageTransform.Microsoft.Alpha(Opacity=0)";
				    filter: alpha(opacity=0);
				    opacity: 0;
				    -webkit-transition: opacity 300ms;
				    -moz-transition: opacity 300ms;
				    -o-transition: opacity 300ms;
				    transition: opacity 300ms;
				}
				#expand:hover+span,
				#expand+span:hover {
				    -ms-filter: "progid:DXImageTransform.Microsoft.Alpha(Opacity=100)";
				    filter: alpha(opacity=100);
				    opacity: 1;
				    cursor: pointer;
				}
				/* VARIOUS REUSABLE SELECTORS */
				
				.hidden {
				    display: none;
				}
				.bold {
				    font-weight: bold;
				}
				.center {
				    text-align: center;
				}
				#notification {
				    z-index: 101;
				    background-color: #fc4;
				    border: 0;
				    padding: 0 .7em .3em;
				    display: none;
				    position: fixed;
				    left: 50%;
				    top: 0;
				    -moz-border-radius-bottomleft: 1em;
				    -webkit-border-bottom-left-radius: 1em;
				    border-bottom-left-radius: 1em;
				    -moz-border-radius-bottomright: 1em;
				    -webkit-border-bottom-right-radius: 1em;
				    border-bottom-right-radius: 1em;
				}
				.action,
				.selectedActions a {
				    -ms-filter: "progid:DXImageTransform.Microsoft.Alpha(Opacity=50)";
				    filter: alpha(opacity=50);
				    opacity: .5;
				    -webkit-transition: opacity 200ms;
				    -moz-transition: opacity 200ms;
				    -o-transition: opacity 200ms;
				    transition: opacity 200ms;
				}
				.action {
				    width: 16px;
				    height: 16px;
				}
				.header-action {
				    -ms-filter: "progid:DXImageTransform.Microsoft.Alpha(Opacity=80)";
				    filter: alpha(opacity=80);
				    opacity: .8;
				}
				.action:hover,
				.selectedActions a:hover,
				.header-action:hover {
				    -ms-filter: "progid:DXImageTransform.Microsoft.Alpha(Opacity=100)";
				    filter: alpha(opacity=100);
				    opacity: 1;
				}
				table:not(.nostyle) tr {
				    -webkit-transition: background-color 200ms;
				    -moz-transition: background-color 200ms;
				    -o-transition: background-color 200ms;
				    transition: background-color 200ms;
				}
				tbody tr:hover,
				tr:active {
				    background-color: #f8f8f8;
				}
				#body-settings .personalblock,
				#body-settings .helpblock {
				    padding: .5em 1em;
				    margin: 1em;
				    background: #f8f8f8;
				    color: #555;
				    text-shadow: #fff 0 1px 0;
				    -moz-border-radius: .5em;
				    -webkit-border-radius: .5em;
				    border-radius: .5em;
				}
				#body-settings .personalblock#quota {
				    position: relative;
				    padding: 0;
				}
				#body-settings #controls+.helpblock {
				    position: relative;
				    margin-top: 3em;
				}
				.personalblock > legend {
				    margin-top: 2em;
				}
				.personalblock > legend,
				th,
				dt,
				label {
				    font-weight: bold;
				}
				code {
				    font-family: "Lucida Console", "Lucida Sans Typewriter", "DejaVu Sans Mono", monospace;
				}
				#quota div,
				div.jp-play-bar,
				div.jp-seek-bar {
				    padding: 0;
				    background: #e6e6e6;
				    font-weight: normal;
				    white-space: nowrap;
				    -moz-border-radius-bottomleft: .4em;
				    -webkit-border-bottom-left-radius: .4em;
				    border-bottom-left-radius: .4em;
				    -moz-border-radius-topleft: .4em;
				    -webkit-border-top-left-radius: .4em;
				    border-top-left-radius: .4em;
				}
				#quotatext {
				    padding: .6em 1em;
				}
				div.jp-play-bar,
				div.jp-seek-bar {
				    padding: 0;
				}
				.pager {
				    list-style: none;
				    float: right;
				    display: inline;
				    margin: .7em 13em 0 0;
				}
				.pager li {
				    display: inline-block;
				}
				li.error {
				    width: 640px;
				    margin: 4em auto;
				    padding: 1em 1em 1em 4em;
				    background: #ffe .8em .8em no-repeat;
				    color: #FF3B3B;
				    border: 1px solid #ccc;
				    -moz-border-radius: 10px;
				    -webkit-border-radius: 10px;
				    border-radius: 10px;
				}
				.ui-state-default,
				.ui-widget-content .ui-state-default,
				.ui-widget-header .ui-state-default {
				    overflow: hidden;
				    text-overflow: ellipsis;
				}
				.hint {
				    background-repeat: no-repeat;
				    color: #777777;
				    padding-left: 25px;
				    background-position: 0 0.3em;
				}
				.separator {
				    display: inline;
				    border-left: 1px solid #d3d3d3;
				    border-right: 1px solid #fff;
				    height: 10px;
				    width: 0px;
				    margin: 4px;
				}
				a.bookmarklet {
				    background-color: #ddd;
				    border: 1px solid #ccc;
				    padding: 5px;
				    padding-top: 0px;
				    padding-bottom: 2px;
				    text-decoration: none;
				    margin-top: 5px
				}
				.exception {
				    color: #000000;
				}
				.exception textarea {
				    width: 95%;
				    height: 200px;
				    background: #ffe;
				    border: 0;
				}
				/* ---- DIALOGS ---- */
				
				#dirtree {
				    width: 100%;
				}
				#filelist {
				    height: 270px;
				    overflow: scroll;
				    background-color: white;
				    width: 100%;
				}
				.filepicker_element_selected {
				    background-color: lightblue;
				}
				.filepicker_loader {
				    height: 120px;
				    width: 100%;
				    background-color: #333;
				    -ms-filter: "progid:DXImageTransform.Microsoft.Alpha(Opacity=30)";
				    filter: alpha(opacity=30);
				    opacity: .3;
				    visibility: visible;
				    position: absolute;
				    top: 0;
				    left: 0;
				    text-align: center;
				    padding-top: 150px;
				}
				/* ---- CATEGORIES ---- */
				
				#categoryform .scrollarea {
				    position: absolute;
				    left: 10px;
				    top: 10px;
				    right: 10px;
				    bottom: 50px;
				    overflow: auto;
				    border: 1px solid #ddd;
				    background: #f8f8f8;
				}
				#categoryform .bottombuttons {
				    position: absolute;
				    bottom: 10px;
				}
				#categoryform .bottombuttons * {
				    float: left;
				}
				/*#categorylist { border:1px solid #ddd;}*/
				
				#categorylist li {
				    background: #f8f8f8;
				    padding: .3em .8em;
				    white-space: nowrap;
				    overflow: hidden;
				    text-overflow: ellipsis;
				    -webkit-transition: background-color 500ms;
				    -moz-transition: background-color 500ms;
				    -o-transition: background-color 500ms;
				    transition: background-color 500ms;
				}
				#categorylist li:hover,
				li:active {
				    background: #eee;
				}
				#category_addinput {
				    width: 10em;
				}
				/* ---- APP SETTINGS ---- */
				.arrow {
				    border-bottom: 10px solid white;
				    border-left: 10px solid transparent;
				    border-right: 10px solid transparent;
				    display: block;
				    height: 0;
				    position: absolute;
				    width: 0;
				    z-index: 201;
				}
				.arrow.left {
				    left: -13px;
				    bottom: 1.2em;
				    -webkit-transform: rotate(270deg);
				    -moz-transform: rotate(270deg);
				    -o-transform: rotate(270deg);
				    -ms-transform: rotate(270deg);
				    transform: rotate(270deg);
				}
				.arrow.up {
				    top: -8px;
				    right: 2em;
				}
				.arrow.down {
				    -webkit-transform: rotate(180deg);
				    -moz-transform: rotate(180deg);
				    -o-transform: rotate(180deg);
				    -ms-transform: rotate(180deg);
				    transform: rotate(180deg);
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
		<footer><p class="info"><a href="https://nextcloud.com/">Nextcloud</a> &ndash; a safe home for all your data</p></footer>
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
		<div id="login">
			<header><div id="header">
				
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
   xmlns:dc="http://purl.org/dc/elements/1.1/"
   xmlns:cc="http://creativecommons.org/ns#"
   xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
   xmlns:svg="http://www.w3.org/2000/svg"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   version="1.1"
   id="Layer_1"
   style="padding-top: 20px;"
   x="0px"
   y="0px"
   viewBox="0 0 195.69999 73.878937"
   enable-background="new 0 0 196.6 72"
   xml:space="preserve"
   inkscape:version="0.91 r13725"
   sodipodi:docname="logo_nextcloud_white.svg"
   width="195.7"
   height="73.878937"><metadata
     id="metadata20"><rdf:RDF><cc:Work
         rdf:about=""><dc:format>image/svg+xml</dc:format><dc:type
           rdf:resource="http://purl.org/dc/dcmitype/StillImage" /><dc:title></dc:title></cc:Work></rdf:RDF></metadata><defs
     id="defs18" /><sodipodi:namedview
     pagecolor="#ffffff"
     bordercolor="#666666"
     borderopacity="1"
     objecttolerance="10"
     gridtolerance="10"
     guidetolerance="10"
     inkscape:pageopacity="0"
     inkscape:pageshadow="2"
     inkscape:window-width="2560"
     inkscape:window-height="1399"
     id="namedview16"
     showgrid="false"
     inkscape:zoom="8"
     inkscape:cx="42.118341"
     inkscape:cy="45.448742"
     inkscape:current-layer="Layer_1"
     fit-margin-top="1"
     fit-margin-left="1"
     fit-margin-right="1"
     fit-margin-bottom="1"
     inkscape:window-x="0"
     inkscape:window-y="240"
     inkscape:window-maximized="1" /><circle
     style="fill:none;stroke:#ffffff;stroke-width:5.56589985;stroke-miterlimit:10;stroke-opacity:1"
     id="XMLID_107_"
     stroke-miterlimit="10"
     cx="100.01611"
     cy="15.582951"
     r="11.8" /><circle
     style="fill:none;stroke:#ffffff;stroke-width:5.56589985;stroke-miterlimit:10;stroke-opacity:1"
     id="XMLID_106_"
     stroke-miterlimit="10"
     cx="122.51611"
     cy="15.582951"
     r="6.6999998" /><circle
     style="fill:none;stroke:#ffffff;stroke-width:5.56589985;stroke-miterlimit:10;stroke-opacity:1"
     id="XMLID_105_"
     stroke-miterlimit="10"
     cx="77.416115"
     cy="15.582951"
     r="6.6999998" /><g
     id="g4571"
     style="fill:#ffffff"
     transform="translate(0.99999237,0.87893724)"><path
       id="XMLID_121_"
       d="m 37.669669,48.9 c 5.9,0 9.2,4.2 9.2,10.5 0,0.6 -0.5,1.1 -1.1,1.1 l -15.9,0 c 0.1,5.6 4,8.8 8.5,8.8 2.8,0 4.8,-1.2 5.8,-2 0.6,-0.4 1.1,-0.3 1.4,0.3 l 0.3,0.5 c 0.3,0.5 0.2,1 -0.3,1.4 -1.2,0.9 -3.8,2.4 -7.3,2.4 -6.5,0 -11.5,-4.7 -11.5,-11.5 0.1,-7.2 4.9,-11.5 10.9,-11.5 z m 6.1,9.4 c -0.2,-4.6 -3,-6.9 -6.2,-6.9 -3.7,0 -6.9,2.4 -7.6,6.9 l 13.8,0 z"
       inkscape:connector-curvature="0"
       style="fill:#ffffff" /><path
       id="XMLID_119_"
       d="m 76.9,52.1 0,-2.5 0,-5.2 c 0,-0.7 0.4,-1.1 1.1,-1.1 l 0.8,0 c 0.7,0 1,0.4 1,1.1 l 0,5.2 4.5,0 c 0.7,0 1.1,0.4 1.1,1.1 l 0,0.3 c 0,0.7 -0.4,1 -1.1,1 l -4.5,0 0,11 c 0,5.1 3.1,5.7 4.8,5.8 0.9,0.1 1.2,0.3 1.2,1.1 l 0,0.6 c 0,0.7 -0.3,1 -1.2,1 -4.8,0 -7.7,-2.9 -7.7,-8.1 l 0,-11.3 z"
       inkscape:connector-curvature="0"
       style="fill:#ffffff" /><path
       id="XMLID_117_"
       d="m 99.8,48.9 c 3.8,0 6.2,1.6 7.3,2.5 0.5,0.4 0.6,0.9 0.1,1.5 l -0.3,0.5 c -0.4,0.6 -0.9,0.6 -1.5,0.2 -1,-0.7 -2.9,-2 -5.5,-2 -4.8,0 -8.6,3.6 -8.6,8.9 0,5.2 3.8,8.8 8.6,8.8 3.1,0 5.2,-1.4 6.2,-2.3 0.6,-0.4 1,-0.3 1.4,0.3 l 0.3,0.4 c 0.3,0.6 0.2,1 -0.3,1.5 -1.1,0.9 -3.8,2.8 -7.8,2.8 -6.5,0 -11.5,-4.7 -11.5,-11.5 0.1,-6.8 5.1,-11.6 11.6,-11.6 z"
       inkscape:connector-curvature="0"
       style="fill:#ffffff" /><path
       id="XMLID_115_"
       d="m 113.1,41.8 c 0,-0.7 -0.4,-1.1 0.3,-1.1 l 0.8,0 c 0.7,0 1.8,0.4 1.8,1.1 l 0,23.9 c 0,2.8 1.3,3.1 2.3,3.2 0.5,0 0.9,0.3 0.9,1 l 0,0.7 c 0,0.7 -0.3,1.1 -1.1,1.1 -1.8,0 -5,-0.6 -5,-5.4 l 0,-24.5 z"
       inkscape:connector-curvature="0"
       style="fill:#ffffff" /><path
       id="XMLID_112_"
       d="m 133.6,48.9 c 6.4,0 11.6,4.9 11.6,11.4 0,6.6 -5.2,11.6 -11.6,11.6 -6.4,0 -11.6,-5 -11.6,-11.6 0,-6.5 5.2,-11.4 11.6,-11.4 z m 0,20.4 c 4.7,0 8.5,-3.8 8.5,-9 0,-5 -3.8,-8.7 -8.5,-8.7 -4.7,0 -8.6,3.8 -8.6,8.7 0.1,5.1 3.9,9 8.6,9 z"
       inkscape:connector-curvature="0"
       style="fill:#ffffff" /><path
       id="XMLID_109_"
       d="m 183.5,48.9 c 5.3,0 7.2,4.4 7.2,4.4 l 0.1,0 c 0,0 -0.1,-0.7 -0.1,-1.7 l 0,-9.9 c 0,-0.7 -0.3,-1.1 0.4,-1.1 l 0.8,0 c 0.7,0 1.8,0.4 1.8,1.1 l 0,28.5 c 0,0.7 -0.3,1.1 -1,1.1 l -0.7,0 c -0.7,0 -1.1,-0.3 -1.1,-1 l 0,-1.7 c 0,-0.8 0.2,-1.4 0.2,-1.4 l -0.1,0 c 0,0 -1.9,4.6 -7.6,4.6 -5.9,0 -9.6,-4.7 -9.6,-11.5 -0.2,-6.8 3.9,-11.4 9.7,-11.4 z m 0.1,20.4 c 3.7,0 7.1,-2.6 7.1,-8.9 0,-4.5 -2.3,-8.8 -7,-8.8 -3.9,0 -7.1,3.2 -7.1,8.8 0.1,5.4 2.9,8.9 7,8.9 z"
       inkscape:connector-curvature="0"
       style="fill:#ffffff" /><path
       sodipodi:nodetypes="ssssssssssscccccsss"
       style="fill:#ffffff"
       inkscape:connector-curvature="0"
       d="m 1,71.4 0.8,0 c 0.7,0 1.1,-0.4 1.1,-1.1 l 0,-21.472335 C 2.9,45.427665 6.6,43 10.8,43 c 4.2,0 7.9,2.427665 7.9,5.827665 L 18.7,70.3 c 0,0.7 0.4,1.1 1.1,1.1 l 0.8,0 c 0.7,0 1,-0.4 1,-1.1 l 0,-21.6 c 0,-5.7 -5.7,-8.5 -10.9,-8.5 l 0,0 0,0 0,0 0,0 C 5.7,40.2 0,43 0,48.7 l 0,21.6 c 0,0.7 0.3,1.1 1,1.1 z"
       id="XMLID_103_" /><path
       style="fill:#ffffff"
       inkscape:connector-curvature="0"
       d="m 167.9,49.4 -0.8,0 c -0.7,0 -1.1,0.4 -1.1,1.1 l 0,12.1 c 0,3.4 -2.2,6.5 -6.5,6.5 -4.2,0 -6.5,-3.1 -6.5,-6.5 l 0,-12.1 c 0,-0.7 -0.4,-1.1 -1.1,-1.1 l -0.8,0 c -0.7,0 -1,0.4 -1,1.1 l 0,12.9 c 0,5.7 4.2,8.5 9.4,8.5 l 0,0 c 0,0 0,0 0,0 0,0 0,0 0,0 l 0,0 c 5.2,0 9.4,-2.8 9.4,-8.5 l 0,-12.9 c 0.1,-0.7 -0.3,-1.1 -1,-1.1 z"
       id="XMLID_102_" /><path
       inkscape:connector-curvature="0"
       id="path4165-9"
       d="m 68.908203,49.235938 c -0.244942,0.0391 -0.480102,0.202589 -0.705078,0.470703 l -4.046875,4.824218 -3.029297,3.609375 -4.585937,-5.466796 -2.488282,-2.966797 c -0.224975,-0.268116 -0.479748,-0.414718 -0.74414,-0.4375 -0.264393,-0.02278 -0.538524,0.07775 -0.806641,0.302734 l -0.613281,0.513672 c -0.536232,0.449952 -0.508545,0.948144 -0.05859,1.484375 l 4.048828,4.824219 3.357422,4 -4.916016,5.857421 c -0.0037,0.0044 -0.0061,0.0093 -0.0098,0.01367 l -2.480469,2.955078 c -0.449952,0.536232 -0.399531,1.100832 0.136719,1.550782 l 0.613281,0.511718 c 0.536231,0.449951 1.022704,0.33701 1.472656,-0.199218 l 4.046875,-4.824219 3.029297,-3.609375 4.585938,5.466797 c 0.003,0.0036 0.0067,0.0062 0.0098,0.0098 l 2.480469,2.957032 c 0.44995,0.536231 1.012595,0.584735 1.548828,0.134765 l 0.613282,-0.513671 c 0.536231,-0.449952 0.508544,-0.948144 0.05859,-1.484376 l -4.048828,-4.824218 -3.357422,-4 4.916016,-5.857422 c 0.0037,-0.0044 0.0061,-0.0093 0.0098,-0.01367 l 2.480469,-2.955078 c 0.449952,-0.53623 0.399532,-1.10083 -0.136719,-1.550781 l -0.613281,-0.513672 c -0.268115,-0.224976 -0.522636,-0.308636 -0.767578,-0.269531 z"
       style="fill:#ffffff" /></g></svg>
			</div></header><br />
			<p style="text-align:center; font-size:28px; color:#444; font-weight:bold;">'.$title.'</p><br />
			<p style="text-align:center; font-size:13px; color:#666; font-weight:bold; ">'.$content.'</p>
			<form method="get" name="install" onsubmit="return validateForm();">
				<input type="hidden" name="step" value="'.$nextpage.'" />
		');

		if($nextpage === 2) {
			echo ('<p style="padding-left:0.5em; padding-right:0.5em">Enter a single "." to install in the current directory, or enter a subdirectory to install to:</p>
				<input type="text" style="margin-left:0; margin-right:0" name="directory" value="nextcloud" required="required" />');
		}
		if($nextpage === 3) {
			echo ('<input type="hidden" value="'.$_GET['directory'].'" name="directory" />');
		}

		if($nextpage<>'') echo('<input type="submit" id="submit" class="login" style="margin-right:100px;" value="Next" />');

		echo('
		</form>
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
		$txt='Welcome to the Nextcloud Setup Wizard.<br />This wizard will check the Nextcloud dependencies, download the newest version of Nextcloud and install it in a few simple steps.';
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
