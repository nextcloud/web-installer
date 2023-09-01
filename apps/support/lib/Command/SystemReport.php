<?php

declare(strict_types=1);
/**
 * @copyright Copyright (c) 2022 Julius Härtl <jus@bitgrid.net>
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
namespace OCA\Support\Command;

use OCA\Support\DetailManager;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

class SystemReport extends Command {
	private DetailManager $detailManager;

	public function __construct(DetailManager $detailManager) {
		parent::__construct();

		$this->detailManager = $detailManager;
	}

	protected function configure(): void {
		$this
			->setName('support:report')
			->setDescription('Generate a system report')
		;
	}

	protected function execute(InputInterface $input, OutputInterface $output): int {
		$output->writeln($this->detailManager->getRenderedDetails());
		return 0;
	}
}
