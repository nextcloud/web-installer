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
namespace OCA\Privacy\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IConfig;
use OCP\IDBConnection;
use OCP\IRequest;

/**
 * Class AdminController
 *
 * @package OCA\Privacy\Controller
 */
class AdminController extends Controller {

	/** @var IConfig */
	private $config;

	/** @var IDBConnection */
	private $dbConnection;

	/**
	 * AdminController constructor.
	 *
	 * @param string $appName
	 * @param IRequest $request
	 * @param IConfig $config
	 * @param IDBConnection $dbConnection
	 */
	public function __construct(string $appName, IRequest $request,
								IConfig $config, IDBConnection $dbConnection) {
		parent::__construct($appName, $request);

		$this->config = $config;
		$this->dbConnection = $dbConnection;
	}

	/**
	 * @param string $code
	 * @return JSONResponse
	 */
	public function setReadableLocation(string $code):JSONResponse {
		$this->config->setAppValue($this->appName, 'readableLocation', $code);
		return new JSONResponse([], Http::STATUS_OK);
	}

	/**
	 * @param string $name
	 * @return JSONResponse
	 */
	public function addAdditionalAdmin(string $name):JSONResponse {
		$query = $this->dbConnection->getQueryBuilder();
		$query->insert('privacy_admins')
			->setValue('displayname', $query->createNamedParameter($name))
			->execute();

		$id = $query->getLastInsertId();

		return new JSONResponse([
			'id' => $id,
			'displayname' => $name,
			'internal' => false,
		], Http::STATUS_CREATED);
	}

	/**
	 * @param int $id
	 * @return JSONResponse
	 */
	public function deleteAdditionalAdmin(int $id):JSONResponse {
		$query = $this->dbConnection->getQueryBuilder();
		$query->delete('privacy_admins')
			->where($query->expr()->eq('id', $query->createNamedParameter($id)))
			->execute();

		return new JSONResponse([], Http::STATUS_OK);
	}

	/**
	 * @param string $enabled
	 * @return JSONResponse
	 */
	public function setFullDiskEncryption(string $enabled):JSONResponse {
		$allowedValues = ['0', '1'];
		if (!\in_array($enabled, $allowedValues, true)) {
			return new JSONResponse([], HTTP::STATUS_NOT_ACCEPTABLE);
		}

		$this->config->setAppValue('privacy', 'fullDiskEncryptionEnabled', $enabled);
		return new JSONResponse([], HTTP::STATUS_OK);
	}
}
