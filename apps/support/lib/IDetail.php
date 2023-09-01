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

interface IDetail {
	public const TYPE_SINGLE_LINE = 0;
	public const TYPE_MULTI_LINE = 1;
	public const TYPE_MULTI_LINE_PREFORMAT = 2;
	public const TYPE_COLLAPSIBLE = 3;
	public const TYPE_COLLAPSIBLE_PREFORMAT = 4;

	public function getTitle(): string;
	public function getType(): string;
	public function getInformation(): string;
	public function getSection(): int;
}
