<?php

declare(strict_types=1);
/**
 * @copyright Copyright (c) 2018, Morris Jobke <hey@morrisjobke.de>
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
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

namespace OCA\Support\AppInfo;

use OCA\Support\Notification\Notifier;
use OCA\Support\Settings\Admin;
use OCA\Support\Settings\Section;
use OCA\Support\Subscription\SubscriptionAdapter;
use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use OCP\IConfig;
use OCP\Notification\IManager;
use OCP\Settings\IManager as ISettingsManager;
use OCP\Support\Subscription\Exception\AlreadyRegisteredException;
use OCP\Support\Subscription\IRegistry;
use Psr\Log\LoggerInterface;

class Application extends App implements IBootstrap {
	public const APP_ID = 'support';

	public function __construct() {
		parent::__construct(self::APP_ID);
	}

	public function register(IRegistrationContext $context): void {
	}

	public function boot(IBootContext $context): void {
		$container = $context->getAppContainer();

		/* @var $registry IRegistry */
		$registry = $container->get(IRegistry::class);
		try {
			$registry->registerService(SubscriptionAdapter::class);
			if ($container->get(IConfig::class)->getAppValue('support', 'hide-app', 'no') !== 'yes') {
				$settingsManager = $container->get(ISettingsManager::class);
				$settingsManager->registerSetting('admin', Admin::class);
				$settingsManager->registerSection('admin', Section::class);
			}
		} catch (AlreadyRegisteredException $e) {
			$logger = $container->get(LoggerInterface::class);
			$logger->critical('Multiple subscription adapters are registered.', [
				'exception' => $e,
			]);
		}

		$context->injectFn(\Closure::fromCallable([$this, 'registerNotifier']));
	}

	public function registerNotifier(IManager $notificationsManager) {
		$notificationsManager->registerNotifierService(Notifier::class);
	}
}
