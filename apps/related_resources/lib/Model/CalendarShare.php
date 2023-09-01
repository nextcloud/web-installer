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


namespace OCA\RelatedResources\Model;

use JsonSerializable;
use OCA\RelatedResources\Tools\Db\IQueryRow;
use OCA\RelatedResources\Tools\Traits\TArrayTools;

class CalendarShare implements IQueryRow, JsonSerializable {
	use TArrayTools;

	private int $calendarId = 0;
	private string $sharePrincipalUri = '';
	private int $type = 0;
	private string $user = '';

	public function __construct() {
	}

	public function setCalendarId(int $calendarId): self {
		$this->calendarId = $calendarId;

		return $this;
	}

	public function getCalendarId(): int {
		return $this->calendarId;
	}

	public function setSharePrincipalUri(string $sharePrincipalUri): self {
		$this->sharePrincipalUri = $sharePrincipalUri;

		return $this;
	}

	public function getSharePrincipalUri(): string {
		return $this->sharePrincipalUri;
	}


	/**
	 * @param int $type
	 *
	 * @return CalendarShare
	 */
	public function setType(int $type): self {
		$this->type = $type;

		return $this;
	}

	/**
	 * @return int
	 */
	public function getType(): int {
		return $this->type;
	}

	/**
	 * @param string $user
	 *
	 * @return CalendarShare
	 */
	public function setUser(string $user): self {
		$this->user = $user;

		return $this;
	}

	/**
	 * @return string
	 */
	public function getUser(): string {
		return $this->user;
	}


	public function importFromDatabase(array $data): IQueryRow {
		$this->setCalendarId($this->getInt('resourceid', $data))
			 ->setSharePrincipalUri($this->get('principaluri', $data));

		return $this;
	}

	public function jsonSerialize(): array {
		return [
			'id' => $this->getCalendarId(),
			'sharePrincipalUri' => $this->getSharePrincipalUri(),
			'type' => $this->getType(),
			'user' => $this->getUser()
		];
	}
}
