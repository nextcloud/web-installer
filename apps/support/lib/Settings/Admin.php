<?php
/**
 * @copyright Copyright (c) 2018 Morris Jobke <hey@morrisjobke.de>
 *
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

namespace OCA\Support\Settings;

use OCA\Support\Service\SubscriptionService;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IConfig;
use OCP\IURLGenerator;
use OCP\IUserManager;
use OCP\Settings\IDelegatedSettings;

class Admin implements IDelegatedSettings {
	private IConfig $config;
	private IUserManager $userManager;
	private IURLGenerator $urlGenerator;
	private SubscriptionService $subscriptionService;

	public function __construct(IConfig $config,
		IUserManager $userManager,
		IURLGenerator $urlGenerator,
		SubscriptionService $subscriptionService) {
		$this->userManager = $userManager;
		$this->config = $config;
		$this->urlGenerator = $urlGenerator;
		$this->subscriptionService = $subscriptionService;
	}

	/**
	 * @return TemplateResponse
	 */
	public function getForm() {
		$userCount = $this->subscriptionService->getUserCount();
		$activeUserCount = $this->userManager->countSeenUsers();

		$instanceSize = 'small';

		if ($userCount > SubscriptionService::THRESHOLD_MEDIUM) {
			if ($userCount > SubscriptionService::THRESHOLD_LARGE) {
				$instanceSize = 'large';
			} else {
				$instanceSize = 'medium';
			}
		}

		$subscriptionKey = $this->config->getAppValue('support', 'subscription_key', null);
		$potentialSubscriptionKey = $this->config->getAppValue('support', 'potential_subscription_key', null);
		$lastResponse = $this->config->getAppValue('support', 'last_response', '');
		$lastError = (int)$this->config->getAppValue('support', 'last_error', 0);
		// delete the invalid error, because there is no renewal happening
		if ($lastError === SubscriptionService::ERROR_FAILED_INVALID) {
			if ($subscriptionKey !== null && $subscriptionKey !== '') {
				$this->config->setAppValue('support', 'potential_subscription_key', $subscriptionKey);
			} else {
				$this->config->deleteAppValue('support', 'potential_subscription_key');
			}
			$this->config->deleteAppValue('support', 'last_error');
		} elseif ($lastError === SubscriptionService::ERROR_INVALID_SUBSCRIPTION_KEY) {
			$this->config->deleteAppValue('support', 'last_error');
		}
		$subscriptionInfo = json_decode($lastResponse, true);

		$now = new \DateTime();
		$subscriptionEndDate = new \DateTime($subscriptionInfo['endDate'] ?? 'now');
		if ($now > $subscriptionEndDate) {
			$years = 0;
			$months = 0;
			$days = 0;
			$weeks = 0;
		} else {
			$diff = $now->diff($subscriptionEndDate);
			$years = (int)$diff->format('%y');
			$months = (int)$diff->format('%m');
			$days = (int)$diff->format('%d');
			$weeks = floor($days / 7);

			/* run up to the next month for 4 weeks and more */
			if ($weeks > 3) {
				$months += 1;
				$weeks = 0;
				$days = 0;
			}
		}

		$specificSubscriptions = [];

		$collaboraEndDate = new \DateTime($subscriptionInfo['collabora']['endDate'] ?? 'yesterday');
		if ($now < $collaboraEndDate) {
			$specificSubscriptions[] = 'Collabora';
		}
		$talkEndDate = new \DateTime($subscriptionInfo['talk']['endDate'] ?? 'yesterday');
		if ($now < $talkEndDate) {
			$specificSubscriptions[] = 'Talk';
		}
		$groupwareEndDate = new \DateTime($subscriptionInfo['groupware']['endDate'] ?? 'yesterday');
		if ($now < $groupwareEndDate) {
			$specificSubscriptions[] = 'Groupware';
		}
		$allowedUsersCount = $subscriptionInfo['amountOfUsers'] ?? 0;
		$onlyCountActiveUsers = $subscriptionInfo['onlyCountActiveUsers'] ?? false;

		if ($allowedUsersCount === -1) {
			$isOverLimit = false;
		} elseif ($onlyCountActiveUsers) {
			$isOverLimit = $allowedUsersCount < $activeUserCount;
		} else {
			$isOverLimit = $allowedUsersCount < $userCount;
		}

		if (isset($subscriptionInfo['partnerContact']) && count($subscriptionInfo['partnerContact']) > 0) {
			$contactInfo = $subscriptionInfo['partnerContact'];
		} else {
			$contactInfo = $subscriptionInfo['accountManagerInfo'] ?? '';
		}

		$params = [
			'instanceSize' => $instanceSize,
			'userCount' => $userCount,
			'activeUserCount' => $activeUserCount,
			'subscriptionKey' => $subscriptionKey,
			'potentialSubscriptionKey' => $potentialSubscriptionKey,
			'lastError' => $lastError,
			'contactPerson' => $contactInfo,

			'subscriptionType' => $subscriptionInfo['level'] ?? '',
			'subscriptionUsers' => $allowedUsersCount,
			'onlyCountActiveUsers' => $onlyCountActiveUsers,
			'specificSubscriptions' => $specificSubscriptions,
			'extendedSupport' => $subscriptionInfo['extendedSupport'] ?? false,
			'expiryYears' => $years,
			'expiryMonths' => $months,
			'expiryWeeks' => $weeks,
			'expiryDays' => $days,

			'validSubscription' => ($years + $months + $days) > 0,
			'overLimit' => $isOverLimit,


			'showSubscriptionDetails' => is_array($subscriptionInfo),
			'showSubscriptionKeyInput' => !is_array($subscriptionInfo),
			'showCommunitySupportSection' => $instanceSize === 'small' && !is_array($subscriptionInfo),
			'showEnterpriseSupportSection' => $instanceSize !== 'small' && !is_array($subscriptionInfo),

			'subscriptionKeyUrl' => $this->urlGenerator->linkToRoute('support.api.setSubscriptionKey'),
		];

		return new TemplateResponse('support', 'admin', $params);
	}

	/**
	 * @return string the section ID, e.g. 'sharing'
	 */
	public function getSection() {
		return 'support';
	}

	/**
	 * @return int whether the form should be rather on the top or bottom of
	 * the admin section. The forms are arranged in ascending order of the
	 * priority values. It is required to return a value between 0 and 100.
	 *
	 * keep the server setting at the top, right after "server settings"
	 */
	public function getPriority() {
		return 0;
	}

	public function getName(): ?string {
		return null; // Only one setting in this section
	}

	public function getAuthorizedAppConfig(): array {
		return [
			'support' => ['.*'],
		];
	}
}
