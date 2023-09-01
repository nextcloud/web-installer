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

use OCA\RelatedResources\Exceptions\DeckDataNotFoundException;
use OCA\RelatedResources\Model\DeckBoard;
use OCA\RelatedResources\Model\DeckShare;
use OCP\Share\IShare;

class DeckRequest extends DeckRequestBuilder {
	/**
	 * @param int $itemId
	 *
	 * @return DeckBoard
	 * @throws DeckDataNotFoundException
	 */
	public function getBoardById(int $itemId): DeckBoard {
		$qb = $this->getDeckBoardSelectSql();
		$qb->limitInt('id', $itemId);

		return $this->getDeckFromRequest($qb);
	}


	/**
	 * @param int $boardId
	 *
	 * @return DeckShare[]
	 */
	public function getSharesByBoardId(int $boardId): array {
		$qb = $this->getDeckShareSelectSql();
		$qb->limitInt('board_id', $boardId);

		return $this->getSharesFromRequest($qb);
	}


	/**
	 * @param string $singleId
	 *
	 * @return DeckBoard[]
	 */
	public function getDeckAvailableToCircle(string $singleId): array {
		$qb = $this->getDeckBoardSelectSql();
		$qb->innerJoin(
			$qb->getDefaultSelectAlias(), self::TABLE_DECK_SHARE, 'ds',
			$qb->expr()->eq($qb->getDefaultSelectAlias() . '.id', 'ds.board_id')
		);

		$qb->limitInt('type', IShare::TYPE_CIRCLE, 'ds');
		$qb->limit('participant', $singleId, 'ds');

		return $this->getDecksFromRequest($qb);
	}


	/**
	 * @param string $groupName
	 *
	 * @return DeckBoard[]
	 */
	public function getDeckAvailableToGroup(string $groupName): array {
		$qb = $this->getDeckBoardSelectSql();
		$qb->innerJoin(
			$qb->getDefaultSelectAlias(), self::TABLE_DECK_SHARE, 'ds',
			$qb->expr()->eq($qb->getDefaultSelectAlias() . '.id', 'ds.board_id')
		);

		$qb->limitInt('type', IShare::TYPE_GROUP, 'ds');
		$qb->limit('participant', $groupName, 'ds');

		return $this->getDecksFromRequest($qb);
	}


	/**
	 * @param string $userName
	 *
	 * @return DeckBoard[]
	 */
	public function getDeckAvailableToUser(string $userName): array {
		$qb = $this->getDeckBoardSelectSql();
		$qb->innerJoin(
			$qb->getDefaultSelectAlias(), self::TABLE_DECK_SHARE, 'ds',
			$qb->expr()->eq($qb->getDefaultSelectAlias() . '.id', 'ds.board_id')
		);

		$qb->limitInt('type', IShare::TYPE_USER, 'ds');
		$qb->limit('participant', $userName, 'ds');

		return $this->getDecksFromRequest($qb);
	}
}
