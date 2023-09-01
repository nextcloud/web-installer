<?php

declare(strict_types=1);

/**
 * @copyright 2019 Christoph Wurst <christoph@winzerhof-wurst.at>
 *
 * @author 2019 Christoph Wurst <christoph@winzerhof-wurst.at>
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
 */

namespace OCA\SuspiciousLogin\Settings;

use OCA\SuspiciousLogin\AppInfo\Application;
use OCA\SuspiciousLogin\Service\AdminService;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IInitialStateService;
use OCP\Settings\ISettings;

class AdminSettings implements ISettings {

	/** @var IInitialStateService */
	private $initialStateService;

	/** @var AdminService */
	private $adminService;

	public function __construct(IInitialStateService $initialStateService, AdminService $adminService) {
		$this->initialStateService = $initialStateService;
		$this->adminService = $adminService;
	}

	public function getForm() {
		$this->initialStateService->provideInitialState(
			Application::APP_ID,
			'stats',
			$this->adminService->getStatistics()
		);

		return new TemplateResponse(Application::APP_ID, 'settings-admin');
	}

	public function getSection() {
		return 'security';
	}

	public function getPriority() {
		return 90;
	}
}
