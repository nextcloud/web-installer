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

use OCA\RelatedResources\Exceptions\FilesShareNotFoundException;
use OCA\RelatedResources\Model\FilesShare;
use OCA\RelatedResources\Tools\Exceptions\InvalidItemException;
use OCA\RelatedResources\Tools\Exceptions\RowNotFoundException;

class FilesShareRequestBuilder extends CoreQueryBuilder {
	/**
	 * @return CoreRequestBuilder
	 */
	protected function getFilesShareSelectSql(): CoreRequestBuilder {
		$qb = $this->getQueryBuilder();
		$qb->generateSelect(self::TABLE_FILES_SHARE, self::$externalTables[self::TABLE_FILES_SHARE]);

		return $qb;
	}


	/**
	 * @param CoreRequestBuilder $qb
	 *
	 * @return FilesShare
	 * @throws FilesShareNotFoundException
	 */
	public function getItemFromRequest(CoreRequestBuilder $qb): FilesShare {
		/** @var FilesShare $share */
		try {
			$share = $qb->asItem(FilesShare::class);
		} catch (InvalidItemException | RowNotFoundException $e) {
			throw new FilesShareNotFoundException();
		}

		return $share;
	}

	/**
	 * @param CoreRequestBuilder $qb
	 *
	 * @return FilesShare[]
	 */
	public function getItemsFromRequest(CoreRequestBuilder $qb): array {
		return $qb->asItems(FilesShare::class);
	}
}
