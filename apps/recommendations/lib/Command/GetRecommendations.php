<?php

declare(strict_types=1);

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

namespace OCA\Recommendations\Command;

use OCA\Recommendations\Service\RecommendationService;
use OCP\IUserManager;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

class GetRecommendations extends Command {
	private IUserManager $userManager;
	private RecommendationService $recommendationService;

	public function __construct(IUserManager $userManager,
								RecommendationService $recommendationService) {
		parent::__construct();

		$this->userManager = $userManager;
		$this->recommendationService = $recommendationService;
	}

	protected function configure() {
		$this->setName('files:recommendations:recommend');
		$this->addArgument(
			'uid',
			InputArgument::REQUIRED,
			'user id'
		);
		$this->addArgument(
			'max',
			InputArgument::OPTIONAL,
			'maximum results'
		);
	}

	public function execute(InputInterface $input, OutputInterface $output) {
		$user = $this->userManager->get(
			$input->getArgument('uid')
		);

		if (is_null($user)) {
			$output->writeln("user does not exist");
			return 1;
		}

		if ($input->getArgument('max')) {
			$recommendations = $this->recommendationService->getRecommendations($user, (int) $input->getArgument('max'));
		} else {
			$recommendations = $this->recommendationService->getRecommendations($user);
		}
		foreach ($recommendations as $recommendation) {
			$reason = $recommendation->getReason();
			$path = $recommendation->getNode()->getPath();
			$ts = $recommendation->getTimestamp();
			$output->writeln("$reason: $path ($ts)");
		}

		return 0;
	}
}
