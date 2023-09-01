const path = require('path')
const webpackConfig = require('@nextcloud/webpack-vue-config')

webpackConfig.entry.dashboard = path.resolve(path.join('src', 'dashboard.js'))

module.exports = webpackConfig
