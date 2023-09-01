<?php
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

declare(strict_types=1);

/**
 * @copyright 2019 Christoph Wurst <christoph@winzerhof-wurst.at>
 *
 * @author 2019 Christoph Wurst <christoph@winzerhof-wurst.at>
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

use function array_map;
use function array_slice;
use function iterator_to_array;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\IL10N;
use function reset;
use function usort;
use Generator;
use OCP\Comments\IComment;
use OCP\Comments\ICommentsManager;
use OCP\IUser;

class RecentlyCommentedFilesSource implements IRecommendationSource {
	private ICommentsManager $commentsManager;
	private IRootFolder $rootFolder;
	private IL10N $l10n;

	public function __construct(ICommentsManager $commentsManager,
								IRootFolder $rootFolder,
								IL10N $l10n) {
		$this->commentsManager = $commentsManager;
		$this->rootFolder = $rootFolder;
		$this->l10n = $l10n;
	}

	private function getCommentsPage(int $offset, int $pageSize): array {
		return $this->commentsManager->search(
			'',
			'files',
			'',
			'',
			$offset,
			$pageSize
		);
	}

	private function getCommentedFile(IComment $comment, Folder $userFolder): ?FileWithComments {
		$nodes = $userFolder->getById((int)$comment->getObjectId());
		$first = reset($nodes);
		if ($first === false) {
			return null;
		}

		return new FileWithComments(
			$userFolder->getRelativePath($first->getParent()->getPath()),
			$first,
			$comment
		);
	}

	/**
	 * @param IUser $user
	 *
	 * @return Generator<FileWithComments>
	 */
	private function getAllCommentedFiles(IUser $user): Generator {
		$offset = 0;
		$pageSize = 100;

		$userFolder = $this->rootFolder->getUserFolder($user->getUID());

		while (count($page = $this->getCommentsPage($offset, $pageSize)) > 0) {
			foreach ($page as $comment) {
				$commentedFile = $this->getCommentedFile($comment, $userFolder);
				if (!is_null($commentedFile)) {
					yield $commentedFile;
				}
			}

			$offset += $pageSize;
		}
	}

	/**
	 * @param FileWithComments[] $original
	 * @return FileWithComments[]
	 */
	private function sortCommentedFiles(array $original): array {
		usort($original, function (FileWithComments $a, FileWithComments $b) {
			return $b->getComment()->getCreationDateTime()->getTimestamp() - $a->getComment()->getCreationDateTime()->getTimestamp();
		});
		return $original;
	}

	/**
	 * @param FileWithComments[] $comments
	 * @return FileWithComments[]
	 */
	private function getNMostRecentlyCommenedFiles(array $comments, int $n): array {
		$sorted = $this->sortCommentedFiles($comments);

		return array_slice($sorted, 0, $n);
	}

	/**
	 * @return IRecommendation[]
	 */
	public function getMostRecentRecommendation(IUser $user, int $max): array {
		$all = iterator_to_array($this->getAllCommentedFiles($user));

		return array_map(function (FileWithComments $file) {
			return new RecommendedFile(
				$file->getDirectory(),
				$file->getNode(),
				$file->getComment()->getCreationDateTime()->getTimestamp(),
				$this->l10n->t("Recently commented")
			);
		}, $this->getNMostRecentlyCommenedFiles($all, $max));
	}
}
