<?php
/**
 * @author Joas Schilling <coding@schilljs.com>
 *
 * @copyright Copyright (c) 2016, ownCloud, Inc.
 * @license AGPL-3.0
 *
 * This code is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License, version 3,
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License, version 3,
 * along with this program.  If not, see <http://www.gnu.org/licenses/>
 *
 */

namespace OCA\Survey_Client\Categories;

/**
 * Interface ICategory
 *
 * TODO Move to core public API?
 *
 * @package OCA\Survey_Client\Categories
 */
interface ICategory {
	/**
	 * @return string
	 */
	public function getCategory();

	/**
	 * @return string
	 */
	public function getDisplayName();

	/**
	 * @return array (string => string|int)
	 */
	public function getData();
}
