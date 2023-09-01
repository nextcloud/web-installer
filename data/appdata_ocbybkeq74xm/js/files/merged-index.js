/*
 * Copyright (c) 2014
 *
 * @author Vincent Petry
 * @copyright 2014 Vincent Petry <pvince81@owncloud.com>
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

/* global dragOptions, folderDropOptions, OC */
(function() {

	if (!OCA.Files) {
		/**
		 * Namespace for the files app
		 * @namespace OCA.Files
		 */
		OCA.Files = {};
	}

	/**
	 * @namespace OCA.Files.App
	 */
	OCA.Files.App = {
		/**
		 * Navigation instance
		 *
		 * @member {OCP.Files.Navigation}
		 */
		navigation: null,

		/**
		 * File list for the "All files" section.
		 *
		 * @member {OCA.Files.FileList}
		 */
		fileList: null,

		currentFileList: null,

		/**
		 * Backbone model for storing files preferences
		 */
		_filesConfig: null,

		/**
		 * Initializes the files app
		 */
		initialize: function() {
			this.$showHiddenFiles = $('input#showhiddenfilesToggle');
			var showHidden = $('#showHiddenFiles').val() === "1";
			this.$showHiddenFiles.prop('checked', showHidden);

			// Toggle for grid view
			this.$showGridView = $('input#showgridview');
			this.$showGridView.on('change', _.bind(this._onGridviewChange, this));

			if ($('#fileNotFound').val() === "1") {
				OC.Notification.show(t('files', 'File could not be found'), {type: 'error'});
			}

			this._filesConfig = OCP.InitialState.loadState('files', 'config', {})

			var { fileid, scrollto, openfile } = OC.Util.History.parseUrlQuery();
			var fileActions = new OCA.Files.FileActions();
			// default actions
			fileActions.registerDefaultActions();
			// regular actions
			fileActions.merge(OCA.Files.fileActions);

			this._onActionsUpdated = _.bind(this._onActionsUpdated, this);
			OCA.Files.fileActions.on('setDefault.app-files', this._onActionsUpdated);
			OCA.Files.fileActions.on('registerAction.app-files', this._onActionsUpdated);

			this.files = OCA.Files.Files;

			// TODO: ideally these should be in a separate class / app (the embedded "all files" app)
			this.fileList = new OCA.Files.FileList(
				$('#app-content-files'), {
					dragOptions: dragOptions,
					folderDropOptions: folderDropOptions,
					fileActions: fileActions,
					allowLegacyActions: true,
					scrollTo: scrollto,
					openFile: openfile,
					filesClient: OC.Files.getClient(),
					multiSelectMenu: [
						{
							name: 'copyMove',
							displayName:  t('files', 'Move or copy'),
							iconClass: 'icon-external',
							order: 10,
						},
						{
							name: 'download',
							displayName:  t('files', 'Download'),
							iconClass: 'icon-download',
							order: 10,
						},
						OCA.Files.FileList.MultiSelectMenuActions.ToggleSelectionModeAction,
						{
							name: 'delete',
							displayName:  t('files', 'Delete'),
							iconClass: 'icon-delete',
							order: 99,
						},
						...(
							OCA?.SystemTags === undefined ? [] : ([{
								name: 'tags',
								displayName:  t('files', 'Tags'),
								iconClass: 'icon-tag',
								order: 100,
							}])
						),
					],
					sorting: {
						mode: $('#defaultFileSorting').val() === 'basename'
							? 'name'
							: $('#defaultFileSorting').val(),
						direction: $('#defaultFileSortingDirection').val()
					},
					config: this._filesConfig,
					enableUpload: true,
					maxChunkSize: OC.appConfig.files && OC.appConfig.files.max_chunk_size
				}
			);
			this.updateCurrentFileList(this.fileList)
			this.files.initialize();

			// for backward compatibility, the global FileList will
			// refer to the one of the "files" view
			window.FileList = this.fileList;

			OC.Plugins.attach('OCA.Files.App', this);

			this._setupEvents();

			this._debouncedPersistShowHiddenFilesState = _.debounce(this._persistShowHiddenFilesState, 1200);
			this._debouncedPersistCropImagePreviewsState = _.debounce(this._persistCropImagePreviewsState, 1200);

			if (sessionStorage.getItem('WhatsNewServerCheck') < (Date.now() - 3600*1000)) {
				OCP.WhatsNew.query(); // for Nextcloud server
				sessionStorage.setItem('WhatsNewServerCheck', Date.now());
			}

			window._nc_event_bus.emit('files:legacy-view:initialized', this);

			this.navigation = OCP.Files.Navigation
		},

		/**
		 * Destroy the app
		 */
		destroy: function() {
			this.fileList.destroy();
			this.fileList = null;
			this.files = null;
			OCA.Files.fileActions.off('setDefault.app-files', this._onActionsUpdated);
			OCA.Files.fileActions.off('registerAction.app-files', this._onActionsUpdated);
		},

		_onActionsUpdated: function(ev) {
			// forward new action to the file list
			if (ev.action) {
				this.fileList.fileActions.registerAction(ev.action);
			} else if (ev.defaultAction) {
				this.fileList.fileActions.setDefault(
					ev.defaultAction.mime,
					ev.defaultAction.name
				);
			}
		},

		/**
		 * Set the currently active file list
		 *
		 * Due to the file list implementations being registered after clicking the
		 * navigation item for the first time, OCA.Files.App is not aware of those until
		 * they have initialized themselves. Therefore the files list needs to call this
		 * method manually
		 *
		 * @param {OCA.Files.FileList} newFileList -
		 */
		updateCurrentFileList: function(newFileList) {
			if (this.currentFileList === newFileList) {
				return
			}

			this.currentFileList = newFileList;
			if (this.currentFileList !== null) {
				// update grid view to the current value
				const isGridView = this.$showGridView.is(':checked');
				this.currentFileList.setGridView(isGridView);
			}
		},

		/**
		 * Return the currently active file list
		 * @return {?OCA.Files.FileList}
		 */
		getCurrentFileList: function () {
			return this.currentFileList;
		},

		/**
		 * Returns the container of the currently visible app.
		 *
		 * @return app container
		 */
		getCurrentAppContainer: function() {
			var viewId = this.getActiveView();
			return $('#app-content-' + viewId);
		},

		/**
		 * Sets the currently active view
		 * @param viewId view id
		 */
		setActiveView: function(viewId) {
			// The Navigation API will handle the final event
			window._nc_event_bus.emit('files:legacy-navigation:changed', { id: viewId })
		},

		/**
		 * Returns the view id of the currently active view
		 * @return view id
		 */
		getActiveView: function() {
			return this.navigation
				&& this.navigation.active
				&& this.navigation.active.id;
		},

		/**
		 *
		 * @returns {Backbone.Model}
		 */
		getFilesConfig: function() {
			return this._filesConfig;
		},

		/**
		 * Setup events based on URL changes
		 */
		_setupEvents: function() {
			OC.Util.History.addOnPopStateHandler(_.bind(this._onPopState, this));

			// detect when app changed their current directory
			$('#app-content').delegate('>div', 'changeDirectory', _.bind(this._onDirectoryChanged, this));
			$('#app-content').delegate('>div', 'afterChangeDirectory', _.bind(this._onAfterDirectoryChanged, this));
			$('#app-content').delegate('>div', 'changeViewerMode', _.bind(this._onChangeViewerMode, this));
		},

		/**
		 * Event handler for when the current navigation item has changed
		 */
		_onNavigationChanged: function(view) {
			var params;
			if (view && (view.itemId || view.id)) {
				if (view.id) {
					params = {
						view: view.id,
						dir: '/',
					}
				} else {
					// Legacy handling
					params = {
						view: typeof view.view === 'string' && view.view !== '' ? view.view : view.itemId,
						dir: view.dir ? view.dir : '/'
					}
				}
				this._changeUrl(params.view, params.dir);
				OCA.Files.Sidebar.close();
				this.getCurrentAppContainer().trigger(new $.Event('urlChanged', params));
				window._nc_event_bus.emit('files:navigation:changed')
			}
		},

		/**
		 * Event handler for when an app notified that its directory changed
		 */
		_onDirectoryChanged: function(e) {
			if (e.dir && !e.changedThroughUrl) {
				this._changeUrl(this.getActiveView(), e.dir, e.fileId);
			}
		},

		/**
		 * Event handler for when an app notified that its directory changed
		 */
		_onAfterDirectoryChanged: function(e) {
			if (e.dir && e.fileId) {
				this._changeUrl(this.getActiveView(), e.dir, e.fileId);
			}
		},

		/**
		 * Event handler for when an app notifies that it needs space
		 * for viewer mode.
		 */
		_onChangeViewerMode: function(e) {
			var state = !!e.viewerModeEnabled;
			if (e.viewerModeEnabled) {
				OCA.Files.Sidebar.close();
			}
			$('#app-navigation').toggleClass('hidden', state);
			$('.app-files').toggleClass('viewer-mode no-sidebar', state);
		},

		/**
		 * Event handler for when the URL changed
		 */
		_onPopState: function(params) {
			params = _.extend({
				dir: '/',
				view: 'files'
			}, params);

			var lastId = this.getActiveView();
			if (!this.navigation.views.find(view => view.id === params.view)) {
				params.view = 'files';
			}

			this.setActiveView(params.view, {silent: true});
			if (lastId !== this.getActiveView()) {
				this.getCurrentAppContainer().trigger(new $.Event('show', params));
				window._nc_event_bus.emit('files:navigation:changed')
			}

			this.getCurrentAppContainer().trigger(new $.Event('urlChanged', params));

		},

		/**
		 * Encode URL params into a string, except for the "dir" attribute
		 * that gets encoded as path where "/" is not encoded
		 *
		 * @param {Object.<string>} params
		 * @return {string} encoded params
		 */
		_makeUrlParams: function(params) {
			var dir = params.dir;
			delete params.dir;
			return 'dir=' + OC.encodePath(dir) + '&' + OC.buildQueryString(params);
		},

		/**
		 * Change the URL to point to the given dir and view
		 */
		_changeUrl: function(view, dir, fileId) {
			var params = { dir: dir };
			if (view !== 'files') {
				params.view = view;
			} else if (fileId) {
				params.fileid = fileId;
			}
			var currentParams = OC.Util.History.parseUrlQuery();
			if (currentParams.dir === params.dir && currentParams.view === params.view) {
				if (currentParams.fileid !== params.fileid) {
					// if only fileid changed or was added, replace instead of push
					OC.Util.History.replaceState(this._makeUrlParams(params));
					return
				}
			} else {
				OC.Util.History.pushState(this._makeUrlParams(params));
				return
			}
		},

		/**
		 * Toggle showing gridview by default or not
		 *
		 * @returns {undefined}
		 */
		_onGridviewChange: function() {
			const isGridView = this.$showGridView.is(':checked');
			// only save state if user is logged in
			if (OC.currentUser) {
				$.post(OC.generateUrl('/apps/files/api/v1/showgridview'), {
					show: isGridView,
				});
			}
			this.$showGridView.next('#view-toggle')
				.removeClass('icon-toggle-filelist icon-toggle-pictures')
				.addClass(isGridView ? 'icon-toggle-filelist' : 'icon-toggle-pictures')
			this.$showGridView.next('#view-toggle')
				.attr('title', isGridView ? t('files', 'Show list view') : t('files', 'Show grid view'))
			this.$showGridView.attr('aria-label', isGridView ? t('files', 'Show list view') : t('files', 'Show grid view'))

			if (this.currentFileList) {
				this.currentFileList.setGridView(isGridView);
			}
		},

	};
})();

window.addEventListener('DOMContentLoaded', function() {
	// wait for other apps/extensions to register their event handlers and file actions
	// in the "ready" clause
	_.defer(function() {
		OCA.Files.App.initialize();
	});
});


/**
* ownCloud
*
* @author Vincent Petry
* @copyright 2014 Vincent Petry <pvince81@owncloud.com>
*
* This library is free software; you can redistribute it and/or
* modify it under the terms of the GNU AFFERO GENERAL PUBLIC LICENSE
* License as published by the Free Software Foundation; either
* version 3 of the License, or any later version.
*
* This library is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU AFFERO GENERAL PUBLIC LICENSE for more details.
*
* You should have received a copy of the GNU Affero General Public
* License along with this library.  If not, see <http://www.gnu.org/licenses/>.
*
*/

(function() {
	/**
	 * @class BreadCrumb
	 * @memberof OCA.Files
	 * @classdesc Breadcrumbs that represent the current path.
	 *
	 * @param {Object} [options] options
	 * @param {Function} [options.onClick] click event handler
	 * @param {Function} [options.onDrop] drop event handler
	 * @param {Function} [options.getCrumbUrl] callback that returns
	 * the URL of a given breadcrumb
	 */
	var BreadCrumb = function(options){
		this.$el = $('<nav></nav>');
		this.$menu = $('<div class="popovermenu menu-center"><ul></ul></div>');

		this.crumbSelector = '.crumb:not(.hidden):not(.crumbhome):not(.crumbmenu)';
		this.hiddenCrumbSelector = '.crumb.hidden:not(.crumbhome):not(.crumbmenu)';
		options = options || {};
		if (options.onClick) {
			this.onClick = options.onClick;
		}
		if (options.onDrop) {
			this.onDrop = options.onDrop;
			this.onOver = options.onOver;
			this.onOut = options.onOut;
		}
		if (options.getCrumbUrl) {
			this.getCrumbUrl = options.getCrumbUrl;
		}
		this._detailViews = [];
	};

	/**
	 * @memberof OCA.Files
	 */
	BreadCrumb.prototype = {
		$el: null,
		dir: null,
		dirInfo: null,

		/**
		 * Total width of all breadcrumbs
		 * @type int
		 * @private
		 */
		totalWidth: 0,
		breadcrumbs: [],
		onClick: null,
		onDrop: null,
		onOver: null,
		onOut: null,

		/**
		 * Sets the directory to be displayed as breadcrumb.
		 * This will re-render the breadcrumb.
		 * @param dir path to be displayed as breadcrumb
		 */
		setDirectory: function(dir) {
			dir = dir.replace(/\\/g, '/');
			dir = dir || '/';
			if (dir !== this.dir) {
				this.dir = dir;
				this.render();
			}
		},

		setDirectoryInfo: function(dirInfo) {
			if (dirInfo !== this.dirInfo) {
				this.dirInfo = dirInfo;
				this.render();
			}
		},

		/**
		 * @param {Backbone.View} detailView
		 */
		addDetailView: function(detailView) {
			this._detailViews.push(detailView);
		},

		/**
		 * Returns the full URL to the given directory
		 *
		 * @param {Object.<String, String>} part crumb data as map
		 * @param {number} index crumb index
		 * @return full URL
		 */
		getCrumbUrl: function(part, index) {
			return '#';
		},

		/**
		 * Renders the breadcrumb elements
		 */
		render: function() {
			// Menu is destroyed on every change, we need to init it
			OC.unregisterMenu($('.crumbmenu > .icon-more'), $('.crumbmenu > .popovermenu'));

			var parts = this._makeCrumbs(this.dir || '/');
			var $crumb;
			var $menuItem;
			this.$el.empty();
			this.breadcrumbs = [];
			var $crumbList = $('<ul class="breadcrumb"></ul>');

			for (var i = 0; i < parts.length; i++) {
				var part = parts[i];
				var $image;
				var $link = $('<a></a>');
				$crumb = $('<li class="crumb svg"></li>');
				if(part.dir) {
					$link.attr('href', this.getCrumbUrl(part, i));
				}
				if(part.name) {
					$link.text(part.name);
				}
				$link.addClass(part.linkclass);
				$crumb.append($link);
				$crumb.data('dir', part.dir);
				// Ignore menu button
				$crumb.data('crumb-id', i - 1);
				$crumb.addClass(part.class);

				if (part.img) {
					$image = $('<img class="svg"></img>');
					$image.attr('src', part.img);
					$image.attr('alt', part.alt);
					$link.append($image);
				}
				this.breadcrumbs.push($crumb);
				$crumbList.append($crumb);
				// Only add feedback if not menu
				if (this.onClick && i !== 0) {
					$link.on('click', this.onClick);
				}
			}
			this.$el.append($crumbList);

			// Menu creation
			this._createMenu();
			for (var j = 0; j < parts.length; j++) {
				var menuPart = parts[j];
				if(menuPart.dir) {
					$menuItem = $('<li class="crumblist"><a><span class="icon-folder"></span><span></span></a></li>');
					$menuItem.data('dir', menuPart.dir);
					$menuItem.find('a').attr('href', this.getCrumbUrl(part, j));
					$menuItem.find('span:eq(1)').text(menuPart.name);
					this.$menu.children('ul').append($menuItem);
					if (this.onClick) {
						$menuItem.on('click', this.onClick);
					}
				}
			}
			_.each(this._detailViews, function(view) {
				view.render({
					dirInfo: this.dirInfo
				});
				$crumb.append(view.$el);
				$menuItem.append(view.$el.clone(true));
			}, this);

			// setup drag and drop
			if (this.onDrop) {
				this.$el.find('.crumb:not(:last-child):not(.crumbmenu), .crumblist:not(:last-child)').droppable({
					drop: this.onDrop,
					over: this.onOver,
					out: this.onOut,
					tolerance: 'pointer',
					hoverClass: 'canDrop',
					greedy: true
				});
			}

			// Menu is destroyed on every change, we need to init it
			OC.registerMenu($('.crumbmenu > .icon-more'), $('.crumbmenu > .popovermenu'));

			this._resize();
		},

		/**
		 * Makes a breadcrumb structure based on the given path
		 *
		 * @param {String} dir path to split into a breadcrumb structure
		 * @param {String} [rootIcon=icon-home] icon to use for root
		 * @return {Object.<String, String>} map of {dir: path, name: displayName}
		 */
		_makeCrumbs: function(dir, rootIcon) {
			var crumbs = [];
			var pathToHere = '';
			// trim leading and trailing slashes
			dir = dir.replace(/^\/+|\/+$/g, '');
			var parts = dir.split('/');
			if (dir === '') {
				parts = [];
			}
			// menu part
			crumbs.push({
				class: 'crumbmenu hidden',
				linkclass: 'icon-more menutoggle'
			});
			// root part
			crumbs.push({
				name: t('files', 'Home'),
				dir: '/',
				class: 'crumbhome',
				linkclass: rootIcon || 'icon-home'
			});
			for (var i = 0; i < parts.length; i++) {
				var part = parts[i];
				pathToHere = pathToHere + '/' + part;
				crumbs.push({
					dir: pathToHere,
					name: part
				});
			}
			return crumbs;
		},

		/**
		 * Calculate real width based on individual crumbs
		 *
		 * @param {boolean} ignoreHidden ignore hidden crumbs
		 */
		getTotalWidth: function(ignoreHidden) {
			// The width has to be calculated by adding up the width of all the
			// crumbs; getting the width of the breadcrumb element is not a
			// valid approach, as the returned value could be clamped to its
			// parent width.
			var totalWidth = 0;
			for (var i = 0; i < this.breadcrumbs.length; i++ ) {
				var $crumb = $(this.breadcrumbs[i]);
				if(!$crumb.hasClass('hidden') || ignoreHidden === true) {
					totalWidth += $crumb.outerWidth(true);
				}
			}
			return totalWidth;
		},

 		/**
 		 * Hide the middle crumb
 		 */
 		_hideCrumb: function() {
			var length = this.$el.find(this.crumbSelector).length;
			// Get the middle one floored down
			var elmt = Math.floor(length / 2 - 0.5);
			this.$el.find(this.crumbSelector+':eq('+elmt+')').addClass('hidden');
 		},

 		/**
 		 * Get the crumb to show
 		 */
 		_getCrumbElement: function() {
			var hidden = this.$el.find(this.hiddenCrumbSelector).length;
			var shown = this.$el.find(this.crumbSelector).length;
			// Get the outer one with priority to the highest
			var elmt = (1 - shown % 2) * (hidden - 1);
			return this.$el.find(this.hiddenCrumbSelector + ':eq('+elmt+')');
		},

 		/**
 		 * Show the middle crumb
 		 */
 		_showCrumb: function() {
			if(this.$el.find(this.hiddenCrumbSelector).length === 1) {
				this.$el.find(this.hiddenCrumbSelector).removeClass('hidden');
			}
			this._getCrumbElement().removeClass('hidden');
 		},

		/**
		 * Create and append the popovermenu
		 */
		_createMenu: function() {
			this.$el.find('.crumbmenu').append(this.$menu);
			this.$menu.children('ul').empty();
		},

		/**
		 * Update the popovermenu
		 */
		_updateMenu: function() {
			var menuItems = this.$el.find(this.hiddenCrumbSelector);

			this.$menu.find('li').addClass('in-breadcrumb');
			for (var i = 0; i < menuItems.length; i++) {
				var crumbId = $(menuItems[i]).data('crumb-id');
				this.$menu.find('li:eq('+crumbId+')').removeClass('in-breadcrumb');
			}
		},

		_resize: function() {

			if (this.breadcrumbs.length <= 2) {
				// home & menu
				return;
			}

			// Always hide the menu to ensure that it does not interfere with
			// the width calculations; otherwise, the result could be different
			// depending on whether the menu was previously being shown or not.
			this.$el.find('.crumbmenu').addClass('hidden');

			// Show the crumbs to compress the siblings before hiding again the
			// crumbs. This is needed when the siblings expand to fill all the
			// available width, as in that case their old width would limit the
			// available width for the crumbs.
			// Note that the crumbs shown always overflow the parent width
			// (except, of course, when they all fit in).
			while (this.$el.find(this.hiddenCrumbSelector).length > 0
				&& Math.round(this.getTotalWidth()) <= Math.round(this.$el.parent().width())) {
				this._showCrumb();
			}

			var siblingsWidth = 0;
			this.$el.prevAll(':visible').each(function () {
				siblingsWidth += $(this).outerWidth(true);
			});
			this.$el.nextAll(':visible').each(function () {
				siblingsWidth += $(this).outerWidth(true);
			});

			var availableWidth = this.$el.parent().width() - siblingsWidth;

			// If container is smaller than content
			// AND if there are crumbs left to hide
			while (Math.round(this.getTotalWidth()) > Math.round(availableWidth)
				&& this.$el.find(this.crumbSelector).length > 0) {
				// As soon as one of the crumbs is hidden the menu will be
				// shown. This is needed for proper results in further width
				// checks.
				// Note that the menu is not shown only when all the crumbs were
				// being shown and they all fit the available space; if any of
				// the crumbs was not being shown then those shown would
				// overflow the available width, so at least one will be hidden
				// and thus the menu will be shown.
				this.$el.find('.crumbmenu').removeClass('hidden');
				this._hideCrumb();
			}

			this._updateMenu();
		}
	};

	OCA.Files.BreadCrumb = BreadCrumb;
})();


/*
 * Copyright (c) 2015
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

(function() {
	/**
	 * @class OCA.Files.DetailFileInfoView
	 * @classdesc
	 *
	 * Displays a block of details about the file info.
	 *
	 */
	var DetailFileInfoView = OC.Backbone.View.extend({
		tagName: 'div',
		className: 'detailFileInfoView',

		_template: null,

		/**
		 * returns the jQuery object for HTML output
		 *
		 * @returns {jQuery}
		 */
		get$: function() {
			return this.$el;
		},

		/**
		 * Sets the file info to be displayed in the view
		 *
		 * @param {OCA.Files.FileInfo} fileInfo file info to set
		 */
		setFileInfo: function(fileInfo) {
			this.model = fileInfo;
			this.render();
		},

		/**
		 * Returns the file info.
		 *
		 * @return {OCA.Files.FileInfo} file info
		 */
		getFileInfo: function() {
			return this.model;
		}
	});

	OCA.Files.DetailFileInfoView = DetailFileInfoView;
})();



/*
 * Copyright (c) 2015
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

(function() {
	/**
	 * @class OCA.Files.DetailsView
	 * @classdesc
	 *
	 * The details view show details about a selected file.
	 *
	 */
	var DetailsView = OC.Backbone.View.extend({
		id: 'app-sidebar',
		tabName: 'div',
		className: 'detailsView scroll-container',

		/**
		 * List of detail tab views
		 *
		 * @type Array<OCA.Files.DetailTabView>
		 */
		_tabViews: [],

		/**
		 * List of detail file info views
		 *
		 * @type Array<OCA.Files.DetailFileInfoView>
		 */
		_detailFileInfoViews: [],

		/**
		 * Id of the currently selected tab
		 *
		 * @type string
		 */
		_currentTabId: null,

		/**
		 * Dirty flag, whether the view needs to be rerendered
		 */
		_dirty: false,

		events: {
			'click a.close': '_onClose',
			'click .tabHeaders .tabHeader': '_onClickTab',
			'keyup .tabHeaders .tabHeader': '_onKeyboardActivateTab'
		},

		/**
		 * Initialize the details view
		 */
		initialize: function() {
			this._tabViews = [];
			this._detailFileInfoViews = [];

			this._dirty = true;
		},

		_onClose: function(event) {
			OC.Apps.hideAppSidebar(this.$el);
			event.preventDefault();
		},

		_onClickTab: function(e) {
			var $target = $(e.target);
			e.preventDefault();
			if (!$target.hasClass('tabHeader')) {
				$target = $target.closest('.tabHeader');
			}
			var tabId = $target.attr('data-tabid');
			if (_.isUndefined(tabId)) {
				return;
			}

			this.selectTab(tabId);
		},

		_onKeyboardActivateTab: function (event) {
			if (event.key === " " || event.key === "Enter") {
				this._onClickTab(event);
			}
		},

		template: function(vars) {
			return OCA.Files.Templates['detailsview'](vars);
		},

		/**
		 * Renders this details view
		 */
		render: function() {
			var templateVars = {
				closeLabel: t('files', 'Close')
			};

			this._tabViews = this._tabViews.sort(function(tabA, tabB) {
				var orderA = tabA.order || 0;
				var orderB = tabB.order || 0;
				if (orderA === orderB) {
					return OC.Util.naturalSortCompare(tabA.getLabel(), tabB.getLabel());
				}
				return orderA - orderB;
			});

			templateVars.tabHeaders = _.map(this._tabViews, function(tabView, i) {
				return {
					tabId: tabView.id,
					label: tabView.getLabel(),
					tabIcon: tabView.getIcon()
				};
			});

			this.$el.html(this.template(templateVars));

			var $detailsContainer = this.$el.find('.detailFileInfoContainer');

			// render details
			_.each(this._detailFileInfoViews, function(detailView) {
				$detailsContainer.append(detailView.get$());
			});

			if (!this._currentTabId && this._tabViews.length > 0) {
				this._currentTabId = this._tabViews[0].id;
			}

			this.selectTab(this._currentTabId);

			this._updateTabVisibilities();

			this._dirty = false;
		},

		/**
		 * Selects the given tab by id
		 *
		 * @param {string} tabId tab id
		 */
		selectTab: function(tabId) {
			if (!tabId) {
				return;
			}

			var tabView = _.find(this._tabViews, function(tab) {
				return tab.id === tabId;
			});

			if (!tabView) {
				console.warn('Details view tab with id "' + tabId + '" not found');
				return;
			}

			this._currentTabId = tabId;

			var $tabsContainer = this.$el.find('.tabsContainer');
			var $tabEl = $tabsContainer.find('#' + tabId);

			// hide other tabs
			$tabsContainer.find('.tab').addClass('hidden');

			$tabsContainer.attr('class', 'tabsContainer');
			$tabsContainer.addClass(tabView.getTabsContainerExtraClasses());

			// tab already rendered ?
			if (!$tabEl.length) {
				// render tab
				$tabsContainer.append(tabView.$el);
				$tabEl = tabView.$el;
			}

			// this should trigger tab rendering
			tabView.setFileInfo(this.model);

			$tabEl.removeClass('hidden');

			// update tab headers
			var $tabHeaders = this.$el.find('.tabHeaders li');
			$tabHeaders.removeClass('selected');
			$tabHeaders.filterAttr('data-tabid', tabView.id).addClass('selected');
		},

		/**
		 * Sets the file info to be displayed in the view
		 *
		 * @param {OCA.Files.FileInfoModel} fileInfo file info to set
		 */
		setFileInfo: function(fileInfo) {
			this.model = fileInfo;

			if (this._dirty) {
				this.render();
			} else {
				this._updateTabVisibilities();
			}

			if (this._currentTabId) {
				// only update current tab, others will be updated on-demand
				var tabId = this._currentTabId;
				var tabView = _.find(this._tabViews, function(tab) {
					return tab.id === tabId;
				});
				tabView.setFileInfo(fileInfo);
			}

			_.each(this._detailFileInfoViews, function(detailView) {
				detailView.setFileInfo(fileInfo);
			});
		},

		/**
		 * Update tab headers based on the current model
		 */
		_updateTabVisibilities: function() {
			// update tab header visibilities
			var self = this;
			var deselect = false;
			var countVisible = 0;
			var $tabHeaders = this.$el.find('.tabHeaders li');
			_.each(this._tabViews, function(tabView) {
				var isVisible = tabView.canDisplay(self.model);
				if (isVisible) {
					countVisible += 1;
				}
				if (!isVisible && self._currentTabId === tabView.id) {
					deselect = true;
				}
				$tabHeaders.filterAttr('data-tabid', tabView.id).toggleClass('hidden', !isVisible);
			});

			// hide the whole container if there is only one tab
			this.$el.find('.tabHeaders').toggleClass('hidden', countVisible <= 1);

			if (deselect) {
				// select the first visible tab instead
				var visibleTabId = this.$el.find('.tabHeader:not(.hidden):first').attr('data-tabid');
				this.selectTab(visibleTabId);
			}

		},

		/**
		 * Returns the file info.
		 *
		 * @return {OCA.Files.FileInfoModel} file info
		 */
		getFileInfo: function() {
			return this.model;
		},

		/**
		 * Adds a tab in the tab view
		 *
		 * @param {OCA.Files.DetailTabView} tab view
		 */
		addTabView: function(tabView) {
			this._tabViews.push(tabView);
			this._dirty = true;
		},

		/**
		 * Adds a detail view for file info.
		 *
		 * @param {OCA.Files.DetailFileInfoView} detail view
		 */
		addDetailView: function(detailView) {
			this._detailFileInfoViews.push(detailView);
			this._dirty = true;
		},

		/**
		 * Returns an array with the added DetailFileInfoViews.
		 *
		 * @return Array<OCA.Files.DetailFileInfoView> an array with the added
		 *         DetailFileInfoViews.
		 */
		getDetailViews: function() {
			return [].concat(this._detailFileInfoViews);
		}
	});

	OCA.Files.DetailsView = DetailsView;
})();


/*
 * Copyright (c) 2015
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

(function() {

	/**
	 * @class OCA.Files.DetailTabView
	 * @classdesc
	 *
	 * Base class for tab views to display file information.
	 *
	 */
	var DetailTabView = OC.Backbone.View.extend({
		tag: 'div',

		className: 'tab',

		/**
		 * Tab label
		 */
		_label: null,

		_template: null,

		initialize: function(options) {
			options = options || {};
			if (!this.id) {
				this.id = 'detailTabView' + DetailTabView._TAB_COUNT;
				DetailTabView._TAB_COUNT++;
			}
			if (options.order) {
				this.order = options.order || 0;
			}
		},

		/**
		 * Returns the extra CSS classes used by the tabs container when this
		 * tab is the selected one.
		 *
		 * In general you should not extend this method, as tabs should not
		 * modify the classes of its container; this is reserved as a last
		 * resort for very specific cases in which there is no other way to get
		 * the proper style or behaviour.
		 *
		 * @return {String} space-separated CSS classes
		 */
		getTabsContainerExtraClasses: function() {
			return '';
		},

		/**
		 * Returns the tab label
		 *
		 * @return {String} label
		 */
		getLabel: function() {
			return 'Tab ' + this.id;
		},

		/**
		 * Returns the tab label
		 *
		 * @return {String}|{null} icon class
		 */
		getIcon: function() {
			return null
		},

		/**
		 * returns the jQuery object for HTML output
		 *
		 * @returns {jQuery}
		 */
		get$: function() {
			return this.$el;
		},

		/**
		 * Renders this details view
		 *
		 * @abstract
		 */
		render: function() {
			// to be implemented in subclass
			// FIXME: code is only for testing
			this.$el.html('<div>Hello ' + this.id + '</div>');
		},

		/**
		 * Sets the file info to be displayed in the view
		 *
		 * @param {OCA.Files.FileInfoModel} fileInfo file info to set
		 */
		setFileInfo: function(fileInfo) {
			if (this.model !== fileInfo) {
				this.model = fileInfo;
				this.render();
			}
		},

		/**
		 * Returns the file info.
		 *
		 * @return {OCA.Files.FileInfoModel} file info
		 */
		getFileInfo: function() {
			return this.model;
		},

		/**
		 * Load the next page of results
		 */
		nextPage: function() {
			// load the next page, if applicable
		},

		/**
		 * Returns whether the current tab is able to display
		 * the given file info, for example based on mime type.
		 *
		 * @param {OCA.Files.FileInfoModel} fileInfo file info model
		 * @return {boolean} whether to display this tab
		 */
		canDisplay: function(fileInfo) {
			return true;
		}
	});
	DetailTabView._TAB_COUNT = 0;

	OCA.Files = OCA.Files || {};

	OCA.Files.DetailTabView = DetailTabView;
})();



/*
 * Copyright (c) 2014 Vincent Petry <pvince81@owncloud.com>
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

// HACK: this piece needs to be loaded AFTER the files app (for unit tests)
window.addEventListener('DOMContentLoaded', function() {
	(function(OCA) {
		/**
		 * @class OCA.Files.FavoritesFileList
		 * @augments OCA.Files.FavoritesFileList
		 *
		 * @classdesc Favorites file list.
		 * Displays the list of files marked as favorites
		 *
		 * @param $el container element with existing markup for the .files-controls
		 * and a table
		 * @param [options] map of options, see other parameters
		 */
		var FavoritesFileList = function($el, options) {
			this.initialize($el, options);
		};
		FavoritesFileList.prototype = _.extend({}, OCA.Files.FileList.prototype,
			/** @lends OCA.Files.FavoritesFileList.prototype */ {
			id: 'favorites',
			appName: t('files','Favorites'),

			_clientSideSort: true,
			_allowSelection: false,

			/**
			 * @private
			 */
			initialize: function($el, options) {
				OCA.Files.FileList.prototype.initialize.apply(this, arguments);
				if (this.initialized) {
					return;
				}
				OC.Plugins.attach('OCA.Files.FavoritesFileList', this);
			},

			updateEmptyContent: function() {
				var dir = this.getCurrentDirectory();
				if (dir === '/') {
					// root has special permissions
					this.$el.find('.emptyfilelist.emptycontent').toggleClass('hidden', !this.isEmpty);
					this.$el.find('.files-filestable thead th').toggleClass('hidden', this.isEmpty);
				}
				else {
					OCA.Files.FileList.prototype.updateEmptyContent.apply(this, arguments);
				}
			},

			getDirectoryPermissions: function() {
				return OC.PERMISSION_READ | OC.PERMISSION_DELETE;
			},

			updateStorageStatistics: function() {
				// no op because it doesn't have
				// storage info like free space / used space
			},

			reload: function() {
				this.showMask();
				if (this._reloadCall?.abort) {
					this._reloadCall.abort();
				}

				// there is only root
				this._setCurrentDir('/', false);

				this._reloadCall = this.filesClient.getFilteredFiles(
					{
						favorite: true
					},
					{
						properties: this._getWebdavProperties()
					}
				);
				var callBack = this.reloadCallback.bind(this);
				return this._reloadCall.then(callBack, callBack);
			},

			reloadCallback: function(status, result) {
				if (result) {
					// prepend empty dir info because original handler
					result.unshift({});
				}

				return OCA.Files.FileList.prototype.reloadCallback.call(this, status, result);
			},
		});

		OCA.Files.FavoritesFileList = FavoritesFileList;
	})(OCA);
});



/*
 * Copyright (c) 2014 Vincent Petry <pvince81@owncloud.com>
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

(function(OCA) {
	/**
	 * Registers the favorites file list from the files app sidebar.
	 *
	 * @namespace OCA.Files.FavoritesPlugin
	 */
	OCA.Files.FavoritesPlugin = {
		name: 'Favorites',

		/**
		 * @type OCA.Files.FavoritesFileList
		 */
		favoritesFileList: null,

		attach: function() {
			var self = this;
			$('#app-content-favorites').on('show.plugin-favorites', function(e) {
				self.showFileList($(e.target));
			});
			$('#app-content-favorites').on('hide.plugin-favorites', function() {
				self.hideFileList();
			});
		},

		detach: function() {
			if (this.favoritesFileList) {
				this.favoritesFileList.destroy();
				OCA.Files.fileActions.off('setDefault.plugin-favorites', this._onActionsUpdated);
				OCA.Files.fileActions.off('registerAction.plugin-favorites', this._onActionsUpdated);
				$('#app-content-favorites').off('.plugin-favorites');
				this.favoritesFileList = null;
			}
		},

		showFileList: function($el) {
			if (!this.favoritesFileList) {
				this.favoritesFileList = this._createFavoritesFileList($el);
			}
			return this.favoritesFileList;
		},

		hideFileList: function() {
			if (this.favoritesFileList) {
				this.favoritesFileList.$fileList.empty();
			}
		},

		/**
		 * Creates the favorites file list.
		 *
		 * @param $el container for the file list
		 * @return {OCA.Files.FavoritesFileList} file list
		 */
		_createFavoritesFileList: function($el) {
			var fileActions = this._createFileActions();
			// register favorite list for sidebar section
			return new OCA.Files.FavoritesFileList(
				$el, {
					fileActions: fileActions,
					// The file list is created when a "show" event is handled,
					// so it should be marked as "shown" like it would have been
					// done if handling the event with the file list already
					// created.
					shown: true
				}
			);
		},

		_createFileActions: function() {
			// inherit file actions from the files app
			var fileActions = new OCA.Files.FileActions();
			// note: not merging the legacy actions because legacy apps are not
			// compatible with the sharing overview and need to be adapted first
			fileActions.registerDefaultActions();
			fileActions.merge(OCA.Files.fileActions);

			if (!this._globalActionsInitialized) {
				// in case actions are registered later
				this._onActionsUpdated = _.bind(this._onActionsUpdated, this);
				OCA.Files.fileActions.on('setDefault.plugin-favorites', this._onActionsUpdated);
				OCA.Files.fileActions.on('registerAction.plugin-favorites', this._onActionsUpdated);
				this._globalActionsInitialized = true;
			}

			// when the user clicks on a folder, redirect to the corresponding
			// folder in the files app instead of opening it directly
			fileActions.register('dir', 'Open', OC.PERMISSION_READ, '', function (filename, context) {
				OCA.Files.App.setActiveView('files', {silent: true});
				OCA.Files.App.fileList.changeDirectory(OC.joinPaths(context.$file.attr('data-path'), filename), true, true);
			});
			fileActions.setDefault('dir', 'Open');
			return fileActions;
		},

		_onActionsUpdated: function(ev) {
			if (ev.action) {
				this.favoritesFileList.fileActions.registerAction(ev.action);
			} else if (ev.defaultAction) {
				this.favoritesFileList.fileActions.setDefault(
					ev.defaultAction.mime,
					ev.defaultAction.name
				);
			}
		}
	};

})(OCA);

OC.Plugins.register('OCA.Files.App', OCA.Files.FavoritesPlugin);



/*
 * Copyright (c) 2014
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

/**
 * The file upload code uses several hooks to interact with blueimps jQuery file upload library:
 * 1. the core upload handling hooks are added when initializing the plugin,
 * 2. if the browser supports progress events they are added in a separate set after the initialization
 * 3. every app can add its own triggers for fileupload
 *    - files adds d'n'd handlers and also reacts to done events to add new rows to the filelist
 *    - TODO pictures upload button
 *    - TODO music upload button
 */

/* global jQuery, md5 */

/**
 * File upload object
 *
 * @class OC.FileUpload
 * @classdesc
 *
 * Represents a file upload
 *
 * @param {OC.Uploader} uploader uploader
 * @param {Object} data blueimp data
 */
OC.FileUpload = function(uploader, data) {
	this.uploader = uploader;
	this.data = data;
	var basePath = '';
	if (this.uploader.fileList) {
		basePath = this.uploader.fileList.getCurrentDirectory();
	}
	var path = OC.joinPaths(basePath, this.getFile().relativePath || '', this.getFile().name);
	this.id = 'web-file-upload-' + md5(path) + '-' + (new Date()).getTime();
};
OC.FileUpload.CONFLICT_MODE_DETECT = 0;
OC.FileUpload.CONFLICT_MODE_OVERWRITE = 1;
OC.FileUpload.CONFLICT_MODE_AUTORENAME = 2;

// IE11 polyfill
// TODO: nuke out of orbit as well as this legacy code
if (!FileReader.prototype.readAsBinaryString) {
	FileReader.prototype.readAsBinaryString = function(fileData) {
		var binary = ''
		var pt = this
		var reader = new FileReader()
		reader.onload = function (e) {
			var bytes = new Uint8Array(reader.result)
			var length = bytes.byteLength
			for (var i = 0; i < length; i++) {
				binary += String.fromCharCode(bytes[i])
			}
			// pt.result  - readonly so assign binary
			pt.content = binary
			$(pt).trigger('onload')
		}
		reader.readAsArrayBuffer(fileData)
	}
}

OC.FileUpload.prototype = {

	/**
	 * Unique upload id
	 *
	 * @type string
	 */
	id: null,

	/**
	 * Upload data structure
	 */
	data: null,

	/**
	 * Upload element
	 *
	 * @type Object
	 */
	$uploadEl: null,

	/**
	 * Target folder
	 *
	 * @type string
	 */
	_targetFolder: '',

	/**
	 * @type int
	 */
	_conflictMode: OC.FileUpload.CONFLICT_MODE_DETECT,

	/**
	 * New name from server after autorename
	 *
	 * @type String
	 */
	_newName: null,

	/**
	 * Returns the unique upload id
	 *
	 * @return string
	 */
	getId: function() {
		return this.id;
	},

	/**
	 * Returns the file to be uploaded
	 *
	 * @return {File} file
	 */
	getFile: function() {
		return this.data.files[0];
	},

	/**
	 * Return the final filename.
	 *
	 * @return {String} file name
	 */
	getFileName: function() {
		// autorenamed name
		if (this._newName) {
			return this._newName;
		}
		return this.getFile().name;
	},

	setTargetFolder: function(targetFolder) {
		this._targetFolder = targetFolder;
	},

	getTargetFolder: function() {
		return this._targetFolder;
	},

	/**
	 * Get full path for the target file, including relative path,
	 * without the file name.
	 *
	 * @return {String} full path
	 */
	getFullPath: function() {
		return OC.joinPaths(this._targetFolder, this.getFile().relativePath || '');
	},

	/**
	 * Get full path for the target file,
	 * including relative path and file name.
	 *
	 * @return {String} full path
	 */
	getFullFilePath: function() {
		return OC.joinPaths(this.getFullPath(), this.getFile().name);
	},

	/**
	 * Returns conflict resolution mode.
	 *
	 * @return {number} conflict mode
	 */
	getConflictMode: function() {
		return this._conflictMode || OC.FileUpload.CONFLICT_MODE_DETECT;
	},

	/**
	 * Set conflict resolution mode.
	 * See CONFLICT_MODE_* constants.
	 *
	 * @param {number} mode conflict mode
	 */
	setConflictMode: function(mode) {
		this._conflictMode = mode;
	},

	deleteUpload: function() {
		delete this.data.jqXHR;
	},

	/**
	 * Trigger autorename and append "(2)".
	 * Multiple calls will increment the appended number.
	 */
	autoRename: function() {
		var name = this.getFile().name;
		if (!this._renameAttempt) {
			this._renameAttempt = 1;
		}

		var dotPos = name.lastIndexOf('.');
		var extPart = '';
		if (dotPos > 0) {
			this._newName = name.substr(0, dotPos);
			extPart = name.substr(dotPos);
		} else {
			this._newName = name;
		}

		// generate new name
		this._renameAttempt++;
		this._newName = this._newName + ' (' + this._renameAttempt + ')' + extPart;
	},

	/**
	 * Submit the upload
	 */
	submit: function() {
		var self = this;
		var data = this.data;
		var file = this.getFile();

		// if file is a directory, just create it
		// files are handled separately
		if (file.isDirectory) {
			return this.uploader.ensureFolderExists(OC.joinPaths(this._targetFolder, file.fullPath));
		}

		if (self.aborted === true) {
			return $.Deferred().resolve().promise();
		}
		// it was a folder upload, so make sure the parent directory exists already
		var folderPromise;
		if (file.relativePath) {
			folderPromise = this.uploader.ensureFolderExists(this.getFullPath());
		} else {
			folderPromise = $.Deferred().resolve().promise();
		}

		if (this.uploader.fileList) {
			this.data.url = this.uploader.fileList.getUploadUrl(this.getFileName(), this.getFullPath());
		}

		if (!this.data.headers) {
			this.data.headers = {};
		}

		// webdav without multipart
		this.data.multipart = false;
		this.data.type = 'PUT';

		delete this.data.headers['If-None-Match'];
		if (this._conflictMode === OC.FileUpload.CONFLICT_MODE_DETECT
			|| this._conflictMode === OC.FileUpload.CONFLICT_MODE_AUTORENAME) {
			this.data.headers['If-None-Match'] = '*';
		}

		var userName = this.uploader.davClient.getUserName();
		var password = this.uploader.davClient.getPassword();
		if (userName) {
			// copy username/password from DAV client
			this.data.headers['Authorization'] =
				'Basic ' + btoa(userName + ':' + (password || ''));
		}

		var chunkFolderPromise;
		if ($.support.blobSlice
			&& this.uploader.fileUploadParam.maxChunkSize
			&& this.getFile().size > this.uploader.fileUploadParam.maxChunkSize
		) {
			data.isChunked = true;
			var headers = {
				Destination: this.uploader.davClient._buildUrl(this.getTargetDestination())
			};

			chunkFolderPromise = this.uploader.davClient.createDirectory(
				'uploads/' + OC.getCurrentUser().uid + '/' + this.getId(), headers
			);
			// TODO: if fails, it means same id already existed, need to retry
		} else {
			chunkFolderPromise = $.Deferred().resolve().promise();
			var mtime = this.getFile().lastModified;
			if (mtime) {
				data.headers['X-OC-Mtime'] = mtime / 1000;
			}
		}

		// wait for creation of the required directory before uploading
		return Promise.all([folderPromise, chunkFolderPromise]).then(function() {
			if (self.aborted !== true) {
				data.submit();
			}
		}, function() {
			self.abort();
		});

	},

	/**
	 * Process end of transfer
	 */
	done: function() {
		if (!this.data.isChunked) {
			return $.Deferred().resolve().promise();
		}

		var uid = OC.getCurrentUser().uid;
		var mtime = this.getFile().lastModified;
		var size = this.getFile().size;
		var headers = {};
		if (mtime) {
			headers['X-OC-Mtime'] = mtime / 1000;
		}
		if (size) {
			headers['OC-Total-Length'] = size;
		}
		headers['Destination'] = this.uploader.davClient._buildUrl(this.getTargetDestination());

		return this.uploader.davClient.move(
			'uploads/' + uid + '/' + this.getId() + '/.file',
			this.getTargetDestination(),
			true,
			headers
		);
	},

	getTargetDestination: function() {
		var uid = OC.getCurrentUser().uid;
		return 'files/' + uid + '/' + OC.joinPaths(this.getFullPath(), this.getFileName());
	},

	_deleteChunkFolder: function() {
		// delete transfer directory for this upload
		this.uploader.davClient.remove(
			'uploads/' + OC.getCurrentUser().uid + '/' + this.getId()
		);
	},

	_delete: function() {
		if (this.data.isChunked) {
			this._deleteChunkFolder()
		}
		this.deleteUpload();
	},

	/**
	 * Abort the upload
	 */
	abort: function() {
		if (this.aborted) {
			return
		}
		this.aborted = true;
		if (this.data) {
			// abort running XHR
			this.data.abort();
		}
		this._delete();
	},

	/**
	 * Fail the upload
	 */
	fail: function() {
		if (this.aborted) {
			return
		}
		this._delete();
	},

	/**
	 * Returns the server response
	 *
	 * @return {Object} response
	 */
	getResponse: function() {
		var response = this.data.response();
		if (response.errorThrown || response.textStatus === 'error') {
			// attempt parsing Sabre exception is available
			var xml = response.jqXHR.responseXML;
			if (xml && xml.documentElement.localName === 'error' && xml.documentElement.namespaceURI === 'DAV:') {
				var messages = xml.getElementsByTagNameNS('http://sabredav.org/ns', 'message');
				var exceptions = xml.getElementsByTagNameNS('http://sabredav.org/ns', 'exception');
				if (messages.length) {
					response.message = messages[0].textContent;
				}
				if (exceptions.length) {
					response.exception = exceptions[0].textContent;
				}
				return response;
			}
		}

		if (typeof response.result !== 'string' && response.result) {
			//fetch response from iframe
			response = $.parseJSON(response.result[0].body.innerText);
			if (!response) {
				// likely due to internal server error
				response = {status: 500};
			}
		} else {
			response = response.result;
		}
		return response;
	},

	/**
	 * Returns the status code from the response
	 *
	 * @return {number} status code
	 */
	getResponseStatus: function() {
		if (this.uploader.isXHRUpload()) {
			var xhr = this.data.response().jqXHR;
			if (xhr) {
				return xhr.status;
			}
			return null;
		}
		return this.getResponse().status;
	},

	/**
	 * Returns the response header by name
	 *
	 * @param {String} headerName header name
	 * @return {Array|String} response header value(s)
	 */
	getResponseHeader: function(headerName) {
		headerName = headerName.toLowerCase();
		if (this.uploader.isXHRUpload()) {
			return this.data.response().jqXHR.getResponseHeader(headerName);
		}

		var headers = this.getResponse().headers;
		if (!headers) {
			return null;
		}

		var value =  _.find(headers, function(value, key) {
			return key.toLowerCase() === headerName;
		});
		if (_.isArray(value) && value.length === 1) {
			return value[0];
		}
		return value;
	}
};

/**
 * keeps track of uploads in progress and implements callbacks for the conflicts dialog
 * @namespace
 */

OC.Uploader = function() {
	this.init.apply(this, arguments);
};

OC.Uploader.prototype = _.extend({
	/**
	 * @type Array<OC.FileUpload>
	 */
	_uploads: {},

	/**
	 * Count of upload done promises that have not finished yet.
	 *
	 * @type int
	 */
	_pendingUploadDoneCount: 0,

	/**
	 * Is it currently uploading?
	 *
	 * @type boolean
	 */
	_uploading: false,

	/**
	 * List of directories known to exist.
	 *
	 * Key is the fullpath and value is boolean, true meaning that the directory
	 * was already created so no need to create it again.
	 */
	_knownDirs: {},

	/**
	 * @type OCA.Files.FileList
	 */
	fileList: null,

	/**
	 * @type OCA.Files.OperationProgressBar
	 */
	progressBar: null,

	/**
	 * @type OC.Files.Client
	 */
	filesClient: null,

	/**
	 * Webdav client pointing at the root "dav" endpoint
	 *
	 * @type OC.Files.Client
	 */
	davClient: null,

	/**
	 * Function that will allow us to know if Ajax uploads are supported
	 * @link https://github.com/New-Bamboo/example-ajax-upload/blob/master/public/index.html
	 * also see article @link http://blog.new-bamboo.co.uk/2012/01/10/ridiculously-simple-ajax-uploads-with-formdata
	 */
	_supportAjaxUploadWithProgress: function() {
		if (window.TESTING) {
			return true;
		}
		return supportFileAPI() && supportAjaxUploadProgressEvents() && supportFormData();

		// Is the File API supported?
		function supportFileAPI() {
			var fi = document.createElement('INPUT');
			fi.type = 'file';
			return 'files' in fi;
		}

		// Are progress events supported?
		function supportAjaxUploadProgressEvents() {
			var xhr = new XMLHttpRequest();
			return !! (xhr && ('upload' in xhr) && ('onprogress' in xhr.upload));
		}

		// Is FormData supported?
		function supportFormData() {
			return !! window.FormData;
		}
	},

	/**
	 * Returns whether an XHR upload will be used
	 *
	 * @return {boolean} true if XHR upload will be used,
	 * false for iframe upload
	 */
	isXHRUpload: function () {
		return !this.fileUploadParam.forceIframeTransport &&
			((!this.fileUploadParam.multipart && $.support.xhrFileUpload) ||
			$.support.xhrFormDataFileUpload);
	},

	/**
	 * Makes sure that the upload folder and its parents exists
	 *
	 * @param {String} fullPath full path
	 * @return {Promise} promise that resolves when all parent folders
	 * were created
	 */
	ensureFolderExists: function(fullPath) {
		if (!fullPath || fullPath === '/') {
			return $.Deferred().resolve().promise();
		}

		// remove trailing slash
		if (fullPath.charAt(fullPath.length - 1) === '/') {
			fullPath = fullPath.substr(0, fullPath.length - 1);
		}

		var self = this;
		var promise = this._knownDirs[fullPath];

		if (this.fileList) {
			// assume the current folder exists
			this._knownDirs[this.fileList.getCurrentDirectory()] = $.Deferred().resolve().promise();
		}

		if (!promise) {
			var deferred = new $.Deferred();
			promise = deferred.promise();
			this._knownDirs[fullPath] = promise;

			// make sure all parents already exist
			var parentPath = OC.dirname(fullPath);
			var parentPromise = this._knownDirs[parentPath];
			if (!parentPromise) {
				parentPromise = this.ensureFolderExists(parentPath);
			}

			parentPromise.then(function() {
				self.filesClient.createDirectory(fullPath).always(function(status) {
					// 405 is expected if the folder already exists
					if ((status >= 200 && status < 300) || status === 405) {
						if (status !== 405) {
							self.trigger('createdfolder', fullPath);
						}
						deferred.resolve();
						return;
					}
					OC.Notification.show(t('files', 'Could not create folder "{dir}"', {dir: fullPath}), {type: 'error'});
					deferred.reject();
				});
			}, function() {
				deferred.reject();
			});
		}

		return promise;
	},

	/**
	 * Submit the given uploads
	 *
	 * @param {Array} array of uploads to start
	 */
	submitUploads: function(uploads) {
		var self = this;
		_.each(uploads, function(upload) {
			self._uploads[upload.data.uploadId] = upload;
		});
		if (!self._uploading) {
			self.totalToUpload = 0;
		}
		self.totalToUpload += _.reduce(uploads, function(memo, upload) { return memo+upload.getFile().size; }, 0);
		var semaphore = new OCA.Files.Semaphore(5);
		var promises = _.map(uploads, function(upload) {
			return semaphore.acquire().then(function(){
				return upload.submit().then(function(){
					semaphore.release();
				});
			});
		});
	},

	confirmBeforeUnload: function() {
		if (this._uploading) {
			return t('files', 'This will stop your current uploads.')
		}
	},

	/**
	 * Show conflict for the given file object
	 *
	 * @param {OC.FileUpload} file upload object
	 */
	showConflict: function(fileUpload) {
		//show "file already exists" dialog
		var self = this;
		var file = fileUpload.getFile();
		// already attempted autorename but the server said the file exists ? (concurrently added)
		if (fileUpload.getConflictMode() === OC.FileUpload.CONFLICT_MODE_AUTORENAME) {
			// attempt another autorename, defer to let the current callback finish
			_.defer(function() {
				self.onAutorename(fileUpload);
			});
			return;
		}
		// retrieve more info about this file
		this.filesClient.getFileInfo(fileUpload.getFullFilePath()).then(function(status, fileInfo) {
			var original = fileInfo;
			var replacement = file;
			original.directory = original.path;
			OC.dialogs.fileexists(fileUpload, original, replacement, self);
		});
	},
	/**
	 * cancels all uploads
	 */
	cancelUploads:function() {
		this.log('canceling uploads');
		jQuery.each(this._uploads, function(i, upload) {
			upload.abort();
		});
		this.clear();
	},
	/**
	 * Clear uploads
	 */
	clear: function() {
		this._knownDirs = {};
	},
	/**
	 * Returns an upload by id
	 *
	 * @param {number} data uploadId
	 * @return {OC.FileUpload} file upload
	 */
	getUpload: function(data) {
		if (_.isString(data)) {
			return this._uploads[data];
		} else if (data.uploadId && this._uploads[data.uploadId]) {
			this._uploads[data.uploadId].data = data;
			return this._uploads[data.uploadId];
		}
		return null;
	},

	/**
	 * Removes an upload from the list of known uploads.
	 *
	 * @param {OC.FileUpload} upload the upload to remove.
	 */
	removeUpload: function(upload) {
		if (!upload || !upload.data || !upload.data.uploadId) {
			return;
		}

		// defer as some calls/chunks might still be busy failing, so we need
		// the upload info there still
		var self = this;
		var uploadId = upload.data.uploadId;
		// mark as deleted for the progress bar
		this._uploads[uploadId].deleted = true;
		window.setTimeout(function() {
			delete self._uploads[uploadId];
		}, 5000)
	},

	_activeUploadCount: function() {
		var count = 0;
		for (var key in this._uploads) {
			if (!this._uploads[key].deleted) {
				count++;
			}
		}

		return count;
	},

	showUploadCancelMessage: _.debounce(function() {
		OC.Notification.show(t('files', 'Upload cancelled.'), {timeout : 7, type: 'error'});
	}, 500),
	/**
	 * callback for the conflicts dialog
	 */
	onCancel:function() {
		this.cancelUploads();
	},
	/**
	 * callback for the conflicts dialog
	 * calls onSkip, onReplace or onAutorename for each conflict
	 * @param {object} conflicts - list of conflict elements
	 */
	onContinue:function(conflicts) {
		var self = this;
		//iterate over all conflicts
		jQuery.each(conflicts, function (i, conflict) {
			conflict = $(conflict);
			var keepOriginal = conflict.find('.original input[type="checkbox"]:checked').length === 1;
			var keepReplacement = conflict.find('.replacement input[type="checkbox"]:checked').length === 1;
			if (keepOriginal && keepReplacement) {
				// when both selected -> autorename
				self.onAutorename(conflict.data('data'));
			} else if (keepReplacement) {
				// when only replacement selected -> overwrite
				self.onReplace(conflict.data('data'));
			} else {
				// when only original selected -> skip
				// when none selected -> skip
				self.onSkip(conflict.data('data'));
			}
		});
	},
	/**
	 * handle skipping an upload
	 * @param {OC.FileUpload} upload
	 */
	onSkip:function(upload) {
		this.log('skip', null, upload);
		upload.deleteUpload();
	},
	/**
	 * handle replacing a file on the server with an uploaded file
	 * @param {FileUpload} data
	 */
	onReplace:function(upload) {
		this.log('replace', null, upload);
		upload.setConflictMode(OC.FileUpload.CONFLICT_MODE_OVERWRITE);
		this.submitUploads([upload]);
	},
	/**
	 * handle uploading a file and letting the server decide a new name
	 * @param {object} upload
	 */
	onAutorename:function(upload) {
		this.log('autorename', null, upload);
		upload.setConflictMode(OC.FileUpload.CONFLICT_MODE_AUTORENAME);

		do {
			upload.autoRename();
			// if file known to exist on the client side, retry
		} while (this.fileList && this.fileList.inList(upload.getFileName()));

		// resubmit upload
		this.submitUploads([upload]);
	},
	_trace: false, //TODO implement log handler for JS per class?
	log: function(caption, e, data) {
		if (this._trace) {
			console.log(caption);
			console.log(data);
		}
	},
	/**
	 * checks the list of existing files prior to uploading and shows a simple dialog to choose
	 * skip all, replace all or choose which files to keep
	 *
	 * @param {array} selection of files to upload
	 * @param {object} callbacks - object with several callback methods
	 * @param {Function} callbacks.onNoConflicts
	 * @param {Function} callbacks.onSkipConflicts
	 * @param {Function} callbacks.onReplaceConflicts
	 * @param {Function} callbacks.onChooseConflicts
	 * @param {Function} callbacks.onCancel
	 */
	checkExistingFiles: function (selection, callbacks) {
		var fileList = this.fileList;
		var conflicts = [];
		// only keep non-conflicting uploads
		selection.uploads = _.filter(selection.uploads, function(upload) {
			var file = upload.getFile();
			if (file.relativePath) {
				// can't check in subfolder contents
				return true;
			}
			if (!fileList) {
				// no list to check against
				return true;
			}
			if (upload.getTargetFolder() !== fileList.getCurrentDirectory()) {
				// not uploading to the current folder
				return true;
			}
			var fileInfo = fileList.findFile(file.name);
			if (fileInfo) {
				conflicts.push([
					// original
					_.extend(fileInfo, {
						directory: fileInfo.directory || fileInfo.path || fileList.getCurrentDirectory()
					}),
					// replacement (File object)
					upload
				]);
				return false;
			}
			return true;
		});
		if (conflicts.length) {
			// wait for template loading
			OC.dialogs.fileexists(null, null, null, this).done(function() {
				_.each(conflicts, function(conflictData) {
					OC.dialogs.fileexists(conflictData[1], conflictData[0], conflictData[1].getFile(), this);
				});
			});
		}

		// upload non-conflicting files
		// note: when reaching the server they might still meet conflicts
		// if the folder was concurrently modified, these will get added
		// to the already visible dialog, if applicable
		callbacks.onNoConflicts(selection);
	},

	_updateProgressBarOnUploadStop: function() {
		if (this._pendingUploadDoneCount === 0) {
			// All the uploads ended and there is no pending operation, so hide
			// the progress bar.
			// Note that this happens here only with non-chunked uploads; if the
			// upload was chunked then this will have been executed after all
			// the uploads ended but before the upload done handler that reduces
			// the pending operation count was executed.
			this._hideProgressBar();

			return;
		}

		this._setProgressBarText(t('files', 'Processing files …'), t('files', '…'));

		// Nothing is being uploaded at this point, and the pending operations
		// can not be cancelled, so the cancel button should be hidden.
		this._hideCancelButton();
	},

	_hideProgressBar: function() {
		this.progressBar.hideProgressBar();
	},

	_hideCancelButton: function() {
		this.progressBar.hideCancelButton();
	},

	_showProgressBar: function() {
		this.progressBar.showProgressBar();
	},

	_setProgressBarValue: function(value) {
		this.progressBar.setProgressBarValue(value);
	},

	_setProgressBarText: function(textDesktop, textMobile, title) {
		this.progressBar.setProgressBarText(textDesktop, textMobile, title);
	},

	/**
	 * Returns whether the given file is known to be a received shared file
	 *
	 * @param {Object} file file
	 * @return {boolean} true if the file is a shared file
	 */
	_isReceivedSharedFile: function(file) {
		if (!window.FileList) {
			return false;
		}
		var $tr = window.FileList.findFileEl(file.name);
		if (!$tr.length) {
			return false;
		}

		return ($tr.attr('data-mounttype') === 'shared-root' && $tr.attr('data-mime') !== 'httpd/unix-directory');
	},

	/**
	 * Initialize the upload object
	 *
	 * @param {Object} $uploadEl upload element
	 * @param {Object} options
	 * @param {OCA.Files.FileList} [options.fileList] file list object
	 * @param {OC.Files.Client} [options.filesClient] files client object
	 * @param {Object} [options.dropZone] drop zone for drag and drop upload
	 */
	init: function($uploadEl, options) {
		var self = this;

		options = options || {};

		this.fileList = options.fileList;
		this.progressBar = options.progressBar;
		this.filesClient = options.filesClient || OC.Files.getClient();
		this.davClient = new OC.Files.Client({
			host: this.filesClient.getHost(),
			root: OC.linkToRemoteBase('dav'),
			useHTTPS: OC.getProtocol() === 'https',
			userName: this.filesClient.getUserName(),
			password: this.filesClient.getPassword()
		});

		$uploadEl = $($uploadEl);
		this.$uploadEl = $uploadEl;

		if ($uploadEl.exists()) {
			this.progressBar.on('cancel', function() {
				self.cancelUploads();
				self.showUploadCancelMessage();
			});

			this.fileUploadParam = {
				type: 'PUT',
				dropZone: options.dropZone, // restrict dropZone to content div
				autoUpload: false,
				sequentialUploads: false,
				limitConcurrentUploads: 4,
				/**
				 * on first add of every selection
				 * - check all files of originalFiles array with files in dir
				 * - on conflict show dialog
				 *   - skip all -> remember as single skip action for all conflicting files
				 *   - replace all -> remember as single replace action for all conflicting files
				 *   - choose -> show choose dialog
				 *     - mark files to keep
				 *       - when only existing -> remember as single skip action
				 *       - when only new -> remember as single replace action
				 *       - when both -> remember as single autorename action
				 * - start uploading selection
				 * @param {object} e
				 * @param {object} data
				 * @returns {boolean}
				 */
				add: function(e, data) {
					self.log('add', e, data);
					var that = $(this), freeSpace = 0;

					var upload = new OC.FileUpload(self, data);
					// can't link directly due to jQuery not liking cyclic deps on its ajax object
					data.uploadId = upload.getId();

					// create a container where we can store the data objects
					if ( ! data.originalFiles.selection ) {
						// initialize selection and remember number of files to upload
						data.originalFiles.selection = {
							uploads: [],
							filesToUpload: data.originalFiles.length,
							totalBytes: 0
						};
					}
					// TODO: move originalFiles to a separate container, maybe inside OC.Upload
					var selection = data.originalFiles.selection;

					// add uploads
					if ( selection.uploads.length < selection.filesToUpload ) {
						// remember upload
						selection.uploads.push(upload);
					}

					//examine file
					var file = upload.getFile();
					try {
						// FIXME: not so elegant... need to refactor that method to return a value
						Files.isFileNameValid(file.name);
					}
					catch (errorMessage) {
						data.textStatus = 'invalidcharacters';
						data.errorThrown = errorMessage;
					}

					if (data.targetDir) {
						upload.setTargetFolder(data.targetDir);
						delete data.targetDir;
					}

					// in case folder drag and drop is not supported file will point to a directory
					// http://stackoverflow.com/a/20448357
					if ( !file.type && file.size % 4096 === 0 && file.size <= 102400) {
						var dirUploadFailure = false;
						try {
							var reader = new FileReader();
							reader.readAsBinaryString(file);
						} catch (error) {
							console.log(reader, error)
							//file is a directory
							dirUploadFailure = true;
						}

						if (dirUploadFailure) {
							data.textStatus = 'dirorzero';
							data.errorThrown = t('files',
								'Unable to upload {filename} as it is a directory or has 0 bytes',
								{filename: file.name}
							);
						}
					}

					// only count if we're not overwriting an existing shared file
					if (self._isReceivedSharedFile(file)) {
						file.isReceivedShare = true;
					} else {
						// add size
						selection.totalBytes += file.size;
					}

					// check free space
					if (!self.fileList || upload.getTargetFolder() === self.fileList.getCurrentDirectory()) {
						// Use global free space if there is no file list to check or the current directory is the target
						freeSpace = $('input[name=free_space]').val()
					} else if (upload.getTargetFolder().indexOf(self.fileList.getCurrentDirectory()) === 0) {
						// Check subdirectory free space if file is uploaded there
						// Retrieve the folder destination name
						var targetSubdir = upload._targetFolder.split('/').pop()
						freeSpace = parseInt(upload.uploader.fileList.getModelForFile(targetSubdir).get('quotaAvailableBytes'))
					}
					if (freeSpace >= 0 && selection.totalBytes > freeSpace) {
						data.textStatus = 'notenoughspace';
						data.errorThrown = t('files',
							'Not enough free space, you are uploading {size1} but only {size2} is left', {
							'size1': OC.Util.humanFileSize(selection.totalBytes),
							'size2': OC.Util.humanFileSize(freeSpace)
						});
					}

					// end upload for whole selection on error
					if (data.errorThrown) {
						// trigger fileupload fail handler
						var fu = that.data('blueimp-fileupload') || that.data('fileupload');
						fu._trigger('fail', e, data);
						return false; //don't upload anything
					}

					// check existing files when all is collected
					if ( selection.uploads.length >= selection.filesToUpload ) {

						//remove our selection hack:
						delete data.originalFiles.selection;

						var callbacks = {

							onNoConflicts: function (selection) {
								self.submitUploads(selection.uploads);
							},
							onSkipConflicts: function (selection) {
								//TODO mark conflicting files as toskip
							},
							onReplaceConflicts: function (selection) {
								//TODO mark conflicting files as toreplace
							},
							onChooseConflicts: function (selection) {
								//TODO mark conflicting files as chosen
							},
							onCancel: function (selection) {
								$.each(selection.uploads, function(i, upload) {
									upload.abort();
								});
							}
						};

						self.checkExistingFiles(selection, callbacks);

					}

					return true; // continue adding files
				},
				/**
				 * called after the first add, does NOT have the data param
				 * @param {object} e
				 */
				start: function(e) {
					self.log('start', e, null);
					self._uploading = true;
				},
				fail: function(e, data) {
					var upload = self.getUpload(data);
					var status = null;
					if (upload) {
						if (upload.aborted) {
							// uploads might fail with errors from the server when aborted
							return
						}
						status = upload.getResponseStatus();
					}
					self.log('fail', e, upload);

					self.removeUpload(upload);

					if (data.textStatus === 'abort' || data.errorThrown === 'abort') {
						return
					} else if (status === 412) {
						// file already exists
						self.showConflict(upload);
					} else if (status === 404) {
						// target folder does not exist any more
						OC.Notification.show(t('files', 'Target folder "{dir}" does not exist any more', {dir: upload.getFullPath()} ), {type: 'error'});
						self.cancelUploads();
					} else if (data.textStatus === 'notenoughspace') {
						// not enough space
						OC.Notification.show(t('files', 'Not enough free space'), {type: 'error'});
						self.cancelUploads();
					} else {
						// HTTP connection problem or other error
						var message = t('files', 'An unknown error has occurred');
						if (upload) {
							var response = upload.getResponse();
							if (response) {
								message = response.message;
							}
						}
						console.error(e, data, response)
						OC.Notification.show(message || data.errorThrown || t('files', 'File could not be uploaded'), {type: 'error'});
					}

					if (upload) {
						upload.fail();
					}
				},
				/**
				 * called for every successful upload
				 * @param {object} e
				 * @param {object} data
				 */
				done:function(e, data) {
					var upload = self.getUpload(data);
					var that = $(this);
					self.log('done', e, upload);

					self.removeUpload(upload);

					var status = upload.getResponseStatus();
					if (status < 200 || status >= 300) {
						// trigger fail handler
						var fu = that.data('blueimp-fileupload') || that.data('fileupload');
						fu._trigger('fail', e, data);
						return;
					}
				},
				/**
				 * called after last upload
				 * @param {object} e
				 * @param {object} data
				 */
				stop: function(e, data) {
					self.log('stop', e, data);
					self._uploading = false;
				}
			};

			if (options.maxChunkSize) {
				this.fileUploadParam.maxChunkSize = options.maxChunkSize;
			}

			// initialize jquery fileupload (blueimp)
			var fileupload = this.$uploadEl.fileupload(this.fileUploadParam);

			if (this._supportAjaxUploadWithProgress()) {
				//remaining time
				var lastUpdate, lastSize, bufferSize, buffer, bufferIndex, bufferIndex2, bufferTotal;

				var dragging = false;

				// add progress handlers
				fileupload.on('fileuploadadd', function(e, data) {
					self.log('progress handle fileuploadadd', e, data);
					self.trigger('add', e, data);
				});
				// add progress handlers
				fileupload.on('fileuploadstart', function(e, data) {
					self.log('progress handle fileuploadstart', e, data);
					self._setProgressBarText(t('files', 'Uploading …'), t('files', '…'));
					self._setProgressBarValue(0);
					self._showProgressBar();
					// initial remaining time variables
					lastUpdate   = new Date().getTime();
					lastSize     = 0;
					bufferSize   = 20;
					buffer       = [];
					bufferIndex  = 0;
					bufferIndex2 = 0;
					bufferTotal  = 0;
					for(var i = 0; i < bufferSize; i++){
						buffer[i]  = 0;
					}
					self.trigger('start', e, data);
				});
				fileupload.on('fileuploadprogress', function(e, data) {
					self.log('progress handle fileuploadprogress', e, data);
					//TODO progressbar in row
					self.trigger('progress', e, data);
				});
				fileupload.on('fileuploadprogressall', function(e, data) {
					self.log('progress handle fileuploadprogressall', e, data);
					var total = self.totalToUpload;
					var progress = (data.loaded / total) * 100;
					var thisUpdate = new Date().getTime();
					var diffUpdate = (thisUpdate - lastUpdate)/1000; // eg. 2s
					lastUpdate = thisUpdate;
					var diffSize = data.loaded - lastSize;
					lastSize = data.loaded;
					diffSize = diffSize / diffUpdate; // apply timing factor, eg. 1MiB/2s = 0.5MiB/s, unit is byte per second
					var remainingSeconds = ((total - data.loaded) / diffSize);
					if(remainingSeconds >= 0) {
						bufferTotal = bufferTotal - (buffer[bufferIndex]) + remainingSeconds;
						buffer[bufferIndex] = remainingSeconds; //buffer to make it smoother
						bufferIndex = (bufferIndex + 1) % bufferSize;
						bufferIndex2++;
					}
					var smoothRemainingSeconds;
					if (bufferIndex2 > 0 && bufferIndex2 < 20) {
						smoothRemainingSeconds = bufferTotal / bufferIndex2;
					} else if (bufferSize > 0) {
						smoothRemainingSeconds = bufferTotal / bufferSize;
					} else {
						smoothRemainingSeconds = 1;
					}

					var h = moment.duration(smoothRemainingSeconds, "seconds").humanize();
					if (!(smoothRemainingSeconds >= 0 && smoothRemainingSeconds < 14400)) {
						// show "Uploading ..." for durations longer than 4 hours
						h = t('files', 'Uploading …');
					}
					self._setProgressBarText(h, h, t('files', '{loadedSize} of {totalSize} ({bitrate})' , {
							loadedSize: OC.Util.humanFileSize(data.loaded),
							totalSize: OC.Util.humanFileSize(total),
							bitrate: OC.Util.humanFileSize(data.bitrate / 8) + '/s'
						}));
					self._setProgressBarValue(progress);
					self.trigger('progressall', e, data);
				});
				fileupload.on('fileuploadstop', function(e, data) {
					self.log('progress handle fileuploadstop', e, data);

					self.clear();
					self._updateProgressBarOnUploadStop();
					self.trigger('stop', e, data);
				});
				fileupload.on('fileuploadfail', function(e, data) {
					self.log('progress handle fileuploadfail', e, data);
					self.trigger('fail', e, data);
				});
				fileupload.on('fileuploaddragover', function(e){
					$('#app-content').addClass('file-drag');
					$('.emptyfilelist.emptycontent .icon-folder').addClass('icon-filetype-folder-drag-accept');

					var filerow = $(e.delegatedEvent.target).closest('tr');

					if(!filerow.hasClass('dropping-to-dir')){
						$('.dropping-to-dir .icon-filetype-folder-drag-accept').removeClass('icon-filetype-folder-drag-accept');
						$('.dropping-to-dir').removeClass('dropping-to-dir');
						$('.dir-drop').removeClass('dir-drop');
					}

					if(filerow.attr('data-type') === 'dir'){
						$('#app-content').addClass('dir-drop');
						filerow.addClass('dropping-to-dir');
						filerow.find('.thumbnail').addClass('icon-filetype-folder-drag-accept');
					}

					dragging = true;
				});

				var disableDropState = function() {
					$('#app-content').removeClass('file-drag');
					$('.dropping-to-dir').removeClass('dropping-to-dir');
					$('.dir-drop').removeClass('dir-drop');
					$('.icon-filetype-folder-drag-accept').removeClass('icon-filetype-folder-drag-accept');

					dragging = false;
				};

				fileupload.on('fileuploaddragleave fileuploaddrop', disableDropState);

				// In some browsers the "drop" event can be triggered with no
				// files even if the "dragover" event seemed to suggest that a
				// file was being dragged (and thus caused "fileuploaddragover"
				// to be triggered).
				fileupload.on('fileuploaddropnofiles', function() {
					if (!dragging) {
						return;
					}

					disableDropState();

					OC.Notification.show(t('files', 'Uploading that item is not supported'), {type: 'error'});
				});

				fileupload.on('fileuploadchunksend', function(e, data) {
					// modify the request to adjust it to our own chunking
					var upload = self.getUpload(data);
					if (!upload) {
						// likely cancelled
						return
					}
					var range = data.contentRange.split(' ')[1];
					var chunkId = range.split('/')[0].split('-')[0];
					// Use a numeric chunk id and set the Destination header on all request for ChunkingV2
					chunkId = Math.ceil((data.chunkSize+Number(chunkId)) / upload.uploader.fileUploadParam.maxChunkSize);
					data.headers['Destination'] = self.davClient._buildUrl(upload.getTargetDestination());

					data.url = OC.getRootPath() +
						'/remote.php/dav/uploads' +
						'/' + OC.getCurrentUser().uid +
						'/' + upload.getId() +
						'/' + chunkId;
					delete data.contentRange;
					delete data.headers['Content-Range'];
				});
				fileupload.on('fileuploaddone', function(e, data) {
					var upload = self.getUpload(data);

					self._pendingUploadDoneCount++;

					upload.done().always(function() {
						self._pendingUploadDoneCount--;
						if (self._activeUploadCount() === 0 && self._pendingUploadDoneCount === 0) {
							// All the uploads ended and there is no pending
							// operation, so hide the progress bar.
							// Note that this happens here only with chunked
							// uploads; if the upload was non-chunked then this
							// handler is immediately executed, before the
							// jQuery upload done handler that removes the
							// upload from the list, and thus at this point
							// there is still at least one upload that has not
							// ended (although the upload stop handler is always
							// executed after all the uploads have ended, which
							// hides the progress bar in that case).
							self._hideProgressBar();
						}
					}).done(function() {
						self.trigger('done', e, upload);
					}).fail(function(status, response) {
						if (upload.aborted) {
							return
						}

						var message = response.message;
						if (status === 507) {
							// not enough space
							OC.Notification.show(message || t('files', 'Not enough free space'), {type: 'error'});
							self.cancelUploads();
						} else if (status === 409) {
							OC.Notification.show(message || t('files', 'Target folder does not exist any more'), {type: 'error'});
						} else if (status === 403) {
							OC.Notification.show(message || t('files', 'Operation is blocked by access control'), {type: 'error'});
						} else {
							OC.Notification.show(message || t('files', 'Error when assembling chunks, status code {status}', {status: status}), {type: 'error'});
						}
						self.trigger('fail', e, data);
					});
				});
				fileupload.on('fileuploaddrop', function(e, data) {
					self.trigger('drop', e, data);
					if (e.isPropagationStopped()) {
						return false;
					}
				});
			}
			window.onbeforeunload = function() {
				return self.confirmBeforeUnload();
			}
		}

		//add multiply file upload attribute to all browsers except konqueror (which crashes when it's used)
		if (navigator.userAgent.search(/konqueror/i) === -1) {
			this.$uploadEl.attr('multiple', 'multiple');
		}

		return this.fileUploadParam;
	}
}, OC.Backbone.Events);


/*
 * Copyright (c) 2014
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

(function() {

	/**
	 * Construct a new FileActions instance
	 * @constructs FileActions
	 * @memberof OCA.Files
	 */
	var FileActions = function() {
		this.initialize();
	};
	FileActions.TYPE_DROPDOWN = 0;
	FileActions.TYPE_INLINE = 1;
	FileActions.prototype = {
		/** @lends FileActions.prototype */
		actions: {},
		defaults: {},
		icons: {},

		/**
		 * @deprecated
		 */
		currentFile: null,

		/**
		 * Dummy jquery element, for events
		 */
		$el: null,

		_fileActionTriggerTemplate: null,

		/**
		 * @private
		 */
		initialize: function() {
			this.clear();
			// abusing jquery for events until we get a real event lib
			this.$el = $('<div class="dummy-fileactions hidden"></div>');
			$('body').append(this.$el);

			this._showMenuClosure = _.bind(this._showMenu, this);
		},

		/**
		 * Adds an event handler
		 *
		 * @param {String} eventName event name
		 * @param {Function} callback
		 */
		on: function(eventName, callback) {
			this.$el.on(eventName, callback);
		},

		/**
		 * Removes an event handler
		 *
		 * @param {String} eventName event name
		 * @param {Function} callback
		 */
		off: function(eventName, callback) {
			this.$el.off(eventName, callback);
		},

		/**
		 * Notifies the event handlers
		 *
		 * @param {String} eventName event name
		 * @param {Object} data data
		 */
		_notifyUpdateListeners: function(eventName, data) {
			this.$el.trigger(new $.Event(eventName, data));
		},

		/**
		 * Merges the actions from the given fileActions into
		 * this instance.
		 *
		 * @param {OCA.Files.FileActions} fileActions instance of OCA.Files.FileActions
		 */
		merge: function(fileActions) {
			var self = this;
			// merge first level to avoid unintended overwriting
			_.each(fileActions.actions, function(sourceMimeData, mime) {
				var targetMimeData = self.actions[mime];
				if (!targetMimeData) {
					targetMimeData = {};
				}
				self.actions[mime] = _.extend(targetMimeData, sourceMimeData);
			});

			this.defaults = _.extend(this.defaults, fileActions.defaults);
			this.icons = _.extend(this.icons, fileActions.icons);
		},
		/**
		 * @deprecated use #registerAction() instead
		 */
		register: function(mime, name, permissions, icon, action, displayName) {
			return this.registerAction({
				name: name,
				mime: mime,
				permissions: permissions,
				icon: icon,
				actionHandler: action,
				displayName: displayName || name
			});
		},

		/**
		 * Register action
		 *
		 * @param {OCA.Files.FileAction} action object
		 */
		registerAction: function (action) {
			var mime = action.mime;
			var name = action.name;
			var actionSpec = {
				action: function(fileName, context) {
					// Actions registered in one FileAction may be executed on a
					// different one (for example, due to the "merge" function),
					// so the listeners have to be updated on the FileActions
					// from the context instead of on the one in which it was
					// originally registered.
					if (context && context.fileActions) {
						context.fileActions._notifyUpdateListeners('beforeTriggerAction', {action: actionSpec, fileName: fileName, context: context});
					}

					action.actionHandler(fileName, context);

					if (context && context.fileActions) {
						context.fileActions._notifyUpdateListeners('afterTriggerAction', {action: actionSpec, fileName: fileName, context: context});
					}
				},
				name: name,
				displayName: action.displayName,
				mime: mime,
				filename: action.filename,
				order: action.order || 0,
				icon: action.icon,
				iconClass: action.iconClass,
				permissions: action.permissions,
				type: action.type || FileActions.TYPE_DROPDOWN,
				altText: action.altText || ''
			};
			if (_.isUndefined(action.displayName)) {
				actionSpec.displayName = t('files', name);
			}
			if (_.isFunction(action.render)) {
				actionSpec.render = action.render;
			}
			if (_.isFunction(action.shouldRender)) {
				actionSpec.shouldRender = action.shouldRender;
			}
			if (!this.actions[mime]) {
				this.actions[mime] = {};
			}
			this.actions[mime][name] = actionSpec;
			this.icons[name] = action.icon;
			this._notifyUpdateListeners('registerAction', {action: action});
		},
		/**
		 * Clears all registered file actions.
		 */
		clear: function() {
			this.actions = {};
			this.defaults = {};
			this.icons = {};
			this.currentFile = null;
		},
		/**
		 * Sets the default action for a given mime type.
		 *
		 * @param {String} mime mime type
		 * @param {String} name action name
		 */
		setDefault: function (mime, name) {
			this.defaults[mime] = name;
			this._notifyUpdateListeners('setDefault', {defaultAction: {mime: mime, name: name}});
		},

		/**
		 * Returns a map of file actions handlers matching the given conditions
		 *
		 * @param {string} mime mime type
		 * @param {string} type "dir" or "file"
		 * @param {number} permissions permissions
		 * @param {string} filename filename
		 *
		 * @return {Object.<string,OCA.Files.FileActions~actionHandler>} map of action name to action spec
		 */
		get: function(mime, type, permissions, filename) {
			var actions = this.getActions(mime, type, permissions, filename);
			var filteredActions = {};
			$.each(actions, function (name, action) {
				filteredActions[name] = action.action;
			});
			return filteredActions;
		},

		/**
		 * Returns an array of file actions matching the given conditions
		 *
		 * @param {string} mime mime type
		 * @param {string} type "dir" or "file"
		 * @param {number} permissions permissions
		 * @param {string} filename filename
		 *
		 * @return {Array.<OCA.Files.FileAction>} array of action specs
		 */
		getActions: function(mime, type, permissions, filename) {
			var actions = {};
			if (this.actions.all) {
				actions = $.extend(actions, this.actions.all);
			}
			if (type) {//type is 'dir' or 'file'
				if (this.actions[type]) {
					actions = $.extend(actions, this.actions[type]);
				}
			}
			if (mime) {
				var mimePart = mime.substr(0, mime.indexOf('/'));
				if (this.actions[mimePart]) {
					actions = $.extend(actions, this.actions[mimePart]);
				}
				if (this.actions[mime]) {
					actions = $.extend(actions, this.actions[mime]);
				}
			}

			var filteredActions = {};
			var self = this;
			$.each(actions, function(name, action) {
				if (self.allowedPermissions(action.permissions, permissions) &&
					self.allowedFilename(action.filename, filename)) {
					filteredActions[name] = action;
				}
			});

			return filteredActions;
		},


		allowedPermissions: function(actionPermissions, permissions) {
			return (actionPermissions === OC.PERMISSION_NONE || (actionPermissions & permissions));
		},

		allowedFilename: function(actionFilename, filename) {
			return (!filename || filename === '' || !actionFilename
				|| actionFilename === '' || actionFilename === filename);
		},

		/**
		 * Returns the default file action handler for the given conditions
		 *
		 * @param {string} mime mime type
		 * @param {string} type "dir" or "file"
		 * @param {number} permissions permissions
		 *
		 * @return {OCA.Files.FileActions~actionHandler} action handler
		 *
		 * @deprecated use getDefaultFileAction instead
		 */
		getDefault: function (mime, type, permissions) {
			var defaultActionSpec = this.getDefaultFileAction(mime, type, permissions);
			if (defaultActionSpec) {
				return defaultActionSpec.action;
			}
			return undefined;
		},

		/**
		 * Returns the default file action handler for the current file
		 *
		 * @return {OCA.Files.FileActions~actionSpec} action spec
		 * @since 8.2
		 */
		getCurrentDefaultFileAction: function() {
			var mime = this.getCurrentMimeType();
			var type = this.getCurrentType();
			var permissions = this.getCurrentPermissions();
			return this.getDefaultFileAction(mime, type, permissions);
		},

		/**
		 * Returns the default file action handler for the given conditions
		 *
		 * @param {string} mime mime type
		 * @param {string} type "dir" or "file"
		 * @param {number} permissions permissions
		 *
		 * @return {OCA.Files.FileActions~actionSpec} action spec
		 * @since 8.2
		 */
		getDefaultFileAction: function(mime, type, permissions) {
			var mimePart;
			if (mime) {
				mimePart = mime.substr(0, mime.indexOf('/'));
			}
			var name = false;
			if (mime && this.defaults[mime]) {
				name = this.defaults[mime];
			} else if (mime && this.defaults[mimePart]) {
				name = this.defaults[mimePart];
			} else if (type && this.defaults[type]) {
				name = this.defaults[type];
			} else {
				name = this.defaults.all;
			}
			var actions = this.getActions(mime, type, permissions);
			return actions[name];
		},

		/**
		 * Default function to render actions
		 *
		 * @param {OCA.Files.FileAction} actionSpec file action spec
		 * @param {boolean} isDefault true if the action is a default one,
		 * false otherwise
		 * @param {OCA.Files.FileActionContext} context action context
		 */
		_defaultRenderAction: function(actionSpec, isDefault, context) {
			if (!isDefault) {
				var params = {
					name: actionSpec.name,
					nameLowerCase: actionSpec.name.toLowerCase(),
					displayName: actionSpec.displayName,
					icon: actionSpec.icon,
					iconClass: actionSpec.iconClass,
					altText: actionSpec.altText,
					hasDisplayName: !!actionSpec.displayName
				};
				if (_.isFunction(actionSpec.icon)) {
					params.icon = actionSpec.icon(context.$file.attr('data-file'), context);
				}
				if (_.isFunction(actionSpec.iconClass)) {
					params.iconClass = actionSpec.iconClass(context.$file.attr('data-file'), context);
				}

				var $actionLink = this._makeActionLink(params, context);
				context.$file.find('a.name>span.fileactions').append($actionLink);
				$actionLink.addClass('permanent');
				return $actionLink;
			}
		},

		/**
		 * Renders the action link element
		 *
		 * @param {Object} params action params
		 */
		_makeActionLink: function(params) {
			return $(OCA.Files.Templates['file_action_trigger'](params));
		},

		/**
		 * Displays the file actions dropdown menu
		 *
		 * @param {string} fileName file name
		 * @param {OCA.Files.FileActionContext} context rendering context
		 */
		_showMenu: function(fileName, context) {
			var menu;
			var $trigger = context.$file.closest('tr').find('.fileactions .action-menu');
			$trigger.addClass('open');
			$trigger.attr('aria-expanded', 'true');

			menu = new OCA.Files.FileActionsMenu();

			context.$file.find('td.filename').append(menu.$el);

			menu.$el.on('afterHide', function() {
				context.$file.removeClass('mouseOver');
				$trigger.removeClass('open');
				$trigger.attr('aria-expanded', 'false');
				menu.remove();
			});

			context.$file.addClass('mouseOver');
			menu.show(context);
		},

		/**
		 * Renders the menu trigger on the given file list row
		 *
		 * @param {Object} $tr file list row element
		 * @param {OCA.Files.FileActionContext} context rendering context
		 */
		_renderMenuTrigger: function($tr, context) {
			// remove previous
			$tr.find('.action-menu').remove();

			var $el = this._renderInlineAction({
				name: 'menu',
				displayName: '',
				iconClass: 'icon-more',
				altText: t('files', 'Actions'),
				action: this._showMenuClosure
			}, false, context);

			$el.addClass('permanent');
			$el.attr('aria-expanded', 'false');

		},

		/**
		 * Renders the action element by calling actionSpec.render() and
		 * registers the click event to process the action.
		 *
		 * @param {OCA.Files.FileAction} actionSpec file action to render
		 * @param {boolean} isDefault true if the action is a default action,
		 * false otherwise
		 * @param {OCA.Files.FileActionContext} context rendering context
		 */
		_renderInlineAction: function(actionSpec, isDefault, context) {
			if (actionSpec.shouldRender) {
				if (!actionSpec.shouldRender(context)) {
					return;
				}
			}
			var renderFunc = actionSpec.render || _.bind(this._defaultRenderAction, this);
			var $actionEl = renderFunc(actionSpec, isDefault, context);
			if (!$actionEl || !$actionEl.length) {
				return;
			}
			$actionEl.on(
				'click', {
					a: null
				},
				function(event) {
					event.stopPropagation();
					event.preventDefault();

					if ($actionEl.hasClass('open')) {
						return;
					}

					var $file = $(event.target).closest('tr');
					if ($file.hasClass('busy')) {
						return;
					}
					var currentFile = $file.find('td.filename');
					var fileName = $file.attr('data-file');

					context.fileActions.currentFile = currentFile;

					var callContext = _.extend({}, context);

					if (!context.dir && context.fileList) {
						callContext.dir = $file.attr('data-path') || context.fileList.getCurrentDirectory();
					}

					if (!context.fileInfoModel && context.fileList) {
						callContext.fileInfoModel = context.fileList.getModelForFile(fileName);
						if (!callContext.fileInfoModel) {
							console.warn('No file info model found for file "' + fileName + '"');
						}
					}

					actionSpec.action(
						fileName,
						callContext
					);
				}
			);

			return $actionEl;
		},

		/**
		 * Trigger the given action on the given file.
		 *
		 * @param {string} actionName action name
		 * @param {OCA.Files.FileInfoModel} fileInfoModel file info model
		 * @param {OCA.Files.FileList} [fileList] file list, for compatibility with older action handlers [DEPRECATED]
		 *
		 * @return {boolean} true if the action handler was called, false otherwise
		 *
		 * @since 8.2
		 */
		triggerAction: function(actionName, fileInfoModel, fileList) {
			var actionFunc;
			var actions = this.get(
				fileInfoModel.get('mimetype'),
				fileInfoModel.isDirectory() ? 'dir' : 'file',
				fileInfoModel.get('permissions'),
				fileInfoModel.get('name')
			);

			if (actionName) {
				actionFunc = actions[actionName];
			} else {
				actionFunc = this.getDefault(
					fileInfoModel.get('mimetype'),
					fileInfoModel.isDirectory() ? 'dir' : 'file',
					fileInfoModel.get('permissions')
				);
			}

			if (!actionFunc) {
				actionFunc = actions['Download'];
			}

			if (!actionFunc) {
				return false;
			}

			var context = {
				fileActions: this,
				fileInfoModel: fileInfoModel,
				dir: fileInfoModel.get('path')
			};

			var fileName = fileInfoModel.get('name');
			this.currentFile = fileName;

			if (fileList) {
				// compatibility with action handlers that expect these
				context.fileList = fileList;
				context.$file = fileList.findFileEl(fileName);
			}

			actionFunc(fileName, context);
		},

		/**
		 * Display file actions for the given element
		 * @param parent "td" element of the file for which to display actions
		 * @param triggerEvent if true, triggers the fileActionsReady on the file
		 * list afterwards (false by default)
		 * @param fileList OCA.Files.FileList instance on which the action is
		 * done, defaults to OCA.Files.App.fileList
		 */
		display: function (parent, triggerEvent, fileList) {
			if (!fileList) {
				console.warn('FileActions.display() MUST be called with a OCA.Files.FileList instance');
				return;
			}
			this.currentFile = parent;
			var self = this;
			var $tr = parent.closest('tr');
			var actions = this.getActions(
				this.getCurrentMimeType(),
				this.getCurrentType(),
				this.getCurrentPermissions(),
				this.getCurrentFile()
			);
			var nameLinks;
			if ($tr.data('renaming')) {
				return;
			}

			// recreate fileactions container
			nameLinks = parent.children('a.name');
			nameLinks.find('.fileactions, .nametext .action').remove();
			nameLinks.append('<span class="fileactions"></span>');
			var defaultAction = this.getDefaultFileAction(
				this.getCurrentMimeType(),
				this.getCurrentType(),
				this.getCurrentPermissions()
			);

			var context = {
				$file: $tr,
				fileActions: this,
				fileList: fileList
			};

			$.each(actions, function (name, actionSpec) {
				if (actionSpec.type === FileActions.TYPE_INLINE) {
					self._renderInlineAction(
						actionSpec,
						defaultAction && actionSpec.name === defaultAction.name,
						context
					);
				}
			});

			function objectValues(obj) {
				var res = [];
				for (var i in obj) {
					if (obj.hasOwnProperty(i)) {
						res.push(obj[i]);
					}
				}
				return res;
			}
			// polyfill
			if (!Object.values) {
				Object.values = objectValues;
			}

			var menuActions = Object.values(actions).filter(function (action) {
				return action.type !== OCA.Files.FileActions.TYPE_INLINE && (!defaultAction || action.name !== defaultAction.name)
			});
			// do not render the menu if nothing is in it
			if (menuActions.length > 0) {
				this._renderMenuTrigger($tr, context);
			}

			if (triggerEvent){
				fileList.$fileList.trigger(jQuery.Event("fileActionsReady", {fileList: fileList, $files: $tr}));
			}
		},
		getCurrentFile: function () {
			return this.currentFile.parent().attr('data-file');
		},
		getCurrentMimeType: function () {
			return this.currentFile.parent().attr('data-mime');
		},
		getCurrentType: function () {
			return this.currentFile.parent().attr('data-type');
		},
		getCurrentPermissions: function () {
			return this.currentFile.parent().data('permissions');
		},

		/**
		 * Register the actions that are used by default for the files app.
		 */
		registerDefaultActions: function() {
			this.registerAction({
				name: 'Download',
				displayName: t('files', 'Download'),
				order: -20,
				mime: 'all',
				permissions: OC.PERMISSION_READ,
				iconClass: 'icon-download',
				actionHandler: function (filename, context) {
					var dir = context.dir || context.fileList.getCurrentDirectory();
					var isDir = context.$file.attr('data-type') === 'dir';
					var url = context.fileList.getDownloadUrl(filename, dir, isDir);

					var downloadFileaction = $(context.$file).find('.fileactions .action-download');

					// don't allow a second click on the download action
					if(downloadFileaction.hasClass('disabled')) {
						return;
					}

					if (url) {
						var disableLoadingState = function() {
							context.fileList.showFileBusyState(filename, false);
						};

						context.fileList.showFileBusyState(filename, true);
						OCA.Files.Files.handleDownload(url, disableLoadingState);
					}
				}
			});

			this.registerAction({
				name: 'Rename',
				displayName: t('files', 'Rename'),
				mime: 'all',
				order: -30,
				permissions: OC.PERMISSION_UPDATE,
				iconClass: 'icon-rename',
				actionHandler: function (filename, context) {
					context.fileList.rename(filename);
				}
			});

			this.registerAction({
				name: 'MoveCopy',
				displayName: function(context) {
					var permissions = context.fileInfoModel.attributes.permissions;
					if (permissions & OC.PERMISSION_UPDATE) {
						if (!context.fileInfoModel.canDownload()) {
							return t('files', 'Move');
						}
						return t('files', 'Move or copy');
					}
					return t('files', 'Copy');
				},
				mime: 'all',
				order: -25,
				permissions: $('#isPublic').val() ? OC.PERMISSION_UPDATE : OC.PERMISSION_READ,
				iconClass: 'icon-external',
				actionHandler: function (filename, context) {
					var permissions = context.fileInfoModel.attributes.permissions;
					var actions = OC.dialogs.FILEPICKER_TYPE_COPY;
					if (permissions & OC.PERMISSION_UPDATE) {
						if (!context.fileInfoModel.canDownload()) {
							actions = OC.dialogs.FILEPICKER_TYPE_MOVE;
						} else {
							actions = OC.dialogs.FILEPICKER_TYPE_COPY_MOVE;
						}
					}
					var dialogDir = context.dir;
					if (typeof context.fileList.dirInfo.dirLastCopiedTo !== 'undefined') {
						dialogDir = context.fileList.dirInfo.dirLastCopiedTo;
					}
					OC.dialogs.filepicker(t('files', 'Choose target folder'), function(targetPath, type) {
						if (type === OC.dialogs.FILEPICKER_TYPE_COPY) {
							context.fileList.copy(filename, targetPath, false, context.dir);
						}
							if (type === OC.dialogs.FILEPICKER_TYPE_MOVE) {
								context.fileList.move(filename, targetPath, false, context.dir);
							}
							context.fileList.dirInfo.dirLastCopiedTo = targetPath;
						}, false, "httpd/unix-directory", true, actions, dialogDir);
				}
			});

			if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
				this.registerAction({
					name: 'EditLocally',
					displayName: function(context) {
						var locked = context.$file.data('locked');
						if (!locked) {
							return t('files', 'Edit locally');
						}
					},
					mime: 'all',
					order: -23,
					icon: function(filename, context) {
						var locked = context.$file.data('locked');
						if (!locked) {
							return OC.imagePath('files', 'computer.svg')
						}
					},
					permissions: OC.PERMISSION_UPDATE,
					actionHandler: function (filename, context) {
						var dir = context.dir || context.fileList.getCurrentDirectory();
						var path = dir === '/' ? dir + filename : dir + '/' + filename;
						context.fileList.openLocalClient(path);
					},
				});
			}

			this.registerAction({
				name: 'Open',
				mime: 'dir',
				permissions: OC.PERMISSION_READ,
				icon: '',
				actionHandler: function (filename, context) {
					let dir, id
					if (context.$file) {
						dir = context.$file.attr('data-path')
						id = context.$file.attr('data-id')
					} else {
						dir = context.fileList.getCurrentDirectory()
						id = context.fileId
					}
					if (OCA.Files.App && OCA.Files.App.getActiveView() !== 'files') {
						OCA.Files.App.setActiveView('files', {silent: true});
						OCA.Files.App.fileList.changeDirectory(OC.joinPaths(dir, filename), true, true);
					} else {
						context.fileList.changeDirectory(OC.joinPaths(dir, filename), true, false, parseInt(id, 10));
					}
				},
				displayName: t('files', 'Open')
			});

			this.registerAction({
				name: 'Delete',
				displayName: function(context) {
					var mountType = context.$file.attr('data-mounttype');
					var type = context.$file.attr('data-type');
					var deleteTitle = (type && type === 'file')
						? t('files', 'Delete file')
						: t('files', 'Delete folder')
					if (mountType === 'external-root') {
						deleteTitle = t('files', 'Disconnect storage');
					} else if (mountType === 'shared-root') {
						deleteTitle = t('files', 'Leave this share');
					}
					return deleteTitle;
				},
				mime: 'all',
				order: 1000,
				// permission is READ because we show a hint instead if there is no permission
				permissions: OC.PERMISSION_DELETE,
				iconClass: 'icon-delete',
				actionHandler: function(fileName, context) {
					// if there is no permission to delete do nothing
					if((context.$file.data('permissions') & OC.PERMISSION_DELETE) === 0) {
						return;
					}
					context.fileList.do_delete(fileName, context.dir);
					$('.tipsy').remove();

					// close sidebar on delete
					const path = context.dir + '/' + fileName
					if (OCA.Files.Sidebar && OCA.Files.Sidebar.file === path) {
						OCA.Files.Sidebar.close()
					}
				}
			});

			this.setDefault('dir', 'Open');
		}
	};

	OCA.Files.FileActions = FileActions;

	/**
	 * Replaces the button icon with a loading spinner and vice versa
	 * - also adds the class disabled to the passed in element
	 *
	 * @param {jQuery} $buttonElement The button element
	 * @param {boolean} showIt whether to show the spinner(true) or to hide it(false)
	 */
	OCA.Files.FileActions.updateFileActionSpinner = function($buttonElement, showIt) {
		var $icon = $buttonElement.find('.icon');
		if (showIt) {
			var $loadingIcon = $('<span class="icon icon-loading-small"></span>');
			$icon.after($loadingIcon);
			$icon.addClass('hidden');
		} else {
			$buttonElement.find('.icon-loading-small').remove();
			$buttonElement.find('.icon').removeClass('hidden');
		}
	};

	/**
	 * File action attributes.
	 *
	 * @todo make this a real class in the future
	 * @typedef {Object} OCA.Files.FileAction
	 *
	 * @property {String} name identifier of the action
	 * @property {(String|OCA.Files.FileActions~displayNameFunction)} displayName
	 * display name string for the action, or function that returns the display name.
	 * Defaults to the name given in name property
	 * @property {String} mime mime type
	 * @property {String} filename filename
	 * @property {number} permissions permissions
	 * @property {(Function|String)} icon icon path to the icon or function that returns it (deprecated, use iconClass instead)
	 * @property {(String|OCA.Files.FileActions~iconClassFunction)} iconClass class name of the icon (recommended for theming)
	 * @property {OCA.Files.FileActions~renderActionFunction} [render] optional rendering function
	 * @property {OCA.Files.FileActions~actionHandler} actionHandler action handler function
	 */

	/**
	 * File action context attributes.
	 *
	 * @typedef {Object} OCA.Files.FileActionContext
	 *
	 * @property {Object} $file jQuery file row element
	 * @property {OCA.Files.FileActions} fileActions file actions object
	 * @property {OCA.Files.FileList} fileList file list object
	 */

	/**
	 * Render function for actions.
	 * The function must render a link element somewhere in the DOM
	 * and return it. The function should NOT register the event handler
	 * as this will be done after the link was returned.
	 *
	 * @callback OCA.Files.FileActions~renderActionFunction
	 * @param {OCA.Files.FileAction} actionSpec action definition
	 * @param {Object} $row row container
	 * @param {boolean} isDefault true if the action is the default one,
	 * false otherwise
	 * @return {Object} jQuery link object
	 */

	/**
	 * Display name function for actions.
	 * The function returns the display name of the action using
	 * the given context information..
	 *
	 * @callback OCA.Files.FileActions~displayNameFunction
	 * @param {OCA.Files.FileActionContext} context action context
	 * @return {String} display name
	 */

	/**
	 * Icon class function for actions.
	 * The function returns the icon class of the action using
	 * the given context information.
	 *
	 * @callback OCA.Files.FileActions~iconClassFunction
	 * @param {String} fileName name of the file on which the action must be performed
	 * @param {OCA.Files.FileActionContext} context action context
	 * @return {String} icon class
	 */

	/**
	 * Action handler function for file actions
	 *
	 * @callback OCA.Files.FileActions~actionHandler
	 * @param {String} fileName name of the file on which the action must be performed
	 * @param context context
	 * @param {String} context.dir directory of the file
	 * @param {OCA.Files.FileInfoModel} fileInfoModel file info model
	 * @param {Object} [context.$file] jQuery element of the file [DEPRECATED]
	 * @param {OCA.Files.FileList} [context.fileList] the FileList instance on which the action occurred [DEPRECATED]
	 * @param {OCA.Files.FileActions} context.fileActions the FileActions instance on which the action occurred
	 */

	// global file actions to be used by all lists
	OCA.Files.fileActions = new OCA.Files.FileActions();
})();


/*
 * Copyright (c) 2014
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

(function() {

	/**
	 * Construct a new FileActionsMenu instance
	 * @constructs FileActionsMenu
	 * @memberof OCA.Files
	 */
	var FileActionsMenu = OC.Backbone.View.extend({
		tagName: 'div',
		className: 'fileActionsMenu popovermenu bubble hidden open menu',

		/**
		 * Current context
		 *
		 * @type OCA.Files.FileActionContext
		 */
		_context: null,

		events: {
			'click a.action': '_onClickAction'
		},

		template: function(data) {
			return OCA.Files.Templates['fileactionsmenu'](data);
		},

		/**
		 * Event handler whenever an action has been clicked within the menu
		 *
		 * @param {Object} event event object
		 */
		_onClickAction: function(event) {
			var $target = $(event.target);
			if (!$target.is('a')) {
				$target = $target.closest('a');
			}
			var fileActions = this._context.fileActions;
			var actionName = $target.attr('data-action');
			var actions = fileActions.getActions(
				fileActions.getCurrentMimeType(),
				fileActions.getCurrentType(),
				fileActions.getCurrentPermissions(),
				fileActions.getCurrentFile()
			);
			var actionSpec = actions[actionName];
			var fileName = this._context.$file.attr('data-file');

			event.stopPropagation();
			event.preventDefault();

			OC.hideMenus();

			actionSpec.action(
				fileName,
				this._context
			);
		},

		/**
		 * Renders the menu with the currently set items
		 */
		render: function() {
			var self = this;
			var fileActions = this._context.fileActions;
			var actions = fileActions.getActions(
				fileActions.getCurrentMimeType(),
				fileActions.getCurrentType(),
				fileActions.getCurrentPermissions(),
				fileActions.getCurrentFile()
			);

			var defaultAction = fileActions.getCurrentDefaultFileAction();

			var items = _.filter(actions, function(actionSpec) {
				return !defaultAction || actionSpec.name !== defaultAction.name;
			});
			items = _.map(items, function(item) {
				if (_.isFunction(item.displayName)) {
					item = _.extend({}, item);
					item.displayName = item.displayName(self._context);
				}
				if (_.isFunction(item.iconClass)) {
					var fileName = self._context.$file.attr('data-file');
					item = _.extend({}, item);
					item.iconClass = item.iconClass(fileName, self._context);
				}
				if (_.isFunction(item.icon)) {
					var fileName = self._context.$file.attr('data-file');
					item = _.extend({}, item);
					item.icon = item.icon(fileName, self._context);
				}
				item.inline = item.type === OCA.Files.FileActions.TYPE_INLINE
				return item;
			});
			items = items.sort(function(actionA, actionB) {
				var orderA = actionA.order || 0;
				var orderB = actionB.order || 0;
				if (orderB === orderA) {
					return OC.Util.naturalSortCompare(actionA.displayName, actionB.displayName);
				}
				return orderA - orderB;
			});

			items = _.map(items, function(item) {
				item.nameLowerCase = item.name.toLowerCase();
				return item;
			});

			this.$el.html(this.template({
				items: items
			}));
		},

		/**
		 * Displays the menu under the given element
		 *
		 * @param {OCA.Files.FileActionContext} context context
		 * @param {Object} $trigger trigger element
		 */
		show: function(context) {
			this._context = context;

			this.render();
			this.$el.removeClass('hidden');

			OC.showMenu(null, this.$el);
		}
	});

	OCA.Files.FileActionsMenu = FileActionsMenu;

})();



/*
 * Copyright (c) 2015
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

(function(OC, OCA) {

	/**
	 * @class OC.Files.FileInfo
	 * @classdesc File information
	 *
	 * @param {Object} attributes file data
	 * @param {number} attributes.id file id
	 * @param {string} attributes.name file name
	 * @param {string} attributes.path path leading to the file,
	 * without the file name and with a leading slash
	 * @param {number} attributes.size size
	 * @param {string} attributes.mimetype mime type
	 * @param {string} attributes.icon icon URL
	 * @param {number} attributes.permissions permissions
	 * @param {Date} attributes.mtime modification time
	 * @param {string} attributes.etag etag
	 * @param {string} mountType mount type
	 *
	 * @since 8.2
	 */
	var FileInfoModel = OC.Backbone.Model.extend({

		defaults: {
			mimetype: 'application/octet-stream',
			path: ''
		},

		_filesClient: null,

		initialize: function(data, options) {
			if (!_.isUndefined(data.id)) {
				data.id = parseInt(data.id, 10);
			}

			if( options ){
				if (options.filesClient) {
					this._filesClient = options.filesClient;
				}
			}
		},

		/**
		 * Returns whether this file is a directory
		 *
		 * @return {boolean} true if this is a directory, false otherwise
		 */
		isDirectory: function() {
			return this.get('mimetype') === 'httpd/unix-directory';
		},

		/**
		 * Returns whether this file is an image
		 *
		 * @return {boolean} true if this is an image, false otherwise
		 */
		isImage: function() {
			if (!this.has('mimetype')) {
				return false;
			}
			return this.get('mimetype').substr(0, 6) === 'image/'
				|| this.get('mimetype') === 'application/postscript'
				|| this.get('mimetype') === 'application/illustrator'
				|| this.get('mimetype') === 'application/x-photoshop';
		},

		/**
		 * Returns the full path to this file
		 *
		 * @return {string} full path
		 */
		getFullPath: function() {
			return OC.joinPaths(this.get('path'), this.get('name'));
		},

		/**
		 * Returns the mimetype of the file
		 *
		 * @return {string} mimetype
		 */
		getMimeType: function() {
			return this.get('mimetype');
		},

		/**
		 * Reloads missing properties from server and set them in the model.
		 * @param properties array of properties to be reloaded
		 * @return ajax call object
		 */
		reloadProperties: function(properties) {
			if( !this._filesClient ){
				return;
			}

			var self = this;
			var deferred = $.Deferred();

			var targetPath = OC.joinPaths(this.get('path') + '/', this.get('name'));

			this._filesClient.getFileInfo(targetPath, {
					properties: properties
				})
				.then(function(status, data) {
					// the following lines should be extracted to a mapper

					if( properties.indexOf(OC.Files.Client.PROPERTY_GETCONTENTLENGTH) !== -1
					||  properties.indexOf(OC.Files.Client.PROPERTY_SIZE) !== -1 ) {
						self.set('size', data.size);
					}

					deferred.resolve(status, data);
				})
				.fail(function(status) {
					OC.Notification.show(t('files', 'Could not load info for file "{file}"', {file: self.get('name')}), {type: 'error'});
					deferred.reject(status);
				});

			return deferred.promise();
		},

		canDownload: function() {
			for (const i in this.attributes.shareAttributes) {
				const attr = this.attributes.shareAttributes[i]
				if (attr.scope === 'permissions' && attr.key === 'download') {
					return attr.enabled
				}
			}

			return true
		},
	});

	if (!OCA.Files) {
		OCA.Files = {};
	}
	OCA.Files.FileInfoModel = FileInfoModel;

})(OC, OCA);


/*
 * Copyright (c) 2014
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

(function() {

	/**
	 * @class OCA.Files.FileList
	 * @classdesc
	 *
	 * The FileList class manages a file list view.
	 * A file list view consists of a controls bar and
	 * a file list table.
	 *
	 * @param $el container element with existing markup for the .files-controls
	 * and a table
	 * @param {Object} [options] map of options, see other parameters
	 * @param {Object} [options.scrollContainer] scrollable container, defaults to $(window)
	 * @param {Object} [options.dragOptions] drag options, disabled by default
	 * @param {Object} [options.folderDropOptions] folder drop options, disabled by default
	 * @param {boolean} [options.detailsViewEnabled=true] whether to enable details view
	 * @param {boolean} [options.enableUpload=false] whether to enable uploader
	 * @param {OC.Files.Client} [options.filesClient] files client to use
	 */
	var FileList = function($el, options) {
		this.initialize($el, options);
	};
	/**
	 * @memberof OCA.Files
	 */
	FileList.prototype = {
		SORT_INDICATOR_ASC_CLASS: 'icon-triangle-n',
		SORT_INDICATOR_DESC_CLASS: 'icon-triangle-s',

		id: 'files',
		appName: t('files', 'Files'),
		isEmpty: true,
		useUndo:true,

		/**
		 * Top-level container with controls and file list
		 */
		$el: null,

		/**
		 * Files table
		 */
		$table: null,

		/**
		 * List of rows (table tbody)
		 */
		$fileList: null,

		$header: null,
		headers: [],

		$footer: null,
		footers: [],

		/**
		 * @type OCA.Files.BreadCrumb
		 */
		breadcrumb: null,

		/**
		 * @type OCA.Files.FileSummary
		 */
		fileSummary: null,

		/**
		 * @type OCA.Files.DetailsView
		 */
		_detailsView: null,

		/**
		 * Files client instance
		 *
		 * @type OC.Files.Client
		 */
		filesClient: null,

		/**
		 * Whether the file list was initialized already.
		 * @type boolean
		 */
		initialized: false,

		/**
		 * Wheater the file list was already shown once
		 * @type boolean
		 */
		shown: false,

		/**
		 * Number of files per page
		 * Always show a minimum of 1
		 *
		 * @return {number} page size
		 */
		pageSize: function() {
			var isGridView = this.$table.hasClass('view-grid');
			var columns = 1;
			var rows = Math.ceil(this.$container.height() / 50);
			if (isGridView) {
				columns = Math.ceil(this.$container.width() / 160);
				rows = Math.ceil(this.$container.height() / 160);
			}
			return Math.max(columns*rows, columns);
		},

		/**
		 * Array of files in the current folder.
		 * The entries are of file data.
		 *
		 * @type Array.<OC.Files.FileInfo>
		 */
		files: [],

		/**
		 * Current directory entry
		 *
		 * @type OC.Files.FileInfo
		 */
		dirInfo: null,

		/**
		 * Whether to prevent or to execute the default file actions when the
		 * file name is clicked.
		 *
		 * @type boolean
		 */
		_defaultFileActionsDisabled: false,

		/**
		 * File actions handler, defaults to OCA.Files.FileActions
		 * @type OCA.Files.FileActions
		 */
		fileActions: null,
		/**
		 * File selection menu, defaults to OCA.Files.FileSelectionMenu
		 * @type OCA.Files.FileSelectionMenu
		 */
		fileMultiSelectMenu: null,
		/**
		 * Whether selection is allowed, checkboxes and selection overlay will
		 * be rendered
		 */
		_allowSelection: true,

		/**
		 * Map of file id to file data
		 * @type Object.<int, Object>
		 */
		_selectedFiles: {},

		/**
		 * Summary of selected files.
		 * @type OCA.Files.FileSummary
		 */
		_selectionSummary: null,

		/**
		 * If not empty, only files containing this string will be shown
		 * @type String
		 */
		_filter: '',

		/**
		 * @type UserConfig
		 * @see /apps/files/lib/Service/UserConfig.php
		 */
		_filesConfig: undefined,

		/**
		 * Sort attribute
		 * @type String
		 */
		_sort: 'name',

		/**
		 * Sort direction: 'asc' or 'desc'
		 * @type String
		 */
		_sortDirection: 'asc',

		/**
		 * Sort comparator function for the current sort
		 * @type Function
		 */
		_sortComparator: null,

		/**
		 * Whether to do a client side sort.
		 * When false, clicking on a table header will call reload().
		 * When true, clicking on a table header will simply resort the list.
		 */
		_clientSideSort: true,

		/**
		 * Whether or not users can change the sort attribute or direction
		 */
		_allowSorting: true,

		/**
		 * Current directory
		 * @type String
		 */
		_currentDirectory: null,

		_dragOptions: null,
		_folderDropOptions: null,

		/**
		 * @type OC.Uploader
		 */
		_uploader: null,

		/**
		 * Initialize the file list and its components
		 *
		 * @param $el container element with existing markup for the .files-controls
		 * and a table
		 * @param options map of options, see other parameters
		 * @param options.scrollContainer scrollable container, defaults to $(window)
		 * @param options.dragOptions drag options, disabled by default
		 * @param options.folderDropOptions folder drop options, disabled by default
		 * @param options.scrollTo name of file to scroll to after the first load
		 * @param [options.dir='/'] current directory
		 * @param {OC.Files.Client} [options.filesClient] files API client
		 * @param {OC.Backbone.Model} [options.filesConfig] files app configuration
		 * @private
		 */
		initialize: function($el, options) {
			var self = this;
			options = options || {};
			if (this.initialized) {
				return;
			}

			if (options.shown) {
				this.shown = options.shown;
			}

			if (options.config) {
				this._filesConfig = options.config;
			} else if (!_.isUndefined(OCA.Files) && !_.isUndefined(OCA.Files.App)) {
				this._filesConfig = OCA.Files.App.getFilesConfig();
			} else {
				this._filesConfig = OCP.InitialState.loadState('files', 'config', {})
			}

			if (options.dragOptions) {
				this._dragOptions = options.dragOptions;
			}
			if (options.folderDropOptions) {
				this._folderDropOptions = options.folderDropOptions;
			}
			if (options.filesClient) {
				this.filesClient = options.filesClient;
			} else {
				// default client if not specified
				this.filesClient = OC.Files.getClient();
			}

			this.$el = $el;
			if (options.id) {
				this.id = options.id;
			}
			this.$container = options.scrollContainer || $('#app-content');
			this.$table = $el.find('table:first');
			this.$fileList = $el.find('.files-fileList');
			this.$header = $el.find('.filelist-header');
			this.$footer = $el.find('.filelist-footer');

			// Legacy mapper for new vue components
			window._nc_event_bus.subscribe('files:config:updated', ({ key, value }) => {
				// Replace existing config with new one
				Object.assign(this._filesConfig, { [key]: value })

				if (key === 'show_hidden') {
					self.$el.toggleClass('hide-hidden-files', !value);
					self.updateSelectionSummary();

					// hiding files could make the page too small, need to try rendering next page
					if (!value) {
						self._onScroll();
					}
				}
				if (key === 'crop_image_previews') {
					self.reload();
				}
			})

			var config = OCP.InitialState.loadState('files', 'config', {})
			if (config.show_hidden === false) {
				this.$el.addClass('hide-hidden-files');
			}

			if (_.isUndefined(options.detailsViewEnabled) || options.detailsViewEnabled) {
				this._detailsView = new OCA.Files.DetailsView();
				this._detailsView.$el.addClass('disappear');
			}

			if (options && options.defaultFileActionsDisabled) {
				this._defaultFileActionsDisabled = options.defaultFileActionsDisabled
			}

			this._initFileActions(options.fileActions);

			if (this._detailsView) {
				this._detailsView.addDetailView(new OCA.Files.MainFileInfoDetailView({fileList: this, fileActions: this.fileActions}));
			}

			this.files = [];
			this._selectedFiles = {};
			this._selectionSummary = new OCA.Files.FileSummary(undefined, {config: this._filesConfig});
			// dummy root dir info
			this.dirInfo = new OC.Files.FileInfo({});

			this.fileSummary = this._createSummary();

			if (options.multiSelectMenu) {
				this.multiSelectMenuItems = options.multiSelectMenu;
				for (var i=0; i<this.multiSelectMenuItems.length; i++) {
					if (_.isFunction(this.multiSelectMenuItems[i])) {
						this.multiSelectMenuItems[i] = this.multiSelectMenuItems[i](this);
					}
				}
				this._updateMultiSelectFileActions()
			}

			if (options.sorting) {
				this.setSort(options.sorting.mode, options.sorting.direction, false, false);
			} else {
				this.setSort('name', 'asc', false, false);
			}

			var breadcrumbOptions = {
				onClick: _.bind(this._onClickBreadCrumb, this),
				getCrumbUrl: function(part) {
					return self.linkTo(part.dir);
				}
			};
			// if dropping on folders is allowed, then also allow on breadcrumbs
			if (this._folderDropOptions) {
				breadcrumbOptions.onDrop = _.bind(this._onDropOnBreadCrumb, this);
				breadcrumbOptions.onOver = function() {
					self.$el.find('td.filename.ui-droppable').droppable('disable');
				};
				breadcrumbOptions.onOut = function() {
					self.$el.find('td.filename.ui-droppable').droppable('enable');
				};
			}
			this.breadcrumb = new OCA.Files.BreadCrumb(breadcrumbOptions);

			var $controls = this.$el.find('.files-controls');
			if ($controls.length > 0) {
				$controls.prepend(this.breadcrumb.$el);
				this.$table.addClass('has-controls');
			}

			this._renderNewButton();

			this.$el.find('thead th .columntitle').click(_.bind(this._onClickHeader, this));

			this._onResize = _.debounce(_.bind(this._onResize, this), 250);
			$('#app-content').on('appresized', this._onResize);
			$(window).resize(this._onResize);

			this.$el.on('show', this._onResize);

			// reload files list on share accept
			$('body').on('OCA.Notification.Action', function(eventObject) {
				if (eventObject.notification.app === 'files_sharing' && eventObject.action.type === 'POST') {
					self.reload()
				}
			});

			window._nc_event_bus.subscribe('files_sharing:share:created', () => { self.reload(true) });
			window._nc_event_bus.subscribe('files_sharing:share:deleted', () => { self.reload(true) });

			this.$fileList.on('click','td.filename>a.name, td.filesize, td.date', _.bind(this._onClickFile, this));

			this.$fileList.on("droppedOnFavorites", function (event, file) {
				self.fileActions.triggerAction('Favorite', self.getModelForFile(file), self);
			});

			this.$fileList.on('droppedOnTrash', function (event, filename, directory) {
				self.do_delete(filename, directory);
			});

			this.$fileList.on('change', 'td.selection>.selectCheckBox', _.bind(this._onClickFileCheckbox, this));
			this.$fileList.on('mouseover', 'td.selection', _.bind(this._onMouseOverCheckbox, this));
			this.$el.on('show', _.bind(this._onShow, this));
			this.$el.on('urlChanged', _.bind(this._onUrlChanged, this));
			this.$el.find('.select-all').click(_.bind(this._onClickSelectAll, this));
			this.$el.find('.actions-selected').click(function () {
				self.fileMultiSelectMenu.show(self);
				return false;
			});

			this.$container.on('scroll', _.bind(this._onScroll, this));

			if (options.scrollTo) {
				this.$fileList.one('updated', function() {
					self.scrollTo(options.scrollTo);
				});
			}

			if (!_.isUndefined(options.dir)) {
				this._setCurrentDir(options.dir || '/', false);
			}

			if (options.openFile) {
				// Wait for some initialisation process to be over before triggering the default action.
				_.defer(() => {
					try {
						var fileInfo = JSON.parse(atob($('#initial-state-files-openFileInfo').val()))
						var spec = this.fileActions.getDefaultFileAction(fileInfo.mime, fileInfo.type, fileInfo.permissions)
						if (spec && spec.action) {
							spec.action(fileInfo.name, {
								fileId: fileInfo.id,
								fileList: this,
								fileActions: this.fileActions,
								dir: fileInfo.directory
							});
						} else {
							var url = this.getDownloadUrl(fileInfo.name, fileInfo.dir, true);
							OCA.Files.Files.handleDownload(url);
						}

						if (document.documentElement.clientWidth > 1024) {
							OCA.Files.Sidebar.open(fileInfo.path);
						}
					} catch (error) {
						console.error(`Failed to trigger default action on the file for URL: ${location.href}`, error)
					}
				})
			}

			this._operationProgressBar = new OCA.Files.OperationProgressBar();
			this._operationProgressBar.render();
			this.$el.find('#uploadprogresswrapper').replaceWith(this._operationProgressBar.$el);

			if (options.enableUpload) {
				// TODO: auto-create this element
				var $uploadEl = this.$el.find('#file_upload_start');
				if ($uploadEl.exists()) {
					this._uploader = new OC.Uploader($uploadEl, {
						progressBar: this._operationProgressBar,
						fileList: this,
						filesClient: this.filesClient,
						dropZone: $('#content'),
						maxChunkSize: options.maxChunkSize
					});

					this.setupUploadEvents(this._uploader);
				}
			}
			this.triedActionOnce = false;

			OC.Plugins.attach('OCA.Files.FileList', this);

			OCA.Files.App && OCA.Files.App.updateCurrentFileList(this);

			this.initHeadersAndFooters()
		},

		initHeadersAndFooters: function() {
			this.headers.sort(function(a, b) {
				return a.order - b.order;
			})
			this.footers.sort(function(a, b) {
				return a.order - b.order;
			})
			var uniqueIds = [];
			var self = this;
			this.headers.forEach(function(header) {
				if (header.id) {
					if (uniqueIds.indexOf(header.id) !== -1) {
						return
					}
					uniqueIds.push(header.id)
				}
				self.$header.append(header.el)

				setTimeout(function() {
					header.render(self)
				}, 0)
			})

			uniqueIds = [];
			this.footers.forEach(function(footer) {
				if (footer.id) {
					if (uniqueIds.indexOf(footer.id) !== -1) {
						return
					}
					uniqueIds.push(footer.id)
				}
				self.$footer.append(footer.el)
				setTimeout(function() {
					footer.render(self)
				}, 0)
			})
		},

		/**
		 * Destroy / uninitialize this instance.
		 */
		destroy: function() {
			if (this._newFileMenu) {
				this._newFileMenu.remove();
			}
			if (this._newButton) {
				this._newButton.remove();
			}
			if (this._detailsView) {
				this._detailsView.remove();
			}
			// TODO: also unregister other event handlers
			this.fileActions.off('registerAction', this._onFileActionsUpdated);
			this.fileActions.off('setDefault', this._onFileActionsUpdated);
			OC.Plugins.detach('OCA.Files.FileList', this);
			$('#app-content').off('appresized', this._onResize);
		},

		_selectionMode: 'single',
		_getCurrentSelectionMode: function () {
			return this._selectionMode;
		},
		_onClickToggleSelectionMode: function () {
			this._selectionMode = (this._selectionMode === 'range') ? 'single' : 'range';
			if (this._selectionMode === 'single') {
				this._removeHalfSelection();
			}
		},

		multiSelectMenuClick: function (ev, action) {
				var actionFunction = _.find(this.multiSelectMenuItems, function (item) {return item.name === action;}).action;
				if (actionFunction) {
					actionFunction(this.getSelectedFiles());
					return;
				}
				switch (action) {
					case 'delete':
						this._onClickDeleteSelected(ev)
						break;
					case 'download':
						this._onClickDownloadSelected(ev);
						break;
					case 'copyMove':
						this._onClickCopyMoveSelected(ev);
						break;
					case 'restore':
						this._onClickRestoreSelected(ev);
						break;
					case 'tags':
						this._onClickTagSelected(ev);
						break;
				}
		},
		/**
		 * Initializes the file actions, set up listeners.
		 *
		 * @param {OCA.Files.FileActions} fileActions file actions
		 */
		_initFileActions: function(fileActions) {
			var self = this;
			this.fileActions = fileActions;
			if (!this.fileActions) {
				this.fileActions = new OCA.Files.FileActions();
				this.fileActions.registerDefaultActions();
			}

			if (this._detailsView) {
				this.fileActions.registerAction({
					name: 'Details',
					displayName: t('files', 'Details'),
					mime: 'all',
					order: -50,
					iconClass: 'icon-details',
					permissions: OC.PERMISSION_NONE,
					actionHandler: function(fileName, context) {
						self._updateDetailsView(fileName);
					}
				});
			}

			this._onFileActionsUpdated = _.debounce(_.bind(this._onFileActionsUpdated, this), 100);
			this.fileActions.on('registerAction', this._onFileActionsUpdated);
			this.fileActions.on('setDefault', this._onFileActionsUpdated);
		},

		/**
		 * Returns a unique model for the given file name.
		 *
		 * @param {string|object} fileName file name or jquery row
		 * @return {OCA.Files.FileInfoModel} file info model
		 */
		getModelForFile: function(fileName) {
			var self = this;
			var $tr;
			// jQuery object ?
			if (fileName.is) {
				$tr = fileName;
				fileName = $tr.attr('data-file');
			} else {
				$tr = this.findFileEl(fileName);
			}

			if (!$tr || !$tr.length) {
				return null;
			}

			// if requesting the selected model, return it
			if (this._currentFileModel && this._currentFileModel.get('name') === fileName) {
				return this._currentFileModel;
			}

			// TODO: note, this is a temporary model required for synchronising
			// state between different views.
			// In the future the FileList should work with Backbone.Collection
			// and contain existing models that can be used.
			// This method would in the future simply retrieve the matching model from the collection.
			var model = new OCA.Files.FileInfoModel(this.elementToFile($tr), {
				filesClient: this.filesClient
			});
			if (!model.get('path')) {
				model.set('path', this.getCurrentDirectory(), {silent: true});
			}

			model.on('change', function(model) {
				// re-render row
				var highlightState = $tr.hasClass('highlighted');
				$tr = self.updateRow(
					$tr,
					model.toJSON(),
					{updateSummary: true, silent: false, animate: true}
				);

				// restore selection state
				var selected = !!self._selectedFiles[$tr.data('id')];
				self._selectFileEl($tr, selected);

				$tr.toggleClass('highlighted', highlightState);
			});
			model.on('busy', function(model, state) {
				self.showFileBusyState($tr, state);
			});

			return model;
		},

		/**
		 * Displays the details view for the given file and
		 * selects the given tab
		 *
		 * @param {string|OCA.Files.FileInfoModel} fileName file name or FileInfoModel for which to show details
		 * @param {string} [tabId] optional tab id to select
		 */
		showDetailsView: function(fileName, tabId) {
			OC.debug && console.warn('showDetailsView is deprecated! Use OCA.Files.Sidebar.activeTab. It will be removed in nextcloud 20.');
			this._updateDetailsView(fileName);
			if (tabId) {
				OCA.Files.Sidebar.setActiveTab(tabId);
			}
		},

		/**
		 * Update the details view to display the given file
		 *
		 * @param {string|OCA.Files.FileInfoModel} fileName file name from the current list or a FileInfoModel object
		 * @param {boolean} [show=true] whether to open the sidebar if it was closed
		 */
		_updateDetailsView: function(fileName, show) {
			if (!(OCA.Files && OCA.Files.Sidebar)) {
				console.error('No sidebar available');
				return;
			}

			if (!fileName && OCA.Files.Sidebar.close) {
				OCA.Files.Sidebar.close()
				return
			} else if (typeof fileName !== 'string') {
				fileName = ''
			}

			// this is the old (terrible) way of getting the context.
			// don't use it anywhere else. Just provide the full path
			// of the file to the sidebar service
			var tr = this.findFileEl(fileName)
			var model = this.getModelForFile(tr)
			var path = model.attributes.path + '/' + model.attributes.name

			// make sure the file list has the correct context available
			if (this._currentFileModel) {
				this._currentFileModel.off();
			}
			this.$fileList.children().removeClass('highlighted');
			tr.addClass('highlighted');
			this._currentFileModel = model;

			// open sidebar and set file
			if (typeof show === 'undefined' || !!show || (OCA.Files.Sidebar.file !== '')) {
				OCA.Files.Sidebar.open(path.replace('//', '/'))
			}
		},

		/**
		 * Replaces the current details view element with the details view
		 * element of this file list.
		 *
		 * Each file list has its own DetailsView object, and each one has its
		 * own root element, but there can be just one details view/sidebar
		 * element in the document. This helper method replaces the current
		 * details view/sidebar element in the document with the element from
		 * the DetailsView object of this file list.
		 */
		_replaceDetailsViewElementIfNeeded: function() {
			var $appSidebar = $('#app-sidebar');
			if ($appSidebar.length === 0) {
				this._detailsView.$el.insertAfter($('#app-content'));
			} else if ($appSidebar[0] !== this._detailsView.el) {
				// "replaceWith()" can not be used here, as it removes the old
				// element instead of just detaching it.
				this._detailsView.$el.insertBefore($appSidebar);
				$appSidebar.detach();
			}
		},

		/**
		 * Event handler for when the window size changed
		 */
		_onResize: function() {
			var containerWidth = this.$el.width();
			var actionsWidth = 0;
			$.each(this.$el.find('.files-controls .actions'), function(index, action) {
				actionsWidth += $(action).outerWidth();
			});

			this.breadcrumb._resize();
		},

		setGridView: function(isGridView) {
			this.$table.toggleClass('view-grid', isGridView);
			if (isGridView) {
				// If switching into grid view from list view, too few files might be displayed
				// Try rendering the next page
				this._onScroll();
			}
		},

		/**
		 * Event handler when leaving previously hidden state
		 */
		_onShow: function(e) {
			OCA.Files.App && OCA.Files.App.updateCurrentFileList(this);
			if (e.itemId === this.id) {
				this._setCurrentDir('/', false);
			}
			// Only reload if we don't navigate to a different directory
			if (typeof e.dir === 'undefined' || e.dir === this.getCurrentDirectory()) {
				this.reload();
			}
		},

		/**
		 * Event handler for when the URL changed
		 */
		_onUrlChanged: function(e) {
			if (e && _.isString(e.dir)) {
				var currentDir = this.getCurrentDirectory();
				// this._currentDirectory is NULL when fileList is first initialised
				if(this._currentDirectory && currentDir === e.dir) {
					return;
				}
				this.changeDirectory(e.dir, true, true, undefined, true);
			}
		},

		/**
		 * Selected/deselects the given file element and updated
		 * the internal selection cache.
		 *
		 * @param {Object} $tr single file row element
		 * @param {boolean} state true to select, false to deselect
		 */
		_selectFileEl: function($tr, state) {
			var $checkbox = $tr.find('td.selection>.selectCheckBox');
			var oldData = !!this._selectedFiles[$tr.data('id')];
			var data;
			$checkbox.prop('checked', state);
			$tr.toggleClass('selected', state);
			// already selected ?
			if (state === oldData) {
				return;
			}
			data = this.elementToFile($tr);
			if (state) {
				this._selectedFiles[$tr.data('id')] = data;
				this._selectionSummary.add(data);
			}
			else {
				delete this._selectedFiles[$tr.data('id')];
				this._selectionSummary.remove(data);
			}
			if (this._detailsView && !this._detailsView.$el.hasClass('disappear')) {
				// hide sidebar
				this._updateDetailsView(null);
			}
			this.$el.find('.select-all').prop('checked', this._selectionSummary.getTotal() === this.files.length);
		},

		_selectRange: function($tr) {
			var checked = $tr.hasClass('selected');
			var $lastTr = $(this._lastChecked);
			var lastIndex = $lastTr.index();
			var currentIndex = $tr.index();
			var $rows = this.$fileList.children('tr');

			// last clicked checkbox below current one ?
			if (lastIndex > currentIndex) {
				var aux = lastIndex;
				lastIndex = currentIndex;
				currentIndex = aux;
			}

			// auto-select everything in-between
			for (var i = lastIndex; i <= currentIndex; i++) {
				this._selectFileEl($rows.eq(i), !checked);
			}
			this._removeHalfSelection();
			this._selectionMode = 'single';
		},

		_selectSingle: function($tr) {
			var state = !$tr.hasClass('selected');
			this._selectFileEl($tr, state);
		},

		_onMouseOverCheckbox: function(e) {
			if (this._getCurrentSelectionMode() !== 'range') {
				return;
			}
			var $currentTr = $(e.target).closest('tr');

			var $lastTr = $(this._lastChecked);
			var lastIndex = $lastTr.index();
			var currentIndex = $currentTr.index();
			var $rows = this.$fileList.children('tr');

			// last clicked checkbox below current one ?
			if (lastIndex > currentIndex) {
				var aux = lastIndex;
				lastIndex = currentIndex;
				currentIndex = aux;
			}

			// auto-select everything in-between
			this._removeHalfSelection();
			for (var i = 0; i <= $rows.length; i++) {
				var $tr = $rows.eq(i);
				var $checkbox = $tr.find('td.selection>.selectCheckBox');
				if(lastIndex <= i && i <= currentIndex) {
					$tr.addClass('halfselected');
					$checkbox.prop('checked', true);
				}
			}
		},

		_removeHalfSelection: function() {
			var $rows = this.$fileList.children('tr');
			for (var i = 0; i <= $rows.length; i++) {
				var $tr = $rows.eq(i);
				$tr.removeClass('halfselected');
				var $checkbox = $tr.find('td.selection>.selectCheckBox');
				$checkbox.prop('checked', !!this._selectedFiles[$tr.data('id')]);
			}
		},

		/**
		 * Event handler for when clicking on files to select them
		 */
		_onClickFile: function(event) {
			var $tr = $(event.target).closest('tr');
			if ($tr.hasClass('dragging')) {
				return;
			}
			if (this._allowSelection && event.shiftKey) {
				event.preventDefault();
				this._selectRange($tr);
				this._lastChecked = $tr;
				this.updateSelectionSummary();
			} else if (!event.ctrlKey) {
				// clicked directly on the name
				if (!this._detailsView || $(event.target).is('.nametext, .name, .thumbnail') || $(event.target).closest('.nametext').length) {
					var filename = $tr.attr('data-file');
					var renaming = $tr.data('renaming');
					if (this._defaultFileActionsDisabled) {
						event.preventDefault();
					} else if (!renaming) {
						this.fileActions.currentFile = $tr.find('td');
						var spec = this.fileActions.getCurrentDefaultFileAction();
						if (spec && spec.action) {
							event.preventDefault();
							spec.action(filename, {
								$file: $tr,
								fileList: this,
								fileActions: this.fileActions,
								dir: $tr.attr('data-path') || this.getCurrentDirectory()
							});
						}
						// deselect row
						$(event.target).closest('a').blur();
					}
				} else {
					// Even if there is no Details action the default event
					// handler is prevented for consistency (although there
					// should always be a Details action); otherwise the link
					// would be downloaded by the browser when the user expected
					// the details to be shown.
					event.preventDefault();
					var filename = $tr.attr('data-file');
					this.fileActions.currentFile = $tr.find('td');
					var mime = this.fileActions.getCurrentMimeType();
					var type = this.fileActions.getCurrentType();
					var permissions = this.fileActions.getCurrentPermissions();
					var action = this.fileActions.get(mime, type, permissions, filename)['Details'];
					if (action) {
						action(filename, {
							$file: $tr,
							fileList: this,
							fileActions: this.fileActions,
							dir: $tr.attr('data-path') || this.getCurrentDirectory()
						});
					}
				}
			}
		},

		/**
		 * Event handler for when clicking on a file's checkbox
		 */
		_onClickFileCheckbox: function(e) {
			var $tr = $(e.target).closest('tr');
			if(this._getCurrentSelectionMode() === 'range') {
				this._selectRange($tr);
			} else {
				this._selectSingle($tr);
			}
			this._lastChecked = $tr;
			this.updateSelectionSummary();
			if (this._detailsView && !this._detailsView.$el.hasClass('disappear')) {
				// hide sidebar
				this._updateDetailsView(null);
			}
		},

		/**
		 * Event handler for when selecting/deselecting all files
		 */
		_onClickSelectAll: function(e) {
			var hiddenFiles = this.$fileList.find('tr.hidden');
			var checked = e.target.checked;

			if (hiddenFiles.length > 0) {
				// set indeterminate alongside checked
				e.target.indeterminate = checked;
			} else {
				e.target.indeterminate = false
			}

			// Select only visible checkboxes to filter out unmatched file in search
			this.$fileList.find('td.selection > .selectCheckBox:visible').prop('checked', checked)
				.closest('tr').toggleClass('selected', checked);
			// For prevents the selection of encrypted folders when clicking on the "Select all" checkbox
			this.$fileList.find('tr[data-e2eencrypted="true"]').find('td.selection > .selectCheckBox:visible').prop('checked', false).closest('tr').toggleClass('selected', false);

			if (checked) {
				for (var i = 0; i < this.files.length; i++) {
					// a search will automatically hide the unwanted rows
					// let's only select the matches
					var fileData = this.files[i];
					var fileRow = this.$fileList.find('tr[data-id=' + fileData.id + ']');
					// do not select already selected ones
					if (!fileRow.hasClass('hidden') && _.isUndefined(this._selectedFiles[fileData.id]) && (!fileData.isEncrypted)) {
						this._selectedFiles[fileData.id] = fileData;
						this._selectionSummary.add(fileData);
					}
				}
			} else {
				// if we have some hidden row, then we're in a search
				// Let's only deselect the visible ones
				if (hiddenFiles.length > 0) {
					var visibleFiles = this.$fileList.find('tr:not(.hidden)');
					var self = this;
					visibleFiles.each(function() {
						var id = parseInt($(this).data('id'));
						// do not deselect already deselected ones
						if (!_.isUndefined(self._selectedFiles[id])) {
							// a search will automatically hide the unwanted rows
							// let's only select the matches
							var fileData = self._selectedFiles[id];
							delete self._selectedFiles[fileData.id];
							self._selectionSummary.remove(fileData);
						}
					});
				} else {
					this._selectedFiles = {};
					this._selectionSummary.clear();
				}
			}
			this.updateSelectionSummary();
			if (this._detailsView && !this._detailsView.$el.hasClass('disappear')) {
				// hide sidebar
				this._updateDetailsView(null);
			}
		},

		/**
		 * Event handler for when clicking on "Download" for the selected files
		 */
		_onClickDownloadSelected: function(event) {
			var files;
			var self = this;
			var dir = this.getCurrentDirectory();

			if (this.isAllSelected() && this.getSelectedFiles().length > 1) {
				files = OC.basename(dir);
				dir = OC.dirname(dir) || '/';
			}
			else {
				files = _.pluck(this.getSelectedFiles(), 'name');
			}

			// don't allow a second click on the download action
			if(this.fileMultiSelectMenu.isDisabled('download')) {
				return false;
			}

			this.fileMultiSelectMenu.toggleLoading('download', true);
			var disableLoadingState = function(){
				self.fileMultiSelectMenu.toggleLoading('download', false);
			};

			if(this.getSelectedFiles().length > 1) {
				OCA.Files.Files.handleDownload(this.getDownloadUrl(files, dir, true), disableLoadingState);
			}
			else {
				var first = this.getSelectedFiles()[0];
				OCA.Files.Files.handleDownload(this.getDownloadUrl(first.name, dir, true), disableLoadingState);
			}
			event.preventDefault();
		},

		/**
		 * Event handler for when clicking on "Move" for the selected files
		 */
		_onClickCopyMoveSelected: function(event) {
			var files;
			var self = this;

			files = _.pluck(this.getSelectedFiles(), 'name');

			// don't allow a second click on the download action
			if(this.fileMultiSelectMenu.isDisabled('copyMove')) {
				return false;
			}

			var disableLoadingState = function(){
				self.fileMultiSelectMenu.toggleLoading('copyMove', false);
			};

			var actions = this.isSelectedMovable() ? OC.dialogs.FILEPICKER_TYPE_COPY_MOVE : OC.dialogs.FILEPICKER_TYPE_COPY;
			var dialogDir = self.getCurrentDirectory();
			if (typeof self.dirInfo.dirLastCopiedTo !== 'undefined') {
				dialogDir = self.dirInfo.dirLastCopiedTo;
			}
			OC.dialogs.filepicker(t('files', 'Choose target folder'), function(targetPath, type) {
				self.fileMultiSelectMenu.toggleLoading('copyMove', true);
				if (type === OC.dialogs.FILEPICKER_TYPE_COPY) {
					self.copy(files, targetPath, disableLoadingState);
				}
				if (type === OC.dialogs.FILEPICKER_TYPE_MOVE) {
					self.move(files, targetPath, disableLoadingState);
				}
				self.dirInfo.dirLastCopiedTo = targetPath;
			}, false, "httpd/unix-directory", true, actions, dialogDir);
			event.preventDefault();
		},

		/**
		 * Event handler for when clicking on "Delete" for the selected files
		 */
		_onClickDeleteSelected: function(event) {
			var files = null;
			if (!this.isAllSelected()) {
				files = _.pluck(this.getSelectedFiles(), 'name');
			}
			this.do_delete(files);
			event.preventDefault();
		},

		/**
		 * CUSTOM CODE
		 * Event handler for when clicking on "Tags" for the selected files
		 */
		_onClickTagSelected: function(event) {
			var self = this;
			event.preventDefault();
			var commonTags = [];

			var selectedFiles = _.pluck(this.getSelectedFiles(), 'id')
			var tagCollections = [];
			var fetchTagPromises = [];


			selectedFiles.forEach(function(fileId) {
				var deferred = new $.Deferred();
				var tagCollection = new OC.SystemTags.SystemTagsMappingCollection([], {
					objectType: 'files',
					objectId: fileId});
				tagCollections.push(tagCollection);
				tagCollection.fetch({
					success: function(){
						deferred.resolve('success');
					},
					error: function() {
						deferred.resolve('failed');
					}
				})
				fetchTagPromises.push(deferred);
			});

			if (!self._inputView) {
				self._inputView = new OC.SystemTags.SystemTagsInputField({
					multiple: true,
					allowActions: true,
					allowCreate: true,
					isAdmin: OC.isUserAdmin(),
				});
				self._inputView.on('select', self._onSelectTag, self);
				self._inputView.on('deselect', self._onDeselectTag, self);
				self._inputView.render();

				// Build dom
				self.tagsTitle = $('<h3>'+ t('files', 'Please select tag(s) to add to the selection') +'</h3>');
				self.tagsSubmit = $('<button>' + t('files', 'Apply tag(s) to selection') + '</button>');
				self.tagsContainer = $('<tr id="tag_multiple_files_container"></tr>');
				self.tagsTitle.appendTo(self.tagsContainer)
				self.tagsContainer.append(self._inputView.el);
				self.tagsSubmit.appendTo(self.tagsContainer)

				// Inject everything
				self.$table.find('thead').append(self.tagsContainer);

				self.tagsSubmit.on('click', function(ev){
					self._onClickDocument(ev);
				});
			}

			self._inputView.$el.addClass('icon-loading');
			self.tagsContainer.show();

			Promise.all(fetchTagPromises).then(function() {
				//find tags which are common to all selected files
				commonTags =_.intersection.apply(null, tagCollections.map(function (tagCollection) {return tagCollection.getTagIds();}));
				self._inputView.setValues(commonTags);
				self._inputView.$el.removeClass('icon-loading');
				$(document).on('click',function(ev){
					self._onClickDocument(ev);
				});
			});
		},

		_onClickDocument: function(ev) {
			if(!$(ev.target).closest('#editor_container').length) {
				this._inputView.setValues([]);
				this.tagsContainer.hide();
				$(document).off('click', this._onClickDocument);
			}

		},

		/**
		 * Custom code
		 * Set tag for all selected files
		 * @param {any} tagModel -
		 * @private
		 */
		_onSelectTag: function(tagModel) {
			var selectedFiles = _.pluck(this.getSelectedFiles(),'id')
			if (!_.isArray(selectedFiles)) {
				return;
			}
			selectedFiles.forEach(function(fileId) {
				$.ajax({
					url: OC.linkToRemote('dav') + '/systemtags-relations/files/' + fileId + '/'+ tagModel.attributes.id,
					type: 'PUT',
				});
			});

		},
		/**
		 * remove tag from all selected files
		 * @param {any} tagId -
		 * @private
		 */
		_onDeselectTag: function(tagId) {
			var selectedFiles = _.pluck(this.getSelectedFiles(),'id');
			if (!_.isArray(selectedFiles)) {
				return;
			}
			selectedFiles.forEach(function(fileId) {
				$.ajax({
					url: OC.linkToRemote('dav') + '/systemtags-relations/files/' +fileId + '/'+ tagId,
					type: 'DELETE'
				});
			});
		},

		/**
		 * Event handler when clicking on a table header
		 */
		_onClickHeader: function(e) {
			if (this.$table.hasClass('multiselect')) {
				return;
			}
			var $target = $(e.target);
			var sort;
			if (!$target.is('a')) {
				$target = $target.closest('a');
			}
			sort = $target.attr('data-sort');
			if (sort && this._allowSorting) {
				if (this._sort === sort) {
					this.setSort(sort, (this._sortDirection === 'desc')?'asc':'desc', true, true);
				}
				else {
					if ( sort === 'name' ) {	//default sorting of name is opposite to size and mtime
						this.setSort(sort, 'asc', true, true);
					}
					else {
						this.setSort(sort, 'desc', true, true);
					}
				}
			}
		},

		/**
		 * Event handler when clicking on a bread crumb
		 */
		_onClickBreadCrumb: function(e) {
			// Select a crumb or a crumb in the menu
			var $el = $(e.target).closest('.crumb, .crumblist'),
				$targetDir = $el.data('dir');

			if ($targetDir !== undefined && e.which === 1) {
				e.preventDefault();
				this.changeDirectory($targetDir, true, true);
			}
		},

		/**
		 * Event handler for when scrolling the list container.
		 * This appends/renders the next page of entries when reaching the bottom.
		 */
		_onScroll: function(e) {
			if (this.$container.scrollTop() + this.$container.height() > this.$el.height() - 300) {
				this._nextPage(true);
			}
		},

		/**
		 * Event handler when dropping on a breadcrumb
		 */
		_onDropOnBreadCrumb: function( event, ui ) {
			var self = this;
			var $target = $(event.target);
			if (!$target.is('.crumb, .crumblist')) {
				$target = $target.closest('.crumb, .crumblist');
			}
			var targetPath = $(event.target).data('dir');
			var dir = this.getCurrentDirectory();
			while (dir.substr(0,1) === '/') {//remove extra leading /'s
				dir = dir.substr(1);
			}
			dir = '/' + dir;
			if (dir.substr(-1,1) !== '/') {
				dir = dir + '/';
			}
			// do nothing if dragged on current dir
			if (targetPath === dir || targetPath + '/' === dir) {
				return;
			}

			var files = this.getSelectedFiles();
			if (files.length === 0) {
				// single one selected without checkbox?
				files = _.map(ui.helper.find('tr'), function(el) {
					return self.elementToFile($(el));
				});
			}

			var movePromise = this.move(_.pluck(files, 'name'), targetPath);

			// re-enable td elements to be droppable
			// sometimes the filename drop handler is still called after re-enable,
			// it seems that waiting for a short time before re-enabling solves the problem
			setTimeout(function() {
				self.$el.find('td.filename.ui-droppable').droppable('enable');
			}, 10);

			return movePromise;
		},

		/**
		 * Sets a new page title
		 */
		setPageTitle: function(title){
			if (title) {
				title += ' - ';
			} else {
				title = '';
			}
			title += this.appName;
			// Sets the page title with the " - Nextcloud" suffix as in templates
			window.document.title = title + ' - ' + OC.theme.title;

			return true;
		},
		/**
		 * Returns the file info for the given file name from the internal collection.
		 *
		 * @param {string} fileName file name
		 * @return {OCA.Files.FileInfo} file info or null if it was not found
		 *
		 * @since 8.2
		 */
		findFile: function(fileName) {
			return _.find(this.files, function(aFile) {
				return (aFile.name === fileName);
			}) || null;
		},
		/**
		 * Returns the tr element for a given file name, but only if it was already rendered.
		 *
		 * @param {string} fileName file name
		 * @return {Object} jQuery object of the matching row
		 */
		findFileEl: function(fileName){
			// use filterAttr to avoid escaping issues
			return this.$fileList.find('tr').filterAttr('data-file', fileName);
		},

		/**
		 * Returns the file data from a given file element.
		 * @param $el file tr element
		 * @return file data
		 */
		elementToFile: function($el){
			$el = $($el);
			var data = {
				id: parseInt($el.attr('data-id'), 10),
				name: $el.attr('data-file'),
				mimetype: $el.attr('data-mime'),
				mtime: parseInt($el.attr('data-mtime'), 10),
				type: $el.attr('data-type'),
				etag: $el.attr('data-etag'),
				quotaAvailableBytes: $el.attr('data-quota'),
				permissions: parseInt($el.attr('data-permissions'), 10),
				hasPreview: $el.attr('data-has-preview') === 'true',
				isEncrypted: $el.attr('data-e2eencrypted') === 'true'
			};
			var size = $el.attr('data-size');
			if (size) {
				data.size = parseInt(size, 10);
			}
			var icon = $el.attr('data-icon');
			if (icon) {
				data.icon = icon;
			}
			var mountType = $el.attr('data-mounttype');
			if (mountType) {
				data.mountType = mountType;
			}
			var path = $el.attr('data-path');
			if (path) {
				data.path = path;
			}
			return data;
		},

		/**
		 * Appends the next page of files into the table
		 * @param animate true to animate the new elements
		 * @return array of DOM elements of the newly added files
		 */
		_nextPage: function(animate) {
			var index = this.$fileList.children().length,
				count = this.pageSize(),
				hidden,
				tr,
				fileData,
				newTrs = [],
				isAllSelected = this.isAllSelected(),
				showHidden = this._filesConfig.show_hidden;

			if (index >= this.files.length) {
				return false;
			}

			while (count > 0 && index < this.files.length) {
				fileData = this.files[index];
				if (this._filter) {
					hidden = fileData.name.toLowerCase().indexOf(this._filter.toLowerCase()) === -1;
				} else {
					hidden = false;
				}
				tr = this._renderRow(fileData, {updateSummary: false, silent: true, hidden: hidden});
				this.$fileList.append(tr);
				if (isAllSelected || this._selectedFiles[fileData.id]) {
					tr.addClass('selected');
					tr.find('.selectCheckBox').prop('checked', true);
				}
				if (tr.attr('data-e2eencrypted') === 'true') {
    					tr.toggleClass('selected', false);
    					tr.find('td.selection > .selectCheckBox:visible').prop('checked', false);
				}
				if (animate) {
					tr.addClass('appear transparent');
				}
				newTrs.push(tr);
				index++;
				// only count visible rows
				if (showHidden || !tr.hasClass('hidden-file')) {
					count--;
				}
			}

			// trigger event for newly added rows
			if (newTrs.length > 0) {
				this.$fileList.trigger($.Event('fileActionsReady', {fileList: this, $files: newTrs}));
			}

			if (animate) {
				// defer, for animation
				window.setTimeout(function() {
					for (var i = 0; i < newTrs.length; i++ ) {
						newTrs[i].removeClass('transparent');
					}
				}, 0);
			}

			return newTrs;
		},

		/**
		 * Event handler for when file actions were updated.
		 * This will refresh the file actions on the list.
		 */
		_onFileActionsUpdated: function() {
			var self = this;
			var $files = this.$fileList.find('tr');
			if (!$files.length) {
				return;
			}

			$files.each(function() {
				self.fileActions.display($(this).find('td.filename'), false, self);
			});
			this.$fileList.trigger($.Event('fileActionsReady', {fileList: this, $files: $files}));

		},

		/**
		 * Register action for multiple selected files
		 *
		 * @param {OCA.Files.FileAction} fileAction object
		 * The callback of FileAction will be called with an array of files that are currently selected
		 */
		registerMultiSelectFileAction: function(fileAction) {
			if (typeof this.multiSelectMenuItems === 'undefined') {
				return;
			}
			this.multiSelectMenuItems.push(fileAction)
			this._updateMultiSelectFileActions()
		},

		_updateMultiSelectFileActions: function() {
			if (typeof this.multiSelectMenuItems === 'undefined') {
				return;
			}
			this.fileMultiSelectMenu = new OCA.Files.FileMultiSelectMenu(this.multiSelectMenuItems.sort(function(a, b) {
				return a.order - b.order
			}));
			this.fileMultiSelectMenu.render();
			this.$el.find('.selectedActions .filesSelectMenu').remove();
			this.$el.find('.selectedActions').append(this.fileMultiSelectMenu.$el);
		},

		/**
		 * Sets the files to be displayed in the list.
		 * This operation will re-render the list and update the summary.
		 * @param filesArray array of file data (map)
		 */
		setFiles: function(filesArray) {
			var self = this;

			// detach to make adding multiple rows faster
			this.files = filesArray;

			this.$fileList.empty();

			if (this._allowSelection) {
				// The results table, which has no selection column, checks
				// whether the main table has a selection column or not in order
				// to align its contents with those of the main table.
				this.$el.addClass('has-selection');
			}

			// clear "Select all" checkbox
			this.$el.find('.select-all').prop('checked', false);

			// Save full files list while rendering

			this.isEmpty = this.files.length === 0;
			this._nextPage();

			this.updateEmptyContent();

			this.fileSummary.calculate(this.files);

			this._selectedFiles = {};
			this._selectionSummary.clear();
			this.updateSelectionSummary();
			$(window).scrollTop(0);

			this.$fileList.trigger(jQuery.Event('updated'));
			_.defer(function() {
				self.$el.closest('#app-content').trigger(jQuery.Event('apprendered'));
			});
		},

		/**
		 * Returns whether the given file info must be hidden
		 *
		 * @param {OC.Files.FileInfo} fileInfo file info
		 *
		 * @return {boolean} true if the file is a hidden file, false otherwise
		 */
		_isHiddenFile: function(file) {
			return file.name && file.name.charAt(0) === '.';
		},

		/**
		 * Returns the icon URL matching the given file info
		 *
		 * @param {OC.Files.FileInfo} fileInfo file info
		 *
		 * @return {string} icon URL
		 */
		_getIconUrl: function(fileInfo) {
			var mimeType = fileInfo.mimetype || 'application/octet-stream';
			if (mimeType === 'httpd/unix-directory') {
				// use default folder icon
				if (fileInfo.mountType === 'shared' || fileInfo.mountType === 'shared-root') {
					return OC.MimeType.getIconUrl('dir-shared');
				} else if (fileInfo.mountType === 'external-root') {
					return OC.MimeType.getIconUrl('dir-external');
				} else if (fileInfo.mountType !== undefined && fileInfo.mountType !== '') {
					return OC.MimeType.getIconUrl('dir-' + fileInfo.mountType);
				} else if (fileInfo.shareTypes && (
					fileInfo.shareTypes.indexOf(OC.Share.SHARE_TYPE_LINK) > -1
					|| fileInfo.shareTypes.indexOf(OC.Share.SHARE_TYPE_EMAIL) > -1)
				) {
					return OC.MimeType.getIconUrl('dir-public')
				} else if (fileInfo.shareTypes && fileInfo.shareTypes.length > 0) {
					return OC.MimeType.getIconUrl('dir-shared')
				}
				return OC.MimeType.getIconUrl('dir');
			}
			return OC.MimeType.getIconUrl(mimeType);
		},

		/**
		 * Creates a new table row element using the given file data.
		 * @param {OC.Files.FileInfo} fileData file info attributes
		 * @param options map of attributes
		 * @return new tr element (not appended to the table)
		 */
		_createRow: function(fileData, options) {
			var td, simpleSize, basename, extension, sizeColor,
				icon = fileData.icon || this._getIconUrl(fileData),
				name = fileData.name,
				// TODO: get rid of type, only use mime type
				type = fileData.type || 'file',
				mtime = parseInt(fileData.mtime, 10),
				mime = fileData.mimetype,
				path = fileData.path,
				dataIcon = null,
				linkUrl;
			options = options || {};

			if (isNaN(mtime)) {
				mtime = new Date().getTime();
			}

			if (type === 'dir') {
				mime = mime || 'httpd/unix-directory';

				if (fileData.isEncrypted) {
					icon = OC.MimeType.getIconUrl('dir-encrypted');
					dataIcon = icon;
				} else if (fileData.mountType && fileData.mountType.indexOf('external') === 0) {
					icon = OC.MimeType.getIconUrl('dir-external');
					dataIcon = icon;
				}
			}

			var permissions = fileData.permissions;
			if (permissions === undefined || permissions === null) {
				permissions = this.getDirectoryPermissions();
			}

			//containing tr
			var tr = $('<tr></tr>').attr({
				"data-id" : fileData.id,
				"data-type": type,
				"data-size": fileData.size,
				"data-file": name,
				"data-mime": mime,
				"data-mtime": mtime,
				"data-etag": fileData.etag,
				"data-quota": fileData.quotaAvailableBytes,
				"data-permissions": permissions,
				"data-has-preview": fileData.hasPreview !== false,
				"data-e2eencrypted": fileData.isEncrypted === true
			});

			if (dataIcon) {
				// icon override
				tr.attr('data-icon', dataIcon);
			}

			if (fileData.mountType) {
				// dirInfo (parent) only exist for the "real" file list
				if (this.dirInfo.id) {
					// FIXME: HACK: detect shared-root
					if (fileData.mountType === 'shared' && this.dirInfo.mountType !== 'shared' && this.dirInfo.mountType !== 'shared-root') {
						// if parent folder isn't share, assume the displayed folder is a share root
						fileData.mountType = 'shared-root';
					} else if (fileData.mountType === 'external' && this.dirInfo.mountType !== 'external' && this.dirInfo.mountType !== 'external-root') {
						// if parent folder isn't external, assume the displayed folder is the external storage root
						fileData.mountType = 'external-root';
					}
				}
				tr.attr('data-mounttype', fileData.mountType);
			}

			if (!_.isUndefined(path)) {
				tr.attr('data-path', path);
			}
			else {
				path = this.getCurrentDirectory();
			}

			// selection td
			if (this._allowSelection) {
				td = $('<td class="selection"></td>');

				td.append(
					'<input id="select-' + this.id + '-' + fileData.id +
					'" type="checkbox" class="selectCheckBox checkbox" aria-describedby="innernametext_' + fileData.id + '" /><label for="select-' + this.id + '-' + fileData.id + '">' +
					'<span class="hidden-visually">' + (fileData.type === 'dir' ?
						t('files', 'Select directory "{dirName}"', {dirName: name}) :
						t('files', 'Select file "{fileName}"', {fileName: name})) + '</span>' +
					'</label>'
				);

				tr.append(td);
			}

			// filename td
			td = $('<td class="filename"></td>');


			var spec = this.fileActions.getDefaultFileAction(mime, type, permissions);
			// linkUrl
			if (mime === 'httpd/unix-directory') {
				linkUrl = this.linkTo(path + '/' + name);
			}
			else if (spec && spec.action) {
				linkUrl = this.getDefaultActionUrl(path, fileData.id);
			}
			else {
				linkUrl = this.getDownloadUrl(name, path, type === 'dir');
			}
			var linkElem = $('<a></a>').attr({
				"class": "name",
				"href": linkUrl
			});
			if (this._defaultFileActionsDisabled) {
				linkElem.addClass('disabled');
			}

			linkElem.append('<div class="thumbnail-wrapper"><div class="thumbnail" style="background-image:url(' + icon + ');"></div></div>');

			// from here work on the display name
			name = fileData.displayName || name;

			// show hidden files (starting with a dot) completely in gray
			if(name.indexOf('.') === 0) {
				basename = '';
				extension = name;
			// split extension from filename for non dirs
			} else if (mime !== 'httpd/unix-directory' && name.indexOf('.') !== -1) {
				basename = name.substr(0, name.lastIndexOf('.'));
				extension = name.substr(name.lastIndexOf('.'));
			} else {
				basename = name;
				extension = false;
			}
			var nameSpan=$('<span></span>').addClass('nametext')

			var innernameSpan = $('<span></span>').addClass('innernametext').text(basename).prop('title', basename).prop('id', `innernametext_${fileData.id}`);


			var conflictingItems = this.$fileList.find('tr[data-file="' + this._jqSelEscape(name) + '"]');
			if (conflictingItems.length !== 0) {
				if (conflictingItems.length === 1) {
					// Update the path on the first conflicting item
					var $firstConflict = $(conflictingItems[0]),
						firstConflictPath = $firstConflict.attr('data-path') + '/';
					if (firstConflictPath.charAt(0) === '/') {
						firstConflictPath = firstConflictPath.substr(1);
					}
					if (firstConflictPath && firstConflictPath !== '/') {
						$firstConflict.find('td.filename span.innernametext').prepend($('<span></span>').addClass('conflict-path').text(firstConflictPath));
					}
				}

				var conflictPath = path + '/';
				if (conflictPath.charAt(0) === '/') {
					conflictPath = conflictPath.substr(1);
				}
				if (path && path !== '/') {
					nameSpan.append($('<span></span>').addClass('conflict-path').text(conflictPath));
				}
			}

			nameSpan.append(innernameSpan);
			linkElem.append(nameSpan);
			if (extension) {
				nameSpan.append($('<span></span>').addClass('extension').text(extension));
			}
			if (fileData.extraData) {
				if (fileData.extraData.charAt(0) === '/') {
					fileData.extraData = fileData.extraData.substr(1);
				}
				nameSpan.addClass('extra-data').attr('title', fileData.extraData);
			}
			// dirs can show the number of uploaded files
			if (mime === 'httpd/unix-directory') {
				linkElem.append($('<span></span>').attr({
					'class': 'uploadtext',
					'currentUploads': 0
				}));
			}
			td.append(linkElem);
			tr.append(td);

			const enabledThemes = window.OCA?.Theming?.enabledThemes || []
			// Check enabled themes, if system default is selected check the browser
			const isDarkTheme = (enabledThemes.length === 0 || enabledThemes[0] === 'default')
				? window.matchMedia('(prefers-color-scheme: dark)').matches
				: enabledThemes.join('').indexOf('dark') !== -1

			try {
				var maxContrastHex = window.getComputedStyle(document.documentElement)
					.getPropertyValue('--color-text-maxcontrast').trim()
				if (maxContrastHex.length < 4) {
					throw Error();
				}
				var maxContrast = parseInt(maxContrastHex.substring(1, 3), 16)
			} catch(error) {
				var maxContrast = isDarkTheme ? 130 : 118
			}

			// size column
			if (typeof(fileData.size) !== 'undefined' && fileData.size >= 0) {
				simpleSize = OC.Util.humanFileSize(parseInt(fileData.size, 10), true);
				// rgb(118, 118, 118) / #767676
				// min. color contrast for normal text on white background according to WCAG AA
				sizeColor = Math.round(118-Math.pow((fileData.size/(1024*1024)), 2));

				// ensure that the brightest color is still readable
				// min. color contrast for normal text on white background according to WCAG AA
				if (sizeColor >= maxContrast) {
					sizeColor = maxContrast;
				}

				if (isDarkTheme) {
					sizeColor = Math.abs(sizeColor);
					// ensure that the dimmest color is still readable
					// min. color contrast for normal text on black background according to WCAG AA
					if (sizeColor < maxContrast) {
						sizeColor = maxContrast;
					}
				}
			} else {
				simpleSize = t('files', 'Pending');
			}

			td = $('<td></td>').attr({
				"class": "filesize",
				"style": 'color:rgb(' + sizeColor + ',' + sizeColor + ',' + sizeColor + ')'
			}).text(simpleSize);
			tr.append(td);

			// date column (1000 milliseconds to seconds, 60 seconds, 60 minutes, 24 hours)
			// difference in days multiplied by 5 - brightest shade for files older than 32 days (160/5)
			var modifiedColor = Math.round(((new Date()).getTime() - mtime )/1000/60/60/24*5 );

			// ensure that the brightest color is still readable
			// min. color contrast for normal text on white background according to WCAG AA
			if (modifiedColor >= maxContrast) {
				modifiedColor = maxContrast;
			}

			if (isDarkTheme) {
				modifiedColor = Math.abs(modifiedColor);

				// ensure that the dimmest color is still readable
				// min. color contrast for normal text on black background according to WCAG AA
				if (modifiedColor < maxContrast) {
					modifiedColor = maxContrast;
				}
			}

			var formatted;
			var text;
			if (mtime > 0) {
				formatted = OC.Util.formatDate(mtime);
				text = OC.Util.relativeModifiedDate(mtime);
			} else {
				formatted = t('files', 'Unable to determine date');
				text = '?';
			}
			td = $('<td></td>').attr({ "class": "date" });
			td.append($('<span></span>').attr({
				"class": "modified live-relative-timestamp",
				"title": formatted,
				"data-timestamp": mtime,
				"style": 'color:rgb('+modifiedColor+','+modifiedColor+','+modifiedColor+')'
			}).text(text));
			tr.find('.filesize').text(simpleSize);
			tr.append(td);
			return tr;
		},

		/* escape a selector expression for jQuery */
		_jqSelEscape: function (expression) {
			if (expression) {
				return expression.replace(/[!"#$%&'()*+,.\/:;<=>?@\[\\\]^`{|}~]/g, '\\$&');
			}
			return null;
		},

		/**
		 * Adds an entry to the files array and also into the DOM
		 * in a sorted manner.
		 *
		 * @param {OC.Files.FileInfo} fileData map of file attributes
		 * @param {Object} [options] map of attributes
		 * @param {boolean} [options.updateSummary] true to update the summary
		 * after adding (default), false otherwise. Defaults to true.
		 * @param {boolean} [options.silent] true to prevent firing events like "fileActionsReady",
		 * defaults to false.
		 * @param {boolean} [options.animate] true to animate the thumbnail image after load
		 * defaults to true.
		 * @return new tr element (not appended to the table)
		 */
		add: function(fileData, options) {
			var self = this;
			var index;
			var $tr;
			var $rows;
			var $insertionPoint;
			options = _.extend({animate: true}, options || {});

			// there are three situations to cover:
			// 1) insertion point is visible on the current page
			// 2) insertion point is on a not visible page (visible after scrolling)
			// 3) insertion point is at the end of the list

			$rows = this.$fileList.children();
			index = this._findInsertionIndex(fileData);
			if (index > this.files.length) {
				index = this.files.length;
			}
			else {
				$insertionPoint = $rows.eq(index);
			}

			// is the insertion point visible ?
			if ($insertionPoint.length) {
				// only render if it will really be inserted
				$tr = this._renderRow(fileData, options);
				$insertionPoint.before($tr);
			}
			else {
				// if insertion point is after the last visible
				// entry, append
				if (index === $rows.length) {
					$tr = this._renderRow(fileData, options);
					this.$fileList.append($tr);
				}
			}

			this.isEmpty = false;
			this.files.splice(index, 0, fileData);

			if ($tr && options.animate) {
				$tr.addClass('appear transparent');
				window.setTimeout(function() {
					$tr.removeClass('transparent');
					self.$fileList.find('tr').removeClass('mouseOver');
					$tr.addClass('mouseOver');
				});
			}

			if (options.scrollTo) {
				this.scrollTo(fileData.name);
			}

			// defaults to true if not defined
			if (typeof(options.updateSummary) === 'undefined' || !!options.updateSummary) {
				this.fileSummary.add(fileData, true);
				this.updateEmptyContent();
			}

			return $tr;
		},

		/**
		 * Creates a new row element based on the given attributes
		 * and returns it.
		 *
		 * @param {OC.Files.FileInfo} fileData map of file attributes
		 * @param {Object} [options] map of attributes
		 * @param {number} [options.index] index at which to insert the element
		 * @param {boolean} [options.updateSummary] true to update the summary
		 * after adding (default), false otherwise. Defaults to true.
		 * @param {boolean} [options.animate] true to animate the thumbnail image after load
		 * defaults to true.
		 * @return new tr element (not appended to the table)
		 */
		_renderRow: function(fileData, options) {
			options = options || {};
			var type = fileData.type || 'file',
				mime = fileData.mimetype,
				path = fileData.path || this.getCurrentDirectory(),
				permissions = parseInt(fileData.permissions, 10) || 0;

			var isEndToEndEncrypted = (type === 'dir' && fileData.isEncrypted);

			if (!isEndToEndEncrypted && fileData.isShareMountPoint) {
				permissions = permissions | OC.PERMISSION_UPDATE;
			}

			if (type === 'dir') {
				mime = mime || 'httpd/unix-directory';
			}
			var tr = this._createRow(
				fileData,
				options
			);
			var filenameTd = tr.find('td.filename');

			// TODO: move dragging to FileActions ?
			// enable drag only for deletable files
			if (this._dragOptions && permissions & OC.PERMISSION_DELETE) {
				filenameTd.draggable(this._dragOptions);
			}
			// allow dropping on folders
			if (this._folderDropOptions && mime === 'httpd/unix-directory') {
				tr.droppable(this._folderDropOptions);
			}

			if (options.hidden) {
				tr.addClass('hidden');
			}

			if (this._isHiddenFile(fileData)) {
				tr.addClass('hidden-file');
			}

			// display actions
			this.fileActions.display(filenameTd, !options.silent, this);

			if (mime !== 'httpd/unix-directory' && fileData.hasPreview !== false) {
				var iconDiv = filenameTd.find('.thumbnail');
				// lazy load / newly inserted td ?
				// the typeof check ensures that the default value of animate is true
				if (typeof(options.animate) === 'undefined' || !!options.animate) {
					this.lazyLoadPreview({
						fileId: fileData.id,
						path: path + '/' + fileData.name,
						mime: mime,
						etag: fileData.etag,
						callback: function(url) {
							iconDiv.css('background-image', 'url("' + url + '")');
						}
					});
				}
				else {
					// set the preview URL directly
					var urlSpec = {
							file: path + '/' + fileData.name,
							c: fileData.etag
						};
					var previewUrl = this.generatePreviewUrl(urlSpec);
					previewUrl = previewUrl.replace(/\(/g, '%28').replace(/\)/g, '%29');
					iconDiv.css('background-image', 'url("' + previewUrl + '")');
				}
			}
			return tr;
		},
		/**
		 * Returns the current directory
		 * @method getCurrentDirectory
		 * @return current directory
		 */
		getCurrentDirectory: function(){
			return this._currentDirectory || '/';
		},
		/**
		 * Returns the directory permissions
		 * @return permission value as integer
		 */
		getDirectoryPermissions: function() {
			return this && this.dirInfo && this.dirInfo.permissions ? this.dirInfo.permissions : parseInt(this.$el.find('#permissions').val(), 10);
		},
		/**
		 * Changes the current directory and reload the file list.
		 * @param {string} targetDir target directory (non URL encoded)
		 * @param {boolean} [changeUrl=true] if the URL must not be changed (defaults to true)
		 * @param {boolean} [force=false] set to true to force changing directory
		 * @param {string} [fileId] optional file id, if known, to be appended in the URL
		 * @param {bool} [changedThroughUrl=false] true if the dir was set through a URL change
		 */
		changeDirectory: function(targetDir, changeUrl, force, fileId, changedThroughUrl) {
			var self = this;
			var currentDir = this.getCurrentDirectory();
			targetDir = targetDir || '/';
			if (!force && currentDir === targetDir) {
				return;
			}
			this._setCurrentDir(targetDir, changeUrl, fileId, changedThroughUrl);

			// discard finished uploads list, we'll get it through a regular reload
			this._uploads = {};
			return this.reload().then(function(success){
				if (!success) {
					self.changeDirectory(currentDir, true);
				}
			});
		},
		linkTo: function(dir) {
			return OC.linkTo('files', 'index.php')+"?dir="+ encodeURIComponent(dir).replace(/%2F/g, '/');
		},

		/**
		 * @param {string} path
		 * @returns {boolean}
		 */
		_isValidPath: function(path) {
			var sections = path.split('/');
			for (var i = 0; i < sections.length; i++) {
				if (sections[i] === '..') {
					return false;
				}
			}

			return path.toLowerCase().indexOf(decodeURI('%0a')) === -1 &&
				path.toLowerCase().indexOf(decodeURI('%00')) === -1;
		},

		/**
		 * Sets the current directory name and updates the breadcrumb.
		 * @param targetDir directory to display
		 * @param changeUrl true to also update the URL, false otherwise (default)
		 * @param {string} [fileId] file id
		 * @param {bool} changedThroughUrl true if the dir was set through a URL change
		 */
		_setCurrentDir: function(targetDir, changeUrl, fileId, changedThroughUrl) {
			targetDir = targetDir.replace(/\\/g, '/');
			if (!this._isValidPath(targetDir)) {
				targetDir = '/';
				changeUrl = true;
			}
			var previousDir = this.getCurrentDirectory(),
				baseDir = OC.basename(targetDir);

			if (baseDir !== '') {
				this.setPageTitle(baseDir);
			}
			else {
				this.setPageTitle();
			}

			if (targetDir.length > 0 && targetDir[0] !== '/') {
				targetDir = '/' + targetDir;
			}
			this._currentDirectory = targetDir;

			if (changeUrl !== false) {
				var params = {
					dir: targetDir,
					previousDir: previousDir
				};
				if (fileId) {
					params.fileId = fileId;
				}
				params.changedThroughUrl = changedThroughUrl
				this.$el.trigger(jQuery.Event('changeDirectory', params));
			}
			this.breadcrumb.setDirectory(this.getCurrentDirectory());
		},
		/**
		 * Sets the current sorting and refreshes the list
		 *
		 * @param sort sort attribute name
		 * @param direction sort direction, one of "asc" or "desc"
		 * @param update true to update the list, false otherwise (default)
		 * @param persist true to save changes in the database (default)
		 */
		setSort: function(sort, direction, update, persist) {
			var comparator = FileList.Comparators[sort] || FileList.Comparators.name;
			this._sort = sort;
			this._sortDirection = (direction === 'desc')?'desc':'asc';
			this._sortComparator = function(fileInfo1, fileInfo2) {
				var isFavorite = function(fileInfo) {
					return fileInfo.tags && fileInfo.tags.indexOf(OC.TAG_FAVORITE) >= 0;
				};

				if (isFavorite(fileInfo1) && !isFavorite(fileInfo2)) {
					return -1;
				} else if (!isFavorite(fileInfo1) && isFavorite(fileInfo2)) {
					return 1;
				}

				return direction === 'asc' ? comparator(fileInfo1, fileInfo2) : -comparator(fileInfo1, fileInfo2);
			};

			this.$el.find('thead th .sort-indicator')
				.removeClass(this.SORT_INDICATOR_ASC_CLASS)
				.removeClass(this.SORT_INDICATOR_DESC_CLASS)
				.toggleClass('hidden', true)
				.addClass(this.SORT_INDICATOR_DESC_CLASS);

			this.$el.find('thead th.column-' + sort + ' .sort-indicator')
				.removeClass(this.SORT_INDICATOR_ASC_CLASS)
				.removeClass(this.SORT_INDICATOR_DESC_CLASS)
				.toggleClass('hidden', false)
				.addClass(direction === 'desc' ? this.SORT_INDICATOR_DESC_CLASS : this.SORT_INDICATOR_ASC_CLASS);
			if (update) {
				if (this._clientSideSort) {
					this.files.sort(this._sortComparator);
					this.setFiles(this.files);
				}
				else {
					this.reload();
				}
			}

			if (persist && OC.getCurrentUser().uid) {
				$.post(OC.generateUrl('/apps/files/api/v1/sorting'), {
					// Compatibility with new files-to-vue API
					mode: sort === 'name' ? 'basename' : sort,
					direction: direction,
					view: 'files'
				});
			}
		},

		/**
		 * Returns list of webdav properties to request
		 */
		_getWebdavProperties: function() {
			return [].concat(this.filesClient.getPropfindProperties());
		},

		/**
		 * Reloads the file list using ajax call
		 *
		 * @return ajax call object
		 */
		reload: function(keepOpen) {
			this._selectedFiles = {};
			this._selectionSummary.clear();
			if (this._currentFileModel) {
				this._currentFileModel.off();
			}
			this._currentFileModel = null;
			this.$el.find('.select-all').prop('checked', false);
			this.showMask();
			this._reloadCall = this.filesClient.getFolderContents(
				this.getCurrentDirectory(), {
					includeParent: true,
					properties: this._getWebdavProperties()
				}
			);
			if (this._detailsView && !keepOpen) {
				// close sidebar
				this._updateDetailsView(null);
			}
			this._setCurrentDir(this.getCurrentDirectory(), false);
			var callBack = this.reloadCallback.bind(this);
			return this._reloadCall.then(callBack, callBack);
		},
		reloadCallback: function(status, result) {
			delete this._reloadCall;
			this.hideMask();

			if (status === 401) {
				// We are not authentificated, so reload the page so that we get
				// redirected to the login page while saving the current url.
				location.reload();
			}

			// Firewall Blocked request?
			if (status === 403) {
				// Go home
				this.changeDirectory('/');
				OC.Notification.show(t('files', 'This operation is forbidden'), {type: 'error'});
				return false;
			}

			// Did share service die or something else fail?
			if (status === 500) {
				// Go home
				this.changeDirectory('/');
				OC.Notification.show(t('files', 'This directory is unavailable, please check the logs or contact the administrator'),
					{type: 'error'}
				);
				return false;
			}

			if (status === 503) {
				// Go home
				if (this.getCurrentDirectory() !== '/') {
					this.changeDirectory('/');
					// TODO: read error message from exception
					OC.Notification.show(t('files', 'Storage is temporarily not available'),
						{type: 'error'}
					);
				}
				return false;
			}

			if (status === 400 || status === 404 || status === 405) {
				// go back home
				this.changeDirectory('/');
				return false;
			}
			// aborted ?
			if (status === 0){
				return true;
			}

			this.updateStorageStatistics(true);

			// first entry is the root
			this.dirInfo = result.shift();
			this.breadcrumb.setDirectoryInfo(this.dirInfo);

			if (this.dirInfo.permissions) {
				this._updateDirectoryPermissions();
			}

			result.sort(this._sortComparator);
			this.setFiles(result);

			if (this.dirInfo) {
				// Make sure the currentFileList is the current one
				// When navigating to the favorite or share with you virtual
				// folder, this is not correctly set during the initialisation
				// otherwise.
				OCA.Files.App && OCA.Files.App.updateCurrentFileList(this);

				var newFileId = this.dirInfo.id;
				// update fileid in URL
				var params = {
					dir: this.getCurrentDirectory()
				};
				if (newFileId) {
					params.fileId = newFileId;
				}
				this.$el.trigger(jQuery.Event('afterChangeDirectory', params));
			}
			return true;
		},

		updateStorageStatistics: function(force) {
			OCA.Files.Files.updateStorageStatistics(this.getCurrentDirectory(), force);
		},

		updateStorageQuotas: function() {
			OCA.Files.Files.updateStorageQuotas();
		},

		/**
		 * @deprecated do not use nor override
		 */
		getAjaxUrl: function(action, params) {
			return OCA.Files.Files.getAjaxUrl(action, params);
		},

		getDownloadUrl: function(files, dir, isDir) {
			return OCA.Files.Files.getDownloadUrl(files, dir || this.getCurrentDirectory(), isDir);
		},

		getDefaultActionUrl: function(path, id) {
			return this.linkTo(path) + "&openfile="+id;
		},

		getUploadUrl: function(fileName, dir) {
			if (_.isUndefined(dir)) {
				dir = this.getCurrentDirectory();
			}

			var pathSections = dir.split('/');
			if (!_.isUndefined(fileName)) {
				pathSections.push(fileName);
			}
			var encodedPath = '';
			_.each(pathSections, function(section) {
				if (section !== '') {
					encodedPath += '/' + encodeURIComponent(section);
				}
			});
			return OC.linkToRemoteBase('webdav') + encodedPath;
		},

		/**
		 * Generates a preview URL based on the URL space.
		 * @param urlSpec attributes for the URL
		 * @param {number} urlSpec.x width
		 * @param {number} urlSpec.y height
		 * @param {String} urlSpec.file path to the file
		 * @return preview URL
		 */
		generatePreviewUrl: function(urlSpec) {
			urlSpec = urlSpec || {};
			if (!urlSpec.x) {
				urlSpec.x = this.$table.data('preview-x') || 250;
			}
			if (!urlSpec.y) {
				urlSpec.y = this.$table.data('preview-y') || 250;
			}
			urlSpec.x *= window.devicePixelRatio;
			urlSpec.y *= window.devicePixelRatio;
			urlSpec.x = Math.ceil(urlSpec.x);
			urlSpec.y = Math.ceil(urlSpec.y);
			urlSpec.forceIcon = 0;

			/**
			 * Images are cropped to a square by default. Append a=1 to the URL
			 *  if the user wants to see images with original aspect ratio.
			 */
			urlSpec.a = this._filesConfig.crop_image_previews ? 0 : 1;

			if (typeof urlSpec.fileId !== 'undefined') {
				delete urlSpec.file;
				return OC.generateUrl('/core/preview?') + $.param(urlSpec);
			} else {
				delete urlSpec.fileId;
				return OC.generateUrl('/core/preview.png?') + $.param(urlSpec);
			}

		},

		/**
		 * Lazy load a file's preview.
		 *
		 * @param path path of the file
		 * @param mime mime type
		 * @param callback callback function to call when the image was loaded
		 * @param etag file etag (for caching)
		 */
		lazyLoadPreview : function(options) {
			var self = this;
			var fileId = options.fileId;
			var path = options.path;
			var mime = options.mime;
			var ready = options.callback;
			var etag = options.etag;

			// get mime icon url
			var iconURL = OC.MimeType.getIconUrl(mime);
			var previewURL,
				urlSpec = {};
			ready(iconURL); // set mimeicon URL

			urlSpec.fileId = fileId;
			urlSpec.file = OCA.Files.Files.fixPath(path);
			if (options.x) {
				urlSpec.x = options.x;
			}
			if (options.y) {
				urlSpec.y = options.y;
			}
			if (options.a) {
				urlSpec.a = options.a;
			}
			if (options.mode) {
				urlSpec.mode = options.mode;
			}

			if (etag){
				// use etag as cache buster
				urlSpec.c = etag;
			}

			previewURL = self.generatePreviewUrl(urlSpec);
			previewURL = previewURL.replace(/\(/g, '%28').replace(/\)/g, '%29');

			// preload image to prevent delay
			// this will make the browser cache the image
			var img = new Image();
			img.onload = function(){
				// if loading the preview image failed (no preview for the mimetype) then img.width will < 5
				if (img.width > 5) {
					ready(previewURL, img);
				} else if (options.error) {
					options.error();
				}
			};
			if (options.error) {
				img.onerror = options.error;
			}
			img.src = previewURL;
		},

		_updateDirectoryPermissions: function() {
			var isCreatable = (this.dirInfo.permissions & OC.PERMISSION_CREATE) !== 0 && this.$el.find('#free_space').val() !== '0';
			this.$el.find('#permissions').val(this.dirInfo.permissions);
			this.$el.find('.creatable').toggleClass('hidden', !isCreatable);
			this.$el.find('.notCreatable').toggleClass('hidden', isCreatable);
		},
		/**
		 * Shows/hides action buttons
		 *
		 * @param show true for enabling, false for disabling
		 */
		showActions: function(show){
			this.$el.find('.actions').toggleClass('hidden', !show);
			if (show){
				// make sure to display according to permissions
				var permissions = this.getDirectoryPermissions();
				var isCreatable = (permissions & OC.PERMISSION_CREATE) !== 0;
				this.$el.find('.creatable').toggleClass('hidden', !isCreatable);
				this.$el.find('.notCreatable').toggleClass('hidden', isCreatable);
				// remove old style breadcrumbs (some apps might create them)
				this.$el.find('.files-controls .crumb').remove();
				// refresh breadcrumbs in case it was replaced by an app
				this.breadcrumb.render();
			}
			else{
				this.$el.find('.creatable, .notCreatable').addClass('hidden');
			}
		},
		/**
		 * Enables/disables viewer mode.
		 * In viewer mode, apps can embed themselves under the controls bar.
		 * In viewer mode, the actions of the file list will be hidden.
		 * @param show true for enabling, false for disabling
		 */
		setViewerMode: function(show){
			this.showActions(!show);
			this.$el.find('.files-filestable').toggleClass('hidden', show);
			this.$el.trigger(new $.Event('changeViewerMode', {viewerModeEnabled: show}));
		},
		/**
		 * Removes a file entry from the list
		 * @param name name of the file to remove
		 * @param {Object} [options] map of attributes
		 * @param {boolean} [options.updateSummary] true to update the summary
		 * after removing, false otherwise. Defaults to true.
		 * @return deleted element
		 */
		remove: function(name, options){
			options = options || {};
			var fileEl = this.findFileEl(name);
			var fileData = _.findWhere(this.files, {name: name});
			if (!fileData) {
				return;
			}
			var fileId = fileData.id;
			if (this._selectedFiles[fileId]) {
				// remove from selection first
				this._selectFileEl(fileEl, false);
				this.updateSelectionSummary();
			}
			if (this._selectedFiles[fileId]) {
				delete this._selectedFiles[fileId];
				this._selectionSummary.remove(fileData);
				this.updateSelectionSummary();
			}
			var index = this.files.findIndex(function(el){return el.name==name;});
			this.files.splice(index, 1);

			// TODO: improve performance on batch update
			this.isEmpty = !this.files.length;
			if (typeof(options.updateSummary) === 'undefined' || !!options.updateSummary) {
				this.updateEmptyContent();
				this.fileSummary.remove({type: fileData.type, size: fileData.size}, true);
			}

			if (!fileEl.length) {
				return null;
			}

			if (this._dragOptions && (fileEl.data('permissions') & OC.PERMISSION_DELETE)) {
				// file is only draggable when delete permissions are set
				fileEl.find('td.filename').draggable('destroy');
			}
			if (this._currentFileModel && this._currentFileModel.get('id') === fileId) {
				// Note: in the future we should call destroy() directly on the model
				// and the model will take care of the deletion.
				// Here we only trigger the event to notify listeners that
				// the file was removed.
				this._currentFileModel.trigger('destroy');
				this._updateDetailsView(null);
			}
			fileEl.remove();

			var lastIndex = this.$fileList.children().length;
			// if there are less elements visible than one page
			// but there are still pending elements in the array,
			// then directly append the next page
			if (lastIndex < this.files.length && lastIndex < this.pageSize()) {
				this._nextPage(true);
			}

			return fileEl;
		},
		/**
		 * Finds the index of the row before which the given
		 * fileData should be inserted, considering the current
		 * sorting
		 *
		 * @param {OC.Files.FileInfo} fileData file info
		 */
		_findInsertionIndex: function(fileData) {
			var index = 0;
			while (index < this.files.length && this._sortComparator(fileData, this.files[index]) > 0) {
				index++;
			}
			return index;
		},

		/**
		 * Moves a file to a given target folder.
		 *
		 * @param fileNames array of file names to move
		 * @param targetPath absolute target path
		 * @param callback function to call when movement is finished
		 * @param dir the dir path where fileNames are located (optional, will take current folder if undefined)
		 */
		move: function(fileNames, targetPath, callback, dir) {
			var self = this;

			dir = typeof dir === 'string' ? dir : this.getCurrentDirectory();
			if (dir.charAt(dir.length - 1) !== '/') {
				dir += '/';
			}
			var target = OC.basename(targetPath);
			if (!_.isArray(fileNames)) {
				fileNames = [fileNames];
			}

			var moveFileFunction = function(fileName) {
				var $tr = self.findFileEl(fileName);
				self.showFileBusyState($tr, true);
				if (targetPath.charAt(targetPath.length - 1) !== '/') {
					// make sure we move the files into the target dir,
					// not overwrite it
					targetPath = targetPath + '/';
				}
				return self.filesClient.move(dir + fileName, targetPath + fileName)
					.done(function() {
						// if still viewing the same directory
						if (OC.joinPaths(self.getCurrentDirectory(), '/') === OC.joinPaths(dir, '/')) {
							// recalculate folder size
							var oldFile = self.findFileEl(target);
							var newFile = self.findFileEl(fileName);
							var oldSize = oldFile.data('size');
							var newSize = oldSize + newFile.data('size');
							oldFile.data('size', newSize);
							oldFile.find('td.filesize').text(OC.Util.humanFileSize(newSize));

							self.remove(fileName);
						}
					})
					.fail(function(status) {
						if (status === 412) {
							// TODO: some day here we should invoke the conflict dialog
							OC.Notification.show(t('files', 'Could not move "{file}", target exists',
								{file: fileName}), {type: 'error'}
							);
						} else {
							OC.Notification.show(t('files', 'Could not move "{file}"',
								{file: fileName}), {type: 'error'}
							);
						}
					})
					.always(function() {
						self.showFileBusyState($tr, false);
					});
			};
			return this.reportOperationProgress(fileNames, moveFileFunction, callback).then(function() {
				self.updateStorageStatistics();
				self.updateStorageQuotas();
			});
		},

		_reflect: function (promise){
			return promise.then(function(v){ return {};}, function(e){ return {};});
		},

		reportOperationProgress: function (fileNames, operationFunction, callback){
			var self = this;
			self._operationProgressBar.showProgressBar(false);
			var mcSemaphore = new OCA.Files.Semaphore(5);
			var counter = 0;
			var promises = _.map(fileNames, function(arg) {
				return mcSemaphore.acquire().then(function(){
					return operationFunction(arg).always(function(){
						mcSemaphore.release();
						counter++;
						self._operationProgressBar.setProgressBarValue(100.0*counter/fileNames.length);
					});
				});
			});

			return Promise.all(_.map(promises, self._reflect)).then(function(){
				if (callback) {
					callback();
				}
				self._operationProgressBar.hideProgressBar();
			});
		},

		/**
		 * Copies a file to a given target folder.
		 *
		 * @param fileNames array of file names to copy
		 * @param targetPath absolute target path
		 * @param callback to call when copy is finished with success
		 * @param dir the dir path where fileNames are located (optional, will take current folder if undefined)
		 */
		copy: function(fileNames, targetPath, callback, dir) {
			var self = this;
			var filesToNotify = [];
			var count = 0;

			dir = typeof dir === 'string' ? dir : this.getCurrentDirectory();
			if (dir.charAt(dir.length - 1) !== '/') {
				dir += '/';
			}
			var target = OC.basename(targetPath);
			if (!_.isArray(fileNames)) {
				fileNames = [fileNames];
			}
			var copyFileFunction = function(fileName) {
				var $tr = self.findFileEl(fileName);
				self.showFileBusyState($tr, true);
				if (targetPath.charAt(targetPath.length - 1) !== '/') {
					// make sure we move the files into the target dir,
					// not overwrite it
					targetPath = targetPath + '/';
				}
				var targetPathAndName = targetPath + fileName;
				if ((dir + fileName) === targetPathAndName) {
					var dotIndex = targetPathAndName.indexOf(".");
					if ( dotIndex > 1) {
						var leftPartOfName = targetPathAndName.substr(0, dotIndex);
						var fileNumber = leftPartOfName.match(/\d+/);
						// TRANSLATORS name that is appended to copied files with the same name, will be put in parenthesis and appended with a number if it is the second+ copy
						var copyNameLocalized = t('files', 'copy');
						if (isNaN(fileNumber) ) {
							fileNumber++;
							targetPathAndName = targetPathAndName.replace(/(?=\.[^.]+$)/g, " (" + copyNameLocalized + " " + fileNumber + ")");
						}
						else {
							// Check if we have other files with 'copy X' and the same name
							var maxNum = 1;
							if (self.files !== null) {
								leftPartOfName = leftPartOfName.replace("/", "");
								leftPartOfName = leftPartOfName.replace(new RegExp("\\(" + copyNameLocalized + "( \\d+)?\\)"),"");
								// find the last file with the number extension and add one to the new name
								for (var j = 0; j < self.files.length; j++) {
									var cName = self.files[j].name;
									if (cName.indexOf(leftPartOfName) > -1) {
										if (cName.indexOf("(" + copyNameLocalized + ")") > 0) {
											targetPathAndName = targetPathAndName.replace(new RegExp(" \\(" + copyNameLocalized + "\\)"),"");
											if (maxNum == 1) {
												maxNum = 2;
											}
										}
										else {
											var cFileNumber = cName.match(new RegExp("\\(" + copyNameLocalized + " (\\d+)\\)"));
											if (cFileNumber && parseInt(cFileNumber[1]) >= maxNum) {
												maxNum = parseInt(cFileNumber[1]) + 1;
											}
										}
									}
								}
								targetPathAndName = targetPathAndName.replace(new RegExp(" \\(" + copyNameLocalized + " \\d+\\)"),"");
							}
							// Create the new file name with _x at the end
							// Start from 2 per a special request of the 'standard'
							var extensionName = " (" + copyNameLocalized + " " + maxNum +")";
							if (maxNum == 1) {
								extensionName = " (" + copyNameLocalized + ")";
							}
							targetPathAndName = targetPathAndName.replace(/(?=\.[^.]+$)/g, extensionName);
						}
					}
				}
				return self.filesClient.copy(dir + fileName, targetPathAndName)
					.done(function () {
						filesToNotify.push(fileName);

						// if still viewing the same directory
						if (OC.joinPaths(self.getCurrentDirectory(), '/') === OC.joinPaths(dir, '/')) {
							// recalculate folder size
							var oldFile = self.findFileEl(target);
							var newFile = self.findFileEl(fileName);
							var oldSize = oldFile.data('size');
							var newSize = oldSize + newFile.data('size');
							oldFile.data('size', newSize);
							oldFile.find('td.filesize').text(OC.Util.humanFileSize(newSize));
						}
						self.reload();
					})
					.fail(function(status) {
						if (status === 412) {
							// TODO: some day here we should invoke the conflict dialog
							OC.Notification.show(t('files', 'Could not copy "{file}", target exists',
								{file: fileName}), {type: 'error'}
							);
						} else {
							OC.Notification.show(t('files', 'Could not copy "{file}"',
								{file: fileName}), {type: 'error'}
							);
						}
					})
					.always(function() {
						self.showFileBusyState($tr, false);
						count++;

						/**
						 * We only show the notifications once the last file has been copied
						 */
						if (count === fileNames.length) {
							// Remove leading and ending /
							if (targetPath.slice(0, 1) === '/') {
								targetPath = targetPath.slice(1, targetPath.length);
							}
							if (targetPath.slice(-1) === '/') {
								targetPath = targetPath.slice(0, -1);
							}

							if (filesToNotify.length > 0) {
								// Since there's no visual indication that the files were copied, let's send some notifications !
								if (filesToNotify.length === 1) {
									OC.Notification.show(t('files', 'Copied {origin} inside {destination}',
										{
											origin: filesToNotify[0],
											destination: targetPath
										}
									), {timeout: 10});
								} else if (filesToNotify.length > 0 && filesToNotify.length < 3) {
									OC.Notification.show(t('files', 'Copied {origin} inside {destination}',
										{
											origin: filesToNotify.join(', '),
											destination: targetPath
										}
									), {timeout: 10});
								} else {
									OC.Notification.show(t('files', 'Copied {origin} and {nbfiles} other files inside {destination}',
										{
											origin: filesToNotify[0],
											nbfiles: filesToNotify.length - 1,
											destination: targetPath
										}
									), {timeout: 10});
								}
							}
						}
					});
			};
			return this.reportOperationProgress(fileNames, copyFileFunction, callback).then(function() {
				self.updateStorageStatistics();
				self.updateStorageQuotas();
			});
		},

		openLocalClient: function(path) {
			var link = OC.linkToOCS('apps/files/api/v1', 2) + 'openlocaleditor?format=json';

			$.post(link, {
				path
			})
				.success(function(result) {
					var scheme = 'nc://';
					var command = 'open';
					var uid = OC.getCurrentUser().uid;
					var url = scheme + command + '/' + uid + '@' + window.location.host + OC.encodePath(path);
					url += '?token=' + result.ocs.data.token;

					window.location.href = url;
				})
				.fail(function() {
					OC.Notification.show(t('files', 'Failed to redirect to client'))
				})
		},

		/**
		 * Updates the given row with the given file info
		 *
		 * @param {Object} $tr row element
		 * @param {OCA.Files.FileInfo} fileInfo file info
		 * @param {Object} options options
		 *
		 * @return {Object} new row element
		 */
		updateRow: function($tr, fileInfo, options) {
			this.files.splice($tr.index(), 1);
			$tr.remove();
			options = _.extend({silent: true}, options);
			options = _.extend(options, {updateSummary: false});
			$tr = this.add(fileInfo, options);
			this.$fileList.trigger($.Event('fileActionsReady', {fileList: this, $files: $tr}));
			return $tr;
		},

		/**
		 * Triggers file rename input field for the given file name.
		 * If the user enters a new name, the file will be renamed.
		 *
		 * @param oldName file name of the file to rename
		 */
		rename: function(oldName) {
			var self = this;
			var tr, td, input, form;
			tr = this.findFileEl(oldName);
			var oldFileInfo = this.files[tr.index()];
			tr.data('renaming',true);
			td = tr.children('td.filename');
			input = $('<input type="text" class="filename"/>').val(oldName);
			form = $('<form></form>');
			form.append(input);
			td.children('a.name').children(':not(.thumbnail-wrapper)').hide();
			td.append(form);
			input.focus();
			//preselect input
			var len = input.val().lastIndexOf('.');
			if ( len === -1 ||
				tr.data('type') === 'dir' ) {
				len = input.val().length;
			}
			input.selectRange(0, len);
			var checkInput = function () {
				var filename = input.val();
				if (filename !== oldName) {
					// Files.isFileNameValid(filename) throws an exception itself
					OCA.Files.Files.isFileNameValid(filename);
					if (self.inList(filename)) {
						throw t('files', '{newName} already exists', {newName: filename}, undefined, {
							escape: false
						});
					}
				}
				return true;
			};

			function restore() {
				tr.data('renaming',false);
				form.remove();
				td.children('a.name').children(':not(.thumbnail-wrapper)').show();
			}

			function updateInList(fileInfo) {
				self.updateRow(tr, fileInfo);
				self._updateDetailsView(fileInfo.name, false);
			}

			// TODO: too many nested blocks, move parts into functions
			form.submit(function(event) {
				event.stopPropagation();
				event.preventDefault();
				if (input.hasClass('error')) {
					return;
				}

				try {
					var newName = input.val().trim();
					form.remove();

					if (newName !== oldName) {
						checkInput();
						// mark as loading (temp element)
						self.showFileBusyState(tr, true);
						tr.attr('data-file', newName);
						var basename = newName;
						if (newName.indexOf('.') > 0 && tr.data('type') !== 'dir') {
							basename = newName.substr(0, newName.lastIndexOf('.'));
						}
						td.find('a.name span.nametext').text(basename);
						td.children('a.name').children(':not(.thumbnail-wrapper)').show();

						var path = tr.attr('data-path') || self.getCurrentDirectory();
						self.filesClient.move(OC.joinPaths(path, oldName), OC.joinPaths(path, newName))
							.done(function() {
								oldFileInfo.name = newName;
								updateInList(oldFileInfo);
							})
							.fail(function(status) {
								// TODO: 409 means current folder does not exist, redirect ?
								if (status === 404) {
									// source not found, so remove it from the list
									OC.Notification.show(t('files', 'Could not rename "{fileName}", it does not exist any more',
										{fileName: oldName}), {timeout: 7, type: 'error'}
									);

									self.remove(newName, {updateSummary: true});
									return;
								} else if (status === 412) {
									// target exists
									OC.Notification.show(
										t('files', 'The name "{targetName}" is already used in the folder "{dir}". Please choose a different name.',
										{
											targetName: newName,
											dir: self.getCurrentDirectory(),
										}),
										{
											type: 'error'
										}
									);
								} else {
									// restore the item to its previous state
									OC.Notification.show(t('files', 'Could not rename "{fileName}"',
										{fileName: oldName}), {type: 'error'}
									);
								}
								updateInList(oldFileInfo);
							});
					} else {
						// add back the old file info when cancelled
						self.files.splice(tr.index(), 1);
						tr.remove();
						tr = self.add(oldFileInfo, {updateSummary: false, silent: true});
						self.$fileList.trigger($.Event('fileActionsReady', {fileList: self, $files: $(tr)}));
					}
				} catch (error) {
					input.attr('title', error);
					input.addClass('error');
				}
				return false;
			});
			input.keyup(function(event) {
				// verify filename on typing
				try {
					checkInput();
					input.removeClass('error');
				} catch (error) {
					input.attr('title', error);
					input.addClass('error');
				}
				if (event.keyCode === 27) {
					restore();
				}
			});
			input.click(function(event) {
				event.stopPropagation();
				event.preventDefault();
			});
			input.blur(function() {
				if(input.hasClass('error')) {
					restore();
				} else {
					form.trigger('submit');
				}
			});
		},

		/**
		 * Create an empty file inside the current directory.
		 *
		 * @param {string} name name of the file
		 *
		 * @return {Promise} promise that will be resolved after the
		 * file was created
		 *
		 * @since 8.2
		 */
		createFile: function(name, options) {
			var self = this;
			var deferred = $.Deferred();
			var promise = deferred.promise();

			OCA.Files.Files.isFileNameValid(name);

			if (this.lastAction) {
				this.lastAction();
			}

			name = this.getUniqueName(name);
			var targetPath = this.getCurrentDirectory() + '/' + name;

			self.filesClient.putFileContents(
					targetPath,
					' ', // dont create empty files which fails on some storage backends
					{
						contentType: 'text/plain',
						overwrite: true
					}
				)
				.done(function() {
					// TODO: error handling / conflicts
					options = _.extend({scrollTo: true}, options || {});
					self.addAndFetchFileInfo(targetPath, '', options).then(function(status, data) {
						deferred.resolve(status, data);
					}, function() {
						OC.Notification.show(t('files', 'Could not create file "{file}"',
							{file: name}), {type: 'error'}
						);
					});
				})
				.fail(function(status) {
					if (status === 412) {
						OC.Notification.show(t('files', 'Could not create file "{file}" because it already exists',
							{file: name}), {type: 'error'}
						);
					} else {
						OC.Notification.show(t('files', 'Could not create file "{file}"',
							{file: name}), {type: 'error'}
						);
					}
					deferred.reject(status);
				});

			return promise;
		},

		/**
		 * Create a directory inside the current directory.
		 *
		 * @param {string} name name of the directory
		 *
		 * @return {Promise} promise that will be resolved after the
		 * directory was created
		 *
		 * @since 8.2
		 */
		createDirectory: function(name) {
			var self = this;
			var deferred = $.Deferred();
			var promise = deferred.promise();

			OCA.Files.Files.isFileNameValid(name);

			if (this.lastAction) {
				this.lastAction();
			}

			name = this.getUniqueName(name);
			var targetPath = this.getCurrentDirectory() + '/' + name;

			this.filesClient.createDirectory(targetPath)
				.done(function() {
					self.addAndFetchFileInfo(targetPath, '', {scrollTo:true}).then(function(status, data) {
						deferred.resolve(status, data);
					}, function() {
						OC.Notification.show(t('files', 'Could not create folder "{dir}"',
							{dir: name}), {type: 'error'}
						);
					});
				})
				.fail(function(createStatus) {
					// method not allowed, folder might exist already
					if (createStatus === 405) {
						// add it to the list, for completeness
						self.addAndFetchFileInfo(targetPath, '', {scrollTo:true})
							.done(function(status, data) {
								OC.Notification.show(t('files', 'Could not create folder "{dir}" because it already exists',
									{dir: name}), {type: 'error'}
								);
								// still consider a failure
								deferred.reject(createStatus, data);
							})
							.fail(function() {
								OC.Notification.show(t('files', 'Could not create folder "{dir}"',
									{dir: name}), {type: 'error'}
								);
								deferred.reject(status);
							});
					} else {
						OC.Notification.show(t('files', 'Could not create folder "{dir}"',
							{dir: name}), {type: 'error'}
						);
						deferred.reject(createStatus);
					}
				});

			return promise;
		},

		/**
		 * Add file into the list by fetching its information from the server first.
		 *
		 * If the given directory does not match the current directory, nothing will
		 * be fetched.
		 *
		 * @param {String} fileName file name
		 * @param {String} [dir] optional directory, defaults to the current one
		 * @param {Object} options same options as #add
		 * @return {Promise} promise that resolves with the file info, or an
		 * already resolved Promise if no info was fetched. The promise rejects
		 * if the file was not found or an error occurred.
		 *
		 * @since 9.0
		 */
		addAndFetchFileInfo: function(fileName, dir, options) {
			var self = this;
			var deferred = $.Deferred();
			if (_.isUndefined(dir)) {
				dir = this.getCurrentDirectory();
			} else {
				dir = dir || '/';
			}

			var targetPath = OC.joinPaths(dir, fileName);

			if ((OC.dirname(targetPath) || '/') !== this.getCurrentDirectory()) {
				// no need to fetch information
				deferred.resolve();
				return deferred.promise();
			}

			var addOptions = _.extend({
				animate: true,
				scrollTo: false
			}, options || {});

			this.filesClient.getFileInfo(targetPath, {
					properties: this._getWebdavProperties()
				})
				.then(function(status, data) {
					// remove first to avoid duplicates
					self.remove(data.name);
					self.add(data, addOptions);
					deferred.resolve(status, data);
				})
				.fail(function(status) {
					OCP.Toast.error(
						t('files', 'Could not fetch file details "{file}"', { file: fileName })
					);
					deferred.reject(status);
				});

			return deferred.promise();
		},

		/**
		 * Returns whether the given file name exists in the list
		 *
		 * @param {string} file file name
		 *
		 * @return {boolean} true if the file exists in the list, false otherwise
		 */
		inList:function(file) {
			return this.findFile(file);
		},

		/**
		 * Shows busy state on a given file row or multiple
		 *
		 * @param {string|Array.<string>} files file name or array of file names
		 * @param {boolean} [busy=true] busy state, true for busy, false to remove busy state
		 *
		 * @since 8.2
		 */
		showFileBusyState: function(files, state) {
			var self = this;
			if (!_.isArray(files) && !files.is) {
				files = [files];
			}

			if (_.isUndefined(state)) {
				state = true;
			}

			_.each(files, function(fileName) {
				// jquery element already ?
				var $tr;
				if (_.isString(fileName)) {
					$tr = self.findFileEl(fileName);
				} else {
					$tr = $(fileName);
				}

				var $thumbEl = $tr.find('.thumbnail');
				$tr.toggleClass('busy', state);

				if (state) {
					$thumbEl.parent().addClass('icon-loading-small');
				} else {
					$thumbEl.parent().removeClass('icon-loading-small');
				}
			});
		},

		/**
		 * Delete the given files from the given dir
		 * @param files file names list (without path)
		 * @param dir directory in which to delete the files, defaults to the current
		 * directory
		 */
		do_delete:function(files, dir) {
			var self = this;
			if (files && files.substr) {
				files=[files];
			}
			if (!files) {
				// delete all files in directory
				files = _.pluck(this.files, 'name');
			}
			// Finish any existing actions
			if (this.lastAction) {
				this.lastAction();
			}

			dir = dir || this.getCurrentDirectory();

			var removeFunction = function(fileName) {
				var $tr = self.findFileEl(fileName);
				self.showFileBusyState($tr, true);
				return self.filesClient.remove(dir + '/' + fileName)
					.done(function() {
						if (OC.joinPaths(self.getCurrentDirectory(), '/') === OC.joinPaths(dir, '/')) {
							self.remove(fileName);
						}
					})
					.fail(function(status) {
						if (status === 404) {
							// the file already did not exist, remove it from the list
							if (OC.joinPaths(self.getCurrentDirectory(), '/') === OC.joinPaths(dir, '/')) {
								self.remove(fileName);
							}
						} else {
							// only reset the spinner for that one file
							OC.Notification.show(t('files', 'Error deleting file "{fileName}".',
								{fileName: fileName}), {type: 'error'}
							);
						}
					})
					.always(function() {
						self.showFileBusyState($tr, false);
					});
			};
			return this.reportOperationProgress(files, removeFunction).then(function(){
					self.updateStorageStatistics();
					self.updateStorageQuotas();
				});
		},

		/**
		 * Creates the file summary section
		 */
		_createSummary: function() {
			var $tr = $('<tr class="summary"></tr>');

			if (this._allowSelection) {
				// Dummy column for selection, as all rows must have the same
				// number of columns.
				$tr.append('<td></td>');
			}

			this.$el.find('tfoot').append($tr);

			return new OCA.Files.FileSummary($tr, { config: this._filesConfig });
		},
		updateEmptyContent: function() {
			var permissions = this.getDirectoryPermissions();
			var isCreatable = (permissions & OC.PERMISSION_CREATE) !== 0;
			this.$el.find('.emptyfilelist.emptycontent').toggleClass('hidden', !this.isEmpty);
			this.$el.find('.emptyfilelist.emptycontent').toggleClass('hidden', !this.isEmpty);
			this.$el.find('.emptyfilelist.emptycontent .uploadmessage').toggleClass('hidden', !isCreatable || !this.isEmpty);
			this.$el.find('.files-filestable').toggleClass('hidden', this.isEmpty);
			this.$el.find('.files-filestable thead th').toggleClass('hidden', this.isEmpty);
		},
		/**
		 * Shows the loading mask.
		 *
		 * @see OCA.Files.FileList#hideMask
		 */
		showMask: function() {
			// in case one was shown before
			var $mask = this.$el.find('.mask');
			if ($mask.exists()) {
				return;
			}

			this.$table.addClass('hidden');
			this.$el.find('.emptyfilelist.emptycontent').addClass('hidden');

			$mask = $('<div class="mask transparent icon-loading"></div>');

			this.$el.append($mask);

			$mask.removeClass('transparent');
		},
		/**
		 * Hide the loading mask.
		 * @see OCA.Files.FileList#showMask
		 */
		hideMask: function() {
			this.$el.find('.mask').remove();
			this.$table.removeClass('hidden');
		},
		scrollTo:function(file) {
			if (!_.isArray(file)) {
				file = [file];
			}
			if (file.length === 1) {
				_.defer(function() {
					if (document.documentElement.clientWidth > 1024) {
						this.showDetailsView(file[0]);
					}
				}.bind(this));
			}
			this.highlightFiles(file, function($tr) {
				$tr.addClass('searchresult');
				$tr.one('hover', function() {
					$tr.removeClass('searchresult');
				});
			});
		},
		/**
		 * @deprecated use setFilter(filter)
		 */
		filter:function(query) {
			this.setFilter('');
		},
		/**
		 * @deprecated use setFilter('')
		 */
		unfilter:function() {
			this.setFilter('');
		},
		/**
		 * hide files matching the given filter
		 * @param {any} filter -
		 */
		setFilter:function(filter) {
			var total = 0;
			if (this._filter === filter) {
				return;
			}
			this._filter = filter;
			this.fileSummary.setFilter(filter, this.files);
			total = this.fileSummary.getTotal();
			if (!this.$el.find('.mask').exists()) {
				this.hideIrrelevantUIWhenNoFilesMatch();
			}

			var visibleCount = 0;
			filter = filter.toLowerCase();

			function filterRows(tr) {
				var $e = $(tr);
				if ($e.data('file').toString().toLowerCase().indexOf(filter) === -1) {
					$e.addClass('hidden');
				} else {
					visibleCount++;
					$e.removeClass('hidden');
				}
			}

			var $trs = this.$fileList.find('tr');
			do {
				_.each($trs, filterRows);
				if (visibleCount < total) {
					$trs = this._nextPage(false);
				}
			} while (visibleCount < total && $trs.length > 0);

			this.$container.trigger('scroll');
		},
		hideIrrelevantUIWhenNoFilesMatch:function() {
			if (this._filter && this.fileSummary.summary.totalDirs + this.fileSummary.summary.totalFiles === 0) {
				this.$el.find('.files-filestable thead th').addClass('hidden');
				this.$el.find('.emptyfilelist.emptycontent').addClass('hidden');
				$('#searchresults').addClass('filter-empty');
				$('#searchresults .emptycontent').addClass('emptycontent-search');
				if ( $('#searchresults').length === 0 || $('#searchresults').hasClass('hidden') ) {
					var error;
					if (this._filter.length > 2) {
						error = t('files', 'No search results in other folders for {tag}{filter}{endtag}', {filter:this._filter});
					} else {
						error = t('files', 'Enter more than two characters to search in other folders');
					}
					this.$el.find('.nofilterresults').removeClass('hidden').
						find('p').html(error.replace('{tag}', '<strong>').replace('{endtag}', '</strong>'));
				}
			} else {
				$('#searchresults').removeClass('filter-empty');
				$('#searchresults .emptycontent').removeClass('emptycontent-search');
				this.$el.find('.files-filestable thead th').toggleClass('hidden', this.isEmpty);
				if (!this.$el.find('.mask').exists()) {
					this.$el.find('.emptyfilelist.emptycontent').toggleClass('hidden', !this.isEmpty);
				}
				this.$el.find('.nofilterresults').addClass('hidden');
			}
		},
		/**
		 * get the current filter
		 * @param {any} filter -
		 */
		getFilter:function(filter) {
			return this._filter;
		},

		/**
		 * Update UI based on the current selection
		 */
		updateSelectionSummary: function() {
			var summary = this._selectionSummary.summary;
			var selection;

			var showHidden = !!this._filesConfig.show_hidden;
			if (summary.totalFiles === 0 && summary.totalDirs === 0) {
				this.$el.find('.column-name a.name>span:first').text(t('files','Name'));
				this.$el.find('.column-size a>span:first').text(t('files','Size'));
				this.$el.find('.column-mtime a>span:first').text(t('files','Modified'));
				this.$el.find('table').removeClass('multiselect');
				this.$el.find('.selectedActions').addClass('hidden');
			}
			else {
				this.$el.find('.selectedActions').removeClass('hidden');
				this.$el.find('.column-size a>span:first').text(OC.Util.humanFileSize(summary.totalSize));

				var directoryInfo = n('files', '%n folder', '%n folders', summary.totalDirs);
				var fileInfo = n('files', '%n file', '%n files', summary.totalFiles);

				if (summary.totalDirs > 0 && summary.totalFiles > 0) {
					var selectionVars = {
						dirs: directoryInfo,
						files: fileInfo
					};
					selection = t('files', '{dirs} and {files}', selectionVars);
				} else if (summary.totalDirs > 0) {
					selection = directoryInfo;
				} else {
					selection = fileInfo;
				}

				if (!showHidden && summary.totalHidden > 0) {
					var hiddenInfo = n('files', 'including %n hidden', 'including %n hidden', summary.totalHidden);
					selection += ' (' + hiddenInfo + ')';
				}

				this.$el.find('.column-name a.name>span:first').text(selection);
				this.$el.find('.column-mtime a>span:first').text('');
				this.$el.find('table').addClass('multiselect');

				if (this.fileMultiSelectMenu) {
					this.fileMultiSelectMenu.toggleItemVisibility('download', this.isSelectedDownloadable());
					this.fileMultiSelectMenu.toggleItemVisibility('delete', this.isSelectedDeletable());
					this.fileMultiSelectMenu.toggleItemVisibility('copyMove', this.isSelectedCopiable());
					if (this.isSelectedCopiable()) {
						if (this.isSelectedMovable()) {
							this.fileMultiSelectMenu.updateItemText('copyMove', t('files', 'Move or copy'));
						} else {
							this.fileMultiSelectMenu.updateItemText('copyMove', t('files', 'Copy'));
						}
					} else {
						this.fileMultiSelectMenu.toggleItemVisibility('copyMove', false);
					}
				}
			}
		},

		/**
		 * Check whether all selected files are copiable
		 */
		isSelectedCopiable: function() {
			return _.reduce(this.getSelectedFiles(), function(copiable, file) {
				var requiredPermission = $('#isPublic').val() ? OC.PERMISSION_UPDATE : OC.PERMISSION_READ;
				return copiable && (file.permissions & requiredPermission);
			}, true);
		},

		/**
		 * Check whether all selected files are movable
		 */
		isSelectedMovable: function() {
			return _.reduce(this.getSelectedFiles(), function(movable, file) {
				return movable && (file.permissions & OC.PERMISSION_UPDATE);
			}, true);
		},

		/**
		 * Check whether all selected files are downloadable
		 */
		isSelectedDownloadable: function() {
			return _.reduce(this.getSelectedFiles(), function(downloadable, file) {
				return downloadable && (file.permissions & OC.PERMISSION_READ);
			}, true);
		},

		/**
		 * Check whether all selected files are deletable
		 */
		isSelectedDeletable: function() {
			return _.reduce(this.getSelectedFiles(), function(deletable, file) {
				return deletable && (file.permissions & OC.PERMISSION_DELETE);
			}, true);
		},

		/**
		 * Are all files selected?
		 *
		 * @returns {Boolean} all files are selected
		 */
		isAllSelected: function() {
			var checkbox = this.$el.find('.select-all')
			var checked = checkbox.prop('checked')
			var indeterminate = checkbox.prop('indeterminate')
			return checked && !indeterminate;
		},

		/**
		 * Returns the file info of the selected files
		 *
		 * @return array of file names
		 */
		getSelectedFiles: function() {
			return _.values(this._selectedFiles);
		},

		getUniqueName: function(name) {
			if (this.findFileEl(name).exists()) {
				var numMatch;
				var parts=name.split('.');
				var extension = "";
				if (parts.length > 1) {
					extension=parts.pop();
				}
				var base=parts.join('.');
				numMatch=base.match(/\((\d+)\)/);
				var num=2;
				if (numMatch && numMatch.length>0) {
					num=parseInt(numMatch[numMatch.length-1], 10)+1;
					base=base.split('(');
					base.pop();
					base=$.trim(base.join('('));
				}
				name=base+' ('+num+')';
				if (extension) {
					name = name+'.'+extension;
				}
				// FIXME: ugly recursion
				return this.getUniqueName(name);
			}
			return name;
		},

		/**
		 * Shows a "permission denied" notification
		 */
		_showPermissionDeniedNotification: function() {
			var message = t('files', 'You do not have permission to upload or create files here');
			OC.Notification.show(message, {type: 'error'});
		},

		/**
		 * Setup file upload events related to the file-upload plugin
		 *
		 * @param {OC.Uploader} uploader
		 */
		setupUploadEvents: function(uploader) {
			var self = this;

			self._uploads = {};

			// detect the progress bar resize
			uploader.on('resized', this._onResize);

			uploader.on('drop', function(e, data) {
				self._uploader.log('filelist handle fileuploaddrop', e, data);

				if (self.$el.hasClass('hidden')) {
					// do not upload to invisible lists
					e.preventDefault();
					return false;
				}

				var dropTarget = $(e.delegatedEvent.target);

				// check if dropped inside this container and not another one
				if (dropTarget.length
					&& !self.$el.is(dropTarget) // dropped on list directly
					&& !self.$el.has(dropTarget).length // dropped inside list
					&& !dropTarget.is(self.$container) // dropped on main container
					&& !self.$el.parent().is(dropTarget) // drop on the parent container (#app-content) since the main container might not have the full height
					) {
					e.preventDefault();
					return false;
				}

				// find the closest tr or crumb to use as target
				dropTarget = dropTarget.closest('tr, .crumb');

				// if dropping on tr or crumb, drag&drop upload to folder
				if (dropTarget && (dropTarget.data('type') === 'dir' ||
					dropTarget.hasClass('crumb'))) {

					// remember as context
					data.context = dropTarget;

					// if permissions are specified, only allow if create permission is there
					var permissions = dropTarget.data('permissions');
					if (!_.isUndefined(permissions) && (permissions & OC.PERMISSION_CREATE) === 0) {
						self._showPermissionDeniedNotification();
						return false;
					}
					var dir = dropTarget.data('file');
					// if from file list, need to prepend parent dir
					if (dir) {
						var parentDir = self.getCurrentDirectory();
						if (parentDir[parentDir.length - 1] !== '/') {
							parentDir += '/';
						}
						dir = parentDir + dir;
					}
					else{
						// read full path from crumb
						dir = dropTarget.data('dir') || '/';
					}

					// add target dir
					data.targetDir = dir;
				} else {
					// cancel uploads to current dir if no permission
					var isCreatable = (self.getDirectoryPermissions() & OC.PERMISSION_CREATE) !== 0;
					if (!isCreatable) {
						self._showPermissionDeniedNotification();
						e.stopPropagation();
						return false;
					}

					// we are dropping somewhere inside the file list, which will
					// upload the file to the current directory
					data.targetDir = self.getCurrentDirectory();
				}
			});
			uploader.on('add', function(e, data) {
				self._uploader.log('filelist handle fileuploadadd', e, data);

				// add ui visualization to existing folder
				if (data.context && data.context.data('type') === 'dir') {
					// add to existing folder

					// update upload counter ui
					var uploadText = data.context.find('.uploadtext');
					var currentUploads = parseInt(uploadText.attr('currentUploads'), 10);
					currentUploads += 1;
					uploadText.attr('currentUploads', currentUploads);

					var translatedText = n('files', 'Uploading %n file', 'Uploading %n files', currentUploads);
					if (currentUploads === 1) {
						self.showFileBusyState(uploadText.closest('tr'), true);
						uploadText.text(translatedText);
						uploadText.show();
					} else {
						uploadText.text(translatedText);
					}
				}

				if (!data.targetDir) {
					data.targetDir = self.getCurrentDirectory();
				}

			});
			/*
			 * when file upload done successfully add row to filelist
			 * update counter when uploading to sub folder
			 */
			uploader.on('done', function(e, upload) {
				var data = upload.data;
				self._uploader.log('filelist handle fileuploaddone', e, data);

				var status = data.jqXHR.status;
				if (status < 200 || status >= 300) {
					// error was handled in OC.Uploads already
					return;
				}

				var fileName = upload.getFileName();
				var fetchInfoPromise = self.addAndFetchFileInfo(fileName, upload.getFullPath());
				if (!self._uploads) {
					self._uploads = {};
				}
				if (OC.isSamePath(OC.dirname(upload.getFullPath() + '/'), self.getCurrentDirectory())) {
					self._uploads[fileName] = fetchInfoPromise;
				}

				var uploadText = self.$fileList.find('tr .uploadtext');
				self.showFileBusyState(uploadText.closest('tr'), false);
				uploadText.fadeOut();
				uploadText.attr('currentUploads', 0);

				self.updateStorageQuotas();
			});
			uploader.on('createdfolder', function(fullPath) {
				self.addAndFetchFileInfo(OC.basename(fullPath), OC.dirname(fullPath));
			});
			uploader.on('stop', function() {
				self._uploader.log('filelist handle fileuploadstop');

				// prepare list of uploaded file names in the current directory
				// and discard the other ones
				var promises = _.values(self._uploads);
				var fileNames = _.keys(self._uploads);
				self._uploads = [];

				// as soon as all info is fetched
				$.when.apply($, promises).then(function() {
					// highlight uploaded files
					self.highlightFiles(fileNames);
					self.updateStorageStatistics();
				});

				var uploadText = self.$fileList.find('tr .uploadtext');
				self.showFileBusyState(uploadText.closest('tr'), false);
				uploadText.fadeOut();
				uploadText.attr('currentUploads', 0);
			});
			uploader.on('fail', function(e, data) {
				self._uploader.log('filelist handle fileuploadfail', e, data);
				self._uploads = [];

				//if user pressed cancel hide upload chrome
				//cleanup uploading to a dir
				var uploadText = self.$fileList.find('tr .uploadtext');
				self.showFileBusyState(uploadText.closest('tr'), false);
				uploadText.fadeOut();
				uploadText.attr('currentUploads', 0);
				self.updateStorageStatistics();
			});

		},

		/**
		 * Scroll to the last file of the given list
		 * Highlight the list of files
		 * @param files array of filenames,
		 * @param {Function} [highlightFunction] optional function
		 * to be called after the scrolling is finished
		 */
		highlightFiles: function(files, highlightFunction) {
			// Detection of the uploaded element
			var filename = files[files.length - 1];
			var $fileRow = this.findFileEl(filename);

			while(!$fileRow.exists() && this._nextPage(false) !== false) { // Checking element existence
				$fileRow = this.findFileEl(filename);
			}

			if (!$fileRow.exists()) { // Element not present in the file list
				return;
			}

			var currentOffset = this.$container.scrollTop();
			var additionalOffset = this.$el.find(".files-controls").height()+this.$el.find(".files-controls").offset().top;

			// Animation
			var _this = this;
			var $scrollContainer = this.$container;
			if ($scrollContainer[0] === window) {
				// need to use "html" to animate scrolling
				// when the scroll container is the window
				$scrollContainer = $('html');
			}
			$scrollContainer.animate({
				// Scrolling to the top of the new element
				scrollTop: currentOffset + $fileRow.offset().top - $fileRow.height() * 2 - additionalOffset
			}, {
				duration: 500,
				complete: function() {
					// Highlighting function
					var highlightRow = highlightFunction;

					if (!highlightRow) {
						highlightRow = function($fileRow) {
							$fileRow.addClass("highlightUploaded");
							setTimeout(function() {
								$fileRow.removeClass("highlightUploaded");
							}, 2500);
						};
					}

					// Loop over uploaded files
					for(var i=0; i<files.length; i++) {
						var $fileRow = _this.findFileEl(files[i]);

						if($fileRow.length !== 0) { // Checking element existence
							highlightRow($fileRow);
						}
					}

				}
			});
		},

		_renderNewButton: function() {
			// if an upload button (legacy) already exists or no actions container exist, skip
			var $actionsContainer = this.$el.find('.files-controls .actions');
			if (!$actionsContainer.length || this.$el.find('.button.upload').length) {
				return;
			}
			var $newButton = $(OCA.Files.Templates['template_addbutton']({
				addText: t('files', 'New file/folder menu'),
				iconClass: 'icon-add',
			}));

			$actionsContainer.prepend($newButton);
			$newButton.attr('aria-expanded', 'false');
			$newButton.click(_.bind(this._onClickNewButton, this));
			this._newButton = $newButton;
		},

		_onClickNewButton: function(event) {
			var $target = $(event.target);
			if (!$target.hasClass('.button')) {
				$target = $target.closest('.button');
			}
			$target.attr('aria-expanded', 'true');
			event.preventDefault();
			if ($target.hasClass('disabled')) {
				return false;
			}
			if (!this._newFileMenu) {
				this._newFileMenu = new OCA.Files.NewFileMenu({
					fileList: this
				});
				this.$el.find('.files-controls .actions').append(this._newFileMenu.$el);
			}
			this._newFileMenu.showAt($target);

			return false;
		},

		/**
		 * Register a tab view to be added to all views
		 */
		registerTabView: function(tabView) {
			OC.debug && console.warn('registerTabView is deprecated! It will be removed in nextcloud 20.');
			const enabled = tabView.canDisplay || undefined
			if (tabView.id) {
				OCA.Files.Sidebar.registerTab(new OCA.Files.Sidebar.Tab({
					id: tabView.id,
					name: tabView.getLabel(),
					icon: tabView.getIcon(),
					mount: function(el, fileInfo) {
						tabView.setFileInfo(new OCA.Files.FileInfoModel(fileInfo))
						el.appendChild(tabView.el)
					},
					update: function(fileInfo) {
						tabView.setFileInfo(new OCA.Files.FileInfoModel(fileInfo))
					},
					destroy: function() {
						tabView.el.remove()
					},
					enabled: enabled
				}))
			}
		},

		/**
		 * Register a detail view to be added to all views
		 */
		registerDetailView: function(detailView) {
			OC.debug && console.warn('registerDetailView is deprecated! It will be removed in nextcloud 20.');
			if (detailView.el) {
				OCA.Files.Sidebar.registerSecondaryView(detailView)
			}
		},

		/**
		 * Register a view to be added to the breadcrumb view
		 */
		registerBreadCrumbDetailView: function(detailView) {
			if (this.breadcrumb) {
				this.breadcrumb.addDetailView(detailView);
			}
		},

		/**
		 * Returns the registered detail views.
		 *
		 * @return null|Array<OCA.Files.DetailFileInfoView> an array with the
		 *         registered DetailFileInfoViews, or null if the details view
		 *         is not enabled.
		 */
		getRegisteredDetailViews: function() {
			if (this._detailsView) {
				return this._detailsView.getDetailViews();
			}

			return null;
		},

		registerHeader: function(header) {
			this.headers.push(
				_.defaults(header, { order: 0 })
			);
		},

		registerFooter: function(footer) {
			this.footers.push(
				_.defaults(footer, { order: 0 })
			);
		}
	};

	FileList.MultiSelectMenuActions = {
		ToggleSelectionModeAction: function(fileList) {
			return {
				name: 'toggleSelectionMode',
				displayName: function(context) {
					return t('files', 'Select file range');
				},
				iconClass: 'icon-fullscreen',
				order: 15,
				action: function() {
					fileList._onClickToggleSelectionMode();
				},
			};
		},
	},

	/**
	 * Sort comparators.
	 * @namespace OCA.Files.FileList.Comparators
	 * @private
	 */
	FileList.Comparators = {
		/**
		 * Compares two file infos by name, making directories appear
		 * first.
		 *
		 * @param {OC.Files.FileInfo} fileInfo1 file info
		 * @param {OC.Files.FileInfo} fileInfo2 file info
		 * @return {number} -1 if the first file must appear before the second one,
		 * 0 if they are identify, 1 otherwise.
		 */
		name: function(fileInfo1, fileInfo2) {
			if (fileInfo1.type === 'dir' && fileInfo2.type !== 'dir') {
				return -1;
			}
			if (fileInfo1.type !== 'dir' && fileInfo2.type === 'dir') {
				return 1;
			}
			return OC.Util.naturalSortCompare(fileInfo1.name, fileInfo2.name);
		},
		/**
		 * Compares two file infos by size.
		 *
		 * @param {OC.Files.FileInfo} fileInfo1 file info
		 * @param {OC.Files.FileInfo} fileInfo2 file info
		 * @return {number} -1 if the first file must appear before the second one,
		 * 0 if they are identify, 1 otherwise.
		 */
		size: function(fileInfo1, fileInfo2) {
			return fileInfo1.size - fileInfo2.size;
		},
		/**
		 * Compares two file infos by timestamp.
		 *
		 * @param {OC.Files.FileInfo} fileInfo1 file info
		 * @param {OC.Files.FileInfo} fileInfo2 file info
		 * @return {number} -1 if the first file must appear before the second one,
		 * 0 if they are identify, 1 otherwise.
		 */
		mtime: function(fileInfo1, fileInfo2) {
			return fileInfo1.mtime - fileInfo2.mtime;
		}
	};

	/**
	 * File info attributes.
	 *
	 * @typedef {Object} OC.Files.FileInfo
	 *
	 * @lends OC.Files.FileInfo
	 *
	 * @deprecated use OC.Files.FileInfo instead
	 *
	 */
	OCA.Files.FileInfo = OC.Files.FileInfo;

	OCA.Files.FileList = FileList;
})();

window.addEventListener('DOMContentLoaded', function() {
	// FIXME: unused ?
	OCA.Files.FileList.useUndo = (window.onbeforeunload)?true:false;
	$(window).on('beforeunload', function () {
		if (OCA.Files.FileList.lastAction) {
			OCA.Files.FileList.lastAction();
		}
	});

});


/*
 * Copyright (c) 2018
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

(function() {
	var FileMultiSelectMenu = OC.Backbone.View.extend({
		tagName: 'div',
		className: 'filesSelectMenu popovermenu bubble menu-center',
		_scopes: null,
		initialize: function(menuItems) {
			this._scopes = menuItems;
		},
		events: {
			'click a.action': '_onClickAction'
		},

		/**
		 * Renders the menu with the currently set items
		 */
		render: function() {
			this.$el.html(OCA.Files.Templates['filemultiselectmenu']({
				items: this._scopes
			}));
		},
		/**
		 * Displays the menu under the given element
		 *
		 * @param {OCA.Files.FileActionContext} context context
		 * @param {Object} $trigger trigger element
		 */
		show: function(context) {
			this._context = context;
			this.$el.removeClass('hidden');
			if (window.innerWidth < 480) {
				this.$el.removeClass('menu-center').addClass('menu-right');
			} else {
				this.$el.removeClass('menu-right').addClass('menu-center');
			}
			OC.showMenu(null, this.$el);
			return false;
		},
		toggleItemVisibility: function (itemName, show) {
			if (show) {
				this.$el.find('.item-' + itemName).removeClass('hidden');
			} else {
				this.$el.find('.item-' + itemName).addClass('hidden');
			}
		},
		updateItemText: function (itemName, translation) {
			this.$el.find('.item-' + itemName).find('.label').text(translation);
		},
		toggleLoading: function (itemName, showLoading) {
			var $actionElement = this.$el.find('.item-' + itemName);
			if ($actionElement.length === 0) {
				return;
			}
			var $icon = $actionElement.find('.icon');
			if (showLoading) {
				var $loadingIcon = $('<span class="icon icon-loading-small"></span>');
				$icon.after($loadingIcon);
				$icon.addClass('hidden');
				$actionElement.addClass('disabled');
			} else {
				$actionElement.find('.icon-loading-small').remove();
				$actionElement.find('.icon').removeClass('hidden');
				$actionElement.removeClass('disabled');
			}
		},
		isDisabled: function (itemName) {
			var $actionElement = this.$el.find('.item-' + itemName);
			return $actionElement.hasClass('disabled');
		},
		/**
		 * Event handler whenever an action has been clicked within the menu
		 *
		 * @param {Object} event event object
		 */
		_onClickAction: function (event) {
			var $target = $(event.currentTarget);
			if (!$target.hasClass('menuitem')) {
				$target = $target.closest('.menuitem');
			}

			OC.hideMenus();
			this._context.multiSelectMenuClick(event, $target.data('action'));
			return false;
		}
	});

	OCA.Files.FileMultiSelectMenu = FileMultiSelectMenu;
})(OC, OCA);


/*
 * Copyright (c) 2014
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

/* global getURLParameter */
/**
 * Utility class for file related operations
 */
(function() {
	var Files = {
		// file space size sync
		_updateStorageStatistics: function(currentDir) {
			var state = Files.updateStorageStatistics;
			if (state.dir){
				if (state.dir === currentDir) {
					return;
				}
				// cancel previous call, as it was for another dir
				state.call.abort();
			}
			state.dir = currentDir;
			state.call = $.getJSON(OC.generateUrl('apps/files/api/v1/stats?dir={dir}', {
				dir: currentDir,
			}), function(response) {
				state.dir = null;
				state.call = null;
				Files.updateMaxUploadFilesize(response);
			});
		},
		// update quota
		updateStorageQuotas: function() {
			Files._updateStorageQuotasThrottled();
		},
		_updateStorageQuotas: function() {
			var state = Files.updateStorageQuotas;
			state.call = $.getJSON(OC.generateUrl('apps/files/api/v1/stats'), function(response) {
				Files.updateQuota(response);
			});
		},
		/**
		 * Update storage statistics such as free space, max upload,
		 * etc based on the given directory.
		 *
		 * Note this function is debounced to avoid making too
		 * many ajax calls in a row.
		 *
		 * @param dir directory
		 * @param force whether to force retrieving
		 */
		updateStorageStatistics: function(dir, force) {
			if (!OC.currentUser) {
				return;
			}

			if (force) {
				Files._updateStorageStatistics(dir);
			}
			else {
				Files._updateStorageStatisticsDebounced(dir);
			}
		},

		updateMaxUploadFilesize:function(response) {
			if (response === undefined) {
				return;
			}
			if (response.data !== undefined && response.data.uploadMaxFilesize !== undefined) {
				$('#free_space').val(response.data.freeSpace);
				$('#upload.button').attr('title', response.data.maxHumanFilesize);
				$('#usedSpacePercent').val(response.data.usedSpacePercent);
				$('#usedSpacePercent').data('mount-type', response.data.mountType);
				$('#usedSpacePercent').data('mount-point', response.data.mountPoint);
				$('#owner').val(response.data.owner);
				$('#ownerDisplayName').val(response.data.ownerDisplayName);
				Files.displayStorageWarnings();
				OCA.Files.App.fileList._updateDirectoryPermissions();
			}
			if (response[0] === undefined) {
				return;
			}
			if (response[0].uploadMaxFilesize !== undefined) {
				$('#upload.button').attr('title', response[0].maxHumanFilesize);
				$('#usedSpacePercent').val(response[0].usedSpacePercent);
				Files.displayStorageWarnings();
			}

		},

		updateQuota:function(response) {
			if (response === undefined) {
				return;
			}
			if (response.data !== undefined
			 && response.data.quota !== undefined
			 && response.data.total !== undefined
			 && response.data.used !== undefined
			 && response.data.usedSpacePercent !== undefined) {
				var humanUsed = OC.Util.humanFileSize(response.data.used, true);
				var humanTotal = OC.Util.humanFileSize(response.data.total, true);
				if (response.data.quota > 0) {
					$('#quota').attr('title', t('files', '{used}%', {used: Math.round(response.data.usedSpacePercent)}));
					$('#quota progress').val(response.data.usedSpacePercent);
					$('#quotatext').html(t('files', '{used} of {quota} used', {used: humanUsed, quota: humanTotal}));
				} else {
					$('#quotatext').html(t('files', '{used} used', {used: humanUsed}));
				}
				if (response.data.usedSpacePercent > 80) {
					$('#quota progress').addClass('warn');
				} else {
					$('#quota progress').removeClass('warn');
				}
			}

		},

		/**
		 * Fix path name by removing double slash at the beginning, if any
		 */
		fixPath: function(fileName) {
			if (fileName.substr(0, 2) == '//') {
				return fileName.substr(1);
			}
			return fileName;
		},

		/**
		 * Checks whether the given file name is valid.
		 * @param name file name to check
		 * @return true if the file name is valid.
		 * Throws a string exception with an error message if
		 * the file name is not valid
		 *
		 * NOTE: This function is duplicated in the filepicker inside core/src/OC/dialogs.js
		 */
		isFileNameValid: function (name) {
			var trimmedName = name.trim();
			if (trimmedName === '.' || trimmedName === '..')
			{
				throw t('files', '"{name}" is an invalid file name.', {name: name});
			} else if (trimmedName.length === 0) {
				throw t('files', 'File name cannot be empty.');
			} else if (trimmedName.indexOf('/') !== -1) {
				throw t('files', '"/" is not allowed inside a file name.');
			} else if (!!(trimmedName.match(OC.config.blacklist_files_regex))) {
				throw t('files', '"{name}" is not an allowed filetype', {name: name});
			}

			return true;
		},
		displayStorageWarnings: function() {
			if (!OC.Notification.isHidden()) {
				return;
			}

			var usedSpacePercent = $('#usedSpacePercent').val(),
				owner = $('#owner').val(),
				ownerDisplayName = $('#ownerDisplayName').val(),
				mountType = $('#usedSpacePercent').data('mount-type'),
				mountPoint = $('#usedSpacePercent').data('mount-point');
			if (usedSpacePercent > 98) {
				if (owner !== OC.getCurrentUser().uid) {
					OC.Notification.show(t('files', 'Storage of {owner} is full, files cannot be updated or synced anymore!',
						{owner: ownerDisplayName}), {type: 'error'}
					);
				} else if (mountType === 'group') {
					OC.Notification.show(t('files',
						'Group folder "{mountPoint}" is full, files cannot be updated or synced anymore!',
						{mountPoint: mountPoint}),
						{type: 'error'}
					);
				} else if (mountType === 'external') {
					OC.Notification.show(t('files',
						'External storage "{mountPoint}" is full, files cannot be updated or synced anymore!',
						{mountPoint: mountPoint}),
						{type : 'error'}
					);
				} else {
					OC.Notification.show(t('files',
						'Your storage is full, files cannot be updated or synced anymore!'),
						{type: 'error'}
					);
				}
			} else if (usedSpacePercent > 90) {
				if (owner !== OC.getCurrentUser().uid) {
					OC.Notification.show(t('files', 'Storage of {owner} is almost full ({usedSpacePercent}%).',
						{
							usedSpacePercent: usedSpacePercent,
							owner: ownerDisplayName
						}),
						{
							type: 'error'
						}
					);
				} else if (mountType === 'group') {
					OC.Notification.show(t('files',
						'Group folder "{mountPoint}" is almost full ({usedSpacePercent}%).',
						{mountPoint: mountPoint, usedSpacePercent: usedSpacePercent}),
						{type : 'error'}
					);
				} else if (mountType === 'external') {
					OC.Notification.show(t('files',
						'External storage "{mountPoint}" is almost full ({usedSpacePercent}%).',
						{mountPoint: mountPoint, usedSpacePercent: usedSpacePercent}),
						{type : 'error'}
					);
				} else {
					OC.Notification.show(t('files', 'Your storage is almost full ({usedSpacePercent}%).',
						{usedSpacePercent: usedSpacePercent}),
						{type : 'error'}
					);
				}
			}
		},

		/**
		 * Returns the download URL of the given file(s)
		 * @param {string} filename string or array of file names to download
		 * @param {string} [dir] optional directory in which the file name is, defaults to the current directory
		 * @param {boolean} [isDir=false] whether the given filename is a directory and might need a special URL
		 */
		getDownloadUrl: function(filename, dir, isDir) {
			if (!_.isArray(filename) && !isDir) {
				var pathSections = dir.split('/');
				pathSections.push(filename);
				var encodedPath = '';
				_.each(pathSections, function(section) {
					if (section !== '') {
						encodedPath += '/' + encodeURIComponent(section);
					}
				});
				return OC.linkToRemoteBase('webdav') + encodedPath;
			}

			if (_.isArray(filename)) {
				filename = JSON.stringify(filename);
			}

			var params = {
				dir: dir,
				files: filename
			};
			return this.getAjaxUrl('download', params);
		},

		/**
		 * Returns the ajax URL for a given action
		 * @param action action string
		 * @param params optional params map
		 */
		getAjaxUrl: function(action, params) {
			var q = '';
			if (params) {
				q = '?' + OC.buildQueryString(params);
			}
			return OC.filePath('files', 'ajax', action + '.php') + q;
		},

		/**
		 * Fetch the icon url for the mimetype
		 * @param {string} mime The mimetype
		 * @param {Files~mimeicon} ready Function to call when mimetype is retrieved
		 * @deprecated use OC.MimeType.getIconUrl(mime)
		 */
		getMimeIcon: function(mime, ready) {
			ready(OC.MimeType.getIconUrl(mime));
		},

		/**
		 * Generates a preview URL based on the URL space.
		 * @param urlSpec attributes for the URL
		 * @param {number} urlSpec.x width
		 * @param {number} urlSpec.y height
		 * @param {String} urlSpec.file path to the file
		 * @return preview URL
		 * @deprecated used OCA.Files.FileList.generatePreviewUrl instead
		 */
		generatePreviewUrl: function(urlSpec) {
			OC.debug && console.warn('DEPRECATED: please use generatePreviewUrl() from an OCA.Files.FileList instance');
			return OCA.Files.App.fileList.generatePreviewUrl(urlSpec);
		},

		/**
		 * Lazy load preview
		 * @deprecated used OCA.Files.FileList.lazyLoadPreview instead
		 */
		lazyLoadPreview : function(path, mime, ready, width, height, etag) {
			OC.debug && console.warn('DEPRECATED: please use lazyLoadPreview() from an OCA.Files.FileList instance');
			return FileList.lazyLoadPreview({
				path: path,
				mime: mime,
				callback: ready,
				width: width,
				height: height,
				etag: etag
			});
		},

		/**
		 * Initialize the files view
		 */
		initialize: function() {
			Files.bindKeyboardShortcuts(document, $);

			// drag&drop support using jquery.fileupload
			// TODO use OC.dialogs
			$(document).bind('drop dragover', function (e) {
					e.preventDefault(); // prevent browser from doing anything, if file isn't dropped in dropZone
				});

			// display storage warnings
			setTimeout(Files.displayStorageWarnings, 100);

			// only possible at the moment if user is logged in or the files app is loaded
			if (OC.currentUser && OCA.Files.App && OC.config.session_keepalive) {
				// start on load - we ask the server every 5 minutes
				var func = _.bind(OCA.Files.App.fileList.updateStorageStatistics, OCA.Files.App.fileList);
				var updateStorageStatisticsInterval = 5*60*1000;
				var updateStorageStatisticsIntervalId = setInterval(func, updateStorageStatisticsInterval);

				// TODO: this should also stop when switching to another view
				// Use jquery-visibility to de-/re-activate file stats sync
				if ($.support.pageVisibility) {
					$(document).on({
						'show': function() {
							if (!updateStorageStatisticsIntervalId) {
								updateStorageStatisticsIntervalId = setInterval(func, updateStorageStatisticsInterval);
							}
						},
						'hide': function() {
							clearInterval(updateStorageStatisticsIntervalId);
							updateStorageStatisticsIntervalId = 0;
						}
					});
				}
			}


			$('#webdavurl').on('click touchstart', function () {
				this.focus();
				this.setSelectionRange(0, this.value.length);
			});

			//FIXME scroll to and highlight preselected file
			/*
			if (getURLParameter('scrollto')) {
				FileList.scrollTo(getURLParameter('scrollto'));
			}
			*/
		},

		/**
		 * Handles the download and calls the callback function once the download has started
		 * - browser sends download request and adds parameter with a token
		 * - server notices this token and adds a set cookie to the download response
		 * - browser now adds this cookie for the domain
		 * - JS periodically checks for this cookie and then knows when the download has started to call the callback
		 *
		 * @param {string} url download URL
		 * @param {Function} callback function to call once the download has started
		 */
		handleDownload: function(url, callback) {
			var randomToken = Math.random().toString(36).substring(2),
				checkForDownloadCookie = function() {
					if (!OC.Util.isCookieSetToValue('ocDownloadStarted', randomToken)){
						return false;
					} else {
						callback();
						return true;
					}
				};

			if (url.indexOf('?') >= 0) {
				url += '&';
			} else {
				url += '?';
			}
			OC.redirect(url + 'downloadStartSecret=' + randomToken);
			OC.Util.waitFor(checkForDownloadCookie, 500);
		}
	};

	Files._updateStorageStatisticsDebounced = _.debounce(Files._updateStorageStatistics, 250);
	Files._updateStorageQuotasThrottled = _.throttle(Files._updateStorageQuotas, 30000);
	OCA.Files.Files = Files;
})();

// TODO: move to FileList
var createDragShadow = function(event) {
	// FIXME: inject file list instance somehow
	/* global FileList, Files */

	//select dragged file
	var isDragSelected = $(event.target).parents('tr').find('td input:first').prop('checked');
	if (!isDragSelected) {
		//select dragged file
		FileList._selectFileEl($(event.target).parents('tr:first'), true, false);
	}

	// do not show drag shadow for too many files
	var selectedFiles = _.first(FileList.getSelectedFiles(), FileList.pageSize());
	selectedFiles = _.sortBy(selectedFiles, FileList._fileInfoCompare);

	if (!isDragSelected && selectedFiles.length === 1) {
		//revert the selection
		FileList._selectFileEl($(event.target).parents('tr:first'), false, false);
	}

	// build dragshadow
	var dragshadow = $('<table class="dragshadow"></table>');
	var tbody = $('<tbody></tbody>');
	dragshadow.append(tbody);

	var dir = FileList.getCurrentDirectory();

	$(selectedFiles).each(function(i,elem) {
		// TODO: refactor this with the table row creation code
		var newtr = $('<tr></tr>')
			.attr('data-dir', dir)
			.attr('data-file', elem.name)
			.attr('data-origin', elem.origin);
		newtr.append($('<td class="filename"></td>').text(elem.name).css('background-size', 32));
		newtr.append($('<td class="size"></td>').text(OC.Util.humanFileSize(elem.size)));
		tbody.append(newtr);
		if (elem.type === 'dir') {
			newtr.find('td.filename')
				.css('background-image', 'url(' + OC.MimeType.getIconUrl('folder') + ')');
		} else {
			var path = dir + '/' + elem.name;
			Files.lazyLoadPreview(path, elem.mimetype, function(previewpath) {
				newtr.find('td.filename')
					.css('background-image', 'url(' + previewpath + ')');
			}, null, null, elem.etag);
		}
	});

	return dragshadow;
};

//options for file drag/drop
//start&stop handlers needs some cleaning up
// TODO: move to FileList class
var dragOptions={
	revert: 'invalid',
	revertDuration: 300,
	opacity: 0.7,
	cursorAt: { left: 24, top: 18 },
	helper: createDragShadow,
	cursor: 'move',

	start: function(event, ui){
		var $selectedFiles = $('td.filename input:checkbox:checked');
		if (!$selectedFiles.length) {
			$selectedFiles = $(this);
		}
		$selectedFiles.closest('tr').addClass('animate-opacity dragging');
		$selectedFiles.closest('tr').filter('.ui-droppable').droppable( 'disable' );
		// Show breadcrumbs menu
		$('.crumbmenu').addClass('canDropChildren');

	},
	stop: function(event, ui) {
		var $selectedFiles = $('td.filename input:checkbox:checked');
		if (!$selectedFiles.length) {
			$selectedFiles = $(this);
		}

		var $tr = $selectedFiles.closest('tr');
		$tr.removeClass('dragging');
		$tr.filter('.ui-droppable').droppable( 'enable' );

		setTimeout(function() {
			$tr.removeClass('animate-opacity');
		}, 300);
		// Hide breadcrumbs menu
		$('.crumbmenu').removeClass('canDropChildren');
	},
	drag: function(event, ui) {
		// Prevent scrolling when hovering .files-controls
		if ($(event.originalEvent.target).parents('.files-controls').length > 0) {
			return
		}

		/** @type {JQuery<HTMLDivElement>} */
		const scrollingArea = FileList.$container;

		// Get the top and bottom scroll trigger y positions
		const containerHeight = scrollingArea.innerHeight() ?? 0
		const scrollTriggerArea = Math.min(Math.floor(containerHeight / 2), 100);
		const bottomTriggerY = containerHeight - scrollTriggerArea;
		const topTriggerY = scrollTriggerArea;

		// Get the cursor position relative to the container
		const containerOffset = scrollingArea.offset() ?? {left: 0, top: 0}
		const cursorPositionY = event.pageY - containerOffset.top

		const currentScrollTop = scrollingArea.scrollTop() ?? 0

		if (cursorPositionY < topTriggerY) {
			scrollingArea.scrollTop(currentScrollTop - 10)
		} else if (cursorPositionY > bottomTriggerY) {
			scrollingArea.scrollTop(currentScrollTop + 10)
		}
	}
};
// sane browsers support using the distance option
if ( $('html.ie').length === 0) {
	dragOptions['distance'] = 20;
}

// TODO: move to FileList class
var folderDropOptions = {
	hoverClass: "canDrop",
	drop: function( event, ui ) {
		// don't allow moving a file into a selected folder
		/* global FileList */
		if ($(event.target).parents('tr').find('td input:first').prop('checked') === true) {
			return false;
		}

		var $tr = $(this).closest('tr');
		if (($tr.data('permissions') & OC.PERMISSION_CREATE) === 0) {
			FileList._showPermissionDeniedNotification();
			return false;
		}
		var targetPath = FileList.getCurrentDirectory() + '/' + $tr.data('file');

		var files = FileList.getSelectedFiles();
		if (files.length === 0) {
			// single one selected without checkbox?
			files = _.map(ui.helper.find('tr'), function(el) {
				return FileList.elementToFile($(el));
			});
		}

		FileList.move(_.pluck(files, 'name'), targetPath);
	},
	tolerance: 'pointer'
};

// for backward compatibility
window.Files = OCA.Files.Files;


/**
* ownCloud
*
* @author Vincent Petry
* @copyright 2014 Vincent Petry <pvince81@owncloud.com>
*
* This library is free software; you can redistribute it and/or
* modify it under the terms of the GNU AFFERO GENERAL PUBLIC LICENSE
* License as published by the Free Software Foundation; either
* version 3 of the License, or any later version.
*
* This library is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU AFFERO GENERAL PUBLIC LICENSE for more details.
*
* You should have received a copy of the GNU Affero General Public
* License along with this library.  If not, see <http://www.gnu.org/licenses/>.
*
*/

(function() {
	/**
	 * The FileSummary class encapsulates the file summary values and
	 * the logic to render it in the given container
	 *
	 * @constructs FileSummary
	 * @memberof OCA.Files
	 *
	 * @param $tr table row element
	 * @param {OC.Backbone.Model} [options.filesConfig] files app configuration
	 */
	var FileSummary = function($tr, options) {
		options = options || {};
		var self = this;
		this.$el = $tr;
		var filesConfig = options.config;
		if (filesConfig) {
			this._showHidden = !!filesConfig.show_hidden;
			window._nc_event_bus.subscribe('files:config:updated', ({ key, value }) => {
				if (key === 'show_hidden') {
					self._showHidden = !!value;
					self.update();
				}
			});
		}
		this.clear();
		this.render();
	};

	FileSummary.prototype = {
		_showHidden: null,

		summary: {
			totalFiles: 0,
			totalDirs: 0,
			totalHidden: 0,
			totalSize: 0,
			filter:'',
			sumIsPending:false
		},

		/**
		 * Returns whether the given file info must be hidden
		 *
		 * @param {OC.Files.FileInfo} fileInfo file info
		 *
		 * @return {boolean} true if the file is a hidden file, false otherwise
		 */
		_isHiddenFile: function(file) {
			return file.name && file.name.charAt(0) === '.';
		},

		/**
		 * Adds file
		 * @param {OC.Files.FileInfo} file file to add
		 * @param {boolean} update whether to update the display
		 */
		add: function(file, update) {
			if (file.name && file.name.toLowerCase().indexOf(this.summary.filter) === -1) {
				return;
			}
			if (file.type === 'dir' || file.mime === 'httpd/unix-directory') {
				this.summary.totalDirs++;
			}
			else {
				this.summary.totalFiles++;
			}
			if (this._isHiddenFile(file)) {
				this.summary.totalHidden++;
			}

			var size = parseInt(file.size, 10) || 0;
			if (size >=0) {
				this.summary.totalSize += size;
			} else {
				this.summary.sumIsPending = true;
			}
			if (!!update) {
				this.update();
			}
		},
		/**
		 * Removes file
		 * @param {OC.Files.FileInfo} file file to remove
		 * @param {boolean} update whether to update the display
		 */
		remove: function(file, update) {
			if (file.name && file.name.toLowerCase().indexOf(this.summary.filter) === -1) {
				return;
			}
			if (file.type === 'dir' || file.mime === 'httpd/unix-directory') {
				this.summary.totalDirs--;
			}
			else {
				this.summary.totalFiles--;
			}
			if (this._isHiddenFile(file)) {
				this.summary.totalHidden--;
			}
			var size = parseInt(file.size, 10) || 0;
			if (size >=0) {
				this.summary.totalSize -= size;
			}
			if (!!update) {
				this.update();
			}
		},
		setFilter: function(filter, files){
			this.summary.filter = filter.toLowerCase();
			this.calculate(files);
		},
		/**
		 * Returns the total of files and directories
		 */
		getTotal: function() {
			return this.summary.totalDirs + this.summary.totalFiles;
		},
		/**
		 * Recalculates the summary based on the given files array
		 * @param files array of files
		 */
		calculate: function(files) {
			var file;
			var summary = {
				totalDirs: 0,
				totalFiles: 0,
				totalHidden: 0,
				totalSize: 0,
				filter: this.summary.filter,
				sumIsPending: false
			};

			for (var i = 0; i < files.length; i++) {
				file = files[i];
				if (file.name && file.name.toLowerCase().indexOf(this.summary.filter) === -1) {
					continue;
				}
				if (file.type === 'dir' || file.mime === 'httpd/unix-directory') {
					summary.totalDirs++;
				}
				else {
					summary.totalFiles++;
				}
				if (this._isHiddenFile(file)) {
					summary.totalHidden++;
				}
				var size = parseInt(file.size, 10) || 0;
				if (size >=0) {
					summary.totalSize += size;
				} else {
					summary.sumIsPending = true;
				}
			}
			this.setSummary(summary);
		},
		/**
		 * Clears the summary
		 */
		clear: function() {
			this.calculate([]);
		},
		/**
		 * Sets the current summary values
		 * @param summary map
		 */
		setSummary: function(summary) {
			this.summary = summary;
			if (typeof this.summary.filter === 'undefined') {
				this.summary.filter = '';
			}
			this.update();
		},

		_infoTemplate: function(data) {
			/* NOTE: To update the template make changes in filesummary.handlebars
			 * and run:
			 *
			 * handlebars -n OCA.Files.FileSummary.Templates filesummary.handlebars -f filesummary_template.js
			 */
			return OCA.Files.Templates['filesummary'](_.extend({
				connectorLabel: t('files', '{dirs} and {files}', {dirs: '', files: ''})
			}, data));
		},

		/**
		 * Renders the file summary element
		 */
		update: function() {
			if (!this.$el) {
				return;
			}
			if (!this.summary.totalFiles && !this.summary.totalDirs) {
				this.$el.addClass('hidden');
				return;
			}
			// There's a summary and data -> Update the summary
			this.$el.removeClass('hidden');
			var $dirInfo = this.$el.find('.dirinfo');
			var $fileInfo = this.$el.find('.fileinfo');
			var $connector = this.$el.find('.connector');
			var $filterInfo = this.$el.find('.filter');
			var $hiddenInfo = this.$el.find('.hiddeninfo');

			// Substitute old content with new translations
			$dirInfo.html(n('files', '%n folder', '%n folders', this.summary.totalDirs));
			$fileInfo.html(n('files', '%n file', '%n files', this.summary.totalFiles));
			$hiddenInfo.html(' (' + n('files', 'including %n hidden', 'including %n hidden', this.summary.totalHidden) + ')');
			var fileSize = this.summary.sumIsPending ? t('files', 'Pending') : OC.Util.humanFileSize(this.summary.totalSize);
			this.$el.find('.filesize').html(fileSize);

			// Show only what's necessary (may be hidden)
			if (this.summary.totalDirs === 0) {
				$dirInfo.addClass('hidden');
				$connector.addClass('hidden');
			} else {
				$dirInfo.removeClass('hidden');
			}
			if (this.summary.totalFiles === 0) {
				$fileInfo.addClass('hidden');
				$connector.addClass('hidden');
			} else {
				$fileInfo.removeClass('hidden');
			}
			if (this.summary.totalDirs > 0 && this.summary.totalFiles > 0) {
				$connector.removeClass('hidden');
			}
			$hiddenInfo.toggleClass('hidden', this.summary.totalHidden === 0 || this._showHidden)
			if (this.summary.filter === '') {
				$filterInfo.html('');
				$filterInfo.addClass('hidden');
			} else {
				$filterInfo.html(' ' + n('files', 'matches "{filter}"', 'match "{filter}"', this.summary.totalDirs + this.summary.totalFiles, {filter: this.summary.filter}));
				$filterInfo.removeClass('hidden');
			}
		},
		render: function() {
			if (!this.$el) {
				return;
			}
			var summary = this.summary;

			// don't show the filesize column, if filesize is NaN (e.g. in trashbin)
			var fileSize = '';
			if (!isNaN(summary.totalSize)) {
				fileSize = summary.sumIsPending ? t('files', 'Pending') : OC.Util.humanFileSize(summary.totalSize);
				fileSize = '<td class="filesize">' + fileSize + '</td>';
			}

			var $summary = $(
				'<td class="filesummary">'+ this._infoTemplate() + '</td>' +
				fileSize +
				'<td class="date"></td>'
			);
			this.$el.addClass('hidden');
			this.$el.append($summary);
			this.update();
		}
	};
	OCA.Files.FileSummary = FileSummary;
})();



/*
 * Copyright (c) 2016 Robin Appelman <robin@icewind.nl>
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */


(function (OCA) {

	OCA.Files = OCA.Files || {};

	/**
	 * @namespace OCA.Files.GotoPlugin
	 *
	 */
	OCA.Files.GotoPlugin = {
		name: 'Goto',

		disallowedLists: [
			'files',
			'trashbin'
		],

		attach: function (fileList) {
			if (this.disallowedLists.indexOf(fileList.id) !== -1) {
				return;
			}
			// lists where the "Open" default action is disabled should
			// also have the goto action disabled
			if (fileList._defaultFileActionsDisabled) {
				return
			}
			var fileActions = fileList.fileActions;

			fileActions.registerAction({
				name: 'Goto',
				displayName: t('files', 'View in folder'),
				mime: 'all',
				permissions: OC.PERMISSION_ALL,
				iconClass: 'icon-goto nav-icon-extstoragemounts',
				type: OCA.Files.FileActions.TYPE_DROPDOWN,
				actionHandler: function (fileName, context) {
					var fileModel = context.fileInfoModel;
					OCA.Files.Sidebar.close();
					OCA.Files.App.setActiveView('files', { silent: true });
					OCA.Files.App.fileList.changeDirectory(fileModel.get('path'), true, true).then(function() {
						OCA.Files.App.fileList.scrollTo(fileModel.get('name'));
					});
				},
				render: function (actionSpec, isDefault, context) {
					return fileActions._defaultRenderAction.call(fileActions, actionSpec, isDefault, context)
						.removeClass('permanent');
				}
			});
		}
	};
})(OCA);

OC.Plugins.register('OCA.Files.FileList', OCA.Files.GotoPlugin);



/*!
 * jquery-visibility v1.0.11
 * Page visibility shim for jQuery.
 *
 * Project Website: http://mths.be/visibility
 *
 * @version 1.0.11
 * @license MIT.
 * @author Mathias Bynens - @mathias
 * @author Jan Paepke - @janpaepke
 */
;(function (root, factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(['jquery'], function ($) {
			return factory(root, $);
		});
	} else if (typeof exports === 'object') {
		// Node/CommonJS
		module.exports = factory(root, require('jquery'));
	} else {
		// Browser globals
		factory(root, jQuery);
	}
}(this, function(window, $, undefined) {
	"use strict";

	var
		document = window.document,
		property, // property name of document, that stores page visibility
		vendorPrefixes = ['webkit', 'o', 'ms', 'moz', ''],
		$support = $.support || {},
	// In Opera, `'onfocusin' in document == true`, hence the extra `hasFocus` check to detect IE-like behavior
		eventName = 'onfocusin' in document && 'hasFocus' in document ?
			'focusin focusout' :
			'focus blur';

	var prefix;
	while ((prefix = vendorPrefixes.pop()) !== undefined) {
		property = (prefix ? prefix + 'H': 'h') + 'idden';
		$support.pageVisibility = document[property] !== undefined;
		if ($support.pageVisibility) {
			eventName = prefix + 'visibilitychange';
			break;
		}
	}

	// normalize to and update document hidden property
	function updateState() {
		if (property !== 'hidden') {
			document.hidden = $support.pageVisibility ? document[property] : undefined;
		}
	}
	updateState();

	$(/blur$/.test(eventName) ? window : document).on(eventName, function(event) {
		var type = event.type;
		var originalEvent = event.originalEvent;

		// Avoid errors from triggered native events for which `originalEvent` is
		// not available.
		if (!originalEvent) {
			return;
		}

		var toElement = originalEvent.toElement;

		// If it’s a `{focusin,focusout}` event (IE), `fromElement` and `toElement`
		// should both be `null` or `undefined`; else, the page visibility hasn’t
		// changed, but the user just clicked somewhere in the doc. In IE9, we need
		// to check the `relatedTarget` property instead.
		if (
			!/^focus./.test(type) || (
				toElement === undefined &&
				originalEvent.fromElement === undefined &&
				originalEvent.relatedTarget === undefined
			)
		) {
			$(document).triggerHandler(
				property && document[property] || /^(?:blur|focusout)$/.test(type) ?
					'hide' :
					'show'
			);
		}
		// and update the current state
		updateState();
	});
}));


/*
 * jQuery File Upload Plugin 9.12.5
 * https://github.com/blueimp/jQuery-File-Upload
 *
 * Copyright 2010, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

/* jshint nomen:false */
/* global define, require, window, document, location, Blob, FormData */

;(function (factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // Register as an anonymous AMD module:
        define([
            'jquery',
            'jquery.ui.widget'
        ], factory);
    } else if (typeof exports === 'object') {
        // Node/CommonJS:
        factory(
            require('jquery'),
            require('./vendor/jquery.ui.widget')
        );
    } else {
        // Browser globals:
        factory(window.jQuery);
    }
}(function ($) {
    'use strict';

    // Detect file input support, based on
    // http://viljamis.com/blog/2012/file-upload-support-on-mobile/
    $.support.fileInput = !(new RegExp(
        // Handle devices which give false positives for the feature detection:
        '(Android (1\\.[0156]|2\\.[01]))' +
            '|(Windows Phone (OS 7|8\\.0))|(XBLWP)|(ZuneWP)|(WPDesktop)' +
            '|(w(eb)?OSBrowser)|(webOS)' +
            '|(Kindle/(1\\.0|2\\.[05]|3\\.0))'
    ).test(window.navigator.userAgent) ||
        // Feature detection for all other devices:
        $('<input type="file">').prop('disabled'));

    // The FileReader API is not actually used, but works as feature detection,
    // as some Safari versions (5?) support XHR file uploads via the FormData API,
    // but not non-multipart XHR file uploads.
    // window.XMLHttpRequestUpload is not available on IE10, so we check for
    // window.ProgressEvent instead to detect XHR2 file upload capability:
    $.support.xhrFileUpload = !!(window.ProgressEvent && window.FileReader);
    $.support.xhrFormDataFileUpload = !!window.FormData;

    // Detect support for Blob slicing (required for chunked uploads):
    $.support.blobSlice = window.Blob && (Blob.prototype.slice ||
        Blob.prototype.webkitSlice || Blob.prototype.mozSlice);

    // Helper function to create drag handlers for dragover/dragenter/dragleave:
    function getDragHandler(type) {
        var isDragOver = type === 'dragover';
        return function (e) {
            e.dataTransfer = e.originalEvent && e.originalEvent.dataTransfer;
            var dataTransfer = e.dataTransfer;
            if (dataTransfer && $.inArray('Files', dataTransfer.types) !== -1 &&
                    this._trigger(
                        type,
                        $.Event(type, {delegatedEvent: e})
                    ) !== false) {
                e.preventDefault();
                if (isDragOver) {
                    dataTransfer.dropEffect = 'copy';
                }
            }
        };
    }

    // The fileupload widget listens for change events on file input fields defined
    // via fileInput setting and paste or drop events of the given dropZone.
    // In addition to the default jQuery Widget methods, the fileupload widget
    // exposes the "add" and "send" methods, to add or directly send files using
    // the fileupload API.
    // By default, files added via file input selection, paste, drag & drop or
    // "add" method are uploaded immediately, but it is possible to override
    // the "add" callback option to queue file uploads.
    $.widget('blueimp.fileupload', {

        options: {
            // The drop target element(s), by the default the complete document.
            // Set to null to disable drag & drop support:
            dropZone: $(document),
            // The paste target element(s), by the default undefined.
            // Set to a DOM node or jQuery object to enable file pasting:
            pasteZone: undefined,
            // The file input field(s), that are listened to for change events.
            // If undefined, it is set to the file input fields inside
            // of the widget element on plugin initialization.
            // Set to null to disable the change listener.
            fileInput: undefined,
            // By default, the file input field is replaced with a clone after
            // each input field change event. This is required for iframe transport
            // queues and allows change events to be fired for the same file
            // selection, but can be disabled by setting the following option to false:
            replaceFileInput: true,
            // The parameter name for the file form data (the request argument name).
            // If undefined or empty, the name property of the file input field is
            // used, or "files[]" if the file input name property is also empty,
            // can be a string or an array of strings:
            paramName: undefined,
            // By default, each file of a selection is uploaded using an individual
            // request for XHR type uploads. Set to false to upload file
            // selections in one request each:
            singleFileUploads: true,
            // To limit the number of files uploaded with one XHR request,
            // set the following option to an integer greater than 0:
            limitMultiFileUploads: undefined,
            // The following option limits the number of files uploaded with one
            // XHR request to keep the request size under or equal to the defined
            // limit in bytes:
            limitMultiFileUploadSize: undefined,
            // Multipart file uploads add a number of bytes to each uploaded file,
            // therefore the following option adds an overhead for each file used
            // in the limitMultiFileUploadSize configuration:
            limitMultiFileUploadSizeOverhead: 512,
            // Set the following option to true to issue all file upload requests
            // in a sequential order:
            sequentialUploads: false,
            // To limit the number of concurrent uploads,
            // set the following option to an integer greater than 0:
            limitConcurrentUploads: undefined,
            // Set the following option to true to force iframe transport uploads:
            forceIframeTransport: false,
            // Set the following option to the location of a redirect url on the
            // origin server, for cross-domain iframe transport uploads:
            redirect: undefined,
            // The parameter name for the redirect url, sent as part of the form
            // data and set to 'redirect' if this option is empty:
            redirectParamName: undefined,
            // Set the following option to the location of a postMessage window,
            // to enable postMessage transport uploads:
            postMessage: undefined,
            // By default, XHR file uploads are sent as multipart/form-data.
            // The iframe transport is always using multipart/form-data.
            // Set to false to enable non-multipart XHR uploads:
            multipart: true,
            // To upload large files in smaller chunks, set the following option
            // to a preferred maximum chunk size. If set to 0, null or undefined,
            // or the browser does not support the required Blob API, files will
            // be uploaded as a whole.
            maxChunkSize: undefined,
            // When a non-multipart upload or a chunked multipart upload has been
            // aborted, this option can be used to resume the upload by setting
            // it to the size of the already uploaded bytes. This option is most
            // useful when modifying the options object inside of the "add" or
            // "send" callbacks, as the options are cloned for each file upload.
            uploadedBytes: undefined,
            // By default, failed (abort or error) file uploads are removed from the
            // global progress calculation. Set the following option to false to
            // prevent recalculating the global progress data:
            recalculateProgress: true,
            // Interval in milliseconds to calculate and trigger progress events:
            progressInterval: 100,
            // Interval in milliseconds to calculate progress bitrate:
            bitrateInterval: 500,
            // By default, uploads are started automatically when adding files:
            autoUpload: true,

            // Error and info messages:
            messages: {
                uploadedBytes: 'Uploaded bytes exceed file size'
            },

            // Translation function, gets the message key to be translated
            // and an object with context specific data as arguments:
            i18n: function (message, context) {
                message = this.messages[message] || message.toString();
                if (context) {
                    $.each(context, function (key, value) {
                        message = message.replace('{' + key + '}', value);
                    });
                }
                return message;
            },

            // Additional form data to be sent along with the file uploads can be set
            // using this option, which accepts an array of objects with name and
            // value properties, a function returning such an array, a FormData
            // object (for XHR file uploads), or a simple object.
            // The form of the first fileInput is given as parameter to the function:
            formData: function (form) {
                return form.serializeArray();
            },

            // The add callback is invoked as soon as files are added to the fileupload
            // widget (via file input selection, drag & drop, paste or add API call).
            // If the singleFileUploads option is enabled, this callback will be
            // called once for each file in the selection for XHR file uploads, else
            // once for each file selection.
            //
            // The upload starts when the submit method is invoked on the data parameter.
            // The data object contains a files property holding the added files
            // and allows you to override plugin options as well as define ajax settings.
            //
            // Listeners for this callback can also be bound the following way:
            // .bind('fileuploadadd', func);
            //
            // data.submit() returns a Promise object and allows to attach additional
            // handlers using jQuery's Deferred callbacks:
            // data.submit().done(func).fail(func).always(func);
            add: function (e, data) {
                if (e.isDefaultPrevented()) {
                    return false;
                }
                if (data.autoUpload || (data.autoUpload !== false &&
                        $(this).fileupload('option', 'autoUpload'))) {
                    data.process().done(function () {
                        data.submit();
                    });
                }
            },

            // Other callbacks:

            // Callback for the submit event of each file upload:
            // submit: function (e, data) {}, // .bind('fileuploadsubmit', func);

            // Callback for the start of each file upload request:
            // send: function (e, data) {}, // .bind('fileuploadsend', func);

            // Callback for successful uploads:
            // done: function (e, data) {}, // .bind('fileuploaddone', func);

            // Callback for failed (abort or error) uploads:
            // fail: function (e, data) {}, // .bind('fileuploadfail', func);

            // Callback for completed (success, abort or error) requests:
            // always: function (e, data) {}, // .bind('fileuploadalways', func);

            // Callback for upload progress events:
            // progress: function (e, data) {}, // .bind('fileuploadprogress', func);

            // Callback for global upload progress events:
            // progressall: function (e, data) {}, // .bind('fileuploadprogressall', func);

            // Callback for uploads start, equivalent to the global ajaxStart event:
            // start: function (e) {}, // .bind('fileuploadstart', func);

            // Callback for uploads stop, equivalent to the global ajaxStop event:
            // stop: function (e) {}, // .bind('fileuploadstop', func);

            // Callback for change events of the fileInput(s):
            // change: function (e, data) {}, // .bind('fileuploadchange', func);

            // Callback for paste events to the pasteZone(s):
            // paste: function (e, data) {}, // .bind('fileuploadpaste', func);

            // Callback for drop events of the dropZone(s):
            // drop: function (e, data) {}, // .bind('fileuploaddrop', func);

            // Callback for drop events of the dropZone(s) when there are no files:
            // dropnofiles: function (e) {}, // .bind('fileuploaddropnofiles', func);

            // Callback for dragover events of the dropZone(s):
            // dragover: function (e) {}, // .bind('fileuploaddragover', func);

            // Callback for the start of each chunk upload request:
            // chunksend: function (e, data) {}, // .bind('fileuploadchunksend', func);

            // Callback for successful chunk uploads:
            // chunkdone: function (e, data) {}, // .bind('fileuploadchunkdone', func);

            // Callback for failed (abort or error) chunk uploads:
            // chunkfail: function (e, data) {}, // .bind('fileuploadchunkfail', func);

            // Callback for completed (success, abort or error) chunk upload requests:
            // chunkalways: function (e, data) {}, // .bind('fileuploadchunkalways', func);

            // The plugin options are used as settings object for the ajax calls.
            // The following are jQuery ajax settings required for the file uploads:
            processData: false,
            contentType: false,
            cache: false,
            timeout: 0
        },

        // A list of options that require reinitializing event listeners and/or
        // special initialization code:
        _specialOptions: [
            'fileInput',
            'dropZone',
            'pasteZone',
            'multipart',
            'forceIframeTransport'
        ],

        _blobSlice: $.support.blobSlice && function () {
            var slice = this.slice || this.webkitSlice || this.mozSlice;
            return slice.apply(this, arguments);
        },

        _BitrateTimer: function () {
            this.timestamp = ((Date.now) ? Date.now() : (new Date()).getTime());
            this.loaded = 0;
            this.bitrate = 0;
            this.getBitrate = function (now, loaded, interval) {
                var timeDiff = now - this.timestamp;
                if (!this.bitrate || !interval || timeDiff > interval) {
                    this.bitrate = (loaded - this.loaded) * (1000 / timeDiff) * 8;
                    this.loaded = loaded;
                    this.timestamp = now;
                }
                return this.bitrate;
            };
        },

        _isXHRUpload: function (options) {
            return !options.forceIframeTransport &&
                ((!options.multipart && $.support.xhrFileUpload) ||
                $.support.xhrFormDataFileUpload);
        },

        _getFormData: function (options) {
            var formData;
            if ($.type(options.formData) === 'function') {
                return options.formData(options.form);
            }
            if ($.isArray(options.formData)) {
                return options.formData;
            }
            if ($.type(options.formData) === 'object') {
                formData = [];
                $.each(options.formData, function (name, value) {
                    formData.push({name: name, value: value});
                });
                return formData;
            }
            return [];
        },

        _getTotal: function (files) {
            var total = 0;
            $.each(files, function (index, file) {
                total += file.size || 1;
            });
            return total;
        },

        _initProgressObject: function (obj) {
            var progress = {
                loaded: 0,
                total: 0,
                bitrate: 0
            };
            if (obj._progress) {
                $.extend(obj._progress, progress);
            } else {
                obj._progress = progress;
            }
        },

        _initResponseObject: function (obj) {
            var prop;
            if (obj._response) {
                for (prop in obj._response) {
                    if (obj._response.hasOwnProperty(prop)) {
                        delete obj._response[prop];
                    }
                }
            } else {
                obj._response = {};
            }
        },

        _onProgress: function (e, data) {
            if (e.lengthComputable) {
                var now = ((Date.now) ? Date.now() : (new Date()).getTime()),
                    loaded;
                if (data._time && data.progressInterval &&
                        (now - data._time < data.progressInterval) &&
                        e.loaded !== e.total) {
                    return;
                }
                data._time = now;
                loaded = Math.floor(
                    e.loaded / e.total * (data.chunkSize || data._progress.total)
                ) + (data.uploadedBytes || 0);
                // Add the difference from the previously loaded state
                // to the global loaded counter:
                this._progress.loaded += (loaded - data._progress.loaded);
                this._progress.bitrate = this._bitrateTimer.getBitrate(
                    now,
                    this._progress.loaded,
                    data.bitrateInterval
                );
                data._progress.loaded = data.loaded = loaded;
                data._progress.bitrate = data.bitrate = data._bitrateTimer.getBitrate(
                    now,
                    loaded,
                    data.bitrateInterval
                );
                // Trigger a custom progress event with a total data property set
                // to the file size(s) of the current upload and a loaded data
                // property calculated accordingly:
                this._trigger(
                    'progress',
                    $.Event('progress', {delegatedEvent: e}),
                    data
                );
                // Trigger a global progress event for all current file uploads,
                // including ajax calls queued for sequential file uploads:
                this._trigger(
                    'progressall',
                    $.Event('progressall', {delegatedEvent: e}),
                    this._progress
                );
            }
        },

        _initProgressListener: function (options) {
            var that = this,
                xhr = options.xhr ? options.xhr() : $.ajaxSettings.xhr();
            // Access to the native XHR object is required to add event listeners
            // for the upload progress event:
            if (xhr.upload) {
                $(xhr.upload).bind('progress', function (e) {
                    var oe = e.originalEvent;
                    // Make sure the progress event properties get copied over:
                    e.lengthComputable = oe.lengthComputable;
                    e.loaded = oe.loaded;
                    e.total = oe.total;
                    that._onProgress(e, options);
                });
                options.xhr = function () {
                    return xhr;
                };
            }
        },

        _isInstanceOf: function (type, obj) {
            // Cross-frame instanceof check
            return Object.prototype.toString.call(obj) === '[object ' + type + ']';
        },

        _initXHRData: function (options) {
            var that = this,
                formData,
                file = options.files[0],
                // Ignore non-multipart setting if not supported:
                multipart = options.multipart || !$.support.xhrFileUpload,
                paramName = $.type(options.paramName) === 'array' ?
                    options.paramName[0] : options.paramName;
            options.headers = $.extend({}, options.headers);
            if (options.contentRange) {
                options.headers['Content-Range'] = options.contentRange;
            }
            if (!multipart || options.blob || !this._isInstanceOf('File', file)) {
                options.headers['Content-Disposition'] = 'attachment; filename="' +
                    encodeURI(file.name) + '"';
            }
            if (!multipart) {
                options.contentType = file.type || 'application/octet-stream';
                options.data = options.blob || file;
            } else if ($.support.xhrFormDataFileUpload) {
                if (options.postMessage) {
                    // window.postMessage does not allow sending FormData
                    // objects, so we just add the File/Blob objects to
                    // the formData array and let the postMessage window
                    // create the FormData object out of this array:
                    formData = this._getFormData(options);
                    if (options.blob) {
                        formData.push({
                            name: paramName,
                            value: options.blob
                        });
                    } else {
                        $.each(options.files, function (index, file) {
                            formData.push({
                                name: ($.type(options.paramName) === 'array' &&
                                    options.paramName[index]) || paramName,
                                value: file
                            });
                        });
                    }
                } else {
                    if (that._isInstanceOf('FormData', options.formData)) {
                        formData = options.formData;
                    } else {
                        formData = new FormData();
                        $.each(this._getFormData(options), function (index, field) {
                            formData.append(field.name, field.value);
                        });
                    }
                    if (options.blob) {
                        formData.append(paramName, options.blob, file.name);
                    } else {
                        $.each(options.files, function (index, file) {
                            // This check allows the tests to run with
                            // dummy objects:
                            if (that._isInstanceOf('File', file) ||
                                    that._isInstanceOf('Blob', file)) {
                                formData.append(
                                    ($.type(options.paramName) === 'array' &&
                                        options.paramName[index]) || paramName,
                                    file,
                                    file.uploadName || file.name
                                );
                            }
                        });
                    }
                }
                options.data = formData;
            }
            // Blob reference is not needed anymore, free memory:
            options.blob = null;
        },

        _initIframeSettings: function (options) {
            var targetHost = $('<a></a>').prop('href', options.url).prop('host');
            // Setting the dataType to iframe enables the iframe transport:
            options.dataType = 'iframe ' + (options.dataType || '');
            // The iframe transport accepts a serialized array as form data:
            options.formData = this._getFormData(options);
            // Add redirect url to form data on cross-domain uploads:
            if (options.redirect && targetHost && targetHost !== location.host) {
                options.formData.push({
                    name: options.redirectParamName || 'redirect',
                    value: options.redirect
                });
            }
        },

        _initDataSettings: function (options) {
            if (this._isXHRUpload(options)) {
                if (!this._chunkedUpload(options, true)) {
                    if (!options.data) {
                        this._initXHRData(options);
                    }
                    this._initProgressListener(options);
                }
                if (options.postMessage) {
                    // Setting the dataType to postmessage enables the
                    // postMessage transport:
                    options.dataType = 'postmessage ' + (options.dataType || '');
                }
            } else {
                this._initIframeSettings(options);
            }
        },

        _getParamName: function (options) {
            var fileInput = $(options.fileInput),
                paramName = options.paramName;
            if (!paramName) {
                paramName = [];
                fileInput.each(function () {
                    var input = $(this),
                        name = input.prop('name') || 'files[]',
                        i = (input.prop('files') || [1]).length;
                    while (i) {
                        paramName.push(name);
                        i -= 1;
                    }
                });
                if (!paramName.length) {
                    paramName = [fileInput.prop('name') || 'files[]'];
                }
            } else if (!$.isArray(paramName)) {
                paramName = [paramName];
            }
            return paramName;
        },

        _initFormSettings: function (options) {
            // Retrieve missing options from the input field and the
            // associated form, if available:
            if (!options.form || !options.form.length) {
                options.form = $(options.fileInput.prop('form'));
                // If the given file input doesn't have an associated form,
                // use the default widget file input's form:
                if (!options.form.length) {
                    options.form = $(this.options.fileInput.prop('form'));
                }
            }
            options.paramName = this._getParamName(options);
            if (!options.url) {
                options.url = options.form.prop('action') || location.href;
            }
            // The HTTP request method must be "POST" or "PUT":
            options.type = (options.type ||
                ($.type(options.form.prop('method')) === 'string' &&
                    options.form.prop('method')) || ''
                ).toUpperCase();
            if (options.type !== 'POST' && options.type !== 'PUT' &&
                    options.type !== 'PATCH') {
                options.type = 'POST';
            }
            if (!options.formAcceptCharset) {
                options.formAcceptCharset = options.form.attr('accept-charset');
            }
        },

        _getAJAXSettings: function (data) {
            var options = $.extend({}, this.options, data);
            this._initFormSettings(options);
            this._initDataSettings(options);
            return options;
        },

        // jQuery 1.6 doesn't provide .state(),
        // while jQuery 1.8+ removed .isRejected() and .isResolved():
        _getDeferredState: function (deferred) {
            if (deferred.state) {
                return deferred.state();
            }
            if (deferred.isResolved()) {
                return 'resolved';
            }
            if (deferred.isRejected()) {
                return 'rejected';
            }
            return 'pending';
        },

        // Maps jqXHR callbacks to the equivalent
        // methods of the given Promise object:
        _enhancePromise: function (promise) {
            promise.success = promise.done;
            promise.error = promise.fail;
            promise.complete = promise.always;
            return promise;
        },

        // Creates and returns a Promise object enhanced with
        // the jqXHR methods abort, success, error and complete:
        _getXHRPromise: function (resolveOrReject, context, args) {
            var dfd = $.Deferred(),
                promise = dfd.promise();
            context = context || this.options.context || promise;
            if (resolveOrReject === true) {
                dfd.resolveWith(context, args);
            } else if (resolveOrReject === false) {
                dfd.rejectWith(context, args);
            }
            promise.abort = dfd.promise;
            return this._enhancePromise(promise);
        },

        // Adds convenience methods to the data callback argument:
        _addConvenienceMethods: function (e, data) {
            var that = this,
                getPromise = function (args) {
                    return $.Deferred().resolveWith(that, args).promise();
                };
            data.process = function (resolveFunc, rejectFunc) {
                if (resolveFunc || rejectFunc) {
                    data._processQueue = this._processQueue =
                        (this._processQueue || getPromise([this])).then(
                            function () {
                                if (data.errorThrown) {
                                    return $.Deferred()
                                        .rejectWith(that, [data]).promise();
                                }
                                return getPromise(arguments);
                            }
                        ).then(resolveFunc, rejectFunc);
                }
                return this._processQueue || getPromise([this]);
            };
            data.submit = function () {
                if (this.state() !== 'pending') {
                    data.jqXHR = this.jqXHR =
                        (that._trigger(
                            'submit',
                            $.Event('submit', {delegatedEvent: e}),
                            this
                        ) !== false) && that._onSend(e, this);
                }
                return this.jqXHR || that._getXHRPromise();
            };
            data.abort = function () {
                if (this.jqXHR) {
                    return this.jqXHR.abort();
                }
                this.errorThrown = 'abort';
                that._trigger('fail', null, this);
                return that._getXHRPromise(false);
            };
            data.state = function () {
                if (this.jqXHR) {
                    return that._getDeferredState(this.jqXHR);
                }
                if (this._processQueue) {
                    return that._getDeferredState(this._processQueue);
                }
            };
            data.processing = function () {
                return !this.jqXHR && this._processQueue && that
                    ._getDeferredState(this._processQueue) === 'pending';
            };
            data.progress = function () {
                return this._progress;
            };
            data.response = function () {
                return this._response;
            };
        },

        // Parses the Range header from the server response
        // and returns the uploaded bytes:
        _getUploadedBytes: function (jqXHR) {
            var range = jqXHR.getResponseHeader('Range'),
                parts = range && range.split('-'),
                upperBytesPos = parts && parts.length > 1 &&
                    parseInt(parts[1], 10);
            return upperBytesPos && upperBytesPos + 1;
        },

        // Uploads a file in multiple, sequential requests
        // by splitting the file up in multiple blob chunks.
        // If the second parameter is true, only tests if the file
        // should be uploaded in chunks, but does not invoke any
        // upload requests:
        _chunkedUpload: function (options, testOnly) {
            options.uploadedBytes = options.uploadedBytes || 0;
            var that = this,
                file = options.files[0],
                fs = file.size,
                ub = options.uploadedBytes,
                mcs = options.maxChunkSize || fs,
                slice = this._blobSlice,
                dfd = $.Deferred(),
                promise = dfd.promise(),
                jqXHR,
                upload;

            // Dynamically adjust the chunk size for Chunking V2 to fit into the 10000 chunk limit
            if (file.size/mcs > 10000) {
                mcs = Math.ceil(file.size/10000)
            }

            if (!(this._isXHRUpload(options) && slice && (ub || mcs < fs)) ||
                    options.data) {
                return false;
            }
            if (testOnly) {
                return true;
            }
            if (ub >= fs) {
                file.error = options.i18n('uploadedBytes');
                return this._getXHRPromise(
                    false,
                    options.context,
                    [null, 'error', file.error]
                );
            }
            // The chunk upload method:
            upload = function () {
                // Clone the options object for each chunk upload:
                var o = $.extend({}, options),
                    currentLoaded = o._progress.loaded;
                o.blob = slice.call(
                    file,
                    ub,
                    ub + mcs,
                    file.type
                );
                // Store the current chunk size, as the blob itself
                // will be dereferenced after data processing:
                o.chunkSize = o.blob.size;
                // Expose the chunk bytes position range:
                o.contentRange = 'bytes ' + ub + '-' +
                    (ub + o.chunkSize - 1) + '/' + fs;
                // Process the upload data (the blob and potential form data):
                that._initXHRData(o);
                // Add progress listeners for this chunk upload:
                that._initProgressListener(o);
                jqXHR = ((that._trigger('chunksend', null, o) !== false && $.ajax(o)) ||
                        that._getXHRPromise(false, o.context))
                    .done(function (result, textStatus, jqXHR) {
                        ub = that._getUploadedBytes(jqXHR) ||
                            (ub + o.chunkSize);
                        // Create a progress event if no final progress event
                        // with loaded equaling total has been triggered
                        // for this chunk:
                        if (currentLoaded + o.chunkSize - o._progress.loaded) {
                            that._onProgress($.Event('progress', {
                                lengthComputable: true,
                                loaded: ub - o.uploadedBytes,
                                total: ub - o.uploadedBytes
                            }), o);
                        }
                        options.uploadedBytes = o.uploadedBytes = ub;
                        o.result = result;
                        o.textStatus = textStatus;
                        o.jqXHR = jqXHR;
                        that._trigger('chunkdone', null, o);
                        that._trigger('chunkalways', null, o);
                        if (ub < fs) {
                            // File upload not yet complete,
                            // continue with the next chunk:
                            upload();
                        } else {
                            dfd.resolveWith(
                                o.context,
                                [result, textStatus, jqXHR]
                            );
                        }
                    })
                    .fail(function (jqXHR, textStatus, errorThrown) {
                        o.jqXHR = jqXHR;
                        o.textStatus = textStatus;
                        o.errorThrown = errorThrown;
                        that._trigger('chunkfail', null, o);
                        that._trigger('chunkalways', null, o);
                        dfd.rejectWith(
                            o.context,
                            [jqXHR, textStatus, errorThrown]
                        );
                    });
            };
            this._enhancePromise(promise);
            promise.abort = function () {
                return jqXHR.abort();
            };
            upload();
            return promise;
        },

        _beforeSend: function (e, data) {
            if (this._active === 0) {
                // the start callback is triggered when an upload starts
                // and no other uploads are currently running,
                // equivalent to the global ajaxStart event:
                this._trigger('start');
                // Set timer for global bitrate progress calculation:
                this._bitrateTimer = new this._BitrateTimer();
                // Reset the global progress values:
                this._progress.loaded = this._progress.total = 0;
                this._progress.bitrate = 0;
            }
            // Make sure the container objects for the .response() and
            // .progress() methods on the data object are available
            // and reset to their initial state:
            this._initResponseObject(data);
            this._initProgressObject(data);
            data._progress.loaded = data.loaded = data.uploadedBytes || 0;
            data._progress.total = data.total = this._getTotal(data.files) || 1;
            data._progress.bitrate = data.bitrate = 0;
            this._active += 1;
            // Initialize the global progress values:
            this._progress.loaded += data.loaded;
            this._progress.total += data.total;
        },

        _onDone: function (result, textStatus, jqXHR, options) {
            var total = options._progress.total,
                response = options._response;
            if (options._progress.loaded < total) {
                // Create a progress event if no final progress event
                // with loaded equaling total has been triggered:
                this._onProgress($.Event('progress', {
                    lengthComputable: true,
                    loaded: total,
                    total: total
                }), options);
            }
            response.result = options.result = result;
            response.textStatus = options.textStatus = textStatus;
            response.jqXHR = options.jqXHR = jqXHR;
            this._trigger('done', null, options);
        },

        _onFail: function (jqXHR, textStatus, errorThrown, options) {
            var response = options._response;
            if (options.recalculateProgress) {
                // Remove the failed (error or abort) file upload from
                // the global progress calculation:
                this._progress.loaded -= options._progress.loaded;
                this._progress.total -= options._progress.total;
            }
            response.jqXHR = options.jqXHR = jqXHR;
            response.textStatus = options.textStatus = textStatus;
            response.errorThrown = options.errorThrown = errorThrown;
            this._trigger('fail', null, options);
        },

        _onAlways: function (jqXHRorResult, textStatus, jqXHRorError, options) {
            // jqXHRorResult, textStatus and jqXHRorError are added to the
            // options object via done and fail callbacks
            this._trigger('always', null, options);
        },

        _onSend: function (e, data) {
            if (!data.submit) {
                this._addConvenienceMethods(e, data);
            }
            var that = this,
                jqXHR,
                aborted,
                slot,
                pipe,
                options = that._getAJAXSettings(data),
                send = function () {
                    that._sending += 1;
                    // Set timer for bitrate progress calculation:
                    options._bitrateTimer = new that._BitrateTimer();
                    jqXHR = jqXHR || (
                        ((aborted || that._trigger(
                            'send',
                            $.Event('send', {delegatedEvent: e}),
                            options
                        ) === false) &&
                        that._getXHRPromise(false, options.context, aborted)) ||
                        that._chunkedUpload(options) || $.ajax(options)
                    ).done(function (result, textStatus, jqXHR) {
                        that._onDone(result, textStatus, jqXHR, options);
                    }).fail(function (jqXHR, textStatus, errorThrown) {
                        that._onFail(jqXHR, textStatus, errorThrown, options);
                    }).always(function (jqXHRorResult, textStatus, jqXHRorError) {
                        that._onAlways(
                            jqXHRorResult,
                            textStatus,
                            jqXHRorError,
                            options
                        );
                        that._sending -= 1;
                        that._active -= 1;
                        if (options.limitConcurrentUploads &&
                                options.limitConcurrentUploads > that._sending) {
                            // Start the next queued upload,
                            // that has not been aborted:
                            var nextSlot = that._slots.shift();
                            while (nextSlot) {
                                if (that._getDeferredState(nextSlot) === 'pending') {
                                    nextSlot.resolve();
                                    break;
                                }
                                nextSlot = that._slots.shift();
                            }
                        }
                        if (that._active === 0) {
                            // The stop callback is triggered when all uploads have
                            // been completed, equivalent to the global ajaxStop event:
                            that._trigger('stop');
                        }
                    });
                    return jqXHR;
                };
            this._beforeSend(e, options);
            if (this.options.sequentialUploads ||
                    (this.options.limitConcurrentUploads &&
                    this.options.limitConcurrentUploads <= this._sending)) {
                if (this.options.limitConcurrentUploads > 1) {
                    slot = $.Deferred();
                    this._slots.push(slot);
                    pipe = slot.then(send);
                } else {
                    this._sequence = this._sequence.then(send, send);
                    pipe = this._sequence;
                }
                // Return the piped Promise object, enhanced with an abort method,
                // which is delegated to the jqXHR object of the current upload,
                // and jqXHR callbacks mapped to the equivalent Promise methods:
                pipe.abort = function () {
                    aborted = [undefined, 'abort', 'abort'];
                    if (!jqXHR) {
                        if (slot) {
                            slot.rejectWith(options.context, aborted);
                        }
                        return send();
                    }
                    return jqXHR.abort();
                };
                return this._enhancePromise(pipe);
            }
            return send();
        },

        _onAdd: function (e, data) {
            var that = this,
                result = true,
                options = $.extend({}, this.options, data),
                files = data.files,
                filesLength = files.length,
                limit = options.limitMultiFileUploads,
                limitSize = options.limitMultiFileUploadSize,
                overhead = options.limitMultiFileUploadSizeOverhead,
                batchSize = 0,
                paramName = this._getParamName(options),
                paramNameSet,
                paramNameSlice,
                fileSet,
                i,
                j = 0;
            if (!filesLength) {
                return false;
            }
            if (limitSize && files[0].size === undefined) {
                limitSize = undefined;
            }
            if (!(options.singleFileUploads || limit || limitSize) ||
                    !this._isXHRUpload(options)) {
                fileSet = [files];
                paramNameSet = [paramName];
            } else if (!(options.singleFileUploads || limitSize) && limit) {
                fileSet = [];
                paramNameSet = [];
                for (i = 0; i < filesLength; i += limit) {
                    fileSet.push(files.slice(i, i + limit));
                    paramNameSlice = paramName.slice(i, i + limit);
                    if (!paramNameSlice.length) {
                        paramNameSlice = paramName;
                    }
                    paramNameSet.push(paramNameSlice);
                }
            } else if (!options.singleFileUploads && limitSize) {
                fileSet = [];
                paramNameSet = [];
                for (i = 0; i < filesLength; i = i + 1) {
                    batchSize += files[i].size + overhead;
                    if (i + 1 === filesLength ||
                            ((batchSize + files[i + 1].size + overhead) > limitSize) ||
                            (limit && i + 1 - j >= limit)) {
                        fileSet.push(files.slice(j, i + 1));
                        paramNameSlice = paramName.slice(j, i + 1);
                        if (!paramNameSlice.length) {
                            paramNameSlice = paramName;
                        }
                        paramNameSet.push(paramNameSlice);
                        j = i + 1;
                        batchSize = 0;
                    }
                }
            } else {
                paramNameSet = paramName;
            }
            data.originalFiles = [];
            $.each(files, function (file) {
                if (!file.isDirectory) {
                    data.originalFiles.push(file);
                }
            });
            $.each(fileSet || files, function (index, element) {
                var newData = $.extend({}, data);
                newData.files = fileSet ? element : [element];
                newData.paramName = paramNameSet[index];
                that._initResponseObject(newData);
                that._initProgressObject(newData);
                that._addConvenienceMethods(e, newData);
                result = that._trigger(
                    'add',
                    $.Event('add', {delegatedEvent: e}),
                    newData
                );
                return result;
            });
            return result;
        },

        _replaceFileInput: function (data) {
            var input = data.fileInput,
                inputClone = input.clone(true),
                restoreFocus = input.is(document.activeElement);
            // Add a reference for the new cloned file input to the data argument:
            data.fileInputClone = inputClone;
            $('<form></form>').append(inputClone)[0].reset();
            // Detaching allows to insert the fileInput on another form
            // without losing the file input value:
            input.after(inputClone).detach();
            // If the fileInput had focus before it was detached,
            // restore focus to the inputClone.
            if (restoreFocus) {
                inputClone.focus();
            }
            // Avoid memory leaks with the detached file input:
            $.cleanData(input.unbind('remove'));
            // Replace the original file input element in the fileInput
            // elements set with the clone, which has been copied including
            // event handlers:
            this.options.fileInput = this.options.fileInput.map(function (i, el) {
                if (el === input[0]) {
                    return inputClone[0];
                }
                return el;
            });
            // If the widget has been initialized on the file input itself,
            // override this.element with the file input clone:
            if (input[0] === this.element[0]) {
                this.element = inputClone;
            }
        },

        _handleFileTreeEntry: function (entry, path) {
            var that = this,
                dfd = $.Deferred(),
                errorHandler = function (e) {
                    if (e && !e.entry) {
                        e.entry = entry;
                    }
                    // Since $.when returns immediately if one
                    // Deferred is rejected, we use resolve instead.
                    // This allows valid files and invalid items
                    // to be returned together in one set:
                    dfd.resolve([e]);
                },
                successHandler = function (entries) {
                    that._handleFileTreeEntries(
                        entries,
                        path + entry.name + '/'
                    ).done(function (files) {
                        // empty folder
                        if (!files.length && entry.isDirectory) {
                            dfd.resolve(entry);
                        } else {
                            dfd.resolve(files);
                        }
                    }).fail(errorHandler);
                },
                readEntries = function () {
                    dirReader.readEntries(function (results) {
                        if (!results.length) {
                            successHandler(entries);
                        } else {
                            entries = entries.concat(results);
                            readEntries();
                        }
                    }, errorHandler);
                },
                dirReader, entries = [];
            path = path || '';
            if (entry.isFile) {
                if (entry._file) {
                    // Workaround for Chrome bug #149735
                    entry._file.relativePath = path;
                    dfd.resolve(entry._file);
                } else {
                    entry.file(function (file) {
                        file.relativePath = path;
                        dfd.resolve(file);
                    }, errorHandler);
                }
            } else if (entry.isDirectory) {
                dirReader = entry.createReader();
                readEntries();
            } else {
                // Return an empty list for file system items
                // other than files or directories:
                dfd.resolve([]);
            }
            return dfd.promise();
        },

        _handleFileTreeEntries: function (entries, path) {
            var that = this;
            return $.when.apply(
                $,
                $.map(entries, function (entry) {
                    return that._handleFileTreeEntry(entry, path);
                })
            ).then(function () {
                return Array.prototype.concat.apply(
                    [],
                    arguments
                );
            });
        },

        _getDroppedFiles: function (dataTransfer) {
            dataTransfer = dataTransfer || {};
            var items = dataTransfer.items;
            if (items && items.length && (items[0].webkitGetAsEntry ||
                    items[0].getAsEntry)) {
                return this._handleFileTreeEntries(
                    $.map(items, function (item) {
                        var entry;
                        if (item.webkitGetAsEntry) {
                            entry = item.webkitGetAsEntry();
                            if (entry) {
                                // Workaround for Chrome bug #149735:
                                entry._file = item.getAsFile();
                            }
                            return entry;
                        }
                        return item.getAsEntry();
                    })
                );
            }
            return $.Deferred().resolve(
                $.makeArray(dataTransfer.files)
            ).promise();
        },

        _getSingleFileInputFiles: function (fileInput) {
            fileInput = $(fileInput);
            var entries = fileInput.prop('webkitEntries') ||
                    fileInput.prop('entries'),
                files,
                value;
            if (entries && entries.length) {
                return this._handleFileTreeEntries(entries);
            }
            files = $.makeArray(fileInput.prop('files'));
            if (!files.length) {
                value = fileInput.prop('value');
                if (!value) {
                    return $.Deferred().resolve([]).promise();
                }
                // If the files property is not available, the browser does not
                // support the File API and we add a pseudo File object with
                // the input value as name with path information removed:
                files = [{name: value.replace(/^.*\\/, '')}];
            } else if (files[0].name === undefined && files[0].fileName) {
                // File normalization for Safari 4 and Firefox 3:
                $.each(files, function (index, file) {
                    file.name = file.fileName;
                    file.size = file.fileSize;
                });
            }
            return $.Deferred().resolve(files).promise();
        },

        _getFileInputFiles: function (fileInput) {
            if (!(fileInput instanceof $) || fileInput.length === 1) {
                return this._getSingleFileInputFiles(fileInput);
            }
            return $.when.apply(
                $,
                $.map(fileInput, this._getSingleFileInputFiles)
            ).then(function () {
                return Array.prototype.concat.apply(
                    [],
                    arguments
                );
            });
        },

        _onChange: function (e) {
            var that = this,
                data = {
                    fileInput: $(e.target),
                    form: $(e.target.form)
                };
            this._getFileInputFiles(data.fileInput).always(function (files) {
                data.files = files;
                if (that.options.replaceFileInput) {
                    that._replaceFileInput(data);
                }
                if (that._trigger(
                        'change',
                        $.Event('change', {delegatedEvent: e}),
                        data
                    ) !== false) {
                    that._onAdd(e, data);
                }
            });
        },

        _onPaste: function (e) {
            var items = e.originalEvent && e.originalEvent.clipboardData &&
                    e.originalEvent.clipboardData.items,
                data = {files: []};
            if (items && items.length) {
                $.each(items, function (index, item) {
                    var file = item.getAsFile && item.getAsFile();
                    if (file) {
                        data.files.push(file);
                    }
                });
                if (this._trigger(
                        'paste',
                        $.Event('paste', {delegatedEvent: e}),
                        data
                    ) !== false) {
                    this._onAdd(e, data);
                }
            }
        },

        _onDrop: function (e) {
            e.dataTransfer = e.originalEvent && e.originalEvent.dataTransfer;
            var that = this,
                dataTransfer = e.dataTransfer,
                data = {};
            if (dataTransfer && dataTransfer.files && dataTransfer.files.length) {
                e.preventDefault();
                this._getDroppedFiles(dataTransfer).always(function (files) {
                    data.files = files;
                    if (that._trigger(
                            'drop',
                            $.Event('drop', {delegatedEvent: e}),
                            data
                        ) !== false) {
                        that._onAdd(e, data);
                    }
                });
            } else {
                // "dropnofiles" is triggered to allow proper cleanup of the
                // drag and drop operation, as some browsers trigger "drop"
                // events that have no files even if the "DataTransfer.types" of
                // the "dragover" event included a "Files" item.
                this._trigger(
                    'dropnofiles',
                    $.Event('drop', {delegatedEvent: e})
                );
            }
        },

        _onDragOver: getDragHandler('dragover'),

        _onDragEnter: getDragHandler('dragenter'),

        _onDragLeave: getDragHandler('dragleave'),

        _initEventHandlers: function () {
            if (this._isXHRUpload(this.options)) {
                this._on(this.options.dropZone, {
                    dragover: this._onDragOver,
                    drop: this._onDrop,
                    // event.preventDefault() on dragenter is required for IE10+:
                    dragenter: this._onDragEnter,
                    // dragleave is not required, but added for completeness:
                    dragleave: this._onDragLeave
                });
                this._on(this.options.pasteZone, {
                    paste: this._onPaste
                });
            }
            if ($.support.fileInput) {
                this._on(this.options.fileInput, {
                    change: this._onChange
                });
            }
        },

        _destroyEventHandlers: function () {
            this._off(this.options.dropZone, 'dragenter dragleave dragover drop');
            this._off(this.options.pasteZone, 'paste');
            this._off(this.options.fileInput, 'change');
        },

        _setOption: function (key, value) {
            var reinit = $.inArray(key, this._specialOptions) !== -1;
            if (reinit) {
                this._destroyEventHandlers();
            }
            this._super(key, value);
            if (reinit) {
                this._initSpecialOptions();
                this._initEventHandlers();
            }
        },

        _initSpecialOptions: function () {
            var options = this.options;
            if (options.fileInput === undefined) {
                options.fileInput = this.element.is('input[type="file"]') ?
                        this.element : this.element.find('input[type="file"]');
            } else if (!(options.fileInput instanceof $)) {
                options.fileInput = $(options.fileInput);
            }
            if (!(options.dropZone instanceof $)) {
                options.dropZone = $(options.dropZone);
            }
            if (!(options.pasteZone instanceof $)) {
                options.pasteZone = $(options.pasteZone);
            }
        },

        _getRegExp: function (str) {
            var parts = str.split('/'),
                modifiers = parts.pop();
            parts.shift();
            return new RegExp(parts.join('/'), modifiers);
        },

        _isRegExpOption: function (key, value) {
            return key !== 'url' && $.type(value) === 'string' &&
                /^\/.*\/[igm]{0,3}$/.test(value);
        },

        _initDataAttributes: function () {
            var that = this,
                options = this.options,
                data = this.element.data();
            // Initialize options set via HTML5 data-attributes:
            $.each(
                this.element[0].attributes,
                function (index, attr) {
                    var key = attr.name.toLowerCase(),
                        value;
                    if (/^data-/.test(key)) {
                        // Convert hyphen-ated key to camelCase:
                        key = key.slice(5).replace(/-[a-z]/g, function (str) {
                            return str.charAt(1).toUpperCase();
                        });
                        value = data[key];
                        if (that._isRegExpOption(key, value)) {
                            value = that._getRegExp(value);
                        }
                        options[key] = value;
                    }
                }
            );
        },

        _create: function () {
            this._initDataAttributes();
            this._initSpecialOptions();
            this._slots = [];
            this._sequence = this._getXHRPromise(true);
            this._sending = this._active = 0;
            this._initProgressObject(this);
            this._initEventHandlers();
        },

        // This method is exposed to the widget API and allows to query
        // the number of active uploads:
        active: function () {
            return this._active;
        },

        // This method is exposed to the widget API and allows to query
        // the widget upload progress.
        // It returns an object with loaded, total and bitrate properties
        // for the running uploads:
        progress: function () {
            return this._progress;
        },

        // This method is exposed to the widget API and allows adding files
        // using the fileupload API. The data parameter accepts an object which
        // must have a files property and can contain additional options:
        // .fileupload('add', {files: filesList});
        add: function (data) {
            var that = this;
            if (!data || this.options.disabled) {
                return;
            }
            if (data.fileInput && !data.files) {
                this._getFileInputFiles(data.fileInput).always(function (files) {
                    data.files = files;
                    that._onAdd(null, data);
                });
            } else {
                data.files = $.makeArray(data.files);
                this._onAdd(null, data);
            }
        },

        // This method is exposed to the widget API and allows sending files
        // using the fileupload API. The data parameter accepts an object which
        // must have a files or fileInput property and can contain additional options:
        // .fileupload('send', {files: filesList});
        // The method returns a Promise object for the file upload call.
        send: function (data) {
            if (data && !this.options.disabled) {
                if (data.fileInput && !data.files) {
                    var that = this,
                        dfd = $.Deferred(),
                        promise = dfd.promise(),
                        jqXHR,
                        aborted;
                    promise.abort = function () {
                        aborted = true;
                        if (jqXHR) {
                            return jqXHR.abort();
                        }
                        dfd.reject(null, 'abort', 'abort');
                        return promise;
                    };
                    this._getFileInputFiles(data.fileInput).always(
                        function (files) {
                            if (aborted) {
                                return;
                            }
                            if (!files.length) {
                                dfd.reject();
                                return;
                            }
                            data.files = files;
                            jqXHR = that._onSend(null, data);
                            jqXHR.then(
                                function (result, textStatus, jqXHR) {
                                    dfd.resolve(result, textStatus, jqXHR);
                                },
                                function (jqXHR, textStatus, errorThrown) {
                                    dfd.reject(jqXHR, textStatus, errorThrown);
                                }
                            );
                        }
                    );
                    return this._enhancePromise(promise);
                }
                data.files = $.makeArray(data.files);
                if (data.files.length) {
                    return this._onSend(null, data);
                }
            }
            return this._getXHRPromise(false, data && data.context);
        }

    });

}));


/**
 * Copyright (c) 2012 Erik Sargent <esthepiking at gmail dot com>
 * This file is licensed under the Affero General Public License version 3 or
 * later.
 */
/*****************************
 * Keyboard shortcuts for Files app
 * ctrl/cmd+n: new folder
 * ctrl/cmd+shift+n: new file
 * esc (while new file context menu is open): close menu
 * up/down: select file/folder
 * enter: open file/folder
 * delete/backspace: delete file/folder
 *****************************/
(function(Files) {
	var keys = [];
	var keyCodes = {
		shift: 16,
		n: 78,
		cmdFirefox: 224,
		cmdOpera: 17,
		leftCmdWebKit: 91,
		rightCmdWebKit: 93,
		ctrl: 17,
		esc: 27,
		downArrow: 40,
		upArrow: 38,
		enter: 13,
		del: 46
	};

	function removeA(arr) {
		var what, a = arguments,
			L = a.length,
			ax;
		while (L > 1 && arr.length) {
			what = a[--L];
			while ((ax = arr.indexOf(what)) !== -1) {
				arr.splice(ax, 1);
			}
		}
		return arr;
	}

	function newFile() {
		$("#new").addClass("active");
		$(".popup.popupTop").toggle(true);
		$('#new li[data-type="file"]').trigger('click');
		removeA(keys, keyCodes.n);
	}

	function newFolder() {
		$("#new").addClass("active");
		$(".popup.popupTop").toggle(true);
		$('#new li[data-type="folder"]').trigger('click');
		removeA(keys, keyCodes.n);
	}

	function esc() {
		$(".files-controls").trigger('click');
	}

	function down() {
		var select = -1;
		$(".files-fileList tr").each(function(index) {
			if ($(this).hasClass("mouseOver")) {
				select = index + 1;
				$(this).removeClass("mouseOver");
			}
		});
		if (select === -1) {
			$(".files-fileList tr:first").addClass("mouseOver");
		} else {
			$(".files-fileList tr").each(function(index) {
				if (index === select) {
					$(this).addClass("mouseOver");
				}
			});
		}
	}

	function up() {
		var select = -1;
		$(".files-fileList tr").each(function(index) {
			if ($(this).hasClass("mouseOver")) {
				select = index - 1;
				$(this).removeClass("mouseOver");
			}
		});
		if (select === -1) {
			$(".files-fileList tr:last").addClass("mouseOver");
		} else {
			$(".files-fileList tr").each(function(index) {
				if (index === select) {
					$(this).addClass("mouseOver");
				}
			});
		}
	}

	function enter() {
		$(".files-fileList tr").each(function(index) {
			if ($(this).hasClass("mouseOver")) {
				$(this).removeClass("mouseOver");
				$(this).find("span.nametext").trigger('click');
			}
		});
	}

	function del() {
		$(".files-fileList tr").each(function(index) {
			if ($(this).hasClass("mouseOver")) {
				$(this).removeClass("mouseOver");
				$(this).find("a.action.delete").trigger('click');
			}
		});
	}

	function rename() {
		$(".files-fileList tr").each(function(index) {
			if ($(this).hasClass("mouseOver")) {
				$(this).removeClass("mouseOver");
				$(this).find("a[data-action='Rename']").trigger('click');
			}
		});
	}
	Files.bindKeyboardShortcuts = function(document, $) {
		$(document).keydown(function(event) { //check for modifier keys
            if(!$(event.target).is('body')) {
                return;
            }
			var preventDefault = false;
			if ($.inArray(event.keyCode, keys) === -1) {
				keys.push(event.keyCode);
			}
			if (
			$.inArray(keyCodes.n, keys) !== -1 && ($.inArray(keyCodes.cmdFirefox, keys) !== -1 || $.inArray(keyCodes.cmdOpera, keys) !== -1 || $.inArray(keyCodes.leftCmdWebKit, keys) !== -1 || $.inArray(keyCodes.rightCmdWebKit, keys) !== -1 || $.inArray(keyCodes.ctrl, keys) !== -1 || event.ctrlKey)) {
				preventDefault = true; //new file/folder prevent browser from responding
			}
			if (preventDefault) {
				event.preventDefault(); //Prevent web browser from responding
				event.stopPropagation();
				return false;
			}
		});
		$(document).keyup(function(event) {
			// do your event.keyCode checks in here
			if (
			$.inArray(keyCodes.n, keys) !== -1 && ($.inArray(keyCodes.cmdFirefox, keys) !== -1 || $.inArray(keyCodes.cmdOpera, keys) !== -1 || $.inArray(keyCodes.leftCmdWebKit, keys) !== -1 || $.inArray(keyCodes.rightCmdWebKit, keys) !== -1 || $.inArray(keyCodes.ctrl, keys) !== -1 || event.ctrlKey)) {
				if ($.inArray(keyCodes.shift, keys) !== -1) { //16=shift, New File
					newFile();
				} else { //New Folder
					newFolder();
				}
			} else if ($("#new").hasClass("active") && $.inArray(keyCodes.esc, keys) !== -1) { //close new window
				esc();
			} else if ($.inArray(keyCodes.downArrow, keys) !== -1) { //select file
				down();
			} else if ($.inArray(keyCodes.upArrow, keys) !== -1) { //select file
				up();
			} else if (!$("#new").hasClass("active") && $.inArray(keyCodes.enter, keys) !== -1) { //open file
				enter();
			} else if (!$("#new").hasClass("active") && $.inArray(keyCodes.del, keys) !== -1) { //delete file
				del();
			}
			removeA(keys, event.keyCode);
		});
	};
})((OCA.Files && OCA.Files.Files) || {});


/*
 * Copyright (c) 2015
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

(function() {
	/**
	 * @class OCA.Files.MainFileInfoDetailView
	 * @classdesc
	 *
	 * Displays main details about a file
	 *
	 */
	var MainFileInfoDetailView = OCA.Files.DetailFileInfoView.extend(
		/** @lends OCA.Files.MainFileInfoDetailView.prototype */ {

		className: 'mainFileInfoView',

		/**
		 * Associated file list instance, for file actions
		 *
		 * @type {OCA.Files.FileList}
		 */
		_fileList: null,

		/**
		 * File actions
		 *
		 * @type {OCA.Files.FileActions}
		 */
		_fileActions: null,

		/**
		 * @type {OCA.Files.SidebarPreviewManager}
		 */
		_previewManager: null,

		events: {
			'click a.action-favorite': '_onClickFavorite',
			'click a.action-default': '_onClickDefaultAction',
			'click a.permalink': '_onClickPermalink',
			'focus .permalink-field>input': '_onFocusPermalink'
		},

		template: function(data) {
			return OCA.Files.Templates['mainfileinfodetailsview'](data);
		},

		initialize: function(options) {
			options = options || {};
			this._fileList = options.fileList;
			this._fileActions = options.fileActions;
			if (!this._fileList) {
				throw 'Missing required parameter "fileList"';
			}
			if (!this._fileActions) {
				throw 'Missing required parameter "fileActions"';
			}
			this._previewManager = new OCA.Files.SidebarPreviewManager(this._fileList);

			this._setupClipboard();
		},

		_setupClipboard: function() {
			var clipboard = new Clipboard('.permalink');
			clipboard.on('success', function(e) {
				OC.Notification.show(t('files', 'Direct link was copied (only works for users who have access to this file/folder)'), {type: 'success'});
			});
			clipboard.on('error', function(e) {
				var $row = this.$('.permalink-field');
				$row.toggleClass('hidden');
				if (!$row.hasClass('hidden')) {
					$row.find('>input').focus();
				}
			});
		},

		_onClickPermalink: function(e) {
			e.preventDefault();
			return;
		},

		_onFocusPermalink: function() {
			this.$('.permalink-field>input').select();
		},

		_onClickFavorite: function(event) {
			event.preventDefault();
			this._fileActions.triggerAction('Favorite', this.model, this._fileList);
		},

		_onClickDefaultAction: function(event) {
			event.preventDefault();
			this._fileActions.triggerAction(null, this.model, this._fileList);
		},

		_onModelChanged: function() {
			// simply re-render
			this.render();
		},

		_makePermalink: function(fileId) {
			var baseUrl = OC.getProtocol() + '://' + OC.getHost();
			return baseUrl + OC.generateUrl('/f/{fileId}', {fileId: fileId});
		},

		setFileInfo: function(fileInfo) {
			if (this.model) {
				this.model.off('change', this._onModelChanged, this);
			}
			this.model = fileInfo;
			if (this.model) {
				this.model.on('change', this._onModelChanged, this);
			}

			if (this.model) {
				var properties = [];
				if( !this.model.has('size') ) {
					properties.push(OC.Files.Client.PROPERTY_SIZE);
					properties.push(OC.Files.Client.PROPERTY_GETCONTENTLENGTH);
				}

				if( properties.length > 0){
					this.model.reloadProperties(properties);
				}
			}

			this.render();
		},

		/**
		 * Renders this details view
		 */
		render: function() {
			this.trigger('pre-render');

			if (this.model) {
				var isFavorite = (this.model.get('tags') || []).indexOf(OC.TAG_FAVORITE) >= 0;
				var availableActions = this._fileActions.get(
					this.model.get('mimetype'),
					this.model.get('type'),
					this.model.get('permissions'),
					this.model.get('name')
				);
				var hasFavoriteAction = 'Favorite' in availableActions;
				this.$el.html(this.template({
					type: this.model.isImage()? 'image': '',
					nameLabel: t('files', 'Name'),
					name: this.model.get('displayName') || this.model.get('name'),
					pathLabel: t('files', 'Path'),
					path: this.model.get('path'),
					hasSize: this.model.has('size'),
					sizeLabel: t('files', 'Size'),
					size: OC.Util.humanFileSize(this.model.get('size'), true),
					altSize: n('files', '%n byte', '%n bytes', this.model.get('size')),
					dateLabel: t('files', 'Modified'),
					altDate: OC.Util.formatDate(this.model.get('mtime')),
					timestamp: this.model.get('mtime'),
					date: OC.Util.relativeModifiedDate(this.model.get('mtime')),
					hasFavoriteAction: hasFavoriteAction,
					starAltText: isFavorite ? t('files', 'Favorited') : t('files', 'Favorite'),
					starClass: isFavorite ? 'icon-starred' : 'icon-star',
					permalink: this._makePermalink(this.model.get('id')),
					permalinkTitle: t('files', 'Copy direct link (only works for users who have access to this file/folder)')
				}));

				// TODO: we really need OC.Previews
				var $iconDiv = this.$el.find('.thumbnail');
				var $container = this.$el.find('.thumbnailContainer');
				if (!this.model.isDirectory()) {
					$iconDiv.addClass('icon-loading icon-32');
					this._previewManager.loadPreview(this.model, $iconDiv, $container);
				} else {
					var iconUrl = this.model.get('icon') || OC.MimeType.getIconUrl('dir');
					if (typeof this.model.get('mountType') !== 'undefined') {
						iconUrl = OC.MimeType.getIconUrl('dir-' + this.model.get('mountType'))
					}
					$iconDiv.css('background-image', 'url("' + iconUrl + '")');
				}
			} else {
				this.$el.empty();
			}
			this.delegateEvents();

			this.trigger('post-render');
		}
	});

	OCA.Files.MainFileInfoDetailView = MainFileInfoDetailView;
})();


/*
 * Copyright (c) 2014
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

/* global Files */

(function() {

	/**
	 * Construct a new NewFileMenu instance
	 * @constructs NewFileMenu
	 *
	 * @memberof OCA.Files
	 */
	var NewFileMenu = OC.Backbone.View.extend({
		tagName: 'div',
		// Menu is opened by default because it's rendered on "add-button" click
		className: 'newFileMenu popovermenu bubble menu open menu-left',

		events: {
			'click .menuitem': '_onClickAction'
		},

		/**
		 * @type OCA.Files.FileList
		 */
		fileList: null,

		initialize: function(options) {
			var self = this;
			var $uploadEl = $('#file_upload_start');
			if ($uploadEl.length) {
				$uploadEl.on('fileuploadstart', function() {
					self.trigger('actionPerformed', 'upload');
				});
			} else {
				console.warn('Missing upload element "file_upload_start"');
			}

			this.fileList = options && options.fileList;

			this._menuItems = [{
				id: 'folder',
				displayName: t('files', 'New folder'),
				templateName: t('files', 'New folder'),
				iconClass: 'icon-folder',
				fileType: 'folder',
				actionLabel: t('files', 'Create new folder'),
				actionHandler: function(name) {
					self.fileList.createDirectory(name);
				}
		        }];

			OC.Plugins.attach('OCA.Files.NewFileMenu', this);
		},

		template: function(data) {
			return OCA.Files.Templates['newfilemenu'](data);
		},

		/**
		 * Event handler whenever an action has been clicked within the menu
		 *
		 * @param {Object} event event object
		 */
		_onClickAction: function(event) {
			var $target = $(event.target);
			if (!$target.hasClass('menuitem')) {
				$target = $target.closest('.menuitem');
			}
			var action = $target.attr('data-action');
			// note: clicking the upload label will automatically
			// set the focus on the "file_upload_start" hidden field
			// which itself triggers the upload dialog.
			// Currently the upload logic is still in file-upload.js and filelist.js
			if (action === 'upload') {
				OC.hideMenus();
			} else {
				var actionItem = _.filter(this._menuItems, function(item) {
					return item.id === action
				}).pop();
				if (typeof actionItem.useInput === 'undefined' || actionItem.useInput === true) {
					event.preventDefault();
					this.$el.find('.menuitem.active').removeClass('active');
					$target.addClass('active');
					this._promptFileName($target);
				} else {
					actionItem.actionHandler();
					OC.hideMenus();
				}
			}
		},

		_promptFileName: function($target) {
			var self = this;

			if ($target.find('form').length) {
				$target.find('input[type=\'text\']').focus();
				return;
			}

			// discard other forms
			this.$el.find('form').remove();
			this.$el.find('.displayname').removeClass('hidden');

			$target.find('.displayname').addClass('hidden');

			var newName = $target.attr('data-templatename');
			var fileType = $target.attr('data-filetype');
			var actionLabel = $target.attr('data-action-label');
			var $form = $(OCA.Files.Templates['newfilemenu_filename_form']({
				fileName: newName,
				cid: this.cid,
				fileType: fileType,
				actionLabel,
			}));

			//this.trigger('actionPerformed', action);
			$target.append($form);

			// here comes the OLD code
			var $input = $form.find('input[type=\'text\']');
			var $submit = $form.find('input[type=\'submit\']');

			var lastPos;
			var checkInput = function () {
				// Special handling for the setup template directory
				if ($target.attr('data-action') === 'template-init') {
					return true;
				}

				var filename = $input.val();
				try {
					if (!Files.isFileNameValid(filename)) {
						// Files.isFileNameValid(filename) throws an exception itself
					} else if (self.fileList.inList(filename)) {
						throw t('files', '{newName} already exists', {newName: filename}, undefined, {
							escape: false
						});
					} else {
						return true;
					}
				} catch (error) {
					$input.attr('title', error);
					$input.addClass('error');
				}
				return false;
			};

			// verify filename on typing
			$input.keyup(function() {
				if (checkInput()) {
					$input.removeClass('error');
				}
			});

			$submit.click(function(event) {
				event.stopPropagation();
				event.preventDefault();
				$form.submit();
			});

			$input.focus();
			// pre select name up to the extension
			lastPos = newName.lastIndexOf('.');
			if (lastPos === -1) {
				lastPos = newName.length;
			}
			$input.selectRange(0, lastPos);

			$form.submit(function(event) {
				event.stopPropagation();
				event.preventDefault();

				if (checkInput()) {
					var newname = $input.val().trim();

					/* Find the right actionHandler that should be called.
					 * Actions is retrieved by using `actionSpec.id` */
					var action = _.filter(self._menuItems, function(item) {
						return item.id == $target.attr('data-action');
					}).pop();
					action.actionHandler(newname);

					$form.remove();
					$target.find('.displayname').removeClass('hidden');
					OC.hideMenus();
				}
			});
		},

		/**
		* Add a new item menu entry in the “New” file menu (in
		* last position). By clicking on the item, the
		* `actionHandler` function is called.
		*
		* @param {Object} actionSpec item’s properties
		*/
		addMenuEntry: function(actionSpec) {
			this._menuItems.push({
				id: actionSpec.id,
				displayName: actionSpec.displayName,
				templateName: actionSpec.templateName,
				iconClass: actionSpec.iconClass,
				fileType: actionSpec.fileType,
				useInput: actionSpec.useInput,
				actionLabel: actionSpec.actionLabel,
				actionHandler: actionSpec.actionHandler,
				checkFilename: actionSpec.checkFilename,
				shouldShow: actionSpec.shouldShow,
			});
		},

		/**
		 * Remove a menu item from the "New" file menu
		 * @param {string} actionId
		 */
		removeMenuEntry: function(actionId) {
			var index = this._menuItems.findIndex(function (actionSpec) {
				return actionSpec.id === actionId;
			});
			if (index > -1) {
				this._menuItems.splice(index, 1);
			}
		},

		/**
		 * Renders the menu with the currently set items
		 */
		render: function() {
			const menuItems = this._menuItems.filter(item => !item.shouldShow || (item.shouldShow instanceof Function && item.shouldShow() === true))
			this.$el.html(this.template({
				uploadMaxHumanFileSize: 'TODO',
				uploadLabel: t('files', 'Upload file'),
				items: menuItems
			}));

			// Trigger upload action also with keyboard navigation on enter
			this.$el.find('[for="file_upload_start"]').on('keyup', function(event) {
				if (event.key === " " || event.key === "Enter") {
					$('#file_upload_start').trigger('click');
				}
			});
		},

		/**
		 * Displays the menu under the given element
		 *
		 * @param {Object} $target target element
		 */
		showAt: function($target) {
			this.render();
			OC.showMenu($target, this.$el);
		}
	});

	OCA.Files.NewFileMenu = NewFileMenu;

})();


/*
 * Copyright (c) 2018
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

(function() {
	var OperationProgressBar = OC.Backbone.View.extend({
		tagName: 'div',
		id: 'uploadprogresswrapper',
		events: {
			'click button.stop': '_onClickCancel'
		},

		render: function() {
			this.$el.html(OCA.Files.Templates['operationprogressbar']({
				textCancelButton: t('Cancel operation')
			}));
			this.setProgressBarText(t('Uploading …'), t('…'));
		},

		hideProgressBar: function() {
			var self = this;
			$('#uploadprogresswrapper .stop').fadeOut();
			$('#uploadprogressbar').fadeOut(function() {
				self.$el.trigger(new $.Event('resized'));
			});
		},

		hideCancelButton: function() {
			var self = this;
			$('#uploadprogresswrapper .stop').fadeOut(function() {
				self.$el.trigger(new $.Event('resized'));
			});
		},

		showProgressBar: function(showCancelButton) {
			if (showCancelButton) {
				showCancelButton = true;
			}
			$('#uploadprogressbar').progressbar({value: 0});
			if(showCancelButton) {
				$('#uploadprogresswrapper .stop').show();
			} else {
				$('#uploadprogresswrapper .stop').hide();
			}
			$('#uploadprogresswrapper .label').show();
			$('#uploadprogressbar').fadeIn();
			this.$el.trigger(new $.Event('resized'));
		},

		setProgressBarValue: function(value) {
			$('#uploadprogressbar').progressbar({value: value});
		},

		setProgressBarText: function(textDesktop, textMobile, title) {
			var labelHtml = OCA.Files.Templates['operationprogressbarlabel']({textDesktop: textDesktop, textMobile: textMobile});
			$('#uploadprogressbar .ui-progressbar-value').html(labelHtml);
			$('#uploadprogressbar .ui-progressbar-value>em').addClass('inner');
			$('#uploadprogressbar>em').replaceWith(labelHtml);
			$('#uploadprogressbar>em').addClass('outer');
			if (title) {
				$('#uploadprogressbar').attr('title', title);
				$('#uploadprogresswrapper .tooltip-inner').text(title);
			}
			if(textDesktop || textMobile) {
				$('#uploadprogresswrapper .stop').show();
			}
		},

		_onClickCancel: function (event) {
			this.trigger('cancel');
			return false;
		}
	});

	OCA.Files.OperationProgressBar = OperationProgressBar;
})(OC, OCA);


/*
 * Copyright (c) 2014 Vincent Petry <pvince81@owncloud.com>
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

// HACK: this piece needs to be loaded AFTER the files app (for unit tests)
window.addEventListener('DOMContentLoaded', function () {
	(function (OCA) {
		/**
		 * @class OCA.Files.RecentFileList
		 * @augments OCA.Files.RecentFileList
		 *
		 * @classdesc Recent file list.
		 * Displays the list of recently modified files
		 *
		 * @param $el container element with existing markup for the .files-controls
		 * and a table
		 * @param [options] map of options, see other parameters
		 */
		var RecentFileList = function ($el, options) {
			options.sorting = {
				mode: 'mtime',
				direction: 'desc'
			};
			this.initialize($el, options);
			this._allowSorting = false;
		};
		RecentFileList.prototype = _.extend({}, OCA.Files.FileList.prototype,
			/** @lends OCA.Files.RecentFileList.prototype */ {
				id: 'recent',
				appName: t('files', 'Recent'),

				_clientSideSort: true,
				_allowSelection: false,

				/**
				 * @private
				 */
				initialize: function () {
					OCA.Files.FileList.prototype.initialize.apply(this, arguments);
					if (this.initialized) {
						return;
					}
					OC.Plugins.attach('OCA.Files.RecentFileList', this);
				},

				updateEmptyContent: function () {
					var dir = this.getCurrentDirectory();
					if (dir === '/') {
						// root has special permissions
						this.$el.find('.emptyfilelist.emptycontent').toggleClass('hidden', !this.isEmpty);
						this.$el.find('.files-filestable thead th').toggleClass('hidden', this.isEmpty);
					}
					else {
						OCA.Files.FileList.prototype.updateEmptyContent.apply(this, arguments);
					}
				},

				getDirectoryPermissions: function () {
					return OC.PERMISSION_READ | OC.PERMISSION_DELETE;
				},

				updateStorageStatistics: function () {
					// no op because it doesn't have
					// storage info like free space / used space
				},

				reload: function () {
					this.showMask();
					if (this._reloadCall?.abort) {
						this._reloadCall.abort();
					}

					// there is only root
					this._setCurrentDir('/', false);

					this._reloadCall = $.ajax({
						url: OC.generateUrl('/apps/files/api/v1/recent'),
						type: 'GET',
						dataType: 'json'
					});
					var callBack = this.reloadCallback.bind(this);
					return this._reloadCall.then(callBack, callBack);
				},

				reloadCallback: function (result) {
					delete this._reloadCall;
					this.hideMask();

					if (result.files) {
						this.setFiles(result.files.sort(this._sortComparator));
						return true;
					}
					return false;
				}
			});

		OCA.Files.RecentFileList = RecentFileList;
	})(OCA);
});



/*
 * Copyright (c) 2014 Vincent Petry <pvince81@owncloud.com>
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

(function (OCA) {
	/**
	 * Registers the recent file list from the files app sidebar.
	 *
	 * @namespace OCA.Files.RecentPlugin
	 */
	OCA.Files.RecentPlugin = {
		name: 'Recent',

		/**
		 * @type OCA.Files.RecentFileList
		 */
		recentFileList: null,

		attach: function () {
			var self = this;
			$('#app-content-recent').on('show.plugin-recent', function (e) {
				self.showFileList($(e.target));
			});
			$('#app-content-recent').on('hide.plugin-recent', function () {
				self.hideFileList();
			});
		},

		detach: function () {
			if (this.recentFileList) {
				this.recentFileList.destroy();
				OCA.Files.fileActions.off('setDefault.plugin-recent', this._onActionsUpdated);
				OCA.Files.fileActions.off('registerAction.plugin-recent', this._onActionsUpdated);
				$('#app-content-recent').off('.plugin-recent');
				this.recentFileList = null;
			}
		},

		showFileList: function ($el) {
			if (!this.recentFileList) {
				this.recentFileList = this._createRecentFileList($el);
			}
			return this.recentFileList;
		},

		hideFileList: function () {
			if (this.recentFileList) {
				this.recentFileList.$fileList.empty();
			}
		},

		/**
		 * Creates the recent file list.
		 *
		 * @param $el container for the file list
		 * @return {OCA.Files.RecentFileList} file list
		 */
		_createRecentFileList: function ($el) {
			var fileActions = this._createFileActions();
			// register recent list for sidebar section
			return new OCA.Files.RecentFileList(
				$el, {
					fileActions: fileActions,
					// The file list is created when a "show" event is handled,
					// so it should be marked as "shown" like it would have been
					// done if handling the event with the file list already
					// created.
					shown: true
				}
			);
		},

		_createFileActions: function () {
			// inherit file actions from the files app
			var fileActions = new OCA.Files.FileActions();
			// note: not merging the legacy actions because legacy apps are not
			// compatible with the sharing overview and need to be adapted first
			fileActions.registerDefaultActions();
			fileActions.merge(OCA.Files.fileActions);

			if (!this._globalActionsInitialized) {
				// in case actions are registered later
				this._onActionsUpdated = _.bind(this._onActionsUpdated, this);
				OCA.Files.fileActions.on('setDefault.plugin-recent', this._onActionsUpdated);
				OCA.Files.fileActions.on('registerAction.plugin-recent', this._onActionsUpdated);
				this._globalActionsInitialized = true;
			}

			// when the user clicks on a folder, redirect to the corresponding
			// folder in the files app instead of opening it directly
			fileActions.register('dir', 'Open', OC.PERMISSION_READ, '', function (filename, context) {
				OCA.Files.App.setActiveView('files', {silent: true});
				var path = OC.joinPaths(context.$file.attr('data-path'), filename);
				OCA.Files.App.fileList.changeDirectory(path, true, true);
			});
			fileActions.setDefault('dir', 'Open');
			return fileActions;
		},

		_onActionsUpdated: function (ev) {
			if (ev.action) {
				this.recentFileList.fileActions.registerAction(ev.action);
			} else if (ev.defaultAction) {
				this.recentFileList.fileActions.setDefault(
					ev.defaultAction.mime,
					ev.defaultAction.name
				);
			}
		}
	};

})(OCA);

OC.Plugins.register('OCA.Files.App', OCA.Files.RecentPlugin);



/*
 * Copyright (c) 2018
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

(function(){
	var Semaphore = function(max) {
		var counter = 0;
		var waiting = [];

		this.acquire = function() {
			if(counter < max) {
				counter++;
				return new Promise(function(resolve) { resolve(); });
			} else {
				return new Promise(function(resolve) { waiting.push(resolve); });
			}
		};

		this.release = function() {
			counter--;
			if (waiting.length > 0 && counter < max) {
				counter++;
				var promise = waiting.shift();
				promise();
			}
		};
	};

	// needed on public share page to properly register this
	if (!OCA.Files) {
		OCA.Files = {};
	}
	OCA.Files.Semaphore = Semaphore;

})();


/*
 * Copyright (c) 2016
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

(function () {
	var SidebarPreviewManager = function (fileList) {
		this._fileList = fileList;
		this._previewHandlers = {};
		OC.Plugins.attach('OCA.Files.SidebarPreviewManager', this);
	};

	SidebarPreviewManager.prototype = {
		addPreviewHandler: function (mime, handler) {
			this._previewHandlers[mime] = handler;
		},

		getMimeTypePreviewHandler: function(mime) {
			var mimePart = mime.split('/').shift();
			if (this._previewHandlers[mime]) {
				return this._previewHandlers[mime];
			} else if (this._previewHandlers[mimePart]) {
				return this._previewHandlers[mimePart];
			} else {
				return null;
			}
		},

		getPreviewHandler: function (mime) {
			var mimetypeHandler = this.getMimeTypePreviewHandler(mime);
			if (mimetypeHandler) {
				return mimetypeHandler;
			} else {
				return this.fallbackPreview.bind(this);
			}
		},

		loadPreview: function (model, $thumbnailDiv, $thumbnailContainer) {
			if (model.get('hasPreview') === false && this.getMimeTypePreviewHandler(model.get('mimetype')) === null) {
				var mimeIcon = OC.MimeType.getIconUrl(model.get('mimetype'));
				$thumbnailDiv.removeClass('icon-loading icon-32');
				$thumbnailContainer.removeClass('image'); //fall back to regular view
				$thumbnailDiv.css({
					'background-image': 'url("' + mimeIcon + '")'
				});
			} else {
				var handler = this.getPreviewHandler(model.get('mimetype'));
				var fallback = this.fallbackPreview.bind(this, model, $thumbnailDiv, $thumbnailContainer);
				handler(model, $thumbnailDiv, $thumbnailContainer, fallback);
			}
		},

		// previews for images and mimetype icons
		fallbackPreview: function (model, $thumbnailDiv, $thumbnailContainer) {
			var isImage = model.isImage();
			var maxImageWidth = $thumbnailContainer.parent().width() + 50;  // 50px for negative margins
			var maxImageHeight = maxImageWidth / (16 / 9);

			var isLandscape = function (img) {
				return img.width > (img.height * 1.2);
			};

			var isSmall = function (img) {
				return (img.width * 1.1) < (maxImageWidth * window.devicePixelRatio);
			};

			var getTargetHeight = function (img) {
				var targetHeight = img.height / window.devicePixelRatio;
				if (targetHeight <= maxImageHeight) {
					targetHeight = maxImageHeight;
				}
				return targetHeight;
			};

			var getTargetRatio = function (img) {
				var ratio = img.width / img.height;
				if (ratio > 16 / 9) {
					return ratio;
				} else {
					return 16 / 9;
				}
			};

			this._fileList.lazyLoadPreview({
				fileId: model.get('id'),
				path: model.getFullPath(),
				mime: model.get('mimetype'),
				etag: model.get('etag'),
				y: maxImageHeight,
				x: maxImageWidth,
				a: 1,
				mode: 'cover',
				callback: function (previewUrl, img) {
					$thumbnailDiv.previewImg = previewUrl;

					// as long as we only have the mimetype icon, we only save it in case there is no preview
					if (!img) {
						return;
					}
					$thumbnailDiv.removeClass('icon-loading icon-32');
					var targetHeight = getTargetHeight(img);
					$thumbnailContainer.addClass((isLandscape(img) && !isSmall(img)) ? 'landscape' : 'portrait');
					$thumbnailContainer.addClass('large');

					// only set background when we have an actual preview
					// when we don't have a preview we show the mime icon in the error handler
					$thumbnailDiv.css({
						'background-image': 'url("' + previewUrl + '")',
						height: (targetHeight > maxImageHeight) ? 'auto' : targetHeight,
						'max-height': isSmall(img) ? targetHeight : null
					});

					var targetRatio = getTargetRatio(img);
					$thumbnailDiv.find('.stretcher').css({
						'padding-bottom': (100 / targetRatio) + '%'
					});
				},
				error: function () {
					$thumbnailDiv.removeClass('icon-loading icon-32');
					$thumbnailContainer.removeClass('image'); //fall back to regular view
					$thumbnailDiv.css({
						'background-image': 'url("' + $thumbnailDiv.previewImg + '")'
					});
				}
			});
		}
	};

	OCA.Files.SidebarPreviewManager = SidebarPreviewManager;
})();


/*
 * Copyright (c) 2016
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

(function () {
	var SidebarPreview = function () {
	};

	SidebarPreview.prototype = {
		attach: function (manager) {
			manager.addPreviewHandler('text', this.handlePreview.bind(this));
		},

		handlePreview: function (model, $thumbnailDiv, $thumbnailContainer, fallback) {
			var previewWidth = $thumbnailContainer.parent().width() + 50;  // 50px for negative margins
			var previewHeight = previewWidth / (16 / 9);

			this.getFileContent(model.getFullPath()).then(function (content) {
				$thumbnailDiv.removeClass('icon-loading icon-32');
				$thumbnailContainer.addClass('large');
				$thumbnailContainer.addClass('text');
				var $textPreview = $('<pre></pre>').text(content);
				$thumbnailDiv.children('.stretcher').remove();
				$thumbnailDiv.append($textPreview);
				$thumbnailContainer.css("max-height", previewHeight);
			}, function () {
				fallback();
			});
		},

		getFileContent: function (path) {
			return $.ajax({
				url: OC.linkToRemoteBase('files' + path),
				headers: {
					'Range': 'bytes=0-10240'
				}
			});
		}
	};

	OC.Plugins.register('OCA.Files.SidebarPreviewManager', new SidebarPreview());
})();


/*
 * Copyright (c) 2014 Vincent Petry <pvince81@owncloud.com>
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

/* global Handlebars */

(function (OCA) {

	_.extend(OC.Files.Client, {
		PROPERTY_TAGS: '{' + OC.Files.Client.NS_OWNCLOUD + '}tags',
		PROPERTY_FAVORITE: '{' + OC.Files.Client.NS_OWNCLOUD + '}favorite'
	});

	/**
	 * Returns the icon class for the matching state
	 *
	 * @param {boolean} state true if starred, false otherwise
	 * @return {string} icon class for star image
	 */
	function getStarIconClass (state) {
		return state ? 'icon-starred' : 'icon-star';
	}

	/**
	 * Render the star icon with the given state
	 *
	 * @param {boolean} state true if starred, false otherwise
	 * @return {Object} jQuery object
	 */
	function renderStar (state) {
		return OCA.Files.Templates['favorite_mark']({
			isFavorite: state,
			altText: state ? t('files', 'Favorited') : t('files', 'Not favorited'),
			iconClass: getStarIconClass(state)
		});
	}

	/**
	 * Toggle star icon on favorite mark element
	 *
	 * @param {Object} $favoriteMarkEl favorite mark element
	 * @param {boolean} state true if starred, false otherwise
	 */
	function toggleStar ($favoriteMarkEl, state) {
		$favoriteMarkEl.removeClass('icon-star icon-starred').addClass(getStarIconClass(state));
		$favoriteMarkEl.toggleClass('permanent', state);
	}

	/**
	 * Remove Item from Quickaccesslist
	 *
	 * @param {String} appfolder folder to be removed
	 */
	function removeFavoriteFromList (appfolder) {
		var quickAccessList = 'sublist-favorites';
		var listULElements = document.getElementById(quickAccessList);
		if (!listULElements) {
			return;
		}

		var apppath=appfolder;
		if(appfolder.startsWith("//")){
			apppath=appfolder.substring(1, appfolder.length);
		}

		$(listULElements).find('[data-dir="' + _.escape(apppath) + '"]').remove();

		if (listULElements.childElementCount === 0) {
			var collapsibleButton = $(listULElements).parent().find('button.collapse');
			collapsibleButton.hide();
			$("#button-collapse-parent-favorites").removeClass('collapsible');
		}
	}

	/**
	 * Add Item to Quickaccesslist
	 *
	 * @param {String} appfolder folder to be added
	 */
	function addFavoriteToList (appfolder) {
		var quickAccessList = 'sublist-favorites';
		var listULElements = document.getElementById(quickAccessList);
		if (!listULElements) {
			return;
		}
		var listLIElements = listULElements.getElementsByTagName('li');

		var appName = appfolder.substring(appfolder.lastIndexOf("/") + 1, appfolder.length);
		var apppath = appfolder;

		if(appfolder.startsWith("//")){
			apppath = appfolder.substring(1, appfolder.length);
		}
		var url = OC.generateUrl('/apps/files/?dir=' + apppath + '&view=files');

		var innerTagA = document.createElement('A');
		innerTagA.setAttribute("href", url);
		innerTagA.setAttribute("class", "nav-icon-files svg");
		innerTagA.innerHTML = _.escape(appName);

		var length = listLIElements.length + 1;
		var innerTagLI = document.createElement('li');
		innerTagLI.setAttribute("data-id", apppath.replace('/', '-'));
		innerTagLI.setAttribute("data-dir", apppath);
		innerTagLI.setAttribute("data-view", 'files');
		innerTagLI.setAttribute("class", "nav-" + appName);
		innerTagLI.setAttribute("folderpos", length.toString());
		innerTagLI.appendChild(innerTagA);

		$.get(OC.generateUrl("/apps/files/api/v1/quickaccess/get/NodeType"),{folderpath: apppath}, function (data, status) {
				if (data === "dir") {
					if (listULElements.childElementCount <= 0) {
						listULElements.appendChild(innerTagLI);
						var collapsibleButton = $(listULElements).parent().find('button.collapse');
						collapsibleButton.show();
						$(listULElements).parent().addClass('collapsible');
					} else {
						listLIElements[listLIElements.length - 1].after(innerTagLI);
					}
				}
			}
		);
	}

	OCA.Files = OCA.Files || {};

	/**
	 * Extends the file actions and file list to include a favorite mark icon
	 * and a favorite action in the file actions menu; it also adds "data-tags"
	 * and "data-favorite" attributes to file elements.
	 *
	 * @namespace OCA.Files.TagsPlugin
	 */
	OCA.Files.TagsPlugin = {
		name: 'Tags',

		allowedLists: [
			'files',
			'favorites',
			'systemtags',
			'shares.self',
			'shares.others',
			'shares.link'
		],

		_extendFileActions: function (fileActions) {
			var self = this;

			fileActions.registerAction({
				name: 'Favorite',
				displayName: function (context) {
					var $file = context.$file;
					var isFavorite = $file.data('favorite') === true;

					if (isFavorite) {
						return t('files', 'Remove from favorites');
					}

					// As it is currently not possible to provide a context for
					// the i18n strings "Add to favorites" was used instead of
					// "Favorite" to remove the ambiguity between verb and noun
					// when it is translated.
					return t('files', 'Add to favorites');
				},
				mime: 'all',
				order: -100,
				permissions: OC.PERMISSION_NONE,
				iconClass: function (fileName, context) {
					var $file = context.$file;
					var isFavorite = $file.data('favorite') === true;

					if (isFavorite) {
						return 'icon-favorite';
					}

					return 'icon-starred';
				},
				actionHandler: function (fileName, context) {
					var $favoriteMarkEl = context.$file.find('.favorite-mark');
					var $file = context.$file;
					var fileInfo = context.fileList.files[$file.index()];
					var dir = context.dir || context.fileList.getCurrentDirectory();
					var tags = $file.attr('data-tags');

					if (_.isUndefined(tags)) {
						tags = '';
					}
					tags = tags.split('|');
					tags = _.without(tags, '');
					var isFavorite = tags.indexOf(OC.TAG_FAVORITE) >= 0;
					if (isFavorite) {
						// remove tag from list
						tags = _.without(tags, OC.TAG_FAVORITE);
						removeFavoriteFromList(dir + '/' + fileName);
					} else {
						tags.push(OC.TAG_FAVORITE);
						addFavoriteToList(dir + '/' + fileName);
					}

					// pre-toggle the star
					toggleStar($favoriteMarkEl, !isFavorite);

					context.fileInfoModel.trigger('busy', context.fileInfoModel, true);

					self.applyFileTags(
						dir + '/' + fileName,
						tags,
						$favoriteMarkEl,
						isFavorite
					).then(function (result) {
						context.fileInfoModel.trigger('busy', context.fileInfoModel, false);
						// response from server should contain updated tags
						var newTags = result.tags;
						if (_.isUndefined(newTags)) {
							newTags = tags;
						}
						context.fileInfoModel.set({
							'tags': newTags,
							'favorite': !isFavorite
						});
					});
				}
			});
		},

		_extendFileList: function (fileList) {
			// extend row prototype
			var oldCreateRow = fileList._createRow;
			fileList._createRow = function (fileData) {
				var $tr = oldCreateRow.apply(this, arguments);
				var isFavorite = false;
				if (fileData.tags) {
					$tr.attr('data-tags', fileData.tags.join('|'));
					if (fileData.tags.indexOf(OC.TAG_FAVORITE) >= 0) {
						$tr.attr('data-favorite', true);
						isFavorite = true;
					}
				}
				var $icon = $(renderStar(isFavorite));
				$tr.find('td.filename .thumbnail').append($icon);
				return $tr;
			};
			var oldElementToFile = fileList.elementToFile;
			fileList.elementToFile = function ($el) {
				var fileInfo = oldElementToFile.apply(this, arguments);
				var tags = $el.attr('data-tags');
				if (_.isUndefined(tags)) {
					tags = '';
				}
				tags = tags.split('|');
				tags = _.without(tags, '');
				fileInfo.tags = tags;
				return fileInfo;
			};

			var oldGetWebdavProperties = fileList._getWebdavProperties;
			fileList._getWebdavProperties = function () {
				var props = oldGetWebdavProperties.apply(this, arguments);
				props.push(OC.Files.Client.PROPERTY_TAGS);
				props.push(OC.Files.Client.PROPERTY_FAVORITE);
				return props;
			};

			fileList.filesClient.addFileInfoParser(function (response) {
				var data = {};
				var props = response.propStat[0].properties;
				var tags = props[OC.Files.Client.PROPERTY_TAGS];
				var favorite = props[OC.Files.Client.PROPERTY_FAVORITE];
				if (tags && tags.length) {
					tags = _.chain(tags).filter(function (xmlvalue) {
						return (xmlvalue.namespaceURI === OC.Files.Client.NS_OWNCLOUD && xmlvalue.nodeName.split(':')[1] === 'tag');
					}).map(function (xmlvalue) {
						return xmlvalue.textContent || xmlvalue.text;
					}).value();
				}
				if (tags) {
					data.tags = tags;
				}
				if (favorite && parseInt(favorite, 10) !== 0) {
					data.tags = data.tags || [];
					data.tags.push(OC.TAG_FAVORITE);
				}
				return data;
			});
		},

		attach: function (fileList) {
			if (this.allowedLists.indexOf(fileList.id) < 0) {
				return;
			}
			this._extendFileActions(fileList.fileActions);
			this._extendFileList(fileList);
		},

		/**
		 * Replaces the given files' tags with the specified ones.
		 *
		 * @param {String} fileName path to the file or folder to tag
		 * @param {Array.<String>} tagNames array of tag names
		 * @param {Object} $favoriteMarkEl favorite mark element
		 * @param {boolean} isFavorite Was the item favorited before
		 */
		applyFileTags: function (fileName, tagNames, $favoriteMarkEl, isFavorite) {
			var encodedPath = OC.encodePath(fileName);
			while (encodedPath[0] === '/') {
				encodedPath = encodedPath.substr(1);
			}
			return $.ajax({
				url: OC.generateUrl('/apps/files/api/v1/files/') + encodedPath,
				contentType: 'application/json',
				data: JSON.stringify({
					tags: tagNames || []
				}),
				dataType: 'json',
				type: 'POST'
			}).fail(function (response) {
				var message = '';
				// show message if it is available
				if (response.responseJSON && response.responseJSON.message) {
					message = ': ' + response.responseJSON.message;
				}
				OC.Notification.show(t('files', 'An error occurred while trying to update the tags' + message), {type: 'error'});
				toggleStar($favoriteMarkEl, isFavorite);
			});
		}
	};
})
(OCA);

OC.Plugins.register('OCA.Files.FileList', OCA.Files.TagsPlugin);


/*
 * Copyright (c) 2014 Vincent Petry <pvince81@owncloud.com>
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

/* global Handlebars */

(function (OCA) {

	_.extend(OC.Files.Client, {
		PROPERTY_SYSTEM_TAGS: '{' + OC.Files.Client.NS_NEXTCLOUD + '}system-tags',
	});

	OCA.Files = OCA.Files || {};

	/**
	 * Extends the file actions and file list to add system tags inline
	 *
	 * @namespace OCA.Files.SystemTagsPlugin
	 */
	OCA.Files.SystemTagsPlugin = {
		name: 'SystemTags',

		allowedLists: [
			'files',
			'favorites',
			'shares.self',
			'shares.others',
			'shares.link'
		],
		
		_buildTagSpan: function(tag, isMore = false) {
			var $tag = $('<li class="system-tags__tag"></li>');
			$tag.text(tag).addClass(isMore ? 'system-tags__tag--more' : '');
			return $tag;
		},

		_buildTagsUI: function(tags) {
			$systemTags = $('<ul class="system-tags"></ul>');
			if (tags.length === 1) {
				$systemTags.attr('aria-label', t('files', 'This file has the tag {tag}', { tag: tags[0] }));
			} else if (tags.length > 1) {
				var firstTags = tags.slice(0, -1).join(', ');
				var lastTag = tags[tags.length - 1];
				$systemTags.attr('aria-label', t('files', 'This file has the tags {firstTags} and {lastTag}', { firstTags, lastTag }));
			}

			if (tags.length > 0) {
				$systemTags.append(this._buildTagSpan(tags[0]));
			}

			// More tags than the one we're showing
			if (tags.length > 1) {
				$moreTag = this._buildTagSpan('+' + (tags.length - 1), true)
				$moreTag.attr('title', tags.slice(1).join(', '));
				$systemTags.append($moreTag);
			}

			return $systemTags;
		},

		_extendFileList: function(fileList) {
			var self = this;

			// extend row prototype
			var oldCreateRow = fileList._createRow;
			fileList._createRow = function(fileData) {
				var $tr = oldCreateRow.apply(this, arguments);
				var systemTags = fileData.systemTags || [];

				// Update tr data list
				$tr.attr('data-systemTags', systemTags.join('|'));

				// No tags, no need to do anything
				if (systemTags.length === 0) {
					return $tr;
				}

				// Build tags ui and inject
				$systemTags = self._buildTagsUI.apply(self, [systemTags])
				$systemTags.insertAfter($tr.find('td.filename .nametext'));
				return $tr;
			};

			var oldElementToFile = fileList.elementToFile;
			fileList.elementToFile = function ($el) {
				var fileInfo = oldElementToFile.apply(this, arguments);
				var systemTags = $el.attr('data-systemTags');
				fileInfo.systemTags = systemTags?.split?.('|') || [];
				return fileInfo;
			};

			var oldGetWebdavProperties = fileList._getWebdavProperties;
			fileList._getWebdavProperties = function () {
				var props = oldGetWebdavProperties.apply(this, arguments);
				props.push(OC.Files.Client.PROPERTY_SYSTEM_TAGS);
				return props;
			};

			fileList.filesClient.addFileInfoParser(function (response) {
				var data = {};
				var props = response.propStat[0].properties;
				var systemTags = props[OC.Files.Client.PROPERTY_SYSTEM_TAGS] || [];
				if (systemTags && systemTags.length) {
					data.systemTags = systemTags
						.filter(xmlvalue => xmlvalue.namespaceURI === OC.Files.Client.NS_NEXTCLOUD && xmlvalue.nodeName.split(':')[1] === 'system-tag')
						.map(xmlvalue => xmlvalue.textContent || xmlvalue.text);
				}
				return data;
			});
		},

		attach: function(fileList) {
			if (this.allowedLists.indexOf(fileList.id) < 0) {
				return;
			}
			this._extendFileList(fileList);
		},
	};
})
(OCA);

OC.Plugins.register('OCA.Files.FileList', OCA.Files.SystemTagsPlugin);


(function() {
  var template = Handlebars.template, templates = OCA.Files.Templates = OCA.Files.Templates || {};
templates['detailsview'] = template({"1":function(container,depth0,helpers,partials,data) {
    var stack1, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<ul class=\"tabHeaders\">\n"
    + ((stack1 = lookupProperty(helpers,"each").call(depth0 != null ? depth0 : (container.nullContext || {}),(depth0 != null ? lookupProperty(depth0,"tabHeaders") : depth0),{"name":"each","hash":{},"fn":container.program(2, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":4,"column":1},"end":{"line":9,"column":10}}})) != null ? stack1 : "")
    + "</ul>\n";
},"2":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=container.hooks.helperMissing, alias3="function", alias4=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "	<li class=\"tabHeader\" data-tabid=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"tabId") || (depth0 != null ? lookupProperty(depth0,"tabId") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"tabId","hash":{},"data":data,"loc":{"start":{"line":5,"column":35},"end":{"line":5,"column":44}}}) : helper)))
    + "\" tabindex=\"0\">\n	    "
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"tabIcon") : depth0),{"name":"if","hash":{},"fn":container.program(3, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":6,"column":5},"end":{"line":6,"column":65}}})) != null ? stack1 : "")
    + "\n		<a href=\"#\" tabindex=\"-1\">"
    + alias4(((helper = (helper = lookupProperty(helpers,"label") || (depth0 != null ? lookupProperty(depth0,"label") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"label","hash":{},"data":data,"loc":{"start":{"line":7,"column":28},"end":{"line":7,"column":37}}}) : helper)))
    + "</a>\n	</li>\n";
},"3":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<span class=\"icon "
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"tabIcon") || (depth0 != null ? lookupProperty(depth0,"tabIcon") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"tabIcon","hash":{},"data":data,"loc":{"start":{"line":6,"column":38},"end":{"line":6,"column":49}}}) : helper)))
    + "\"></span>";
},"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<div class=\"detailFileInfoContainer\"></div>\n"
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"tabHeaders") : depth0),{"name":"if","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":2,"column":0},"end":{"line":11,"column":7}}})) != null ? stack1 : "")
    + "<div class=\"tabsContainer\"></div>\n<a class=\"close icon-close\" href=\"#\"><span class=\"hidden-visually\">"
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"closeLabel") || (depth0 != null ? lookupProperty(depth0,"closeLabel") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(alias1,{"name":"closeLabel","hash":{},"data":data,"loc":{"start":{"line":13,"column":67},"end":{"line":13,"column":81}}}) : helper)))
    + "</span></a>\n";
},"useData":true});
templates['favorite_mark'] = template({"1":function(container,depth0,helpers,partials,data) {
    return "permanent";
},"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, helper, options, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=container.hooks.helperMissing, alias3="function", alias4=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    }, buffer = 
  "<div class=\"favorite-mark ";
  stack1 = ((helper = (helper = lookupProperty(helpers,"isFavorite") || (depth0 != null ? lookupProperty(depth0,"isFavorite") : depth0)) != null ? helper : alias2),(options={"name":"isFavorite","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":1,"column":26},"end":{"line":1,"column":65}}}),(typeof helper === alias3 ? helper.call(alias1,options) : helper));
  if (!lookupProperty(helpers,"isFavorite")) { stack1 = container.hooks.blockHelperMissing.call(depth0,stack1,options)}
  if (stack1 != null) { buffer += stack1; }
  return buffer + "\">\n	<span class=\"icon "
    + alias4(((helper = (helper = lookupProperty(helpers,"iconClass") || (depth0 != null ? lookupProperty(depth0,"iconClass") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"iconClass","hash":{},"data":data,"loc":{"start":{"line":2,"column":19},"end":{"line":2,"column":32}}}) : helper)))
    + "\" />\n	<span class=\"hidden-visually\">"
    + alias4(((helper = (helper = lookupProperty(helpers,"altText") || (depth0 != null ? lookupProperty(depth0,"altText") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"altText","hash":{},"data":data,"loc":{"start":{"line":3,"column":31},"end":{"line":3,"column":42}}}) : helper)))
    + "</span>\n</div>\n";
},"useData":true});
templates['file_action_trigger'] = template({"1":function(container,depth0,helpers,partials,data) {
    var helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=container.hooks.helperMissing, alias3="function", alias4=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "		<img class=\"svg\" alt=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"altText") || (depth0 != null ? lookupProperty(depth0,"altText") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"altText","hash":{},"data":data,"loc":{"start":{"line":3,"column":24},"end":{"line":3,"column":35}}}) : helper)))
    + "\" src=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"icon") || (depth0 != null ? lookupProperty(depth0,"icon") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"icon","hash":{},"data":data,"loc":{"start":{"line":3,"column":42},"end":{"line":3,"column":50}}}) : helper)))
    + "\" />\n";
},"3":function(container,depth0,helpers,partials,data) {
    var stack1, alias1=depth0 != null ? depth0 : (container.nullContext || {}), lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"iconClass") : depth0),{"name":"if","hash":{},"fn":container.program(4, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":5,"column":2},"end":{"line":7,"column":9}}})) != null ? stack1 : "")
    + ((stack1 = lookupProperty(helpers,"unless").call(alias1,(depth0 != null ? lookupProperty(depth0,"hasDisplayName") : depth0),{"name":"unless","hash":{},"fn":container.program(6, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":8,"column":2},"end":{"line":10,"column":13}}})) != null ? stack1 : "");
},"4":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "			<span class=\"icon "
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"iconClass") || (depth0 != null ? lookupProperty(depth0,"iconClass") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"iconClass","hash":{},"data":data,"loc":{"start":{"line":6,"column":21},"end":{"line":6,"column":34}}}) : helper)))
    + "\"></span>\n";
},"6":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "			<span class=\"hidden-visually\">"
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"altText") || (depth0 != null ? lookupProperty(depth0,"altText") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"altText","hash":{},"data":data,"loc":{"start":{"line":9,"column":33},"end":{"line":9,"column":44}}}) : helper)))
    + "</span>\n";
},"8":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<span> "
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"displayName") || (depth0 != null ? lookupProperty(depth0,"displayName") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"displayName","hash":{},"data":data,"loc":{"start":{"line":12,"column":27},"end":{"line":12,"column":42}}}) : helper)))
    + "</span>";
},"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=container.hooks.helperMissing, alias3="function", alias4=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<a class=\"action action-"
    + alias4(((helper = (helper = lookupProperty(helpers,"nameLowerCase") || (depth0 != null ? lookupProperty(depth0,"nameLowerCase") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"nameLowerCase","hash":{},"data":data,"loc":{"start":{"line":1,"column":24},"end":{"line":1,"column":41}}}) : helper)))
    + "\" href=\"#\" data-action=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"name") || (depth0 != null ? lookupProperty(depth0,"name") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"name","hash":{},"data":data,"loc":{"start":{"line":1,"column":65},"end":{"line":1,"column":73}}}) : helper)))
    + "\">\n"
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"icon") : depth0),{"name":"if","hash":{},"fn":container.program(1, data, 0),"inverse":container.program(3, data, 0),"data":data,"loc":{"start":{"line":2,"column":1},"end":{"line":11,"column":8}}})) != null ? stack1 : "")
    + "	"
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"displayName") : depth0),{"name":"if","hash":{},"fn":container.program(8, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":12,"column":1},"end":{"line":12,"column":56}}})) != null ? stack1 : "")
    + "\n</a>\n";
},"useData":true});
templates['fileactionsmenu'] = template({"1":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=container.hooks.helperMissing, alias3="function", alias4=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "		<li class=\""
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"inline") : depth0),{"name":"if","hash":{},"fn":container.program(2, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":3,"column":13},"end":{"line":3,"column":40}}})) != null ? stack1 : "")
    + " action-"
    + alias4(((helper = (helper = lookupProperty(helpers,"nameLowerCase") || (depth0 != null ? lookupProperty(depth0,"nameLowerCase") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"nameLowerCase","hash":{},"data":data,"loc":{"start":{"line":3,"column":48},"end":{"line":3,"column":65}}}) : helper)))
    + "-container\">\n			<a href=\"#\" class=\"menuitem action action-"
    + alias4(((helper = (helper = lookupProperty(helpers,"nameLowerCase") || (depth0 != null ? lookupProperty(depth0,"nameLowerCase") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"nameLowerCase","hash":{},"data":data,"loc":{"start":{"line":4,"column":45},"end":{"line":4,"column":62}}}) : helper)))
    + " permanent\" data-action=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"name") || (depth0 != null ? lookupProperty(depth0,"name") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"name","hash":{},"data":data,"loc":{"start":{"line":4,"column":87},"end":{"line":4,"column":95}}}) : helper)))
    + "\">\n				"
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"icon") : depth0),{"name":"if","hash":{},"fn":container.program(4, data, 0),"inverse":container.program(6, data, 0),"data":data,"loc":{"start":{"line":5,"column":4},"end":{"line":12,"column":11}}})) != null ? stack1 : "")
    + "				<span>"
    + alias4(((helper = (helper = lookupProperty(helpers,"displayName") || (depth0 != null ? lookupProperty(depth0,"displayName") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"displayName","hash":{},"data":data,"loc":{"start":{"line":13,"column":10},"end":{"line":13,"column":25}}}) : helper)))
    + "</span>\n			</a>\n		</li>\n";
},"2":function(container,depth0,helpers,partials,data) {
    return "hidden";
},"4":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<img class=\"icon\" src=\""
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"icon") || (depth0 != null ? lookupProperty(depth0,"icon") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"icon","hash":{},"data":data,"loc":{"start":{"line":5,"column":39},"end":{"line":5,"column":47}}}) : helper)))
    + "\"/>\n";
},"6":function(container,depth0,helpers,partials,data) {
    var stack1, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return ((stack1 = lookupProperty(helpers,"if").call(depth0 != null ? depth0 : (container.nullContext || {}),(depth0 != null ? lookupProperty(depth0,"iconClass") : depth0),{"name":"if","hash":{},"fn":container.program(7, data, 0),"inverse":container.program(9, data, 0),"data":data,"loc":{"start":{"line":7,"column":5},"end":{"line":11,"column":12}}})) != null ? stack1 : "");
},"7":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "						<span class=\"icon "
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"iconClass") || (depth0 != null ? lookupProperty(depth0,"iconClass") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"iconClass","hash":{},"data":data,"loc":{"start":{"line":8,"column":24},"end":{"line":8,"column":37}}}) : helper)))
    + "\"></span>\n";
},"9":function(container,depth0,helpers,partials,data) {
    return "						<span class=\"no-icon\"></span>\n";
},"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<ul>\n"
    + ((stack1 = lookupProperty(helpers,"each").call(depth0 != null ? depth0 : (container.nullContext || {}),(depth0 != null ? lookupProperty(depth0,"items") : depth0),{"name":"each","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":2,"column":1},"end":{"line":16,"column":10}}})) != null ? stack1 : "")
    + "</ul>\n";
},"useData":true});
templates['filemultiselectmenu'] = template({"1":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=container.hooks.helperMissing, alias3="function", alias4=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "		<li class=\"item-"
    + alias4(((helper = (helper = lookupProperty(helpers,"name") || (depth0 != null ? lookupProperty(depth0,"name") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"name","hash":{},"data":data,"loc":{"start":{"line":3,"column":18},"end":{"line":3,"column":26}}}) : helper)))
    + "\">\n			<a href=\"#\" class=\"menuitem action "
    + alias4(((helper = (helper = lookupProperty(helpers,"name") || (depth0 != null ? lookupProperty(depth0,"name") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"name","hash":{},"data":data,"loc":{"start":{"line":4,"column":38},"end":{"line":4,"column":46}}}) : helper)))
    + " permanent\" data-action=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"name") || (depth0 != null ? lookupProperty(depth0,"name") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"name","hash":{},"data":data,"loc":{"start":{"line":4,"column":71},"end":{"line":4,"column":79}}}) : helper)))
    + "\">\n"
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"iconClass") : depth0),{"name":"if","hash":{},"fn":container.program(2, data, 0),"inverse":container.program(4, data, 0),"data":data,"loc":{"start":{"line":5,"column":4},"end":{"line":9,"column":11}}})) != null ? stack1 : "")
    + "				<span class=\"label\">"
    + alias4(((helper = (helper = lookupProperty(helpers,"displayName") || (depth0 != null ? lookupProperty(depth0,"displayName") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"displayName","hash":{},"data":data,"loc":{"start":{"line":10,"column":24},"end":{"line":10,"column":39}}}) : helper)))
    + "</span>\n			</a>\n		</li>\n";
},"2":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "					<span class=\"icon "
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"iconClass") || (depth0 != null ? lookupProperty(depth0,"iconClass") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"iconClass","hash":{},"data":data,"loc":{"start":{"line":6,"column":23},"end":{"line":6,"column":36}}}) : helper)))
    + "\"></span>\n";
},"4":function(container,depth0,helpers,partials,data) {
    return "					<span class=\"no-icon\"></span>\n";
},"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<ul>\n"
    + ((stack1 = lookupProperty(helpers,"each").call(depth0 != null ? depth0 : (container.nullContext || {}),(depth0 != null ? lookupProperty(depth0,"items") : depth0),{"name":"each","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":2,"column":1},"end":{"line":13,"column":10}}})) != null ? stack1 : "")
    + "</ul>\n";
},"useData":true});
templates['filesummary'] = template({"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<span class=\"info\">\n	<span class=\"dirinfo\"></span>\n	<span class=\"connector\">"
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"connectorLabel") || (depth0 != null ? lookupProperty(depth0,"connectorLabel") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"connectorLabel","hash":{},"data":data,"loc":{"start":{"line":3,"column":25},"end":{"line":3,"column":43}}}) : helper)))
    + "</span>\n	<span class=\"fileinfo\"></span>\n	<span class=\"hiddeninfo\"></span>\n	<span class=\"filter\"></span>\n</span>\n";
},"useData":true});
templates['mainfileinfodetailsview'] = template({"1":function(container,depth0,helpers,partials,data) {
    var helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=container.hooks.helperMissing, alias3="function", alias4=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "			<a href=\"#\" class=\"action action-favorite favorite permanent\">\n				<span class=\"icon "
    + alias4(((helper = (helper = lookupProperty(helpers,"starClass") || (depth0 != null ? lookupProperty(depth0,"starClass") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"starClass","hash":{},"data":data,"loc":{"start":{"line":13,"column":22},"end":{"line":13,"column":35}}}) : helper)))
    + "\" title=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"starAltText") || (depth0 != null ? lookupProperty(depth0,"starAltText") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"starAltText","hash":{},"data":data,"loc":{"start":{"line":13,"column":44},"end":{"line":13,"column":59}}}) : helper)))
    + "\"></span>\n			</a>\n";
},"3":function(container,depth0,helpers,partials,data) {
    var helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=container.hooks.helperMissing, alias3="function", alias4=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<span class=\"size\" title=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"altSize") || (depth0 != null ? lookupProperty(depth0,"altSize") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"altSize","hash":{},"data":data,"loc":{"start":{"line":16,"column":43},"end":{"line":16,"column":54}}}) : helper)))
    + "\">"
    + alias4(((helper = (helper = lookupProperty(helpers,"size") || (depth0 != null ? lookupProperty(depth0,"size") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"size","hash":{},"data":data,"loc":{"start":{"line":16,"column":56},"end":{"line":16,"column":64}}}) : helper)))
    + "</span>, ";
},"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=container.hooks.helperMissing, alias3="function", alias4=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<div class=\"thumbnailContainer\"><a href=\"#\" class=\"thumbnail action-default\"><div class=\"stretcher\"></div></a></div>\n<div class=\"file-details-container\">\n	<div class=\"fileName\">\n		<h3 title=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"name") || (depth0 != null ? lookupProperty(depth0,"name") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"name","hash":{},"data":data,"loc":{"start":{"line":4,"column":13},"end":{"line":4,"column":21}}}) : helper)))
    + "\" class=\"ellipsis\">"
    + alias4(((helper = (helper = lookupProperty(helpers,"name") || (depth0 != null ? lookupProperty(depth0,"name") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"name","hash":{},"data":data,"loc":{"start":{"line":4,"column":40},"end":{"line":4,"column":48}}}) : helper)))
    + "</h3>\n		<a class=\"permalink\" href=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"permalink") || (depth0 != null ? lookupProperty(depth0,"permalink") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"permalink","hash":{},"data":data,"loc":{"start":{"line":5,"column":29},"end":{"line":5,"column":42}}}) : helper)))
    + "\" title=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"permalinkTitle") || (depth0 != null ? lookupProperty(depth0,"permalinkTitle") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"permalinkTitle","hash":{},"data":data,"loc":{"start":{"line":5,"column":51},"end":{"line":5,"column":69}}}) : helper)))
    + "\" data-clipboard-text=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"permalink") || (depth0 != null ? lookupProperty(depth0,"permalink") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"permalink","hash":{},"data":data,"loc":{"start":{"line":5,"column":92},"end":{"line":5,"column":105}}}) : helper)))
    + "\">\n			<span class=\"icon icon-clippy\"></span>\n			<span class=\"hidden-visually\">"
    + alias4(((helper = (helper = lookupProperty(helpers,"permalinkTitle") || (depth0 != null ? lookupProperty(depth0,"permalinkTitle") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"permalinkTitle","hash":{},"data":data,"loc":{"start":{"line":7,"column":33},"end":{"line":7,"column":51}}}) : helper)))
    + "</span>\n		</a>\n	</div>\n	<div class=\"file-details ellipsis\">\n"
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"hasFavoriteAction") : depth0),{"name":"if","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":11,"column":2},"end":{"line":15,"column":9}}})) != null ? stack1 : "")
    + "		"
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"hasSize") : depth0),{"name":"if","hash":{},"fn":container.program(3, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":16,"column":2},"end":{"line":16,"column":80}}})) != null ? stack1 : "")
    + "<span class=\"date live-relative-timestamp\" data-timestamp=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"timestamp") || (depth0 != null ? lookupProperty(depth0,"timestamp") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"timestamp","hash":{},"data":data,"loc":{"start":{"line":16,"column":139},"end":{"line":16,"column":152}}}) : helper)))
    + "\" title=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"altDate") || (depth0 != null ? lookupProperty(depth0,"altDate") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"altDate","hash":{},"data":data,"loc":{"start":{"line":16,"column":161},"end":{"line":16,"column":172}}}) : helper)))
    + "\">"
    + alias4(((helper = (helper = lookupProperty(helpers,"date") || (depth0 != null ? lookupProperty(depth0,"date") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"date","hash":{},"data":data,"loc":{"start":{"line":16,"column":174},"end":{"line":16,"column":182}}}) : helper)))
    + "</span>\n	</div>\n</div>\n<div class=\"hidden permalink-field\">\n	<input type=\"text\" value=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"permalink") || (depth0 != null ? lookupProperty(depth0,"permalink") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"permalink","hash":{},"data":data,"loc":{"start":{"line":20,"column":27},"end":{"line":20,"column":40}}}) : helper)))
    + "\" placeholder=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"permalinkTitle") || (depth0 != null ? lookupProperty(depth0,"permalinkTitle") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"permalinkTitle","hash":{},"data":data,"loc":{"start":{"line":20,"column":55},"end":{"line":20,"column":73}}}) : helper)))
    + "\" readonly=\"readonly\"/>\n</div>\n";
},"useData":true});
templates['newfilemenu'] = template({"1":function(container,depth0,helpers,partials,data) {
    var helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=container.hooks.helperMissing, alias3="function", alias4=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "		<li>\n			<a href=\"#\" class=\"menuitem\" data-templatename=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"templateName") || (depth0 != null ? lookupProperty(depth0,"templateName") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"templateName","hash":{},"data":data,"loc":{"start":{"line":7,"column":51},"end":{"line":7,"column":67}}}) : helper)))
    + "\" data-filetype=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"fileType") || (depth0 != null ? lookupProperty(depth0,"fileType") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"fileType","hash":{},"data":data,"loc":{"start":{"line":7,"column":84},"end":{"line":7,"column":96}}}) : helper)))
    + "\" data-action=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"id") || (depth0 != null ? lookupProperty(depth0,"id") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"id","hash":{},"data":data,"loc":{"start":{"line":7,"column":111},"end":{"line":7,"column":117}}}) : helper)))
    + "\" data-action-label=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"actionLabel") || (depth0 != null ? lookupProperty(depth0,"actionLabel") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"actionLabel","hash":{},"data":data,"loc":{"start":{"line":7,"column":138},"end":{"line":7,"column":153}}}) : helper)))
    + "\"><span class=\"icon "
    + alias4(((helper = (helper = lookupProperty(helpers,"iconClass") || (depth0 != null ? lookupProperty(depth0,"iconClass") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"iconClass","hash":{},"data":data,"loc":{"start":{"line":7,"column":173},"end":{"line":7,"column":186}}}) : helper)))
    + " svg\"></span><span class=\"displayname\">"
    + alias4(((helper = (helper = lookupProperty(helpers,"displayName") || (depth0 != null ? lookupProperty(depth0,"displayName") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"displayName","hash":{},"data":data,"loc":{"start":{"line":7,"column":225},"end":{"line":7,"column":240}}}) : helper)))
    + "</span></a>\n		</li>\n";
},"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=container.hooks.helperMissing, alias3="function", alias4=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<ul>\n	<li>\n		<label for=\"file_upload_start\" class=\"menuitem\" data-action=\"upload\" title=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"uploadMaxHumanFilesize") || (depth0 != null ? lookupProperty(depth0,"uploadMaxHumanFilesize") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"uploadMaxHumanFilesize","hash":{},"data":data,"loc":{"start":{"line":3,"column":78},"end":{"line":3,"column":104}}}) : helper)))
    + "\" tabindex=\"0\"><span class=\"svg icon icon-upload\"></span><span class=\"displayname\">"
    + alias4(((helper = (helper = lookupProperty(helpers,"uploadLabel") || (depth0 != null ? lookupProperty(depth0,"uploadLabel") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"uploadLabel","hash":{},"data":data,"loc":{"start":{"line":3,"column":187},"end":{"line":3,"column":202}}}) : helper)))
    + "</span></label>\n	</li>\n"
    + ((stack1 = lookupProperty(helpers,"each").call(alias1,(depth0 != null ? lookupProperty(depth0,"items") : depth0),{"name":"each","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":5,"column":1},"end":{"line":9,"column":10}}})) != null ? stack1 : "")
    + "</ul>\n";
},"useData":true});
templates['newfilemenu_filename_form'] = template({"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=container.hooks.helperMissing, alias3="function", alias4=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<form class=\"filenameform\">\n	<input id=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"cid") || (depth0 != null ? lookupProperty(depth0,"cid") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"cid","hash":{},"data":data,"loc":{"start":{"line":2,"column":12},"end":{"line":2,"column":19}}}) : helper)))
    + "-input-"
    + alias4(((helper = (helper = lookupProperty(helpers,"fileType") || (depth0 != null ? lookupProperty(depth0,"fileType") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"fileType","hash":{},"data":data,"loc":{"start":{"line":2,"column":26},"end":{"line":2,"column":38}}}) : helper)))
    + "\" type=\"text\" value=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"fileName") || (depth0 != null ? lookupProperty(depth0,"fileName") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"fileName","hash":{},"data":data,"loc":{"start":{"line":2,"column":59},"end":{"line":2,"column":71}}}) : helper)))
    + "\" autocomplete=\"off\" autocapitalize=\"off\">\n	<input type=\"submit\" value=\" \" class=\"icon-confirm\" aria-label=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"actionLabel") || (depth0 != null ? lookupProperty(depth0,"actionLabel") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"actionLabel","hash":{},"data":data,"loc":{"start":{"line":3,"column":65},"end":{"line":3,"column":80}}}) : helper)))
    + "\" />\n</form>\n";
},"useData":true});
templates['operationprogressbar'] = template({"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<div id=\"uploadprogressbar\">\n	<em class=\"label outer\" style=\"display:none\"></em>\n</div>\n<button class=\"stop icon-close\" style=\"display:none\">\n	<span class=\"hidden-visually\">"
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"textCancelButton") || (depth0 != null ? lookupProperty(depth0,"textCancelButton") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"textCancelButton","hash":{},"data":data,"loc":{"start":{"line":5,"column":31},"end":{"line":5,"column":51}}}) : helper)))
    + "</span>\n</button>\n";
},"useData":true});
templates['operationprogressbarlabel'] = template({"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=container.hooks.helperMissing, alias3="function", alias4=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<em class=\"label\">\n	<span class=\"desktop\">"
    + alias4(((helper = (helper = lookupProperty(helpers,"textDesktop") || (depth0 != null ? lookupProperty(depth0,"textDesktop") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"textDesktop","hash":{},"data":data,"loc":{"start":{"line":2,"column":23},"end":{"line":2,"column":38}}}) : helper)))
    + "</span>\n	<span class=\"mobile\">"
    + alias4(((helper = (helper = lookupProperty(helpers,"textMobile") || (depth0 != null ? lookupProperty(depth0,"textMobile") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"textMobile","hash":{},"data":data,"loc":{"start":{"line":3,"column":22},"end":{"line":3,"column":36}}}) : helper)))
    + "</span>\n</em>\n";
},"useData":true});
templates['template_addbutton'] = template({"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=container.hooks.helperMissing, alias3="function", alias4=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<a href=\"#\" class=\"button new\">\n	<span class=\"icon "
    + alias4(((helper = (helper = lookupProperty(helpers,"iconClass") || (depth0 != null ? lookupProperty(depth0,"iconClass") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"iconClass","hash":{},"data":data,"loc":{"start":{"line":2,"column":19},"end":{"line":2,"column":32}}}) : helper)))
    + "\"></span>\n	<span class=\"hidden-visually\">"
    + alias4(((helper = (helper = lookupProperty(helpers,"addText") || (depth0 != null ? lookupProperty(depth0,"addText") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"addText","hash":{},"data":data,"loc":{"start":{"line":3,"column":31},"end":{"line":3,"column":42}}}) : helper)))
    + "</span>\n</a>\n";
},"useData":true});
})();

