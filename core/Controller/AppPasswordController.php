<?php

declare(strict_types=1);

/**
 * @copyright Copyright (c) 2018, Roeland Jago Douma <roeland@famdouma.nl>
 *
 * @author Christoph Wurst <christoph@winzerhof-wurst.at>
 * @author Daniel Kesselberg <mail@danielkesselberg.de>
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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
namespace OC\Core\Controller;

use OC\Authentication\Events\AppPasswordCreatedEvent;
use OC\Authentication\Exceptions\InvalidTokenException;
use OC\Authentication\Token\IProvider;
use OC\Authentication\Token\IToken;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCS\OCSForbiddenException;
use OCP\Authentication\Exceptions\CredentialsUnavailableException;
use OCP\Authentication\Exceptions\PasswordUnavailableException;
use OCP\Authentication\LoginCredentials\IStore;
use OCP\EventDispatcher\IEventDispatcher;
use OCP\IRequest;
use OCP\ISession;
use OCP\Security\ISecureRandom;

class AppPasswordController extends \OCP\AppFramework\OCSController {
	private ISession $session;
	private ISecureRandom $random;
	private IProvider $tokenProvider;
	private IStore $credentialStore;
	private IEventDispatcher $eventDispatcher;

	public function __construct(string $appName,
								IRequest $request,
								ISession $session,
								ISecureRandom $random,
								IProvider $tokenProvider,
								IStore $credentialStore,
								IEventDispatcher $eventDispatcher) {
		parent::__construct($appName, $request);

		$this->session = $session;
		$this->random = $random;
		$this->tokenProvider = $tokenProvider;
		$this->credentialStore = $credentialStore;
		$this->eventDispatcher = $eventDispatcher;
	}

	/**
	 * @NoAdminRequired
	 * @PasswordConfirmationRequired
	 *
	 * @throws OCSForbiddenException
	 */
	public function getAppPassword(): DataResponse {
		// We do not allow the creation of new tokens if this is an app password
		if ($this->session->exists('app_password')) {
			throw new OCSForbiddenException('You cannot request an new apppassword with an apppassword');
		}

		try {
			$credentials = $this->credentialStore->getLoginCredentials();
		} catch (CredentialsUnavailableException $e) {
			throw new OCSForbiddenException();
		}

		try {
			$password = $credentials->getPassword();
		} catch (PasswordUnavailableException $e) {
			$password = null;
		}

		$userAgent = $this->request->getHeader('USER_AGENT');

		$token = $this->random->generate(72, ISecureRandom::CHAR_UPPER.ISecureRandom::CHAR_LOWER.ISecureRandom::CHAR_DIGITS);

		$generatedToken = $this->tokenProvider->generateToken(
			$token,
			$credentials->getUID(),
			$credentials->getLoginName(),
			$password,
			$userAgent,
			IToken::PERMANENT_TOKEN,
			IToken::DO_NOT_REMEMBER
		);

		$this->eventDispatcher->dispatchTyped(
			new AppPasswordCreatedEvent($generatedToken)
		);

		return new DataResponse([
			'apppassword' => $token
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function deleteAppPassword(): DataResponse {
		if (!$this->session->exists('app_password')) {
			throw new OCSForbiddenException('no app password in use');
		}

		$appPassword = $this->session->get('app_password');

		try {
			$token = $this->tokenProvider->getToken($appPassword);
		} catch (InvalidTokenException $e) {
			throw new OCSForbiddenException('could not remove apptoken');
		}

		$this->tokenProvider->invalidateTokenById($token->getUID(), $token->getId());
		return new DataResponse();
	}

	/**
	 * @NoAdminRequired
	 */
	public function rotateAppPassword(): DataResponse {
		if (!$this->session->exists('app_password')) {
			throw new OCSForbiddenException('no app password in use');
		}

		$appPassword = $this->session->get('app_password');

		try {
			$token = $this->tokenProvider->getToken($appPassword);
		} catch (InvalidTokenException $e) {
			throw new OCSForbiddenException('could not rotate apptoken');
		}

		$newToken = $this->random->generate(72, ISecureRandom::CHAR_UPPER.ISecureRandom::CHAR_LOWER.ISecureRandom::CHAR_DIGITS);
		$this->tokenProvider->rotate($token, $appPassword, $newToken);

		return new DataResponse([
			'apppassword' => $newToken,
		]);
	}
}
