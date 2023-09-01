<?php

declare(strict_types=1);
/**
 * @copyright Copyright (c) 2022 Robin Appelman <robin@icewind.nl>
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

namespace OCA\Photos\Migration;

use Closure;
use OCP\DB\Types;
use OCP\DB\ISchemaWrapper;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Auto-generated migration step: Please modify to your needs!
 */
class Version20000Date20220727125801 extends SimpleMigrationStep {
	public function changeSchema(IOutput $output, Closure $schemaClosure, array $options): ?ISchemaWrapper {
		/** @var ISchemaWrapper $schema */
		$schema = $schemaClosure();

		if (!$schema->hasTable("photos_albums")) {
			$table = $schema->createTable("photos_albums");
			$table->addColumn('album_id', Types::BIGINT, [
				'autoincrement' => true,
				'notnull' => true,
				'length' => 20,
			]);
			$table->addColumn('name', 'string', [
				'notnull' => true,
				'length' => 255,
			]);
			$table->addColumn('user', 'string', [
				'notnull' => true,
				'length' => 255,
			]);
			$table->addColumn('created', 'bigint', [
				'notnull' => true,
			]);
			$table->addColumn('location', 'string', [
				'notnull' => true,
				'length' => 255,
			]);
			$table->addColumn('last_added_photo', 'bigint', [
				'notnull' => true,
			]);
			$table->setPrimaryKey(['album_id']);
			$table->addIndex(['user'], 'pa_user');
		}

		if (!$schema->hasTable('photos_albums_files')) {
			$table = $schema->createTable('photos_albums_files');
			$table->addColumn('album_file_id', Types::BIGINT, [
				'autoincrement' => true,
				'notnull' => true,
				'length' => 20,
			]);
			$table->addColumn('album_id', Types::BIGINT, [
				'notnull' => true,
				'length' => 20,
			]);
			$table->addColumn('file_id', Types::BIGINT, [
				'notnull' => true,
				'length' => 20,
			]);
			$table->addColumn('added', 'bigint', [
				'notnull' => true,
			]);
			$table->setPrimaryKey(['album_file_id']);
			$table->addIndex(['album_id'], 'paf_folder');
			$table->addUniqueIndex(['album_id', 'file_id'], 'paf_album_file');
		}

		return $schema;
	}
}
