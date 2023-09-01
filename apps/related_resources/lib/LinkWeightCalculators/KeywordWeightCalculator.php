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

namespace OCA\RelatedResources\LinkWeightCalculators;

use OCA\RelatedResources\ILinkWeightCalculator;
use OCA\RelatedResources\IRelatedResource;
use OCA\RelatedResources\Model\RelatedResource;
use OCA\RelatedResources\Tools\Traits\TArrayTools;

class KeywordWeightCalculator implements ILinkWeightCalculator {
	use TArrayTools;


	/**
	 * @inheritDoc
	 */
	public function weight(IRelatedResource $current, array &$result): void {
		if (!$current->hasMeta(RelatedResource::ITEM_KEYWORDS)) {
			return;
		}

		foreach ($result as $entry) {
			if (!$entry->hasMeta(RelatedResource::ITEM_KEYWORDS)) {
				continue;
			}

			foreach ($entry->getMetaArray(RelatedResource::ITEM_KEYWORDS) as $kw) {
				if (strlen($kw) <= 3) {
					continue;
				}
				if (in_array($kw, $current->getMetaArray(RelatedResource::ITEM_KEYWORDS))) {
					$entry->improve(RelatedResource::$IMPROVE_HIGH_LINK, 'keyword');
				}
			}
		}
	}
}
