<?php
/**
 * Privacy App
 *
 * @author Georg Ehrke
 * @copyright 2019 Georg Ehrke <oc.list@georgehrke.com>
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

return [
	'routes' => [
		['name' => 'personal#getReadableLocation', 'url' => 'api/location', 'verb' => 'GET'],
		['name' => 'admin#setReadableLocation', 'url' => 'api/location', 'verb' => 'POST'],
		['name' => 'personal#getAdmins', 'url' => '/api/admins', 'verb' => 'GET'],
		['name' => 'admin#addAdditionalAdmin', 'url' => 'api/admins', 'verb' => 'POST'],
		['name' => 'admin#deleteAdditionalAdmin', 'url' => 'api/admins/{id}', 'verb' => 'DELETE'],
		['name' => 'admin#setFullDiskEncryption', 'url' => 'api/fullDiskEncryption', 'verb' => 'POST'],
	]
];
