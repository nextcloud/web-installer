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

namespace OCA\Password_Policy;

use OC\HintException;
use OC\User\LoginException;
use OCA\Password_Policy\Compliance\Expiration;
use OCA\Password_Policy\Compliance\HistoryCompliance;
use OCA\Password_Policy\Compliance\IAuditor;
use OCA\Password_Policy\Compliance\IEntryControl;
use OCA\Password_Policy\Compliance\IUpdatable;
use OCP\AppFramework\IAppContainer;
use OCP\AppFramework\QueryException;
use OCP\IConfig;
use OCP\ILogger;
use OCP\ISession;
use OCP\IUser;
use OCP\IUserSession;

class ComplianceService {
	/** @var IAppContainer */
	protected $container;
	/** @var ILogger */
	protected $logger;

	protected const COMPLIANCERS = [
		HistoryCompliance::class,
		Expiration::class,
	];
	/** @var IUserSession */
	private $userSession;
	/** @var IConfig */
	private $config;
	/** @var ISession */
	private $session;

	public function __construct(
		IAppContainer $container,
		ILogger $logger,
		IUserSession $userSession,
		IConfig $config,
		ISession $session
	) {
		$this->container = $container;
		$this->logger = $logger;
		$this->userSession = $userSession;
		$this->config = $config;
		$this->session = $session;
	}

	public function update(IUser $user, string $password) {
		foreach ($this->getInstance(IUpdatable::class) as $instance) {
			$instance->update($user, $password);
		}
	}

	public function audit(IUser $user, string $password) {
		foreach ($this->getInstance(IAuditor::class) as $instance) {
			$instance->audit($user, $password);
		}
	}

	/**
	 * @throws LoginException
	 */
	//public function entryControl(IUser $user, string $password, bool $isTokenLogin) {
	public function entryControl(string $loginName, ?string $password) {
		$uid = $loginName;
		\OCP\Util::emitHook('\OCA\Files_Sharing\API\Server2Server', 'preLoginNameUsedAsUserName', ['uid' => &$uid]);

		/** @var IEntryControl $instance */
		foreach ($this->getInstance(IEntryControl::class) as $instance) {
			try {
				$user = \OC::$server->getUserManager()->get($uid);

				if (!($user instanceof IUser)) {
					break;
				}

				$instance->entryControl($user, $password);
			} catch (HintException $e) {
				throw new LoginException($e->getHint());
			}
		}
	}

	/**
	 * @returns Iterable
	 */
	protected function getInstance($interface) {
		foreach (self::COMPLIANCERS as $compliance) {
			try {
				$instance = $this->container->query($compliance);
				if (!$instance instanceof $interface) {
					continue;
				}
			} catch (QueryException $e) {
				//ignore and continue
				$this->logger->logException($e, ['level' => ILogger::INFO]);
				continue;
			}

			yield $instance;
		}
	}
}
