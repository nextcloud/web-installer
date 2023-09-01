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
 * Class Server
 *
 * @package OCA\Survey_Client\Categories
 */
class Server implements ICategory {
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
		return 'server';
	}

	/**
	 * @return string
	 */
	public function getDisplayName() {
		return $this->l->t('Server instance details <em>(version, memcache used, status of locking/previews/avatars)</em>');
	}

	/**
	 * @return array (string => string|int)
	 */
	public function getData() {
		return [
			'version' => $this->config->getSystemValue('version'),
			'code' => $this->codeLocation(),
			'enable_avatars' => $this->config->getSystemValue('enable_avatars', true) ? 'yes' : 'no',
			'enable_previews' => $this->config->getSystemValue('enable_previews', true) ? 'yes' : 'no',
			'memcache.local' => $this->config->getSystemValue('memcache.local', 'none'),
			'memcache.distributed' => $this->config->getSystemValue('memcache.distributed', 'none'),
			'asset-pipeline.enabled' => $this->config->getSystemValue('asset-pipeline.enabled') ? 'yes' : 'no',
			'filelocking.enabled' => $this->config->getSystemValue('filelocking.enabled', true) ? 'yes' : 'no',
			'memcache.locking' => $this->config->getSystemValue('memcache.locking', 'none'),
			'debug' => $this->config->getSystemValue('debug', false) ? 'yes' : 'no',
			'cron' => $this->config->getAppValue('core', 'backgroundjobs_mode', 'ajax'),
		];
	}

	protected function codeLocation() {
		if (file_exists(\OC::$SERVERROOT . '/.git') && is_dir(\OC::$SERVERROOT . '/.git')) {
			return 'git';
		}
		return 'other';
	}
}
