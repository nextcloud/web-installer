<?php

declare(strict_types=1);


/**
 * Circles - Bring cloud-users closer together.
 *
 * This file is licensed under the Affero General Public License version 3 or
 * later. See the COPYING file.
 *
 * @author Maxence Lange <maxence@artificial-owl.com>
 * @copyright 2021
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


namespace OCA\Circles\Db;

use OCA\Circles\Tools\Exceptions\RowNotFoundException;
use OCA\Circles\Exceptions\MountNotFoundException;
use OCA\Circles\Model\Mount;

/**
 * Class MountRequestBuilder
 *
 * @package OCA\Circles\Db
 */
class MountRequestBuilder extends CoreRequestBuilder {
	/**
	 * @return CoreQueryBuilder
	 */
	protected function getMountInsertSql(): CoreQueryBuilder {
		$qb = $this->getQueryBuilder();
		$qb->insert(self::TABLE_MOUNT);

		return $qb;
	}


	/**
	 * @return CoreQueryBuilder
	 */
	protected function getMountUpdateSql(): CoreQueryBuilder {
		$qb = $this->getQueryBuilder();
		$qb->update(self::TABLE_MOUNT);

		return $qb;
	}


	/**
	 * @param string $alias
	 *
	 * @return CoreQueryBuilder
	 */
	protected function getMountSelectSql(string $alias = CoreQueryBuilder::MOUNT): CoreQueryBuilder {
		$qb = $this->getQueryBuilder();
		$qb->generateSelect(self::TABLE_MOUNT, self::$tables[self::TABLE_MOUNT], $alias);

		return $qb;
	}


	/**
	 * @return CoreQueryBuilder
	 */
	protected function getMountDeleteSql(): CoreQueryBuilder {
		$qb = $this->getQueryBuilder();
		$qb->delete(self::TABLE_MOUNT);

		return $qb;
	}


	/**
	 * @param CoreQueryBuilder $qb
	 *
	 * @return Mount
	 * @throws MountNotFoundException
	 */
	public function getItemFromRequest(CoreQueryBuilder $qb): Mount {
		/** @var Mount $circle */
		try {
			$circle = $qb->asItem(Mount::class);
		} catch (RowNotFoundException $e) {
			throw new MountNotFoundException('Mount not found');
		}

		return $circle;
	}

	/**
	 * @param CoreQueryBuilder $qb
	 *
	 * @return Mount[]
	 */
	public function getItemsFromRequest(CoreQueryBuilder $qb): array {
		/** @var Mount[] $result */
		return $qb->asItems(Mount::class);
	}
}
