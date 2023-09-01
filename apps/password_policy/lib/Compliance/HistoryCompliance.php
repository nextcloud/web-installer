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
use OCP\IConfig;
use OCP\IL10N;
use OCP\ILogger;
use OCP\IUser;
use OCP\IUserSession;
use OCP\PreConditionNotMetException;
use OCP\Security\IHasher;

class HistoryCompliance implements IAuditor, IUpdatable {
	/** @var string */
	protected $uid;

	/** @var PasswordPolicyConfig */
	private $policyConfig;
	/** @var IConfig */
	private $config;
	/** @var IUserSession */
	private $session;
	/** @var IHasher */
	private $hasher;
	/** @var IL10N */
	private $l;
	/** @var ILogger */
	private $logger;

	public function __construct(
		PasswordPolicyConfig $policyConfig,
		IConfig $config,
		IUserSession $session,
		IHasher $hasher,
		IL10N $l,
		ILogger $logger
	) {
		$this->policyConfig = $policyConfig;
		$this->config = $config;
		$this->session = $session;
		$this->hasher = $hasher;
		$this->l = $l;
		$this->logger = $logger;
	}

	/**
	 * @throws HintException
	 */
	public function audit(IUser $user, string $password): void {
		if ($this->policyConfig->getHistorySize() === 0) {
			return;
		}

		$history = $this->getHistory($user);

		foreach ($history as $hash) {
			if ($this->hasher->verify($password, $hash)) {
				$message = 'Password must not have been used recently before.';
				$message_t = $this->l->t(
					'Password must not have been used recently before.'
				);
				throw new HintException($message, $message_t);
			}
		}
	}

	/**
	 * @throws PreConditionNotMetException
	 */
	public function update(IUser $user, string $password): void {
		$historySize = $this->policyConfig->getHistorySize();
		if ($historySize === 0) {
			$this->config->deleteUserValue($user->getUID(), 'password_policy', 'passwordHistory');
			return;
		}

		$history = $this->getHistory($user);
		array_unshift($history, $this->hasher->hash($password));
		$history = \array_slice($history, 0, $historySize);

		$this->config->setUserValue(
			$user->getUID(),
			'password_policy',
			'passwordHistory',
			\json_encode($history)
		);
	}

	protected function getHistory(IUser $user): array {
		$history = $this->config->getUserValue(
			$user->getUID(),
			'password_policy',
			'passwordHistory',
			'[]'
		);
		$history = \json_decode($history, true);
		if (!is_array($history)) {
			$this->logger->warning(
				'Received password history of {uid} had the unexpected value of {history}, resetting.',
				['app' => 'password_policy', 'uid' => $user->getUID(), 'history' => $history]
			);
			$history = [];
		}
		$history = \array_slice($history, 0, $this->policyConfig->getHistorySize());

		return $history;
	}
}
