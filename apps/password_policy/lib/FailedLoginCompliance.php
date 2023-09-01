<?php

declare(strict_types=1);
/**
 * @copyright Copyright (c) 2020, Roeland Jago Douma <roeland@famdouma.nl>
 *
 * @author Roeland Jago Douma <roeland@famdouma.nl>
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

namespace OCA\Password_Policy;

use OCP\IConfig;
use OCP\IUser;
use OCP\IUserManager;

class FailedLoginCompliance {

	/** @var IConfig */
	private $config;

	/** @var IUserManager */
	private $userManager;

	/** @var PasswordPolicyConfig */
	private $passwordPolicyConfig;

	public function __construct(
		IConfig $config,
		IUserManager $userManager,
		PasswordPolicyConfig $passwordPolicyConfig) {
		$this->config = $config;
		$this->userManager = $userManager;
		$this->passwordPolicyConfig = $passwordPolicyConfig;
	}

	public function onFailedLogin(string $uid) {
		$user = $this->userManager->get($uid);

		if (!($user instanceof IUser)) {
			return;
		}

		if ($user->isEnabled() === false) {
			// Just ignore this user then
			return;
		}

		$allowedAttempts = $this->passwordPolicyConfig->getMaximumLoginAttempts();

		if ($allowedAttempts === 0) {
			// 0 is the max
			return;
		}

		$attempts = $this->getAttempts($uid);
		$attempts++;

		if ($attempts >= $allowedAttempts) {
			$this->setAttempts($uid, 0);
			$user->setEnabled(false);
			return;
		}

		$this->setAttempts($uid, $attempts);
	}

	public function onSucessfullLogin(IUser $user) {
		$this->setAttempts($user->getUID(), 0);
	}

	private function getAttempts(string $uid): int {
		return (int)$this->config->getUserValue($uid, 'password_policy', 'failedLoginAttempts', 0);
	}

	private function setAttempts(string $uid, int $attempts): void {
		$this->config->setUserValue($uid, 'password_policy', 'failedLoginAttempts', $attempts);
	}
}
