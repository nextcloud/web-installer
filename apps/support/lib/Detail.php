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

class Detail implements IDetail {
	private string $section;
	private string $title;
	private string $information;
	private int $type;

	public function __construct(string $section, string $title, string $information, int $type) {
		$this->section = $section;
		$this->title = $title;
		$this->information = $information;
		$this->type = $type;
	}

	public function getTitle(): string {
		return $this->title;
	}

	public function getType(): string {
		return $this->type;
	}

	public function getInformation(): string {
		return $this->information;
	}

	public function getSection(): int {
		return $this->section;
	}
}
