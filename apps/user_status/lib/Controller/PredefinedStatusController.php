<?php

declare(strict_types=1);

/**
 * @copyright Copyright (c) 2020, Georg Ehrke
 *
 * @author Georg Ehrke <oc.list@georgehrke.com>
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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
namespace OCA\UserStatus\Controller;

use OCA\UserStatus\Service\PredefinedStatusService;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCSController;
use OCP\IRequest;

/**
 * Class DefaultStatusController
 *
 * @package OCA\UserStatus\Controller
 */
class PredefinedStatusController extends OCSController {

	/** @var PredefinedStatusService */
	private $predefinedStatusService;

	/**
	 * AStatusController constructor.
	 *
	 * @param string $appName
	 * @param IRequest $request
	 * @param PredefinedStatusService $predefinedStatusService
	 */
	public function __construct(string $appName,
								IRequest $request,
								PredefinedStatusService $predefinedStatusService) {
		parent::__construct($appName, $request);
		$this->predefinedStatusService = $predefinedStatusService;
	}

	/**
	 * @NoAdminRequired
	 *
	 * @return DataResponse
	 */
	public function findAll():DataResponse {
		// Filtering out the invisible one, that should only be set by API
		return new DataResponse(array_filter($this->predefinedStatusService->getDefaultStatuses(), function (array $status) {
			return !array_key_exists('visible', $status) || $status['visible'] === true;
		}));
	}
}
