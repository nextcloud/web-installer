const { merge } = require('webpack-merge')
const path = require('path')
const webpackConfig = require('@nextcloud/webpack-vue-config')

const config = {
	entry: {
		settings: path.resolve(path.join('src', 'settings.js'))
	},
}

const mergedConfig = merge(config, webpackConfig)
delete mergedConfig.entry.main

module.exports = mergedConfig
