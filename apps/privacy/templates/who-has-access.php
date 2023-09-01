<div id="themes" class="section">
	<h3><?php p($l->t('Who has access to your data?')) ?></h3>
	<h4><?php p($l->t('Administrators')); ?></h4>
	<div id="privacy_access_admins"></div>

	<h4><?php p($l->t('People you shared with')) ?></h4>
	<div id="privacy_access_shares"></div>

	<?php if (!empty($_['privacyPolicyUrl'])): ?>
	<h4><?php p($l->t('Privacy policy')) ?></h4>
	<p>
		<a href="<?php print_unescaped($_['privacyPolicyUrl']) ?>"><?php p($l->t('Read the privacy policy.')) ?></a>
	</p>
	<?php endif; ?>

	<h4><?php p($l->t('Encryption')) ?></h4>
	<div id="privacy_access_encryption"></div>
</div>
