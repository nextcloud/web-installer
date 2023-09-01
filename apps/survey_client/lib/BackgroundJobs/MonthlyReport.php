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

namespace OCA\Survey_Client\BackgroundJobs;

use OCA\Survey_Client\Collector;
use OCP\AppFramework\Http;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\BackgroundJob\IJob;
use OCP\BackgroundJob\TimedJob;
use Psr\Log\LoggerInterface;

class MonthlyReport extends TimedJob {
	protected Collector $collector;
	protected LoggerInterface $logger;

	public function __construct(ITimeFactory $time,
								Collector $collector,
								LoggerInterface $logger) {
		parent::__construct($time);
		$this->collector = $collector;
		$this->logger = $logger;
		// Run all 28 days
		$this->setInterval(28 * 24 * 60 * 60);
		// keeping time sensitive to not overload the target server at a single specific time of the day
		$this->setTimeSensitivity(IJob::TIME_SENSITIVE);
	}

	protected function run($argument) {
		$result = $this->collector->sendReport();

		if ($result->getStatus() !== Http::STATUS_OK) {
			$this->logger->info('Error while sending usage statistic');
		}
	}
}
