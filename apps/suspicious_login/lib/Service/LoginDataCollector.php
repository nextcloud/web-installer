<?php

declare(strict_types=1);

/**
 * @author Christoph Wurst <christoph@winzerhof-wurst.at>
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

namespace OCA\SuspiciousLogin\Service;

use OCA\SuspiciousLogin\Db\LoginAddress;
use OCA\SuspiciousLogin\Db\LoginAddressMapper;

class LoginDataCollector {

	/** @var LoginAddressMapper */
	private $addressMapper;

	public function __construct(LoginAddressMapper $addressMapper) {
		$this->addressMapper = $addressMapper;
	}

	public function collectSuccessfulLogin(string $uid, string $ip, int $timestamp): void {
		$addr = new LoginAddress();
		$addr->setUid($uid);
		$addr->setIp($ip);
		$addr->setCreatedAt($timestamp);

		$this->addressMapper->insert($addr);
	}
}
