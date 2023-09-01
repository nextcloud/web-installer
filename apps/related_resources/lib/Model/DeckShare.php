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

class DeckShare implements IQueryRow, JsonSerializable {
	use TArrayTools;

	private int $boardId = 0;
	private int $recipientType = 0;
	private string $recipientId = '';


	public function __construct() {
	}


	/**
	 * @param int $boardId
	 *
	 * @return DeckShare
	 */
	public function setBoardId(int $boardId): self {
		$this->boardId = $boardId;

		return $this;
	}

	/**
	 * @return int
	 */
	public function getBoardId(): int {
		return $this->boardId;
	}


	/**
	 * @param int $recipientType
	 *
	 * @return DeckShare
	 */
	public function setRecipientType(int $recipientType): self {
		$this->recipientType = $recipientType;

		return $this;
	}

	/**
	 * @return int
	 */
	public function getRecipientType(): int {
		return $this->recipientType;
	}


	/**
	 * @param string $recipientId
	 *
	 * @return DeckShare
	 */
	public function setRecipientId(string $recipientId): self {
		$this->recipientId = $recipientId;

		return $this;
	}

	/**
	 * @return string
	 */
	public function getRecipientId(): string {
		return $this->recipientId;
	}


	/**
	 * @param array $data
	 *
	 * @return IQueryRow
	 */
	public function importFromDatabase(array $data): IQueryRow {
		$this->setBoardId($this->getInt('board_id', $data))
			 ->setRecipientType($this->getInt('type', $data))
			 ->setRecipientId($this->get('participant', $data));

		return $this;
	}

	/**
	 * @return array
	 */
	public function jsonSerialize(): array {
		return [
			'boardId' => $this->getBoardId(),
			'recipientType' => $this->getRecipientType(),
			'recipientId' => $this->getRecipientId()
		];
	}
}
