<?php

declare(strict_types=1);

/**
 * @copyright Copyright (c) 2020, Morris Jobke <hey@morrisjobke.de>
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

namespace OCA\Support\Repair;

use OCP\IConfig;
use OCP\Migration\IOutput;
use OCP\Migration\IRepairStep;
use OCP\Support\Subscription\IRegistry;

class SwitchUpdaterServer implements IRepairStep {
	private IConfig $config;
	private IRegistry $subscriptionRegistry;

	public function __construct(IConfig $config, IRegistry $subscriptionRegistry) {
		$this->config = $config;
		$this->subscriptionRegistry = $subscriptionRegistry;
	}

	public function getName(): string {
		return 'Switches from default updater server to the customer one if a valid subscription is available';
	}

	public function run(IOutput $output): void {
		if ($this->config->getAppValue('support', 'SwitchUpdaterServerHasRun') === 'yes') {
			$output->info('Repair step already executed');
			return;
		}

		$currentUpdaterServer = $this->config->getSystemValue('updater.server.url', 'https://updates.nextcloud.com/updater_server/');
		$subscriptionKey = $this->config->getAppValue('support', 'subscription_key', '');

		/**
		 * only overwrite the updater server if:
		 * 	- it is the default one
		 *  - there is a valid subscription
		 *  - there is a subscription key set
		 *  - the subscription key is halfway sane
		 */
		if ($currentUpdaterServer === 'https://updates.nextcloud.com/updater_server/' &&
			$this->subscriptionRegistry->delegateHasValidSubscription() &&
			$subscriptionKey !== '' &&
			preg_match('!^[a-zA-Z0-9-]{10,250}$!', $subscriptionKey)
		) {
			$this->config->setSystemValue('updater.server.url', 'https://updates.nextcloud.com/customers/' . $subscriptionKey . '/');
		}

		// if everything is done, no need to redo the repair during next upgrade
		$this->config->setAppValue('support', 'SwitchUpdaterServerHasRun', 'yes');
	}
}
