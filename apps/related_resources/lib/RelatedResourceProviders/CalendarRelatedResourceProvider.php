<?php

declare(strict_types=1);


/**
 * Nextcloud - Related Resources
 *
 * This file is licensed under the Affero General Public License version 3 or
 * later. See the COPYING file.
 *
 * @author Maxence Lange <maxence@artificial-owl.com>
 * @copyright 2022
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


namespace OCA\RelatedResources\RelatedResourceProviders;

use Exception;
use OCA\Circles\CirclesManager;
use OCA\Circles\Model\FederatedUser;
use OCA\Circles\Model\Member;
use OCA\RelatedResources\Db\CalendarShareRequest;
use OCA\RelatedResources\Exceptions\CalendarDataNotFoundException;
use OCA\RelatedResources\IRelatedResource;
use OCA\RelatedResources\IRelatedResourceProvider;
use OCA\RelatedResources\Model\Calendar;
use OCA\RelatedResources\Model\CalendarShare;
use OCA\RelatedResources\Model\RelatedResource;
use OCA\RelatedResources\Tools\Traits\TArrayTools;
use OCP\IL10N;
use OCP\IURLGenerator;

class CalendarRelatedResourceProvider implements IRelatedResourceProvider {
	use TArrayTools;

	private const PROVIDER_ID = 'calendar';

	private IURLGenerator $urlGenerator;
	private IL10N $l10n;
	private CalendarShareRequest $calendarShareRequest;

	public function __construct(
		IURLGenerator $urlGenerator,
		IL10N $l10n,
		CalendarShareRequest $calendarShareRequest
	) {
		$this->urlGenerator = $urlGenerator;
		$this->l10n = $l10n;
		$this->calendarShareRequest = $calendarShareRequest;
	}

	public function getProviderId(): string {
		return self::PROVIDER_ID;
	}

	public function loadWeightCalculator(): array {
		return [];
	}

	/**
	 * @param string $itemId
	 *
	 * @return IRelatedResource|null
	 */
	public function getRelatedFromItem(CirclesManager $circlesManager, string $itemId): ?IRelatedResource {
		[$principalUri, $uri] = explode(':', $itemId, 2);
		$itemId = (int)$itemId;

		/** @var Calendar $calendar */
		try {
			$calendar = $this->calendarShareRequest->getCalendarByUri($principalUri, $uri);
		} catch (CalendarDataNotFoundException $e) {
			return null;
		}

		$related = $this->convertToRelatedResource($calendar);
		if (strtolower(substr($calendar->getCalendarPrincipalUri(), 0, 17)) === 'principals/users/') {
			$calendarOwner = substr($calendar->getCalendarPrincipalUri(), 17);
			$owner = $circlesManager->getFederatedUser($calendarOwner, Member::TYPE_USER);
			$related->addToVirtualGroup($owner->getSingleId());
		}

		foreach ($this->calendarShareRequest->getSharesByCalendarId($calendar->getCalendarId()) as $share) {
			try {
				$this->completeShareDetails($share);
			} catch (Exception $e) {
				continue;
			}
			$this->processCalendarShare($circlesManager, $related, $share);
		}

		return $related;
	}


	public function getItemsAvailableToEntity(FederatedUser $entity): array {
		switch ($entity->getBasedOn()->getSource()) {
			case Member::TYPE_USER:
				$shares = $this->calendarShareRequest->getCalendarAvailableToUser($entity->getUserId());
				break;

			case Member::TYPE_GROUP:
				$shares = $this->calendarShareRequest->getCalendarAvailableToGroup($entity->getUserId());
				break;

			case Member::TYPE_CIRCLE:
				$shares = $this->calendarShareRequest->getCalendarAvailableToCircle($entity->getSingleId());
				break;

			default:
				return [];
		}

		return array_map(function (Calendar $calendar): string {
			return $calendar->getId();
		}, $shares);
	}


	public function improveRelatedResource(CirclesManager $circlesManager, IRelatedResource $entry): void {
	}



	private function convertToRelatedResource(Calendar $calendar): IRelatedResource {
		$related = new RelatedResource(self::PROVIDER_ID, $calendar->getId());

		$url = '';
		try {
			$url = $this->urlGenerator->linkToRouteAbsolute(
				'calendar.view.indexview.timerange',
				[
					'view' => 'dayGridMonth',
					'timeRange' => date('Y-m-d', time())
				]
			);
		} catch (Exception $e) {
		}

		$related->setTitle($calendar->getCalendarName())
				->setSubtitle($this->l10n->t('Calendar'))
				->setTooltip($this->l10n->t('Calendar "%s"', $calendar->getCalendarName()))
				->setIcon(
					$this->urlGenerator->getAbsoluteURL(
						$this->urlGenerator->imagePath(
							'calendar',
							'calendar.svg'
						)
					)
				)
				->setUrl($url);

		$keywords = preg_split(
			'/[\/_\-. ]/',
			ltrim(strtolower($calendar->getCalendarName()), '/')
		);
		if (is_array($keywords)) {
			$related->setMetaArray(RelatedResource::ITEM_KEYWORDS, $keywords);
		}

		return $related;
	}


	/**
	 * @param RelatedResource $related
	 * @param CalendarShare $share
	 */
	private function processCalendarShare(
		CirclesManager $circlesManager,
		RelatedResource $related,
		CalendarShare $share) {
		try {
			$participant = $circlesManager->getFederatedUser($share->getUser(), $share->getType());

			if ($share->getType() === Member::TYPE_USER) {
				$related->addToVirtualGroup($participant->getSingleId());
			} else {
				$related->addRecipient($participant->getSingleId())
						->setAsGroupShared();
			}
		} catch (Exception $e) {
		}
	}


	private function completeShareDetails(CalendarShare $share): void {
		[$type, $user] = explode('/', substr($share->getSharePrincipalUri(), 11), 2);
		switch ($type) {
			case 'users':
				$type = Member::TYPE_USER;
				break;

			case 'groups':
				$type = Member::TYPE_GROUP;
				break;

			case 'circles': // not supported yet by Calendar
				$type = Member::TYPE_SINGLE;
				break;

			default:
				throw new Exception();
		}

		$share->setType($type)
			  ->setUser($user);
	}
}
