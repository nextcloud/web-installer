<?php

declare(strict_types=1);

/**
 * @author Morris Jobke <hey@morrisjobke.de>
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

namespace OCA\Support\Subscription;

use OCA\Support\Service\SubscriptionService;
use OCP\IConfig;
use OCP\Support\Subscription\ISubscription;
use OCP\Support\Subscription\ISupportedApps;

class SubscriptionAdapter implements ISubscription, ISupportedApps {
	public function __construct(
		private SubscriptionService $subscriptionService,
		private IConfig $config,
	) {
	}

	/**
	 * Indicates if a valid subscription is available
	 */
	public function hasValidSubscription(): bool {
		[
			$instanceSize,
			$hasSubscription,
			$isInvalidSubscription,
			$isOverLimit,
			$subscriptionInfo
		] = $this->subscriptionService->getSubscriptionInfo();

		return !$isInvalidSubscription;
	}

	private function subscriptionNotExpired(string $endDate): bool {
		$subscriptionEndDate = new \DateTime($endDate);
		$now = new \DateTime();
		if ($now >= $subscriptionEndDate) {
			return false;
		}
		return true;
	}

	/**
	 * Fetches the list of app IDs that are supported by the subscription
	 *
	 * @since 17.0.0
	 */
	public function getSupportedApps(): array {
		[
			$instanceSize,
			$hasSubscription,
			$isInvalidSubscription,
			$isOverLimit,
			$subscriptionInfo
		] = $this->subscriptionService->getSubscriptionInfo();
		$hasValidGroupwareSubscription = $this->subscriptionNotExpired($subscriptionInfo['groupware']['endDate'] ?? 'now');
		$hasValidTalkSubscription = $this->subscriptionNotExpired($subscriptionInfo['talk']['endDate'] ?? 'now');
		$hasValidCollaboraSubscription = $this->subscriptionNotExpired($subscriptionInfo['collabora']['endDate'] ?? 'now');
		$hasValidOnlyOfficeSubscription = $this->subscriptionNotExpired($subscriptionInfo['onlyoffice']['endDate'] ?? 'now');

		$filesSubscription = [
			'accessibility',
			'activity',
			'admin_audit',
			'bruteforcesettings',
			'circles',
			'comments',
			'data_request',
			'dav',
			'encryption',
			'external',
			'federatedfilesharing',
			'federation',
			'files',
			'files_accesscontrol',
			'files_antivirus',
			'files_automatedtagging',
			'files_external',
			'files_fulltextsearch',
			'files_fulltextsearch_tesseract',
			'files_pdfviewer',
			'files_retention',
			'files_rightclick',
			'files_sharing',
			'files_trashbin',
			'files_versions',
			'files_videoplayer',
			'firstrunwizard',
			'fulltextsearch',
			'fulltextsearch_elasticsearch',
			'groupfolders',
			'guests',
			'logreader',
			'lookup_server_connector',
			'nextcloud_announcements',
			'notifications',
			'oauth2',
			'password_policy',
			'photos',
			'privacy',
			'provisioning_api',
			'recommendations',
			'serverinfo',
			'sharebymail',
			'sharepoint',
			'socialsharing_diaspora',
			'socialsharing_email',
			'socialsharing_facebook',
			'socialsharing_twitter',
			'support',
			'suspicious_login',
			'systemtags',
			'terms_of_service',
			'text',
			'theming',
			'twofactor_backupcodes',
			'twofactor_totp',
			'twofactor_u2f',
			'updatenotification',
			'user_ldap',
			'user_oidc',
			'user_saml',
			'viewer',
			'workflowengine',
			'workflow_script',
		];

		$nextcloudVersion = \OCP\Util::getVersion()[0];

		if ($nextcloudVersion >= 24) {
			$filesSubscription[] = 'files_lock';
		}
		
		if ($nextcloudVersion >= 22) {
			$filesSubscription[] = 'approval';
			$filesSubscription[] = 'contacts';
			$filesSubscription[] = 'files_zip';
		}

		if ($nextcloudVersion >= 20) {
			$filesSubscription[] = 'dashboard';
			$filesSubscription[] = 'flow_notifications';
			$filesSubscription[] = 'user_status';
			$filesSubscription[] = 'weather_status';
		}

		if ($nextcloudVersion >= 19) {
			$filesSubscription[] = 'contactsinteraction';
		}

		$supportedApps = [];

		if ($hasSubscription) {
			$supportedApps = array_merge($supportedApps, $filesSubscription);
		}
		if ($hasValidGroupwareSubscription) {
			$supportedApps[] = 'calendar';
			$supportedApps[] = 'contacts';
			$supportedApps[] = 'deck';
			$supportedApps[] = 'mail';
		}
		if ($hasValidTalkSubscription) {
			$supportedApps[] = 'spreed';
		}
		if ($hasValidCollaboraSubscription) {
			$supportedApps[] = 'richdocuments';
		}
		if ($hasValidOnlyOfficeSubscription) {
			$supportedApps[] = 'onlyoffice';
		}

		if (isset($subscriptionInfo['supportedApps'])) {
			foreach ($subscriptionInfo['supportedApps'] as $app) {
				if ($app !== '' && !in_array($app, $supportedApps)) {
					$supportedApps[] = $app;
				}
			}
		}

		return $supportedApps;
	}

	/**
	 * Indicates if the subscription has extended support
	 *
	 * @since 17.0.0
	 */
	public function hasExtendedSupport(): bool {
		$subscriptionInfo = $this->subscriptionService->getMinimalSubscriptionInfo();
		return $subscriptionInfo['extendedSupport'] ?? false;
	}

	/**
	 * Indicates if a hard user limit is reached and no new users should be created
	 *
	 * @since 21.0.0
	 */
	public function isHardUserLimitReached(): bool {
		[
			,,
			$isInvalidSubscription,
			$isOverLimit,
			$subscriptionInfo
		] = $this->subscriptionService->getSubscriptionInfo();

		$configUserLimit = (int) $this->config->getAppValue('support', 'user-limit', '0');
		if (
			!$isInvalidSubscription
			&& $configUserLimit > 0
			&& $configUserLimit <= $this->subscriptionService->getUserCount()
		) {
			return true;
		}

		if (!isset($subscriptionInfo['hasHardUserLimit']) || $subscriptionInfo['hasHardUserLimit'] === false) {
			return false;
		}

		return $isOverLimit;
	}
}
