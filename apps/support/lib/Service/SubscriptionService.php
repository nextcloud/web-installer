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

namespace OCA\Support\Service;

use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Exception\RequestException;
use OC\User\Backend;
use OCP\Http\Client\IClientService;
use OCP\IConfig;
use OCP\IGroupManager;
use OCP\IURLGenerator;
use OCP\IUser;
use OCP\IUserManager;
use OCP\L10N\IFactory;
use OCP\Mail\IMailer;
use OCP\Notification\IManager;
use Psr\Log\LoggerInterface;

class SubscriptionService {
	public const ERROR_FAILED_RETRY = 1;
	public const ERROR_FAILED_INVALID = 2;
	public const ERROR_NO_INTERNET_CONNECTION = 3;
	public const ERROR_INVALID_SUBSCRIPTION_KEY = 4;

	public const THRESHOLD_MEDIUM = 500;
	public const THRESHOLD_LARGE = 1000;

	private IConfig $config;
	private IClientService $clientService;
	private LoggerInterface $log;
	private IUserManager $userManager;
	private int $userCount = -1;
	private int $activeUserCount = -1;
	private IManager $notifications;
	private IURLGenerator $urlGenerator;
	private IGroupManager $groupManager;
	private IMailer $mailer;
	private IFactory $l10nFactory;

	private $subscriptionInfoCache = null;

	public function __construct(
		IConfig $config,
		IClientService $clientService,
		LoggerInterface $log,
		IUserManager $userManager,
		IManager $notifications,
		IURLGenerator $urlGenerator,
		IGroupManager $groupManager,
		IMailer $mailer,
		IFactory $l10nFactory
	) {
		$this->config = $config;
		$this->clientService = $clientService;
		$this->log = $log;
		$this->userManager = $userManager;
		$this->notifications = $notifications;
		$this->urlGenerator = $urlGenerator;
		$this->groupManager = $groupManager;
		$this->mailer = $mailer;
		$this->l10nFactory = $l10nFactory;
	}

	public function setSubscriptionKey(string $subscriptionKey) {
		if (!preg_match('!^[a-zA-Z0-9-]{10,250}$!', $subscriptionKey)) {
			$this->config->setAppValue('support', 'last_error', self::ERROR_INVALID_SUBSCRIPTION_KEY);
			return;
		}

		$this->config->setAppValue('support', 'potential_subscription_key', $subscriptionKey);
		$this->config->deleteAppValue('support', 'last_error');

		$this->renewSubscriptionInfo(true);
	}

	public function getUserCount(): int {
		if ($this->userCount > 0) {
			return $this->userCount;
		}

		$userCount = 0;
		$backends = $this->userManager->getBackends();
		foreach ($backends as $backend) {
			if ($backend->implementsActions(Backend::COUNT_USERS)) {
				try {
					$backendUsers = $backend->countUsers();
				} catch (\Exception $e) {
					$backendUsers = false;

					$this->log->error($e->getMessage(), ['exception' => $e]);
				}
				if ($backendUsers !== false) {
					$userCount += $backendUsers;
				} else {
					// TODO what if the user count can't be determined?
					$this->log->warning('Can not determine user count for ' . get_class($backend), ['app' => 'support']);
				}
			}
		}

		$disabledUsers = $this->config->getUsersForUserValue('core', 'enabled', 'false');
		$disabledUsersCount = count($disabledUsers);
		$this->userCount = $userCount - $disabledUsersCount;

		if ($this->userCount < 0) {
			$this->userCount = 0;

			// TODO this should never happen
			$this->log->warning("Total user count was negative (users: $userCount, disabled: $disabledUsersCount)", ['app' => 'support']);
		}

		return $this->userCount;
	}

	public function getActiveUserCount(): int {
		if ($this->activeUserCount > 0) {
			return $this->activeUserCount;
		}

		$this->activeUserCount = $this->userManager->countSeenUsers();

		return $this->activeUserCount;
	}

	public function renewSubscriptionInfo(bool $fast) {
		$hasInternetConnection = $this->config->getSystemValue('has_internet_connection', true);

		if (!$hasInternetConnection) {
			$this->config->setAppValue('support', 'last_error', self::ERROR_NO_INTERNET_CONNECTION);
			return;
		}

		$subscriptionKey = $this->config->getAppValue('support', 'potential_subscription_key', '');

		if (!preg_match('!^[a-zA-Z0-9-]{10,250}$!', $subscriptionKey)) {
			// fallback to normal subscription key
			$subscriptionKey = $this->config->getAppValue('support', 'subscription_key', '');
			if (!preg_match('!^[a-zA-Z0-9-]{10,250}$!', $subscriptionKey)) {
				return;
			}
		}

		$backendURL = $this->config->getSystemValue('support.backend', 'https://cloud.nextcloud.com/');
		$backendURL = rtrim($backendURL, '/') . '/apps/zammad_organisation_management/api/query/subscription/' . $subscriptionKey;
		try {
			$userCount = $this->getUserCount();
			$activeUserCount = $this->userManager->countSeenUsers();

			$httpClient = $this->clientService->newClient();
			$response = $httpClient->post(
				$backendURL,
				[
					'body' => [
						'instanceId' => $this->config->getSystemValue('instanceid', ''),
						'userCount' => $userCount,
						'activeUserCount' => $activeUserCount,
						'version' => implode('.', \OCP\Util::getVersion()),
					],
					'timeout' => $fast ? 10 : 30,
					'connect_timeout' => $fast ? 3 : 30,
				]
			);

			$body = json_decode($response->getBody(), true);

			if ($response->getStatusCode() === 200 && is_array($body)) {
				$this->log->info('Subscription info successfully fetched');
				$this->config->setAppValue('support', 'subscription_key', $subscriptionKey);
				$this->config->setAppValue('support', 'last_check', time());
				$this->config->setAppValue('support', 'last_response', json_encode($body));
				$this->config->deleteAppValue('support', 'last_error');

				$currentUpdaterServer = $this->config->getSystemValue('updater.server.url', 'https://updates.nextcloud.com/updater_server/');
				$newUpdaterServer = 'https://updates.nextcloud.com/customers/' . $subscriptionKey . '/';

				/**
				 * only overwrite the updater server if:
				 * 	- it is the default one or another /.customers/ one
				 *  - there is a valid subscription
				 *  - there is a subscription key set
				 *  - the subscription key is halfway sane
				 */
				if (
					(
						$currentUpdaterServer === 'https://updates.nextcloud.com/updater_server/' ||
						substr($currentUpdaterServer, 0, 40) === 'https://updates.nextcloud.com/customers/'
					) &&
					$subscriptionKey !== '' &&
					preg_match('!^[a-zA-Z0-9-]{10,250}$!', $subscriptionKey)
				) {
					$this->config->setSystemValue('updater.server.url', $newUpdaterServer);
				}

				// remove all pending notifications
				$notification = $this->notifications->createNotification();
				$notification->setApp('support')
					->setSubject('subscription_info');
				$this->notifications->markProcessed($notification);
				return;
			}

			$this->log->info('Renewal of subscription info returned invalid data. URL: ' . $backendURL . ' Status: ' . $response->getStatusCode() . ' Body: ' . $response->getBody());
			$error = self::ERROR_FAILED_RETRY;
		} catch (ConnectException $e) {
			$this->log->info('Renew of subscription info failed due to connect exception - retrying later. URL: ' . $backendURL, ['app' => 'support', 'exception' => $e]);
			$error = self::ERROR_FAILED_RETRY;
		} catch (RequestException $e) {
			$response = $e->getResponse();

			if ($response !== null && $response->getStatusCode() === 403) {
				$this->log->info('Subscription key invalid');
				$this->config->deleteAppValue('support', 'potential_subscription_key');
				$error = self::ERROR_FAILED_INVALID;
			} else {
				$this->log->info('Renew of subscription info failed. URL: ' . $backendURL, ['app' => 'support', 'exception' => $e]);
				$error = self::ERROR_FAILED_RETRY;
			}
		} catch (\Exception $e) {
			$this->log->info('Renew of subscription info failed. URL: ' . $backendURL, ['app' => 'support', 'exception' => $e]);
			$error = self::ERROR_FAILED_RETRY;
		}

		$this->config->setAppValue('support', 'last_error', $error);
	}

	public function getSubscriptionInfo(): array {
		if ($this->subscriptionInfoCache !== null) {
			return $this->subscriptionInfoCache;
		}

		$userCount = $this->getUserCount();
		$activeUserCount = $this->getActiveUserCount();

		$instanceSize = 'small';

		if ($userCount > SubscriptionService::THRESHOLD_MEDIUM) {
			if ($userCount > SubscriptionService::THRESHOLD_LARGE) {
				$instanceSize = 'large';
			} else {
				$instanceSize = 'medium';
			}
		}

		$subscriptionInfo = $this->getMinimalSubscriptionInfo();

		$now = new \DateTime();
		$subscriptionEndDate = new \DateTime($subscriptionInfo['endDate'] ?? 'now');
		if ($now > $subscriptionEndDate) {
			$years = 0;
			$months = 0;
			$days = 0;
		} else {
			$diff = $now->diff($subscriptionEndDate);
			$years = (int)$diff->format('%y');
			$months = $years * 12 + (int)$diff->format('%m');
			$days = $months * 30 + (int)$diff->format('%d');
		}

		$hasSubscription = $subscriptionInfo !== null;
		$isInvalidSubscription = ($years + $months + $days) <= 0;
		$allowedUsersCount = $subscriptionInfo['amountOfUsers'] ?? 0;
		$onlyCountActiveUsers = $subscriptionInfo['onlyCountActiveUsers'] ?? false;
		if ($allowedUsersCount === -1) {
			$isOverLimit = false;
		} elseif ($onlyCountActiveUsers) {
			$isOverLimit = $allowedUsersCount < $activeUserCount;
		} else {
			$isOverLimit = $allowedUsersCount < $userCount;
		}

		$this->subscriptionInfoCache = [
			$instanceSize,
			$hasSubscription,
			$isInvalidSubscription,
			$isOverLimit,
			$subscriptionInfo
		];

		return $this->subscriptionInfoCache;
	}

	public function getMinimalSubscriptionInfo(): ?array {
		$lastResponse = $this->config->getAppValue('support', 'last_response', '');
		return json_decode($lastResponse, true);
	}

	public function checkSubscription() {
		$hasInternetConnection = $this->config->getSystemValue('has_internet_connection', true);

		if (!$hasInternetConnection) {
			return;
		}

		[
			$instanceSize,
			$hasSubscription,
			$isInvalidSubscription,
			$isOverLimit,
			$subscriptionInfo
		] = $this->getSubscriptionInfo();

		if ($hasSubscription && $isInvalidSubscription) {
			$this->handleExpired(
				$subscriptionInfo['accountManagerInfo']['name'] ?? '',
				$subscriptionInfo['accountManagerInfo']['email'] ?? '',
				$subscriptionInfo['accountManagerInfo']['phone'] ?? '');
		} elseif ($hasSubscription && $isOverLimit) {
			$this->handleOverLimit(
				$subscriptionInfo['accountManagerInfo']['name'] ?? '',
				$subscriptionInfo['accountManagerInfo']['email'] ?? '',
				$subscriptionInfo['accountManagerInfo']['phone'] ?? '');
		} elseif (!$hasSubscription && $instanceSize === 'large') {
			$this->handleNoSubscription($instanceSize);
		}
	}

	private function handleNoSubscription(string $instanceSize) {
		$currentTime = time();
		$installTime = (int)$this->config->getAppValue('core', 'installedat', $currentTime);

		// skip if installed within the last 30 days
		if (($installTime + 30 * 24 * 3600) > $currentTime) {
			return;
		}

		$lastNotificationTime = (int)$this->config->getAppValue('support', 'last_notification', 0);

		// skip if last notification was within the last 30 days
		if (($lastNotificationTime + 30 * 24 * 3600) > $currentTime) {
			return;
		}

		$updateLastNotificationTime = false;

		$adminGroup = $this->groupManager->get('admin');
		$adminUsers = $adminGroup->getUsers();

		foreach ($adminUsers as $adminUser) {
			$notification = $this->notifications->createNotification();
			$notification->setApp('support')
				->setObject('subscription', $instanceSize)
				->setSubject('subscription_info')
				->setUser($adminUser->getUID());

			$count = $this->notifications->getCount($notification);

			// skip if the user already has a notification
			if ($count > 0) {
				continue;
			}

			$notification->setDateTime(new \DateTime());
			$notification->setLink($this->urlGenerator->linkToRoute('settings.AdminSettings.index', ['section' => 'support']));
			$this->notifications->notify($notification);

			$updateLastNotificationTime = true;
		}

		foreach ($adminUsers as $adminUser) {
			$emailAddress = $adminUser->getEMailAddress();
			if ($emailAddress === null || $emailAddress === '') {
				continue;
			}

			$this->sendNoSubscriptionEmail($adminUser);

			$updateLastNotificationTime = true;
		}

		if ($updateLastNotificationTime) {
			$this->config->setAppValue('support', 'last_notification', $currentTime);
		}
	}

	private function handleOverLimit(string $accountManager, string $accountManagerEmail, string $accountManagerPhone) {
		$currentTime = time();

		$lastNotificationTime = (int)$this->config->getAppValue('support', 'last_over_limit_notification', 0);

		// skip if last notification was within the last 5 days
		if (($lastNotificationTime + 5 * 24 * 3600) > $currentTime) {
			return;
		}

		$updateLastNotificationTime = false;

		$adminGroup = $this->groupManager->get('admin');
		$adminUsers = $adminGroup->getUsers();

		foreach ($adminUsers as $adminUser) {
			$notification = $this->notifications->createNotification();
			$notification->setApp('support')
				->setObject('subscription', 'over_limit')
				->setSubject('subscription_over_limit')
				->setUser($adminUser->getUID());

			$count = $this->notifications->getCount($notification);

			// skip if the user already has a notification
			if ($count > 0) {
				continue;
			}

			$notification->setDateTime(new \DateTime());
			$notification->setLink($this->urlGenerator->linkToRoute('settings.AdminSettings.index', ['section' => 'support']));
			$this->notifications->notify($notification);

			$updateLastNotificationTime = true;
		}

		foreach ($adminUsers as $adminUser) {
			$emailAddress = $adminUser->getEMailAddress();
			if ($emailAddress === null || $emailAddress === '') {
				continue;
			}

			$this->sendOverLimitEmail(
				$adminUser,
				$accountManager,
				$accountManagerEmail,
				$accountManagerPhone
			);

			$updateLastNotificationTime = true;
		}

		if ($updateLastNotificationTime) {
			$this->config->setAppValue('support', 'last_over_limit_notification', $currentTime);
		}
	}

	private function handleExpired(string $accountManager, string $accountManagerEmail, string $accountManagerPhone) {
		$currentTime = time();

		$lastNotificationTime = (int)$this->config->getAppValue('support', 'last_expired_notification', 0);

		// skip if last notification was within the last 5 days
		if (($lastNotificationTime + 5 * 24 * 3600) > $currentTime) {
			return;
		}

		$updateLastNotificationTime = false;

		$adminGroup = $this->groupManager->get('admin');
		$adminUsers = $adminGroup->getUsers();

		foreach ($adminUsers as $adminUser) {
			$notification = $this->notifications->createNotification();
			$notification->setApp('support')
				->setObject('subscription', 'expired')
				->setSubject('subscription_expired')
				->setUser($adminUser->getUID());

			$count = $this->notifications->getCount($notification);

			// skip if the user already has a notification
			if ($count > 0) {
				continue;
			}

			$notification->setDateTime(new \DateTime());
			$notification->setLink($this->urlGenerator->linkToRoute('settings.AdminSettings.index', ['section' => 'support']));
			$this->notifications->notify($notification);

			$updateLastNotificationTime = true;
		}

		foreach ($adminUsers as $adminUser) {
			$emailAddress = $adminUser->getEMailAddress();
			if ($emailAddress === null || $emailAddress === '') {
				continue;
			}

			$this->sendExpiredEmail(
				$adminUser,
				$accountManager,
				$accountManagerEmail,
				$accountManagerPhone
			);

			$updateLastNotificationTime = true;
		}

		if ($updateLastNotificationTime) {
			$this->config->setAppValue('support', 'last_expired_notification', $currentTime);
		}
	}

	private function sendNoSubscriptionEmail(IUser $user) {
		// TODO what about enforced language?
		$language = $this->config->getUserValue($user->getUID(), 'core', 'lang', 'en');
		$l = $this->l10nFactory->get('support', $language);

		$link = $this->urlGenerator->getAbsoluteURL($this->urlGenerator->linkToRoute('settings.AdminSettings.index', ['section' => 'support']));

		$message = $this->mailer->createMessage();

		$emailTemplate = $this->mailer->createEMailTemplate('support.SubscriptionNotification', [
			'displayName' => $user->getDisplayName(),
		]);

		$emailTemplate->setSubject($l->t('Your server has no Nextcloud Subscription'));
		$emailTemplate->addHeader();
		$emailTemplate->addHeading($l->t('Your Nextcloud server is not backed by a Nextcloud Enterprise Subscription.'));
		$text = $l->t('A Nextcloud Enterprise Subscription means the original developers behind your self-hosted cloud server are 100%% dedicated to your success: the security, scalability, performance and functionality of your service!');

		$listItem1 = $l->t('If your server setup breaks and employees can\'t work anymore, you don\'t have to rely on searching online forums for a solution. You have direct access to our experienced engineers!');
		$listItem2 = $l->t('You have a contract with the vendor providing early security information, mitigations, patches and updates.');
		$listItem3 = $l->t('If you need to stay longer on your current version without disruptions, you don\'t have to run software without security updates.');
		$listItem4 = $l->t('You have the best expertise at hand to deal with performance and scalability issues.');
		$listItem5 = $l->t('You have access to the right documentation and expertise to quickly answer compliance questions or deliver on GDPR, HIPAA and other regulation requirements.');

		$text2 = $l->t('We can also provide Outlook integration, Online Office, scalable integrated audio-video and chat communication and other features only available in a limited form for free or develop further integrations and capabilities to your needs.');
		$text3 = $l->t('A subscription helps you get the most out of Nextcloud!');

		$emailTemplate->addBodyText(
			htmlspecialchars($text),
			$text
		);

		$emailTemplate->addBodyListItem(htmlspecialchars($listItem1), '', '', $listItem1);
		$emailTemplate->addBodyListItem(htmlspecialchars($listItem2), '', '', $listItem2);
		$emailTemplate->addBodyListItem(htmlspecialchars($listItem3), '', '', $listItem3);
		$emailTemplate->addBodyListItem(htmlspecialchars($listItem4), '', '', $listItem4);
		$emailTemplate->addBodyListItem(htmlspecialchars($listItem5), '', '', $listItem5);

		$emailTemplate->addBodyText(
			htmlspecialchars($text2) . '<br><br>' .
			htmlspecialchars($text3),
			$text2 . "\n\n" .
			$text3
		);

		$emailTemplate->addBodyButton(
			$l->t('Learn more now'),
			$link
		);

		$generalLink = $this->urlGenerator->getAbsoluteURL('/');
		$noteText = $l->t('This mail was sent to all administrators by the support app on your Nextcloud instance at %1$s because you have over %2$s registered users.', [$generalLink, self::THRESHOLD_LARGE]);
		$emailTemplate->addBodyText($noteText);

		$emailTemplate->addFooter();
		$message->useTemplate($emailTemplate);

		$attachment = $this->mailer->createAttachmentFromPath(__DIR__ . '/../../resources/Why the Nextcloud Subscription.pdf');
		$message->attach($attachment);
		$message->setTo([$user->getEMailAddress()]);

		$this->mailer->send($message);
	}

	private function sendOverLimitEmail(IUser $user, string $accountManager, string $accountManagerEmail, string $accountManagerPhone) {
		// TODO what about enforced language?
		$language = $this->config->getUserValue($user->getUID(), 'core', 'lang', 'en');
		$l = $this->l10nFactory->get('support', $language);

		$link = $this->urlGenerator->getAbsoluteURL($this->urlGenerator->linkToRoute('settings.AdminSettings.index', ['section' => 'support']));

		$message = $this->mailer->createMessage();

		$emailTemplate = $this->mailer->createEMailTemplate('support.SubscriptionNotification', [
			'displayName' => $user->getDisplayName(),
		]);

		$emailTemplate->setSubject($l->t('Your Nextcloud server Subscription is over limit'));
		$emailTemplate->addHeader();
		$emailTemplate->addHeading($l->t('Your Nextcloud server Subscription is over limit'));
		$text = $l->t('Dear admin,');
		$text2 = $l->t('Your Nextcloud Subscription doesn\'t cover the number of users who are currently active on this server. Please contact your Nextcloud account manager to get your subscription updated!');
		$text3 = $l->t('%1$s is your account manager and can be reached by email via %2$s or by phone via %3$s.', [$accountManager, $accountManagerEmail, $accountManagerPhone]);
		$text4 = $l->t('Thank you,');
		$text5 = $l->t('Your Nextcloud team');

		$emailTemplate->addBodyText(
			htmlspecialchars($text) . '<br><br>' .
			htmlspecialchars($text2) . '<br><br>' .
			htmlspecialchars($text3) . '<br><br>' .
			htmlspecialchars($text4) . '<br><br>' .
			htmlspecialchars($text5),
			$text . "\n\n" .
			$text2 . "\n\n" .
			$text3 . "\n\n" .
			$text4 . "\n\n" .
			$text5
		);

		$emailTemplate->addBodyButton(
			$l->t('Learn more now'),
			$link
		);

		$generalLink = $this->urlGenerator->getAbsoluteURL('/');
		$noteText = $l->t('This mail was sent to all administrators by the support app on your Nextcloud instance at %s because you have more users than your subscription covers.', [$generalLink]);
		$emailTemplate->addBodyText($noteText);

		$message->setTo([$user->getEMailAddress()]);

		$emailTemplate->addFooter();

		$message->useTemplate($emailTemplate);
		$this->mailer->send($message);
	}

	private function sendExpiredEmail(IUser $user, string $accountManager, string $accountManagerEmail, string $accountManagerPhone) {
		// TODO what about enforced language?
		$language = $this->config->getUserValue($user->getUID(), 'core', 'lang', 'en');
		$l = $this->l10nFactory->get('support', $language);

		$link = $this->urlGenerator->getAbsoluteURL($this->urlGenerator->linkToRoute('settings.AdminSettings.index', ['section' => 'support']));

		$message = $this->mailer->createMessage();

		$emailTemplate = $this->mailer->createEMailTemplate('support.SubscriptionNotification', [
			'displayName' => $user->getDisplayName(),
		]);

		$emailTemplate->setSubject($l->t('Your Nextcloud server Subscription is expired'));
		$emailTemplate->addHeader();
		$emailTemplate->addHeading($l->t('Your Nextcloud server Subscription is expired!'));
		$text = $l->t('Dear admin,');
		$text2 = $l->t('Your Nextcloud Subscription has expired! Please contact your Nextcloud account manager to get your subscription updated!');
		$text3 = $l->t('%1$s is your account manager and can be reached by email via %2$s or by phone via %3$s.', [$accountManager, $accountManagerEmail, $accountManagerPhone]);
		$text4 = $l->t('Thank you,');
		$text5 = $l->t('Your Nextcloud team');

		$emailTemplate->addBodyText(
			htmlspecialchars($text) . '<br><br>' .
			htmlspecialchars($text2) . '<br><br>' .
			htmlspecialchars($text3) . '<br><br>' .
			htmlspecialchars($text4) . '<br><br>' .
			htmlspecialchars($text5),
			$text . "\n\n" .
			$text2 . "\n\n" .
			$text3 . "\n\n" .
			$text4 . "\n\n" .
			$text5
		);

		$emailTemplate->addBodyButton(
			$l->t('Learn more now'),
			$link
		);

		$generalLink = $this->urlGenerator->getAbsoluteURL('/');
		$noteText = $l->t('This mail was sent to all administrators by the support app on your Nextcloud instance at %s because your subscription expired.', [$generalLink]);
		$emailTemplate->addBodyText($noteText);

		$message->setTo([$user->getEMailAddress()]);

		$emailTemplate->addFooter();

		$message->useTemplate($emailTemplate);
		$this->mailer->send($message);
	}
}
