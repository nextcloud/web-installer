<?php
/**
 * @copyright Copyright (c) 2017 Julius Härtl <jus@bitgrid.net>
 *
 * @author Julius Härtl <jus@bitgrid.net>
 *
 * @license GNU AGPL version 3 or any later version
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */

namespace OCA\Support;

class Section implements ISection {
	private string $identifier;
	private string $title;
	/** @var IDetail[]  */
	private array $details = [];

	public function __construct(string $identifier, string $title, int $order = 0) {
		$this->identifier = $identifier;
		$this->title = $title;
	}

	public function getIdentifier(): string {
		return $this->identifier;
	}

	public function getTitle(): string {
		return $this->title;
	}

	public function addDetail(IDetail $details): void {
		$this->details[] = $details;
	}

	/** @inheritdoc */
	public function getDetails(): array {
		return $this->details;
	}

	public function createDetail(string $title, string $information, int $type = IDetail::TYPE_SINGLE_LINE): IDetail {
		$detail = new Detail($this->getIdentifier(), $title, $information, $type);
		$this->addDetail($detail);
		return $detail;
	}
}
