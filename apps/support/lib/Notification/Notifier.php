<?php

declare(strict_types=1);
/**
 * @copyright Copyright (c) 2018, Morris Jobke <hey@morrisjobke.de>
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

namespace OCA\Support\Notification;

use OCA\Support\AppInfo\Application;
use OCP\IConfig;
use OCP\IURLGenerator;
use OCP\L10N\IFactory;
use OCP\Notification\IManager;
use OCP\Notification\INotification;
use OCP\Notification\INotifier;

class Notifier implements INotifier {
	protected IURLGenerator $url;
	protected IConfig $config;
	protected IManager $notificationManager;
	protected IFactory $l10nFactory;

	public function __construct(IURLGenerator $url, IConfig $config, IManager $notificationManager, IFactory $l10nFactory) {
		$this->url = $url;
		$this->notificationManager = $notificationManager;
		$this->config = $config;
		$this->l10nFactory = $l10nFactory;
	}

	public function getID(): string {
		return 'support';
	}

	public function getName(): string {
		return $this->l10nFactory->get(Application::APP_ID)->t('Subscription notifications');
	}

	/**
	 * @param INotification $notification
	 * @param string $languageCode The code of the language that should be used to prepare the notification
	 * @return INotification
	 * @throws \InvalidArgumentException When the notification was not prepared by a notifier
	 * @since 9.0.0
	 */
	public function prepare(INotification $notification, string $languageCode): INotification {
		if ($notification->getApp() !== 'support') {
			throw new \InvalidArgumentException('Unknown app id');
		}

		$l = $this->l10nFactory->get('support', $languageCode);

		switch ($notification->getSubject()) {
			case 'subscription_info':
				$notification->setParsedSubject($l->t('Nextcloud Subscription'))
					->setParsedMessage($l->t('Your server has no Nextcloud Subscription or your Subscription has expired.'));
				$notification->setIcon($this->url->getAbsoluteURL($this->url->imagePath('support', 'notification.svg')));
				return $notification;

			case 'subscription_over_limit':
				$notification->setParsedSubject($l->t('Nextcloud Subscription'))
					->setParsedMessage($l->t('Your Nextcloud server subscription does not cover your number of users.'));
				$notification->setIcon($this->url->getAbsoluteURL($this->url->imagePath('support', 'notification.svg')));
				return $notification;

			case 'subscription_expired':
				$notification->setParsedSubject($l->t('Nextcloud Subscription'))
					->setParsedMessage($l->t('Your Nextcloud Subscription has expired!'));
				$notification->setIcon($this->url->getAbsoluteURL($this->url->imagePath('support', 'notification.svg')));
				return $notification;

			default:
				// Unknown subject => Unknown notification => throw
				throw new \InvalidArgumentException();
		}
	}
}
