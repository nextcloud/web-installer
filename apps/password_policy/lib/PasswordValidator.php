<?php

declare(strict_types=1);
/**
 * @copyright Copyright (c) 2016 Bjoern Schiessle <bjoern@schiessle.org>
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
use OCA\Password_Policy\Validator\CommonPasswordsValidator;
use OCA\Password_Policy\Validator\HIBPValidator;
use OCA\Password_Policy\Validator\IValidator;
use OCA\Password_Policy\Validator\LengthValidator;
use OCA\Password_Policy\Validator\NumericCharacterValidator;
use OCA\Password_Policy\Validator\SpecialCharactersValidator;
use OCA\Password_Policy\Validator\UpperCaseLoweCaseValidator;
use OCP\AppFramework\IAppContainer;
use OCP\AppFramework\QueryException;
use OCP\ILogger;

class PasswordValidator {

	/** @var IAppContainer */
	private $container;
	/** @var ILogger */
	private $logger;

	public function __construct(IAppContainer $container, ILogger $logger) {
		$this->container = $container;
		$this->logger = $logger;
	}

	/**
	 * check if the given password matches the conditions defined by the admin
	 *
	 * @throws HintException
	 */
	public function validate(string $password): void {
		$validators = [
			CommonPasswordsValidator::class,
			LengthValidator::class,
			NumericCharacterValidator::class,
			UpperCaseLoweCaseValidator::class,
			SpecialCharactersValidator::class,
			HIBPValidator::class,
		];

		$errors = [];
		$hints = [];
		foreach ($validators as $validator) {
			try {
				/** @var IValidator $instance */
				$instance = $this->container->query($validator);
			} catch (QueryException $e) {
				//ignore and continue
				$this->logger->logException($e, ['level' => ILogger::INFO]);
				continue;
			}

			try {
				$instance->validate($password);
			} catch (HintException $e) {
				$errors[] = $e->getMessage();
				$hints[] = $e->getHint();
			}
		}

		if (!empty($errors)) {
			throw new HintException(
				implode(' ', $errors),
				implode(' ', $hints)
			);
		}
	}
}
