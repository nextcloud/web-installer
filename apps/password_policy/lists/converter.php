<?php
/**
 * @copyright Copyright (c) 2016 Lukas Reschke <lukas@statuscode.ch>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

if (php_sapi_name() !== 'cli') {
	die('Script can only be invoked via CLI');
}

if(count($argv) !== 2) {
	die('php converter.php 10_million_password_list_top_10000000.txt');
}

$passwordLengthArray = [];
$separator = "\r\n";

$maxPasswordFileLength = 15;
$count = [];
$file = fopen(__DIR__ . '/' . $argv[1], 'r');
while(!feof($file)){
	$password = trim(strtolower(fgets($file)));
	if($password !== '') {
		$count[strlen($password)] = isset($count[strlen($password)]) ? $count[strlen($password)] + 1 : 1;
		$passwordLengthArray[strlen($password)][$password] = true;
	}
}
fclose($file);

foreach($passwordLengthArray as $length => $passwords) {
	file_put_contents(__DIR__ . '/list-'.$length.'.php', "<?php\nreturn ".var_export($passwords, true).";");
}
