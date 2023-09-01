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
use OCA\Circles\Model\FederatedUser;
use OCA\RelatedResources\Tools\Db\IQueryRow;
use OCA\RelatedResources\Tools\Traits\TArrayTools;

class FilesShare implements IQueryRow, JsonSerializable {
	use TArrayTools;


	private string $sharedWith = '';
	private int $shareType = 0;
	private ?FederatedUser $entity = null;
	private int $fileId = 0;
	private string $fileTarget = '';
	private string $fileOwner = '';
	private int $fileLastUpdate = 0;
	private int $shareTime = 0;
	private string $shareCreator = '';

	public function __construct() {
	}

	public function setSharedWith(string $sharedWith): self {
		$this->sharedWith = $sharedWith;

		return $this;
	}

	public function getSharedWith(): string {
		return $this->sharedWith;
	}

	public function setShareType(int $shareType): self {
		$this->shareType = $shareType;

		return $this;
	}

	public function getShareType(): int {
		return $this->shareType;
	}

	public function setFileId(int $fileId): self {
		$this->fileId = $fileId;

		return $this;
	}

	public function getFileId(): int {
		return $this->fileId;
	}

	public function setEntity(FederatedUser $entity): self {
		$this->entity = $entity;

		return $this;
	}

	public function getEntity(): ?FederatedUser {
		return $this->entity;
	}

	public function setFileTarget(string $fileTarget): self {
		$this->fileTarget = $fileTarget;

		return $this;
	}

	public function getFileTarget(): string {
		return $this->fileTarget;
	}

	public function setFileOwner(string $fileOwner): self {
		$this->fileOwner = $fileOwner;

		return $this;
	}

	public function getFileOwner(): string {
		return $this->fileOwner;
	}

	public function setFileLastUpdate(int $fileLastUpdate): self {
		$this->fileLastUpdate = $fileLastUpdate;

		return $this;
	}

	public function getFileLastUpdate(): int {
		return $this->fileLastUpdate;
	}

	public function setShareTime(int $shareTime): self {
		$this->shareTime = $shareTime;

		return $this;
	}

	public function getShareTime(): int {
		return $this->shareTime;
	}

	public function setShareCreator(string $shareCreator): self {
		$this->shareCreator = $shareCreator;

		return $this;
	}

	public function getShareCreator(): string {
		return $this->shareCreator;
	}

	public function importFromDatabase(array $data): IQueryRow {
		$this->setShareType($this->getInt('share_type', $data))
			 ->setSharedWith($this->get('share_with', $data))
			 ->setShareCreator($this->get('uid_initiator', $data))
			 ->setFileId($this->getInt('file_source', $data))
			 ->setFileOwner($this->get('uid_owner', $data))
			 ->setFileTarget($this->get('file_target', $data))
			 ->setShareTime($this->getInt('stime', $data));

		return $this;
	}

	public function jsonSerialize(): array {
		return [
			'shareType' => $this->getShareType(),
			'sharedWith' => $this->getSharedWith(),
			'shareCreator' => $this->getShareCreator(),
			'fileId' => $this->getFileId(),
			'fileTarget' => $this->getFileTarget(),
			'fileLastUpdate' => $this->getFileLastUpdate(),
			'shareTime' => $this->getShareTime(),
			'entity' => $this->getEntity()
		];
	}
}
