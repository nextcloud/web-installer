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


namespace OCA\RelatedResources\Command;

use Exception;
use OC\Core\Command\Base;
use OCA\Circles\CirclesManager;
use OCA\RelatedResources\Exceptions\RelatedResourceProviderNotFound;
use OCA\RelatedResources\Service\RelatedService;
use OCA\RelatedResources\Tools\Traits\TStringTools;
use OCP\AutoloadNotAllowedException;
use OCP\ICache;
use OCP\ICacheFactory;
use OCP\IConfig;
use OCP\IUserManager;
use OCP\Server;
use Psr\Container\ContainerExceptionInterface;
use Symfony\Component\Console\Exception\InvalidArgumentException;
use Symfony\Component\Console\Helper\Table;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\ConsoleOutput;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Class Create
 *
 * @package OCA\RelatedResources\Command
 */
class Test extends Base {
	use TStringTools;

	private IUserManager $userManager;
	private IConfig $config;
	private ICache $cache;
	private OutputInterface $output;
	private RelatedService $relatedService;

	public function __construct(
		IUserManager $userManager,
		IConfig $config,
		RelatedService $relatedService,
		ICacheFactory $cacheFactory
	) {
		$this->config = $config;
		parent::__construct();

		$this->userManager = $userManager;
		$this->cache = $cacheFactory->createDistributed(RelatedService::CACHE_RELATED);

		$this->relatedService = $relatedService;
	}


	/**
	 * @return void
	 */
	protected function configure() {
		parent::configure();
		$this->setName('related:test')
			 ->setHidden(!$this->config->getSystemValueBool('debug'))
			 ->setDescription('returns related resource to a share')
			 ->addArgument('userId', InputArgument::REQUIRED, 'user\'s point of view')
			 ->addArgument('providerId', InputArgument::REQUIRED, 'Provider Id (ie. files)')
			 ->addOption('clear-cache', '', InputOption::VALUE_NONE, 'clear cache')
			 ->addArgument('itemId', InputArgument::REQUIRED, 'Item Id');
	}


	/**
	 * @param InputInterface $input
	 * @param OutputInterface $output
	 *
	 * @return int
	 * @throws RelatedResourceProviderNotFound
	 */
	protected function execute(InputInterface $input, OutputInterface $output): int {
		$userId = $input->getArgument('userId');
		$providerId = $input->getArgument('providerId');
		$itemId = $input->getArgument('itemId');

		if ($input->getOption('clear-cache')) {
			$this->cache->clear();
		}

		$user = $this->userManager->get($userId);
		if (is_null($user)) {
			throw new InvalidArgumentException('must specify a valid local user');
		}

		$userId = $user->getUID();

		try {
			/** @var CirclesManager $circleManager */
			$circleManager = Server::get(CirclesManager::class);
		} catch (ContainerExceptionInterface | AutoloadNotAllowedException $e) {
			throw new Exception('Circles needs to be enabled');
		}

		$circleManager->startSession($circleManager->getLocalFederatedUser($userId));

		$this->displayRecipients($providerId, $itemId);
		$this->displayRelated($providerId, $itemId, ($input->getOption('output') === 'json'));

		return 0;
	}


	private function displayRecipients(string $providerId, string $itemId): void {
		$result = $this->relatedService->getRelatedFromItem($providerId, $itemId);

		$output = new ConsoleOutput();
		$output->writeln('<info>Title</info>: ' . $result->getTitle());
		$output->writeln('<info>Group Shared</info>: ' . ($result->isGroupShared() ? 'true' : 'false'));
		$output->writeln('<info>Virtual Group</info>: ' . json_encode($result->getVirtualGroup()));
		$output->writeln('<info>Recipients</info>: ' . json_encode($result->getRecipients()));
		$output->writeln('');
	}


	private function displayRelated(string $providerId, string $itemId, bool $json): void {
		$result = $this->relatedService->getRelatedToItem($providerId, $itemId);

		$output = new ConsoleOutput();
		if ($json) {
			$output->writeln(json_encode($result, JSON_PRETTY_PRINT));

			return;
		}

		$output = $output->section();
		$table = new Table($output);
		$table->setHeaders(
			[
				'Provider Id',
				'Item Id',
				'Title',
				'Description',
				'Score',
				'Link'
			]
		);

		$table->render();
		foreach ($result as $entry) {
			$table->appendRow(
				[
					$entry->getProviderId(),
					$entry->getItemId(),
					$entry->getTitle(),
					$entry->getSubtitle(),
					$entry->getScore(),
					$entry->getUrl()
				]
			);
		}

		$output->writeln('');
	}
}
