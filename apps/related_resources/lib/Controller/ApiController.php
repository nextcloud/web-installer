<?php

declare(strict_types=1);


/**
 * Nextcloud - Related Resources
 *
 * This file is licensed under the Affero General Public License version 3 or
 * later. See the COPYING file.
 *
 * @author Maxence Lange <maxence@artificial-owl.com>
 * @copyright 2022, Maxence Lange <maxence@artificial-owl.com>
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


namespace OCA\RelatedResources\Controller;

use Exception;
use OCA\Circles\CirclesManager;
use OCA\RelatedResources\Model\RelatedResource;
use OCA\RelatedResources\Service\ConfigService;
use OCA\RelatedResources\Service\RelatedService;
use OCA\RelatedResources\Tools\Traits\TDeserialize;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCS\OCSException;
use OCP\AppFramework\OCSController;
use OCP\AutoloadNotAllowedException;
use OCP\IRequest;
use OCP\IUserSession;
use OCP\Server;
use Psr\Container\ContainerExceptionInterface;
use Psr\Log\LoggerInterface;

class ApiController extends OcsController {
	use TDeserialize;


	private LoggerInterface $logger;
	private IUserSession $userSession;
	private RelatedService $relatedService;
	private ConfigService $configService;
	private ?CirclesManager $circlesManager = null;

	public function __construct(
		string $appName,
		IRequest $request,
		LoggerInterface $logger,
		IUserSession $userSession,
		RelatedService $relatedService,
		ConfigService $configService
	) {
		parent::__construct($appName, $request);

		$this->logger = $logger;
		$this->userSession = $userSession;
		$this->relatedService = $relatedService;
		$this->configService = $configService;
		try {
			$this->circlesManager = Server::get(CirclesManager::class);
		} catch (ContainerExceptionInterface | AutoloadNotAllowedException $e) {
		}
	}


	/**
	 * @NoAdminRequired
	 *
	 * @param string $providerId
	 * @param string $itemId
	 *
	 * @return DataResponse
	 * @throws OCSException
	 */
	public function getRelatedResources(string $providerId, string $itemId): DataResponse {
		if (is_null($this->circlesManager)) {
			$this->logger->info('RelatedResources require Circles');

			return new DataResponse([]);
		}

		try {
			$this->circlesManager->startSession();

			$result = $this->relatedService->getRelatedToItem(
				$providerId,
				$itemId,
				$this->configService->getAppValueInt(ConfigService::RESULT_MAX)
			);

			// cleanData on result, to not send useless data.
			$new = [];
			foreach ($result as $related) {
				$new[] = RelatedResource::cleanData($this->serialize($related));
			}

			return new DataResponse($new);
		} catch (Exception $e) {
			$this->logger->error($e->getMessage(), ['exception' => $e]);
			throw new OCSException(
				($e->getMessage() === '') ? get_class($e) : $e->getMessage(),
				Http::STATUS_BAD_REQUEST
			);
		}
	}
}
