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

use OC;
use OCA\Theming\ThemingDefaults;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IConfig;
use OCP\Encryption\IManager as IEncryptionManager;
use OCP\IInitialStateService;
use OCP\Settings\ISettings;
use Throwable;

/**
 * Class WhoHasAccessSettings
 *
 * @package OCA\Privacy\Settings
 */
class WhoHasAccessSettings implements ISettings {

	/** @var IConfig */
	private $config;

	/** @var IEncryptionManager */
	private $encryptionManager;

	/** @var IInitialStateService */
	private $initialStateService;

	/**
	 * WhoHasAccessSettings constructor.
	 *
	 * @param IConfig $config
	 * @param IEncryptionManager $manager
	 * @param IInitialStateService $initialStateService
	 */
	public function __construct(IConfig $config,
								IEncryptionManager $manager,
								IInitialStateService $initialStateService) {
		$this->config = $config;
		$this->encryptionManager = $manager;
		$this->initialStateService = $initialStateService;
	}

	/**
	 * @return TemplateResponse
	 */
	public function getForm():TemplateResponse {
		\OCP\Util::addScript('privacy', 'privacy-main');
		\OCP\Util::addStyle('privacy', 'privacy');
		$themingDefaults = OC::$server->getThemingDefaults();
		if ($themingDefaults instanceof ThemingDefaults) {
			$privacyPolicyUrl = $themingDefaults->getPrivacyUrl();
		} else {
			$privacyPolicyUrl = null;
		}

		$isHomeStorageEncrypted = false;
		$isMasterKeyEnabled = false;
		if ($this->encryptionManager->isEnabled()) {
			try {
				$moduleId = $this->encryptionManager->getDefaultEncryptionModuleId();
				if ($moduleId === 'OC_DEFAULT_MODULE') {
					/** @var \OCA\Encryption\Util $util */
					$util = \OC::$server->get(\OCA\Encryption\Util::class);
					$isHomeStorageEncrypted = $util->shouldEncryptHomeStorage();
					$isMasterKeyEnabled = $util->isMasterKeyEnabled();
				}
			} catch (Throwable $e) {
			}
		}

		$this->initialStateService->provideInitialState('privacy', 'privacyPolicyUrl', $privacyPolicyUrl);
		$this->initialStateService->provideInitialState('privacy', 'fullDiskEncryptionEnabled', $this->config->getAppValue('privacy', 'fullDiskEncryptionEnabled', '0') === '1');
		$this->initialStateService->provideInitialState('privacy', 'serverSideEncryptionEnabled', $this->encryptionManager->isEnabled());
		$this->initialStateService->provideInitialState('privacy', 'homeStorageEncryptionEnabled', $isHomeStorageEncrypted);
		$this->initialStateService->provideInitialState('privacy', 'masterKeyEncryptionEnabled', $isMasterKeyEnabled);


		return new TemplateResponse('privacy', 'who-has-access');
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
		return 10;
	}
}
