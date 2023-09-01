<?php

declare(strict_types=1);


/**
 * Nextcloud - Related Resources
 *
 * This file is licensed under the Affero General Public License version 3 or
 * later. See the COPYING file.
 *
 * @author Maxence Lange <maxence@pontapreta.net>
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


namespace OCA\RelatedResources;

use OCA\Circles\CirclesManager;
use OCA\Circles\Model\FederatedUser;

interface IRelatedResourceProvider {
	public function getProviderId(): string;

	/**
	 * returns the list of ILinkWeightCalculator provided by this app
	 *
	 * @return string[]
	 */
	public function loadWeightCalculator(): array;

	/**
	 * convert item to IRelatedResource, based on available shares
	 *
	 * @param CirclesManager $circlesManager
	 * @param string $itemId
	 *
	 * @return IRelatedResource|null
	 */
	public function getRelatedFromItem(CirclesManager $circlesManager, string $itemId): ?IRelatedResource;

	/**
	 * returns itemIds (as string) the entity have access to
	 *
	 * @param FederatedUser $entity
	 *
	 * @return string[]
	 */
	public function getItemsAvailableToEntity(FederatedUser $entity): array;

	/**
	 * improve a related resource before sending result to front-end.
	 *
	 * @param CirclesManager $circlesManager
	 * @param IRelatedResource $entry
	 *
	 * @return void
	 */
	public function improveRelatedResource(CirclesManager $circlesManager, IRelatedResource $entry): void;
}
