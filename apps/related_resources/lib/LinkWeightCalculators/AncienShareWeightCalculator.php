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

class AncienShareWeightCalculator implements ILinkWeightCalculator {
	use TArrayTools;


	private static float $RATIO_5Y = 0.4;
	private static float $RATIO_3Y = 0.7;
	private static float $RATIO_1Y = 0.85;


	/**
	 * @inheritDoc
	 */
	public function weight(IRelatedResource $current, array &$result): void {
		if (!$current->hasMeta(RelatedResource::LINK_CREATION)) {
			return;
		}

		foreach ($result as $entry) {
			if (!$entry->hasMeta(RelatedResource::LINK_CREATION)) {
				continue;
			}

			$now = time();
			$entryCreation = $entry->getMetaInt(RelatedResource::LINK_CREATION);
			if ($entryCreation < $now - (5 * 360 * 24 * 3600)) { // 5y
				$entry->improve(self::$RATIO_5Y, 'ancien_5y');
			} elseif ($entryCreation < $now - (3 * 360 * 24 * 3600)) { // 3y
				$entry->improve(self::$RATIO_3Y, 'ancien_3y');
			} elseif ($entryCreation < $now - (360 * 24 * 3600)) { // 1y
				$entry->improve(self::$RATIO_1Y, 'ancien_1y');
			}

			$diff = abs(
				$current->getMetaInt(RelatedResource::LINK_CREATION)
				- $entry->getMetaInt(RelatedResource::LINK_CREATION)
			);

			// calculate an improvement base on 0.75 up to 1.2, based on difference of time between 2 shares
			// with 1.0 score for a 3 month period
			$neutral = 90 * 24 * 3600;
			$ratio = $diff - $neutral;
			$impr = 1 - ($ratio * 0.2 / $neutral);
			$impr = max($impr, 0.75);
			$entry->improve($impr, 'ancien_3m');
		}
	}
}
