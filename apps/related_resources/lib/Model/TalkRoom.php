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

class TalkRoom implements IQueryRow, JsonSerializable {
	use TArrayTools;

	private int $roomId = 0;
	private string $roomName = '';
	private int $roomType = 0;
	private string $token = '';

	public function __construct() {
	}


	/**
	 * @param int $roomId
	 *
	 * @return TalkRoom
	 */
	public function setRoomId(int $roomId): self {
		$this->roomId = $roomId;

		return $this;
	}

	/**
	 * @return int
	 */
	public function getRoomId(): int {
		return $this->roomId;
	}


	/**
	 * @param string $roomName
	 *
	 * @return TalkRoom
	 */
	public function setRoomName(string $roomName): self {
		$this->roomName = $roomName;

		return $this;
	}

	/**
	 * @return string
	 */
	public function getRoomName(): string {
		return $this->roomName;
	}

	/**
	 * @param int $roomType
	 *
	 * @return TalkRoom
	 */
	public function setRoomType(int $roomType): self {
		$this->roomType = $roomType;

		return $this;
	}

	/**
	 * @return int
	 */
	public function getRoomType(): int {
		return $this->roomType;
	}


	/**
	 * @param string $token
	 */
	public function setToken(string $token): self {
		$this->token = $token;

		return $this;
	}

	/**
	 * @return string
	 */
	public function getToken(): string {
		return $this->token;
	}


	/**
	 * @param array $data
	 *
	 * @return IQueryRow
	 */
	public function importFromDatabase(array $data): IQueryRow {
		$this->setRoomId($this->getInt('id', $data))
			 ->setRoomName($this->get('name', $data))
			 ->setRoomType($this->getInt('type', $data))
			 ->setToken($this->get('token', $data));

		return $this;
	}

	/**
	 * @return array
	 */
	public function jsonSerialize(): array {
		return [
			'roomId' => $this->getRoomId(),
			'roomName' => $this->getRoomName(),
			'roomType' => $this->getRoomType(),
			'token' => $this->getToken()
		];
	}
}
