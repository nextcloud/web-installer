<?php
/**
 * @author Joas Schilling <coding@schilljs.com>
 *
 * @copyright Copyright (c) 2016, ownCloud, Inc.
 * @license AGPL-3.0
 *
 * This code is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License, version 3,
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License, version 3,
 * along with this program.  If not, see <http://www.gnu.org/licenses/>
 *
 */

namespace OCA\Survey_Client;

use bantu\IniGetWrapper\IniGetWrapper;
use OCA\Survey_Client\Categories\Apps;
use OCA\Survey_Client\Categories\Database;
use OCA\Survey_Client\Categories\Encryption;
use OCA\Survey_Client\Categories\FilesSharing;
use OCA\Survey_Client\Categories\ICategory;
use OCA\Survey_Client\Categories\Php;
use OCA\Survey_Client\Categories\Server;
use OCA\Survey_Client\Categories\Stats;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\DataResponse;
use OCP\Http\Client\IClientService;
use OCP\IConfig;
use OCP\IDBConnection;
use OCP\IL10N;

class Collector {
	public const SURVEY_SERVER_URL = 'https://surveyserver.nextcloud.com/';

	/** @var ICategory[] */
	protected $categories;

	/** @var IClientService */
	protected $clientService;

	/** @var IConfig */
	protected $config;

	/** @var IDBConnection */
	protected $connection;

	/** @var IniGetWrapper */
	protected $phpIni;

	/** @var IL10N */
	protected $l;

	public function __construct(IClientService $clientService, IConfig $config, IDBConnection $connection, IniGetWrapper $phpIni, IL10N $l) {
		$this->clientService = $clientService;
		$this->config = $config;
		$this->connection = $connection;
		$this->phpIni = $phpIni;
		$this->l = $l;
	}

	protected function registerCategories() {
		$this->categories[] = new Server(
			$this->config,
			$this->l
		);
		$this->categories[] = new Php(
			$this->phpIni,
			$this->l
		);
		$this->categories[] = new Database(
			$this->config,
			$this->connection,
			$this->l
		);
		$this->categories[] = new Apps(
			$this->connection,
			$this->l
		);
		$this->categories[] = new Stats(
			$this->connection,
			$this->l
		);
		$this->categories[] = new FilesSharing(
			$this->connection,
			$this->l
		);
		$this->categories[] = new Encryption(
			$this->config,
			$this->l
		);
	}

	/**
	 * @return array
	 */
	public function getCategories() {
		$this->registerCategories();

		$categories = [];

		foreach ($this->categories as $category) {
			$categories[$category->getCategory()] = [
				'displayName' => $category->getDisplayName(),
				'enabled' => $this->config->getAppValue('survey_client', $category->getCategory(), 'yes') === 'yes',
			];
		}

		return $categories;
	}

	/**
	 * @return array
	 */
	public function getReport() {
		$this->registerCategories();

		$tuples = [];
		foreach ($this->categories as $category) {
			if ($this->config->getAppValue('survey_client', $category->getCategory(), 'yes') === 'yes') {
				foreach ($category->getData() as $key => $value) {
					$tuples[] = [
						$category->getCategory(),
						$key,
						$value
					];
				}
			}
		}

		return [
			'id' => $this->config->getSystemValue('instanceid'),
			'items' => $tuples,
		];
	}

	/**
	 * @return DataResponse
	 */
	public function sendReport(): DataResponse {
		$report = $this->getReport();

		$client = $this->clientService->newClient();

		try {
			$response = $client->post(self::SURVEY_SERVER_URL . 'ocs/v2.php/apps/survey_server/api/v1/survey', [
				'timeout' => 5,
				'query' => [
					'data' => json_encode($report),
				],
			]);
		} catch (\Exception $e) {
			return new DataResponse(
				$report,
				Http::STATUS_INTERNAL_SERVER_ERROR
			);
		}

		if ($response->getStatusCode() === Http::STATUS_OK) {
			$this->config->setAppValue('survey_client', 'last_sent', (string) time());
			$this->config->setAppValue('survey_client', 'last_report', json_encode($report));
			return new DataResponse(
				$report
			);
		}

		return new DataResponse(
			$report,
			Http::STATUS_INTERNAL_SERVER_ERROR
		);
	}
}
