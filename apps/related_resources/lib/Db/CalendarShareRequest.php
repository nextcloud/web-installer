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


namespace OCA\RelatedResources\Db;

use OCA\RelatedResources\Exceptions\CalendarDataNotFoundException;
use OCA\RelatedResources\Model\Calendar;
use OCA\RelatedResources\Model\CalendarShare;

class CalendarShareRequest extends CalendarShareRequestBuilder {
	/**
	 * @param string $principalUri
	 * @param string $uri
	 *
	 * @return Calendar
	 * @throws CalendarDataNotFoundException
	 */
	public function getCalendarByUri(string $principalUri, string $uri): Calendar {
		$qb = $this->getCalendarSelectSql();
		$qb->limit('principaluri', $principalUri);
		$qb->limit('uri', $uri);

		return $this->getCalendarFromRequest($qb);
	}


	/**
	 * @param int $calendarId
	 *
	 * @return CalendarShare[]
	 */
	public function getSharesByCalendarId(int $calendarId): array {
		$qb = $this->getCalendarShareSelectSql();
		$qb->limit('type', 'calendar');
		$qb->limitInt('resourceid', $calendarId);

		return $this->getSharesFromRequest($qb);
	}


	/**
	 * @param string $singleId
	 *
	 * @return Calendar[]
	 */
	public function getCalendarAvailableToCircle(string $singleId): array {
		$qb = $this->getCalendarSelectSql();
		$qb->innerJoin(
			$qb->getDefaultSelectAlias(), self::TABLE_DAV_SHARE, 'ds',
			$qb->expr()->eq($qb->getDefaultSelectAlias() . '.id', 'ds.resourceid')
		);

		$qb->limit('type', 'calendar', 'ds');
		$qb->limit('principaluri', 'principals/circles/' . $singleId, 'ds');

		return $this->getCalendarsFromRequest($qb);
	}


	/**
	 * @param string $groupName
	 *
	 * @return Calendar[]
	 */
	public function getCalendarAvailableToGroup(string $groupName): array {
		$qb = $this->getCalendarSelectSql();
		$qb->innerJoin(
			$qb->getDefaultSelectAlias(), self::TABLE_DAV_SHARE, 'ds',
			$qb->expr()->eq($qb->getDefaultSelectAlias() . '.id', 'ds.resourceid')
		);

		$qb->limit('type', 'calendar', 'ds');
		$qb->limit('principaluri', 'principals/groups/' . $groupName, 'ds');

		return $this->getCalendarsFromRequest($qb);
	}


	/**
	 * @param string $userName
	 *
	 * @return Calendar[]
	 */
	public function getCalendarAvailableToUser(string $userName): array {
		$qb = $this->getCalendarSelectSql();
		$qb->innerJoin(
			$qb->getDefaultSelectAlias(), self::TABLE_DAV_SHARE, 'ds',
			$qb->expr()->eq($qb->getDefaultSelectAlias() . '.id', 'ds.resourceid')
		);

		$qb->limit('type', 'calendar', 'ds');
		$qb->limit('principaluri', 'principals/users/' . $userName, 'ds');

		return $this->getCalendarsFromRequest($qb);
	}
}
