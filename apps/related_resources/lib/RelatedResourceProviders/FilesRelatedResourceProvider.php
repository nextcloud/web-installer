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


namespace OCA\RelatedResources\RelatedResourceProviders;

use Exception;
use OC\User\NoUserException;
use OCA\Circles\CirclesManager;
use OCA\Circles\Model\FederatedUser;
use OCA\Circles\Model\Member;
use OCA\GroupFolders\Mount\GroupMountPoint;
use OCA\RelatedResources\Db\FilesShareRequest;
use OCA\RelatedResources\Exceptions\GroupFolderNotFoundException;
use OCA\RelatedResources\IRelatedResource;
use OCA\RelatedResources\IRelatedResourceProvider;
use OCA\RelatedResources\Model\FilesShare;
use OCA\RelatedResources\Model\RelatedResource;
use OCA\RelatedResources\Tools\Traits\TArrayTools;
use OCP\Files\InvalidPathException;
use OCP\Files\IRootFolder;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\IL10N;
use OCP\IURLGenerator;
use OCP\Share\IShare;

class FilesRelatedResourceProvider implements IRelatedResourceProvider {
	use TArrayTools;

	private const PROVIDER_ID = 'files';

	public function __construct(
		private IRootFolder $rootFolder,
		private IURLGenerator $urlGenerator,
		private IL10N $l10n,
		private FilesShareRequest $filesShareRequest,
		private GroupFoldersRelatedResourceProvider $groupFoldersRRProvider,
	) {
	}

	public function getProviderId(): string {
		return self::PROVIDER_ID;
	}


	public function loadWeightCalculator(): array {
		return [];
	}


	public function getRelatedFromItem(CirclesManager $circlesManager, string $itemId): ?IRelatedResource {
		$itemId = (int)$itemId;
		if ($itemId <= 1) {
			return null;
		}

		$related = null;
		try {
			$itemEntries = $this->getItemIdsFromParentPath($circlesManager, $itemId);
		} catch (Exception $e) {
			$itemEntries = [['id' => $itemId]];
		}

		// TODO: create related item first, apply share recipient then.

		// cleaner way ?
		// should be already available in the current app
		$itemIds = array_values(
			array_filter(
				array_map(function (array $entry): int {
					return (($entry['type'] ?? 'files') === 'files') ? (int)$entry['id'] : 0;
				}, $itemEntries)
			)
		);

		foreach ($this->filesShareRequest->getSharesByItemIds($itemIds) as $share) {
			if ($related === null) {
				$related = $this->convertToRelatedResource($share);
			}
			$this->processShareRecipient($circlesManager, $related, $share);
		}

		$related = $this->managerGroupFolders($circlesManager, $related, $itemEntries);

		return $related;
	}


	public function getItemsAvailableToEntity(FederatedUser $entity): array {
		switch ($entity->getBasedOn()->getSource()) {
			case Member::TYPE_USER:
				$shares = $this->filesShareRequest->getSharesToUser($entity->getUserId());
				break;

			case Member::TYPE_GROUP:
				$shares = $this->filesShareRequest->getSharesToGroup($entity->getUserId());
				break;

			case Member::TYPE_CIRCLE:
				$shares = $this->filesShareRequest->getSharesToCircle($entity->getSingleId());
				break;

			default:
				return [];
		}

		return array_map(function (FilesShare $share): string {
			return (string)$share->getFileId();
		}, $shares);
	}


	public function improveRelatedResource(CirclesManager $circlesManager, IRelatedResource $entry): void {
		$current = $circlesManager->getCurrentFederatedUser();
		if (!$current->isLocal() || $current->getUserType() !== Member::TYPE_USER) {
			return;
		}

		$paths = $this->rootFolder->getUserFolder($current->getUserId())
								  ->getById((int)$entry->getItemId());

		if (sizeof($paths) > 0) {
			$entry->setTitle($paths[0]->getName());
		}
	}


	private function convertToRelatedResource(FilesShare $share): IRelatedResource {
		$related = new RelatedResource(self::PROVIDER_ID, (string)$share->getFileId());
		$related->setTitle(trim($share->getFileTarget(), '/'));
		$related->setSubtitle($this->l10n->t('Files'));
		$related->setTooltip($this->l10n->t('File "%s"', $share->getFileTarget()));
		$related->setIcon(
			$this->urlGenerator->getAbsoluteURL(
				$this->urlGenerator->imagePath(
					'files',
					'app.svg'
				)
			)
		);

		$related->setUrl(
			$this->urlGenerator->linkToRouteAbsolute('files.View.showFile', ['fileid' => $share->getFileId()])
		);
		$related->setMetas(
			[
				RelatedResource::ITEM_LAST_UPDATE => $share->getFileLastUpdate(),
				RelatedResource::ITEM_OWNER => $share->getFileOwner(),
				//				RelatedResource::LINK_CREATOR => $share->getShareCreator(),
				RelatedResource::LINK_CREATION => $share->getShareTime()
			]
		);

		$keywords = preg_split('/[\/_\-. ]/', ltrim(strtolower($share->getFileTarget()), '/'));
		if (is_array($keywords)) {
			$related->setMetaArray(RelatedResource::ITEM_KEYWORDS, $keywords);
		}

		return $related;
	}


	/**
	 * @param list<array{id:int,type?:string}> $itemEntries
	 */
	private function managerGroupFolders(
		CirclesManager $circlesManager,
		?IRelatedResource $related,
		array $itemEntries
	): ?IRelatedResource {
		foreach ($itemEntries as $entry) {
			if (($entry['type'] ?? '') !== 'groupfolder') {
				continue;
			}
			try {
				$folder = $this->groupFoldersRRProvider->getFolder($entry['id']);
			} catch (GroupFolderNotFoundException $e) {
				continue;
			}

			if ($related === null) {
				$related = $this->groupFoldersRRProvider->convertToRelatedResource($folder);
			}

			$this->groupFoldersRRProvider->processApplicableMap(
				$circlesManager,
				$related,
				$folder['groups'] ?? []
			);
		}

		return $related;
	}


	/**
	 * @param int $itemId
	 *
	 * @return list<array{id:int,type?:string}>
	 * @throws InvalidPathException
	 * @throws NotFoundException
	 * @throws NotPermittedException
	 * @throws NoUserException
	 */
	private function getItemIdsFromParentPath(CirclesManager $circlesManager, int $itemId): array {
		$current = $circlesManager->getCurrentFederatedUser();
		if (!$current->isLocal() || $current->getUserType() !== Member::TYPE_USER) {
			return [['id' => $itemId]];
		}

		$paths = $this->rootFolder->getUserFolder($current->getUserId())
								  ->getById($itemId);

		$itemEntries = [];
		foreach ($paths as $path) {
			while (true) {
				$mountPoint = $path->getMountPoint();
				if ($mountPoint instanceof GroupMountPoint) {
					$itemEntries[] = [
						'id' => $mountPoint->getFolderId(),
						'type' => 'groupfolder'
					];
				}

				if ($path->getId() === 0) {
					break;
				}

				$itemEntries[] = ['id' => $path->getId()];
				$path = $path->getParent();
			}
		}

		return $itemEntries;
	}


	/**
	 * @param RelatedResource $related
	 * @param FilesShare $share
	 */
	private function processShareRecipient(
		CirclesManager $circlesManager,
		RelatedResource $related,
		FilesShare $share
	) {
		try {
			$sharedWith = $this->convertShareRecipient(
				$circlesManager,
				$share->getShareType(),
				$share->getSharedWith()
			);

			if ($share->getShareType() === IShare::TYPE_USER) {
				$shareCreator = $this->convertShareRecipient(
					$circlesManager,
					IShare::TYPE_USER,
					$share->getShareCreator()
				);

				$related->mergeVirtualGroup(
					[
						$sharedWith->getSingleId(),
						$shareCreator->getSingleId()
					]
				);
			} else {
				$related->addRecipient($sharedWith->getSingleId())
						->setAsGroupShared();
			}
		} catch (Exception $e) {
		}
	}


	/**
	 * @param int $shareType
	 * @param string $sharedWith
	 *
	 * @return FederatedUser
	 * @throws Exception
	 */
	private function convertShareRecipient(
		CirclesManager $circlesManager,
		int $shareType,
		string $sharedWith
	): FederatedUser {
		$type = match ($shareType) {
			IShare::TYPE_USER => Member::TYPE_USER,
			IShare::TYPE_GROUP => Member::TYPE_GROUP,
			IShare::TYPE_CIRCLE => Member::TYPE_SINGLE,
			default => throw new Exception('unknown share type (' . $shareType . ')'),
		};

		return $circlesManager->getFederatedUser($sharedWith, $type);
	}
}
