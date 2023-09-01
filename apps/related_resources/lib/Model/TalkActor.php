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

class TalkActor implements IQueryRow, JsonSerializable {
	use TArrayTools;

	private string $actorType = '';
	private string $actorId = '';

	public function __construct() {
	}

	/**
	 * @param string $actorType
	 *
	 * @return TalkActor
	 */
	public function setActorType(string $actorType): self {
		$this->actorType = $actorType;

		return $this;
	}

	/**
	 * @return string
	 */
	public function getActorType(): string {
		return $this->actorType;
	}

	/**
	 * @param string $actorId
	 *
	 * @return TalkActor
	 */
	public function setActorId(string $actorId): self {
		$this->actorId = $actorId;

		return $this;
	}

	/**
	 * @return string
	 */
	public function getActorId(): string {
		return $this->actorId;
	}


	/**
	 * @param array $data
	 *
	 * @return IQueryRow
	 */
	public function importFromDatabase(array $data): IQueryRow {
		$this->setActorType($this->get('actor_type', $data))
			 ->setActorId($this->get('actor_id', $data));

		return $this;
	}

	/**
	 * @return array
	 */
	public function jsonSerialize(): array {
		return [
			'actorType' => $this->getActorType(),
			'actorId' => $this->getActorId()
		];
	}
}
