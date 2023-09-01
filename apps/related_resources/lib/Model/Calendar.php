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

class Calendar implements IQueryRow, JsonSerializable {
	use TArrayTools;

	private int $calendarId = 0;
	private string $calendarName = '';
	private string $calendarPrincipalUri = '';
	private string $calendarUri = '';

	public function __construct() {
	}

	public function getId(): string {
		return $this->getCalendarPrincipalUri() . ':' . $this->getCalendarUri();
	}

	public function setCalendarId(int $calendarId): self {
		$this->calendarId = $calendarId;

		return $this;
	}

	public function getCalendarId(): int {
		return $this->calendarId;
	}

	public function setCalendarName(string $calendarName): self {
		$this->calendarName = $calendarName;

		return $this;
	}

	public function getCalendarName(): string {
		return $this->calendarName;
	}

	public function setCalendarPrincipalUri(string $calendarPrincipalUri): self {
		$this->calendarPrincipalUri = $calendarPrincipalUri;

		return $this;
	}

	public function getCalendarPrincipalUri(): string {
		return $this->calendarPrincipalUri;
	}

	public function setCalendarUri(string $calendarUri): self {
		$this->calendarUri = $calendarUri;

		return $this;
	}

	public function getCalendarUri(): string {
		return $this->calendarUri;
	}

	public function importFromDatabase(array $data): IQueryRow {
		$this->setCalendarId($this->getInt('id', $data))
			 ->setCalendarName($this->get('displayname', $data))
			 ->setCalendarPrincipalUri($this->get('principaluri', $data))
			 ->setCalendarUri($this->get('uri', $data));

		return $this;
	}

	public function jsonSerialize(): array {
		return [
			'calendarName' => $this->getCalendarName(),
			'calendarPrincipalUri' => $this->getCalendarPrincipalUri(),
			'calendarUri' => $this->getCalendarUri()
		];
	}
}
