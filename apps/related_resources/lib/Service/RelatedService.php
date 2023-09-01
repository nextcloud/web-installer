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


namespace OCA\RelatedResources\Service;

use Exception;
use OCA\Circles\CirclesManager;
use OCA\Circles\Exceptions\FederatedUserNotFoundException;
use OCA\Circles\Model\FederatedUser;
use OCA\Circles\Model\Member;
use OCA\RelatedResources\Exceptions\CacheNotFoundException;
use OCA\RelatedResources\Exceptions\RelatedResourceNotFound;
use OCA\RelatedResources\Exceptions\RelatedResourceProviderNotFound;
use OCA\RelatedResources\ILinkWeightCalculator;
use OCA\RelatedResources\IRelatedResource;
use OCA\RelatedResources\IRelatedResourceProvider;
use OCA\RelatedResources\LinkWeightCalculators\AncienShareWeightCalculator;
use OCA\RelatedResources\LinkWeightCalculators\KeywordWeightCalculator;
use OCA\RelatedResources\LinkWeightCalculators\TimeWeightCalculator;
use OCA\RelatedResources\Model\RelatedResource;
use OCA\RelatedResources\RelatedResourceProviders\CalendarRelatedResourceProvider;
use OCA\RelatedResources\RelatedResourceProviders\DeckRelatedResourceProvider;
use OCA\RelatedResources\RelatedResourceProviders\FilesRelatedResourceProvider;
use OCA\RelatedResources\RelatedResourceProviders\GroupFoldersRelatedResourceProvider;
use OCA\RelatedResources\RelatedResourceProviders\TalkRelatedResourceProvider;
use OCA\RelatedResources\Tools\Exceptions\InvalidItemException;
use OCA\RelatedResources\Tools\Traits\TDeserialize;
use OCP\App\IAppManager;
use OCP\AutoloadNotAllowedException;
use OCP\ICache;
use OCP\ICacheFactory;
use OCP\Server;
use Psr\Container\ContainerExceptionInterface;
use Psr\Container\NotFoundExceptionInterface;
use Psr\Log\LoggerInterface;
use ReflectionClass;
use ReflectionException;

class RelatedService {
	use TDeserialize;

	public const CACHE_RELATED = 'related/related';
	public const CACHE_RELATED_TTL = 600;
	public const CACHE_ITEMS_TTL = 600;

	private IAppManager $appManager;
	private ICache $cache;
	private LoggerInterface $logger;
	private ?CirclesManager $circlesManager = null;
	private ConfigService $configService;

	/** @var ILinkWeightCalculator[] */
	private array $weightCalculators = [];

	/** @var string[] */
	private static array $weightCalculators_ = [
		TimeWeightCalculator::class,
		KeywordWeightCalculator::class,
		AncienShareWeightCalculator::class
	];

	public function __construct(
		IAppManager $appManager,
		ICacheFactory $cacheFactory,
		LoggerInterface $logger,
		ConfigService $configService
	) {
		$this->appManager = $appManager;
		$this->cache = $cacheFactory->createDistributed(self::CACHE_RELATED);
		$this->logger = $logger;
		$this->configService = $configService;

		try {
			$this->circlesManager = Server::get(CirclesManager::class);
		} catch (ContainerExceptionInterface | AutoloadNotAllowedException $e) {
			$this->logger->notice($e->getMessage());
		}
	}


	/**
	 * @param string $providerId
	 * @param string $itemId
	 * @param int $chunk
	 *
	 * @return IRelatedResource[]
	 * @throws RelatedResourceProviderNotFound
	 */
	public function getRelatedToItem(string $providerId, string $itemId, int $chunk = -1): array {
		if ($this->circlesManager === null) {
			return [];
		}

		$result = $this->retrieveRelatedToItem($providerId, $itemId);

		usort($result, function (IRelatedResource $r1, IRelatedResource $r2): int {
			$a = $r1->getScore();
			$b = $r2->getScore();

			return ($a === $b) ? 0 : (($a > $b) ? -1 : 1);
		});

		return ($chunk > -1) ? array_slice($result, 0, $chunk) : $result;
	}


	/**
	 * Main method that will return resource related an item (identified by providerId and itemId)
	 *
	 * @param string $providerId
	 * @param string $itemId
	 *
	 * @return IRelatedResource[]
	 * @throws RelatedResourceProviderNotFound
	 */
	private function retrieveRelatedToItem(string $providerId, string $itemId): array {
		$this->logger->debug('retrieving related to item ' . $providerId . '.' . $itemId);

		try {
			// we generate a related resource for current item, including a full
			// list of recipients and virtual group
			$current = $this->getRelatedFromItem($providerId, $itemId);
		} catch (Exception $e) {
			return [];
		}

		if ($current->isGroupShared()) {
			$recipients = $current->getRecipients();
		} else {
			$recipients = $current->getVirtualGroup();
		}

		$result = [];
		foreach ($this->getRelatedResourceProviders() as $provider) {
			$known = [];
			if ($provider->getProviderId() === $providerId) {
				$known[] = $current->getItemId();
			}

			foreach ($recipients as $recipient) {
				// foreach provider, we get a list of items available to each recipient of the 'current' item
				// we only needs itemIds because, at this point, the full list of recipient each
				// item is shared to is not important
				// However, if 'current' item contains a group share, we do not need to waste resource to get
				// details about items available to single users as they are ignored in current scope of the app.
				try {
					$entity = $this->circlesManager->getFederatedUser($recipient);
				} catch (Exception $e) {
					continue;
				}

				if ($current->isGroupShared() && $entity->getBasedOn()->getSource() === Member::TYPE_USER) {
					continue;
				}

				foreach ($this->getItemsAvailableToEntity($provider, $entity) as $itemId) {
					if (in_array($itemId, $known)) {
						continue; // we don't want duplicate details
					}
					$known[] = $itemId;

					// foreach itemId, we get full details about it
					try {
						// cast to string is mandatory in here !
						$related = $this->getRelatedFromItem($provider->getProviderId(), (string)$itemId);
					} catch (RelatedResourceNotFound $e) {
						continue;
					}

					$result[] = $related;
				}
			}
		}

		$result = $this->strictMatching($current, $result);
		$result = $this->filterUnavailableResults($result);
		$result = $this->improveResult($result);

		$this->weightResult($current, $result);

		return $result;
	}


	/**
	 * get the RelatedResource from an item. including all recipient/virtual groups
	 *
	 * @param string $providerId
	 * @param string $itemId
	 *
	 * @return RelatedResource
	 * @throws RelatedResourceNotFound
	 * @throws RelatedResourceProviderNotFound
	 */
	public function getRelatedFromItem(string $providerId, string $itemId): RelatedResource {
		try {
			return $this->getCachedRelatedFromItem($providerId, $itemId);
		} catch (CacheNotFoundException $e) {
		}

		$result = $this->getRelatedResourceProvider($providerId)
					   ->getRelatedFromItem($this->circlesManager, $itemId);

		$this->logger->debug('get related to ' . $providerId . '.' . $itemId . ' - ' . json_encode($result));

		if ($result === null) {
			throw new RelatedResourceNotFound();
		}

		$this->cacheRelatedFromItem($providerId, $itemId, $result);

		return $result;
	}


	/**
	 * @param string $providerId
	 * @param string $itemId
	 *
	 * @return RelatedResource
	 * @throws CacheNotFoundException
	 */
	private function getCachedRelatedFromItem(
		string $providerId,
		string $itemId
	): RelatedResource {
		$key = $this->generateRelatedFromItemCacheKey($providerId, $itemId);
		$cachedData = $this->cache->get($key);

		if (!is_string($cachedData) || empty($cachedData)) {
			throw new CacheNotFoundException();
		}

		/** @var RelatedResource $result */
		try {
			$result = $this->deserializeJson($cachedData, RelatedResource::class);
		} catch (InvalidItemException $e) {
			throw new CacheNotFoundException();
		}

		$this->logger->debug(
			'existing cache on related from ' . $providerId . '.' . $itemId . ' - ' . json_encode($result)
		);

		return $result;
	}

	/**
	 * @param string $providerId
	 * @param string $itemId
	 * @param RelatedResource $related
	 */
	private function cacheRelatedFromItem(
		string $providerId,
		string $itemId,
		RelatedResource $related
	): void {
		$this->logger->debug(
			'caching related from ' . $providerId . '.' . $itemId . ' - ' . json_encode($related)
		);
		$key = $this->generateRelatedFromItemCacheKey($providerId, $itemId);

		$this->cache->set($key, json_encode($related), self::CACHE_RELATED_TTL);
	}

	/**
	 * @param string $providerId
	 * @param string $itemId
	 *
	 * @return string
	 */
	private function generateRelatedFromItemCacheKey(
		string $providerId,
		string $itemId
	): string {
		return 'relatedFromItem/' . $providerId . '::' . $itemId;
	}


	/**
	 * @param IRelatedResourceProvider $provider
	 * @param FederatedUser $entity
	 *
	 * @return string[]
	 */
	private function getItemsAvailableToEntity(
		IRelatedResourceProvider $provider,
		FederatedUser $entity
	): array {
		try {
			return $this->getCachedItemsAvailableToEntity($provider->getProviderId(), $entity->getSingleId());
		} catch (CacheNotFoundException $e) {
		}

		$result = $provider->getItemsAvailableToEntity($entity);
		$this->logger->debug(
			'get available items to ' . $entity->getSingleId() . ' from ' . $provider->getProviderId() . ' - '
			. json_encode($result)
		);

		$this->cacheItemsAvailableToEntity($provider->getProviderId(), $entity->getSingleId(), $result);

		return $result;
	}

	/**
	 * @param string $providerId
	 * @param string $singleId
	 *
	 * @return string[]
	 * @throws CacheNotFoundException
	 */
	private function getCachedItemsAvailableToEntity(
		string $providerId,
		string $singleId
	): array {
		$key = $this->generateItemsAvailableToEntityCacheKey($providerId, $singleId);
		$cachedData = $this->cache->get($key);

		if (!is_string($cachedData) || empty($cachedData)) {
			throw new CacheNotFoundException();
		}

		$result = json_decode($cachedData, true);
		if (!is_array($result)) {
			throw new CacheNotFoundException();
		}

		$this->logger->debug(
			'existing cache on available items to ' . $singleId . ' from ' . $providerId . ' - '
			. json_encode($result)
		);

		return $result;
	}

	/**
	 * @param string $providerId
	 * @param string $singleId
	 * @param array $result
	 */
	private function cacheItemsAvailableToEntity(
		string $providerId,
		string $singleId,
		array $result
	): void {
		$this->logger->debug(
			'caching available items to ' . $singleId . ' from ' . $providerId . ' - ' . json_encode($result)
		);
		$key = $this->generateItemsAvailableToEntityCacheKey($providerId, $singleId);

		$this->cache->set($key, json_encode($result), self::CACHE_ITEMS_TTL);
	}

	/**
	 * @param string $providerId
	 * @param string $singleId
	 *
	 * @return string
	 */
	private function generateItemsAvailableToEntityCacheKey(
		string $providerId,
		string $singleId
	): string {
		return 'availableItem/' . $providerId . '::' . $singleId;
	}


	/**
	 * @param RelatedResource $current
	 * @param RelatedResource[] $result
	 *
	 * @return RelatedResource[]
	 */
	private function strictMatching(RelatedResource $current, array $result): array {
		return array_filter($result, function (IRelatedResource $res) use ($current): bool {
			if ($current->isGroupShared()) {
				if (!$res->isGroupShared()) {
					return false;
				}

				if ($this->isStrict($current->getRecipients(), $res->getRecipients())) {
					return true;
				}
			} else {
				if ($res->isGroupShared()) {
					return false;
				}

				if ($this->isStrict($current->getVirtualGroup(), $res->getVirtualGroup())) {
					return true;
				}
			}

			return false;
		});
	}


	/**
	 * @param IRelatedResource[] $result
	 *
	 * @return IRelatedResource[]
	 */
	private function filterUnavailableResults(array $result): array {
		try {
			$current = $this->circlesManager->getCurrentFederatedUser();
		} catch (FederatedUserNotFoundException $e) {
			$this->circlesManager->startSession(); // in case session is lost, restart fresh one
			$current = $this->circlesManager->getCurrentFederatedUser();
		}

		return array_filter($result, function (IRelatedResource $res) use ($current): bool {
			$all = array_values(array_unique(array_merge($res->getVirtualGroup(), $res->getRecipients())));

			// is current user in the list already ?
			if (in_array($current->getSingleId(), $all)) {
				return true;
			}

			// or a member of an entity from the list ?
			foreach ($res->getRecipients() as $circleId) {
				try {
					$this->circlesManager->getLink($circleId, $current->getSingleId());

					return true;
				} catch (Exception $e) {
				}
			}

			return false;
		});
	}


	/**
	 * @param IRelatedResource[] $result
	 *
	 * @return array
	 * @throws RelatedResourceProviderNotFound
	 */
	private function improveResult(array $result): array {
		foreach ($result as $entry) {
			$this->getRelatedResourceProvider($entry->getProviderId())
				 ->improveRelatedResource($this->circlesManager, $entry);
		}

		return $result;
	}

	/**
	 * @param IRelatedResource $current
	 * @param IRelatedResource[] $result
	 *
	 * @return void
	 */
	private function weightResult(IRelatedResource $current, array &$result): void {
		foreach ($this->getWeightCalculators() as $weightCalculator) {
			$weightCalculator->weight($current, $result);
		}
	}

	/**
	 * @return ILinkWeightCalculator[]
	 */
	private function getWeightCalculators(): array {
		if (empty($this->weightCalculators)) {
			$classes = self::$weightCalculators_;
			foreach ($this->getRelatedResourceProviders() as $provider) {
				foreach ($provider->loadWeightCalculator() as $class) {
					$classes[] = $class;
				}
			}

			foreach ($classes as $class) {
				try {
					$test = new ReflectionClass($class);
					if (!in_array(ILinkWeightCalculator::class, $test->getInterfaceNames())) {
						throw new ReflectionException(
							$class . ' does not implements ILinkWeightCalculator'
						);
					}

					$this->weightCalculators[] = Server::get($class);
				} catch (NotFoundExceptionInterface | ContainerExceptionInterface | ReflectionException $e) {
					$this->logger->notice($e->getMessage());
				}
			}
		}

		return $this->weightCalculators;
	}


	/**
	 * @return IRelatedResourceProvider[]
	 */
	private function getRelatedResourceProviders(): array {
		$providers = [];

		try {
			$providers[] = Server::get(FilesRelatedResourceProvider::class);
		} catch (NotFoundExceptionInterface | ContainerExceptionInterface $e) {
			$this->logger->notice($e->getMessage());
		}


		if ($this->appManager->isInstalled('deck')) {
			try {
				$providers[] = Server::get(DeckRelatedResourceProvider::class);
			} catch (NotFoundExceptionInterface | ContainerExceptionInterface $e) {
				$this->logger->notice($e->getMessage());
			}
		}

		if ($this->appManager->isInstalled('calendar')) {
			try {
				$providers[] = Server::get(CalendarRelatedResourceProvider::class);
			} catch (NotFoundExceptionInterface | ContainerExceptionInterface $e) {
				$this->logger->notice($e->getMessage());
			}
		}

		if ($this->appManager->isInstalled('spreed')) {
			try {
				$providers[] = Server::get(TalkRelatedResourceProvider::class);
			} catch (NotFoundExceptionInterface | ContainerExceptionInterface $e) {
				$this->logger->notice($e->getMessage());
			}
		}

		if ($this->appManager->isInstalled('groupfolders')) {
			try {
				$providers[] = Server::get(GroupFoldersRelatedResourceProvider::class);
			} catch (NotFoundExceptionInterface | ContainerExceptionInterface $e) {
				$this->logger->notice($e->getMessage());
			}
		}

		return $providers;
	}

	/**
	 * @param string $relatedProviderId
	 *
	 * @return IRelatedResourceProvider
	 * @throws RelatedResourceProviderNotFound
	 */
	public function getRelatedResourceProvider(string $relatedProviderId): IRelatedResourceProvider {
		foreach ($this->getRelatedResourceProviders() as $provider) {
			if ($provider->getProviderId() === $relatedProviderId) {
				return $provider;
			}
		}

		throw new RelatedResourceProviderNotFound();
	}

	/**
	 * @param array $arr1
	 * @param array $arr2
	 *
	 * @return bool
	 */
	private function isStrict(array $arr1, array $arr2): bool {
		return empty(array_merge(array_diff($arr1, $arr2), array_diff($arr2, $arr1)));
	}

	/**
	 * when a share is created/deleted, flush all
	 */
	public function flushCache(): void {
		$this->logger->debug('flush cache');
		$this->cache->clear();
	}
}
