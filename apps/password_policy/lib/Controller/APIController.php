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

namespace OCA\Password_Policy\Controller;

use OC\HintException;
use OCA\Password_Policy\Generator;
use OCA\Password_Policy\PasswordValidator;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCSController;
use OCP\IRequest;

class APIController extends OCSController {

	/** @var PasswordValidator */
	private $validator;
	/** @var Generator */
	private $generator;

	public function __construct(string $appName, IRequest $request, PasswordValidator $validator, Generator $generator) {
		parent::__construct($appName, $request);
		$this->validator = $validator;
		$this->generator = $generator;
	}

	/**
	 * @NoAdminRequired
	 *
	 * @param string $password
	 * @return DataResponse
	 */
	public function validate(string $password): DataResponse {
		try {
			$this->validator->validate($password);
		} catch (HintException $e) {
			return new DataResponse([
				'passed' => false,
				'reason' => $e->getHint(),
			]);
		}

		return new DataResponse([
			'passed' => true,
		]);
	}

	/**
	 * @NoAdminRequired
	 *
	 * @return DataResponse
	 */
	public function generate(): DataResponse {
		try {
			$password = $this->generator->generate();
		} catch (HintException $e) {
			return new DataResponse([], Http::STATUS_CONFLICT);
		}

		return new DataResponse([
			'password' => $password,
		]);
	}
}
