<?php
/**
 * @copyright Copyright (c) 2016, ownCloud, Inc.
 *
 * @author Robin Appelman <robin@icewind.nl>
 * @author Roeland Jago Douma <roeland@famdouma.nl>
 *
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
 * along with this program. If not, see <http://www.gnu.org/licenses/>
 *
 */
namespace OC\Files\Node;

use OCP\Files\IRootFolder;

/**
 * Class LazyRoot
 *
 * This is a lazy wrapper around the root. So only
 * once it is needed this will get initialized.
 *
 * @package OC\Files\Node
 */
class LazyRoot extends LazyFolder implements IRootFolder {
	/**
	 * @inheritDoc
	 */
	public function getUserFolder($userId) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	public function getByIdInPath(int $id, string $path) {
		return $this->__call(__FUNCTION__, func_get_args());
	}
}
