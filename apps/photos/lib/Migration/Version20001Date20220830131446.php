<?php

declare(strict_types=1);

/**
 * @copyright Copyright (c) 2022 Louis Chemineau <louis@chmn.me>
 *
 * @author Louis Chemineau <louis@chmn.me>
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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
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
class Version20001Date20220830131446 extends SimpleMigrationStep {
	/**
	 * @param IOutput $output
	 * @param Closure $schemaClosure The `\Closure` returns a `ISchemaWrapper`
	 * @param array $options
	 * @return null|ISchemaWrapper
	 */
	public function changeSchema(IOutput $output, Closure $schemaClosure, array $options): ?ISchemaWrapper {
		/** @var ISchemaWrapper $schema */
		$schema = $schemaClosure();
		$modified = false;

		/**
		 * Replaced by Version20003Date20221102170153
		 *
		 * if (!$schema->hasTable("photos_collaborators")) {
		 * 	$modified = true;
		 * 	$table = $schema->createTable("photos_collaborators");
		 * 	$table->addColumn('album_id', Types::BIGINT, [
		 * 		'notnull' => true,
		 * 		'length' => 20,
		 * 	]);
		 * 	$table->addColumn('collaborator_id', Types::STRING, [
		 * 		'notnull' => true,
		 * 		'length' => 64,
		 * 	]);
		 * 	$table->addColumn('collaborator_type', Types::INTEGER, [
		 * 		'notnull' => true,
		 * 	]);
		 *
		 * 	$table->addUniqueConstraint(['album_id', 'collaborator_id', 'collaborator_type'], 'collaborators_unique_idx');
		 * }
		 */

		if (!$schema->getTable("photos_albums_files")->hasColumn("owner")) {
			$modified = true;
			$table = $schema->getTable("photos_albums_files");
			$table->addColumn('owner', Types::STRING, [
				'notnull' => false,
				'length' => 64,
			]);
		}

		if ($modified) {
			return $schema;
		} else {
			return null;
		}
	}
}
