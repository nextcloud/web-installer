<?php

declare(strict_types=1);
/**
 * @copyright 2017, Roeland Jago Douma <roeland@famdouma.nl>
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

use OCP\AppFramework\Http\TemplateResponse;
use OCP\IInitialStateService;
use OCP\Settings\ISettings;
use OCP\Util;

class Settings implements ISettings {
	private $appName;

	/** @var PasswordPolicyConfig */
	private $config;

	/** @var IInitialStateService */
	private $initialStateService;

	public function __construct(string $appName,
		PasswordPolicyConfig $config,
		IInitialStateService $initialStateService) {
		$this->appName = $appName;
		$this->config = $config;
		$this->initialStateService = $initialStateService;
	}

	public function getForm(): TemplateResponse {
		Util::addScript($this->appName, 'password_policy-settings');

		$this->initialStateService->provideInitialState($this->appName, 'config', [
			'minLength' => $this->config->getMinLength(),
			'enforceNonCommonPassword' => $this->config->getEnforceNonCommonPassword(),
			'enforceUpperLowerCase' => $this->config->getEnforceUpperLowerCase(),
			'enforceNumericCharacters' => $this->config->getEnforceNumericCharacters(),
			'enforceSpecialCharacters' => $this->config->getEnforceSpecialCharacters(),
			'enforceHaveIBeenPwned' => $this->config->getEnforceHaveIBeenPwned(),
			'historySize' => $this->config->getHistorySize(),
			'expiration' => $this->config->getExpiryInDays(),
			'maximumLoginAttempts' => $this->config->getMaximumLoginAttempts(),
		]);

		return new TemplateResponse($this->appName, 'settings');
	}

	public function getSection(): string {
		return 'security';
	}

	public function getPriority(): int {
		return 50;
	}
}
