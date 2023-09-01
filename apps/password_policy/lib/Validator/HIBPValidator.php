<?php

declare(strict_types=1);
/**
 * @copyright Copyright (c) 2019, Roeland Jago Douma <roeland@famdouma.nl>
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

namespace OCA\Password_Policy\Validator;

use OC\HintException;
use OCA\Password_Policy\PasswordPolicyConfig;
use OCP\Http\Client\IClientService;
use OCP\IL10N;
use OCP\ILogger;

class HIBPValidator implements IValidator {

	/** @var PasswordPolicyConfig */
	private $config;
	/** @var IL10N */
	private $l;
	/** @var IClientService */
	private $clientService;
	/** @var ILogger */
	private $logger;

	public function __construct(PasswordPolicyConfig $config,
		IL10N $l,
		IClientService $clientService,
		ILogger $logger) {
		$this->config = $config;
		$this->l = $l;
		$this->clientService = $clientService;
		$this->logger = $logger;
	}

	public function validate(string $password): void {
		if ($this->config->getEnforceHaveIBeenPwned()) {
			$hash = sha1($password);
			$range = substr($hash, 0, 5);
			$needle = strtoupper(substr($hash, 5));

			$client = $this->clientService->newClient();

			try {
				$response = $client->get(
					'https://api.pwnedpasswords.com/range/' . $range,
					[
						'timeout' => 5,
						'headers' => [
							'Add-Padding' => 'true'
						]
					]
				);
			} catch (\Exception $e) {
				$this->logger->logException($e, ['level' => ILogger::INFO]);
				return;
			}

			$result = $response->getBody();
			$result = preg_replace('/^([0-9A-Z]+:0)$/m', '', $result);

			if (strpos($result, $needle) !== false) {
				$message = 'Password is present in compromised password list. Please choose a different password.';
				$message_t = $this->l->t(
					'Password is present in compromised password list. Please choose a different password.'
				);
				throw new HintException($message, $message_t);
			}
		}
	}
}
