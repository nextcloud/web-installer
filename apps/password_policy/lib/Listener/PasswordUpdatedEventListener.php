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

namespace OCA\Password_Policy\Listener;

use OCA\Password_Policy\ComplianceService;
use OCP\EventDispatcher\Event;
use OCP\EventDispatcher\IEventListener;
use OCP\User\Events\PasswordUpdatedEvent;

class PasswordUpdatedEventListener implements IEventListener {
	/** @var ComplianceService */
	private $complianceUpdater;

	public function __construct(ComplianceService $complianceUpdater) {
		$this->complianceUpdater = $complianceUpdater;
	}

	public function handle(Event $event): void {
		if (!($event instanceof PasswordUpdatedEvent)) {
			return;
		}
		$this->complianceUpdater->update($event->getUser(), $event->getPassword());
	}
}
