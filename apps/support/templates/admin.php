<?php
script('support', 'admin');
style('support', 'support');

/** @var array $_ */
?>

<?php
if ($_['showSubscriptionDetails']) {
	?>

	<div class="section">
		<h2><?php p($l->t('Support')); ?></h2>

		<div class="columns">
			<div>
				<img src="<?php p(\OCP\Template::image_path('support', 'signature.svg')); ?>">
				<h3>
					<?php
					if ($_['subscriptionType'] === 'basic') {
						p($l->t('Basic subscription'));
					} elseif ($_['subscriptionType'] === 'standard') {
						p($l->t('Standard subscription'));
					} elseif ($_['subscriptionType'] === 'premium') {
						p($l->t('Premium subscription'));
					} elseif ($_['subscriptionType'] === 'geant') {
						p($l->t('Géant subscription'));
					} elseif ($_['subscriptionType'] === 'partner_silver') {
						p($l->t('Silver partner subscription'));
					} elseif ($_['subscriptionType'] === 'partner_gold') {
						p($l->t('Gold partner subscription'));
					} else {
						p($l->t('Subscription'));
					} ?>
				</h3>
				<?php
				if ($_['validSubscription']) {
					if ($_['overLimit']) {
						?>
					<span class="badge overlimit icon-details">
						<?php p($l->t('Over subscription limit')); ?>
					</span>
					<?php
					} else {
						?>
					<span class="badge supported icon-checkmark">
						<?php p($l->t('Valid subscription')); ?>
					</span>
					<?php
					}
				} else {
					?>
					<span class="badge unsupported icon-close">
						<?php p($l->t('Expired subscription')); ?>
					</span>
					<?php
				} ?>
				<ul class="subscription-info">
					<li>
						<?php p($l->t('Subscription key:')); ?> <pre><?php p($_['subscriptionKey']); ?></pre>
					</li>
					<li>
						<?php
						if ($_['validSubscription']) {
							p($l->t('Expires in: '));
							$outputBefore = false;
							if ($_['expiryYears'] > 0) {
								p($l->n('%n year', '%n years', $_['expiryYears']));
								$outputBefore = true;
							}
							if ($_['expiryMonths'] > 0) {
								if ($outputBefore) {
									echo ', ';
								}
								p($l->n('%n month', '%n months', $_['expiryMonths']));
								$outputBefore = true;
							}
							/* only show weeks or days if less than a year from now */
							if ($_['expiryYears'] === 0) {
								if ($_['expiryWeeks'] > 1) {
									if ($outputBefore) {
										echo ', ';
									}
									p($l->n('%n week', '%n weeks', $_['expiryWeeks']));
									$outputBefore = true;
								} elseif ($_['expiryDays'] !== 0) {
									if ($outputBefore) {
										echo ', ';
									}
									p($l->n('%n day', '%n days', $_['expiryDays']));
								}
							}
						} ?>
					</li>
					<li>
						<?php
						if ($_['subscriptionUsers'] === -1) {
							p($l->t('For an unlimited amount of users'));
						} elseif ($_['onlyCountActiveUsers']) {
							p($l->n('For %n active users', 'For %n active users', $_['subscriptionUsers']));
						} else {
							p($l->n('For %n users', 'For %n users', $_['subscriptionUsers']));
						}

	if ($_['overLimit']) {
		?>
							–
							<span class="text-bold">
							<?php p($l->n('currently at %n user', 'currently at %n users', $_['onlyCountActiveUsers'] ? $_['activeUserCount'] : $_['userCount'])); ?>
							</span>
							<?php
	} ?>
					</li>
					<?php
					if ($_['specificSubscriptions'] !== []) {
						?>
						<li>
							<?php
							switch (count($_['specificSubscriptions'])) {
								case 1:
									$text = $l->t('Includes support for %s', $_['specificSubscriptions']);
									break;
								case 2:
									$text = $l->t('Includes support for %1$s & %2$s', $_['specificSubscriptions']);
									break;
								case 3:
									$text = $l->t('Includes support for %1$s, %2$s & %3$s', $_['specificSubscriptions']);
									break;
							}

						p($text); ?>
						</li>
					<?php
					} ?>
					<?php
					if ($_['extendedSupport']) {
						?>
						<li> <?php p($l->t('Extended maintenance life cycle')); ?></li>
						<?php
					} ?>
				</ul>
				<p>
					<a href="#subscription-key-section" class="subscription-toggle-subscription-key"><?php p($l->t('Update subscription key')); ?></a>
				</p>
			</div>
			<div>
				<img class="account-manager-avatar" src="<?php p($_['contactPerson']['picture']); ?>">
				<h3><?php p($_['contactPerson']['name']); ?></h3>
				<p>
					<?php p(
						$l->t('%s is your account manager. Don\'t hesitate to reach out to us if you have questions regarding your subscription.', [$_['contactPerson']['firstName']])
					); ?>
				</p>

				<ul class="account-manager-info">
					<li>
						<a href="mailto:<?php p($_['contactPerson']['email']); ?>">
							<?php p($_['contactPerson']['email']); ?>
						</a>
					</li>
					<li>
						<a href="tel:<?php p(str_replace(' ', '', $_['contactPerson']['phone'])); ?>">
							<?php p($_['contactPerson']['phone']); ?>
						</a>
					</li>
				</ul>
				<p>
					<?php p(
						$l->t('You can find answers to common question in our portal and also file support requests there.')
					); ?>
				</p>
				<p class="text-center">
					<a href="https://portal.nextcloud.com/"
					   target="blank" rel="no" class="button link-button"><?php p($l->t('Access Nextcloud portal')); ?></a>
				</p>
			</div>
			<div>
				<img src="<?php p(\OCP\Template::image_path('support', 'system-info.svg')); ?>">
				<h3><?php p($l->t('System information')); ?></h3>
				<p>
					<?php p(
						$l->t('Collect system information for support cases. The button below generates a text file in the folder "System information" and shares it as password protected public link. The link is valid for 2 weeks.')
					); ?>
				</p>
				<button id="generate-report-button" class="button generate-report-button"><?php p($l->t('Generate system report')); ?></button>
				<div id="report-status"></div>
			</div>
		</div>
	</div>
	<?php
}
?>


<?php
if ($_['showEnterpriseSupportSection']) {
	?>

	<div class="section">
		<?php
		if ($_['instanceSize'] === 'medium') {
			?>
			<h2><?php p($l->t('Enterprise subscription recommended')); ?></h2>
			<?php
		} else {
			?>
			<h2><?php p($l->t('No active enterprise subscription')); ?></h2>
			<?php
		} ?>

		<div class="columns">
			<div>
				<img src="<?php p(\OCP\Template::image_path('support', 'signature.svg')); ?>">
				<h3>
					<?php
						p($l->t('Subscription')); ?>
				</h3>
				<span class="badge unsupported icon-close">
					<?php
						p($l->t('Unsupported')); ?>
				</span>
				<p>
					<?php p(
						$l->t('This Nextcloud server has no Enterprise Subscription.')
					); ?>
				</p>
				<p>
					<?php
						p($l->t('A Nextcloud Enterprise Subscription helps you get the most out of your Nextcloud, keep your data secure and your server working reliably at all times.')); ?>
				</p>
			</div>
			<div>
				<img src="<?php p(\OCP\Template::image_path('support', 'system-info.svg')); ?>">
				<h3><?php p($l->t('Advantages')); ?></h3>
				<ul class="normal-list">
					<li><?php p($l->t('Access to the technical expertise of the Nextcloud developers through documentation and support')); ?></li>
					<li><?php p($l->t('Access to additional capabilities like Outlook integration, online office and more')); ?></li>
					<li><?php p($l->t('Access to scalability expertise and scalability capabilities for Files and Talk')); ?></li>
					<li><?php p($l->t('Optional branding, consulting, architecture advice')); ?></li>
					<li><?php p($l->t('Confidential security notification service, mitigations, patches and advice')); ?></li>
					<li><?php p($l->t('Compliance certification, advice and documentation')); ?></li>
				</ul>
				<p class="text-center">
					<a href="https://nextcloud.com/enterprise/buy"
					   target="blank" rel="no" class="button link-button"><?php p($l->t('Get a quote')); ?></a>
				</p>
			</div>
			<div>
				<img src="<?php p(\OCP\Template::image_path('support', 'chat.svg')); ?>">
				<h3><?php p($l->t('More information')); ?></h3>
				<ul class="normal-list">
					<li><a href="https://nextcloud.com/enterprise" target="blank" rel="no"><?php p($l->t('Subscription benefits')); ?></a></li>
					<li><a href="https://nextcloud.com/pricing" target="blank" rel="no"><?php p($l->t('Pricing')); ?></a></li>
				</ul>
			</div>
		</div>
	</div>
	<?php
}
?>


<?php
if ($_['showCommunitySupportSection']) {
	?>
	<div class="section community-support">
		<h2><?php p($l->t('Community support')); ?></h2>

		<div class="columns">
			<div>
				<img src="<?php p(\OCP\Template::image_path('support', 'discourse.svg')) ?>">
				<h3><?php p($l->t('Forum')); ?></h3>
				<p>
					<?php p(
						$l->t('Nextcloud is free software which is supported by a very active community. Please register at the forum to ask questions and discuss with others.')
					); ?>
				</p>
				<a href="https://help.nextcloud.com"
					target="blank" rel="no" class="button link-button"><?php p($l->t('Nextcloud forum')); ?></a>
			</div>
			<div>
				<img src="<?php p(\OCP\Template::image_path('support', 'github.svg')) ?>">
				<h3>
					<?php p($l->t('GitHub')); ?>
				</h3>
				<p>
					<?php p(
						$l->t('Nextcloud uses GitHub as platform to collaboratively work. You can file bug reports directly there.')
					); ?>
				</p>
				<a href="https://github.com/nextcloud/"
					target="blank" rel="no" class="button link-button"><?php p($l->t('Nextcloud at GitHub')); ?></a>
			</div>
		</div>
	</div>
	<?php
}
?>


<div id="subscription-key-section" class="section <?php if (!$_['showSubscriptionKeyInput']) {
	p('hidden');
}  ?>">
	<h2><?php p($l->t('Subscription key')); ?></h2>

	<p>
		<?php p(
			$l->t('If you have an active Nextcloud Subscription please enter your subscription key here.')
		); ?>
	</p>

	<p>
		<a href="https://nextcloud.com/enterprise"
		   target="blank" rel="no"><?php p($l->t('Learn more about an enterprise subscription.')); ?></a>
	</p>

	<form action="<?php p($_['subscriptionKeyUrl']); ?>" method="POST">
		<input type="hidden" name="requesttoken" value="<?php p($_['requesttoken']) ?>">
		<input type="text" name="subscriptionKey"
			   value="<?php p($_['potentialSubscriptionKey'] ?? ''); ?>"
			   placeholder="<?php p($l->t('Subscription key')); ?>">
		<input type="submit" class="button" value="<?php p($l->t('Set subscription key')); ?>">
	</form>

	<?php
	if ($_['lastError'] > 0) {
		?>
		<p style="color: #e9322d">
			<?php
			switch ($_['lastError']) {
				case \OCA\Support\Service\SubscriptionService::ERROR_FAILED_RETRY:
					p($l->t('The subscription info could not properly fetched right now. A retry is scheduled. Please check back later.'));
					break;
				case \OCA\Support\Service\SubscriptionService::ERROR_FAILED_INVALID:
					p($l->t('The subscription key was invalid.'));
					break;
				case \OCA\Support\Service\SubscriptionService::ERROR_NO_INTERNET_CONNECTION:
					p($l->t('The subscription key could not be verified, because this server has no internet connection. Please reach out to the support team to get this resolved.'));
					break;
				case \OCA\Support\Service\SubscriptionService::ERROR_INVALID_SUBSCRIPTION_KEY:
					p($l->t('The subscription key had an invalid format.'));
					break;
				default:
					p($l->t('While fetching the subscription information an error happened.'));
					break;
			} ?>
		</p>
		<?php
	}
?>
</div>


<?php
if (!$_['showSubscriptionDetails']) {
	?>
	<div class="section system-information">
		<div>
			<img src="<?php p(\OCP\Template::image_path('support', 'system-info.svg')); ?>">
			<h3><?php p($l->t('System information')); ?></h3>
			<p>
				<?php p(
					$l->t('The button below generates a text file in the folder "System information" and shares it as password protected public link. The link is valid for 2 weeks.')
				); ?>
			</p>
			<button id="generate-report-button" class="button generate-report-button"><?php p($l->t('Generate system report')); ?></button>
			<div id="report-status"></div>
		</div>
	</div>
	<?php
}
?>

<div class="section">
	<h2><?php p($l->t('News')); ?></h2>
	<p>
		<?php print_unescaped(
			$l->t('To get up to date information what is going on at Nextcloud sign up for the newsletter and follow us on our social media accounts.')
		); ?>
	</p>

	<p class="social-button">
		<?php print_unescaped(str_replace(
			[
				'{facebookimage}',
				'{twitterimage}',
				'{rssimage}',
				'{mailimage}',
				'{facebookopen}',
				'{twitteropen}',
				'{rssopen}',
				'{newsletteropen}',
				'{linkclose}',
				'{facebooktext}',
				'{twittertext}',
				'{rsstext}',
				'{mailtext}',
			],
			[
				image_path('core', 'facebook.svg'),
				image_path('core', 'twitter.svg'),
				image_path('core', 'rss.svg'),
				image_path('core', 'mail.svg'),
				'<a target="_blank" rel="noreferrer noopener" href="https://www.facebook.com/Nextclouders/">',
				'<a target="_blank" rel="noreferrer noopener" href="https://twitter.com/nextclouders">',
				'<a target="_blank" rel="noreferrer noopener" href="https://nextcloud.com/news/">',
				'<a target="_blank" rel="noreferrer noopener" href="https://newsletter.nextcloud.com/?p=subscribe&amp;id=1">',
				'</a>',
				$l->t('Like our Facebook page'),
				$l->t('Follow us on Twitter'),
				$l->t('Check out our blog'),
				$l->t('Subscribe to our newsletter'),

			],
			'{facebookopen}<img width="50" height="50" src="{facebookimage}" title="{facebooktext}" alt="{facebooktext}">{linkclose}
{twitteropen}<img width="50" height="50" src="{twitterimage}" title="{twittertext}" alt="{twittertext}">{linkclose}
{rssopen}<img class="img-circle" width="50" height="50" src="{rssimage}" title="{rsstext}" alt="{rsstext}">{linkclose}
{newsletteropen}<img width="50" height="50" src="{mailimage}" title="{mailtext}" alt="{mailtext}">{linkclose}'
		)); ?>
	</p>

</div>


