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

use OCP\IConfig;
use OCP\IL10N;

/**
 * Class Encryption
 *
 * @package OCA\Survey_Client\Categories
 */
class Encryption implements ICategory {
	/** @var \OCP\IConfig */
	protected $config;

	/** @var \OCP\IL10N */
	protected $l;

	/**
	 * @param IConfig $config
	 * @param IL10N $l
	 */
	public function __construct(IConfig $config, IL10N $l) {
		$this->config = $config;
		$this->l = $l;
	}

	/**
	 * @return string
	 */
	public function getCategory() {
		return 'encryption';
	}

	/**
	 * @return string
	 */
	public function getDisplayName() {
		return $this->l->t('Encryption information <em>(is it enabled?, what is the default module)</em>');
	}

	/**
	 * @return array (string => string|int)
	 */
	public function getData() {
		$data = [
			'enabled' => $this->config->getAppValue('core', 'encryption_enabled', 'no') === 'yes' ? 'yes' : 'no',
			'default_module' => $this->config->getAppValue('core', 'default_encryption_module') === 'OC_DEFAULT_MODULE'  ? 'yes' : 'no',
		];

		if ($data['enabled'] === 'yes') {
			unset($data['default_module']);
		}

		return $data;
	}
}
