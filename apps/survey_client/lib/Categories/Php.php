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

namespace OCA\Survey_Client\Categories;

use bantu\IniGetWrapper\IniGetWrapper;
use OCP\IL10N;

/**
 * Class php
 *
 * @package OCA\Survey_Client\Categories
 */
class Php implements ICategory {
	/** @var IniGetWrapper */
	protected $phpIni;

	/** @var \OCP\IL10N */
	protected $l;

	/**
	 * @param IniGetWrapper $phpIni
	 * @param IL10N $l
	 */
	public function __construct(IniGetWrapper $phpIni, IL10N $l) {
		$this->phpIni = $phpIni;
		$this->l = $l;
	}

	/**
	 * @return string
	 */
	public function getCategory() {
		return 'php';
	}

	/**
	 * @return string
	 */
	public function getDisplayName() {
		return $this->l->t('PHP environment <em>(version, memory limit, max. execution time, max. file size)</em>');
	}

	/**
	 * @return array (string => string|int)
	 */
	public function getData() {
		return [
			'version' => $this->cleanVersion(PHP_VERSION),
			'memory_limit' => $this->phpIni->getBytes('memory_limit'),
			'max_execution_time' => $this->phpIni->getNumeric('max_execution_time'),
			'upload_max_filesize' => $this->phpIni->getBytes('upload_max_filesize'),
		];
	}

	/**
	 * Try to strip away additional information
	 *
	 * @param string $version E.g. `5.5.30-1+deb.sury.org~trusty+1`
	 * @return string `5.5.30`
	 */
	protected function cleanVersion($version) {
		$matches = [];
		preg_match('/^(\d+)(\.\d+)(\.\d+)/', $version, $matches);
		if (isset($matches[0])) {
			return $matches[0];
		}

		return $version;
	}
}
