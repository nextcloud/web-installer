<?php
/**
 * @copyright Copyright (c) 2016 Bjoern Schiessle <bjoern@schiessle.org>
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
 *
 */


namespace OCA\Survey_Client\Settings;

use OCA\Survey_Client\Collector;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\BackgroundJob\IJobList;
use OCP\IConfig;
use OCP\IDateTimeFormatter;
use OCP\IL10N;
use OCP\Settings\ISettings;

class AdminSettings implements ISettings {

	/** @var Collector */
	private $collector;

	/** @var IConfig */
	private $config;

	/** @var IL10N */
	private $l;

	/** @var IDateTimeFormatter */
	private $dateTimeFormatter;

	/** @var IJobList */
	private $jobList;

	public function __construct(Collector $collector,
								IConfig $config,
								IL10N $l,
								IDateTimeFormatter $dateTimeFormatter,
								IJobList $jobList
	) {
		$this->collector = $collector;
		$this->config = $config;
		$this->l = $l;
		$this->dateTimeFormatter = $dateTimeFormatter;
		$this->jobList = $jobList;
	}

	/**
	 * @return TemplateResponse
	 */
	public function getForm() {
		$lastSentReportTime = (int) $this->config->getAppValue('survey_client', 'last_sent', '0');
		if ($lastSentReportTime === 0) {
			$lastSentReportDate = $this->l->t('Never');
		} else {
			$lastSentReportDate = $this->dateTimeFormatter->formatDate($lastSentReportTime);
		}

		$lastReport = $this->config->getAppValue('survey_client', 'last_report', '');
		if ($lastReport !== '') {
			$lastReport = json_encode(json_decode($lastReport, true), JSON_PRETTY_PRINT);
		}

		$parameters = [
			'is_enabled' => $this->jobList->has('OCA\Survey_Client\BackgroundJobs\MonthlyReport', null),
			'last_sent' => $lastSentReportDate,
			'last_report' => $lastReport,
			'categories' => $this->collector->getCategories()
		];

		return new TemplateResponse('survey_client', 'admin', $parameters);
	}

	/**
	 * @return string the section ID, e.g. 'sharing'
	 */
	public function getSection() {
		return 'survey_client';
	}

	/**
	 * @return int whether the form should be rather on the top or bottom of
	 * the admin section. The forms are arranged in ascending order of the
	 * priority values. It is required to return a value between 0 and 100.
	 */
	public function getPriority() {
		return 50;
	}
}
