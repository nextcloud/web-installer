/**
 * @copyright Copyright (c) 2018 Morris Jobke <hey@morrisjobke.de>
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

(function($, OC) {

	$(document).ready(function() {

		$('.subscription-toggle-subscription-key').on('click', function(e) {
			$('#subscription-key-section').removeClass('hidden');
		});

		$('#generate-report-button').on('click', function(e) {
			e.target.disabled = true;
			var $reportStatus = $('#report-status');

			$reportStatus.html('');
			$reportStatus.addClass('icon-loading');
			$.post(OC.generateUrl('apps/support/generateSystemReport'))
				.always(function() {
					e.target.disabled = false;
					$reportStatus.removeClass('icon-loading');
				})
				.done(function(data) {
					var link = data.link;
					var password = data.password;
					var $link = $('<a>')
						.attr('href', link)
						.attr('target', '_blank')
						.html(link);

					$reportStatus.append(t('support', 'Link:') + ' ');
					$reportStatus.append($link);
					$reportStatus.append('<br />' + t('support', 'Password:') + ' ' + '<code>' + password + '</code>');
				})
				.fail(function(xhr) {
					var message = xhr.responseJSON.message;
					$reportStatus.html(t('support', 'Generating system report failed.') + ' ' + message);
				})
		});
	});
})(jQuery, OC);
