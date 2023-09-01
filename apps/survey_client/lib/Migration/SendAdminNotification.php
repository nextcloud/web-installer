<?php

declare(strict_types=1);

/**
 * @copyright Copyright (c) 2020 Morris Jobke <hey@morrisjobke.de>
 *
 * @author Morris Jobke <hey@morrisjobke.de>
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
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */

namespace OCA\Survey_Client\Migration;

use OCP\BackgroundJob\IJobList;
use OCP\Migration\IOutput;
use OCP\Migration\IRepairStep;
use OCA\Survey_Client\BackgroundJobs\MonthlyReport;
use OCA\Survey_Client\BackgroundJobs\AdminNotification;

class SendAdminNotification implements IRepairStep {
	/** @var IJobList */
	private $jobList;

	public function __construct(IJobList $jobList) {
		$this->jobList = $jobList;
	}

	public function getName(): string {
		return 'Send an admin notification if monthly report is disabled';
	}

	public function run(IOutput $output): void {
		if (!$this->jobList->has(MonthlyReport::class, null)) {
			$this->jobList->add(AdminNotification::class);
		}
	}
}
