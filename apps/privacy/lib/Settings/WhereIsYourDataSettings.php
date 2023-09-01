<?php
/**
 * Privacy App
 *
 * @author Georg Ehrke
 * @copyright 2019 Georg Ehrke <oc.list@georgehrke.com>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU AFFERO GENERAL PUBLIC LICENSE
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU AFFERO GENERAL PUBLIC LICENSE for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this library.  If not, see <http://www.gnu.org/licenses/>.
 *
 */
namespace OCA\Privacy\Settings;

use OCP\AppFramework\Http\TemplateResponse;
use OCP\IConfig;
use OCP\IInitialStateService;
use OCP\Settings\ISettings;

/**
 * Class WhereIsMyDataSettings
 *
 * @package OCA\Privacy\Settings
 */
class WhereIsYourDataSettings implements ISettings {

	/** @var IInitialStateService */
	private $initialStateService;

	/** @var IConfig */
	private $config;

	/**
	 * MissionSettings constructor.
	 *
	 * @param IInitialStateService $initialStateService
	 * @param IConfig $config
	 */
	public function __construct(IInitialStateService $initialStateService,
								IConfig $config) {
		$this->initialStateService = $initialStateService;
		$this->config = $config;
	}

	/**
	 * @return TemplateResponse
	 */
	public function getForm():TemplateResponse {
		$location = $this->config->getAppValue('privacy', 'readableLocation');
		$this->initialStateService->provideInitialState('privacy', 'location', $location ?: '');

		return new TemplateResponse('privacy', 'where-is-your-data');
	}

	/**
	 * @return string
	 */
	public function getSection():string {
		return 'privacy';
	}

	/**
	 * @return int
	 */
	public function getPriority():int {
		return 15;
	}
}
