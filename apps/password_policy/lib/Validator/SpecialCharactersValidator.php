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
use OCP\IL10N;

class SpecialCharactersValidator implements IValidator {

	/** @var PasswordPolicyConfig */
	private $config;
	/** @var IL10N */
	private $l;

	public function __construct(PasswordPolicyConfig $config, IL10N $l) {
		$this->config = $config;
		$this->l = $l;
	}

	public function validate(string $password): void {
		$enforceSpecialCharacters = $this->config->getEnforceSpecialCharacters();
		if ($enforceSpecialCharacters && ctype_alnum($password)) {
			$message = 'Password needs to contain at least one special character.';
			$message_t = $this->l->t(
				'Password needs to contain at least one special character.'
			);
			throw new HintException($message, $message_t);
		}
	}
}
