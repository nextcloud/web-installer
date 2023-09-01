<?php
/**
 * @copyright Copyright (c) 2016 Arthur Schiwon <blizzz@arthur-schiwon.de>
 *
 * @author Arthur Schiwon <blizzz@arthur-schiwon.de>
 * @author Bjoern Schiessle <bjoern@schiessle.org>
 * @author Christoph Wurst <christoph@winzerhof-wurst.at>
 * @author Joas Schilling <coding@schilljs.com>
 * @author Lukas Reschke <lukas@statuscode.ch>
 * @author Morris Jobke <hey@morrisjobke.de>
 * @author Robin Appelman <robin@icewind.nl>
 * @author Roeland Jago Douma <roeland@famdouma.nl>
 * @author Sascha Wiswedel <sascha.wiswedel@nextcloud.com>
 * @author Vincent Petry <vincent@nextcloud.com>
 * @author Thomas Citharel <nextcloud@tcit.fr>
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
namespace OCA\Settings\Settings\Admin;

use OCP\App\IAppManager;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\Constants;
use OCP\IConfig;
use OCP\IL10N;
use OCP\Settings\IDelegatedSettings;
use OCP\Share\IManager;
use OCP\Util;

class Sharing implements IDelegatedSettings {
	/** @var IConfig */
	private $config;

	/** @var IL10N */
	private $l;

	/** @var IManager */
	private $shareManager;

	/** @var IAppManager */
	private $appManager;

	public function __construct(IConfig $config, IL10N $l, IManager $shareManager, IAppManager $appManager) {
		$this->config = $config;
		$this->l = $l;
		$this->shareManager = $shareManager;
		$this->appManager = $appManager;
	}

	/**
	 * @return TemplateResponse
	 */
	public function getForm() {
		$excludedGroups = $this->config->getAppValue('core', 'shareapi_exclude_groups_list', '');
		$excludeGroupsList = !is_null(json_decode($excludedGroups))
			? implode('|', json_decode($excludedGroups, true)) : '';
		$linksExcludedGroups = $this->config->getAppValue('core', 'shareapi_allow_links_exclude_groups', '');
		$linksExcludeGroupsList = !is_null(json_decode($linksExcludedGroups))
			? implode('|', json_decode($linksExcludedGroups, true)) : '';

		$excludedPasswordGroups = $this->config->getAppValue('core', 'shareapi_enforce_links_password_excluded_groups', '');
		$excludedPasswordGroupsList = !is_null(json_decode($excludedPasswordGroups))
			? implode('|', json_decode($excludedPasswordGroups, true)) : '';


		$parameters = [
			// Built-In Sharing
			'sharingAppEnabled' => $this->appManager->isEnabledForUser('files_sharing'),
			'allowGroupSharing' => $this->config->getAppValue('core', 'shareapi_allow_group_sharing', 'yes'),
			'allowLinks' => $this->config->getAppValue('core', 'shareapi_allow_links', 'yes'),
			'allowLinksExcludeGroups' => $linksExcludeGroupsList,
			'allowPublicUpload' => $this->config->getAppValue('core', 'shareapi_allow_public_upload', 'yes'),
			'allowResharing' => $this->config->getAppValue('core', 'shareapi_allow_resharing', 'yes'),
			'allowShareDialogUserEnumeration' => $this->config->getAppValue('core', 'shareapi_allow_share_dialog_user_enumeration', 'yes'),
			'restrictUserEnumerationToGroup' => $this->config->getAppValue('core', 'shareapi_restrict_user_enumeration_to_group', 'no'),
			'restrictUserEnumerationToPhone' => $this->config->getAppValue('core', 'shareapi_restrict_user_enumeration_to_phone', 'no'),
			'restrictUserEnumerationFullMatch' => $this->config->getAppValue('core', 'shareapi_restrict_user_enumeration_full_match', 'yes'),
			'restrictUserEnumerationFullMatchUserId' => $this->config->getAppValue('core', 'shareapi_restrict_user_enumeration_full_match_userid', 'yes'),
			'restrictUserEnumerationFullMatchEmail' => $this->config->getAppValue('core', 'shareapi_restrict_user_enumeration_full_match_email', 'yes'),
			'restrictUserEnumerationFullMatchIgnoreSecondDN' => $this->config->getAppValue('core', 'shareapi_restrict_user_enumeration_full_match_ignore_second_dn', 'no'),
			'enforceLinkPassword' => Util::isPublicLinkPasswordRequired(false),
			'passwordExcludedGroups' => $excludedPasswordGroupsList,
			'passwordExcludedGroupsFeatureEnabled' => $this->config->getSystemValueBool('sharing.allow_disabled_password_enforcement_groups', false),
			'onlyShareWithGroupMembers' => $this->shareManager->shareWithGroupMembersOnly(),
			'shareAPIEnabled' => $this->config->getAppValue('core', 'shareapi_enabled', 'yes'),
			'shareDefaultExpireDateSet' => $this->config->getAppValue('core', 'shareapi_default_expire_date', 'no'),
			'shareExpireAfterNDays' => $this->config->getAppValue('core', 'shareapi_expire_after_n_days', '7'),
			'shareEnforceExpireDate' => $this->config->getAppValue('core', 'shareapi_enforce_expire_date', 'no'),
			'shareExcludeGroups' => $this->config->getAppValue('core', 'shareapi_exclude_groups', 'no') === 'yes',
			'shareExcludedGroupsList' => $excludeGroupsList,
			'publicShareDisclaimerText' => $this->config->getAppValue('core', 'shareapi_public_link_disclaimertext', null),
			'enableLinkPasswordByDefault' => $this->config->getAppValue('core', 'shareapi_enable_link_password_by_default', 'no'),
			'shareApiDefaultPermissions' => (int)$this->config->getAppValue('core', 'shareapi_default_permissions', (string)Constants::PERMISSION_ALL),
			'shareApiDefaultPermissionsCheckboxes' => $this->getSharePermissionList(),
			'shareDefaultInternalExpireDateSet' => $this->config->getAppValue('core', 'shareapi_default_internal_expire_date', 'no'),
			'shareInternalExpireAfterNDays' => $this->config->getAppValue('core', 'shareapi_internal_expire_after_n_days', '7'),
			'shareInternalEnforceExpireDate' => $this->config->getAppValue('core', 'shareapi_enforce_internal_expire_date', 'no'),
			'shareDefaultRemoteExpireDateSet' => $this->config->getAppValue('core', 'shareapi_default_remote_expire_date', 'no'),
			'shareRemoteExpireAfterNDays' => $this->config->getAppValue('core', 'shareapi_remote_expire_after_n_days', '7'),
			'shareRemoteEnforceExpireDate' => $this->config->getAppValue('core', 'shareapi_enforce_remote_expire_date', 'no'),
		];

		return new TemplateResponse('settings', 'settings/admin/sharing', $parameters, '');
	}

	/**
	 * get share permission list for template
	 *
	 * @return array
	 */
	private function getSharePermissionList() {
		return [
			[
				'id' => 'cancreate',
				'label' => $this->l->t('Create'),
				'value' => Constants::PERMISSION_CREATE
			],
			[
				'id' => 'canupdate',
				'label' => $this->l->t('Change'),
				'value' => Constants::PERMISSION_UPDATE
			],
			[
				'id' => 'candelete',
				'label' => $this->l->t('Delete'),
				'value' => Constants::PERMISSION_DELETE
			],
			[
				'id' => 'canshare',
				'label' => $this->l->t('Reshare'),
				'value' => Constants::PERMISSION_SHARE
			],
		];
	}

	/**
	 * @return string the section ID, e.g. 'sharing'
	 */
	public function getSection() {
		return 'sharing';
	}

	/**
	 * @return int whether the form should be rather on the top or bottom of
	 * the admin section. The forms are arranged in ascending order of the
	 * priority values. It is required to return a value between 0 and 100.
	 *
	 * E.g.: 70
	 */
	public function getPriority() {
		return 0;
	}

	public function getAuthorizedAppConfig(): array {
		return [
			'core' => ['/shareapi_.*/'],
		];
	}

	public function getName(): ?string {
		return null;
	}
}
