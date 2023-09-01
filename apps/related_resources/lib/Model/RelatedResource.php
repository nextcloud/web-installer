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
use OCA\RelatedResources\IRelatedResource;
use OCA\RelatedResources\Tools\IDeserializable;
use OCA\RelatedResources\Tools\Traits\TArrayTools;

/**
 * Class RelatedResource
 *
 * @package OCA\RelatedResources\Model
 */
class RelatedResource implements IRelatedResource, IDeserializable, JsonSerializable {
	use TArrayTools;

	public static float $IMPROVE_LOW_LINK = 1.1;
	public static float $IMPROVE_MEDIUM_LINK = 1.3;
	public static float $IMPROVE_HIGH_LINK = 1.8;
	private static float $DIMINISHING_RETURN = 0.6;

	public const ITEM_OWNER = 'itemOwner';
	public const ITEM_CREATION = 'itemCreation';
	public const ITEM_LAST_UPDATE = 'itemLastUpdate';
	public const ITEM_KEYWORDS = 'itemKeywords';
	public const LINK_CREATOR = 'linkCreator';
	public const LINK_CREATION = 'linkCreation';
	public const LINK_RECIPIENT = 'linkRecipient';

	private string $providerId;
	private string $itemId;
	private string $title = '';
	private string $subtitle = '';
	private string $tooltip = '';
	private string $icon = '';
	private string $url = '';
	private int $range = 0;
	private array $virtualGroup = [];
	private array $recipients = [];
	private bool $groupShared = false;
	private float $score = 1;
	private array $improvements = [];
	private array $currentQuality = [];
	private array $metas = [];

	public function __construct(string $providerId = '', string $itemId = '') {
		$this->providerId = $providerId;
		$this->itemId = $itemId;
	}

	public function getProviderId(): string {
		return $this->providerId;
	}

	public function setProviderId(string $providerId): self {
		$this->providerId = $providerId;

		return $this;
	}

	public function getItemId(): string {
		return $this->itemId;
	}

	public function setItemId(string $itemId): self {
		$this->itemId = $itemId;

		return $this;
	}

	public function setTitle(string $title): IRelatedResource {
		$this->title = $title;

		return $this;
	}

	public function getTitle(): string {
		return $this->title;
	}


	public function setSubtitle(string $subtitle): IRelatedResource {
		$this->subtitle = $subtitle;

		return $this;
	}

	public function getSubtitle(): string {
		return $this->subtitle;
	}


	public function setTooltip(string $tooltip): self {
		$this->tooltip = $tooltip;

		return $this;
	}

	public function getTooltip(): string {
		return $this->tooltip;
	}


	public function setIcon(string $icon): self {
		$this->icon = $icon;

		return $this;
	}

	public function getIcon(): string {
		return $this->icon;
	}


	public function setUrl(string $url): IRelatedResource {
		$this->url = $url;

		return $this;
	}

	public function getUrl(): string {
		return $this->url;
	}

	public function improve(
		float $quality,
		string $type,
		bool $diminishingReturn = true
	): IRelatedResource {
		$quality = ($this->currentQuality[$type] ?? $quality);
		$this->score = $this->score * $quality;
		$this->improvements[] = [
			'type' => $type,
			'quality' => $quality
		];

		if ($diminishingReturn) {
			$quality = 1 + (($quality - 1) * self::$DIMINISHING_RETURN);
		}

		$this->currentQuality[$type] = $quality;

		return $this;
	}

	public function getScore(): float {
		return $this->score;
	}

	public function setScore(int $score): self {
		$this->score = $score;

		return $this;
	}

	public function setVirtualGroup(array $virtualGroup): self {
		$this->virtualGroup = $virtualGroup;

		return $this;
	}

	public function getVirtualGroup(): array {
		return $this->virtualGroup;
	}

	public function addToVirtualGroup(string $singleId): self {
		if (!in_array($singleId, $this->virtualGroup)) {
			$this->virtualGroup[] = $singleId;
		}

		return $this;
	}

	public function mergeVirtualGroup(array $virtualGroup): self {
		$this->virtualGroup = array_values(array_unique(array_merge($this->virtualGroup, $virtualGroup)));

		return $this;
	}

	public function setRecipients(array $recipients): self {
		$this->recipients = $recipients;

		return $this;
	}

	public function getRecipients(): array {
		return $this->recipients;
	}

	public function addRecipient(string $singleId): self {
		if (!in_array($singleId, $this->recipients)) {
			$this->recipients[] = $singleId;
		}

		return $this;
	}

	public function mergeRecipients(array $recipients): self {
		$this->recipients = array_values(array_unique(array_merge($this->recipients, $recipients)));

		return $this;
	}

	public function setAsGroupShared(bool $groupShared = true): self {
		$this->groupShared = $groupShared;

		return $this;
	}

	public function isGroupShared(): bool {
		return $this->groupShared;
	}


	public function getImprovements(): array {
		return $this->improvements;
	}

	public function setImprovements(array $improvements): self {
		$this->improvements = $improvements;

		return $this;
	}

	public function setCurrentQuality(array $currentQuality): self {
		$this->currentQuality = $currentQuality;

		return $this;
	}

	public function getCurrentQuality(): array {
		return $this->currentQuality;
	}


	public function import(array $data): IDeserializable {
		$this->setProviderId($this->get('providerId', $data));
		$this->setItemId($this->get('itemId', $data));
		$this->setTitle($this->get('title', $data));
		$this->setSubtitle($this->get('subtitle', $data));
		$this->setTooltip($this->get('tooltip', $data));
		$this->setIcon($this->get('icon', $data));
		$this->setUrl($this->get('url', $data));
		$this->setScore($this->getInt('score', $data));
		$this->setAsGroupShared($this->getBool('groupShared', $data));
		$this->setRecipients($this->getArray('recipients', $data));
		$this->setVirtualGroup($this->getArray('virtualGroup', $data));
		$this->setImprovements($this->getArray('improvements', $data));
		$this->setCurrentQuality($this->getArray('currentQuality', $data));
		$this->setMetas($this->getArray('meta', $data));

		return $this;
	}

	public function jsonSerialize(): array {
		return [
			'providerId' => $this->getProviderId(),
			'itemId' => $this->getItemId(),
			'title' => $this->getTitle(),
			'subtitle' => $this->getSubtitle(),
			'tooltip' => $this->getTooltip(),
			'icon' => $this->getIcon(),
			'url' => $this->getUrl(),
			'score' => $this->getScore(),
			'groupShared' => $this->isGroupShared(),
			'virtualGroup' => $this->getVirtualGroup(),
			'recipients' => $this->getRecipients(),
			'improvements' => $this->getImprovements(),
			'currentQuality' => $this->getCurrentQuality(),
			'meta' => $this->getMetas()
		];
	}

	public static function cleanData(array $arr): array {
		static $acceptedKeys = [
			'providerId', 'itemId', 'title', 'subtitle', 'tooltip', 'url', 'icon', 'score',
			'improvements'
		];

		$new = [];
		foreach (array_keys($arr) as $k) {
			if (in_array($k, $acceptedKeys)) {
				$new[$k] = $arr[$k];
			}
		}

		return $new;
	}

	public function setMeta(string $k, string $v): IRelatedResource {
		$this->metas[$k] = $v;

		return $this;
	}

	public function setMetaInt(string $k, int $v): IRelatedResource {
		$this->metas[$k] = $v;

		return $this;
	}

	public function setMetaArray(string $k, array $v): IRelatedResource {
		$this->metas[$k] = $v;

		return $this;
	}

	public function setMetas(array $metas): IRelatedResource {
		$this->metas = array_merge($this->metas, $metas);

		return $this;
	}

	public function hasMeta(string $k): bool {
		return $this->validKey($k, $this->metas);
	}

	public function getMeta(string $k): string {
		return $this->get($k, $this->metas);
	}

	public function getMetaInt(string $k): int {
		return $this->getInt($k, $this->metas);
	}

	public function getMetaArray(string $k): array {
		return $this->getArray($k, $this->metas);
	}

	public function getMetas(): array {
		return $this->metas;
	}
}
