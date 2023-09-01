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
use OCA\RelatedResources\Tools\Exceptions\InvalidItemException;
use OCA\RelatedResources\Tools\Exceptions\RowNotFoundException;

class CalendarShareRequestBuilder extends CoreQueryBuilder {
	/**
	 * @return CoreRequestBuilder
	 */
	protected function getCalendarSelectSql(): CoreRequestBuilder {
		$qb = $this->getQueryBuilder();
		$qb->generateSelect(self::TABLE_CALENDARS, self::$externalTables[self::TABLE_CALENDARS]);

		return $qb;
	}

	/**
	 * @return CoreRequestBuilder
	 */
	protected function getCalendarShareSelectSql(): CoreRequestBuilder {
		$qb = $this->getQueryBuilder();
		$qb->generateSelect(self::TABLE_DAV_SHARE, self::$externalTables[self::TABLE_DAV_SHARE]);

		return $qb;
	}

	/**
	 * @param CoreRequestBuilder $qb
	 *
	 * @return Calendar
	 * @throws CalendarDataNotFoundException
	 */
	public function getCalendarFromRequest(CoreRequestBuilder $qb): Calendar {
		/** @var Calendar $calendar */
		try {
			$calendar = $qb->asItem(Calendar::class);
		} catch (InvalidItemException | RowNotFoundException $e) {
			throw new CalendarDataNotFoundException();
		}

		return $calendar;
	}

	/**
	 * @param CoreRequestBuilder $qb
	 *
	 * @return Calendar[]
	 */
	public function getCalendarsFromRequest(CoreRequestBuilder $qb): array {
		return $qb->asItems(Calendar::class);
	}

	/**
	 * @param CoreRequestBuilder $qb
	 *
	 * @return CalendarShare[]
	 */
	public function getSharesFromRequest(CoreRequestBuilder $qb): array {
		return $qb->asItems(CalendarShare::class);
	}
}
