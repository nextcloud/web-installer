<?php

declare(strict_types=1);
/**
 * @copyright Copyright (c) 2020 Arthur Schiwon <blizzz@arthur-schiwon.de>
 *
 * @author Arthur Schiwon <blizzz@arthur-schiwon.de>
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

namespace OCA\Password_Policy\Compliance;

use OC\HintException;
use OCA\Password_Policy\PasswordPolicyConfig;
use OCP\EventDispatcher\IEventDispatcher;
use OCP\IConfig;
use OCP\IL10N;
use OCP\IUser;
use OCP\IUserManager;
use OCP\PreConditionNotMetException;

class Expiration implements IUpdatable, IEntryControl {

	/** @var IConfig */
	private $config;
	/** @var PasswordPolicyConfig */
	private $policyConfig;
	/** @var IUserManager */
	private $userManager;
	/** @var IEventDispatcher */
	private $eventDispatcher;
	/** @var IL10N */
	private $l;

	public function __construct(
		IConfig $config,
		PasswordPolicyConfig $policyConfig,
		IUserManager $userManager,
		IEventDispatcher $eventDispatcher,
		IL10N $l
	) {
		$this->config = $config;
		$this->policyConfig = $policyConfig;
		$this->userManager = $userManager;
		$this->eventDispatcher = $eventDispatcher;
		$this->l = $l;
	}

	/**
	 * @throws PreConditionNotMetException
	 */
	public function update(IUser $user, string $password): void {
		if (!$this->isLocalUser($user)) {
			return;
		}
		if ($this->policyConfig->getExpiryInDays() === 0) {
			$this->config->deleteUserValue(
				$user->getUID(),
				'password_policy',
				'pwd_last_updated'
			);
			return;
		}
		$this->config->setUserValue(
			$user->getUID(),
			'password_policy',
			'pwd_last_updated',
			time()
		);
	}

	public function entryControl(IUser $user, ?string $password): void {
		if ($this->policyConfig->getExpiryInDays() !== 0
			&& $this->isLocalUser($user)
			&& $this->isPasswordExpired($user)
		) {
			$message = 'Password is expired, please use forgot password method to reset';
			$message_t = $this->l->t('Password is expired, please use forgot password method to reset');
			throw new HintException($message, $message_t);
		}
	}

	protected function isPasswordExpired(IUser $user) {
		$updatedAt = (int)$this->config->getUserValue(
			$user->getUID(),
			'password_policy',
			'pwd_last_updated',
			0
		);

		if ($updatedAt === 0) {
			$this->update($user, '');
			return false;
		}

		$expiryInDays = $this->policyConfig->getExpiryInDays();
		$expiresIn = $updatedAt + $expiryInDays * 24 * 60 * 60;

		return $expiresIn <= time();
	}

	protected function isLocalUser(IUser $user) {
		$localBackends = ['Database', 'Guests'];
		return in_array($user->getBackendClassName(), $localBackends);
	}
}
