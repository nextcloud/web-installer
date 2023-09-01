<?php

declare(strict_types=1);
/**
 * @copyright Copyright (c) 2019, Joas Schilling <coding@schilljs.com>
 *
 * @author Joas Schilling <coding@schilljs.com>
 *
 * @license AGPL-3.0-or-later
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

namespace OCA\Notifications\Migration;

use Closure;
use OCP\DB\ISchemaWrapper;
use OCP\DB\Types;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

class Version2004Date20190107135757 extends SimpleMigrationStep {
	/**
	 * @param IOutput $output
	 * @param Closure $schemaClosure The `\Closure` returns a `ISchemaWrapper`
	 * @param array $options
	 * @return null|ISchemaWrapper
	 */
	public function changeSchema(IOutput $output, Closure $schemaClosure, array $options) {
		/** @var ISchemaWrapper $schema */
		$schema = $schemaClosure();

		if (!$schema->hasTable('notifications')) {
			$table = $schema->createTable('notifications');
			$table->addColumn('notification_id', Types::INTEGER, [
				'autoincrement' => true,
				'notnull' => true,
				'length' => 4,
			]);
			$table->addColumn('app', Types::STRING, [
				'notnull' => true,
				'length' => 32,
			]);
			$table->addColumn('user', Types::STRING, [
				'notnull' => true,
				'length' => 64,
			]);
			$table->addColumn('timestamp', Types::INTEGER, [
				'notnull' => true,
				'length' => 4,
				'default' => 0,
			]);
			$table->addColumn('object_type', Types::STRING, [
				'notnull' => true,
				'length' => 64,
			]);
			$table->addColumn('object_id', Types::STRING, [
				'notnull' => true,
				'length' => 64,
			]);
			$table->addColumn('subject', Types::STRING, [
				'notnull' => true,
				'length' => 64,
			]);
			$table->addColumn('subject_parameters', Types::TEXT, [
				'notnull' => false,
			]);
			$table->addColumn('message', Types::STRING, [
				'notnull' => false,
				'length' => 64,
			]);
			$table->addColumn('message_parameters', Types::TEXT, [
				'notnull' => false,
			]);
			$table->addColumn('link', Types::STRING, [
				'notnull' => false,
				'length' => 4000,
			]);
			$table->addColumn('icon', Types::STRING, [
				'notnull' => false,
				'length' => 4000,
			]);
			$table->addColumn('actions', Types::TEXT, [
				'notnull' => false,
			]);
			$table->setPrimaryKey(['notification_id']);
			$table->addIndex(['app'], 'oc_notifications_app');
			$table->addIndex(['user'], 'oc_notifications_user');
			$table->addIndex(['timestamp'], 'oc_notifications_timestamp');
			$table->addIndex(['object_type', 'object_id'], 'oc_notifications_object');
		}

		// $schema->createTable('notifications_pushtokens') was
		// replaced with notifications_pushhash in Version2010Date20210218082811
		// and deleted in Version2010Date20210218082855
		return $schema;
	}
}
