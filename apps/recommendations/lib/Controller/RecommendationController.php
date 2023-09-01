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

namespace OCA\Recommendations\Controller;

use Exception;
use OCA\Recommendations\AppInfo\Application;
use OCA\Recommendations\Service\RecommendationService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IConfig;
use OCP\IRequest;
use OCP\IUserSession;

class RecommendationController extends Controller {
	private IUserSession $userSession;
	private RecommendationService $recommendationService;
	private IConfig $config;

	public function __construct(IRequest $request,
								IUserSession $userSession,
								RecommendationService $recommendationService,
								IConfig $config) {
		parent::__construct(Application::APP_ID, $request);
		$this->userSession = $userSession;
		$this->recommendationService = $recommendationService;
		$this->config = $config;
	}

	/**
	 * @NoAdminRequired
	 * @return JSONResponse
	 */
	public function index(): JSONResponse {
		$user = $this->userSession->getUser();
		if (is_null($user)) {
			throw new Exception("Not logged in");
		}
		$response = [];
		$response['enabled'] = $this->config->getUserValue($user->getUID(), Application::APP_ID, 'enabled', 'true') === 'true';
		if ($response['enabled']) {
			$response['recommendations'] = $this->recommendationService->getRecommendations($user);
		}
		return new JSONResponse(
			$response
		);
	}

	/**
	 * @NoAdminRequired
	 * @return JSONResponse
	 */
	public function always(): JSONResponse {
		$user = $this->userSession->getUser();
		if (is_null($user)) {
			throw new Exception("Not logged in");
		}
		$response = [
			'enabled' => $this->config->getUserValue($user->getUID(), Application::APP_ID, 'enabled', 'true') === 'true',
			'recommendations' => $this->recommendationService->getRecommendations($user),
		];
		return new JSONResponse(
			$response
		);
	}
}
