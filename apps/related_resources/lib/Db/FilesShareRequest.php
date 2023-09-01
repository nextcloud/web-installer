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

use OCA\RelatedResources\Model\FilesShare;
use OCP\Share\IShare;

class FilesShareRequest extends FilesShareRequestBuilder {
	/**
	 * @param int $itemId
	 *
	 * @return FilesShare[]
	 */
	public function getSharesByItemId(int $itemId): array {
		$qb = $this->getFilesShareSelectSql();
		$qb->limitInt('file_source', $itemId);

		return $this->getItemsFromRequest($qb);
	}


	/**
	 * @param array $itemIds
	 *
	 * @return FilesShare[]
	 */
	public function getSharesByItemIds(array $itemIds): array {
		$qb = $this->getFilesShareSelectSql();
		$qb->limitInArray('file_source', $itemIds);

		return $this->getItemsFromRequest($qb);
	}


	/**
	 * @param string $singleId
	 *
	 * @return FilesShare[]
	 */
	public function getSharesToCircle(string $singleId): array {
		$qb = $this->getFilesShareSelectSql();
		$qb->limitInt('share_type', IShare::TYPE_CIRCLE);
		$qb->limit('share_with', $singleId);

		return $this->getItemsFromRequest($qb);
	}

	/**
	 * @param string $groupName
	 *
	 * @return FilesShare[]
	 */
	public function getSharesToGroup(string $groupName): array {
		$qb = $this->getFilesShareSelectSql();
		$qb->limitInt('share_type', IShare::TYPE_GROUP);
		$qb->limit('share_with', $groupName);

		return $this->getItemsFromRequest($qb);
	}


	/**
	 * @param string $userId
	 *
	 * @return FilesShare[]
	 */
	public function getSharesToUser(string $userId): array {
		$qb = $this->getFilesShareSelectSql();
		$qb->limitInt('share_type', IShare::TYPE_USER);
		$qb->limit('share_with', $userId);

		return $this->getItemsFromRequest($qb);
	}
}
