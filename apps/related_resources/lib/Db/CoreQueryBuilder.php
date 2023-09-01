<?php

declare(strict_types=1);


/**
 * Nextcloud - Related Resources
 *
 * This file is licensed under the Affero General Public License version 3 or
 * later. See the COPYING file.
 *
 * @author Maxence Lange <maxence@artificial-owl.com>
 * @copyright 2022
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


namespace OCA\RelatedResources\Db;

use OCA\RelatedResources\Service\ConfigService;

/**
 *
 */
class CoreQueryBuilder {
	public const TABLE_FILES_SHARE = 'share';

	public const TABLE_DECK_SHARE = 'deck_board_acl';
	public const TABLE_DECK_BOARD = 'deck_boards';

	public const TABLE_TALK_ATTENDEE = 'talk_attendees';
	public const TABLE_TALK_ROOM = 'talk_rooms';

	public const TABLE_DAV_SHARE = 'dav_shares';
	public const TABLE_CALENDARS = 'calendars';
	public const TABLE_CAL_OBJECTS = 'calendarobjects';
	public const TABLE_CAL_OBJ_PROPS = 'calendarobjects_props';

	protected ConfigService $configService;

	public static array $externalTables = [
		self::TABLE_FILES_SHARE => [
			'share_type',
			'share_with',
			'uid_owner',
			'uid_initiator',
			'file_source',
			'file_target',
			'stime'
		],
		self::TABLE_DECK_SHARE => [
			'board_id',
			'type',
			'participant'
		],
		self::TABLE_DECK_BOARD => [
			'id',
			'title',
			'owner',
			'last_modified'
		],
		self::TABLE_TALK_ATTENDEE => [
			'room_id',
			'actor_type',
			'actor_id'
		],
		self::TABLE_TALK_ROOM => [
			'name',
			'type',
			'token'
		],
		self::TABLE_DAV_SHARE => [
			'principaluri',
			'resourceid'
		],
		self::TABLE_CALENDARS => [
			'id',
			'principaluri',
			'uri',
			'displayname'
		],
		self::TABLE_CAL_OBJECTS => [
			'firstoccurence',
			'lastoccurence'
		],
		self::TABLE_CAL_OBJ_PROPS => [
			'value'
		]
	];


	/**
	 * @param ConfigService $configService
	 */
	public function __construct(ConfigService $configService) {
		$this->configService = $configService;
	}


	/**
	 * @return CoreRequestBuilder
	 */
	public function getQueryBuilder(): CoreRequestBuilder {
		return new CoreRequestBuilder();
	}
}
