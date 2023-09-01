$(document).ready(function() {
	var $section = $('#survey_client');
	$section.find('.survey_client_category').change(function() {
		var $button = $(this);
		$button.attr('disabled', true);

		OCP.AppConfig.setValue(
			'survey_client',
			$(this).attr('name').substring(14),
			$(this).attr('checked') ? 'yes' : 'no',
			{
				success: function() {
					$button.attr('disabled', false);
				}
			}
		);
	});

	$section.find('#survey_client_monthly_report').change(function() {
		var $button = $(this);
		$button.attr('disabled', true);

		$.ajax({
			url: OC.linkToOCS('apps/survey_client/api/v1', 2) + 'monthly?format=json',
			type: $(this).attr('checked') ? 'POST' : 'DELETE',
			success: function() {
				$button.attr('disabled', false);
			}
		});
	});

	$section.find('button').click(function() {
		var $button = $(this);
		$button.attr('disabled', true);
		$.ajax({
			url: OC.linkToOCS('apps/survey_client/api/v1', 2) + 'report?format=json',
			type: 'POST',
			success: function(response) {
				$button.attr('disabled', false);

				$section.find('.last_report').text(JSON.stringify(response.ocs.data, undefined, 4));
				$section.find('.last_sent').text(t('survey_client', 'Last report sent on: {on}', {
					on: moment().format('LL')
				}));
				$section.find('.last_report').closest('div').removeClass('empty');
			},
			error: function(xhr) {
				$button.attr('disabled', false);
				OCP.Toast.error(t('survey_client', 'An error occurred while sending your report.'));

				var response = xhr.responseJSON;
				$section.find('.last_report').text(JSON.stringify(response.ocs.data, undefined, 4));
			}
		});
	});

	$('#last_report h3').on('click', function(e) {
		if (!$(this).parent().hasClass('empty')) {
			$(this).parent().find('p').toggleClass('hidden');
			$(this).find('.icon').toggleClass('icon-triangle-s');
		}
	});
});
