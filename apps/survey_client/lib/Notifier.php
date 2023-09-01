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

use OCP\IURLGenerator;
use OCP\L10N\IFactory;
use OCP\Notification\INotification;
use OCP\Notification\INotifier;

class Notifier implements INotifier {

	/** @var IFactory */
	protected $l10nFactory;

	/** @var IURLGenerator */
	protected $url;

	/**
	 * Notifier constructor.
	 *
	 * @param IFactory $l10nFactory
	 * @param IURLGenerator $url
	 */
	public function __construct(IFactory $l10nFactory, IURLGenerator $url) {
		$this->l10nFactory = $l10nFactory;
		$this->url = $url;
	}

	/**
	 * Identifier of the notifier, only use [a-z0-9_]
	 *
	 * @return string
	 * @since 17.0.0
	 */
	public function getID(): string {
		return 'survey_client';
	}

	/**
	 * Human readable name describing the notifier
	 *
	 * @return string
	 * @since 17.0.0
	 */
	public function getName(): string {
		return $this->l10nFactory->get('survey_client')->t('Usage survey');
	}

	/**
	 * @param INotification $notification
	 * @param string $languageCode The code of the language that should be used to prepare the notification
	 * @return INotification
	 * @throws \InvalidArgumentException When the notification was not prepared by a notifier
	 */
	public function prepare(INotification $notification, string $languageCode): INotification {
		if ($notification->getApp() !== 'survey_client') {
			// Not my app => throw
			throw new \InvalidArgumentException();
		}

		// Read the language from the notification
		$l = $this->l10nFactory->get('survey_client', $languageCode);

		$notification->setParsedSubject($l->t('Help improve Nextcloud'))
			->setParsedMessage($l->t('Do you want to help us to improve Nextcloud by providing some anonymized data about your setup and usage? You can disable it at any time in the admin settings again.'))
			->setLink($this->url->linkToRoute('settings.AdminSettings.index', ['section' => 'survey_client']))
			->setIcon($this->url->imagePath('survey_client', 'app-dark.svg'));

		foreach ($notification->getActions() as $action) {
			if ($action->getLabel() === 'disable') {
				$action->setParsedLabel($l->t('Not now'))
					->setLink($this->url->getAbsoluteURL('ocs/v2.php/apps/survey_client/api/v1/monthly'), 'DELETE');
			} elseif ($action->getLabel() === 'enable') {
				$action->setParsedLabel($l->t('Send usage'))
					->setLink($this->url->getAbsoluteURL('ocs/v2.php/apps/survey_client/api/v1/monthly'), 'POST');
			}
			$notification->addParsedAction($action);
		}

		return $notification;
	}
}
