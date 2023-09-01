<?php

declare(strict_types=1);

/**
 * @copyright 2018 Christoph Wurst <christoph@winzerhof-wurst.at>
 *
 * @author 2018 Christoph Wurst <christoph@winzerhof-wurst.at>
 *
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
 */

namespace OCA\Recommendations\Service;

use OCP\Files\Node;

class RecommendedFile implements IRecommendation {
	private string $directory;
	private Node $node;
	private int $timestamp;
	private string $reason;
	private bool $hasPreview;

	public function __construct(string $directory,
								Node $node,
								int $timestamp,
								string $reason) {
		$this->directory = $directory;
		$this->node = $node;
		$this->reason = $reason;
		$this->timestamp = $timestamp;
		$this->hasPreview = false;
	}

	public function getId(): string {
		return (string)$this->node->getId();
	}

	public function getDirectory(): string {
		return $this->directory;
	}

	public function getTimestamp(): int {
		return $this->timestamp;
	}

	public function getNode(): Node {
		return $this->node;
	}

	public function getReason(): string {
		return $this->reason;
	}

	public function hasPreview(): bool {
		return $this->hasPreview;
	}

	public function setHasPreview(bool $state) {
		$this->hasPreview = $state;
	}

	#[\ReturnTypeWillChange]
	public function jsonSerialize() {
		return [
			'id' => $this->getId(),
			'timestamp' => $this->getTimestamp(),
			'name' => $this->node->getName(),
			'directory' => $this->getDirectory(),
			'extension' => $this->node->getExtension(),
			'mimeType' => $this->node->getMimetype(),
			'hasPreview' => $this->hasPreview(),
			'reason' => $this->getReason(),
		];
	}
}
