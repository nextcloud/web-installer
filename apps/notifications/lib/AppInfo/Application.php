<?php

declare(strict_types=1);
/**
 * @copyright Copyright (c) 2023, Joas Schilling <coding@schilljs.com>
 * @copyright Copyright (c) 2016, ownCloud, Inc.
 *
 * @author Joas Schilling <coding@schilljs.com>
 *
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

namespace OCA\Notifications\AppInfo;

use OC\Authentication\Token\IProvider;
use OCA\Notifications\App;
use OCA\Notifications\Capabilities;
use OCA\Notifications\Listener\BeforeTemplateRenderedListener;
use OCA\Notifications\Listener\PostLoginListener;
use OCA\Notifications\Listener\UserCreatedListener;
use OCA\Notifications\Listener\UserDeletedListener;
use OCA\Notifications\Notifier\AdminNotifications;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use OCP\AppFramework\Http\Events\BeforeTemplateRenderedEvent;
use OCP\AppFramework\IAppContainer;
use OCP\Notification\IManager;
use OCP\User\Events\PostLoginEvent;
use OCP\User\Events\UserCreatedEvent;
use OCP\User\Events\UserDeletedEvent;

class Application extends \OCP\AppFramework\App implements IBootstrap {
	public const APP_ID = 'notifications';

	public function __construct() {
		parent::__construct(self::APP_ID);
	}

	public function register(IRegistrationContext $context): void {
		$context->registerCapability(Capabilities::class);

		$context->registerService(IProvider::class, function (IAppContainer $c) {
			return $c->getServer()->get(IProvider::class);
		});

		$context->registerNotifierService(AdminNotifications::class);

		$context->registerEventListener(UserDeletedEvent::class, UserDeletedListener::class);
		$context->registerEventListener(BeforeTemplateRenderedEvent::class, BeforeTemplateRenderedListener::class);
		$context->registerEventListener(UserCreatedEvent::class, UserCreatedListener::class);
		$context->registerEventListener(PostLoginEvent::class, PostLoginListener::class);
	}

	public function boot(IBootContext $context): void {
		$context->injectFn(\Closure::fromCallable([$this, 'registerAppAndNotifier']));
	}

	public function registerAppAndNotifier(IManager $notificationManager): void {
		// notification app
		$notificationManager->registerApp(App::class);
	}
}
