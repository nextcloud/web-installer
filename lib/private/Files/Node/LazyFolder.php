<?php

declare(strict_types=1);

/**
 * @copyright Copyright (c) 2020 Robin Appelman <robin@icewind.nl>
 *
 * @author Robin Appelman <robin@icewind.nl>
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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */

namespace OC\Files\Node;

use OC\Files\Utils\PathHelper;
use OCP\Files\Folder;
use OCP\Constants;
use OCP\Files\Mount\IMountPoint;

/**
 * Class LazyFolder
 *
 * This is a lazy wrapper around a folder. So only
 * once it is needed this will get initialized.
 *
 * @package OC\Files\Node
 */
class LazyFolder implements Folder {
	/** @var \Closure(): Folder */
	private $folderClosure;

	/** @var LazyFolder | null */
	protected $folder = null;

	protected array $data;

	/**
	 * LazyFolder constructor.
	 *
	 * @param \Closure(): Folder $folderClosure
	 */
	public function __construct(\Closure $folderClosure, array $data = []) {
		$this->folderClosure = $folderClosure;
		$this->data = $data;
	}

	/**
	 * Magic method to first get the real rootFolder and then
	 * call $method with $args on it
	 *
	 * @param $method
	 * @param $args
	 * @return mixed
	 */
	public function __call($method, $args) {
		if ($this->folder === null) {
			$this->folder = call_user_func($this->folderClosure);
		}

		return call_user_func_array([$this->folder, $method], $args);
	}

	/**
	 * @inheritDoc
	 */
	public function getUser() {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function listen($scope, $method, callable $callback) {
		$this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function removeListener($scope = null, $method = null, callable $callback = null) {
		$this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function emit($scope, $method, $arguments = []) {
		$this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function mount($storage, $mountPoint, $arguments = []) {
		$this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getMount(string $mountPoint): IMountPoint {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @return IMountPoint[]
	 */
	public function getMountsIn(string $mountPoint): array {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getMountByStorageId($storageId) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getMountByNumericStorageId($numericId) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function unMount($mount) {
		$this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function get($path) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function rename($targetPath) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function delete() {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function copy($targetPath) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function touch($mtime = null) {
		$this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getStorage() {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getPath() {
		if (isset($this->data['path'])) {
			return $this->data['path'];
		}
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getInternalPath() {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getId() {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function stat() {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getMTime() {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getSize($includeMounts = true): int|float {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getEtag() {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getPermissions() {
		if (isset($this->data['permissions'])) {
			return $this->data['permissions'];
		}
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function isReadable() {
		if (isset($this->data['permissions'])) {
			return ($this->data['permissions'] & Constants::PERMISSION_READ) == Constants::PERMISSION_READ;
		}
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function isUpdateable() {
		if (isset($this->data['permissions'])) {
			return ($this->data['permissions'] & Constants::PERMISSION_UPDATE) == Constants::PERMISSION_UPDATE;
		}
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function isDeletable() {
		if (isset($this->data['permissions'])) {
			return ($this->data['permissions'] & Constants::PERMISSION_DELETE) == Constants::PERMISSION_DELETE;
		}
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function isShareable() {
		if (isset($this->data['permissions'])) {
			return ($this->data['permissions'] & Constants::PERMISSION_SHARE) == Constants::PERMISSION_SHARE;
		}
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getParent() {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getName() {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getUserFolder($userId) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getMimetype() {
		if (isset($this->data['mimetype'])) {
			return $this->data['mimetype'];
		}
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getMimePart() {
		if (isset($this->data['mimetype'])) {
			[$part,] = explode('/', $this->data['mimetype']);
			return $part;
		}
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function isEncrypted() {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getType() {
		if (isset($this->data['type'])) {
			return $this->data['type'];
		}
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function isShared() {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function isMounted() {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getMountPoint() {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getOwner() {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getChecksum() {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	public function getExtension(): string {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getFullPath($path) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function isSubNode($node) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getDirectoryListing() {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function nodeExists($path) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function newFolder($path) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function newFile($path, $content = null) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function search($query) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function searchByMime($mimetype) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function searchByTag($tag, $userId) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	public function searchBySystemTag(string $tagName, string $userId, int $limit = 0, int $offset = 0): array {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getById($id) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getFreeSpace() {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function isCreatable() {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getNonExistingName($name) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function move($targetPath) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function lock($type) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function changeLock($targetType) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function unlock($type) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getRecent($limit, $offset = 0) {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getCreationTime(): int {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	/**
	 * @inheritDoc
	 */
	public function getUploadTime(): int {
		return $this->__call(__FUNCTION__, func_get_args());
	}

	public function getRelativePath($path) {
		return PathHelper::getRelativePath($this->getPath(), $path);
	}
}
