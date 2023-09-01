<?php

declare(strict_types=1);

/**
 * Nextcloud - Related Resources
 *
 * This file is licensed under the Affero General Public License version 3 or
 * later. See the COPYING file.
 *
 * @author Maxence Lange <maxence@artificial-owl.com>
 * @copyright 2023
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

namespace OCA\RelatedResources\RelatedResourceProviders;

use OCA\Circles\CirclesManager;
use OCA\Circles\Model\FederatedUser;
use OCA\Circles\Model\Member;
use OCA\GroupFolders\Folder\FolderManager;
use OCA\RelatedResources\Db\FilesShareRequest;
use OCA\RelatedResources\Exceptions\GroupFolderNotFoundException;
use OCA\RelatedResources\IRelatedResource;
use OCA\RelatedResources\IRelatedResourceProvider;
use OCA\RelatedResources\Model\RelatedResource;
use OCA\RelatedResources\Tools\Traits\TArrayTools;
use OCP\AutoloadNotAllowedException;
use OCP\Files\IRootFolder;
use OCP\IL10N;
use OCP\IURLGenerator;
use OCP\Server;
use Psr\Container\ContainerExceptionInterface;

class GroupFoldersRelatedResourceProvider implements IRelatedResourceProvider {
	use TArrayTools;

	private const PROVIDER_ID = 'groupfolders';

	private ?FolderManager $folderManager = null;
	/**
	 * @var array<int, array{acl: bool, groups: array<array-key, array<array-key, int|string>>, id: int, mount_point: mixed, quota: int, size: 0}>
	 */
	private array $folders = [];

	public function __construct(
		private IRootFolder $rootFolder,
		private IURLGenerator $urlGenerator,
		private IL10N $l10n,
		private FilesShareRequest $filesShareRequest,
	) {
		try {
			$this->folderManager = Server::get(FolderManager::class);
			$this->folders = $this->folderManager->getAllFolders();
		} catch (ContainerExceptionInterface|AutoloadNotAllowedException $e) {
		}
	}

	public function getProviderId(): string {
		return self::PROVIDER_ID;
	}

	public function loadWeightCalculator(): array {
		return [];
	}

	public function getRelatedFromItem(CirclesManager $circlesManager, string $itemId): ?IRelatedResource {
		$itemId = (int)$itemId;
		if ($itemId < 1) {
			return null;
		}

		// need to get the groupfolders parent, based on itemId
		try {
			$folder = $this->getFolder($itemId);
		} catch (GroupFolderNotFoundException $e) {
			return null;
		}

		$related = $this->convertToRelatedResource($folder);
		$this->processApplicableMap($circlesManager, $related, $folder['groups'] ?? []);

		return $related;
	}

	public function getItemsAvailableToEntity(FederatedUser $entity): array {
		$items = [];
		foreach ($this->folders as $folder) {
			foreach ($folder['groups'] as $k => $entry) {
				if ($entity->getBasedOn()->getSource() === Member::TYPE_GROUP
					&& $entry['type'] === 'group'
					&& $k === $entity->getUserId()) {
					$items[] = (string)$folder['id'];
				}

				if ($entity->getBasedOn()->getSource() === Member::TYPE_CIRCLE
					&& $entry['type'] === 'circle'
					&& $k === $entity->getSingleId()) {
					$items[] = (string)$folder['id'];
				}
			}
		}

		return $items;
	}


	public function improveRelatedResource(CirclesManager $circlesManager, IRelatedResource $entry): void {
	}

	/**
	 * @param array{acl: bool, groups: array<array-key, array<array-key, int|string>>, id: int, mount_point: mixed, quota: int, size: 0} $folderData
	 */
	public function convertToRelatedResource(array $folderData): IRelatedResource {
		$related = new RelatedResource(self::PROVIDER_ID, (string)($folderData['id'] ?? 0));
		$folderName = $folderData['mount_point'] ?? 'groupfolder';
		$related->setTitle($folderName);
		$related->setSubtitle($this->l10n->t('Group Folder'));
		$related->setTooltip($this->l10n->t('Group Folder "%s"', '/' . $folderName . '/'));

		try {
			$related->setIcon(
				$this->urlGenerator->getAbsoluteURL(
					$this->urlGenerator->imagePath(
						'groupfolders',
						'app.svg'
					)
				)
			);
		} catch (\Exception $e) {
			// try/catch can be removed once groupfolders is released for nc27
		}

		$related->setUrl(
			$this->urlGenerator->linkToRouteAbsolute(
				'files.view.index',
				['dir' => '/' . $folderName]
			)
		);

		$related->setMetaArray(RelatedResource::ITEM_KEYWORDS, [$folderName]);

		return $related;
	}

	/**
	 * @param RelatedResource $related
	 * @param array<array-key, array<array-key, int|string>> $applicableMap
	 */
	public function processApplicableMap(
		CirclesManager $circlesManager,
		RelatedResource $related,
		array $applicableMap
	): void {
		foreach ($applicableMap as $k => $entry) {
			$entityId = '';
			if ($entry['type'] === 'circle') {
				$entityId = (string)$k;
			} elseif ($entry['type'] === 'group') {
				$federatedGroup = $circlesManager->getFederatedUser($k, Member::TYPE_GROUP);
				$entityId = $federatedGroup->getSingleId();
			}

			$related->addRecipient($entityId)
					->setAsGroupShared();
		}
	}


	/**
	 * @param int $folderId
	 *
	 * @return array{acl: bool, groups: array<array-key, array<array-key, int|string>>, id: int, mount_point: mixed, quota: int, size: 0}
	 * @throws GroupFolderNotFoundException
	 */
	public function getFolder(int $folderId): array {
		foreach ($this->folders as $folder) {
			if ($folder['id'] === $folderId) {
				return $folder;
			}
		}

		throw new GroupFolderNotFoundException();
	}
}
