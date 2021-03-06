var opn = require('opn');
var execSync = require('child_process').execSync;

// https://github.com/sindresorhus/opn#app
var OSX_CHROME = 'google chrome';

/**
 * Creates a function that is restricted to invoking func once.
 * Repeat calls to the function return the value of the first invocation.
 * The func is invoked with the this binding and arguments of the created function.
 * @param {Function} function The function to restrict.
 * @returns {Function} Returns the new restricted function.
 */
function once(fn) {
  var called = false;
  return function() {
    if (!called) {
      called = true;
      fn.apply(this, arguments);
    }
  };
}

/**
 * Opens the browser the first time if there's no compilation errors.
 * @param {Object} options Options object.
 * @param {String} [options.url] Url to open in browser.
 * @param {Number} [options.delay] If no delay (in ms) is specified, the browser will be started immediately.
 * @param {String} [options.browser] Browser to use. If not available, use default browser.
 * @param {Boolean} [options.ignoreErrors] Ignore webpack errors.
 * @constructor
 */
function OpenBrowserPlugin(options) {
  options || (options = {});
  this.url = options.url || 'http://localhost:8080';
  this.delay = options.delay || 0;
  this.browser = options.browser;
  this.ignoreErrors = options.ignoreErrors;
}

function attemptToOpenBrowser() {
  var url = this.url;
  var browser = this.browser;

  const shouldTryOpenChromeWithAppleScript =
    process.platform === 'darwin' &&
    (typeof browser !== 'string' || browser === OSX_CHROME);

  if (shouldTryOpenChromeWithAppleScript) {
    try {
      // Try our best to reuse existing tab
      // on OS X Google Chrome with AppleScript
      execSync('ps cax | grep "Google Chrome"');
      execSync('osascript openChrome.applescript "' + encodeURI(url) + '"', {
        cwd: __dirname,
        stdio: 'ignore',
      });
      return true;
    } catch (err) {
      // Ignore errors.
    }
  }

  // If opening a new tab in Chrome fails, use fallback
  opn(url, { app: browser }).catch(err => {
    throw err;
  });
}

OpenBrowserPlugin.prototype.apply = function(compiler) {
  var isWatching = false;
  var delay = this.delay;
  var ignoreErrors = this.ignoreErrors;
  var self = this;
  var executeOpen = once(function() {
    setTimeout(attemptToOpenBrowser.bind(self), delay);
  });

  const checkWatchingMode = (watching, done) => {
    isWatching = true;
    if (done && done.call) {
      done();
    } else return true;
  };

  const doneCallback = stats => {
    if (isWatching && (!stats.hasErrors() || ignoreErrors)) {
      executeOpen();
    }
  };

  if (compiler.hooks) {
    const plugin = { name: 'OpenBrowserPlugin' };
    compiler.hooks.watchRun.tap(plugin, checkWatchingMode);
    compiler.hooks.done.tap(plugin, doneCallback);
  } else {
    compiler.plugin('watch-run', checkWatchingMode);
    compiler.plugin('done', doneCallback);
  }
};

module.exports = OpenBrowserPlugin;
