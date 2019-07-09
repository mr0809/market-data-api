(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var version = require('./../../../lib/index').version;

var Connection = require('./../../../lib/connection/websocket/Connection'),
    symbolResolver = require('./../../../lib/util/symbolResolver');

module.exports = function () {
	'use strict';

	var PageModel = function PageModel() {
		var that = this;
		var connection = null;

		that.server = ko.observable('qsws-us-e-02.aws.barchart.com');

		that.username = ko.observable('');
		that.password = ko.observable('');

		that.symbol = ko.observable('');
		that.symbolFocus = ko.observable(false);

		that.mode = ko.observable('Streaming');

		that.activeTemplate = ko.observable('disconnected-template');

		that.version = ko.observable(version);

		that.connected = ko.observable(false);
		that.connecting = ko.observable(false);
		that.paused = ko.observable(false);

		that.canConnect = ko.computed(function () {
			return !that.connecting() && !that.connected();
		});
		that.canDisconnect = ko.computed(function () {
			return that.connected();
		});
		that.canPause = ko.computed(function () {
			return !that.paused();
		});
		that.canResume = ko.computed(function () {
			return that.paused();
		});
		that.canReset = ko.computed(function () {
			var connected = that.connected();
			var activeTemplate = that.activeTemplate();

			return connected && activeTemplate !== 'grid-template';
		});

		that.rows = ko.observableArray();
		that.item = ko.observable(null);
		that.profile = ko.observable(null);

		var handleEvents = function handleEvents(data) {
			if (data.event) {
				var event = data.event;

				if (event === 'login success') {
					that.connecting(false);
					that.connected(true);

					that.showGrid();
				} else if (event === 'feed paused') {
					that.paused(true);
				} else if (event === 'feed resumed') {
					that.paused(false);
				}

				toastr.info(data.event);
			}
		};

		that.itemDisplay = ko.computed(function () {
			var item = that.item();

			if (item && item.quote()) {
				return JSON.stringify(item.quote(), null, 2);
			} else {
				return null;
			}
		});

		that.profileDisplay = ko.computed(function () {
			var profile = that.profile();

			if (profile) {
				return JSON.stringify(profile, null, 2);
			} else {
				return 'Loading Profile...';
			}
		});

		that.connect = function () {
			that.disconnect();

			var server = that.server();
			var username = that.username();
			var password = that.password();

			if (!server || !username || !password) {
				return;
			}

			that.connecting(true);

			if (connection) {
				connection.off('events', handleEvents);
			}

			connection = new Connection();

			connection.on('events', handleEvents);

			connection.connect(server, username, password);
		};

		that.disconnect = function () {
			if (connection === null) {
				return;
			}

			connection.disconnect();
			connection = null;

			that.rows.removeAll();

			that.connecting(false);
			that.connected(false);
			that.paused(false);

			that.activeTemplate('disconnected-template');
		};

		that.pause = function () {
			connection.pause();
		};

		that.resume = function () {
			connection.resume();
		};

		that.handleLoginKeypress = function (d, e) {
			if (e.keyCode === 13) {
				that.connect();
			}

			return true;
		};

		that.addSymbol = function () {
			var symbol = that.symbol();

			if (!symbol) {
				return;
			}

			var symbols;

			if (symbol === '#SP500') {
				symbols = SP_500.slice(0, 3);
			} else if (symbol === '#C3') {
				symbols = C3;
			} else if (symbol === '#CMDTY') {
				symbols = CMDTY;
			} else if (symbol === '#PLATTS') {
				symbols = PLATTS;
			} else {
				symbols = [symbol];
			}

			function execute(s) {
				var model = new RowModel(s);

				var handleMarketUpdate = function handleMarketUpdate(message) {
					model.quote(connection.getMarketState().getQuote(s));
				};

				model.setMarketUpdateHandler(handleMarketUpdate);

				connection.on('marketUpdate', handleMarketUpdate, s);

				that.rows.push(model);
			}

			for (var i = 0; i < symbols.length; i++) {
				execute(symbols[i]);
			}

			that.showGrid();
		};

		that.lookupProfile = function () {
			var symbol = that.symbol();

			if (!symbol) {
				return;
			}

			that.showProfile(null);

			symbolResolver(symbol).then(function (resolvedSymbol) {
				return connection.getMarketState().getProfile(resolvedSymbol).then(function (profile) {
					if (that.activeTemplate() === 'profile-template') {
						that.showProfile(profile);
					}
				});
			});
		};

		that.removeSymbol = function (model) {
			if (model.getMarketUpdateHandler()) {
				connection.off('marketUpdate', model.getMarketUpdateHandler(), model.symbol);
			}

			if (model.getCumulativeVolumeHandler()) {
				connection.off('cumulativeVolume', model.getCumulativeVolumeHandler(), model.symbol);
			}

			that.rows.remove(model);
		};

		that.handleSymbolKeypress = function (d, e) {
			if (e.keyCode === 13) {
				that.addSymbol();
			}

			return true;
		};

		that.showGrid = function () {
			that.activeTemplate('grid-template');

			that.item(null);
			that.profile(null);

			that.symbolFocus(true);
		};

		that.showItemDetail = function (model) {
			that.symbol(model.symbol);

			that.item(model);
			that.profile(null);

			that.activeTemplate('grid-item-details');
		};

		that.showProfile = function (profile) {
			that.item(null);
			that.profile(profile);

			that.activeTemplate('profile-template');
		};

		that.showCumulativeVolume = function (model) {
			that.symbol(model.symbol);

			that.item(model);
			that.profile(null);

			that.activeTemplate('grid-cumulative-volume-template');

			var symbol = model.symbol;
			var priceLevels = model.priceLevels;

			if (!model.getCumulativeVolumeHandler()) {
				connection.getMarketState().getCumulativeVolume(symbol).then(function (cumulativeVolume) {
					var items = cumulativeVolume.toArray();

					for (var i = 0; i < items.length; i++) {
						var item = items[i];

						priceLevels.push(new PriceLevelModel(item.price, item.volume));
					}

					model.cumulativeVolumeReady(true);
				});

				var handleCumulativeVolume = function handleCumulativeVolume(message) {
					if (!model.cumulativeVolumeReady()) {
						return;
					}

					if (message.event === 'reset') {
						priceLevels.removeAll();
					} else if (message.event === 'update') {
						var firstPriceLevel = null;

						var priceLevel = ko.utils.arrayFirst(priceLevels(), function (item) {
							if (firstPriceLevel === null) {
								firstPriceLevel = item;
							}

							return message.price === item.price();
						}) || null;

						var existing = priceLevel !== null;

						if (existing) {
							priceLevel.volume(message.volume);
						} else {
							priceLevel = new PriceLevelModel(message.price, message.volume);

							if (priceLevels.length === 0 || firstPriceLevel.price() > message.price()) {
								priceLevels.unshift(priceLevel);
							} else {
								priceLevels.push(priceLevel);
							}
						}

						var last = model.priceLevelLast();

						if (last !== null) {
							last.updated(false);
						}

						priceLevel.updated(true);

						model.priceLevelLast(priceLevel);
					}
				};

				model.setCumulativeVolumeHandler(handleCumulativeVolume);
				connection.on('cumulativeVolume', handleCumulativeVolume, symbol);
			}
		};

		that.setStreamingMode = function () {
			that.mode('Streaming');

			if (connection !== null) {
				connection.setPollingFrequency(null);
			}
		};

		that.setPollingMode = function () {
			that.mode('Polling');

			if (connection !== null) {
				connection.setPollingFrequency(5000);
			}
		};

		that.disconnect();
	};

	var RowModel = function RowModel(symbol) {
		var that = this;

		that.symbol = symbol;

		that.quote = ko.observable(null);

		that.priceLevels = ko.observableArray();
		that.priceLevelLast = ko.observable(null);

		that.cumulativeVolumeReady = ko.observable(false);

		that.handlers = {};

		that.setMarketUpdateHandler = function (handler) {
			that.handlers.marketUpdate = handler;
		};

		that.getMarketUpdateHandler = function () {
			return that.handlers.marketUpdate;
		};

		that.setCumulativeVolumeHandler = function (handler) {
			that.handlers.cumulativeVolume = handler;
		};

		that.getCumulativeVolumeHandler = function () {
			return that.handlers.cumulativeVolume;
		};
	};

	var PriceLevelModel = function PriceLevelModel(price, volume) {
		var that = this;

		that.price = ko.observable(price);
		that.volume = ko.observable(volume);
		that.updated = ko.observable(false);
	};

	var SP_500 = ['ABT', 'ABBV', 'ACN', 'ATVI', 'AYI', 'ADBE', 'AMD', 'AAP', 'AES', 'AET', 'AMG', 'AFL', 'A', 'APD', 'AKAM', 'ALK', 'ALB', 'ARE', 'ALXN', 'ALGN', 'ALLE', 'AGN', 'ADS', 'LNT', 'ALL', 'GOOGL', 'GOOG', 'MO', 'AMZN', 'AEE', 'AAL', 'AEP', 'AXP', 'AIG', 'AMT', 'AWK', 'AMP', 'ABC', 'AME', 'AMGN', 'APH', 'APC', 'ADI', 'ANDV', 'ANSS', 'ANTM', 'AON', 'AOS', 'APA', 'AIV', 'AAPL', 'AMAT', 'ADM', 'ARNC', 'AJG', 'AIZ', 'T', 'ADSK', 'ADP', 'AZO', 'AVB', 'AVY', 'BHGE', 'BLL', 'BAC', 'BK', 'BCR', 'BAX', 'BBT', 'BDX', 'BRK.B', 'BBY', 'BIIB', 'BLK', 'HRB', 'BA', 'BWA', 'BXP', 'BSX', 'BHF', 'BMY', 'AVGO', 'BF.B', 'CHRW', 'CA', 'COG', 'CDNS', 'CPB', 'COF', 'CAH', 'CBOE', 'KMX', 'CCL', 'CAT', 'CBG', 'CBS', 'CELG', 'CNC', 'CNP', 'CTL', 'CERN', 'CF', 'SCHW', 'CHTR', 'CHK', 'CVX', 'CMG', 'CB', 'CHD', 'CI', 'XEC', 'CINF', 'CTAS', 'CSCO', 'C', 'CFG', 'CTXS', 'CLX', 'CME', 'CMS', 'COH', 'KO', 'CTSH', 'CL', 'CMCSA', 'CMA', 'CAG', 'CXO', 'COP', 'ED', 'STZ', 'COO', 'GLW', 'COST', 'COTY', 'CCI', 'CSRA', 'CSX', 'CMI', 'CVS', 'DHI', 'DHR', 'DRI', 'DVA', 'DE', 'DLPH', 'DAL', 'XRAY', 'DVN', 'DLR', 'DFS', 'DISCA', 'DISCK', 'DISH', 'DG', 'DLTR', 'D', 'DOV', 'DWDP', 'DPS', 'DTE', 'DRE', 'DUK', 'DXC', 'ETFC', 'EMN', 'ETN', 'EBAY', 'ECL', 'EIX', 'EW', 'EA', 'EMR', 'ETR', 'EVHC', 'EOG', 'EQT', 'EFX', 'EQIX', 'EQR', 'ESS', 'EL', 'ES', 'RE', 'EXC', 'EXPE', 'EXPD', 'ESRX', 'EXR', 'XOM', 'FFIV', 'FB', 'FAST', 'FRT', 'FDX', 'FIS', 'FITB', 'FE', 'FISV', 'FLIR', 'FLS', 'FLR', 'FMC', 'FL', 'F', 'FTV', 'FBHS', 'BEN', 'FCX', 'GPS', 'GRMN', 'IT', 'GD', 'GE', 'GGP', 'GIS', 'GM', 'GPC', 'GILD', 'GPN', 'GS', 'GT', 'GWW', 'HAL', 'HBI', 'HOG', 'HRS', 'HIG', 'HAS', 'HCA', 'HCP', 'HP', 'HSIC', 'HSY', 'HES', 'HPE', 'HLT', 'HOLX', 'HD', 'HON', 'HRL', 'HST', 'HPQ', 'HUM', 'HBAN', 'IDXX', 'INFO', 'ITW', 'ILMN', 'IR', 'INTC', 'ICE', 'IBM', 'INCY', 'IP', 'IPG', 'IFF', 'INTU', 'ISRG', 'IVZ', 'IRM', 'JEC', 'JBHT', 'SJM', 'JNJ', 'JCI', 'JPM', 'JNPR', 'KSU', 'K', 'KEY', 'KMB', 'KIM', 'KMI', 'KLAC', 'KSS', 'KHC', 'KR', 'LB', 'LLL', 'LH', 'LRCX', 'LEG', 'LEN', 'LUK', 'LLY', 'LNC', 'LKQ', 'LMT', 'L', 'LOW', 'LYB', 'MTB', 'MAC', 'M', 'MRO', 'MPC', 'MAR', 'MMC', 'MLM', 'MAS', 'MA', 'MAT', 'MKC', 'MCD', 'MCK', 'MDT', 'MRK', 'MET', 'MTD', 'MGM', 'KORS', 'MCHP', 'MU', 'MSFT', 'MAA', 'MHK', 'TAP', 'MDLZ', 'MON', 'MNST', 'MCO', 'MS', 'MOS', 'MSI', 'MYL', 'NDAQ', 'NOV', 'NAVI', 'NTAP', 'NFLX', 'NWL', 'NFX', 'NEM', 'NWSA', 'NWS', 'NEE', 'NLSN', 'NKE', 'NI', 'NBL', 'JWN', 'NSC', 'NTRS', 'NOC', 'NCLH', 'NRG', 'NUE', 'NVDA', 'ORLY', 'OXY', 'OMC', 'OKE', 'ORCL', 'PCAR', 'PKG', 'PH', 'PDCO', 'PAYX', 'PYPL', 'PNR', 'PBCT', 'PEP', 'PKI', 'PRGO', 'PFE', 'PCG', 'PM', 'PSX', 'PNW', 'PXD', 'PNC', 'RL', 'PPG', 'PPL', 'PX', 'PCLN', 'PFG', 'PG', 'PGR', 'PLD', 'PRU', 'PEG', 'PSA', 'PHM', 'PVH', 'QRVO', 'PWR', 'QCOM', 'DGX', 'Q', 'RRC', 'RJF', 'RTN', 'O', 'RHT', 'REG', 'REGN', 'RF', 'RSG', 'RMD', 'RHI', 'ROK', 'COL', 'ROP', 'ROST', 'RCL', 'CRM', 'SBAC', 'SCG', 'SLB', 'SNI', 'STX', 'SEE', 'SRE', 'SHW', 'SIG', 'SPG', 'SWKS', 'SLG', 'SNA', 'SO', 'LUV', 'SPGI', 'SWK', 'SBUX', 'STT', 'SRCL', 'SYK', 'STI', 'SYMC', 'SYF', 'SNPS', 'SYY', 'TROW', 'TGT', 'TEL', 'FTI', 'TXN', 'TXT', 'TMO', 'TIF', 'TWX', 'TJX', 'TMK', 'TSS', 'TSCO', 'TDG', 'TRV', 'TRIP', 'FOXA', 'FOX', 'TSN', 'UDR', 'ULTA', 'USB', 'UA', 'UAA', 'UNP', 'UAL', 'UNH', 'UPS', 'URI', 'UTX', 'UHS', 'UNM', 'VFC', 'VLO', 'VAR', 'VTR', 'VRSN', 'VRSK', 'VZ', 'VRTX', 'VIAB', 'V', 'VNO', 'VMC', 'WMT', 'WBA', 'DIS', 'WM', 'WAT', 'WEC', 'WFC', 'HCN', 'WDC', 'WU', 'WRK', 'WY', 'WHR', 'WMB', 'WLTW', 'WYN', 'WYNN', 'XEL', 'XRX', 'XLNX', 'XL', 'XYL', 'YUM', 'ZBH', 'ZION', 'ZTS'];
	var C3 = ['C3:AL79MRM1', 'C3:BSP9WGQ1', 'C3:RA10BGM1'];
	var CMDTY = ['BC5L09YB.CM', 'EI3E06EI.CM', 'EI3E06EJ.CM', 'USDA-CORN-COND-EXC-AL-2528.CM'];
	var PLATTS = ['PLATTS:RD52017', 'PLATTS:RD5MA17', 'PLATTS:RD52018'];

	$(document).ready(function () {
		var pageModel = new PageModel();

		ko.applyBindings(pageModel, $('body')[0]);
	});
}();

},{"./../../../lib/connection/websocket/Connection":6,"./../../../lib/index":10,"./../../../lib/util/symbolResolver":33}],2:[function(require,module,exports){
'use strict';

module.exports = function () {
	'use strict';

	var array = {
		/**
   * Returns a copy of an array, replacing any item that is itself an array
   * with the item's items.
   *
   * @static
   * @param {Array} a
   * @param {Boolean=} recursive - If true, all nested arrays will be flattened.
   * @returns {Array}
   */
		flatten: function flatten(a, recursive) {
			var empty = [];

			var flat = empty.concat.apply(empty, a);

			if (recursive && flat.some(function (x) {
				return Array.isArray(x);
			})) {
				flat = this.flatten(flat, true);
			}

			return flat;
		},


		/**
   * Returns a copy of with only the unique elements from the original array.
   * Elements are compared using strict equality.
   *
   * @static
   * @param {Array} a
   * @returns {Array}
   */
		unique: function unique(array) {
			var arrayToFilter = array || [];

			return arrayToFilter.filter(function (item, index) {
				return arrayToFilter.indexOf(item) === index;
			});
		}
	};

	return array;
}();

},{}],3:[function(require,module,exports){
'use strict';

module.exports = function () {
	'use strict';

	var object = {
		/**
   * Given an object, returns an array of "own" properties.
   *
   * @static
   * @param {Object} target - The object to interrogate.
   * @returns {Array<string>}
   */
		keys: function keys(target) {
			var keys = [];

			for (var k in target) {
				if (target.hasOwnProperty(k)) {
					keys.push(k);
				}
			}

			return keys;
		},


		/**
   * Given an object, returns a Boolean value, indicating if the
   * object has any "own" properties.
   *
   * @static
   * @param {Object} target - The object to interrogate.
   * @returns {Boolean}
   */
		empty: function empty(target) {
			var empty = true;

			for (var k in target) {
				if (target.hasOwnProperty(k)) {
					empty = false;

					break;
				}
			}

			return empty;
		}
	};

	return object;
}();

},{}],4:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MarketState = require('./../marketState/MarketState');

module.exports = function () {
	'use strict';

	/**
  * Object used to connect to market data server, request data feeds, and
  * query market state.
  *
  * @public
  * @interface
  */

	var ConnectionBase = function () {
		function ConnectionBase() {
			var _this = this;

			_classCallCheck(this, ConnectionBase);

			this._server = null;
			this._username = null;
			this._password = null;

			this._marketState = new MarketState(function (symbol) {
				return _this._handleProfileRequest(symbol);
			});
			this._pollingFrequency = null;
		}

		/**
   * Connects to the given server with username and password.
   *
   * @public
   * @param {string} server
   * @param {string} username
   * @param {string} password
   * @param {WebSocketAdapterFactory=} webSocketAdapterFactory
   */


		_createClass(ConnectionBase, [{
			key: 'connect',
			value: function connect(server, username, password, webSocketAdapterFactory) {
				this._server = server;
				this._username = username;
				this._password = password;

				this._connect(webSocketAdapterFactory || null);
			}

			/**
    * @protected
    * @param {WebSocketAdapterFactory=} webSocketAdapterFactory
    * @ignore
    */

		}, {
			key: '_connect',
			value: function _connect(webSocketAdapterFactory) {
				return;
			}

			/**
    * Forces a disconnect from the server.
    *
    * @public
    */

		}, {
			key: 'disconnect',
			value: function disconnect() {
				this._server = null;
				this._username = null;
				this._password = null;

				this._disconnect();
			}

			/**
    * @protected
    * @ignore
    */

		}, {
			key: '_disconnect',
			value: function _disconnect() {
				return;
			}

			/**
    * Causes the market state to stop updating. All subscriptions are maintained.
    *
    * @public
    */

		}, {
			key: 'pause',
			value: function pause() {
				this._pause();
			}

			/**
    * @protected
    * @ignore
    */

		}, {
			key: '_pause',
			value: function _pause() {
				return;
			}

			/**
    * Causes the market state to begin updating again (after {@link ConnectionBase#pause} has been called).
    *
    * @public
    */

		}, {
			key: 'resume',
			value: function resume() {
				this._resume();
			}

			/**
    * @protected
    * @ignore
    */

		}, {
			key: '_resume',
			value: function _resume() {
				return;
			}

			/**
    * Initiates a subscription to an {@link Subscription.EventType} and
    * registers the callback for notifications.
    *
    * @public
    * @param {Subscription.EventType} eventType
    * @param {function} callback - notified each time the event occurs
    * @param {String=} symbol - A symbol, if applicable, to the given {@link Subscription.EventType}
    */

		}, {
			key: 'on',
			value: function on() {
				this._on.apply(this, arguments);
			}

			/**
    * @protected
    * @ignore
    */

		}, {
			key: '_on',
			value: function _on() {
				return;
			}

			/**
    * Stops notification of the callback for the {@link Subscription.EventType}.
    * See {@link ConnectionBase#on}.
    *
    * @public
    * @param {Subscription.EventType} eventType - the {@link Subscription.EventType} which was passed to {@link ConnectionBase#on}
    * @param {function} callback - the callback which was passed to {@link ConnectionBase#on}
    * @param {String=} symbol - A symbol, if applicable, to the given {@link Subscription.EventType}
    */

		}, {
			key: 'off',
			value: function off() {
				this._off.apply(this, arguments);
			}

			/**
    * @protected
    * @ignore
    */

		}, {
			key: '_off',
			value: function _off() {
				return;
			}
		}, {
			key: 'getActiveSymbolCount',
			value: function getActiveSymbolCount() {
				return this._getActiveSymbolCount();
			}
		}, {
			key: '_getActiveSymbolCount',
			value: function _getActiveSymbolCount() {
				return null;
			}

			/**
    * The frequency, in milliseconds, used to poll for changes to {@link Quote}
    * objects. A null value indicates streaming updates (default).
    *
    * @public
    * @return {number|null}
    */

		}, {
			key: 'getPollingFrequency',
			value: function getPollingFrequency() {
				return this._pollingFrequency;
			}

			/**
    * Sets the polling frequency, in milliseconds. A null value indicates
    * streaming market updates (where polling is not used).
    *
    * @public
    * @param {number|null} pollingFrequency
    */

		}, {
			key: 'setPollingFrequency',
			value: function setPollingFrequency(pollingFrequency) {
				if (this._pollingFrequency !== pollingFrequency) {
					if (pollingFrequency && pollingFrequency > 0) {
						this._pollingFrequency = pollingFrequency;
					} else {
						this._pollingFrequency = null;
					}

					this._onPollingFrequencyChanged(this._pollingFrequency);
				}
			}

			/**
    * @protected
    * @ignore
    */

		}, {
			key: '_onPollingFrequencyChanged',
			value: function _onPollingFrequencyChanged(pollingFrequency) {
				return;
			}

			/**
    * @protected
    * @ignore
    */

		}, {
			key: '_handleProfileRequest',
			value: function _handleProfileRequest(symbol) {
				return;
			}

			/**
    * Returns the {@link MarketState} singleton, which can be used to access {@link Quote}, {@link Profile}, and {@link CumulativeVolume} objects.
    *
    * @return {MarketState}
    */

		}, {
			key: 'getMarketState',
			value: function getMarketState() {
				return this._marketState;
			}

			/**
    * @public
    * @returns {null|string}
    */

		}, {
			key: 'getServer',
			value: function getServer() {
				return this._server;
			}

			/**
    * @public
    * @returns {null|string}
    */

		}, {
			key: 'getPassword',
			value: function getPassword() {
				return this._password;
			}

			/**
    * @public
    * @returns {null|string}
    */

		}, {
			key: 'getUsername',
			value: function getUsername() {
				return this._username;
			}
		}, {
			key: 'toString',
			value: function toString() {
				return '[ConnectionBase]';
			}
		}]);

		return ConnectionBase;
	}();

	return ConnectionBase;
}();

},{"./../marketState/MarketState":15}],5:[function(require,module,exports){
'use strict';

var Connection = require('./websocket/Connection');

module.exports = function () {
	'use strict';

	return Connection;
}();

},{"./websocket/Connection":6}],6:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var utilities = require('@barchart/marketdata-utilities-js');

var array = require('./../../common/lang/array'),
    object = require('./../../common/lang/object');

var ConnectionBase = require('./../ConnectionBase'),
    parseMessage = require('./../../messageParser/parseMessage');

var snapshotProvider = require('./../../util/snapshotProvider');

var WebSocketAdapterFactory = require('./adapter/WebSocketAdapterFactory'),
    WebSocketAdapterFactoryForBrowsers = require('./adapter/WebSocketAdapterFactoryForBrowsers');

var LoggerFactory = require('./../../logging/LoggerFactory');

module.exports = function () {
	'use strict';

	var _API_VERSION = 4;

	var state = {
		connecting: 'CONNECTING',
		authenticating: 'LOGGING_IN',
		authenticated: 'LOGGED_IN',
		disconnected: 'DISCONNECTED'
	};

	var ascii = {
		soh: '\x01',
		etx: '\x03',
		lf: '\x0A',
		dc4: '\x14'
	};

	var eventTypes = {
		events: { requiresSymbol: false },
		marketDepth: { requiresSymbol: true },
		marketUpdate: { requiresSymbol: true },
		cumulativeVolume: { requiresSymbol: true },
		timestamp: { requiresSymbol: false }
	};

	var _RECONNECT_INTERVAL = 5000;
	var _WATCHDOG_INTERVAL = 10000;

	var regex = {};

	regex.cmdty = {};
	regex.cmdty.short = /^(BC|BE|BL|EI|EU|CF|CB|UD)(.*)(.CM)$/i;
	regex.cmdty.long = /^(BCSD-|BEA-|BLS-|EIA-|CFTC-|USCB-|USDA-)/i;
	regex.other = /:/i;

	function ConnectionInternal(marketState) {
		var __logger = LoggerFactory.getLogger('@barchart/marketdata-api-js');

		var __marketState = marketState;

		var __connectionFactory = null;

		var __connection = null;
		var __connectionState = state.disconnected;

		var __paused = false;

		var __reconnectAllowed = false;
		var __pollingFrequency = null;

		var __watchdogToken = null;
		var __watchdogAwake = false;

		var __inboundMessages = [];
		var __marketMessages = [];
		var __pendingTasks = [];
		var __outboundMessages = [];

		var __knownConsumerSymbols = {};
		var __pendingProfileSymbols = {};

		var __listeners = {
			marketDepth: {},
			marketUpdate: {},
			cumulativeVolume: {},
			events: [],
			timestamp: []
		};

		var __loginInfo = {
			username: null,
			password: null,
			server: null
		};

		var __decoder = null;

		//
		// Functions used to configure the connection.
		//

		/**
   * Changes the subscription mode to use either "polling" or "streaming" mode. To
   * use "polling" mode, pass the number of milliseconds -- any number less than 1,000
   * will be ignored. To use "streaming" mode, pass a null value or an undefined value.
   *
   * @private
   * @param {Number|undefined|null} pollingFrequency
   */
		function setPollingFrequency(pollingFrequency) {
			if (__paused) {
				resume();
			}

			if (pollingFrequency === null || pollingFrequency === undefined) {
				__logger.log('Connection: Switching to streaming mode.');

				__pollingFrequency = null;
			} else if (typeof pollingFrequency === 'number' && !isNaN(pollingFrequency) && !(pollingFrequency < 1000)) {
				__logger.log('Connection: Switching to polling mode.');

				__pollingFrequency = pollingFrequency;
			}
		}

		//
		// Functions for connecting to and disconnecting from JERQ, monitoring
		// established connections, and handling involuntary disconnects.
		//

		/**
   * Attempts to establish a connection to JERQ, setting the flag to allow
   * reconnection if an involuntary disconnect occurs.
   *
   * @private
   * @param {String} server
   * @param {String} username
   * @param {String} password
   * @param {WebSocketAdapterFactory} webSocketAdapterFactory
   */
		function initializeConnection(server, username, password, webSocketAdapterFactory) {
			__connectionFactory = webSocketAdapterFactory;
			__reconnectAllowed = true;

			connect(server, username, password);
		}

		/**
   * Disconnects from JERQ, setting the flag to prevent further reconnect attempts and
   * clearing internal subscription state.
   *
   * @private
   */
		function terminateConnection() {
			broadcastEvent('events', { event: 'disconnecting' });

			__reconnectAllowed = false;

			__loginInfo.username = null;
			__loginInfo.password = null;
			__loginInfo.server = null;

			__knownConsumerSymbols = {};
			__pendingProfileSymbols = {};

			__listeners.marketDepth = {};
			__listeners.marketUpdate = {};
			__listeners.cumulativeVolume = {};
			__listeners.events = [];
			__listeners.timestamp = [];

			__paused = false;

			disconnect();
		}

		/**
   * Attempts to establish a connection to JERQ.
   *
   * @private
   * @param {String} server
   * @param {String} username
   * @param {String} password
   */
		function connect(server, username, password) {
			if (!server) {
				throw new Error('Unable to connect, the "server" argument is required.');
			}

			if (!username) {
				throw new Error('Unable to connect, the "username" argument is required.');
			}

			if (!password) {
				throw new Error('Unable to connect, the "password" argument is required.');
			}

			if (__connection !== null) {
				__logger.warn('Connection: Unable to connect, a connection already exists.');

				return;
			}

			__logger.log('Connection: Initializing.');

			__loginInfo.username = username;
			__loginInfo.password = password;
			__loginInfo.server = server;

			__connectionState = state.disconnected;

			__connection = __connectionFactory.build('wss://' + __loginInfo.server + '/jerq');
			__connection.binaryType = 'arraybuffer';

			__decoder = __connection.getDecoder();

			__connection.onopen = function () {
				__logger.log('Connection: Open event received.');
			};

			__connection.onclose = function () {
				__logger.log('Connection: Close event received.');

				__connectionState = state.disconnected;

				stopWatchdog();

				__connection.onopen = null;
				__connection.onclose = null;
				__connection.onmessage = null;
				__connection = null;

				// There is a race condition. We enqueue network messages and processes
				// them asynchronously in batches. The asynchronous message processing is
				// done by a function called pumpInboundProcessing. So, it's possible we received
				// a login failure message and enqueued it. But, the websocket was closed
				// before the first invocation of pumpInboundProcessing could process the login
				// failure.

				var loginFailed = __inboundMessages.length > 0 && __inboundMessages[0].indexOf('-') === 0;

				__inboundMessages = [];
				__marketMessages = [];
				__pendingTasks = [];
				__outboundMessages = [];

				if (loginFailed) {
					__logger.warn('Connection: Connection closed before login was processed.');

					broadcastEvent('events', { event: 'login fail' });
				} else {
					__logger.warn('Connection: Connection dropped.');

					broadcastEvent('events', { event: 'disconnect' });

					if (__reconnectAllowed) {
						__logger.log('Connection: Scheduling reconnect attempt.');

						var reconnectAction = function reconnectAction() {
							return connect(__loginInfo.server, __loginInfo.username, __loginInfo.password);
						};
						var reconnectDelay = _RECONNECT_INTERVAL + Math.floor(Math.random() * _WATCHDOG_INTERVAL);

						setTimeout(reconnectAction, reconnectDelay);
					}
				}
			};

			__connection.onmessage = function (event) {
				__watchdogAwake = false;

				var message = null;

				if (event.data instanceof ArrayBuffer) {
					message = __decoder.decode(event.data);
				} else {
					message = event.data;
				}

				if (message) {
					__inboundMessages.push(message);
				}
			};

			startWatchdog();
		}

		/**
   * Changes state to disconnected and attempts to drop the websocket
   * connection to JERQ.
   *
   * @private
   */
		function disconnect() {
			__logger.warn('Connection: Disconnecting.');

			__connectionState = state.disconnected;

			stopWatchdog();

			if (__connection !== null) {
				try {
					if (__connection.readyState === __connection.OPEN) {
						__connection.send('LOGOUT\r\n');
					}

					__logger.warn('Connection: Closing connection.');

					__connection.close();
				} catch (e) {
					__logger.warn('Connection: Unable to close connection.');
				}
			}

			__inboundMessages = [];
			__marketMessages = [];
			__pendingTasks = [];
			__outboundMessages = [];
		}

		function pause() {
			if (__paused) {
				__logger.warn('Connection: Unable to pause, feed is already paused.');

				return;
			}

			__logger.log('Connection: Pausing feed.');

			if (__pollingFrequency === null) {
				enqueueStopTasks();
				enqueueHeartbeat();
			}

			__paused = true;

			broadcastEvent('events', { event: 'feed paused' });
		}

		function resume() {
			if (!__paused) {
				__logger.warn('Connection: Unable to resume, feed is not paused.');

				return;
			}

			__logger.log('Connection: Resuming feed.');

			__paused = false;

			if (__pollingFrequency === null) {
				enqueueGoTasks();
			}

			broadcastEvent('events', { event: 'feed resumed' });
		}

		/**
   * Starts heartbeat connection monitoring.
   *
   * @private
   */
		function startWatchdog() {
			stopWatchdog();

			__logger.log('Connection: Watchdog started.');

			var watchdogAction = function watchdogAction() {
				if (__watchdogAwake) {
					__logger.log('Connection: Watchdog triggered, connection silent for too long. Triggering disconnect.');

					stopWatchdog();

					disconnect();
				} else {
					__watchdogAwake = true;
				}
			};

			__watchdogToken = setInterval(watchdogAction, _WATCHDOG_INTERVAL);
			__watchdogAwake = true;
		}

		/**
   * Stops heartbeat connection monitoring.
   *
   * @private
   */
		function stopWatchdog() {
			if (__watchdogToken !== null) {
				__logger.log('Connection: Watchdog stopped.');

				clearInterval(__watchdogToken);
			}

			__watchdogAwake = false;
		}

		//
		// Functions for handling user-initiated requests to start subscriptions, stop subscriptions,
		// and request profiles.
		//

		/**
   * Subscribes to an event (e.g. quotes, heartbeats, connection status, etc), given
   * the event type, a callback, and a symbol (if necessary).
   *
   * @private
   * @param {Subscription.EventType} eventType
   * @param {Function} handler
   * @param {String=} symbol
   */
		function on(eventType, handler, symbol) {
			if (typeof eventType !== 'string') {
				throw new Error('The "eventType" argument must be a string.');
			}

			if (typeof handler !== 'function') {
				throw new Error('The "handler" argument must be a function.');
			}

			if (!eventTypes.hasOwnProperty(eventType)) {
				__logger.log('Consumer: Unable to process "on" event, event type is not recognized.');

				return;
			}

			var eventData = eventTypes[eventType];

			if (eventData.requiresSymbol) {
				if (typeof symbol !== 'string') {
					throw new Error('The "symbol" argument must be a string for [ ' + eventType + ' ] events.');
				}

				symbol = symbol.toUpperCase().trim();

				if (!symbol || !(symbol.indexOf(' ') < 0)) {
					__logger.log('Consumer: Unable to process "on" command, the "symbol" argument is invalid.');
					__logger.trace();

					return;
				}
			}

			var addListener = function addListener(listeners) {
				listeners = listeners || [];

				var add = !listeners.some(function (candidate) {
					return candidate === handler;
				});

				var updatedListeners = void 0;

				if (add) {
					updatedListeners = listeners.slice(0);
					updatedListeners.push(handler);
				} else {
					updatedListeners = listeners;
				}

				return updatedListeners;
			};

			var subscribe = function subscribe(streamingTaskName, snapshotTaskName, listenerMap, sharedListenerMaps) {
				var consumerSymbol = symbol;
				var producerSymbol = utilities.symbolParser.getProducerSymbol(consumerSymbol);

				addKnownConsumerSymbol(consumerSymbol, producerSymbol);

				var producerListenerExists = getProducerListenerExists(producerSymbol, sharedListenerMaps.concat(listenerMap));

				listenerMap[consumerSymbol] = addListener(listenerMap[consumerSymbol]);

				if (!__paused) {
					if (producerListenerExists) {
						addTask(snapshotTaskName, producerSymbol);
					} else {
						addTask(streamingTaskName, producerSymbol);
					}
				}
			};

			switch (eventType) {
				case 'events':
					__listeners.events = addListener(__listeners.events);
					break;
				case 'marketDepth':
					subscribe('MD_GO', 'MD_REFRESH', __listeners.marketDepth, []);

					if (__marketState.getBook(symbol)) {
						handler({ type: 'INIT', symbol: symbol });
					}

					break;
				case 'marketUpdate':
					subscribe('MU_GO', 'MU_REFRESH', __listeners.marketUpdate, [__listeners.cumulativeVolume]);

					if (__marketState.getQuote(symbol)) {
						handler({ type: 'INIT', symbol: symbol });
					}

					break;
				case 'cumulativeVolume':
					subscribe('MU_GO', 'MU_REFRESH', __listeners.cumulativeVolume, [__listeners.marketUpdate]);

					__marketState.getCumulativeVolume(symbol, function (container) {
						container.on('events', handler);
					});

					break;
				case 'timestamp':
					__listeners.timestamp = addListener(__listeners.timestamp);
					break;
			}
		}

		/**
   * Drops a subscription to an event for a specific handler callback. If other
   * subscriptions to the same event (as determined by strict equality of the
   * handler) the subscription will continue to operate for other handlers.
   *
   * @private
   * @param {Subscription.EventType} eventType
   * @param {Function} handler
   * @param {String=} symbol
   */
		function off(eventType, handler, symbol) {
			if (typeof eventType !== 'string') {
				throw new Error('The "eventType" argument must be a string.');
			}

			if (typeof handler !== 'function') {
				throw new Error('The "handler" argument must be a function.');
			}

			if (!eventTypes.hasOwnProperty(eventType)) {
				__logger.log('Consumer: Unable to process "off" command, event type is not supported [ ' + eventType + ' ].');
				__logger.trace();

				return;
			}

			var eventData = eventTypes[eventType];

			if (eventData.requiresSymbol) {
				if (typeof symbol !== 'string') {
					throw new Error('The "symbol" argument must be a string for [ ' + eventType + ' ] events.');
				}

				symbol = symbol.toUpperCase().trim();

				if (!symbol || !(symbol.indexOf(' ') < 0)) {
					__logger.log('Consumer: Unable to process "off" command, the "symbol" argument is empty.');
					__logger.trace();

					return;
				}
			}

			var removeHandler = function removeHandler(listeners) {
				var listenersToFilter = listeners || [];

				return listenersToFilter.filter(function (candidate) {
					return candidate !== handler;
				});
			};

			var unsubscribe = function unsubscribe(stopTaskName, listenerMap, sharedListenerMaps) {
				var consumerSymbol = symbol;
				var producerSymbol = utilities.symbolParser.getProducerSymbol(consumerSymbol);

				var listenerMaps = sharedListenerMaps.concat(listenerMap);

				var previousProducerListenerExists = getProducerListenerExists(producerSymbol, listenerMaps);
				var currentProducerListenerExists = void 0;

				listenerMap[consumerSymbol] = removeHandler(listenerMap[consumerSymbol] || []);

				if (listenerMap[consumerSymbol].length === 0) {
					delete listenerMap[consumerSymbol];
				}

				currentProducerListenerExists = getProducerListenerExists(producerSymbol, listenerMaps);

				if (previousProducerListenerExists && !currentProducerListenerExists && !__paused) {
					addTask(stopTaskName, producerSymbol);

					if (!getProducerSymbolsExist()) {
						enqueueHeartbeat();
					}
				}
			};

			switch (eventType) {
				case 'events':
					__listeners.events = removeHandler(__listeners.events);

					break;
				case 'marketDepth':
					unsubscribe('MD_STOP', __listeners.marketDepth, []);

					break;
				case 'marketUpdate':
					unsubscribe('MU_STOP', __listeners.marketUpdate, [__listeners.cumulativeVolume]);

					break;
				case 'cumulativeVolume':
					unsubscribe('MU_STOP', __listeners.cumulativeVolume, [__listeners.marketUpdate]);

					__marketState.getCumulativeVolume(symbol, function (container) {
						container.off('events', handler);
					});

					break;
				case 'timestamp':
					__listeners.timestamp = removeHandler(__listeners.timestamp);

					break;
			}
		}

		/**
   * Enqueues a request to retrieve a profile.
   * 
   * @private
   * @param {String} symbol
   */
		function handleProfileRequest(symbol) {
			if (typeof symbol !== 'string') {
				throw new Error('The "symbol" argument must be a string.');
			}

			var consumerSymbol = symbol.toUpperCase().trim();

			if (!consumerSymbol || !(consumerSymbol.indexOf(' ') < 0)) {
				__logger.log('Consumer: Unable to process profile request, the "symbol" argument is empty.');
				__logger.trace();

				return;
			}

			var producerSymbol = utilities.symbolParser.getProducerSymbol(consumerSymbol);

			var pendingConsumerSymbols = __pendingProfileSymbols[producerSymbol] || [];

			if (!pendingConsumerSymbols.some(function (candidate) {
				return candidate === consumerSymbol;
			})) {
				pendingConsumerSymbols.push(consumerSymbol);
			}

			if (!pendingConsumerSymbols.some(function (candidate) {
				return candidate === producerSymbol;
			})) {
				pendingConsumerSymbols.push(producerSymbol);
			}

			__pendingProfileSymbols[producerSymbol] = pendingConsumerSymbols;

			addTask('P_SNAPSHOT', producerSymbol);
		}

		//
		// Utility functions for managing the "task" queue (e.g. work items that likely
		// trigger outbound messages to JERQ.
		//

		/**
   * Adds a task to a queue for asynchronous processing.
   *
   * @private
   * @param {String} id
   * @param {String|null} symbol
   */
		function addTask(id, symbol) {
			if (__connectionState !== state.authenticated) {
				return;
			}

			var lastIndex = __pendingTasks.length - 1;

			if (!(lastIndex < 0) && __pendingTasks[lastIndex].id === id && symbol !== null) {
				__pendingTasks[lastIndex].symbols.push(symbol);
			} else {
				__pendingTasks.push({ id: id, symbols: [symbol] });
			}
		}

		function enqueueHeartbeat() {
			addTask('H_GO', null);
		}

		/**
   * Schedules symbol subscribe tasks for all symbols with listeners, typically
   * used after a reconnect (or in polling mode).
   *
   * @private
   */
		function enqueueGoTasks() {
			var marketUpdateSymbols = getProducerSymbols([__listeners.marketUpdate, __listeners.cumulativeVolume]);
			var marketDepthSymbols = getProducerSymbols([__listeners.marketDepth]);

			marketUpdateSymbols.forEach(function (symbol) {
				addTask('MU_GO', symbol);
			});

			marketDepthSymbols.forEach(function (symbol) {
				addTask('MD_GO', symbol);
			});

			var pendingProfileSymbols = array.unique(object.keys(__pendingProfileSymbols).filter(function (s) {
				return !marketUpdateSymbols.some(function (already) {
					return already === s;
				});
			}));

			pendingProfileSymbols.forEach(function (symbol) {
				addTask('P_SNAPSHOT', symbol);
			});
		}

		/**
   * Schedules symbol unsubscribe tasks for all symbols with listeners.
   *
   * @private
   */
		function enqueueStopTasks() {
			getProducerSymbols([__listeners.marketUpdate, __listeners.cumulativeVolume]).forEach(function (symbol) {
				addTask('MU_STOP', symbol);
			});

			getProducerSymbols([__listeners.marketDepth]).forEach(function (symbol) {
				addTask('MD_STOP', symbol);
			});
		}

		//
		// Functions to process the queue of inbound network messages, authentication handshake
		// messages are handled synchronously. Market-related messages are placed onto a queue
		// for asynchronous processing.
		//

		/**
   * Processes a single inbound message from the network. Any message pertaining
   * to the authentication handshake is intercepted and handled synchronously. 
   * Any message pertaining to market state is placed onto another queue for 
   * asynchronous processing.
   *
   * @private
   * @param {String} message - The message, as received from the network.
   */
		function processInboundMessage(message) {
			if (__connectionState === state.disconnected) {
				__connectionState = state.connecting;
			}

			if (__connectionState === state.connecting) {
				var lines = message.split('\n');

				if (lines.some(function (line) {
					return line == '+++';
				})) {
					__connectionState = state.authenticating;

					__logger.log('Connection: Sending credentials.');

					__connection.send('LOGIN ' + __loginInfo.username + ':' + __loginInfo.password + ' VERSION=' + _API_VERSION + '\r\n');
				}
			} else if (__connectionState === state.authenticating) {
				var firstCharacter = message.charAt(0);

				if (firstCharacter === '+') {
					__connectionState = state.authenticated;

					__logger.log('Connection: Login accepted.');

					broadcastEvent('events', { event: 'login success' });

					if (__paused) {
						__logger.log('Connection: Establishing heartbeat only -- feed is paused.');

						enqueueHeartbeat();
					} else {
						__logger.log('Connection: Establishing subscriptions for heartbeat and existing symbols.');

						enqueueHeartbeat();
						enqueueGoTasks();
					}
				} else if (firstCharacter === '-') {
					__logger.log('Connection: Login failed.');

					broadcastEvent('events', { event: 'login fail' });

					disconnect();
				}
			}

			if (__connectionState === state.authenticated) {
				__marketMessages.push(message);
			}
		}

		/**
   * Drains the queue of inbound network messages and schedules another
   * run. Any error that is encountered triggers a disconnect.
   *
   * @private
   */
		function pumpInboundProcessing() {
			try {
				while (__inboundMessages.length > 0) {
					processInboundMessage(__inboundMessages.shift());
				}
			} catch (e) {
				__logger.warn('Pump Inbound: An error occurred during inbound message queue processing. Disconnecting.', e);

				disconnect();
			}

			setTimeout(pumpInboundProcessing, 125);
		}

		//
		// Functions to process the queue of market-related messages, updating market
		// state and notifying interested subscribers.
		//

		/**
   * Invokes consumer-supplied callbacks in response to new events (e.g. market
   * state updates, heartbeats, connection status changes, etc).
   *
   * @private
   * @param {String} eventType
   * @param {Object} message
   */
		function broadcastEvent(eventType, message) {
			var listeners = void 0;

			if (eventType === 'events') {
				listeners = __listeners.events;
			} else if (eventType === 'marketDepth') {
				listeners = __listeners.marketDepth[message.symbol];
			} else if (eventType === 'marketUpdate') {
				listeners = __listeners.marketUpdate[message.symbol];
			} else if (eventType === 'timestamp') {
				listeners = __listeners.timestamp;
			} else {
				__logger.warn('Broadcast: Unable to notify subscribers of [ ' + eventType + ' ] event.');

				listeners = null;
			}

			if (listeners) {
				listeners.forEach(function (listener) {
					try {
						listener(message);
					} catch (e) {
						__logger.warn('Broadcast: A consumer-supplied listener for [ ' + eventType + ' ] events threw an error. Continuing.,', e);
					}
				});
			}
		}

		/**
   * Processes a parsed market message. Updates internal market state and invokes
   * callbacks for interested subscribers.
   * 
   * @private
   * @param {Object} message
   */
		function processMarketMessage(message) {
			__marketState.processMessage(message);

			if (message.type === 'BOOK') {
				broadcastEvent('marketDepth', message);
			} else if (message.type === 'TIMESTAMP') {
				broadcastEvent('timestamp', __marketState.getTimestamp());
			} else {
				broadcastEvent('marketUpdate', message);
			}
		}

		/**
   * Converts a JERQ message into an object suitable for passing to
   * the {@link MarketState#processMessage} function. Then processes and
   * broadcasts the parsed message. Also, if other "consumer" symbols are 
   * aliases of the "producer" symbol in the message, the message is cloned 
   * and processed for the "consumer" symbols alias(es) too.
   * 
   * @private
   * @param {String} message
   */
		function parseMarketMessage(message) {
			try {
				var parsed = parseMessage(message);

				var producerSymbol = parsed.symbol;

				if (parsed.type) {
					if (producerSymbol) {
						var consumerSymbols = __knownConsumerSymbols[producerSymbol] || [];

						if (__pendingProfileSymbols.hasOwnProperty(producerSymbol)) {
							var profileSymbols = __pendingProfileSymbols[producerSymbol] || [];

							consumerSymbols = array.unique(consumerSymbols.concat(profileSymbols));

							delete __pendingProfileSymbols[producerSymbol];
						}

						consumerSymbols.forEach(function (consumerSymbol) {
							var messageToProcess = void 0;

							if (consumerSymbol === producerSymbol) {
								messageToProcess = parsed;
							} else {
								messageToProcess = Object.assign({}, parsed);
								messageToProcess.symbol = consumerSymbol;
							}

							processMarketMessage(messageToProcess);
						});
					} else {
						processMarketMessage(parsed);
					}
				} else {
					__logger.log(message);
				}
			} catch (e) {
				__logger.error('An error occurred while parsing a market message [ ' + message + ' ]. Continuing.', e);
			}
		}

		/**
   * Drains the queue of market network messages and schedules another
   * run. Any error encountered triggers a disconnect.
   *
   * @private
   */
		function pumpMarketProcessing() {
			var suffixLength = 9;

			var done = false;

			while (!done) {
				var s = __marketMessages.shift();

				if (!s) {
					done = true;
				} else {
					var skip = false;

					var msgType = 1; // Assume DDF message containing \x03

					var idx = -1;
					var idxETX = s.indexOf(ascii.etx);
					var idxNL = s.indexOf(ascii.lf);

					if (idxNL > -1 && (idxETX < 0 || idxNL < idxETX)) {
						idx = idxNL;
						msgType = 2;
					} else if (idxETX > -1) {
						idx = idxETX;
					}

					if (idx > -1) {
						var epos = idx + 1;

						if (msgType == 1) {
							if (s.length < idx + suffixLength + 1) {
								if (__marketMessages.length > 0) __marketMessages[0] = s + __marketMessages[0];else {
									__marketMessages.unshift(s);
									done = true;
								}

								skip = true;
							} else if (s.substr(idx + 1, 1) == ascii.dc4) {
								epos += suffixLength + 1;
							}
						}

						if (!skip) {
							var s2 = s.substring(0, epos);
							if (msgType == 2) {
								s2 = s2.trim();
							} else {
								idx = s2.indexOf(ascii.soh);
								if (idx > 0) {
									s2 = s2.substring(idx);
								}
							}

							if (s2.length > 0) {
								parseMarketMessage(s2);
							}

							s = s.substring(epos);

							if (s.length > 0) {
								if (__marketMessages.length > 0) {
									__marketMessages[0] = s + __marketMessages[0];
								} else {
									__marketMessages.unshift(s);
								}
							}
						}
					} else {
						if (s.length > 0) {
							if (__marketMessages.length > 0) {
								__marketMessages[0] = s + __marketMessages[0];
							} else {
								__marketMessages.unshift(s);
								done = true;
							}
						}
					}
				}

				if (__marketMessages.length === 0) {
					done = true;
				}
			}

			setTimeout(pumpMarketProcessing, 125);
		}

		//
		// Functions to process the queue of tasks. Tasks define a request to start or
		// stop a symbol subscription (or a profile lookup). Tasks are formatted as 
		// JERQ command strings and placed onto another queue for asynchronous processing.
		//

		/**
   * Used in "polling" mode. The task queue is ignored. However, JERQ formatted command
   * strings, requesting snapshot updates from JERQ, are generated for all existing
   * symbol subscriptions and placed onto a queue for asynchronous processing. Also, 
   * for any symbol not supported by JERQ, out-of-band snapshot requests are made.
   *
   * @private
   */
		function processTasksInPollingMode() {
			if (__connectionState !== state.authenticated || __outboundMessages.length !== 0 || __paused) {
				return;
			}

			__pendingTasks = [];

			var quoteBatches = getSymbolBatches(getProducerSymbols([__listeners.marketUpdate, __listeners.cumulativeVolume]), getIsStreamingSymbol);

			quoteBatches.forEach(function (batch) {
				__outboundMessages.push('GO ' + batch.map(function (s) {
					return s + '=sc';
				}).join(','));
			});

			var profileBatches = getSymbolBatches(array.unique(object.keys(__pendingProfileSymbols)).filter(function (s) {
				return !quoteBatches.some(function (q) {
					return q === s;
				});
			}), getIsStreamingSymbol);

			profileBatches.forEach(function (batch) {
				__outboundMessages.push('GO ' + batch.map(function (s) {
					return s + '=s';
				}).join(','));
			});

			var bookBatches = getSymbolBatches(getProducerSymbols([__listeners.marketDepth]), getIsStreamingSymbol);

			bookBatches.forEach(function (batch) {
				__outboundMessages.push('GO ' + batch.map(function (s) {
					return s + '=b';
				}).join(','));
			});

			var snapshotBatches = getSymbolBatches(getProducerSymbols([__listeners.marketUpdate]), getIsSnapshotSymbol);

			snapshotBatches.forEach(function (batch) {
				processSnapshots(batch);
			});
		}

		/**
   * Used in "streaming" mode. The task queue is drained and JERQ formatted command
   * strings are generated for each task. These commands placed onto a queue for
   * asynchronous transmission to JERQ. Also, for any symbol not supported by JERQ, 
   * out-of-band snapshot requests are made.
   *
   * @private
   */
		function processTasksInStreamingMode() {
			if (__connectionState !== state.authenticated) {
				return;
			}

			while (__pendingTasks.length > 0) {
				var task = __pendingTasks.shift();

				if (task.callback) {
					task.callback();
				} else if (task.id) {
					var _ret = function () {
						var command = null;
						var suffix = null;

						switch (task.id) {
							case 'MD_GO':
								command = 'GO';
								suffix = 'Bb';
								break;
							case 'MU_GO':
								command = 'GO';
								suffix = 'Ssc';
								break;
							case 'MD_REFRESH':
								command = 'GO';
								suffix = 'b';
								break;
							case 'MU_REFRESH':
								command = 'GO';
								suffix = 'sc';
								break;
							case 'P_SNAPSHOT':
								command = 'GO';
								suffix = 's';
								break;
							case 'MD_STOP':
								command = 'STOP';
								suffix = 'Bb';
								break;
							case 'MU_STOP':
								command = 'STOP';
								suffix = 'Ssc';
								break;
							case 'H_GO':
								command = 'GO _TIMESTAMP_';
								suffix = null;
								break;
						}

						if (command === null) {
							__logger.warn('Pump Tasks: An unsupported task was found in the tasks queue.');

							return 'continue';
						}

						if (suffix === null) {
							__outboundMessages.push(command);
						} else {
							var batchSize = void 0;

							if (task.id === 'MD_GO' || task.id === 'MD_STOP') {
								batchSize = 1;
							} else {
								batchSize = 250;
							}

							var symbolsUnique = array.unique(task.symbols);

							var symbolsStreaming = symbolsUnique.filter(getIsStreamingSymbol);
							var symbolsSnapshot = symbolsUnique.filter(getIsSnapshotSymbol);

							while (symbolsStreaming.length > 0) {
								var batch = symbolsStreaming.splice(0, batchSize);

								__outboundMessages.push(command + ' ' + batch.map(function (s) {
									return s + '=' + suffix;
								}).join(','));
							}

							if (task.id === 'MU_GO' || task.id === 'MU_REFRESH') {
								while (symbolsSnapshot.length > 0) {
									var _batch = symbolsSnapshot.splice(0, batchSize);

									processSnapshots(_batch);
								}
							}
						}
					}();

					if (_ret === 'continue') continue;
				}
			}
		}

		/**
   * Drains the queue of "tasks" and schedules another run. Any error
   * encountered triggers a disconnect.
   *
   * @private
   * @param {Boolean=} polling - Indicates if the previous run used polling mode.
   */
		function pumpTaskProcessing(polling) {
			var pumpDelegate = void 0;
			var pumpDelay = void 0;

			if (__pollingFrequency === null) {
				pumpDelay = 250;
				pumpDelegate = processTasksInStreamingMode;

				if (polling && !__paused) {
					enqueueGoTasks();
				}
			} else {
				pumpDelay = __pollingFrequency;
				pumpDelegate = processTasksInPollingMode;

				if (!polling) {
					enqueueStopTasks();

					processTasksInStreamingMode();
				}
			}

			var pumpWrapper = function pumpWrapper() {
				try {
					pumpDelegate();
				} catch (e) {
					__logger.warn('Pump Tasks: An error occurred during task queue processing. Disconnecting.', e);

					disconnect();
				}

				pumpTaskProcessing(pumpDelegate === processTasksInPollingMode);
			};

			setTimeout(pumpWrapper, pumpDelay);
		}

		//
		// Functions to process the queue of outbound messages (to JERQ).
		//

		/**
   * Sends outbound messages to JERQ and reschedules another run.
   *
   * @private
   */
		function pumpOutboundProcessing() {
			if (__connectionState === state.authenticated) {
				while (__outboundMessages.length > 0) {
					try {
						var message = __outboundMessages.shift();

						__logger.log(message);

						__connection.send(message);
					} catch (e) {
						__logger.warn('Pump Outbound: An error occurred during outbound message queue processing. Disconnecting.', e);

						disconnect();

						break;
					}
				}
			}

			setTimeout(pumpOutboundProcessing, 200);
		}

		//
		// Functions used to maintain market state for symbols which are not supported
		// by JERQ.
		//

		/**
   * Makes requests for snapshot updates for a batch of symbols to an out-of-band
   * service (i.e. OnDemand). This function is typically used for symbols that are
   * not supported by JERQ.
   *
   * @private
   * @param {Array<String>} symbols
   */
		function processSnapshots(symbols) {
			if (__connectionState !== state.authenticated || symbols.length === 0) {
				return;
			}

			snapshotProvider(symbols, __loginInfo.username, __loginInfo.password).then(function (quotes) {
				quotes.forEach(function (message) {
					return processMarketMessage(message);
				});
			}).catch(function (e) {
				__logger.log('Snapshots: Out-of-band snapshot request failed for [ ${symbols.join()} ]', e);
			});
		}

		/**
   * Periodically requests snapshots for existing symbols subscriptions which do not
   * stream through JERQ.
   *
   * @private
   */
		function pumpSnapshotRefresh() {
			if (__connectionState === state.authenticated) {
				try {
					var snapshotBatches = getSymbolBatches(getProducerSymbols([__listeners.marketUpdate]), getIsSnapshotSymbol);

					snapshotBatches.forEach(function (batch) {
						processSnapshots(batch);
					});
				} catch (e) {
					__logger.warn('Snapshots: An error occurred during refresh processing. Ignoring.', e);
				}
			}

			setTimeout(pumpSnapshotRefresh, 3600000);
		}

		//
		// Internal utility functions for querying symbol subscriptions.
		//

		/**
   * Returns the number of unique "producer" symbols which have user interest.
   *
   * @private
   * @returns {Number}
   */
		function getProducerSymbolCount() {
			return getProducerSymbols([__listeners.marketUpdate, __listeners.marketDepth, __listeners.cumulativeVolume]).length;
		}

		/**
   * If true, if at least one "producer" symbol has user interest.
   *
   * @private
   * @returns {Boolean}
   */
		function getProducerSymbolsExist() {
			return !(object.empty(__listeners.marketUpdate) && object.empty(__listeners.marketDepth) && object.empty(__listeners.cumulativeVolume));
		}

		/**
   * Extracts all "producer" symbols from an array of listener maps.
   *
   * A listener map is keyed by "consumer" symbol -- the symbol used
   * to establish the subscription (e.g. ESZ18), which is could be an
   * alias for a "producer" symbol (e.g. ESZ8).
   *
   * @private
   * @param {Array<Object>} listenerMaps
   * @returns {Array<String>}
   */
		function getProducerSymbols(listenerMaps) {
			var producerSymbols = listenerMaps.reduce(function (symbols, listenerMap) {
				return symbols.concat(object.keys(listenerMap).map(function (consumerSymbol) {
					return utilities.symbolParser.getProducerSymbol(consumerSymbol);
				}));
			}, []);

			return array.unique(producerSymbols);
		}

		/**
   * A predicate that determines if an upstream subscription should
   * exist for a "producer" symbol, based on the consumer symbols in
   * the array of listener maps.
   *
   * A "consumer" symbol (e.g. ESZ18) is the symbol used to establish a
   * subscription with this library and a "producer" symbol (e.g. ESZ8)
   * is used to communicate with upstream services (e.g. JERQ). In other
   * words, a "consumer" symbol could be an alias for a "producer" symbol
   * and multiple "consumer" symbols can exist for a single "producer" symbol.
   *
   * @private
   * @param {String} producerSymbol
   * @param {Array<Object>} listenerMaps
   * @returns {Boolean}
   */
		function getProducerListenerExists(producerSymbol, listenerMaps) {
			var consumerSymbols = __knownConsumerSymbols[producerSymbol] || [];

			return consumerSymbols.some(function (consumerSymbol) {
				return getConsumerListenerExists(consumerSymbol, listenerMaps);
			});
		}

		/**
   * A predicate that determines if an upstream subscription should
   * exist for a "consumer" symbol, based on the consumer symbols in
   * the array of listener maps.
   *
   * A "consumer" symbol (e.g. ESZ18) is the symbol used to establish a
   * subscription with this library and a "producer" symbol (e.g. ESZ8)
   * is used to communicate with upstream services (e.g. JERQ). In other
   * words, a "consumer" symbol could be an alias for a "producer" symbol
   * and multiple "consumer" symbols can exist for a single "producer" symbol.
   *
   * @private
   * @param {String} consumerSymbol
   * @param {Array<Object>} listenerMaps
   * @returns {boolean}
   */
		function getConsumerListenerExists(consumerSymbol, listenerMaps) {
			return listenerMaps.some(function (listenerMap) {
				return listenerMap.hasOwnProperty(consumerSymbol) && listenerMap[consumerSymbol].length !== 0;
			});
		}

		/**
   * Links a "consumer" symbol to a "producer" symbol in the map
   * of known aliases. This map of "known" consumer symbols is
   * keyed by "producer" symbols and has an array of "consumer"
   * symbols as values.
   *
   * A "consumer" symbol (e.g. ESZ18) is the symbol used to establish a
   * subscription with this library and a "producer" symbol (e.g. ESZ8)
   * is used to communicate with upstream services (e.g. JERQ). In other
   * words, a "consumer" symbol could be an alias for a "producer" symbol
   * and multiple "consumer" symbols can exist for a single "producer" symbol.
   *
   * @private
   * @param {String} consumerSymbol
   * @param {String} producerSymbol
   */
		function addKnownConsumerSymbol(consumerSymbol, producerSymbol) {
			if (!__knownConsumerSymbols.hasOwnProperty(producerSymbol)) {
				__knownConsumerSymbols[producerSymbol] = [];
			}

			var consumerSymbols = __knownConsumerSymbols[producerSymbol];

			if (!consumerSymbols.some(function (candidate) {
				return candidate === consumerSymbol;
			})) {
				consumerSymbols.push(consumerSymbol);
			}
		}

		//
		// Pure utility functions.
		//

		/**
   * Predicate used to determine if a symbol is supported by JERQ (allowing a
   * streaming market data subscription to be established).
   *
   * @private
   * @param {String} symbol
   * @returns {Boolean}
   */
		function getIsStreamingSymbol(symbol) {
			return !getIsSnapshotSymbol(symbol);
		}

		/**
   * Predicate used to determine if a symbol is not supported by JERQ (which
   * requires out-of-band efforts to get market data for the symbol).
   *
   * @private
   * @param {String} symbol
   * @returns {Boolean}
   */
		function getIsSnapshotSymbol(symbol) {
			return regex.cmdty.long.test(symbol) || regex.cmdty.short.test(symbol) || regex.other.test(symbol);
		}

		/**
   * Breaks an array of symbols into multiple array, each containing no more
   * than 250 symbols. Also, symbols are filtered according to a predicate.
   *
   * @private
   * @param {Array<String>} symbols
   * @param {Function} predicate
   * @returns {Array<Array<String>>}
   */
		function getSymbolBatches(symbols, predicate) {
			var candidates = symbols.filter(predicate);
			var partitions = [];

			while (candidates.length !== 0) {
				partitions.push(candidates.splice(0, 250));
			}

			return partitions;
		}

		//
		// Begin "pumps" which perform repeated processing.
		//

		setTimeout(pumpInboundProcessing, 125);
		setTimeout(pumpOutboundProcessing, 200);
		setTimeout(pumpMarketProcessing, 125);
		setTimeout(pumpTaskProcessing, 250);
		setTimeout(pumpSnapshotRefresh, 3600000);

		return {
			connect: initializeConnection,
			disconnect: terminateConnection,
			pause: pause,
			resume: resume,
			off: off,
			on: on,
			getProducerSymbolCount: getProducerSymbolCount,
			setPollingFrequency: setPollingFrequency,
			handleProfileRequest: handleProfileRequest
		};
	}

	/**
  * Entry point for library. This implementation is intended for browser environments and uses built-in Websocket support.
  *
  * @public
  * @extends ConnectionBase
  * @variation browser
  */

	var Connection = function (_ConnectionBase) {
		_inherits(Connection, _ConnectionBase);

		function Connection() {
			_classCallCheck(this, Connection);

			var _this = _possibleConstructorReturn(this, (Connection.__proto__ || Object.getPrototypeOf(Connection)).call(this));

			_this._internal = ConnectionInternal(_this.getMarketState());
			return _this;
		}

		_createClass(Connection, [{
			key: '_connect',
			value: function _connect(webSocketAdapterFactory) {
				this._internal.connect(this.getServer(), this.getUsername(), this.getPassword(), webSocketAdapterFactory === null ? new WebSocketAdapterFactoryForBrowsers() : webSocketAdapterFactory);
			}
		}, {
			key: '_disconnect',
			value: function _disconnect() {
				this._internal.disconnect();
			}
		}, {
			key: '_pause',
			value: function _pause() {
				this._internal.pause();
			}
		}, {
			key: '_resume',
			value: function _resume() {
				this._internal.resume();
			}
		}, {
			key: '_on',
			value: function _on() {
				this._internal.on.apply(this._internal, arguments);
			}
		}, {
			key: '_off',
			value: function _off() {
				this._internal.off.apply(this._internal, arguments);
			}
		}, {
			key: '_getActiveSymbolCount',
			value: function _getActiveSymbolCount() {
				return this._internal.getProducerSymbolCount();
			}
		}, {
			key: '_onPollingFrequencyChanged',
			value: function _onPollingFrequencyChanged(pollingFrequency) {
				return this._internal.setPollingFrequency(pollingFrequency);
			}
		}, {
			key: '_handleProfileRequest',
			value: function _handleProfileRequest(symbol) {
				this._internal.handleProfileRequest(symbol);
			}
		}, {
			key: 'toString',
			value: function toString() {
				return '[Connection]';
			}
		}]);

		return Connection;
	}(ConnectionBase);

	return Connection;
}();

},{"./../../common/lang/array":2,"./../../common/lang/object":3,"./../../logging/LoggerFactory":12,"./../../messageParser/parseMessage":20,"./../../util/snapshotProvider":32,"./../ConnectionBase":4,"./adapter/WebSocketAdapterFactory":8,"./adapter/WebSocketAdapterFactoryForBrowsers":9,"@barchart/marketdata-utilities-js":38}],7:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

module.exports = function () {
	'use strict';

	/**
  * An interface for establishing and interacting with a WebSocket connection.
  *
  * @public
  * @private
  * @interface
  */

	var WebSocketAdapter = function () {
		function WebSocketAdapter(host) {
			_classCallCheck(this, WebSocketAdapter);
		}

		_createClass(WebSocketAdapter, [{
			key: 'send',
			value: function send(message) {
				return;
			}
		}, {
			key: 'close',
			value: function close() {
				return;
			}
		}, {
			key: 'getDecoder',
			value: function getDecoder() {
				return null;
			}
		}, {
			key: 'toString',
			value: function toString() {
				return '[WebSocketAdapter]';
			}
		}, {
			key: 'CONNECTING',
			get: function get() {
				return null;
			}
		}, {
			key: 'OPEN',
			get: function get() {
				return null;
			}
		}, {
			key: 'CLOSING',
			get: function get() {
				return null;
			}
		}, {
			key: 'CLOSED',
			get: function get() {
				return null;
			}
		}, {
			key: 'binaryType',
			get: function get() {
				return null;
			},
			set: function set(value) {
				return;
			}
		}, {
			key: 'readyState',
			get: function get() {
				return null;
			},
			set: function set(value) {
				return;
			}
		}, {
			key: 'onopen',
			get: function get() {
				return null;
			},
			set: function set(callback) {
				return;
			}
		}, {
			key: 'onclose',
			get: function get() {
				return null;
			},
			set: function set(callback) {
				return;
			}
		}, {
			key: 'onmessage',
			get: function get() {
				return null;
			},
			set: function set(callback) {
				return;
			}
		}]);

		return WebSocketAdapter;
	}();

	return WebSocketAdapter;
}();

},{}],8:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

module.exports = function () {
	'use strict';

	/**
  * An interface for creating WebSocket {@link WebSocketAdapter} instances.
  *
  * @public
  * @interface
  */

	var WebSocketAdapterFactory = function () {
		function WebSocketAdapterFactory() {
			_classCallCheck(this, WebSocketAdapterFactory);
		}

		_createClass(WebSocketAdapterFactory, [{
			key: 'build',
			value: function build(host) {
				return null;
			}
		}, {
			key: 'toString',
			value: function toString() {
				return '[WebSocketAdapterFactory]';
			}
		}]);

		return WebSocketAdapterFactory;
	}();

	return WebSocketAdapterFactory;
}();

},{}],9:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var WebSocketAdapter = require('./WebSocketAdapter'),
    WebSocketAdapterFactory = require('./WebSocketAdapterFactory');

var LoggerFactory = require('./../../../logging/LoggerFactory');

module.exports = function () {
	'use strict';

	var __window = void 0;

	try {
		__window = window || self || null;
	} catch (e) {
		__window = null;
	}

	/**
  * An implementation of {@link WebSocketAdapterFactory} for use with web browsers.
  *
  * @public
  * @extends {WebSocketAdapterFactory}
  */

	var WebSocketAdapterFactoryForBrowsers = function (_WebSocketAdapterFact) {
		_inherits(WebSocketAdapterFactoryForBrowsers, _WebSocketAdapterFact);

		function WebSocketAdapterFactoryForBrowsers() {
			_classCallCheck(this, WebSocketAdapterFactoryForBrowsers);

			var _this = _possibleConstructorReturn(this, (WebSocketAdapterFactoryForBrowsers.__proto__ || Object.getPrototypeOf(WebSocketAdapterFactoryForBrowsers)).call(this));

			_this._logger = LoggerFactory.getLogger('@barchart/marketdata-api-js');
			return _this;
		}

		_createClass(WebSocketAdapterFactoryForBrowsers, [{
			key: 'build',
			value: function build(host) {
				if (!__window || !__window.WebSocket) {
					this._logger.warn('Connection: Unable to connect, WebSockets are not supported.');

					return;
				}

				return new WebSocketAdapterForBrowsers(host);
			}
		}, {
			key: 'toString',
			value: function toString() {
				return '[WebSocketAdapterFactoryForBrowsers]';
			}
		}]);

		return WebSocketAdapterFactoryForBrowsers;
	}(WebSocketAdapterFactory);

	/**
  * A {@link WebSocketAdapter} for use with browsers.
  * 
  * @private
  * @extends {WebSocketAdapter}
  */


	var WebSocketAdapterForBrowsers = function (_WebSocketAdapter) {
		_inherits(WebSocketAdapterForBrowsers, _WebSocketAdapter);

		function WebSocketAdapterForBrowsers(host) {
			_classCallCheck(this, WebSocketAdapterForBrowsers);

			var _this2 = _possibleConstructorReturn(this, (WebSocketAdapterForBrowsers.__proto__ || Object.getPrototypeOf(WebSocketAdapterForBrowsers)).call(this, host));

			_this2._socket = new WebSocket(host);
			return _this2;
		}

		_createClass(WebSocketAdapterForBrowsers, [{
			key: 'send',
			value: function send(message) {
				this._socket.send(message);
			}
		}, {
			key: 'close',
			value: function close() {
				this._socket.close();
			}
		}, {
			key: 'getDecoder',
			value: function getDecoder() {
				var decoder = void 0;

				if (__window) {
					decoder = new __window.TextDecoder();
				} else {
					decoder = {
						decode: function decode(data) {
							return String.fromCharCode.apply(null, new Uint8Array(data));
						}
					};
				}

				return decoder;
			}
		}, {
			key: 'toString',
			value: function toString() {
				return '[WebSocketAdapterForBrowsers]';
			}
		}, {
			key: 'CONNECTING',
			get: function get() {
				return WebSocket.CONNECTING;
			}
		}, {
			key: 'OPEN',
			get: function get() {
				return WebSocket.OPEN;
			}
		}, {
			key: 'CLOSING',
			get: function get() {
				return WebSocket.CLOSING;
			}
		}, {
			key: 'CLOSED',
			get: function get() {
				return WebSocket.CLOSED;
			}
		}, {
			key: 'binaryType',
			get: function get() {
				return this._socket.binaryType;
			},
			set: function set(value) {
				this._socket.binaryType = value;
			}
		}, {
			key: 'readyState',
			get: function get() {
				return this._socket.readyState;
			},
			set: function set(value) {
				this._socket.readyState = value;
			}
		}, {
			key: 'onopen',
			get: function get() {
				return this._socket.onopen;
			},
			set: function set(callback) {
				this._socket.onopen = callback;
			}
		}, {
			key: 'onclose',
			get: function get() {
				return this._socket.onclose;
			},
			set: function set(callback) {
				this._socket.onclose = callback;
			}
		}, {
			key: 'onmessage',
			get: function get() {
				return this._socket.onmessage;
			},
			set: function set(callback) {
				this._socket.onmessage = callback;
			}
		}]);

		return WebSocketAdapterForBrowsers;
	}(WebSocketAdapter);

	return WebSocketAdapterFactoryForBrowsers;
}();

},{"./../../../logging/LoggerFactory":12,"./WebSocketAdapter":7,"./WebSocketAdapterFactory":8}],10:[function(require,module,exports){
'use strict';

var connection = require('./connection/index'),
    MarketState = require('./marketState/index'),
    messageParser = require('./messageParser/index'),
    util = require('./util/index');

module.exports = function () {
	'use strict';

	return {
		Connection: connection,

		MarketState: MarketState,

		MessageParser: messageParser,
		messageParser: messageParser,

		Util: util,
		util: util,

		version: '3.2.14'
	};
}();

},{"./connection/index":5,"./marketState/index":18,"./messageParser/index":19,"./util/index":28}],11:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

module.exports = function () {
	'use strict';

	/**
  * An interface for writing log messages.
  *
  * @public
  * @interface
  */

	var Logger = function () {
		function Logger() {
			_classCallCheck(this, Logger);
		}

		/**
   * Writes a log message.
   *
   * @public
   */


		_createClass(Logger, [{
			key: 'log',
			value: function log() {
				return;
			}

			/**
    * Writes a log message, at "debug" level.
    *
    * @public
    */

		}, {
			key: 'debug',
			value: function debug() {
				return;
			}

			/**
    * Writes a log message, at "info" level.
    *
    * @public
    */

		}, {
			key: 'info',
			value: function info() {
				return;
			}

			/**
    * Writes a log message, at "warn" level.
    *
    * @public
    */

		}, {
			key: 'warn',
			value: function warn() {
				return;
			}

			/**
    * Writes a log message, at "error" level.
    *
    * @public
    */

		}, {
			key: 'error',
			value: function error() {
				return;
			}
		}, {
			key: 'toString',
			value: function toString() {
				return '[Logger]';
			}
		}]);

		return Logger;
	}();

	return Logger;
}();

},{}],12:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Logger = require('./Logger'),
    LoggerProvider = require('./LoggerProvider');

module.exports = function () {
	'use strict';

	var __provider = null;

	/**
  * Static utilities for interacting with the log system.
  *
  * @public
  * @interface
  */

	var LoggerFactory = function () {
		function LoggerFactory() {
			_classCallCheck(this, LoggerFactory);
		}

		/**
   * Configures the library to write log messages to the console.
   *
   * @public
   * @static
   */


		_createClass(LoggerFactory, [{
			key: 'toString',
			value: function toString() {
				return '[LoggerFactory]';
			}
		}], [{
			key: 'configureForConsole',
			value: function configureForConsole() {
				LoggerFactory.configure(new ConsoleLoggerProvider());
			}

			/**
    * Configures the mute all log messages.
    *
    * @public
    * @static
    */

		}, {
			key: 'configureForSilence',
			value: function configureForSilence() {
				LoggerFactory.configure(new EmptyLoggerProvider());
			}

			/**
    * Configures the library to delegate any log messages to a custom
    * implementation of the {@link LoggerProvider} interface.
    *
    * @public
    * @static
    * @param {LoggerProvider} provider
    */

		}, {
			key: 'configure',
			value: function configure(provider) {
				if (__provider === null && provider instanceof LoggerProvider) {
					__provider = provider;
				}
			}

			/**
    * Returns an instance of {@link Logger} for a specific category.
    *
    * @public
    * @static
    * @param {String} category
    * @return {Logger}
    */

		}, {
			key: 'getLogger',
			value: function getLogger(category) {
				if (__provider === null) {
					LoggerFactory.configureForConsole();
				}

				return __provider.getLogger(category);
			}
		}]);

		return LoggerFactory;
	}();

	var __consoleLogger = null;

	var ConsoleLoggerProvider = function (_LoggerProvider) {
		_inherits(ConsoleLoggerProvider, _LoggerProvider);

		function ConsoleLoggerProvider() {
			_classCallCheck(this, ConsoleLoggerProvider);

			return _possibleConstructorReturn(this, (ConsoleLoggerProvider.__proto__ || Object.getPrototypeOf(ConsoleLoggerProvider)).call(this));
		}

		_createClass(ConsoleLoggerProvider, [{
			key: 'getLogger',
			value: function getLogger(category) {
				if (__consoleLogger === null) {
					__consoleLogger = new ConsoleLogger();
				}

				return __consoleLogger;
			}
		}, {
			key: 'toString',
			value: function toString() {
				return '[ConsoleLoggerProvider]';
			}
		}]);

		return ConsoleLoggerProvider;
	}(LoggerProvider);

	var ConsoleLogger = function (_Logger) {
		_inherits(ConsoleLogger, _Logger);

		function ConsoleLogger() {
			_classCallCheck(this, ConsoleLogger);

			return _possibleConstructorReturn(this, (ConsoleLogger.__proto__ || Object.getPrototypeOf(ConsoleLogger)).call(this));
		}

		_createClass(ConsoleLogger, [{
			key: 'log',
			value: function log() {
				console.log.apply(console, arguments);
			}
		}, {
			key: 'trace',
			value: function trace() {
				console.trace.apply(console, arguments);
			}
		}, {
			key: 'info',
			value: function info() {
				console.info.apply(console, arguments);
			}
		}, {
			key: 'warn',
			value: function warn() {
				console.warn.apply(console, arguments);
			}
		}, {
			key: 'error',
			value: function error() {
				console.error.apply(console, arguments);
			}
		}, {
			key: 'toString',
			value: function toString() {
				return '[ConsoleLogger]';
			}
		}]);

		return ConsoleLogger;
	}(Logger);

	var __emptyLogger = null;

	var EmptyLoggerProvider = function (_LoggerProvider2) {
		_inherits(EmptyLoggerProvider, _LoggerProvider2);

		function EmptyLoggerProvider() {
			_classCallCheck(this, EmptyLoggerProvider);

			return _possibleConstructorReturn(this, (EmptyLoggerProvider.__proto__ || Object.getPrototypeOf(EmptyLoggerProvider)).call(this));
		}

		_createClass(EmptyLoggerProvider, [{
			key: 'getLogger',
			value: function getLogger(category) {
				if (__emptyLogger === null) {
					__emptyLogger = new EmptyLogger();
				}

				return __emptyLogger;
			}
		}, {
			key: 'toString',
			value: function toString() {
				return '[EmptyLoggerProvider]';
			}
		}]);

		return EmptyLoggerProvider;
	}(LoggerProvider);

	var EmptyLogger = function (_Logger2) {
		_inherits(EmptyLogger, _Logger2);

		function EmptyLogger() {
			_classCallCheck(this, EmptyLogger);

			return _possibleConstructorReturn(this, (EmptyLogger.__proto__ || Object.getPrototypeOf(EmptyLogger)).call(this));
		}

		_createClass(EmptyLogger, [{
			key: 'log',
			value: function log() {
				return;
			}
		}, {
			key: 'trace',
			value: function trace() {
				return;
			}
		}, {
			key: 'info',
			value: function info() {
				return;
			}
		}, {
			key: 'warn',
			value: function warn() {
				return;
			}
		}, {
			key: 'error',
			value: function error() {
				return;
			}
		}, {
			key: 'toString',
			value: function toString() {
				return '[ConsoleLogger]';
			}
		}]);

		return EmptyLogger;
	}(Logger);

	return LoggerFactory;
}();

},{"./Logger":11,"./LoggerProvider":13}],13:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

module.exports = function () {
	'use strict';

	/**
  * An interface for generating {@link Logger} instances.
  *
  * @public
  * @interface
  */

	var LoggerProvider = function () {
		function LoggerProvider() {
			_classCallCheck(this, LoggerProvider);
		}

		/**
   * Returns an instance of {@link Logger}.
   *
   * @public
   * @param {String} category
   * @returns {Logger}
   */


		_createClass(LoggerProvider, [{
			key: 'getLogger',
			value: function getLogger(category) {
				return null;
			}
		}, {
			key: 'toString',
			value: function toString() {
				return '[LoggerProvider]';
			}
		}]);

		return LoggerProvider;
	}();

	return LoggerProvider;
}();

},{}],14:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var object = require('./../common/lang/object');

var LoggerFactory = require('./../logging/LoggerFactory');

module.exports = function () {
	'use strict';

	var events = {
		update: 'update',
		reset: 'reset'
	};

	/**
  * @typedef PriceLevel
  * @inner
  * @type Object
  * @property {number} price
  * @property {number} volume
  */

	/**
  * An aggregation of the total volume traded at each price level for a
  * single instrument.
  *
  * @public
  */

	var CumulativeVolume = function () {
		function CumulativeVolume(symbol, tickIncrement) {
			_classCallCheck(this, CumulativeVolume);

			/**
    * @property {string} symbol
    */
			this.symbol = symbol;

			this._tickIncrement = tickIncrement;

			this._handlers = [];

			this._priceLevels = {};
			this._highPrice = null;
			this._lowPrice = null;

			this._logger = LoggerFactory.getLogger('@barchart/marketdata-api-js');
		}

		/**
   * <p>Registers an event handler for a given event.</p>
   * <p>The following events are supported:
   * <ul>
   *   <li>update -- when a new price level is added, or an existing price level mutates.</li>
   *   <li>reset -- when all price levels are cleared.</li>
   * </ul>
   * </p>
   *
   * @ignore
   * @param {string} eventType
   * @param {function} handler - callback notified each time the event occurs
   */


		_createClass(CumulativeVolume, [{
			key: 'on',
			value: function on(eventType, handler) {
				var _this = this;

				if (eventType !== 'events') {
					return;
				}

				var i = this._handlers.indexOf(handler);

				if (i < 0) {
					var copy = this._handlers.slice(0);
					copy.push(handler);

					this._handlers = copy;

					this.toArray().forEach(function (priceLevel) {
						sendPriceVolumeUpdate(_this, handler, priceLevel);
					});
				}
			}

			/**
    * Unregisters an event handler for a given event. See {@link CumulativeVolume#on}.
    *
    * @ignore
    * @param {string} eventType - the event which was passed to {@link CumulativeVolume#on}
    * @param {function} handler - the callback which was passed to {@link CumulativeVolume#on}
    */

		}, {
			key: 'off',
			value: function off(eventType, handler) {
				if (eventType !== 'events') {
					return;
				}

				var i = this._handlers.indexOf(handler);

				if (!(i < 0)) {
					var copy = this._handlers.slice(0);
					copy.splice(i, 1);

					this._handlers = copy;
				}
			}

			/**
    * @ignore
    */

		}, {
			key: 'getTickIncrement',
			value: function getTickIncrement() {
				return this._tickIncrement;
			}

			/**
    * Given a numeric price, returns the volume traded at that price level.
    *
    * @public
    * @param {number} price
    * @returns {number}
    */

		}, {
			key: 'getVolume',
			value: function getVolume(price) {
				var priceString = price.toString();
				var priceLevel = this._priceLevels[priceString];

				if (priceLevel) {
					return priceLevel.volume;
				} else {
					return 0;
				}
			}

			/**
    * Increments the volume at a given price level. Used primarily
    * when a trade occurs.
    *
    * @ignore
    * @param {number} price
    * @param {number} volume - amount to add to existing cumulative volume
    */

		}, {
			key: 'incrementVolume',
			value: function incrementVolume(price, volume) {
				if (this._highPrice && this._lowPrice) {
					if (price > this._highPrice) {
						for (var p = this._highPrice + this._tickIncrement; p < price; p += this._tickIncrement) {
							broadcastPriceVolumeUpdate(this, this._handlers, addPriceVolume(this._priceLevels, p.toString(), p));
						}

						this._highPrice = price;
					} else if (price < this._lowPrice) {
						for (var _p = this._lowPrice - this._tickIncrement; _p > price; _p -= this._tickIncrement) {
							broadcastPriceVolumeUpdate(this, this._handlers, addPriceVolume(this._priceLevels, _p.toString(), _p));
						}

						this._lowPrice = price;
					}
				} else {
					this._lowPrice = this._highPrice = price;
				}

				var priceString = price.toString();
				var priceLevel = this._priceLevels[priceString];

				if (!priceLevel) {
					priceLevel = addPriceVolume(this._priceLevels, priceString, price);
				}

				priceLevel.volume += volume;

				broadcastPriceVolumeUpdate(this, this._handlers, priceLevel);
			}

			/**
    * Clears the data structure. Used primarily when a "reset" message
    * is received.
    *
    * @ignore
    */

		}, {
			key: 'reset',
			value: function reset() {
				var _this2 = this;

				this._priceLevels = {};
				this._highPrice = null;
				this._lowPrice = null;

				this._handlers.forEach(function (handler) {
					handler({ container: _this2, event: events.reset });
				});
			}

			/**
    * Returns an array of all price levels. This is an expensive operation. Observing
    * an ongoing subscription is preferred (see {@link Connection#on}).
    *
    * @return {PriceLevel[]}
    */

		}, {
			key: 'toArray',
			value: function toArray() {
				var _this3 = this;

				var array = object.keys(this._priceLevels).map(function (p) {
					var priceLevel = _this3._priceLevels[p];

					return {
						price: priceLevel.price,
						volume: priceLevel.volume
					};
				});

				array.sort(function (a, b) {
					return a.price - b.price;
				});

				return array;
			}
		}, {
			key: 'dispose',
			value: function dispose() {
				this._priceLevels = {};
				this._highPrice = null;
				this._lowPrice = null;

				this._handlers = [];
			}

			/**
    * Copies the price levels from one {@link CumulativeVolume} instance to
    * a newly {@link CumulativeVolume} created instance.
    *
    * @ignore
    * @param {string} symbol - The symbol to assign to the cloned instance.
    * @param {CumulativeVolume} source - The instance to copy.
    * @return {CumulativeVolume}
    */

		}], [{
			key: 'clone',
			value: function clone(symbol, source) {
				var clone = new CumulativeVolume(symbol, source.getTickIncrement());

				source.toArray().forEach(function (priceLevel) {
					clone.incrementVolume(priceLevel.price, priceLevel.volume);
				});

				return clone;
			}
		}]);

		return CumulativeVolume;
	}();

	var sendPriceVolumeUpdate = function sendPriceVolumeUpdate(container, handler, priceLevel) {
		try {
			handler({
				container: container,
				event: events.update,
				price: priceLevel.price,
				volume: priceLevel.volume
			});
		} catch (e) {
			undefined._logger.error('An error was thrown by a cumulative volume observer.', e);
		}
	};

	var broadcastPriceVolumeUpdate = function broadcastPriceVolumeUpdate(container, handlers, priceLevel) {
		handlers.forEach(function (handler) {
			sendPriceVolumeUpdate(container, handler, priceLevel);
		});
	};

	var addPriceVolume = function addPriceVolume(priceLevels, priceString, price) {
		var priceLevel = {
			price: price,
			volume: 0
		};

		priceLevels[priceString] = priceLevel;

		return priceLevel;
	};

	return CumulativeVolume;
}();

},{"./../common/lang/object":3,"./../logging/LoggerFactory":12}],15:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var utilities = require('@barchart/marketdata-utilities-js');

var CumulativeVolume = require('./CumulativeVolume'),
    Profile = require('./Profile'),
    Quote = require('./Quote');

var dayCodeToNumber = require('./../util/convertDayCodeToNumber');

var LoggerFactory = require('./../logging/LoggerFactory');

module.exports = function () {
	'use strict';

	function MarketStateInternal(handleProfileRequest) {
		var _logger = LoggerFactory.getLogger('@barchart/marketdata-api-js');

		var _book = {};
		var _quote = {};
		var _cvol = {};
		var _profileCallbacks = {};

		var _timestamp = void 0;

		var _getOrCreateBook = function _getOrCreateBook(symbol) {
			var book = _book[symbol];

			if (!book) {
				book = {
					symbol: symbol,
					bids: [],
					asks: []
				};

				var producerSymbol = utilities.symbolParser.getProducerSymbol(symbol);
				var producerBook = _book[producerSymbol];

				if (producerBook) {
					book.bids = producerBook.bids.slice(0);
					book.asks = producerBook.asks.slice(0);
				}

				_book[symbol] = book;
			}

			return book;
		};

		var _getOrCreateCumulativeVolume = function _getOrCreateCumulativeVolume(symbol) {
			var cv = _cvol[symbol];

			if (!cv) {
				cv = {
					container: null,
					callbacks: []
				};

				var producerSymbol = utilities.symbolParser.getProducerSymbol(symbol);
				var producerCvol = _cvol[producerSymbol];

				if (producerCvol && producerCvol.container) {
					cv.container = CumulativeVolume.clone(symbol, producerCvol.container);
				}

				_cvol[symbol] = cv;
			}

			return cv;
		};

		var _getOrCreateQuote = function _getOrCreateQuote(symbol) {
			var quote = _quote[symbol];

			if (!quote) {
				var producerSymbol = utilities.symbolParser.getProducerSymbol(symbol);
				var producerQuote = _quote[producerSymbol];

				if (producerQuote) {
					quote = Quote.clone(symbol, producerQuote);
				} else {
					quote = new Quote(symbol);
				}

				_quote[symbol] = quote;
			}

			return quote;
		};

		var _getOrCreateProfile = function _getOrCreateProfile(symbol) {
			var p = Profile.Profiles[symbol];

			if (!p) {
				var producerSymbol = utilities.symbolParser.getProducerSymbol(symbol);
				var producerProfile = Profile.Profiles[producerSymbol];

				if (producerProfile) {
					p = new Profile(symbol, producerProfile.name, producerProfile.exchange, producerProfile.unitCode, producerProfile.pointValue, producerProfile.tickIncrement);
				}
			}

			return p;
		};

		var _processMessage = function _processMessage(message) {
			var symbol = message.symbol;

			if (message.type === 'TIMESTAMP') {
				_timestamp = message.timestamp;
				return;
			}

			// Process book messages first, they don't need profiles, etc.
			if (message.type === 'BOOK') {
				var b = _getOrCreateBook(symbol);

				b.asks = message.asks;
				b.bids = message.bids;

				return;
			}

			if (message.type == 'REFRESH_CUMULATIVE_VOLUME') {
				var _cv = _getOrCreateCumulativeVolume(symbol);
				var container = _cv.container;

				if (container) {
					container.reset();
				} else {
					_cv.container = container = new CumulativeVolume(symbol, message.tickIncrement);

					var callbacks = _cv.callbacks || [];

					callbacks.forEach(function (callback) {
						callback(container);
					});

					_cv.callbacks = null;
				}

				message.priceLevels.forEach(function (priceLevel) {
					container.incrementVolume(priceLevel.price, priceLevel.volume);
				});

				return;
			}

			var p = _getOrCreateProfile(symbol);

			if (!p && message.type !== 'REFRESH_QUOTE') {
				_logger.warn('No profile found for ' + symbol);
				_logger.log(message);

				return;
			}

			var q = _getOrCreateQuote(symbol);

			if (!q.day && message.day) {
				q.day = message.day;
				q.dayNum = dayCodeToNumber(q.day);
			}

			if (q.day && message.day) {
				var dayNum = dayCodeToNumber(message.day);

				if (dayNum > q.dayNum || q.dayNum - dayNum > 5) {
					// Roll the quote
					q.day = message.day;
					q.dayNum = dayNum;
					q.flag = 'p';
					q.bidPrice = 0.0;
					q.bidSize = undefined;
					q.askPrice = undefined;
					q.askSize = undefined;
					if (q.settlementPrice) {
						q.previousPrice = q.settlementPrice;
						q.settlementPrice = undefined;
					} else if (q.lastPrice) {
						q.previousPrice = q.lastPrice;
					}
					q.lastPrice = undefined;
					q.tradePrice = undefined;
					q.tradeSize = undefined;
					q.numberOfTrades = undefined;
					q.openPrice = undefined;
					q.highPrice = undefined;
					q.lowPrice = undefined;
					q.volume = undefined;
				} else if (q.dayNum > dayNum) {
					return;
				}
			} else {
				return;
			}

			var cv = _cvol[symbol];

			switch (message.type) {
				case 'HIGH':
					q.highPrice = message.value;
					break;
				case 'LOW':
					q.lowPrice = message.value;
					break;
				case 'OPEN':
					q.flag = undefined;
					q.openPrice = message.value;
					q.highPrice = message.value;
					q.lowPrice = message.value;
					q.lastPrice = message.value;

					if (cv && cv.container) {
						cv.container.reset();
					}

					break;
				case 'OPEN_INTEREST':
					q.openInterest = message.value;
					break;
				case 'REFRESH_DDF':
					switch (message.subrecord) {
						case '1':
						case '2':
						case '3':
							q.message = message;
							if (message.openPrice === null) {
								q.openPrice = undefined;
							} else if (message.openPrice) {
								q.openPrice = message.openPrice;
							}
							if (message.highPrice === null) {
								q.highPrice = undefined;
							} else if (message.highPrice) {
								q.highPrice = message.highPrice;
							}
							if (message.lowPrice === null) {
								q.lowPrice = undefined;
							} else if (message.lowPrice) {
								q.lowPrice = message.lowPrice;
							}
							if (message.lastPrice === null) {
								q.lastPrice = undefined;
							} else if (message.lastPrice) {
								q.lastPrice = message.lastPrice;
							}
							if (message.bidPrice === null) {
								q.bidPrice = undefined;
							} else if (message.bidPrice) {
								q.bidPrice = message.bidPrice;
							}
							if (message.askPrice === null) {
								q.askPrice = undefined;
							} else if (message.askPrice) {
								q.askPrice = message.askPrice;
							}
							if (message.previousPrice === null) {
								q.previousPrice = undefined;
							} else if (message.previousPrice) {
								q.previousPrice = message.previousPrice;
							}
							if (message.settlementPrice === null) {
								q.settlementPrice = undefined;
								if (q.flag == 's') {
									q.flag = undefined;
								}
							} else if (message.settlementPrice) {
								q.settlementPrice = message.settlementPrice;
							}
							if (message.volume === null) {
								q.volume = undefined;
							} else if (message.volume) {
								q.volume = message.volume;
							}
							if (message.openInterest === null) {
								q.openInterest = undefined;
							} else if (message.openInterest) {
								q.openInterest = message.openInterest;
							}
							if (message.subsrecord == '1') {
								q.lastUpdate = message.time;
							}
							break;
					}
					break;
				case 'REFRESH_QUOTE':
					p = new Profile(symbol, message.name, message.exchange, message.unitcode, message.pointValue, message.tickIncrement, message.additional || null);

					if (!q.profile) {
						q.profile = p;
					}

					q.message = message;
					q.flag = message.flag;
					q.mode = message.mode;
					q.lastUpdate = message.lastUpdate;
					q.bidPrice = message.bidPrice;
					q.bidSize = message.bidSize;
					q.askPrice = message.askPrice;
					q.askSize = message.askSize;
					q.lastPrice = message.lastPrice;
					q.tradeSize = message.tradeSize;
					q.numberOfTrades = message.numberOfTrades;
					q.previousPrice = message.previousPrice;
					q.settlementPrice = message.settlementPrice;
					q.openPrice = message.openPrice;
					q.highPrice = message.highPrice;
					q.lowPrice = message.lowPrice;
					q.volume = message.volume;
					q.openInterest = message.openInterest;
					if (message.tradeTime) {
						q.time = message.tradeTime;
					} else if (message.timeStamp) {
						q.time = message.timeStamp;
					}

					if (_profileCallbacks.hasOwnProperty(symbol)) {
						_profileCallbacks[symbol].forEach(function (profileCallback) {
							profileCallback(p);
						});

						delete _profileCallbacks[symbol];
					}

					break;
				case 'SETTLEMENT':
					q.lastPrice = message.value;
					q.settlement = message.value;
					if (message.element === 'D') {
						q.flag = 's';
					}
					break;
				case 'TOB':
					q.bidPrice = message.bidPrice;
					q.bidSize = message.bidSize;
					q.askPrice = message.askPrice;
					q.askSize = message.askSize;
					if (message.time) {
						q.time = message.time;
					}
					break;
				case 'TRADE':
					q.flag = undefined;
					q.tradePrice = message.tradePrice;
					q.lastPrice = message.tradePrice;
					if (message.tradeSize) {
						q.tradeSize = message.tradeSize;
						q.volume += message.tradeSize;
					}

					q.ticks.push({ price: q.tradePrice, size: q.tradeSize });
					while (q.ticks.length > 50) {
						q.ticks.shift();
					}

					if (!q.numberOfTrades) {
						q.numberOfTrades = 0;
					}
					q.numberOfTrades++;

					if (message.time) {
						q.time = message.time;
					}

					if (cv && cv.container && message.tradePrice && message.tradeSize) {
						cv.container.incrementVolume(message.tradePrice, message.tradeSize);
					}
					break;
				case 'TRADE_OUT_OF_SEQUENCE':
					if (message.tradeSize) {
						q.volume += message.tradeSize;
					}

					if (cv && cv.container && message.tradePrice && message.tradeSize) {
						cv.container.incrementVolume(message.tradePrice, message.tradeSize);
					}

					break;
				case 'VOLUME':
					q.volume = message.value;
					break;
				case 'VOLUME_YESTERDAY':
					break;
				case 'VWAP':
					q.vwap1 = message.value;
					break;
				default:
					_logger.error('Unhandled Market Message:');
					_logger.log(message);
					break;
			}
		};

		var _getBook = function _getBook(symbol) {
			return _book[symbol];
		};

		var _getCumulativeVolume = function _getCumulativeVolume(symbol, callback) {
			var cv = _getOrCreateCumulativeVolume(symbol);
			var promise = void 0;

			if (cv.container) {
				promise = Promise.resolve(cv.container);
			} else {
				promise = new Promise(function (resolveCallback) {
					cv.callbacks.push(resolveCallback);
				});
			}

			return promise.then(function (cv) {
				if (typeof callback === 'function') {
					callback(cv);
				}

				return cv;
			});
		};

		var _getProfile = function _getProfile(symbol, callback) {
			var profile = _getOrCreateProfile(symbol);
			var promise = void 0;

			if (profile) {
				promise = Promise.resolve(profile);
			} else {
				promise = new Promise(function (resolveCallback) {
					if (!_profileCallbacks.hasOwnProperty(symbol)) {
						_profileCallbacks[symbol] = [];
					}

					_profileCallbacks[symbol].push(function (p) {
						return resolveCallback(p);
					});

					if (handleProfileRequest && typeof handleProfileRequest === 'function') {
						handleProfileRequest(symbol);
					}
				});
			}

			return promise.then(function (p) {
				if (typeof callback === 'function') {
					callback(p);
				}

				return p;
			});
		};

		var _getQuote = function _getQuote(symbol) {
			return _quote[symbol];
		};

		var _getTimestamp = function _getTimestamp() {
			return _timestamp;
		};

		return {
			getBook: _getBook,
			getCumulativeVolume: _getCumulativeVolume,
			getProfile: _getProfile,
			getQuote: _getQuote,
			getTimestamp: _getTimestamp,
			processMessage: _processMessage
		};
	}

	/**
  * @typedef Book
  * @type Object
  * @property {string} symbol
  * @property {Object[]} bids
  * @property {Object[]} asks
  */

	/**
  * <p>Repository for current market state. This repository will only contain
  * data for an instrument after a subscription has been established using
  * the {@link Connection#on} function.</p>
  * <p>Access the singleton instance using the {@link ConnectionBase#getMarketState}
  * function.</p>
  *
  * @public
  */

	var MarketState = function () {
		function MarketState(handleProfileRequest) {
			_classCallCheck(this, MarketState);

			this._internal = MarketStateInternal(handleProfileRequest);
		}

		/**
   * @public
   * @param {string} symbol
   * @return {Book}
   */


		_createClass(MarketState, [{
			key: 'getBook',
			value: function getBook(symbol) {
				return this._internal.getBook(symbol);
			}

			/**
    * @public
    * @param {string} symbol
    * @param {function=} callback - invoked when the {@link CumulativeVolume} instance becomes available
    * @returns {Promise} The {@link CumulativeVolume} instance, as a promise
    */

		}, {
			key: 'getCumulativeVolume',
			value: function getCumulativeVolume(symbol, callback) {
				return this._internal.getCumulativeVolume(symbol, callback);
			}

			/**
    * @public
    * @param {string} symbol
    * @param {function=} callback - invoked when the {@link Profile} instance becomes available
    * @returns {Promise} The {@link Profile} instance, as a promise.
    */

		}, {
			key: 'getProfile',
			value: function getProfile(symbol, callback) {
				return this._internal.getProfile(symbol, callback);
			}

			/**
    * @public
    * @param {string} symbol
    * @return {Quote}
    */

		}, {
			key: 'getQuote',
			value: function getQuote(symbol) {
				return this._internal.getQuote(symbol);
			}

			/**
    * Returns the time the most recent market data message was received.
    *
    * @public
    * @return {Date}
    */

		}, {
			key: 'getTimestamp',
			value: function getTimestamp() {
				return this._internal.getTimestamp();
			}

			/**
    * @ignore
    */

		}, {
			key: 'processMessage',
			value: function processMessage(message) {
				return this._internal.processMessage(message);
			}

			/**
    * @ignore
    */

		}], [{
			key: 'CumulativeVolume',
			get: function get() {
				return CumulativeVolume;
			}

			/**
    * @ignore
    */

		}, {
			key: 'Profile',
			get: function get() {
				return Profile;
			}

			/**
    * @ignore
    */

		}, {
			key: 'Quote',
			get: function get() {
				return Quote;
			}
		}]);

		return MarketState;
	}();

	return MarketState;
}();

},{"./../logging/LoggerFactory":12,"./../util/convertDayCodeToNumber":25,"./CumulativeVolume":14,"./Profile":16,"./Quote":17,"@barchart/marketdata-utilities-js":38}],16:[function(require,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var parseSymbolType = require('./../util/parseSymbolType'),
    priceFormatter = require('./../util/priceFormatter');

module.exports = function () {
	'use strict';

	var profiles = {};
	var formatter = priceFormatter('-', true, ',').format;

	/**
  * Describes an instrument.
  *
  * @public
  */

	var Profile = function () {
		function Profile(symbol, name, exchange, unitCode, pointValue, tickIncrement, additional) {
			_classCallCheck(this, Profile);

			/**
    * @property {string} symbol - the instrument's symbol
    */
			this.symbol = symbol;

			/**
    * @property {string} name - the instrument's name
    */
			this.name = name;

			/**
    * @property {string} exchange - the code for the listing exchange
    */
			this.exchange = exchange;

			/**
    * @property {string} unitCode - code used to describe how a price should be formatted
    */
			this.unitCode = unitCode;

			/**
    * @property {string} pointValue - the change in dollar value for a one point change in price
    */
			this.pointValue = pointValue;

			/**
    * @property {number} tickIncrement - the minimum price movement
    */
			this.tickIncrement = tickIncrement;

			var info = parseSymbolType(this.symbol);

			if (info) {
				if (info.type === 'future') {
					/**
      * @property {undefined|string} root - he root symbol, if a future; otherwise undefined
      */
					this.root = info.root;

					/**
      * @property {undefined|string} month - the month code, if a future; otherwise undefined
      */
					this.month = info.month;

					/**
      * @property {undefined|number} year - the expiration year, if a symbol; otherwise undefined
      */
					this.year = info.year;
				}
			}

			if ((typeof additional === 'undefined' ? 'undefined' : _typeof(additional)) === 'object' && additional !== null) {
				for (var p in additional) {
					this[p] = additional[p];
				}
			}

			profiles[symbol] = this;
		}

		/**
   * Given a numeric price, returns a human-readable price.
   *
   * @public
   * @param {number} price
   * @returns {string}
   */


		_createClass(Profile, [{
			key: 'formatPrice',
			value: function formatPrice(price) {
				return formatter(price, this.unitCode);
			}

			/**
    * Configures the logic used to format all prices using the {@link Profile#formatPrice} instance function.
    *
    * @public
    * @param {string} fractionSeparator - usually a dash or a period
    * @param {boolean} specialFractions - usually true
    * @param {string=} thousandsSeparator - usually a comma
    */

		}], [{
			key: 'setPriceFormatter',
			value: function setPriceFormatter(fractionSeparator, specialFractions, thousandsSeparator) {
				formatter = priceFormatter(fractionSeparator, specialFractions, thousandsSeparator).format;
			}

			/**
    * Alias for {@link Profile.setPriceFormatter} function.
    *
    * @deprecated
    * @public
    * @see {@link Profile.setPriceFormatter}
    */

		}, {
			key: 'PriceFormatter',
			value: function PriceFormatter(fractionSeparator, specialFractions, thousandsSeparator) {
				Profile.setPriceFormatter(fractionSeparator, specialFractions, thousandsSeparator);
			}

			/**
    * @protected
    * @ignore
    */

		}, {
			key: 'Profiles',
			get: function get() {
				return profiles;
			}
		}]);

		return Profile;
	}();

	return Profile;
}();

},{"./../util/parseSymbolType":30,"./../util/priceFormatter":31}],17:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

module.exports = function () {
	'use strict';

	/**
  * Current market conditions for an instrument.
  *
  * @public
  */

	var Quote = function () {
		function Quote(symbol) {
			_classCallCheck(this, Quote);

			/**
    * @property {string} symbol - The instrument's symbol.
    */
			this.symbol = symbol || null;

			/**
    * @property {string} message - last DDF message that caused a mutation to this instance
    */
			this.message = null;

			/**
    * @property {string} flag - market status, will have one of three values: p, s, or undefined
    */
			this.flag = null;

			this.mode = null;

			/**
    * @property {string} day - one character code that indicates day of the month of the current trading session
    */
			this.day = null;

			/**
    * @property {number} dayNum - day of the month of the current trading session
    */
			this.dayNum = 0;

			this.session = null;
			this.lastUpdate = null;

			/**
    * @property {number} bidPrice - top-of-book price on the buy side
    */
			this.bidPrice = null;

			/**
    * @property {number} bidSize - top-of-book quantity on the buy side
    */
			this.bidSize = null;

			/**
    * @property {number} askPrice - top-of-book price on the sell side
    */
			this.askPrice = null;

			/**
    * @property {number} askSize - top-of-book quantity on the sell side
    */
			this.askSize = null;

			/**
    * @property {number} lastPrice - most recent price (not necessarily a trade)
    */
			this.lastPrice = null;

			/**
    * @property {number} tradePrice - most recent trade price
    */
			this.tradePrice = null;

			/**
    * @property {number} tradeSize - most recent trade quantity
    */
			this.tradeSize = null;

			this.numberOfTrades = null;
			this.vwap1 = null; // Exchange Provided
			this.vwap2 = null; // Calculated

			/**
    * @property {number} settlementPrice
    */
			this.settlementPrice = null;
			this.openPrice = null;
			this.highPrice = null;
			this.lowPrice = null;
			this.volume = null;
			this.openInterest = null;

			/**
    * @property {number} previousPrice - price from the previous session
    */
			this.previousPrice = null;

			this.profile = null;

			this.time = null;
			this.ticks = [];
		}

		_createClass(Quote, null, [{
			key: 'clone',
			value: function clone(symbol, source) {
				var clone = Object.assign({}, source);
				clone.symbol = symbol;

				return clone;
			}
		}]);

		return Quote;
	}();

	return Quote;
}();

},{}],18:[function(require,module,exports){
'use strict';

var MarketState = require('./MarketState');

module.exports = function () {
	'use strict';

	return MarketState;
}();

},{"./MarketState":15}],19:[function(require,module,exports){
'use strict';

var parseMessage = require('./parseMessage'),
    parseTimestamp = require('./parseTimestamp'),
    parseValue = require('./parseValue');

module.exports = function () {
	'use strict';

	return {
		parseMessage: parseMessage,
		parseTimestamp: parseTimestamp,
		parseValue: parseValue,

		Parse: parseMessage,
		ParseTimestamp: parseTimestamp,
		ParseValue: parseValue
	};
}();

},{"./parseMessage":20,"./parseTimestamp":21,"./parseValue":22}],20:[function(require,module,exports){
'use strict';

var utilities = require('@barchart/marketdata-utilities-js');

module.exports = function () {
	'use strict';

	return utilities.messageParser;
}();

},{"@barchart/marketdata-utilities-js":38}],21:[function(require,module,exports){
'use strict';

var utilities = require('@barchart/marketdata-utilities-js');

module.exports = function () {
	'use strict';

	return utilities.timestampParser;
}();

},{"@barchart/marketdata-utilities-js":38}],22:[function(require,module,exports){
'use strict';

var utilities = require('@barchart/marketdata-utilities-js');

module.exports = function () {
	'use strict';

	return utilities.priceParser;
}();

},{"@barchart/marketdata-utilities-js":38}],23:[function(require,module,exports){
'use strict';

var utilities = require('@barchart/marketdata-utilities-js');

module.exports = function () {
	'use strict';

	return utilities.convert.baseCodeToUnitCode;
}();

},{"@barchart/marketdata-utilities-js":38}],24:[function(require,module,exports){
'use strict';

var utilities = require('@barchart/marketdata-utilities-js');

module.exports = function () {
	'use strict';

	return utilities.convert.dateToDayCode;
}();

},{"@barchart/marketdata-utilities-js":38}],25:[function(require,module,exports){
'use strict';

var utilities = require('@barchart/marketdata-utilities-js');

module.exports = function () {
	'use strict';

	return utilities.convert.dayCodeToNumber;
}();

},{"@barchart/marketdata-utilities-js":38}],26:[function(require,module,exports){
'use strict';

var utilities = require('@barchart/marketdata-utilities-js');

module.exports = function () {
	'use strict';

	return utilities.convert.unitCodeToBaseCode;
}();

},{"@barchart/marketdata-utilities-js":38}],27:[function(require,module,exports){
'use strict';

var utilities = require('@barchart/marketdata-utilities-js');

module.exports = function () {
	'use strict';

	return utilities.decimalFormatter;
}();

},{"@barchart/marketdata-utilities-js":38}],28:[function(require,module,exports){
'use strict';

var convertBaseCodeToUnitCode = require('./convertBaseCodeToUnitCode'),
    convertDateToDayCode = require('./convertDateToDayCode'),
    convertDayCodeToNumber = require('./convertDayCodeToNumber'),
    convertUnitCodeToBaseCode = require('./convertUnitCodeToBaseCode'),
    decimalFormatter = require('./decimalFormatter'),
    monthCodes = require('./monthCodes'),
    parseSymbolType = require('./parseSymbolType'),
    priceFormatter = require('./priceFormatter'),
    snapshotProvider = require('./snapshotProvider'),
    symbolResolver = require('./symbolResolver'),
    timeFormatter = require('./timeFormatter');

module.exports = function () {
	'use strict';

	return {
		convertBaseCodeToUnitCode: convertBaseCodeToUnitCode,
		convertUnitCodeToBaseCode: convertUnitCodeToBaseCode,
		convertDateToDayCode: convertDateToDayCode,
		convertDayCodeToNumber: convertDayCodeToNumber,
		decimalFormatter: decimalFormatter,
		monthCodes: monthCodes,
		parseSymbolType: parseSymbolType,
		snapshotProvider: snapshotProvider,
		symbolResolver: symbolResolver,

		BaseCode2UnitCode: convertBaseCodeToUnitCode,
		DateToDayCode: convertDateToDayCode,
		DayCodeToNumber: convertDayCodeToNumber,
		MonthCodes: monthCodes,
		ParseSymbolType: parseSymbolType,
		PriceFormatter: priceFormatter,
		TimeFormatter: timeFormatter,
		UnitCode2BaseCode: convertUnitCodeToBaseCode
	};
}();

},{"./convertBaseCodeToUnitCode":23,"./convertDateToDayCode":24,"./convertDayCodeToNumber":25,"./convertUnitCodeToBaseCode":26,"./decimalFormatter":27,"./monthCodes":29,"./parseSymbolType":30,"./priceFormatter":31,"./snapshotProvider":32,"./symbolResolver":33,"./timeFormatter":34}],29:[function(require,module,exports){
'use strict';

var utilities = require('@barchart/marketdata-utilities-js');

module.exports = function () {
	'use strict';

	return utilities.monthCodes.getCodeToNameMap();
}();

},{"@barchart/marketdata-utilities-js":38}],30:[function(require,module,exports){
'use strict';

var utilities = require('@barchart/marketdata-utilities-js');

module.exports = function () {
	'use strict';

	return utilities.symbolParser.parseInstrumentType;
}();

},{"@barchart/marketdata-utilities-js":38}],31:[function(require,module,exports){
'use strict';

var utilities = require('@barchart/marketdata-utilities-js');

module.exports = function () {
	'use strict';

	return utilities.priceFormatter;
}();

},{"@barchart/marketdata-utilities-js":38}],32:[function(require,module,exports){
'use strict';

var axios = require('axios');

var array = require('./../common/lang/array');

var convertDateToDayCode = require('./convertDateToDayCode'),
    convertDayCodeToNumber = require('./convertDayCodeToNumber'),
    convertBaseCodeToUnitCode = require('./convertBaseCodeToUnitCode');

module.exports = function () {
	'use strict';

	var regex = {};

	regex.day = /^([0-9]{4}).?([0-9]{2}).?([0-9]{2})$/;

	regex.cmdty = {};
	regex.cmdty.short = /^(BC|BE|BL|EI|EU|CF|CB|UD)(.*)(.CM)$/i;
	regex.cmdty.long = /^(BCSD-|BEA-|BLS-|EIA-|CFTC-|USCB-|USDA-)/i;
	regex.other = /:/i;

	regex.c3 = {};
	regex.c3.symbol = /^(C3:)(.*)$/;

	regex.c3.currencies = {};
	regex.c3.currencies.eur = /^(EUR)\/(.*)$/i;
	regex.c3.currencies.rub = /^(RUB)\/(.*)$/i;
	regex.c3.currencies.uah = /^(UAH)\/(.*)$/i;
	regex.c3.currencies.usd = /^(USD|Usc|\$|)\/(.*)$/i;

	/**
  * Executes an HTTP request for a quote snapshot(s) and returns a
  * promise of quote refresh message(s) (suitable for processing by
  * the {@link MarketState#processMessage} function).
  *
  * @function
  * @param {String|Array.<String>} symbols
  * @param {String} username
  * @param {String} password
  * @returns {Promise.<Array>}
  */
	function retrieveSnapshots(symbols, username, password) {
		return Promise.resolve().then(function () {
			var symbolsToUse = void 0;

			if (typeof symbols === 'string') {
				symbolsToUse = [symbols];
			} else if (Array.isArray(symbols)) {
				symbolsToUse = symbols;
			} else {
				throw new Error('The "symbols" argument must be a string or an array of strings.');
			}

			if (symbolsToUse.some(function (s) {
				return typeof s !== 'string';
			})) {
				throw new Error('The "symbols" can only contain strings.');
			}

			if (typeof username !== 'string') {
				throw new Error('The "username" argument must be a string.');
			}

			if (typeof password !== 'string') {
				throw new Error('The "password" argument must be a string.');
			}

			var getCmdtySymbols = [];
			var getQuoteSymbols = [];

			symbolsToUse.forEach(function (symbol) {
				if (regex.cmdty.long.test(symbol) || regex.cmdty.short.test(symbol)) {
					getCmdtySymbols.push(symbol);
				} else {
					getQuoteSymbols.push(symbol);
				}
			});

			var promises = [];

			if (getCmdtySymbols.length !== 0) {
				promises.push(retrieveSnapshotsUsingGetCmdtyStats(getCmdtySymbols, username, password));
			}

			if (getQuoteSymbols.length !== 0) {
				promises.push(retrieveSnapshotsUsingGetQuote(getQuoteSymbols, username, password));
			}

			if (promises.length === 0) {
				return Promise.resolve([]);
			}

			return Promise.all(promises).then(function (results) {
				return array.flatten(results, true);
			});
		});
	}

	var ADDITIONAL_FIELDS = ['exchange', 'bid', 'bidSize', 'ask', 'askSize', 'tradeSize', 'numTrades', 'settlement', 'previousLastPrice'];

	function retrieveSnapshotsUsingGetQuote(symbols, username, password) {
		return Promise.resolve().then(function () {
			var options = {
				url: 'https://webapp-proxy.aws.barchart.com/v1/proxies/ondemand/getQuote.json?username=' + encodeURIComponent(username) + '&password=' + encodeURIComponent(password) + '&symbols=' + encodeURIComponent(symbols.join()) + '&fields=' + encodeURIComponent(ADDITIONAL_FIELDS.join()),
				method: 'GET'
			};

			return Promise.resolve(axios(options)).then(function (response) {
				var results = response.data.results || [];

				var messages = results.map(function (result) {
					var message = {};

					message.type = 'REFRESH_QUOTE';

					message.symbol = result.symbol.toUpperCase();
					message.name = result.name;
					message.exchange = result.exchange;
					message.unitcode = convertBaseCodeToUnitCode(parseInt(result.unitCode));

					message.tradeTime = new Date(result.tradeTimestamp);

					var dayCode = void 0;

					if (typeof result.dayCode === 'string' && result.dayCode.length === 1) {
						dayCode = result.dayCode;
					} else {
						dayCode = convertDateToDayCode(message.tradeTime);
					}

					message.day = dayCode;
					message.dayNum = convertDayCodeToNumber(dayCode);
					message.flag = result.flag;
					message.mode = result.mode;

					message.lastPrice = result.lastPrice;
					message.tradeSize = result.tradeSize;
					message.numberOfTrades = result.numTrades;

					message.bidPrice = result.bid;
					message.bidSize = result.bidSize;
					message.askPrice = result.ask;
					message.askSize = result.askSize;

					message.settlementPrice = result.settlement;
					message.previousPrice = result.previousLastPrice;

					message.openPrice = result.open;
					message.highPrice = result.high;
					message.lowPrice = result.low;

					message.volume = result.volume;

					message.lastUpdate = message.tradeTime;

					if (regex.c3.symbol.test(message.symbol)) {
						var c3 = {};

						c3.currency = null;
						c3.delivery = null;

						if (result.commodityDataCurrency) {
							c3.currency = getC3Currency(result.commodityDataCurrency);
						}

						if (result.commodityDataDelivery) {
							c3.delivery = result.commodityDataDelivery;
						}

						message.additional = { c3: c3 };
					}

					return message;
				});

				return messages;
			});
		});
	}

	function retrieveSnapshotsUsingGetCmdtyStats(symbols, username, password) {
		return Promise.all(symbols.map(function (symbol) {
			return retrieveSnapshotUsingGetCmdtyStats(symbol, username, password);
		}));
	}

	function retrieveSnapshotUsingGetCmdtyStats(symbol, username, password) {
		return Promise.resolve().then(function () {
			var options = {
				url: 'https://webapp-proxy.aws.barchart.com/v1/proxies/ondemand/getCmdtyStats.json?username=' + encodeURIComponent(username) + '&password=' + encodeURIComponent(password) + '&symbol=' + encodeURIComponent(symbol),
				method: 'GET'
			};

			return Promise.resolve(axios(options)).then(function (response) {
				var results = response.data.results || [];

				var messages = results.map(function (result) {
					if (!result.stats || !result.stats.length > 0) {
						return Promise.reject('The server returned an invalid response for [ ' + symbol + ' ]');
					}

					var first = result.stats[0];
					var second = result.length > 1 ? result.stats[1] : null;

					var match = first.date.match(regex.day);
					var date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
					var dayCode = convertDateToDayCode(date);

					var message = {};

					message.type = 'REFRESH_QUOTE';

					if (regex.cmdty.long.test(symbol)) {
						message.symbol = result.symbol.toUpperCase();
					} else {
						message.symbol = result.shortSymbol.toUpperCase();
					}

					message.name = result.shortName;
					message.exchange = 'CSTATS';
					message.unitcode = 2;

					message.day = dayCode;
					message.dayNum = convertDayCodeToNumber(dayCode);

					message.lastPrice = first.value;

					debugger;

					if (second !== null) {
						message.previousPrice = second.value;
					}

					message.lastUpdate = date;

					return message;
				});

				return messages;
			});
		});
	}

	function getC3Currency(lotSizeFix) {
		if (regex.c3.currencies.eur.test(lotSizeFix)) {
			return 'EUR';
		} else if (regex.c3.currencies.rub.test(lotSizeFix)) {
			return 'RUB';
		} else if (regex.c3.currencies.uah.test(lotSizeFix)) {
			return 'UAH';
		} else if (regex.c3.currencies.usd.test(lotSizeFix)) {
			return 'USD';
		} else {
			return null;
		}
	}

	return retrieveSnapshots;
}();

},{"./../common/lang/array":2,"./convertBaseCodeToUnitCode":23,"./convertDateToDayCode":24,"./convertDayCodeToNumber":25,"axios":48}],33:[function(require,module,exports){
'use strict';

var axios = require('axios');

module.exports = function () {
	'use strict';

	/**
  * Promise-based utility for resolving symbol aliases (e.g. ES*1 is a reference
  * to the front month for the ES contract -- not a concrete symbol). This
  * implementation is for use in browser environments.
  *
  * @public
  * @param {string} - The symbol to lookup (i.e. the alias).
  * @returns {Promise<string>}
  */

	return function (symbol) {
		return Promise.resolve().then(function () {
			if (typeof symbol !== 'string') {
				throw new Error('The "symbol" argument must be a string.');
			}

			if (symbol.length === 0) {
				throw new Error('The "symbol" argument must be at least one character.');
			}

			var options = {
				url: 'https://instruments-prod.aws.barchart.com/instruments/' + encodeURIComponent(symbol),
				method: 'GET'
			};

			return Promise.resolve(axios(options)).then(function (response) {
				if (!response.data || !response.data.instrument || !response.data.instrument.symbol) {
					throw new Error('The server was unable to resolve symbol ' + symbol + '.');
				}

				return response.data.instrument.symbol;
			});
		});
	};
}();

},{"axios":48}],34:[function(require,module,exports){
'use strict';

var utilities = require('@barchart/marketdata-utilities-js');

module.exports = function () {
	'use strict';

	return utilities.timeFormatter;
}();

},{"@barchart/marketdata-utilities-js":38}],35:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var xmlDom = require('xmldom');

module.exports = function () {
    'use strict';

    var XmlDomParser = function () {
        function XmlDomParser() {
            _classCallCheck(this, XmlDomParser);

            this._xmlDomParser = new xmlDom.DOMParser();
        }

        _createClass(XmlDomParser, [{
            key: 'parse',
            value: function parse(textDocument) {
                if (typeof textDocument !== 'string') {
                    throw new Error('The "textDocument" argument must be a string.');
                }

                return this._xmlDomParser.parseFromString(textDocument, 'text/xml');
            }
        }, {
            key: 'toString',
            value: function toString() {
                return '[XmlDomParser]';
            }
        }]);

        return XmlDomParser;
    }();

    return XmlDomParser;
}();

},{"xmldom":76}],36:[function(require,module,exports){
'use strict';

module.exports = function () {
	'use strict';

	function convertDayNumberToDayCode(d) {
		if (d >= 1 && d <= 9) {
			return String.fromCharCode("1".charCodeAt(0) + d - 1);
		} else if (d == 10) {
			return '0';
		} else {
			return String.fromCharCode("A".charCodeAt(0) + d - 11);
		}
	}

	return {
		/**
   * Converts a unit code into a base code.
   *
   * @public
   * @param {String} baseCode
   * @return {Number}
   */
		unitCodeToBaseCode: function unitCodeToBaseCode(unitCode) {
			switch (unitCode) {
				case '2':
					return -1;
				case '3':
					return -2;
				case '4':
					return -3;
				case '5':
					return -4;
				case '6':
					return -5;
				case '7':
					return -6;
				case '8':
					return 0;
				case '9':
					return 1;
				case 'A':
					return 2;
				case 'B':
					return 3;
				case 'C':
					return 4;
				case 'D':
					return 5;
				case 'E':
					return 6;
				case 'F':
					return 7;
				default:
					return 0;
			}
		},

		/**
   * Converts a base code into a unit code.
   *
   * @public
   * @param {Number} baseCode
   * @return {String}
   */
		baseCodeToUnitCode: function baseCodeToUnitCode(baseCode) {
			switch (baseCode) {
				case -1:
					return '2';
				case -2:
					return '3';
				case -3:
					return '4';
				case -4:
					return '5';
				case -5:
					return '6';
				case -6:
					return '7';
				case 0:
					return '8';
				case 1:
					return '9';
				case 2:
					return 'A';
				case 3:
					return 'B';
				case 4:
					return 'C';
				case 5:
					return 'D';
				case 6:
					return 'E';
				case 7:
					return 'F';
				default:
					return 0;
			}
		},

		/**
   * Converts a date instance to a day code.
   *
   * @public
   * @param {Date} date
   * @returns {String|null}
   */
		dateToDayCode: function dateToDayCode(date) {
			if (date === null || date === undefined) {
				return null;
			}

			return convertDayNumberToDayCode(date.getDate());
		},

		/**
   * Converts a day code (e.g. "A" ) to a day number (e.g. 11).
   *
   * @public
   * @param {String} dayCode
   * @returns {Number|null}
   */
		dayCodeToNumber: function dayCodeToNumber(dayCode) {
			if (dayCode === null || dayCode === undefined || dayCode === '') {
				return null;
			}

			var d = parseInt(dayCode, 31);

			if (d > 9) {
				d++;
			} else if (d === 0) {
				d = 10;
			}

			return d;
		},

		/**
   * Converts a day number (e.g. the 11th of the month) in o a day code (e.g. 'A').
   *
   * @public
   * @param {Number=} dayNumber
   * @returns {Number|null}
   */
		numberToDayCode: function numberToDayCode(dayNumber) {
			if (dayNumber === null || dayNumber === undefined) {
				return null;
			}

			return convertDayNumberToDayCode(dayNumber);
		}
	};
}();

},{}],37:[function(require,module,exports){
'use strict';

var lodashIsNaN = require('lodash.isnan');

module.exports = function () {
	'use strict';

	return function (value, digits, thousandsSeparator, useParenthesis) {
		if (value === '' || value === undefined || value === null || lodashIsNaN(value)) {
			return '';
		}

		var applyParenthesis = value < 0 && useParenthesis === true;

		if (applyParenthesis) {
			value = 0 - value;
		}

		var returnRef = value.toFixed(digits);

		if (thousandsSeparator && !(value > -1000 && value < 1000)) {
			var length = returnRef.length;
			var negative = value < 0;

			var found = digits === 0;
			var counter = 0;

			var buffer = [];

			for (var i = length - 1; !(i < 0); i--) {
				if (counter === 3 && !(negative && i === 0)) {
					buffer.unshift(thousandsSeparator);

					counter = 0;
				}

				var character = returnRef.charAt(i);

				buffer.unshift(character);

				if (found) {
					counter = counter + 1;
				} else if (character === '.') {
					found = true;
				}
			}

			if (applyParenthesis) {
				buffer.unshift('(');
				buffer.push(')');
			}

			returnRef = buffer.join('');
		} else if (applyParenthesis) {
			returnRef = '(' + returnRef + ')';
		}

		return returnRef;
	};
}();

},{"lodash.isnan":74}],38:[function(require,module,exports){
'use strict';

var convert = require('./convert'),
    decimalFormatter = require('./decimalFormatter'),
    messageParser = require('./messageParser'),
    monthCodes = require('./monthCodes'),
    priceFormatter = require('./priceFormatter'),
    symbolFormatter = require('./symbolFormatter'),
    symbolParser = require('./symbolParser'),
    priceParser = require('./priceParser'),
    stringToDecimalFormatter = require('./stringToDecimalFormatter'),
    timeFormatter = require('./timeFormatter'),
    timestampParser = require('./timestampParser');

module.exports = function () {
	'use strict';

	return {
		convert: convert,
		decimalFormatter: decimalFormatter,
		monthCodes: monthCodes,
		messageParser: messageParser,
		priceFormatter: priceFormatter,
		symbolParser: symbolParser,
		priceParser: priceParser,
		stringToDecimalFormatter: stringToDecimalFormatter,
		symbolFormatter: symbolFormatter,
		timeFormatter: timeFormatter,
		timestampParser: timestampParser
	};
}();

},{"./convert":36,"./decimalFormatter":37,"./messageParser":39,"./monthCodes":40,"./priceFormatter":41,"./priceParser":42,"./stringToDecimalFormatter":43,"./symbolFormatter":44,"./symbolParser":45,"./timeFormatter":46,"./timestampParser":47}],39:[function(require,module,exports){
'use strict';

var parseValue = require('./priceParser'),
    parseTimestamp = require('./timestampParser'),
    XmlDomParser = require('./common/xml/XmlDomParser');

module.exports = function () {
	'use strict';

	return function (msg) {
		var message = {
			message: msg,
			type: null
		};

		switch (msg.substr(0, 1)) {
			case '%':
				{
					// Jerq Refresh Messages
					var xmlDocument = void 0;

					try {
						var xmlDomParser = new XmlDomParser();
						xmlDocument = xmlDomParser.parse(msg.substring(1));
					} catch (e) {
						xmlDocument = undefined;
					}

					if (xmlDocument) {
						var node = xmlDocument.firstChild;

						switch (node.nodeName) {
							case 'BOOK':
								{
									message.symbol = node.attributes.getNamedItem('symbol').value;
									message.unitcode = node.attributes.getNamedItem('basecode').value;
									message.askDepth = parseInt(node.attributes.getNamedItem('bidcount').value);
									message.bidDepth = parseInt(node.attributes.getNamedItem('bidcount').value);
									message.asks = [];
									message.bids = [];

									var ary1 = void 0,
									    ary2 = void 0;

									if (node.attributes.getNamedItem('askprices') && node.attributes.getNamedItem('asksizes')) {
										ary1 = node.attributes.getNamedItem('askprices').value.split(',');
										ary2 = node.attributes.getNamedItem('asksizes').value.split(',');

										for (var i = 0; i < ary1.length; i++) {
											message.asks.push({ "price": parseValue(ary1[i], message.unitcode), "size": parseInt(ary2[i]) });
										}
									}

									if (node.attributes.getNamedItem('bidprices') && node.attributes.getNamedItem('bidsizes')) {
										ary1 = node.attributes.getNamedItem('bidprices').value.split(',');
										ary2 = node.attributes.getNamedItem('bidsizes').value.split(',');

										for (var _i = 0; _i < ary1.length; _i++) {
											message.bids.push({ "price": parseValue(ary1[_i], message.unitcode), "size": parseInt(ary2[_i]) });
										}
									}

									message.type = 'BOOK';
									break;
								}
							case 'QUOTE':
								{
									for (var _i2 = 0; _i2 < node.attributes.length; _i2++) {
										switch (node.attributes[_i2].name) {
											case 'symbol':
												message.symbol = node.attributes[_i2].value;
												break;
											case 'name':
												message.name = node.attributes[_i2].value;
												break;
											case 'exchange':
												message.exchange = node.attributes[_i2].value;
												break;
											case 'basecode':
												message.unitcode = node.attributes[_i2].value;
												break;
											case 'pointvalue':
												message.pointValue = parseFloat(node.attributes[_i2].value);
												break;
											case 'tickincrement':
												message.tickIncrement = parseInt(node.attributes[_i2].value);
												break;
											case 'flag':
												message.flag = node.attributes[_i2].value;
												break;
											case 'lastupdate':
												{
													var v = node.attributes[_i2].value;
													message.lastUpdate = new Date(parseInt(v.substr(0, 4)), parseInt(v.substr(4, 2)) - 1, parseInt(v.substr(6, 2)), parseInt(v.substr(8, 2)), parseInt(v.substr(10, 2)), parseInt(v.substr(12, 2)));
													break;
												}
											case 'bid':
												message.bidPrice = parseValue(node.attributes[_i2].value, message.unitcode);
												break;
											case 'bidsize':
												message.bidSize = parseInt(node.attributes[_i2].value);
												break;
											case 'ask':
												message.askPrice = parseValue(node.attributes[_i2].value, message.unitcode);
												break;
											case 'asksize':
												message.askSize = parseInt(node.attributes[_i2].value);
												break;
											case 'mode':
												message.mode = node.attributes[_i2].value;
												break;
										}
									}

									var sessions = {};

									for (var j = 0; j < node.childNodes.length; j++) {
										if (node.childNodes[j].nodeName == 'SESSION') {
											var s = {};
											var attributes = node.childNodes[j].attributes;

											if (attributes.getNamedItem('id')) s.id = attributes.getNamedItem('id').value;
											if (attributes.getNamedItem('day')) s.day = attributes.getNamedItem('day').value;
											if (attributes.getNamedItem('last')) s.lastPrice = parseValue(attributes.getNamedItem('last').value, message.unitcode);
											if (attributes.getNamedItem('previous')) s.previousPrice = parseValue(attributes.getNamedItem('previous').value, message.unitcode);
											if (attributes.getNamedItem('open')) s.openPrice = parseValue(attributes.getNamedItem('open').value, message.unitcode);
											if (attributes.getNamedItem('high')) s.highPrice = parseValue(attributes.getNamedItem('high').value, message.unitcode);
											if (attributes.getNamedItem('low')) s.lowPrice = parseValue(attributes.getNamedItem('low').value, message.unitcode);
											if (attributes.getNamedItem('tradesize')) s.tradeSize = parseInt(attributes.getNamedItem('tradesize').value);
											if (attributes.getNamedItem('numtrades')) s.numberOfTrades = parseInt(attributes.getNamedItem('numtrades').value);
											if (attributes.getNamedItem('settlement')) s.settlementPrice = parseValue(attributes.getNamedItem('settlement').value, message.unitcode);
											if (attributes.getNamedItem('volume')) s.volume = parseInt(attributes.getNamedItem('volume').value);
											if (attributes.getNamedItem('openinterest')) s.openInterest = parseInt(attributes.getNamedItem('openinterest').value);
											if (attributes.getNamedItem('timestamp')) {
												var _v = attributes.getNamedItem('timestamp').value;
												s.timeStamp = new Date(parseInt(_v.substr(0, 4)), parseInt(_v.substr(4, 2)) - 1, parseInt(_v.substr(6, 2)), parseInt(_v.substr(8, 2)), parseInt(_v.substr(10, 2)), parseInt(_v.substr(12, 2)));
											}
											if (attributes.getNamedItem('tradetime')) {
												var _v2 = attributes.getNamedItem('tradetime').value;
												s.tradeTime = new Date(parseInt(_v2.substr(0, 4)), parseInt(_v2.substr(4, 2)) - 1, parseInt(_v2.substr(6, 2)), parseInt(_v2.substr(8, 2)), parseInt(_v2.substr(10, 2)), parseInt(_v2.substr(12, 2)));
											}

											if (s.id) sessions[s.id] = s;
										}
									}

									var premarket = typeof sessions.combined.lastPrice === 'undefined';
									var postmarket = !premarket && typeof sessions.combined.settlementPrice !== 'undefined';

									var session = premarket ? sessions.previous : sessions.combined;

									if (sessions.combined.previousPrice) {
										message.previousPrice = sessions.combined.previousPrice;
									} else {
										message.previousPrice = sessions.previous.previousPrice;
									}

									if (session.lastPrice) message.lastPrice = session.lastPrice;
									if (session.openPrice) message.openPrice = session.openPrice;
									if (session.highPrice) message.highPrice = session.highPrice;
									if (session.lowPrice) message.lowPrice = session.lowPrice;
									if (session.tradeSize) message.tradeSize = session.tradeSize;
									if (session.numberOfTrades) message.numberOfTrades = session.numberOfTrades;
									if (session.settlementPrice) message.settlementPrice = session.settlementPrice;
									if (session.volume) message.volume = session.volume;
									if (session.openInterest) message.openInterest = session.openInterest;
									if (session.id === 'combined' && sessions.previous.openInterest) message.openInterest = sessions.previous.openInterest;
									if (session.timeStamp) message.timeStamp = session.timeStamp;
									if (session.tradeTime) message.tradeTime = session.tradeTime;

									// 2016/10/29, BRI. We have a problem where we don't "roll" quotes
									// for futures. For example, LEZ16 doesn't "roll" the settlementPrice
									// to the previous price -- so, we did this on the open message (2,0A).
									// Eero has another idea. Perhaps we are setting the "day" improperly
									// here. Perhaps we should base the day off of the actual session
									// (i.e. "session" variable) -- instead of taking it from the "combined"
									// session.

									if (sessions.combined.day) message.day = session.day;
									if (premarket && typeof message.flag === 'undefined') message.flag = 'p';

									var p = sessions.previous;

									message.previousPreviousPrice = p.previousPrice;
									message.previousSettlementPrice = p.settlementPrice;
									message.previousOpenPrice = p.openPrice;
									message.previousHighPrice = p.highPrice;
									message.previousLowPrice = p.lowPrice;
									message.previousTimeStamp = p.timeStamp;

									if (sessions.combined.day) {
										var sessionFormT = 'session_' + sessions.combined.day + '_T';

										if (sessions.hasOwnProperty(sessionFormT)) {
											var t = sessions[sessionFormT];

											var lastPriceT = t.lastPrice;

											if (lastPriceT) {
												var tradeTimeT = t.tradeTime;
												var tradeSizeT = t.tradeSize;

												var sessionIsEvening = void 0;

												if (tradeTimeT) {
													var noon = new Date(tradeTimeT.getFullYear(), tradeTimeT.getMonth(), tradeTimeT.getDate(), 12, 0, 0, 0);

													sessionIsEvening = tradeTimeT.getTime() > noon.getTime();
												} else {
													sessionIsEvening = false;
												}

												message.sessionT = sessionIsEvening;

												var sessionIsCurrent = premarket || sessionIsEvening;

												if (sessionIsCurrent) {
													message.lastPriceT = lastPriceT;
												}

												if (premarket || postmarket) {
													message.session = 'T';

													if (sessionIsCurrent) {
														if (tradeTimeT) {
															message.tradeTime = tradeTimeT;
														}

														if (tradeSizeT) {
															message.tradeSize = tradeSizeT;
														}
													}

													if (premarket) {
														if (t.volume) {
															message.volume = t.volume;
														}

														if (t.previousPrice) {
															message.previousPrice = t.previousPrice;
														}
													}
												}
											}
										}
									}

									message.type = 'REFRESH_QUOTE';
									break;
								}
							case 'CV':
								{
									message.type = 'REFRESH_CUMULATIVE_VOLUME';
									message.symbol = node.attributes.getNamedItem('symbol').value;
									message.unitCode = node.attributes.getNamedItem('basecode').value;
									message.tickIncrement = parseValue(node.attributes.getNamedItem('tickincrement').value, message.unitCode);

									var dataAttribute = node.attributes.getNamedItem('data');

									if (dataAttribute) {
										var priceLevelsRaw = dataAttribute.value || '';
										var priceLevels = priceLevelsRaw.split(':');

										for (var _i3 = 0; _i3 < priceLevels.length; _i3++) {
											var priceLevelRaw = priceLevels[_i3];
											var priceLevelData = priceLevelRaw.split(',');

											priceLevels[_i3] = {
												price: parseValue(priceLevelData[0], message.unitCode),
												volume: parseInt(priceLevelData[1])
											};
										}

										priceLevels.sort(function (a, b) {
											return a.price - b.price;
										});

										message.priceLevels = priceLevels;
									} else {
										message.priceLevels = [];
									}

									break;
								}
							default:
								console.log(msg);
								break;
						}
					}

					break;
				}
			case '\x01':
				{
					// DDF Messages
					switch (msg.substr(1, 1)) {
						case '#':
							{
								// TO DO: Standardize the timezones for Daylight Savings
								message.type = 'TIMESTAMP';
								message.timestamp = new Date(parseInt(msg.substr(2, 4)), parseInt(msg.substr(6, 2)) - 1, parseInt(msg.substr(8, 2)), parseInt(msg.substr(10, 2)), parseInt(msg.substr(12, 2)), parseInt(msg.substr(14, 2)));
								break;
							}
						case 'C':
						case '2':
							{
								message.record = '2';
								var pos = msg.indexOf(',', 0);
								message.symbol = msg.substring(2, pos);
								message.subrecord = msg.substr(pos + 1, 1);
								message.unitcode = msg.substr(pos + 3, 1);
								message.exchange = msg.substr(pos + 4, 1);
								message.delay = parseInt(msg.substr(pos + 5, 2));
								switch (message.subrecord) {
									case '0':
										{
											// TO DO: Error Handling / Sanity Check
											var pos2 = msg.indexOf(',', pos + 7);
											message.value = parseValue(msg.substring(pos + 7, pos2), message.unitcode);
											message.element = msg.substr(pos2 + 1, 1);
											message.modifier = msg.substr(pos2 + 2, 1);

											switch (message.element) {
												case 'A':
													message.type = 'OPEN';
													break;
												case 'C':
													if (message.modifier == '1') message.type = 'OPEN_INTEREST';
													break;
												case 'D':
												case 'd':
													if (message.modifier == '0') message.type = 'SETTLEMENT';
													break;
												case 'V':
													if (message.modifier == '0') message.type = 'VWAP';
													break;
												case '0':
													{
														if (message.modifier == '0') {
															message.tradePrice = message.value;
															message.type = 'TRADE';
														}
														break;
													}
												case '5':
													message.type = 'HIGH';
													break;
												case '6':
													message.type = 'LOW';
													break;
												case '7':
													{
														if (message.modifier == '1') message.type = 'VOLUME_YESTERDAY';else if (message.modifier == '6') message.type = 'VOLUME';
														break;
													}
											}

											message.day = msg.substr(pos2 + 3, 1);
											message.session = msg.substr(pos2 + 4, 1);
											message.time = parseTimestamp(msg.substr(msg.indexOf('\x03') + 1, 9));
											break;
										}
									case '1':
									case '2':
									case '3':
									case '4':
										{
											var ary = msg.substring(pos + 8).split(',');
											message.openPrice = parseValue(ary[0], message.unitcode);
											message.highPrice = parseValue(ary[1], message.unitcode);
											message.lowPrice = parseValue(ary[2], message.unitcode);
											message.lastPrice = parseValue(ary[3], message.unitcode);
											message.bidPrice = parseValue(ary[4], message.unitcode);
											message.askPrice = parseValue(ary[5], message.unitcode);
											message.previousPrice = parseValue(ary[7], message.unitcode);
											message.settlementPrice = parseValue(ary[10], message.unitcode);
											message.volume = ary[13].length > 0 ? parseInt(ary[13]) : undefined;
											message.openInterest = ary[12].length > 0 ? parseInt(ary[12]) : undefined;
											message.day = ary[14].substr(0, 1);
											message.session = ary[14].substr(1, 1);
											message.time = parseTimestamp(msg.substr(msg.indexOf('\x03') + 1, 9));
											message.type = 'REFRESH_DDF';
											break;
										}
									case '7':
										{
											var _pos = msg.indexOf(',', pos + 7);
											message.tradePrice = parseValue(msg.substring(pos + 7, _pos), message.unitcode);

											pos = _pos + 1;
											_pos = msg.indexOf(',', pos);
											message.tradeSize = parseInt(msg.substring(pos, _pos));
											pos = _pos + 1;
											message.day = msg.substr(pos, 1);
											message.session = msg.substr(pos + 1, 1);
											message.time = parseTimestamp(msg.substr(msg.indexOf('\x03') + 1, 9));
											message.type = 'TRADE';
											break;
										}
									case '8':
										{
											var _pos2 = msg.indexOf(',', pos + 7);
											message.bidPrice = parseValue(msg.substring(pos + 7, _pos2), message.unitcode);
											pos = _pos2 + 1;
											_pos2 = msg.indexOf(',', pos);
											message.bidSize = parseInt(msg.substring(pos, _pos2));
											pos = _pos2 + 1;
											_pos2 = msg.indexOf(',', pos);
											message.askPrice = parseValue(msg.substring(pos, _pos2), message.unitcode);
											pos = _pos2 + 1;
											_pos2 = msg.indexOf(',', pos);
											message.askSize = parseInt(msg.substring(pos, _pos2));
											pos = _pos2 + 1;
											message.day = msg.substr(pos, 1);
											message.session = msg.substr(pos + 1, 1);
											message.time = parseTimestamp(msg.substr(msg.indexOf('\x03') + 1, 9));
											message.type = 'TOB';
											break;
										}
									case 'Z':
										{
											var _pos3 = msg.indexOf(',', pos + 7);
											message.tradePrice = parseValue(msg.substring(pos + 7, _pos3), message.unitcode);

											pos = _pos3 + 1;
											_pos3 = msg.indexOf(',', pos);
											message.tradeSize = parseInt(msg.substring(pos, _pos3));
											pos = _pos3 + 1;
											message.day = msg.substr(pos, 1);
											message.session = msg.substr(pos + 1, 1);
											message.time = parseTimestamp(msg.substr(msg.indexOf('\x03') + 1, 9));
											message.type = 'TRADE_OUT_OF_SEQUENCE';
											break;
										}
								}
								break;
							}
						case '3':
							{
								var _pos4 = msg.indexOf(',', 0);
								message.symbol = msg.substring(2, _pos4);
								message.subrecord = msg.substr(_pos4 + 1, 1);
								switch (message.subrecord) {
									case 'B':
										{
											message.unitcode = msg.substr(_pos4 + 3, 1);
											message.exchange = msg.substr(_pos4 + 4, 1);
											message.bidDepth = msg.substr(_pos4 + 5, 1) == 'A' ? 10 : parseInt(msg.substr(_pos4 + 5, 1));
											message.askDepth = msg.substr(_pos4 + 6, 1) == 'A' ? 10 : parseInt(msg.substr(_pos4 + 6, 1));
											message.bids = [];
											message.asks = [];
											var _ary = msg.substring(_pos4 + 8).split(',');
											for (var _i4 = 0; _i4 < _ary.length; _i4++) {
												var _ary2 = _ary[_i4].split(/[A-Z]/);
												var c = _ary[_i4].substr(_ary2[0].length, 1);
												if (c <= 'J') message.asks.push({ "price": parseValue(_ary2[0], message.unitcode), "size": parseInt(_ary2[1]) });else message.bids.push({ "price": parseValue(_ary2[0], message.unitcode), "size": parseInt(_ary2[1]) });
											}

											message.type = 'BOOK';
											break;
										}
									default:
										break;
								}

								break;
							}
						default:
							{
								message.type = 'UNKNOWN';
								break;
							}
					}
				}
		}

		return message;
	};
}();

},{"./common/xml/XmlDomParser":35,"./priceParser":42,"./timestampParser":47}],40:[function(require,module,exports){
"use strict";

module.exports = function () {
	'use strict';

	var monthMap = {};
	var numberMap = {};

	var addMonth = function addMonth(code, name, number) {
		monthMap[code] = name;
		numberMap[code] = number;
	};

	addMonth("F", "January", 1);
	addMonth("G", "February", 2);
	addMonth("H", "March", 3);
	addMonth("J", "April", 4);
	addMonth("K", "May", 5);
	addMonth("M", "June", 6);
	addMonth("N", "July", 7);
	addMonth("Q", "August", 8);
	addMonth("U", "September", 9);
	addMonth("V", "October", 10);
	addMonth("X", "November", 11);
	addMonth("Z", "December", 12);
	addMonth("Y", "Cash", 0);

	return {
		getCodeToNameMap: function getCodeToNameMap() {
			return monthMap;
		},

		getCodeToNumberMap: function getCodeToNumberMap() {
			return numberMap;
		}
	};
}();

},{}],41:[function(require,module,exports){
'use strict';

var lodashIsNaN = require('lodash.isnan');
var decimalFormatter = require('./decimalFormatter');

module.exports = function () {
	'use strict';

	function frontPad(value, digits) {
		return ['000', Math.floor(value)].join('').substr(-1 * digits);
	}

	return function (fractionSeparator, specialFractions, thousandsSeparator, useParenthesis) {
		var format = void 0;

		function getWholeNumberAsString(value) {
			var val = Math.floor(value);

			if (val === 0 && fractionSeparator === '') {
				return '';
			} else {
				return val;
			}
		}

		function formatDecimal(value, digits) {
			return decimalFormatter(value, digits, thousandsSeparator, useParenthesis);
		}

		if (fractionSeparator === '.') {
			format = function format(value, unitcode) {
				switch (unitcode) {
					case '2':
						return formatDecimal(value, 3);
					case '3':
						return formatDecimal(value, 4);
					case '4':
						return formatDecimal(value, 5);
					case '5':
						return formatDecimal(value, 6);
					case '6':
						return formatDecimal(value, 7);
					case '7':
						return formatDecimal(value, 8);
					case '8':
						return formatDecimal(value, 0);
					case '9':
						return formatDecimal(value, 1);
					case 'A':
						return formatDecimal(value, 2);
					case 'B':
						return formatDecimal(value, 3);
					case 'C':
						return formatDecimal(value, 4);
					case 'D':
						return formatDecimal(value, 5);
					case 'E':
						return formatDecimal(value, 6);
					default:
						if (value === '' || value === undefined || value === null || lodashIsNaN(value)) {
							return '';
						} else {
							return value;
						}
				}
			};
		} else {
			format = function format(value, unitcode) {
				if (value === '' || value === undefined || value === null || lodashIsNaN(value)) {
					return '';
				}

				var originalValue = value;
				var absoluteValue = Math.abs(value);

				var negative = value < 0;

				var prefix = void 0;
				var suffix = void 0;

				if (negative) {
					if (useParenthesis === true) {
						prefix = '(';
						suffix = ')';
					} else {
						prefix = '-';
						suffix = '';
					}
				} else {
					prefix = '';
					suffix = '';
				}

				switch (unitcode) {
					case '2':
						return [prefix, getWholeNumberAsString(absoluteValue), fractionSeparator, frontPad((absoluteValue - Math.floor(absoluteValue)) * 8, 1), suffix].join('');
					case '3':
						return [prefix, getWholeNumberAsString(absoluteValue), fractionSeparator, frontPad((absoluteValue - Math.floor(absoluteValue)) * 16, 2), suffix].join('');
					case '4':
						return [prefix, getWholeNumberAsString(absoluteValue), fractionSeparator, frontPad((absoluteValue - Math.floor(absoluteValue)) * 32, 2), suffix].join('');
					case '5':
						return [prefix, getWholeNumberAsString(absoluteValue), fractionSeparator, frontPad(Math.floor(((absoluteValue - Math.floor(absoluteValue)) * (specialFractions ? 320 : 64)).toFixed(1)), specialFractions ? 3 : 2), suffix].join('');
					case '6':
						return [prefix, getWholeNumberAsString(absoluteValue), fractionSeparator, frontPad(Math.floor(((absoluteValue - Math.floor(absoluteValue)) * (specialFractions ? 320 : 128)).toFixed(1)), 3), suffix].join('');
					case '7':
						return [prefix, getWholeNumberAsString(absoluteValue), fractionSeparator, frontPad((absoluteValue - Math.floor(absoluteValue)) * (specialFractions ? 320 : 256), 3), suffix].join('');
					case '8':
						return formatDecimal(originalValue, 0);
					case '9':
						return formatDecimal(originalValue, 1);
					case 'A':
						return formatDecimal(originalValue, 2);
					case 'B':
						return formatDecimal(originalValue, 3);
					case 'C':
						return formatDecimal(originalValue, 4);
					case 'D':
						return formatDecimal(originalValue, 5);
					case 'E':
						return formatDecimal(originalValue, 6);
					default:
						return originalValue;
				}
			};
		}

		return {
			format: format
		};
	};
}();

},{"./decimalFormatter":37,"lodash.isnan":74}],42:[function(require,module,exports){
'use strict';

module.exports = function () {
	'use strict';

	var replaceExpressions = {};

	function getReplaceExpression(thousandsSeparator) {
		if (!replaceExpressions.hasOwnProperty(thousandsSeparator)) {
			replaceExpressions[thousandsSeparator] = new RegExp(thousandsSeparator, 'g');
		}

		return replaceExpressions[thousandsSeparator];
	}

	return function (str, unitcode, thousandsSeparator) {
		if (str.length < 1) {
			return undefined;
		} else if (str === '-') {
			return null;
		}

		if (thousandsSeparator) {
			str = str.replace(getReplaceExpression(thousandsSeparator), '');
		}

		if (!(str.indexOf('.') < 0)) {
			return parseFloat(str);
		}

		var sign = str.substr(0, 1) == '-' ? -1 : 1;

		if (sign === -1) {
			str = str.substr(1);
		}

		switch (unitcode) {
			case '2':
				// 8ths
				return sign * ((str.length > 1 ? parseInt(str.substr(0, str.length - 1)) : 0) + parseInt(str.substr(-1)) / 8);
			case '3':
				// 16ths
				return sign * ((str.length > 2 ? parseInt(str.substr(0, str.length - 2)) : 0) + parseInt(str.substr(-2)) / 16);
			case '4':
				// 32ths
				return sign * ((str.length > 2 ? parseInt(str.substr(0, str.length - 2)) : 0) + parseInt(str.substr(-2)) / 32);
			case '5':
				// 64ths
				return sign * ((str.length > 2 ? parseInt(str.substr(0, str.length - 2)) : 0) + parseInt(str.substr(-2)) / 64);
			case '6':
				// 128ths
				return sign * ((str.length > 3 ? parseInt(str.substr(0, str.length - 3)) : 0) + parseInt(str.substr(-3)) / 128);
			case '7':
				// 256ths
				return sign * ((str.length > 3 ? parseInt(str.substr(0, str.length - 3)) : 0) + parseInt(str.substr(-3)) / 256);
			case '8':
				return sign * parseInt(str);
			case '9':
				return sign * (parseInt(str) / 10);
			case 'A':
				return sign * (parseInt(str) / 100);
			case 'B':
				return sign * (parseInt(str) / 1000);
			case 'C':
				return sign * (parseInt(str) / 10000);
			case 'D':
				return sign * (parseInt(str) / 100000);
			case 'E':
				return sign * (parseInt(str) / 1000000);
			default:
				return sign * parseInt(str);
		}
	};
}();

},{}],43:[function(require,module,exports){
'use strict';

var Converter = require('./convert');

module.exports = function () {
	/**
  * Adapted from legacy code: https://github.com/barchart/php-jscharts/blob/372deb9b4d9ee678f32b6f8c4268434249c1b4ac/chart_package/webroot/js/deps/ddfplus/com.ddfplus.js
  */
	return function (string, unitCode) {
		var baseCode = Converter.unitCodeToBaseCode(unitCode);

		// Fix for 10-Yr T-Notes
		if (baseCode === -4 && (string.length === 7 || string.length === 6 && string.charAt(0) !== '1')) {
			baseCode -= 1;
		}

		if (baseCode >= 0) {
			var ival = string * 1;
			return Math.round(ival * Math.pow(10, baseCode)) / Math.pow(10, baseCode);
		} else {
			var has_dash = string.match(/-/);
			var divisor = Math.pow(2, Math.abs(baseCode) + 2);
			var fracsize = String(divisor).length;
			var denomstart = string.length - fracsize;
			var numerend = denomstart;
			if (string.substring(numerend - 1, numerend) == '-') numerend--;
			var numerator = string.substring(0, numerend) * 1;
			var denominator = string.substring(denomstart, string.length) * 1;

			if (baseCode === -5) {
				divisor = has_dash ? 320 : 128;
			}

			return numerator + denominator / divisor;
		}
	};
}();

},{"./convert":36}],44:[function(require,module,exports){
'use strict';

module.exports = function () {
	'use strict';

	return {
		format: function format(symbol) {
			if (symbol !== null && typeof symbol === 'string') {
				return symbol.toUpperCase();
			} else {
				return symbol;
			}
		}
	};
}();

},{}],45:[function(require,module,exports){
'use strict';

module.exports = function () {
	'use strict';

	var alternateFuturesMonths = {
		A: 'F',
		B: 'G',
		C: 'H',
		D: 'J',
		E: 'K',
		I: 'M',
		L: 'N',
		O: 'Q',
		P: 'U',
		R: 'V',
		S: 'X',
		T: 'Z'
	};

	var predicates = {};

	predicates.bats = /^(.*)\.BZ$/i;
	predicates.percent = /(\.RT)$/;

	var types = {};

	types.forex = /^\^([A-Z]{3})([A-Z]{3})$/i;
	types.futures = {};
	types.futures.spread = /^_S_/i;
	types.futures.concrete = /^([A-Z][A-Z0-9\$\-!\.]{0,2})([A-Z]{1})([0-9]{4}|[0-9]{1,2})$/i;
	types.futures.alias = /^([A-Z][A-Z0-9\$\-!\.]{0,2})(\*{1})([0-9]{1})$/i;
	types.futures.options = {};
	types.futures.options.short = /^([A-Z][A-Z0-9\$\-!\.]?)([A-Z])([0-9]{1,4})([A-Z])$/i;
	types.futures.options.long = /^([A-Z][A-Z0-9\$\-!\.]{0,2})([A-Z])([0-9]{1,4})\|(\-?[0-9]{1,5})(C|P)$/i;
	types.futures.options.historical = /^([A-Z][A-Z0-9\$\-!\.]{0,2})([A-Z])([0-9]{2})([0-9]{1,5})(C|P)$/i;
	types.indicies = {};
	types.indicies.external = /^\$(.*)$/i;
	types.indicies.sector = /^\-(.*)$/i;
	types.indicies.cmdty = /^(.*)\.CM$/i;

	var parsers = [];

	parsers.push(function (symbol) {
		var definition = null;

		if (types.futures.spread.test(symbol)) {
			definition = {};

			definition.symbol = symbol;
			definition.type = 'future_spread';
		}

		return definition;
	});

	parsers.push(function (symbol) {
		var definition = null;

		var match = symbol.match(types.futures.concrete);

		if (match !== null) {
			definition = {};

			definition.symbol = symbol;
			definition.type = 'future';

			definition.dynamic = false;
			definition.root = match[1];
			definition.month = match[2];
			definition.year = getFuturesYear(match[3]);
		}

		return definition;
	});

	parsers.push(function (symbol) {
		var definition = null;

		var match = symbol.match(types.futures.alias);

		if (match !== null) {
			definition = {};

			definition.symbol = symbol;
			definition.type = 'future';

			definition.dynamic = true;
			definition.root = match[1];
			definition.dynamicCode = match[3];
		}

		return definition;
	});

	parsers.push(function (symbol) {
		var definition = null;

		if (types.forex.test(symbol)) {
			definition = {};

			definition.symbol = symbol;
			definition.type = 'forex';
		}

		return definition;
	});

	parsers.push(function (symbol) {
		var definition = null;

		if (types.indicies.external.test(symbol)) {
			definition = {};

			definition.symbol = symbol;
			definition.type = 'index';
		}

		return definition;
	});

	parsers.push(function (symbol) {
		var definition = null;

		if (types.indicies.sector.test(symbol)) {
			definition = {};

			definition.symbol = symbol;
			definition.type = 'sector';
		}

		return definition;
	});

	parsers.push(function (symbol) {
		var definition = null;

		var match = symbol.match(types.futures.options.short);

		if (match !== null) {
			definition = {};

			var putCallCharacterCode = match[4].charCodeAt(0);
			var putCharacterCode = 80;
			var callCharacterCode = 67;

			var optionType = void 0;
			var optionYearDelta = void 0;

			if (putCallCharacterCode < putCharacterCode) {
				optionType = 'call';
				optionYearDelta = putCallCharacterCode - callCharacterCode;
			} else {
				optionType = 'put';
				optionYearDelta = putCallCharacterCode - putCharacterCode;
			}

			definition.symbol = symbol;
			definition.type = 'future_option';

			definition.option_type = optionType;
			definition.strike = parseInt(match[3]);

			definition.root = match[1];
			definition.month = match[2];
			definition.year = getCurrentYear() + optionYearDelta;
		}

		return definition;
	});

	parsers.push(function (symbol) {
		var definition = null;

		var match = symbol.match(types.futures.options.long) || symbol.match(types.futures.options.historical);

		if (match !== null) {
			definition = {};

			definition.symbol = symbol;
			definition.type = 'future_option';

			definition.option_type = match[5] === 'C' ? 'call' : 'put';
			definition.strike = parseInt(match[4]);

			definition.root = match[1];
			definition.month = getFuturesMonth(match[2]);
			definition.year = getFuturesYear(match[3]);
		}

		return definition;
	});

	var converters = [];

	converters.push(function (symbol) {
		var converted = null;

		if (symbolParser.getIsFuture(symbol) && symbolParser.getIsConcrete(symbol)) {
			converted = symbol.replace(/(.{1,3})([A-Z]{1})([0-9]{3}|[0-9]{1})?([0-9]{1})$/i, '$1$2$4') || null;
		}

		return converted;
	});

	converters.push(function (symbol) {
		var converted = null;

		if (symbolParser.getIsFutureOption(symbol)) {
			var definition = symbolParser.parseInstrumentType(symbol);

			var putCallCharacter = getPutCallCharacter(definition.option_type);

			if (definition.root.length < 3) {
				var putCallCharacterCode = putCallCharacter.charCodeAt(0);

				converted = '' + definition.root + definition.month + definition.strike + String.fromCharCode(putCallCharacterCode + definition.year - getCurrentYear());
			} else {
				converted = '' + definition.root + definition.month + getYearDigits(definition.year, 1) + '|' + definition.strike + putCallCharacter;
			}
		}

		return converted;
	});

	converters.push(function (symbol) {
		return symbol;
	});

	function getCurrentYear() {
		var now = new Date();

		return now.getFullYear();
	}

	function getYearDigits(year, digits) {
		var yearString = year.toString();

		return yearString.substring(yearString.length - digits, yearString.length);
	}

	function getFuturesMonth(monthString) {
		return alternateFuturesMonths[monthString] || monthString;
	}

	function getFuturesYear(yearString) {
		var currentYear = getCurrentYear();

		var year = parseInt(yearString);

		if (year < 10) {
			var bump = year < currentYear % 10 ? 1 : 0;

			year = Math.floor(currentYear / 10) * 10 + year + bump * 10;
		} else if (year < 100) {
			year = Math.floor(currentYear / 100) * 100 + year;

			if (year < currentYear) {
				var alternateYear = year + 100;

				if (currentYear - year > alternateYear - currentYear) {
					year = alternateYear;
				}
			}
		}

		return year;
	}

	function getPutCallCharacter(optionType) {
		if (optionType === 'call') {
			return 'C';
		} else if (optionType === 'put') {
			return 'P';
		} else {
			return null;
		}
	}

	var symbolParser = {
		/**
   * Returns a simple instrument definition with the terms that can be
   * gleaned from a symbol. If no specifics can be determined from the
   * symbol, a null value is returned.
   *
   * @public
   * @param {String} symbol
   * @returns {Object|null}
   */
		parseInstrumentType: function parseInstrumentType(symbol) {
			if (typeof symbol !== 'string') {
				return null;
			}

			var definition = null;

			for (var i = 0; i < parsers.length && definition === null; i++) {
				var parser = parsers[i];

				definition = parser(symbol);
			}

			return definition;
		},

		/**
   * Translates a symbol into a form suitable for use with JERQ (i.e. our quote "producer").
   *
   * @public
   * @param {String} symbol
   * @return {String|null}
   */
		getProducerSymbol: function getProducerSymbol(symbol) {
			if (typeof symbol !== 'string') {
				return null;
			}

			var converted = null;

			for (var i = 0; i < converters.length && converted === null; i++) {
				var converter = converters[i];

				converted = converter(symbol);
			}

			return converted;
		},

		/**
   * Attempts to convert database format of futures options to pipeline format
   * (e.g. ZLF320Q -> ZLF9|320C)
   *
   * @public
   * @param {String} symbol
   * @returns {String|null}
   */
		getFuturesOptionPipelineFormat: function getFuturesOptionPipelineFormat(symbol) {
			var definition = symbolParser.parseInstrumentType(symbol);

			var formatted = null;

			if (definition.type === 'future_option') {
				var putCallCharacter = getPutCallCharacter(definition.option_type);

				formatted = '' + definition.root + definition.month + getYearDigits(definition.year, 1) + '|' + definition.strike + putCallCharacter;
			}

			return formatted;
		},

		/**
   * Returns true if the symbol is not an alias to another symbol; otherwise
   * false.
   *
   * @public
   * @param {String} symbol
   * @returns {Boolean}
   */
		getIsConcrete: function getIsConcrete(symbol) {
			return typeof symbol === 'string' && !types.futures.alias.test(symbol);
		},

		/**
   * Returns true if the symbol is an alias for another symbol; otherwise false.
   *
   * @public
   * @param {String} symbol
   * @returns {Boolean}
   */
		getIsReference: function getIsReference(symbol) {
			return typeof symbol === 'string' && types.futures.alias.test(symbol);
		},

		/**
   * Returns true if the symbol represents futures contract; false otherwise.
   *
   * @public
   * @param {String} symbol
   * @returns {Boolean}
   */
		getIsFuture: function getIsFuture(symbol) {
			return typeof symbol === 'string' && (types.futures.concrete.test(symbol) || types.futures.alias.test(symbol));
		},

		/**
   * Returns true if the symbol represents futures spread; false otherwise.
   *
   * @public
   * @param {String} symbol
   * @returns {Boolean}
   */
		getIsFutureSpread: function getIsFutureSpread(symbol) {
			return typeof symbol === 'string' && types.futures.spread.test(symbol);
		},

		/**
   * Returns true if the symbol represents an option on a futures contract; false
   * otherwise.
   *
   * @public
   * @param {String} symbol
   * @returns {Boolean}
   */
		getIsFutureOption: function getIsFutureOption(symbol) {
			return typeof symbol === 'string' && (types.futures.options.short.test(symbol) || types.futures.options.long.test(symbol) || types.futures.options.historical.test(symbol));
		},

		/**
   * Returns true if the symbol represents a foreign exchange currency pair;
   * false otherwise.
   *
   * @public
   * @param {String} symbol
   * @returns {Boolean}
   */
		getIsForex: function getIsForex(symbol) {
			return typeof symbol === 'string' && types.forex.test(symbol);
		},

		/**
   * Returns true if the symbol represents an external index (e.g. Dow Jones
   * Industrials); false otherwise.
   *
   * @public
   * @param {String} symbol
   * @returns {Boolean}
   */
		getIsIndex: function getIsIndex(symbol) {
			return typeof symbol === 'string' && types.indicies.external.test(symbol);
		},

		/**
   * Returns true if the symbol represents an internally-calculated sector
   * index; false otherwise.
   *
   * @public
   * @param {String} symbol
   * @returns {Boolean}
   */
		getIsSector: function getIsSector(symbol) {
			return typeof symbol === 'string' && types.indicies.sector.test(symbol);
		},

		/**
   * Returns true if the symbol represents an internally-calculated, cmdty-branded
   * index; false otherwise.
   *
   * @public
   * @param {String} symbol
   * @returns {Boolean}
   */
		getIsCmdty: function getIsCmdty(symbol) {
			return typeof symbol === 'string' && types.indicies.cmdty.test(symbol);
		},

		/**
   * Returns true if the symbol is listed on the BATS exchange; false otherwise.
   *
   * @public
   * @param {String} symbol
   * @returns {Boolean}
   */
		getIsBats: function getIsBats(symbol) {
			return typeof symbol === 'string' && predicates.bats.test(symbol);
		},

		/**
   * Returns true if prices for the symbol should be represented as a percentage; false
   * otherwise.
   *
   * @public
   * @param {String} symbol
   * @returns {Boolean}
   */
		displayUsingPercent: function displayUsingPercent(symbol) {
			return typeof symbol === 'string' && predicates.percent.test(symbol);
		}
	};

	return symbolParser;
}();

},{}],46:[function(require,module,exports){
'use strict';

module.exports = function () {
	'use strict';

	return function (useTwelveHourClock, short) {
		var _formatTime = void 0;

		if (useTwelveHourClock) {
			if (short) {
				_formatTime = formatTwelveHourTimeShort;
			} else {
				_formatTime = formatTwelveHourTime;
			}
		} else {
			if (short) {
				_formatTime = formatTwentyFourHourTimeShort;
			} else {
				_formatTime = formatTwentyFourHourTime;
			}
		}

		var formatters = {
			format: function format(q) {
				var t = q.time;

				if (!t) {
					return '';
				} else if (!q.lastPrice || q.flag || q.sessionT) {
					return formatters.formatDate(t);
				} else {
					return formatters.formatTime(t, q.timezone);
				}
			},

			formatTime: function formatTime(date, timezone) {
				var returnRef = void 0;

				if (date) {
					returnRef = _formatTime(date);

					if (timezone) {
						returnRef = returnRef + ' ' + timezone;
					}
				} else {
					returnRef = '';
				}

				return returnRef;
			},

			formatDate: function formatDate(date) {
				if (date) {
					return leftPad(date.getMonth() + 1) + '/' + leftPad(date.getDate()) + '/' + leftPad(date.getFullYear());
				} else {
					return '';
				}
			}
		};

		return formatters;
	};

	function formatTwelveHourTime(t) {
		var hours = t.getHours();
		var period = void 0;

		if (hours === 0) {
			hours = 12;
			period = 'AM';
		} else if (hours === 12) {
			hours = hours;
			period = 'PM';
		} else if (hours > 12) {
			hours = hours - 12;
			period = 'PM';
		} else {
			hours = hours;
			period = 'AM';
		}

		return leftPad(hours) + ':' + leftPad(t.getMinutes()) + ':' + leftPad(t.getSeconds()) + ' ' + period;
	}

	function formatTwelveHourTimeShort(t) {
		var hours = t.getHours();
		var period = void 0;

		if (hours === 0) {
			hours = 12;
			period = 'A';
		} else if (hours === 12) {
			hours = hours;
			period = 'P';
		} else if (hours > 12) {
			hours = hours - 12;
			period = 'P';
		} else {
			hours = hours;
			period = 'A';
		}

		return leftPad(hours) + ':' + leftPad(t.getMinutes()) + period;
	}

	function formatTwentyFourHourTime(t) {
		return leftPad(t.getHours()) + ':' + leftPad(t.getMinutes()) + ':' + leftPad(t.getSeconds());
	}

	function formatTwentyFourHourTimeShort(t) {
		return leftPad(t.getHours()) + ':' + leftPad(t.getMinutes());
	}

	function leftPad(value) {
		return ('00' + value).substr(-2);
	}
}();

},{}],47:[function(require,module,exports){
'use strict';

module.exports = function () {
	'use strict';

	return function (bytes) {
		if (bytes.length !== 9) {
			return null;
		}

		var year = bytes.charCodeAt(0) * 100 + bytes.charCodeAt(1) - 64;
		var month = bytes.charCodeAt(2) - 64 - 1;
		var day = bytes.charCodeAt(3) - 64;
		var hour = bytes.charCodeAt(4) - 64;
		var minute = bytes.charCodeAt(5) - 64;
		var second = bytes.charCodeAt(6) - 64;
		var ms = (0xFF & bytes.charCodeAt(7)) + ((0xFF & bytes.charCodeAt(8)) << 8);

		// 2016/02/17. JERQ is providing us with date and time values that
		// are meant to be interpreted in the exchange's local timezone.
		//
		// This is interesting because different time values (e.g. 14:30 and
		// 13:30) can refer to the same moment (e.g. EST for US equities and
		// CST for US futures).
		//
		// Furthermore, when we use the timezone-sensitive Date object, we
		// create a problem. The represents (computer) local time. So, for
		// server applications, it is recommended that we use UTC -- so
		// that the values (hours) are not changed when JSON serialized
		// to ISO-8601 format. Then, the issue is passed along to the
		// consumer (which must ignore the timezone too).

		return new Date(year, month, day, hour, minute, second, ms);
	};
}();

},{}],48:[function(require,module,exports){
module.exports = require('./lib/axios');
},{"./lib/axios":50}],49:[function(require,module,exports){
'use strict';

var utils = require('./../utils');
var settle = require('./../core/settle');
var buildURL = require('./../helpers/buildURL');
var parseHeaders = require('./../helpers/parseHeaders');
var isURLSameOrigin = require('./../helpers/isURLSameOrigin');
var createError = require('../core/createError');

module.exports = function xhrAdapter(config) {
  return new Promise(function dispatchXhrRequest(resolve, reject) {
    var requestData = config.data;
    var requestHeaders = config.headers;

    if (utils.isFormData(requestData)) {
      delete requestHeaders['Content-Type']; // Let the browser set it
    }

    var request = new XMLHttpRequest();

    // HTTP basic authentication
    if (config.auth) {
      var username = config.auth.username || '';
      var password = config.auth.password || '';
      requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
    }

    request.open(config.method.toUpperCase(), buildURL(config.url, config.params, config.paramsSerializer), true);

    // Set the request timeout in MS
    request.timeout = config.timeout;

    // Listen for ready state
    request.onreadystatechange = function handleLoad() {
      if (!request || request.readyState !== 4) {
        return;
      }

      // The request errored out and we didn't get a response, this will be
      // handled by onerror instead
      // With one exception: request that using file: protocol, most browsers
      // will return status as 0 even though it's a successful request
      if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
        return;
      }

      // Prepare the response
      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
      var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response;
      var response = {
        data: responseData,
        status: request.status,
        statusText: request.statusText,
        headers: responseHeaders,
        config: config,
        request: request
      };

      settle(resolve, reject, response);

      // Clean up request
      request = null;
    };

    // Handle browser request cancellation (as opposed to a manual cancellation)
    request.onabort = function handleAbort() {
      if (!request) {
        return;
      }

      reject(createError('Request aborted', config, 'ECONNABORTED', request));

      // Clean up request
      request = null;
    };

    // Handle low level network errors
    request.onerror = function handleError() {
      // Real errors are hidden from us by the browser
      // onerror should only fire if it's a network error
      reject(createError('Network Error', config, null, request));

      // Clean up request
      request = null;
    };

    // Handle timeout
    request.ontimeout = function handleTimeout() {
      reject(createError('timeout of ' + config.timeout + 'ms exceeded', config, 'ECONNABORTED',
        request));

      // Clean up request
      request = null;
    };

    // Add xsrf header
    // This is only done if running in a standard browser environment.
    // Specifically not if we're in a web worker, or react-native.
    if (utils.isStandardBrowserEnv()) {
      var cookies = require('./../helpers/cookies');

      // Add xsrf header
      var xsrfValue = (config.withCredentials || isURLSameOrigin(config.url)) && config.xsrfCookieName ?
        cookies.read(config.xsrfCookieName) :
        undefined;

      if (xsrfValue) {
        requestHeaders[config.xsrfHeaderName] = xsrfValue;
      }
    }

    // Add headers to the request
    if ('setRequestHeader' in request) {
      utils.forEach(requestHeaders, function setRequestHeader(val, key) {
        if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
          // Remove Content-Type if data is undefined
          delete requestHeaders[key];
        } else {
          // Otherwise add header to the request
          request.setRequestHeader(key, val);
        }
      });
    }

    // Add withCredentials to request if needed
    if (config.withCredentials) {
      request.withCredentials = true;
    }

    // Add responseType to request if needed
    if (config.responseType) {
      try {
        request.responseType = config.responseType;
      } catch (e) {
        // Expected DOMException thrown by browsers not compatible XMLHttpRequest Level 2.
        // But, this can be suppressed for 'json' type as it can be parsed by default 'transformResponse' function.
        if (config.responseType !== 'json') {
          throw e;
        }
      }
    }

    // Handle progress if needed
    if (typeof config.onDownloadProgress === 'function') {
      request.addEventListener('progress', config.onDownloadProgress);
    }

    // Not all browsers support upload events
    if (typeof config.onUploadProgress === 'function' && request.upload) {
      request.upload.addEventListener('progress', config.onUploadProgress);
    }

    if (config.cancelToken) {
      // Handle cancellation
      config.cancelToken.promise.then(function onCanceled(cancel) {
        if (!request) {
          return;
        }

        request.abort();
        reject(cancel);
        // Clean up request
        request = null;
      });
    }

    if (requestData === undefined) {
      requestData = null;
    }

    // Send the request
    request.send(requestData);
  });
};

},{"../core/createError":56,"./../core/settle":60,"./../helpers/buildURL":64,"./../helpers/cookies":66,"./../helpers/isURLSameOrigin":68,"./../helpers/parseHeaders":70,"./../utils":72}],50:[function(require,module,exports){
'use strict';

var utils = require('./utils');
var bind = require('./helpers/bind');
var Axios = require('./core/Axios');
var mergeConfig = require('./core/mergeConfig');
var defaults = require('./defaults');

/**
 * Create an instance of Axios
 *
 * @param {Object} defaultConfig The default config for the instance
 * @return {Axios} A new instance of Axios
 */
function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig);
  var instance = bind(Axios.prototype.request, context);

  // Copy axios.prototype to instance
  utils.extend(instance, Axios.prototype, context);

  // Copy context to instance
  utils.extend(instance, context);

  return instance;
}

// Create the default instance to be exported
var axios = createInstance(defaults);

// Expose Axios class to allow class inheritance
axios.Axios = Axios;

// Factory for creating new instances
axios.create = function create(instanceConfig) {
  return createInstance(mergeConfig(axios.defaults, instanceConfig));
};

// Expose Cancel & CancelToken
axios.Cancel = require('./cancel/Cancel');
axios.CancelToken = require('./cancel/CancelToken');
axios.isCancel = require('./cancel/isCancel');

// Expose all/spread
axios.all = function all(promises) {
  return Promise.all(promises);
};
axios.spread = require('./helpers/spread');

module.exports = axios;

// Allow use of default import syntax in TypeScript
module.exports.default = axios;

},{"./cancel/Cancel":51,"./cancel/CancelToken":52,"./cancel/isCancel":53,"./core/Axios":54,"./core/mergeConfig":59,"./defaults":62,"./helpers/bind":63,"./helpers/spread":71,"./utils":72}],51:[function(require,module,exports){
'use strict';

/**
 * A `Cancel` is an object that is thrown when an operation is canceled.
 *
 * @class
 * @param {string=} message The message.
 */
function Cancel(message) {
  this.message = message;
}

Cancel.prototype.toString = function toString() {
  return 'Cancel' + (this.message ? ': ' + this.message : '');
};

Cancel.prototype.__CANCEL__ = true;

module.exports = Cancel;

},{}],52:[function(require,module,exports){
'use strict';

var Cancel = require('./Cancel');

/**
 * A `CancelToken` is an object that can be used to request cancellation of an operation.
 *
 * @class
 * @param {Function} executor The executor function.
 */
function CancelToken(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError('executor must be a function.');
  }

  var resolvePromise;
  this.promise = new Promise(function promiseExecutor(resolve) {
    resolvePromise = resolve;
  });

  var token = this;
  executor(function cancel(message) {
    if (token.reason) {
      // Cancellation has already been requested
      return;
    }

    token.reason = new Cancel(message);
    resolvePromise(token.reason);
  });
}

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
CancelToken.prototype.throwIfRequested = function throwIfRequested() {
  if (this.reason) {
    throw this.reason;
  }
};

/**
 * Returns an object that contains a new `CancelToken` and a function that, when called,
 * cancels the `CancelToken`.
 */
CancelToken.source = function source() {
  var cancel;
  var token = new CancelToken(function executor(c) {
    cancel = c;
  });
  return {
    token: token,
    cancel: cancel
  };
};

module.exports = CancelToken;

},{"./Cancel":51}],53:[function(require,module,exports){
'use strict';

module.exports = function isCancel(value) {
  return !!(value && value.__CANCEL__);
};

},{}],54:[function(require,module,exports){
'use strict';

var utils = require('./../utils');
var buildURL = require('../helpers/buildURL');
var InterceptorManager = require('./InterceptorManager');
var dispatchRequest = require('./dispatchRequest');
var mergeConfig = require('./mergeConfig');

/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 */
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}

/**
 * Dispatch a request
 *
 * @param {Object} config The config specific for this request (merged with this.defaults)
 */
Axios.prototype.request = function request(config) {
  /*eslint no-param-reassign:0*/
  // Allow for axios('example/url'[, config]) a la fetch API
  if (typeof config === 'string') {
    config = arguments[1] || {};
    config.url = arguments[0];
  } else {
    config = config || {};
  }

  config = mergeConfig(this.defaults, config);
  config.method = config.method ? config.method.toLowerCase() : 'get';

  // Hook up interceptors middleware
  var chain = [dispatchRequest, undefined];
  var promise = Promise.resolve(config);

  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    chain.unshift(interceptor.fulfilled, interceptor.rejected);
  });

  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    chain.push(interceptor.fulfilled, interceptor.rejected);
  });

  while (chain.length) {
    promise = promise.then(chain.shift(), chain.shift());
  }

  return promise;
};

Axios.prototype.getUri = function getUri(config) {
  config = mergeConfig(this.defaults, config);
  return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
};

// Provide aliases for supported request methods
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url
    }));
  };
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, data, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
});

module.exports = Axios;

},{"../helpers/buildURL":64,"./../utils":72,"./InterceptorManager":55,"./dispatchRequest":57,"./mergeConfig":59}],55:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

function InterceptorManager() {
  this.handlers = [];
}

/**
 * Add a new interceptor to the stack
 *
 * @param {Function} fulfilled The function to handle `then` for a `Promise`
 * @param {Function} rejected The function to handle `reject` for a `Promise`
 *
 * @return {Number} An ID used to remove interceptor later
 */
InterceptorManager.prototype.use = function use(fulfilled, rejected) {
  this.handlers.push({
    fulfilled: fulfilled,
    rejected: rejected
  });
  return this.handlers.length - 1;
};

/**
 * Remove an interceptor from the stack
 *
 * @param {Number} id The ID that was returned by `use`
 */
InterceptorManager.prototype.eject = function eject(id) {
  if (this.handlers[id]) {
    this.handlers[id] = null;
  }
};

/**
 * Iterate over all the registered interceptors
 *
 * This method is particularly useful for skipping over any
 * interceptors that may have become `null` calling `eject`.
 *
 * @param {Function} fn The function to call for each interceptor
 */
InterceptorManager.prototype.forEach = function forEach(fn) {
  utils.forEach(this.handlers, function forEachHandler(h) {
    if (h !== null) {
      fn(h);
    }
  });
};

module.exports = InterceptorManager;

},{"./../utils":72}],56:[function(require,module,exports){
'use strict';

var enhanceError = require('./enhanceError');

/**
 * Create an Error with the specified message, config, error code, request and response.
 *
 * @param {string} message The error message.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The created error.
 */
module.exports = function createError(message, config, code, request, response) {
  var error = new Error(message);
  return enhanceError(error, config, code, request, response);
};

},{"./enhanceError":58}],57:[function(require,module,exports){
'use strict';

var utils = require('./../utils');
var transformData = require('./transformData');
var isCancel = require('../cancel/isCancel');
var defaults = require('../defaults');
var isAbsoluteURL = require('./../helpers/isAbsoluteURL');
var combineURLs = require('./../helpers/combineURLs');

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
function throwIfCancellationRequested(config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }
}

/**
 * Dispatch a request to the server using the configured adapter.
 *
 * @param {object} config The config that is to be used for the request
 * @returns {Promise} The Promise to be fulfilled
 */
module.exports = function dispatchRequest(config) {
  throwIfCancellationRequested(config);

  // Support baseURL config
  if (config.baseURL && !isAbsoluteURL(config.url)) {
    config.url = combineURLs(config.baseURL, config.url);
  }

  // Ensure headers exist
  config.headers = config.headers || {};

  // Transform request data
  config.data = transformData(
    config.data,
    config.headers,
    config.transformRequest
  );

  // Flatten headers
  config.headers = utils.merge(
    config.headers.common || {},
    config.headers[config.method] || {},
    config.headers || {}
  );

  utils.forEach(
    ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
    function cleanHeaderConfig(method) {
      delete config.headers[method];
    }
  );

  var adapter = config.adapter || defaults.adapter;

  return adapter(config).then(function onAdapterResolution(response) {
    throwIfCancellationRequested(config);

    // Transform response data
    response.data = transformData(
      response.data,
      response.headers,
      config.transformResponse
    );

    return response;
  }, function onAdapterRejection(reason) {
    if (!isCancel(reason)) {
      throwIfCancellationRequested(config);

      // Transform response data
      if (reason && reason.response) {
        reason.response.data = transformData(
          reason.response.data,
          reason.response.headers,
          config.transformResponse
        );
      }
    }

    return Promise.reject(reason);
  });
};

},{"../cancel/isCancel":53,"../defaults":62,"./../helpers/combineURLs":65,"./../helpers/isAbsoluteURL":67,"./../utils":72,"./transformData":61}],58:[function(require,module,exports){
'use strict';

/**
 * Update an Error with the specified config, error code, and response.
 *
 * @param {Error} error The error to update.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The error.
 */
module.exports = function enhanceError(error, config, code, request, response) {
  error.config = config;
  if (code) {
    error.code = code;
  }

  error.request = request;
  error.response = response;
  error.isAxiosError = true;

  error.toJSON = function() {
    return {
      // Standard
      message: this.message,
      name: this.name,
      // Microsoft
      description: this.description,
      number: this.number,
      // Mozilla
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
      stack: this.stack,
      // Axios
      config: this.config,
      code: this.code
    };
  };
  return error;
};

},{}],59:[function(require,module,exports){
'use strict';

var utils = require('../utils');

/**
 * Config-specific merge-function which creates a new config-object
 * by merging two configuration objects together.
 *
 * @param {Object} config1
 * @param {Object} config2
 * @returns {Object} New object resulting from merging config2 to config1
 */
module.exports = function mergeConfig(config1, config2) {
  // eslint-disable-next-line no-param-reassign
  config2 = config2 || {};
  var config = {};

  utils.forEach(['url', 'method', 'params', 'data'], function valueFromConfig2(prop) {
    if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];
    }
  });

  utils.forEach(['headers', 'auth', 'proxy'], function mergeDeepProperties(prop) {
    if (utils.isObject(config2[prop])) {
      config[prop] = utils.deepMerge(config1[prop], config2[prop]);
    } else if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];
    } else if (utils.isObject(config1[prop])) {
      config[prop] = utils.deepMerge(config1[prop]);
    } else if (typeof config1[prop] !== 'undefined') {
      config[prop] = config1[prop];
    }
  });

  utils.forEach([
    'baseURL', 'transformRequest', 'transformResponse', 'paramsSerializer',
    'timeout', 'withCredentials', 'adapter', 'responseType', 'xsrfCookieName',
    'xsrfHeaderName', 'onUploadProgress', 'onDownloadProgress', 'maxContentLength',
    'validateStatus', 'maxRedirects', 'httpAgent', 'httpsAgent', 'cancelToken',
    'socketPath'
  ], function defaultToConfig2(prop) {
    if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];
    } else if (typeof config1[prop] !== 'undefined') {
      config[prop] = config1[prop];
    }
  });

  return config;
};

},{"../utils":72}],60:[function(require,module,exports){
'use strict';

var createError = require('./createError');

/**
 * Resolve or reject a Promise based on response status.
 *
 * @param {Function} resolve A function that resolves the promise.
 * @param {Function} reject A function that rejects the promise.
 * @param {object} response The response.
 */
module.exports = function settle(resolve, reject, response) {
  var validateStatus = response.config.validateStatus;
  if (!validateStatus || validateStatus(response.status)) {
    resolve(response);
  } else {
    reject(createError(
      'Request failed with status code ' + response.status,
      response.config,
      null,
      response.request,
      response
    ));
  }
};

},{"./createError":56}],61:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

/**
 * Transform the data for a request or a response
 *
 * @param {Object|String} data The data to be transformed
 * @param {Array} headers The headers for the request or response
 * @param {Array|Function} fns A single function or Array of functions
 * @returns {*} The resulting transformed data
 */
module.exports = function transformData(data, headers, fns) {
  /*eslint no-param-reassign:0*/
  utils.forEach(fns, function transform(fn) {
    data = fn(data, headers);
  });

  return data;
};

},{"./../utils":72}],62:[function(require,module,exports){
(function (process){
'use strict';

var utils = require('./utils');
var normalizeHeaderName = require('./helpers/normalizeHeaderName');

var DEFAULT_CONTENT_TYPE = {
  'Content-Type': 'application/x-www-form-urlencoded'
};

function setContentTypeIfUnset(headers, value) {
  if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
    headers['Content-Type'] = value;
  }
}

function getDefaultAdapter() {
  var adapter;
  // Only Node.JS has a process variable that is of [[Class]] process
  if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
    // For node use HTTP adapter
    adapter = require('./adapters/http');
  } else if (typeof XMLHttpRequest !== 'undefined') {
    // For browsers use XHR adapter
    adapter = require('./adapters/xhr');
  }
  return adapter;
}

var defaults = {
  adapter: getDefaultAdapter(),

  transformRequest: [function transformRequest(data, headers) {
    normalizeHeaderName(headers, 'Accept');
    normalizeHeaderName(headers, 'Content-Type');
    if (utils.isFormData(data) ||
      utils.isArrayBuffer(data) ||
      utils.isBuffer(data) ||
      utils.isStream(data) ||
      utils.isFile(data) ||
      utils.isBlob(data)
    ) {
      return data;
    }
    if (utils.isArrayBufferView(data)) {
      return data.buffer;
    }
    if (utils.isURLSearchParams(data)) {
      setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
      return data.toString();
    }
    if (utils.isObject(data)) {
      setContentTypeIfUnset(headers, 'application/json;charset=utf-8');
      return JSON.stringify(data);
    }
    return data;
  }],

  transformResponse: [function transformResponse(data) {
    /*eslint no-param-reassign:0*/
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) { /* Ignore */ }
    }
    return data;
  }],

  /**
   * A timeout in milliseconds to abort a request. If set to 0 (default) a
   * timeout is not created.
   */
  timeout: 0,

  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',

  maxContentLength: -1,

  validateStatus: function validateStatus(status) {
    return status >= 200 && status < 300;
  }
};

defaults.headers = {
  common: {
    'Accept': 'application/json, text/plain, */*'
  }
};

utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
  defaults.headers[method] = {};
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
});

module.exports = defaults;

}).call(this,require('_process'))
},{"./adapters/http":49,"./adapters/xhr":49,"./helpers/normalizeHeaderName":69,"./utils":72,"_process":75}],63:[function(require,module,exports){
'use strict';

module.exports = function bind(fn, thisArg) {
  return function wrap() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return fn.apply(thisArg, args);
  };
};

},{}],64:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

function encode(val) {
  return encodeURIComponent(val).
    replace(/%40/gi, '@').
    replace(/%3A/gi, ':').
    replace(/%24/g, '$').
    replace(/%2C/gi, ',').
    replace(/%20/g, '+').
    replace(/%5B/gi, '[').
    replace(/%5D/gi, ']');
}

/**
 * Build a URL by appending params to the end
 *
 * @param {string} url The base of the url (e.g., http://www.google.com)
 * @param {object} [params] The params to be appended
 * @returns {string} The formatted url
 */
module.exports = function buildURL(url, params, paramsSerializer) {
  /*eslint no-param-reassign:0*/
  if (!params) {
    return url;
  }

  var serializedParams;
  if (paramsSerializer) {
    serializedParams = paramsSerializer(params);
  } else if (utils.isURLSearchParams(params)) {
    serializedParams = params.toString();
  } else {
    var parts = [];

    utils.forEach(params, function serialize(val, key) {
      if (val === null || typeof val === 'undefined') {
        return;
      }

      if (utils.isArray(val)) {
        key = key + '[]';
      } else {
        val = [val];
      }

      utils.forEach(val, function parseValue(v) {
        if (utils.isDate(v)) {
          v = v.toISOString();
        } else if (utils.isObject(v)) {
          v = JSON.stringify(v);
        }
        parts.push(encode(key) + '=' + encode(v));
      });
    });

    serializedParams = parts.join('&');
  }

  if (serializedParams) {
    var hashmarkIndex = url.indexOf('#');
    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex);
    }

    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
};

},{"./../utils":72}],65:[function(require,module,exports){
'use strict';

/**
 * Creates a new URL by combining the specified URLs
 *
 * @param {string} baseURL The base URL
 * @param {string} relativeURL The relative URL
 * @returns {string} The combined URL
 */
module.exports = function combineURLs(baseURL, relativeURL) {
  return relativeURL
    ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
    : baseURL;
};

},{}],66:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs support document.cookie
    (function standardBrowserEnv() {
      return {
        write: function write(name, value, expires, path, domain, secure) {
          var cookie = [];
          cookie.push(name + '=' + encodeURIComponent(value));

          if (utils.isNumber(expires)) {
            cookie.push('expires=' + new Date(expires).toGMTString());
          }

          if (utils.isString(path)) {
            cookie.push('path=' + path);
          }

          if (utils.isString(domain)) {
            cookie.push('domain=' + domain);
          }

          if (secure === true) {
            cookie.push('secure');
          }

          document.cookie = cookie.join('; ');
        },

        read: function read(name) {
          var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
          return (match ? decodeURIComponent(match[3]) : null);
        },

        remove: function remove(name) {
          this.write(name, '', Date.now() - 86400000);
        }
      };
    })() :

  // Non standard browser env (web workers, react-native) lack needed support.
    (function nonStandardBrowserEnv() {
      return {
        write: function write() {},
        read: function read() { return null; },
        remove: function remove() {}
      };
    })()
);

},{"./../utils":72}],67:[function(require,module,exports){
'use strict';

/**
 * Determines whether the specified URL is absolute
 *
 * @param {string} url The URL to test
 * @returns {boolean} True if the specified URL is absolute, otherwise false
 */
module.exports = function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
};

},{}],68:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs have full support of the APIs needed to test
  // whether the request URL is of the same origin as current location.
    (function standardBrowserEnv() {
      var msie = /(msie|trident)/i.test(navigator.userAgent);
      var urlParsingNode = document.createElement('a');
      var originURL;

      /**
    * Parse a URL to discover it's components
    *
    * @param {String} url The URL to be parsed
    * @returns {Object}
    */
      function resolveURL(url) {
        var href = url;

        if (msie) {
        // IE needs attribute set twice to normalize properties
          urlParsingNode.setAttribute('href', href);
          href = urlParsingNode.href;
        }

        urlParsingNode.setAttribute('href', href);

        // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
        return {
          href: urlParsingNode.href,
          protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
          host: urlParsingNode.host,
          search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
          hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
          hostname: urlParsingNode.hostname,
          port: urlParsingNode.port,
          pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
            urlParsingNode.pathname :
            '/' + urlParsingNode.pathname
        };
      }

      originURL = resolveURL(window.location.href);

      /**
    * Determine if a URL shares the same origin as the current location
    *
    * @param {String} requestURL The URL to test
    * @returns {boolean} True if URL shares the same origin, otherwise false
    */
      return function isURLSameOrigin(requestURL) {
        var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
        return (parsed.protocol === originURL.protocol &&
            parsed.host === originURL.host);
      };
    })() :

  // Non standard browser envs (web workers, react-native) lack needed support.
    (function nonStandardBrowserEnv() {
      return function isURLSameOrigin() {
        return true;
      };
    })()
);

},{"./../utils":72}],69:[function(require,module,exports){
'use strict';

var utils = require('../utils');

module.exports = function normalizeHeaderName(headers, normalizedName) {
  utils.forEach(headers, function processHeader(value, name) {
    if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
      headers[normalizedName] = value;
      delete headers[name];
    }
  });
};

},{"../utils":72}],70:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

// Headers whose duplicates are ignored by node
// c.f. https://nodejs.org/api/http.html#http_message_headers
var ignoreDuplicateOf = [
  'age', 'authorization', 'content-length', 'content-type', 'etag',
  'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
  'last-modified', 'location', 'max-forwards', 'proxy-authorization',
  'referer', 'retry-after', 'user-agent'
];

/**
 * Parse headers into an object
 *
 * ```
 * Date: Wed, 27 Aug 2014 08:58:49 GMT
 * Content-Type: application/json
 * Connection: keep-alive
 * Transfer-Encoding: chunked
 * ```
 *
 * @param {String} headers Headers needing to be parsed
 * @returns {Object} Headers parsed into an object
 */
module.exports = function parseHeaders(headers) {
  var parsed = {};
  var key;
  var val;
  var i;

  if (!headers) { return parsed; }

  utils.forEach(headers.split('\n'), function parser(line) {
    i = line.indexOf(':');
    key = utils.trim(line.substr(0, i)).toLowerCase();
    val = utils.trim(line.substr(i + 1));

    if (key) {
      if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
        return;
      }
      if (key === 'set-cookie') {
        parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
      } else {
        parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
      }
    }
  });

  return parsed;
};

},{"./../utils":72}],71:[function(require,module,exports){
'use strict';

/**
 * Syntactic sugar for invoking a function and expanding an array for arguments.
 *
 * Common use case would be to use `Function.prototype.apply`.
 *
 *  ```js
 *  function f(x, y, z) {}
 *  var args = [1, 2, 3];
 *  f.apply(null, args);
 *  ```
 *
 * With `spread` this example can be re-written.
 *
 *  ```js
 *  spread(function(x, y, z) {})([1, 2, 3]);
 *  ```
 *
 * @param {Function} callback
 * @returns {Function}
 */
module.exports = function spread(callback) {
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
};

},{}],72:[function(require,module,exports){
'use strict';

var bind = require('./helpers/bind');
var isBuffer = require('is-buffer');

/*global toString:true*/

// utils is a library of generic helper functions non-specific to axios

var toString = Object.prototype.toString;

/**
 * Determine if a value is an Array
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Array, otherwise false
 */
function isArray(val) {
  return toString.call(val) === '[object Array]';
}

/**
 * Determine if a value is an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an ArrayBuffer, otherwise false
 */
function isArrayBuffer(val) {
  return toString.call(val) === '[object ArrayBuffer]';
}

/**
 * Determine if a value is a FormData
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an FormData, otherwise false
 */
function isFormData(val) {
  return (typeof FormData !== 'undefined') && (val instanceof FormData);
}

/**
 * Determine if a value is a view on an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
 */
function isArrayBufferView(val) {
  var result;
  if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
    result = ArrayBuffer.isView(val);
  } else {
    result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
  }
  return result;
}

/**
 * Determine if a value is a String
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a String, otherwise false
 */
function isString(val) {
  return typeof val === 'string';
}

/**
 * Determine if a value is a Number
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Number, otherwise false
 */
function isNumber(val) {
  return typeof val === 'number';
}

/**
 * Determine if a value is undefined
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if the value is undefined, otherwise false
 */
function isUndefined(val) {
  return typeof val === 'undefined';
}

/**
 * Determine if a value is an Object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Object, otherwise false
 */
function isObject(val) {
  return val !== null && typeof val === 'object';
}

/**
 * Determine if a value is a Date
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Date, otherwise false
 */
function isDate(val) {
  return toString.call(val) === '[object Date]';
}

/**
 * Determine if a value is a File
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a File, otherwise false
 */
function isFile(val) {
  return toString.call(val) === '[object File]';
}

/**
 * Determine if a value is a Blob
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Blob, otherwise false
 */
function isBlob(val) {
  return toString.call(val) === '[object Blob]';
}

/**
 * Determine if a value is a Function
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Function, otherwise false
 */
function isFunction(val) {
  return toString.call(val) === '[object Function]';
}

/**
 * Determine if a value is a Stream
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Stream, otherwise false
 */
function isStream(val) {
  return isObject(val) && isFunction(val.pipe);
}

/**
 * Determine if a value is a URLSearchParams object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a URLSearchParams object, otherwise false
 */
function isURLSearchParams(val) {
  return typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
}

/**
 * Trim excess whitespace off the beginning and end of a string
 *
 * @param {String} str The String to trim
 * @returns {String} The String freed of excess whitespace
 */
function trim(str) {
  return str.replace(/^\s*/, '').replace(/\s*$/, '');
}

/**
 * Determine if we're running in a standard browser environment
 *
 * This allows axios to run in a web worker, and react-native.
 * Both environments support XMLHttpRequest, but not fully standard globals.
 *
 * web workers:
 *  typeof window -> undefined
 *  typeof document -> undefined
 *
 * react-native:
 *  navigator.product -> 'ReactNative'
 * nativescript
 *  navigator.product -> 'NativeScript' or 'NS'
 */
function isStandardBrowserEnv() {
  if (typeof navigator !== 'undefined' && (navigator.product === 'ReactNative' ||
                                           navigator.product === 'NativeScript' ||
                                           navigator.product === 'NS')) {
    return false;
  }
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined'
  );
}

/**
 * Iterate over an Array or an Object invoking a function for each item.
 *
 * If `obj` is an Array callback will be called passing
 * the value, index, and complete array for each item.
 *
 * If 'obj' is an Object callback will be called passing
 * the value, key, and complete object for each property.
 *
 * @param {Object|Array} obj The object to iterate
 * @param {Function} fn The callback to invoke for each item
 */
function forEach(obj, fn) {
  // Don't bother if no value provided
  if (obj === null || typeof obj === 'undefined') {
    return;
  }

  // Force an array if not already something iterable
  if (typeof obj !== 'object') {
    /*eslint no-param-reassign:0*/
    obj = [obj];
  }

  if (isArray(obj)) {
    // Iterate over array values
    for (var i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    // Iterate over object keys
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        fn.call(null, obj[key], key, obj);
      }
    }
  }
}

/**
 * Accepts varargs expecting each argument to be an object, then
 * immutably merges the properties of each object and returns result.
 *
 * When multiple objects contain the same key the later object in
 * the arguments list will take precedence.
 *
 * Example:
 *
 * ```js
 * var result = merge({foo: 123}, {foo: 456});
 * console.log(result.foo); // outputs 456
 * ```
 *
 * @param {Object} obj1 Object to merge
 * @returns {Object} Result of all merge properties
 */
function merge(/* obj1, obj2, obj3, ... */) {
  var result = {};
  function assignValue(val, key) {
    if (typeof result[key] === 'object' && typeof val === 'object') {
      result[key] = merge(result[key], val);
    } else {
      result[key] = val;
    }
  }

  for (var i = 0, l = arguments.length; i < l; i++) {
    forEach(arguments[i], assignValue);
  }
  return result;
}

/**
 * Function equal to merge with the difference being that no reference
 * to original objects is kept.
 *
 * @see merge
 * @param {Object} obj1 Object to merge
 * @returns {Object} Result of all merge properties
 */
function deepMerge(/* obj1, obj2, obj3, ... */) {
  var result = {};
  function assignValue(val, key) {
    if (typeof result[key] === 'object' && typeof val === 'object') {
      result[key] = deepMerge(result[key], val);
    } else if (typeof val === 'object') {
      result[key] = deepMerge({}, val);
    } else {
      result[key] = val;
    }
  }

  for (var i = 0, l = arguments.length; i < l; i++) {
    forEach(arguments[i], assignValue);
  }
  return result;
}

/**
 * Extends object a by mutably adding to it the properties of object b.
 *
 * @param {Object} a The object to be extended
 * @param {Object} b The object to copy properties from
 * @param {Object} thisArg The object to bind function to
 * @return {Object} The resulting value of object a
 */
function extend(a, b, thisArg) {
  forEach(b, function assignValue(val, key) {
    if (thisArg && typeof val === 'function') {
      a[key] = bind(val, thisArg);
    } else {
      a[key] = val;
    }
  });
  return a;
}

module.exports = {
  isArray: isArray,
  isArrayBuffer: isArrayBuffer,
  isBuffer: isBuffer,
  isFormData: isFormData,
  isArrayBufferView: isArrayBufferView,
  isString: isString,
  isNumber: isNumber,
  isObject: isObject,
  isUndefined: isUndefined,
  isDate: isDate,
  isFile: isFile,
  isBlob: isBlob,
  isFunction: isFunction,
  isStream: isStream,
  isURLSearchParams: isURLSearchParams,
  isStandardBrowserEnv: isStandardBrowserEnv,
  forEach: forEach,
  merge: merge,
  deepMerge: deepMerge,
  extend: extend,
  trim: trim
};

},{"./helpers/bind":63,"is-buffer":73}],73:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

module.exports = function isBuffer (obj) {
  return obj != null && obj.constructor != null &&
    typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

},{}],74:[function(require,module,exports){
/**
 * lodash 3.0.2 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var numberTag = '[object Number]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is `NaN`.
 *
 * **Note:** This method is not the same as [`isNaN`](https://es5.github.io/#x15.1.2.4)
 * which returns `true` for `undefined` and other non-numeric values.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is `NaN`, else `false`.
 * @example
 *
 * _.isNaN(NaN);
 * // => true
 *
 * _.isNaN(new Number(NaN));
 * // => true
 *
 * isNaN(undefined);
 * // => true
 *
 * _.isNaN(undefined);
 * // => false
 */
function isNaN(value) {
  // An `NaN` primitive is the only value that is not equal to itself.
  // Perform the `toStringTag` check first to avoid errors with some ActiveX objects in IE.
  return isNumber(value) && value != +value;
}

/**
 * Checks if `value` is classified as a `Number` primitive or object.
 *
 * **Note:** To exclude `Infinity`, `-Infinity`, and `NaN`, which are classified
 * as numbers, use the `_.isFinite` method.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isNumber(3);
 * // => true
 *
 * _.isNumber(Number.MIN_VALUE);
 * // => true
 *
 * _.isNumber(Infinity);
 * // => true
 *
 * _.isNumber('3');
 * // => false
 */
function isNumber(value) {
  return typeof value == 'number' ||
    (isObjectLike(value) && objectToString.call(value) == numberTag);
}

module.exports = isNaN;

},{}],75:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],76:[function(require,module,exports){
function DOMParser(options){
	this.options = options ||{locator:{}};
	
}
DOMParser.prototype.parseFromString = function(source,mimeType){
	var options = this.options;
	var sax =  new XMLReader();
	var domBuilder = options.domBuilder || new DOMHandler();//contentHandler and LexicalHandler
	var errorHandler = options.errorHandler;
	var locator = options.locator;
	var defaultNSMap = options.xmlns||{};
	var entityMap = {'lt':'<','gt':'>','amp':'&','quot':'"','apos':"'"}
	if(locator){
		domBuilder.setDocumentLocator(locator)
	}
	
	sax.errorHandler = buildErrorHandler(errorHandler,domBuilder,locator);
	sax.domBuilder = options.domBuilder || domBuilder;
	if(/\/x?html?$/.test(mimeType)){
		entityMap.nbsp = '\xa0';
		entityMap.copy = '\xa9';
		defaultNSMap['']= 'http://www.w3.org/1999/xhtml';
	}
	defaultNSMap.xml = defaultNSMap.xml || 'http://www.w3.org/XML/1998/namespace';
	if(source){
		sax.parse(source,defaultNSMap,entityMap);
	}else{
		sax.errorHandler.error("invalid doc source");
	}
	return domBuilder.doc;
}
function buildErrorHandler(errorImpl,domBuilder,locator){
	if(!errorImpl){
		if(domBuilder instanceof DOMHandler){
			return domBuilder;
		}
		errorImpl = domBuilder ;
	}
	var errorHandler = {}
	var isCallback = errorImpl instanceof Function;
	locator = locator||{}
	function build(key){
		var fn = errorImpl[key];
		if(!fn && isCallback){
			fn = errorImpl.length == 2?function(msg){errorImpl(key,msg)}:errorImpl;
		}
		errorHandler[key] = fn && function(msg){
			fn('[xmldom '+key+']\t'+msg+_locator(locator));
		}||function(){};
	}
	build('warning');
	build('error');
	build('fatalError');
	return errorHandler;
}

//console.log('#\n\n\n\n\n\n\n####')
/**
 * +ContentHandler+ErrorHandler
 * +LexicalHandler+EntityResolver2
 * -DeclHandler-DTDHandler 
 * 
 * DefaultHandler:EntityResolver, DTDHandler, ContentHandler, ErrorHandler
 * DefaultHandler2:DefaultHandler,LexicalHandler, DeclHandler, EntityResolver2
 * @link http://www.saxproject.org/apidoc/org/xml/sax/helpers/DefaultHandler.html
 */
function DOMHandler() {
    this.cdata = false;
}
function position(locator,node){
	node.lineNumber = locator.lineNumber;
	node.columnNumber = locator.columnNumber;
}
/**
 * @see org.xml.sax.ContentHandler#startDocument
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ContentHandler.html
 */ 
DOMHandler.prototype = {
	startDocument : function() {
    	this.doc = new DOMImplementation().createDocument(null, null, null);
    	if (this.locator) {
        	this.doc.documentURI = this.locator.systemId;
    	}
	},
	startElement:function(namespaceURI, localName, qName, attrs) {
		var doc = this.doc;
	    var el = doc.createElementNS(namespaceURI, qName||localName);
	    var len = attrs.length;
	    appendElement(this, el);
	    this.currentElement = el;
	    
		this.locator && position(this.locator,el)
	    for (var i = 0 ; i < len; i++) {
	        var namespaceURI = attrs.getURI(i);
	        var value = attrs.getValue(i);
	        var qName = attrs.getQName(i);
			var attr = doc.createAttributeNS(namespaceURI, qName);
			this.locator &&position(attrs.getLocator(i),attr);
			attr.value = attr.nodeValue = value;
			el.setAttributeNode(attr)
	    }
	},
	endElement:function(namespaceURI, localName, qName) {
		var current = this.currentElement
		var tagName = current.tagName;
		this.currentElement = current.parentNode;
	},
	startPrefixMapping:function(prefix, uri) {
	},
	endPrefixMapping:function(prefix) {
	},
	processingInstruction:function(target, data) {
	    var ins = this.doc.createProcessingInstruction(target, data);
	    this.locator && position(this.locator,ins)
	    appendElement(this, ins);
	},
	ignorableWhitespace:function(ch, start, length) {
	},
	characters:function(chars, start, length) {
		chars = _toString.apply(this,arguments)
		//console.log(chars)
		if(chars){
			if (this.cdata) {
				var charNode = this.doc.createCDATASection(chars);
			} else {
				var charNode = this.doc.createTextNode(chars);
			}
			if(this.currentElement){
				this.currentElement.appendChild(charNode);
			}else if(/^\s*$/.test(chars)){
				this.doc.appendChild(charNode);
				//process xml
			}
			this.locator && position(this.locator,charNode)
		}
	},
	skippedEntity:function(name) {
	},
	endDocument:function() {
		this.doc.normalize();
	},
	setDocumentLocator:function (locator) {
	    if(this.locator = locator){// && !('lineNumber' in locator)){
	    	locator.lineNumber = 0;
	    }
	},
	//LexicalHandler
	comment:function(chars, start, length) {
		chars = _toString.apply(this,arguments)
	    var comm = this.doc.createComment(chars);
	    this.locator && position(this.locator,comm)
	    appendElement(this, comm);
	},
	
	startCDATA:function() {
	    //used in characters() methods
	    this.cdata = true;
	},
	endCDATA:function() {
	    this.cdata = false;
	},
	
	startDTD:function(name, publicId, systemId) {
		var impl = this.doc.implementation;
	    if (impl && impl.createDocumentType) {
	        var dt = impl.createDocumentType(name, publicId, systemId);
	        this.locator && position(this.locator,dt)
	        appendElement(this, dt);
	    }
	},
	/**
	 * @see org.xml.sax.ErrorHandler
	 * @link http://www.saxproject.org/apidoc/org/xml/sax/ErrorHandler.html
	 */
	warning:function(error) {
		console.warn('[xmldom warning]\t'+error,_locator(this.locator));
	},
	error:function(error) {
		console.error('[xmldom error]\t'+error,_locator(this.locator));
	},
	fatalError:function(error) {
		console.error('[xmldom fatalError]\t'+error,_locator(this.locator));
	    throw error;
	}
}
function _locator(l){
	if(l){
		return '\n@'+(l.systemId ||'')+'#[line:'+l.lineNumber+',col:'+l.columnNumber+']'
	}
}
function _toString(chars,start,length){
	if(typeof chars == 'string'){
		return chars.substr(start,length)
	}else{//java sax connect width xmldom on rhino(what about: "? && !(chars instanceof String)")
		if(chars.length >= start+length || start){
			return new java.lang.String(chars,start,length)+'';
		}
		return chars;
	}
}

/*
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ext/LexicalHandler.html
 * used method of org.xml.sax.ext.LexicalHandler:
 *  #comment(chars, start, length)
 *  #startCDATA()
 *  #endCDATA()
 *  #startDTD(name, publicId, systemId)
 *
 *
 * IGNORED method of org.xml.sax.ext.LexicalHandler:
 *  #endDTD()
 *  #startEntity(name)
 *  #endEntity(name)
 *
 *
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ext/DeclHandler.html
 * IGNORED method of org.xml.sax.ext.DeclHandler
 * 	#attributeDecl(eName, aName, type, mode, value)
 *  #elementDecl(name, model)
 *  #externalEntityDecl(name, publicId, systemId)
 *  #internalEntityDecl(name, value)
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ext/EntityResolver2.html
 * IGNORED method of org.xml.sax.EntityResolver2
 *  #resolveEntity(String name,String publicId,String baseURI,String systemId)
 *  #resolveEntity(publicId, systemId)
 *  #getExternalSubset(name, baseURI)
 * @link http://www.saxproject.org/apidoc/org/xml/sax/DTDHandler.html
 * IGNORED method of org.xml.sax.DTDHandler
 *  #notationDecl(name, publicId, systemId) {};
 *  #unparsedEntityDecl(name, publicId, systemId, notationName) {};
 */
"endDTD,startEntity,endEntity,attributeDecl,elementDecl,externalEntityDecl,internalEntityDecl,resolveEntity,getExternalSubset,notationDecl,unparsedEntityDecl".replace(/\w+/g,function(key){
	DOMHandler.prototype[key] = function(){return null}
})

/* Private static helpers treated below as private instance methods, so don't need to add these to the public API; we might use a Relator to also get rid of non-standard public properties */
function appendElement (hander,node) {
    if (!hander.currentElement) {
        hander.doc.appendChild(node);
    } else {
        hander.currentElement.appendChild(node);
    }
}//appendChild and setAttributeNS are preformance key

//if(typeof require == 'function'){
	var XMLReader = require('./sax').XMLReader;
	var DOMImplementation = exports.DOMImplementation = require('./dom').DOMImplementation;
	exports.XMLSerializer = require('./dom').XMLSerializer ;
	exports.DOMParser = DOMParser;
//}

},{"./dom":77,"./sax":78}],77:[function(require,module,exports){
/*
 * DOM Level 2
 * Object DOMException
 * @see http://www.w3.org/TR/REC-DOM-Level-1/ecma-script-language-binding.html
 * @see http://www.w3.org/TR/2000/REC-DOM-Level-2-Core-20001113/ecma-script-binding.html
 */

function copy(src,dest){
	for(var p in src){
		dest[p] = src[p];
	}
}
/**
^\w+\.prototype\.([_\w]+)\s*=\s*((?:.*\{\s*?[\r\n][\s\S]*?^})|\S.*?(?=[;\r\n]));?
^\w+\.prototype\.([_\w]+)\s*=\s*(\S.*?(?=[;\r\n]));?
 */
function _extends(Class,Super){
	var pt = Class.prototype;
	if(Object.create){
		var ppt = Object.create(Super.prototype)
		pt.__proto__ = ppt;
	}
	if(!(pt instanceof Super)){
		function t(){};
		t.prototype = Super.prototype;
		t = new t();
		copy(pt,t);
		Class.prototype = pt = t;
	}
	if(pt.constructor != Class){
		if(typeof Class != 'function'){
			console.error("unknow Class:"+Class)
		}
		pt.constructor = Class
	}
}
var htmlns = 'http://www.w3.org/1999/xhtml' ;
// Node Types
var NodeType = {}
var ELEMENT_NODE                = NodeType.ELEMENT_NODE                = 1;
var ATTRIBUTE_NODE              = NodeType.ATTRIBUTE_NODE              = 2;
var TEXT_NODE                   = NodeType.TEXT_NODE                   = 3;
var CDATA_SECTION_NODE          = NodeType.CDATA_SECTION_NODE          = 4;
var ENTITY_REFERENCE_NODE       = NodeType.ENTITY_REFERENCE_NODE       = 5;
var ENTITY_NODE                 = NodeType.ENTITY_NODE                 = 6;
var PROCESSING_INSTRUCTION_NODE = NodeType.PROCESSING_INSTRUCTION_NODE = 7;
var COMMENT_NODE                = NodeType.COMMENT_NODE                = 8;
var DOCUMENT_NODE               = NodeType.DOCUMENT_NODE               = 9;
var DOCUMENT_TYPE_NODE          = NodeType.DOCUMENT_TYPE_NODE          = 10;
var DOCUMENT_FRAGMENT_NODE      = NodeType.DOCUMENT_FRAGMENT_NODE      = 11;
var NOTATION_NODE               = NodeType.NOTATION_NODE               = 12;

// ExceptionCode
var ExceptionCode = {}
var ExceptionMessage = {};
var INDEX_SIZE_ERR              = ExceptionCode.INDEX_SIZE_ERR              = ((ExceptionMessage[1]="Index size error"),1);
var DOMSTRING_SIZE_ERR          = ExceptionCode.DOMSTRING_SIZE_ERR          = ((ExceptionMessage[2]="DOMString size error"),2);
var HIERARCHY_REQUEST_ERR       = ExceptionCode.HIERARCHY_REQUEST_ERR       = ((ExceptionMessage[3]="Hierarchy request error"),3);
var WRONG_DOCUMENT_ERR          = ExceptionCode.WRONG_DOCUMENT_ERR          = ((ExceptionMessage[4]="Wrong document"),4);
var INVALID_CHARACTER_ERR       = ExceptionCode.INVALID_CHARACTER_ERR       = ((ExceptionMessage[5]="Invalid character"),5);
var NO_DATA_ALLOWED_ERR         = ExceptionCode.NO_DATA_ALLOWED_ERR         = ((ExceptionMessage[6]="No data allowed"),6);
var NO_MODIFICATION_ALLOWED_ERR = ExceptionCode.NO_MODIFICATION_ALLOWED_ERR = ((ExceptionMessage[7]="No modification allowed"),7);
var NOT_FOUND_ERR               = ExceptionCode.NOT_FOUND_ERR               = ((ExceptionMessage[8]="Not found"),8);
var NOT_SUPPORTED_ERR           = ExceptionCode.NOT_SUPPORTED_ERR           = ((ExceptionMessage[9]="Not supported"),9);
var INUSE_ATTRIBUTE_ERR         = ExceptionCode.INUSE_ATTRIBUTE_ERR         = ((ExceptionMessage[10]="Attribute in use"),10);
//level2
var INVALID_STATE_ERR        	= ExceptionCode.INVALID_STATE_ERR        	= ((ExceptionMessage[11]="Invalid state"),11);
var SYNTAX_ERR               	= ExceptionCode.SYNTAX_ERR               	= ((ExceptionMessage[12]="Syntax error"),12);
var INVALID_MODIFICATION_ERR 	= ExceptionCode.INVALID_MODIFICATION_ERR 	= ((ExceptionMessage[13]="Invalid modification"),13);
var NAMESPACE_ERR            	= ExceptionCode.NAMESPACE_ERR           	= ((ExceptionMessage[14]="Invalid namespace"),14);
var INVALID_ACCESS_ERR       	= ExceptionCode.INVALID_ACCESS_ERR      	= ((ExceptionMessage[15]="Invalid access"),15);


function DOMException(code, message) {
	if(message instanceof Error){
		var error = message;
	}else{
		error = this;
		Error.call(this, ExceptionMessage[code]);
		this.message = ExceptionMessage[code];
		if(Error.captureStackTrace) Error.captureStackTrace(this, DOMException);
	}
	error.code = code;
	if(message) this.message = this.message + ": " + message;
	return error;
};
DOMException.prototype = Error.prototype;
copy(ExceptionCode,DOMException)
/**
 * @see http://www.w3.org/TR/2000/REC-DOM-Level-2-Core-20001113/core.html#ID-536297177
 * The NodeList interface provides the abstraction of an ordered collection of nodes, without defining or constraining how this collection is implemented. NodeList objects in the DOM are live.
 * The items in the NodeList are accessible via an integral index, starting from 0.
 */
function NodeList() {
};
NodeList.prototype = {
	/**
	 * The number of nodes in the list. The range of valid child node indices is 0 to length-1 inclusive.
	 * @standard level1
	 */
	length:0, 
	/**
	 * Returns the indexth item in the collection. If index is greater than or equal to the number of nodes in the list, this returns null.
	 * @standard level1
	 * @param index  unsigned long 
	 *   Index into the collection.
	 * @return Node
	 * 	The node at the indexth position in the NodeList, or null if that is not a valid index. 
	 */
	item: function(index) {
		return this[index] || null;
	},
	toString:function(isHTML,nodeFilter){
		for(var buf = [], i = 0;i<this.length;i++){
			serializeToString(this[i],buf,isHTML,nodeFilter);
		}
		return buf.join('');
	}
};
function LiveNodeList(node,refresh){
	this._node = node;
	this._refresh = refresh
	_updateLiveList(this);
}
function _updateLiveList(list){
	var inc = list._node._inc || list._node.ownerDocument._inc;
	if(list._inc != inc){
		var ls = list._refresh(list._node);
		//console.log(ls.length)
		__set__(list,'length',ls.length);
		copy(ls,list);
		list._inc = inc;
	}
}
LiveNodeList.prototype.item = function(i){
	_updateLiveList(this);
	return this[i];
}

_extends(LiveNodeList,NodeList);
/**
 * 
 * Objects implementing the NamedNodeMap interface are used to represent collections of nodes that can be accessed by name. Note that NamedNodeMap does not inherit from NodeList; NamedNodeMaps are not maintained in any particular order. Objects contained in an object implementing NamedNodeMap may also be accessed by an ordinal index, but this is simply to allow convenient enumeration of the contents of a NamedNodeMap, and does not imply that the DOM specifies an order to these Nodes.
 * NamedNodeMap objects in the DOM are live.
 * used for attributes or DocumentType entities 
 */
function NamedNodeMap() {
};

function _findNodeIndex(list,node){
	var i = list.length;
	while(i--){
		if(list[i] === node){return i}
	}
}

function _addNamedNode(el,list,newAttr,oldAttr){
	if(oldAttr){
		list[_findNodeIndex(list,oldAttr)] = newAttr;
	}else{
		list[list.length++] = newAttr;
	}
	if(el){
		newAttr.ownerElement = el;
		var doc = el.ownerDocument;
		if(doc){
			oldAttr && _onRemoveAttribute(doc,el,oldAttr);
			_onAddAttribute(doc,el,newAttr);
		}
	}
}
function _removeNamedNode(el,list,attr){
	//console.log('remove attr:'+attr)
	var i = _findNodeIndex(list,attr);
	if(i>=0){
		var lastIndex = list.length-1
		while(i<lastIndex){
			list[i] = list[++i]
		}
		list.length = lastIndex;
		if(el){
			var doc = el.ownerDocument;
			if(doc){
				_onRemoveAttribute(doc,el,attr);
				attr.ownerElement = null;
			}
		}
	}else{
		throw DOMException(NOT_FOUND_ERR,new Error(el.tagName+'@'+attr))
	}
}
NamedNodeMap.prototype = {
	length:0,
	item:NodeList.prototype.item,
	getNamedItem: function(key) {
//		if(key.indexOf(':')>0 || key == 'xmlns'){
//			return null;
//		}
		//console.log()
		var i = this.length;
		while(i--){
			var attr = this[i];
			//console.log(attr.nodeName,key)
			if(attr.nodeName == key){
				return attr;
			}
		}
	},
	setNamedItem: function(attr) {
		var el = attr.ownerElement;
		if(el && el!=this._ownerElement){
			throw new DOMException(INUSE_ATTRIBUTE_ERR);
		}
		var oldAttr = this.getNamedItem(attr.nodeName);
		_addNamedNode(this._ownerElement,this,attr,oldAttr);
		return oldAttr;
	},
	/* returns Node */
	setNamedItemNS: function(attr) {// raises: WRONG_DOCUMENT_ERR,NO_MODIFICATION_ALLOWED_ERR,INUSE_ATTRIBUTE_ERR
		var el = attr.ownerElement, oldAttr;
		if(el && el!=this._ownerElement){
			throw new DOMException(INUSE_ATTRIBUTE_ERR);
		}
		oldAttr = this.getNamedItemNS(attr.namespaceURI,attr.localName);
		_addNamedNode(this._ownerElement,this,attr,oldAttr);
		return oldAttr;
	},

	/* returns Node */
	removeNamedItem: function(key) {
		var attr = this.getNamedItem(key);
		_removeNamedNode(this._ownerElement,this,attr);
		return attr;
		
		
	},// raises: NOT_FOUND_ERR,NO_MODIFICATION_ALLOWED_ERR
	
	//for level2
	removeNamedItemNS:function(namespaceURI,localName){
		var attr = this.getNamedItemNS(namespaceURI,localName);
		_removeNamedNode(this._ownerElement,this,attr);
		return attr;
	},
	getNamedItemNS: function(namespaceURI, localName) {
		var i = this.length;
		while(i--){
			var node = this[i];
			if(node.localName == localName && node.namespaceURI == namespaceURI){
				return node;
			}
		}
		return null;
	}
};
/**
 * @see http://www.w3.org/TR/REC-DOM-Level-1/level-one-core.html#ID-102161490
 */
function DOMImplementation(/* Object */ features) {
	this._features = {};
	if (features) {
		for (var feature in features) {
			 this._features = features[feature];
		}
	}
};

DOMImplementation.prototype = {
	hasFeature: function(/* string */ feature, /* string */ version) {
		var versions = this._features[feature.toLowerCase()];
		if (versions && (!version || version in versions)) {
			return true;
		} else {
			return false;
		}
	},
	// Introduced in DOM Level 2:
	createDocument:function(namespaceURI,  qualifiedName, doctype){// raises:INVALID_CHARACTER_ERR,NAMESPACE_ERR,WRONG_DOCUMENT_ERR
		var doc = new Document();
		doc.implementation = this;
		doc.childNodes = new NodeList();
		doc.doctype = doctype;
		if(doctype){
			doc.appendChild(doctype);
		}
		if(qualifiedName){
			var root = doc.createElementNS(namespaceURI,qualifiedName);
			doc.appendChild(root);
		}
		return doc;
	},
	// Introduced in DOM Level 2:
	createDocumentType:function(qualifiedName, publicId, systemId){// raises:INVALID_CHARACTER_ERR,NAMESPACE_ERR
		var node = new DocumentType();
		node.name = qualifiedName;
		node.nodeName = qualifiedName;
		node.publicId = publicId;
		node.systemId = systemId;
		// Introduced in DOM Level 2:
		//readonly attribute DOMString        internalSubset;
		
		//TODO:..
		//  readonly attribute NamedNodeMap     entities;
		//  readonly attribute NamedNodeMap     notations;
		return node;
	}
};


/**
 * @see http://www.w3.org/TR/2000/REC-DOM-Level-2-Core-20001113/core.html#ID-1950641247
 */

function Node() {
};

Node.prototype = {
	firstChild : null,
	lastChild : null,
	previousSibling : null,
	nextSibling : null,
	attributes : null,
	parentNode : null,
	childNodes : null,
	ownerDocument : null,
	nodeValue : null,
	namespaceURI : null,
	prefix : null,
	localName : null,
	// Modified in DOM Level 2:
	insertBefore:function(newChild, refChild){//raises 
		return _insertBefore(this,newChild,refChild);
	},
	replaceChild:function(newChild, oldChild){//raises 
		this.insertBefore(newChild,oldChild);
		if(oldChild){
			this.removeChild(oldChild);
		}
	},
	removeChild:function(oldChild){
		return _removeChild(this,oldChild);
	},
	appendChild:function(newChild){
		return this.insertBefore(newChild,null);
	},
	hasChildNodes:function(){
		return this.firstChild != null;
	},
	cloneNode:function(deep){
		return cloneNode(this.ownerDocument||this,this,deep);
	},
	// Modified in DOM Level 2:
	normalize:function(){
		var child = this.firstChild;
		while(child){
			var next = child.nextSibling;
			if(next && next.nodeType == TEXT_NODE && child.nodeType == TEXT_NODE){
				this.removeChild(next);
				child.appendData(next.data);
			}else{
				child.normalize();
				child = next;
			}
		}
	},
  	// Introduced in DOM Level 2:
	isSupported:function(feature, version){
		return this.ownerDocument.implementation.hasFeature(feature,version);
	},
    // Introduced in DOM Level 2:
    hasAttributes:function(){
    	return this.attributes.length>0;
    },
    lookupPrefix:function(namespaceURI){
    	var el = this;
    	while(el){
    		var map = el._nsMap;
    		//console.dir(map)
    		if(map){
    			for(var n in map){
    				if(map[n] == namespaceURI){
    					return n;
    				}
    			}
    		}
    		el = el.nodeType == ATTRIBUTE_NODE?el.ownerDocument : el.parentNode;
    	}
    	return null;
    },
    // Introduced in DOM Level 3:
    lookupNamespaceURI:function(prefix){
    	var el = this;
    	while(el){
    		var map = el._nsMap;
    		//console.dir(map)
    		if(map){
    			if(prefix in map){
    				return map[prefix] ;
    			}
    		}
    		el = el.nodeType == ATTRIBUTE_NODE?el.ownerDocument : el.parentNode;
    	}
    	return null;
    },
    // Introduced in DOM Level 3:
    isDefaultNamespace:function(namespaceURI){
    	var prefix = this.lookupPrefix(namespaceURI);
    	return prefix == null;
    }
};


function _xmlEncoder(c){
	return c == '<' && '&lt;' ||
         c == '>' && '&gt;' ||
         c == '&' && '&amp;' ||
         c == '"' && '&quot;' ||
         '&#'+c.charCodeAt()+';'
}


copy(NodeType,Node);
copy(NodeType,Node.prototype);

/**
 * @param callback return true for continue,false for break
 * @return boolean true: break visit;
 */
function _visitNode(node,callback){
	if(callback(node)){
		return true;
	}
	if(node = node.firstChild){
		do{
			if(_visitNode(node,callback)){return true}
        }while(node=node.nextSibling)
    }
}



function Document(){
}
function _onAddAttribute(doc,el,newAttr){
	doc && doc._inc++;
	var ns = newAttr.namespaceURI ;
	if(ns == 'http://www.w3.org/2000/xmlns/'){
		//update namespace
		el._nsMap[newAttr.prefix?newAttr.localName:''] = newAttr.value
	}
}
function _onRemoveAttribute(doc,el,newAttr,remove){
	doc && doc._inc++;
	var ns = newAttr.namespaceURI ;
	if(ns == 'http://www.w3.org/2000/xmlns/'){
		//update namespace
		delete el._nsMap[newAttr.prefix?newAttr.localName:'']
	}
}
function _onUpdateChild(doc,el,newChild){
	if(doc && doc._inc){
		doc._inc++;
		//update childNodes
		var cs = el.childNodes;
		if(newChild){
			cs[cs.length++] = newChild;
		}else{
			//console.log(1)
			var child = el.firstChild;
			var i = 0;
			while(child){
				cs[i++] = child;
				child =child.nextSibling;
			}
			cs.length = i;
		}
	}
}

/**
 * attributes;
 * children;
 * 
 * writeable properties:
 * nodeValue,Attr:value,CharacterData:data
 * prefix
 */
function _removeChild(parentNode,child){
	var previous = child.previousSibling;
	var next = child.nextSibling;
	if(previous){
		previous.nextSibling = next;
	}else{
		parentNode.firstChild = next
	}
	if(next){
		next.previousSibling = previous;
	}else{
		parentNode.lastChild = previous;
	}
	_onUpdateChild(parentNode.ownerDocument,parentNode);
	return child;
}
/**
 * preformance key(refChild == null)
 */
function _insertBefore(parentNode,newChild,nextChild){
	var cp = newChild.parentNode;
	if(cp){
		cp.removeChild(newChild);//remove and update
	}
	if(newChild.nodeType === DOCUMENT_FRAGMENT_NODE){
		var newFirst = newChild.firstChild;
		if (newFirst == null) {
			return newChild;
		}
		var newLast = newChild.lastChild;
	}else{
		newFirst = newLast = newChild;
	}
	var pre = nextChild ? nextChild.previousSibling : parentNode.lastChild;

	newFirst.previousSibling = pre;
	newLast.nextSibling = nextChild;
	
	
	if(pre){
		pre.nextSibling = newFirst;
	}else{
		parentNode.firstChild = newFirst;
	}
	if(nextChild == null){
		parentNode.lastChild = newLast;
	}else{
		nextChild.previousSibling = newLast;
	}
	do{
		newFirst.parentNode = parentNode;
	}while(newFirst !== newLast && (newFirst= newFirst.nextSibling))
	_onUpdateChild(parentNode.ownerDocument||parentNode,parentNode);
	//console.log(parentNode.lastChild.nextSibling == null)
	if (newChild.nodeType == DOCUMENT_FRAGMENT_NODE) {
		newChild.firstChild = newChild.lastChild = null;
	}
	return newChild;
}
function _appendSingleChild(parentNode,newChild){
	var cp = newChild.parentNode;
	if(cp){
		var pre = parentNode.lastChild;
		cp.removeChild(newChild);//remove and update
		var pre = parentNode.lastChild;
	}
	var pre = parentNode.lastChild;
	newChild.parentNode = parentNode;
	newChild.previousSibling = pre;
	newChild.nextSibling = null;
	if(pre){
		pre.nextSibling = newChild;
	}else{
		parentNode.firstChild = newChild;
	}
	parentNode.lastChild = newChild;
	_onUpdateChild(parentNode.ownerDocument,parentNode,newChild);
	return newChild;
	//console.log("__aa",parentNode.lastChild.nextSibling == null)
}
Document.prototype = {
	//implementation : null,
	nodeName :  '#document',
	nodeType :  DOCUMENT_NODE,
	doctype :  null,
	documentElement :  null,
	_inc : 1,
	
	insertBefore :  function(newChild, refChild){//raises 
		if(newChild.nodeType == DOCUMENT_FRAGMENT_NODE){
			var child = newChild.firstChild;
			while(child){
				var next = child.nextSibling;
				this.insertBefore(child,refChild);
				child = next;
			}
			return newChild;
		}
		if(this.documentElement == null && newChild.nodeType == ELEMENT_NODE){
			this.documentElement = newChild;
		}
		
		return _insertBefore(this,newChild,refChild),(newChild.ownerDocument = this),newChild;
	},
	removeChild :  function(oldChild){
		if(this.documentElement == oldChild){
			this.documentElement = null;
		}
		return _removeChild(this,oldChild);
	},
	// Introduced in DOM Level 2:
	importNode : function(importedNode,deep){
		return importNode(this,importedNode,deep);
	},
	// Introduced in DOM Level 2:
	getElementById :	function(id){
		var rtv = null;
		_visitNode(this.documentElement,function(node){
			if(node.nodeType == ELEMENT_NODE){
				if(node.getAttribute('id') == id){
					rtv = node;
					return true;
				}
			}
		})
		return rtv;
	},
	
	//document factory method:
	createElement :	function(tagName){
		var node = new Element();
		node.ownerDocument = this;
		node.nodeName = tagName;
		node.tagName = tagName;
		node.childNodes = new NodeList();
		var attrs	= node.attributes = new NamedNodeMap();
		attrs._ownerElement = node;
		return node;
	},
	createDocumentFragment :	function(){
		var node = new DocumentFragment();
		node.ownerDocument = this;
		node.childNodes = new NodeList();
		return node;
	},
	createTextNode :	function(data){
		var node = new Text();
		node.ownerDocument = this;
		node.appendData(data)
		return node;
	},
	createComment :	function(data){
		var node = new Comment();
		node.ownerDocument = this;
		node.appendData(data)
		return node;
	},
	createCDATASection :	function(data){
		var node = new CDATASection();
		node.ownerDocument = this;
		node.appendData(data)
		return node;
	},
	createProcessingInstruction :	function(target,data){
		var node = new ProcessingInstruction();
		node.ownerDocument = this;
		node.tagName = node.target = target;
		node.nodeValue= node.data = data;
		return node;
	},
	createAttribute :	function(name){
		var node = new Attr();
		node.ownerDocument	= this;
		node.name = name;
		node.nodeName	= name;
		node.localName = name;
		node.specified = true;
		return node;
	},
	createEntityReference :	function(name){
		var node = new EntityReference();
		node.ownerDocument	= this;
		node.nodeName	= name;
		return node;
	},
	// Introduced in DOM Level 2:
	createElementNS :	function(namespaceURI,qualifiedName){
		var node = new Element();
		var pl = qualifiedName.split(':');
		var attrs	= node.attributes = new NamedNodeMap();
		node.childNodes = new NodeList();
		node.ownerDocument = this;
		node.nodeName = qualifiedName;
		node.tagName = qualifiedName;
		node.namespaceURI = namespaceURI;
		if(pl.length == 2){
			node.prefix = pl[0];
			node.localName = pl[1];
		}else{
			//el.prefix = null;
			node.localName = qualifiedName;
		}
		attrs._ownerElement = node;
		return node;
	},
	// Introduced in DOM Level 2:
	createAttributeNS :	function(namespaceURI,qualifiedName){
		var node = new Attr();
		var pl = qualifiedName.split(':');
		node.ownerDocument = this;
		node.nodeName = qualifiedName;
		node.name = qualifiedName;
		node.namespaceURI = namespaceURI;
		node.specified = true;
		if(pl.length == 2){
			node.prefix = pl[0];
			node.localName = pl[1];
		}else{
			//el.prefix = null;
			node.localName = qualifiedName;
		}
		return node;
	}
};
_extends(Document,Node);


function Element() {
	this._nsMap = {};
};
Element.prototype = {
	nodeType : ELEMENT_NODE,
	hasAttribute : function(name){
		return this.getAttributeNode(name)!=null;
	},
	getAttribute : function(name){
		var attr = this.getAttributeNode(name);
		return attr && attr.value || '';
	},
	getAttributeNode : function(name){
		return this.attributes.getNamedItem(name);
	},
	setAttribute : function(name, value){
		var attr = this.ownerDocument.createAttribute(name);
		attr.value = attr.nodeValue = "" + value;
		this.setAttributeNode(attr)
	},
	removeAttribute : function(name){
		var attr = this.getAttributeNode(name)
		attr && this.removeAttributeNode(attr);
	},
	
	//four real opeartion method
	appendChild:function(newChild){
		if(newChild.nodeType === DOCUMENT_FRAGMENT_NODE){
			return this.insertBefore(newChild,null);
		}else{
			return _appendSingleChild(this,newChild);
		}
	},
	setAttributeNode : function(newAttr){
		return this.attributes.setNamedItem(newAttr);
	},
	setAttributeNodeNS : function(newAttr){
		return this.attributes.setNamedItemNS(newAttr);
	},
	removeAttributeNode : function(oldAttr){
		//console.log(this == oldAttr.ownerElement)
		return this.attributes.removeNamedItem(oldAttr.nodeName);
	},
	//get real attribute name,and remove it by removeAttributeNode
	removeAttributeNS : function(namespaceURI, localName){
		var old = this.getAttributeNodeNS(namespaceURI, localName);
		old && this.removeAttributeNode(old);
	},
	
	hasAttributeNS : function(namespaceURI, localName){
		return this.getAttributeNodeNS(namespaceURI, localName)!=null;
	},
	getAttributeNS : function(namespaceURI, localName){
		var attr = this.getAttributeNodeNS(namespaceURI, localName);
		return attr && attr.value || '';
	},
	setAttributeNS : function(namespaceURI, qualifiedName, value){
		var attr = this.ownerDocument.createAttributeNS(namespaceURI, qualifiedName);
		attr.value = attr.nodeValue = "" + value;
		this.setAttributeNode(attr)
	},
	getAttributeNodeNS : function(namespaceURI, localName){
		return this.attributes.getNamedItemNS(namespaceURI, localName);
	},
	
	getElementsByTagName : function(tagName){
		return new LiveNodeList(this,function(base){
			var ls = [];
			_visitNode(base,function(node){
				if(node !== base && node.nodeType == ELEMENT_NODE && (tagName === '*' || node.tagName == tagName)){
					ls.push(node);
				}
			});
			return ls;
		});
	},
	getElementsByTagNameNS : function(namespaceURI, localName){
		return new LiveNodeList(this,function(base){
			var ls = [];
			_visitNode(base,function(node){
				if(node !== base && node.nodeType === ELEMENT_NODE && (namespaceURI === '*' || node.namespaceURI === namespaceURI) && (localName === '*' || node.localName == localName)){
					ls.push(node);
				}
			});
			return ls;
			
		});
	}
};
Document.prototype.getElementsByTagName = Element.prototype.getElementsByTagName;
Document.prototype.getElementsByTagNameNS = Element.prototype.getElementsByTagNameNS;


_extends(Element,Node);
function Attr() {
};
Attr.prototype.nodeType = ATTRIBUTE_NODE;
_extends(Attr,Node);


function CharacterData() {
};
CharacterData.prototype = {
	data : '',
	substringData : function(offset, count) {
		return this.data.substring(offset, offset+count);
	},
	appendData: function(text) {
		text = this.data+text;
		this.nodeValue = this.data = text;
		this.length = text.length;
	},
	insertData: function(offset,text) {
		this.replaceData(offset,0,text);
	
	},
	appendChild:function(newChild){
		throw new Error(ExceptionMessage[HIERARCHY_REQUEST_ERR])
	},
	deleteData: function(offset, count) {
		this.replaceData(offset,count,"");
	},
	replaceData: function(offset, count, text) {
		var start = this.data.substring(0,offset);
		var end = this.data.substring(offset+count);
		text = start + text + end;
		this.nodeValue = this.data = text;
		this.length = text.length;
	}
}
_extends(CharacterData,Node);
function Text() {
};
Text.prototype = {
	nodeName : "#text",
	nodeType : TEXT_NODE,
	splitText : function(offset) {
		var text = this.data;
		var newText = text.substring(offset);
		text = text.substring(0, offset);
		this.data = this.nodeValue = text;
		this.length = text.length;
		var newNode = this.ownerDocument.createTextNode(newText);
		if(this.parentNode){
			this.parentNode.insertBefore(newNode, this.nextSibling);
		}
		return newNode;
	}
}
_extends(Text,CharacterData);
function Comment() {
};
Comment.prototype = {
	nodeName : "#comment",
	nodeType : COMMENT_NODE
}
_extends(Comment,CharacterData);

function CDATASection() {
};
CDATASection.prototype = {
	nodeName : "#cdata-section",
	nodeType : CDATA_SECTION_NODE
}
_extends(CDATASection,CharacterData);


function DocumentType() {
};
DocumentType.prototype.nodeType = DOCUMENT_TYPE_NODE;
_extends(DocumentType,Node);

function Notation() {
};
Notation.prototype.nodeType = NOTATION_NODE;
_extends(Notation,Node);

function Entity() {
};
Entity.prototype.nodeType = ENTITY_NODE;
_extends(Entity,Node);

function EntityReference() {
};
EntityReference.prototype.nodeType = ENTITY_REFERENCE_NODE;
_extends(EntityReference,Node);

function DocumentFragment() {
};
DocumentFragment.prototype.nodeName =	"#document-fragment";
DocumentFragment.prototype.nodeType =	DOCUMENT_FRAGMENT_NODE;
_extends(DocumentFragment,Node);


function ProcessingInstruction() {
}
ProcessingInstruction.prototype.nodeType = PROCESSING_INSTRUCTION_NODE;
_extends(ProcessingInstruction,Node);
function XMLSerializer(){}
XMLSerializer.prototype.serializeToString = function(node,isHtml,nodeFilter){
	return nodeSerializeToString.call(node,isHtml,nodeFilter);
}
Node.prototype.toString = nodeSerializeToString;
function nodeSerializeToString(isHtml,nodeFilter){
	var buf = [];
	var refNode = this.nodeType == 9?this.documentElement:this;
	var prefix = refNode.prefix;
	var uri = refNode.namespaceURI;
	
	if(uri && prefix == null){
		//console.log(prefix)
		var prefix = refNode.lookupPrefix(uri);
		if(prefix == null){
			//isHTML = true;
			var visibleNamespaces=[
			{namespace:uri,prefix:null}
			//{namespace:uri,prefix:''}
			]
		}
	}
	serializeToString(this,buf,isHtml,nodeFilter,visibleNamespaces);
	//console.log('###',this.nodeType,uri,prefix,buf.join(''))
	return buf.join('');
}
function needNamespaceDefine(node,isHTML, visibleNamespaces) {
	var prefix = node.prefix||'';
	var uri = node.namespaceURI;
	if (!prefix && !uri){
		return false;
	}
	if (prefix === "xml" && uri === "http://www.w3.org/XML/1998/namespace" 
		|| uri == 'http://www.w3.org/2000/xmlns/'){
		return false;
	}
	
	var i = visibleNamespaces.length 
	//console.log('@@@@',node.tagName,prefix,uri,visibleNamespaces)
	while (i--) {
		var ns = visibleNamespaces[i];
		// get namespace prefix
		//console.log(node.nodeType,node.tagName,ns.prefix,prefix)
		if (ns.prefix == prefix){
			return ns.namespace != uri;
		}
	}
	//console.log(isHTML,uri,prefix=='')
	//if(isHTML && prefix ==null && uri == 'http://www.w3.org/1999/xhtml'){
	//	return false;
	//}
	//node.flag = '11111'
	//console.error(3,true,node.flag,node.prefix,node.namespaceURI)
	return true;
}
function serializeToString(node,buf,isHTML,nodeFilter,visibleNamespaces){
	if(nodeFilter){
		node = nodeFilter(node);
		if(node){
			if(typeof node == 'string'){
				buf.push(node);
				return;
			}
		}else{
			return;
		}
		//buf.sort.apply(attrs, attributeSorter);
	}
	switch(node.nodeType){
	case ELEMENT_NODE:
		if (!visibleNamespaces) visibleNamespaces = [];
		var startVisibleNamespaces = visibleNamespaces.length;
		var attrs = node.attributes;
		var len = attrs.length;
		var child = node.firstChild;
		var nodeName = node.tagName;
		
		isHTML =  (htmlns === node.namespaceURI) ||isHTML 
		buf.push('<',nodeName);
		
		
		
		for(var i=0;i<len;i++){
			// add namespaces for attributes
			var attr = attrs.item(i);
			if (attr.prefix == 'xmlns') {
				visibleNamespaces.push({ prefix: attr.localName, namespace: attr.value });
			}else if(attr.nodeName == 'xmlns'){
				visibleNamespaces.push({ prefix: '', namespace: attr.value });
			}
		}
		for(var i=0;i<len;i++){
			var attr = attrs.item(i);
			if (needNamespaceDefine(attr,isHTML, visibleNamespaces)) {
				var prefix = attr.prefix||'';
				var uri = attr.namespaceURI;
				var ns = prefix ? ' xmlns:' + prefix : " xmlns";
				buf.push(ns, '="' , uri , '"');
				visibleNamespaces.push({ prefix: prefix, namespace:uri });
			}
			serializeToString(attr,buf,isHTML,nodeFilter,visibleNamespaces);
		}
		// add namespace for current node		
		if (needNamespaceDefine(node,isHTML, visibleNamespaces)) {
			var prefix = node.prefix||'';
			var uri = node.namespaceURI;
			var ns = prefix ? ' xmlns:' + prefix : " xmlns";
			buf.push(ns, '="' , uri , '"');
			visibleNamespaces.push({ prefix: prefix, namespace:uri });
		}
		
		if(child || isHTML && !/^(?:meta|link|img|br|hr|input)$/i.test(nodeName)){
			buf.push('>');
			//if is cdata child node
			if(isHTML && /^script$/i.test(nodeName)){
				while(child){
					if(child.data){
						buf.push(child.data);
					}else{
						serializeToString(child,buf,isHTML,nodeFilter,visibleNamespaces);
					}
					child = child.nextSibling;
				}
			}else
			{
				while(child){
					serializeToString(child,buf,isHTML,nodeFilter,visibleNamespaces);
					child = child.nextSibling;
				}
			}
			buf.push('</',nodeName,'>');
		}else{
			buf.push('/>');
		}
		// remove added visible namespaces
		//visibleNamespaces.length = startVisibleNamespaces;
		return;
	case DOCUMENT_NODE:
	case DOCUMENT_FRAGMENT_NODE:
		var child = node.firstChild;
		while(child){
			serializeToString(child,buf,isHTML,nodeFilter,visibleNamespaces);
			child = child.nextSibling;
		}
		return;
	case ATTRIBUTE_NODE:
		return buf.push(' ',node.name,'="',node.value.replace(/[<&"]/g,_xmlEncoder),'"');
	case TEXT_NODE:
		return buf.push(node.data.replace(/[<&]/g,_xmlEncoder));
	case CDATA_SECTION_NODE:
		return buf.push( '<![CDATA[',node.data,']]>');
	case COMMENT_NODE:
		return buf.push( "<!--",node.data,"-->");
	case DOCUMENT_TYPE_NODE:
		var pubid = node.publicId;
		var sysid = node.systemId;
		buf.push('<!DOCTYPE ',node.name);
		if(pubid){
			buf.push(' PUBLIC "',pubid);
			if (sysid && sysid!='.') {
				buf.push( '" "',sysid);
			}
			buf.push('">');
		}else if(sysid && sysid!='.'){
			buf.push(' SYSTEM "',sysid,'">');
		}else{
			var sub = node.internalSubset;
			if(sub){
				buf.push(" [",sub,"]");
			}
			buf.push(">");
		}
		return;
	case PROCESSING_INSTRUCTION_NODE:
		return buf.push( "<?",node.target," ",node.data,"?>");
	case ENTITY_REFERENCE_NODE:
		return buf.push( '&',node.nodeName,';');
	//case ENTITY_NODE:
	//case NOTATION_NODE:
	default:
		buf.push('??',node.nodeName);
	}
}
function importNode(doc,node,deep){
	var node2;
	switch (node.nodeType) {
	case ELEMENT_NODE:
		node2 = node.cloneNode(false);
		node2.ownerDocument = doc;
		//var attrs = node2.attributes;
		//var len = attrs.length;
		//for(var i=0;i<len;i++){
			//node2.setAttributeNodeNS(importNode(doc,attrs.item(i),deep));
		//}
	case DOCUMENT_FRAGMENT_NODE:
		break;
	case ATTRIBUTE_NODE:
		deep = true;
		break;
	//case ENTITY_REFERENCE_NODE:
	//case PROCESSING_INSTRUCTION_NODE:
	////case TEXT_NODE:
	//case CDATA_SECTION_NODE:
	//case COMMENT_NODE:
	//	deep = false;
	//	break;
	//case DOCUMENT_NODE:
	//case DOCUMENT_TYPE_NODE:
	//cannot be imported.
	//case ENTITY_NODE:
	//case NOTATION_NODE：
	//can not hit in level3
	//default:throw e;
	}
	if(!node2){
		node2 = node.cloneNode(false);//false
	}
	node2.ownerDocument = doc;
	node2.parentNode = null;
	if(deep){
		var child = node.firstChild;
		while(child){
			node2.appendChild(importNode(doc,child,deep));
			child = child.nextSibling;
		}
	}
	return node2;
}
//
//var _relationMap = {firstChild:1,lastChild:1,previousSibling:1,nextSibling:1,
//					attributes:1,childNodes:1,parentNode:1,documentElement:1,doctype,};
function cloneNode(doc,node,deep){
	var node2 = new node.constructor();
	for(var n in node){
		var v = node[n];
		if(typeof v != 'object' ){
			if(v != node2[n]){
				node2[n] = v;
			}
		}
	}
	if(node.childNodes){
		node2.childNodes = new NodeList();
	}
	node2.ownerDocument = doc;
	switch (node2.nodeType) {
	case ELEMENT_NODE:
		var attrs	= node.attributes;
		var attrs2	= node2.attributes = new NamedNodeMap();
		var len = attrs.length
		attrs2._ownerElement = node2;
		for(var i=0;i<len;i++){
			node2.setAttributeNode(cloneNode(doc,attrs.item(i),true));
		}
		break;;
	case ATTRIBUTE_NODE:
		deep = true;
	}
	if(deep){
		var child = node.firstChild;
		while(child){
			node2.appendChild(cloneNode(doc,child,deep));
			child = child.nextSibling;
		}
	}
	return node2;
}

function __set__(object,key,value){
	object[key] = value
}
//do dynamic
try{
	if(Object.defineProperty){
		Object.defineProperty(LiveNodeList.prototype,'length',{
			get:function(){
				_updateLiveList(this);
				return this.$$length;
			}
		});
		Object.defineProperty(Node.prototype,'textContent',{
			get:function(){
				return getTextContent(this);
			},
			set:function(data){
				switch(this.nodeType){
				case ELEMENT_NODE:
				case DOCUMENT_FRAGMENT_NODE:
					while(this.firstChild){
						this.removeChild(this.firstChild);
					}
					if(data || String(data)){
						this.appendChild(this.ownerDocument.createTextNode(data));
					}
					break;
				default:
					//TODO:
					this.data = data;
					this.value = data;
					this.nodeValue = data;
				}
			}
		})
		
		function getTextContent(node){
			switch(node.nodeType){
			case ELEMENT_NODE:
			case DOCUMENT_FRAGMENT_NODE:
				var buf = [];
				node = node.firstChild;
				while(node){
					if(node.nodeType!==7 && node.nodeType !==8){
						buf.push(getTextContent(node));
					}
					node = node.nextSibling;
				}
				return buf.join('');
			default:
				return node.nodeValue;
			}
		}
		__set__ = function(object,key,value){
			//console.log(value)
			object['$$'+key] = value
		}
	}
}catch(e){//ie8
}

//if(typeof require == 'function'){
	exports.DOMImplementation = DOMImplementation;
	exports.XMLSerializer = XMLSerializer;
//}

},{}],78:[function(require,module,exports){
//[4]   	NameStartChar	   ::=   	":" | [A-Z] | "_" | [a-z] | [#xC0-#xD6] | [#xD8-#xF6] | [#xF8-#x2FF] | [#x370-#x37D] | [#x37F-#x1FFF] | [#x200C-#x200D] | [#x2070-#x218F] | [#x2C00-#x2FEF] | [#x3001-#xD7FF] | [#xF900-#xFDCF] | [#xFDF0-#xFFFD] | [#x10000-#xEFFFF]
//[4a]   	NameChar	   ::=   	NameStartChar | "-" | "." | [0-9] | #xB7 | [#x0300-#x036F] | [#x203F-#x2040]
//[5]   	Name	   ::=   	NameStartChar (NameChar)*
var nameStartChar = /[A-Z_a-z\xC0-\xD6\xD8-\xF6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]///\u10000-\uEFFFF
var nameChar = new RegExp("[\\-\\.0-9"+nameStartChar.source.slice(1,-1)+"\\u00B7\\u0300-\\u036F\\u203F-\\u2040]");
var tagNamePattern = new RegExp('^'+nameStartChar.source+nameChar.source+'*(?:\:'+nameStartChar.source+nameChar.source+'*)?$');
//var tagNamePattern = /^[a-zA-Z_][\w\-\.]*(?:\:[a-zA-Z_][\w\-\.]*)?$/
//var handlers = 'resolveEntity,getExternalSubset,characters,endDocument,endElement,endPrefixMapping,ignorableWhitespace,processingInstruction,setDocumentLocator,skippedEntity,startDocument,startElement,startPrefixMapping,notationDecl,unparsedEntityDecl,error,fatalError,warning,attributeDecl,elementDecl,externalEntityDecl,internalEntityDecl,comment,endCDATA,endDTD,endEntity,startCDATA,startDTD,startEntity'.split(',')

//S_TAG,	S_ATTR,	S_EQ,	S_ATTR_NOQUOT_VALUE
//S_ATTR_SPACE,	S_ATTR_END,	S_TAG_SPACE, S_TAG_CLOSE
var S_TAG = 0;//tag name offerring
var S_ATTR = 1;//attr name offerring 
var S_ATTR_SPACE=2;//attr name end and space offer
var S_EQ = 3;//=space?
var S_ATTR_NOQUOT_VALUE = 4;//attr value(no quot value only)
var S_ATTR_END = 5;//attr value end and no space(quot end)
var S_TAG_SPACE = 6;//(attr value end || tag end ) && (space offer)
var S_TAG_CLOSE = 7;//closed el<el />

function XMLReader(){
	
}

XMLReader.prototype = {
	parse:function(source,defaultNSMap,entityMap){
		var domBuilder = this.domBuilder;
		domBuilder.startDocument();
		_copy(defaultNSMap ,defaultNSMap = {})
		parse(source,defaultNSMap,entityMap,
				domBuilder,this.errorHandler);
		domBuilder.endDocument();
	}
}
function parse(source,defaultNSMapCopy,entityMap,domBuilder,errorHandler){
	function fixedFromCharCode(code) {
		// String.prototype.fromCharCode does not supports
		// > 2 bytes unicode chars directly
		if (code > 0xffff) {
			code -= 0x10000;
			var surrogate1 = 0xd800 + (code >> 10)
				, surrogate2 = 0xdc00 + (code & 0x3ff);

			return String.fromCharCode(surrogate1, surrogate2);
		} else {
			return String.fromCharCode(code);
		}
	}
	function entityReplacer(a){
		var k = a.slice(1,-1);
		if(k in entityMap){
			return entityMap[k]; 
		}else if(k.charAt(0) === '#'){
			return fixedFromCharCode(parseInt(k.substr(1).replace('x','0x')))
		}else{
			errorHandler.error('entity not found:'+a);
			return a;
		}
	}
	function appendText(end){//has some bugs
		if(end>start){
			var xt = source.substring(start,end).replace(/&#?\w+;/g,entityReplacer);
			locator&&position(start);
			domBuilder.characters(xt,0,end-start);
			start = end
		}
	}
	function position(p,m){
		while(p>=lineEnd && (m = linePattern.exec(source))){
			lineStart = m.index;
			lineEnd = lineStart + m[0].length;
			locator.lineNumber++;
			//console.log('line++:',locator,startPos,endPos)
		}
		locator.columnNumber = p-lineStart+1;
	}
	var lineStart = 0;
	var lineEnd = 0;
	var linePattern = /.*(?:\r\n?|\n)|.*$/g
	var locator = domBuilder.locator;
	
	var parseStack = [{currentNSMap:defaultNSMapCopy}]
	var closeMap = {};
	var start = 0;
	while(true){
		try{
			var tagStart = source.indexOf('<',start);
			if(tagStart<0){
				if(!source.substr(start).match(/^\s*$/)){
					var doc = domBuilder.doc;
	    			var text = doc.createTextNode(source.substr(start));
	    			doc.appendChild(text);
	    			domBuilder.currentElement = text;
				}
				return;
			}
			if(tagStart>start){
				appendText(tagStart);
			}
			switch(source.charAt(tagStart+1)){
			case '/':
				var end = source.indexOf('>',tagStart+3);
				var tagName = source.substring(tagStart+2,end);
				var config = parseStack.pop();
				if(end<0){
					
	        		tagName = source.substring(tagStart+2).replace(/[\s<].*/,'');
	        		//console.error('#@@@@@@'+tagName)
	        		errorHandler.error("end tag name: "+tagName+' is not complete:'+config.tagName);
	        		end = tagStart+1+tagName.length;
	        	}else if(tagName.match(/\s</)){
	        		tagName = tagName.replace(/[\s<].*/,'');
	        		errorHandler.error("end tag name: "+tagName+' maybe not complete');
	        		end = tagStart+1+tagName.length;
				}
				//console.error(parseStack.length,parseStack)
				//console.error(config);
				var localNSMap = config.localNSMap;
				var endMatch = config.tagName == tagName;
				var endIgnoreCaseMach = endMatch || config.tagName&&config.tagName.toLowerCase() == tagName.toLowerCase()
		        if(endIgnoreCaseMach){
		        	domBuilder.endElement(config.uri,config.localName,tagName);
					if(localNSMap){
						for(var prefix in localNSMap){
							domBuilder.endPrefixMapping(prefix) ;
						}
					}
					if(!endMatch){
		            	errorHandler.fatalError("end tag name: "+tagName+' is not match the current start tagName:'+config.tagName );
					}
		        }else{
		        	parseStack.push(config)
		        }
				
				end++;
				break;
				// end elment
			case '?':// <?...?>
				locator&&position(tagStart);
				end = parseInstruction(source,tagStart,domBuilder);
				break;
			case '!':// <!doctype,<![CDATA,<!--
				locator&&position(tagStart);
				end = parseDCC(source,tagStart,domBuilder,errorHandler);
				break;
			default:
				locator&&position(tagStart);
				var el = new ElementAttributes();
				var currentNSMap = parseStack[parseStack.length-1].currentNSMap;
				//elStartEnd
				var end = parseElementStartPart(source,tagStart,el,currentNSMap,entityReplacer,errorHandler);
				var len = el.length;
				
				
				if(!el.closed && fixSelfClosed(source,end,el.tagName,closeMap)){
					el.closed = true;
					if(!entityMap.nbsp){
						errorHandler.warning('unclosed xml attribute');
					}
				}
				if(locator && len){
					var locator2 = copyLocator(locator,{});
					//try{//attribute position fixed
					for(var i = 0;i<len;i++){
						var a = el[i];
						position(a.offset);
						a.locator = copyLocator(locator,{});
					}
					//}catch(e){console.error('@@@@@'+e)}
					domBuilder.locator = locator2
					if(appendElement(el,domBuilder,currentNSMap)){
						parseStack.push(el)
					}
					domBuilder.locator = locator;
				}else{
					if(appendElement(el,domBuilder,currentNSMap)){
						parseStack.push(el)
					}
				}
				
				
				
				if(el.uri === 'http://www.w3.org/1999/xhtml' && !el.closed){
					end = parseHtmlSpecialContent(source,end,el.tagName,entityReplacer,domBuilder)
				}else{
					end++;
				}
			}
		}catch(e){
			errorHandler.error('element parse error: '+e)
			//errorHandler.error('element parse error: '+e);
			end = -1;
			//throw e;
		}
		if(end>start){
			start = end;
		}else{
			//TODO: 这里有可能sax回退，有位置错误风险
			appendText(Math.max(tagStart,start)+1);
		}
	}
}
function copyLocator(f,t){
	t.lineNumber = f.lineNumber;
	t.columnNumber = f.columnNumber;
	return t;
}

/**
 * @see #appendElement(source,elStartEnd,el,selfClosed,entityReplacer,domBuilder,parseStack);
 * @return end of the elementStartPart(end of elementEndPart for selfClosed el)
 */
function parseElementStartPart(source,start,el,currentNSMap,entityReplacer,errorHandler){
	var attrName;
	var value;
	var p = ++start;
	var s = S_TAG;//status
	while(true){
		var c = source.charAt(p);
		switch(c){
		case '=':
			if(s === S_ATTR){//attrName
				attrName = source.slice(start,p);
				s = S_EQ;
			}else if(s === S_ATTR_SPACE){
				s = S_EQ;
			}else{
				//fatalError: equal must after attrName or space after attrName
				throw new Error('attribute equal must after attrName');
			}
			break;
		case '\'':
		case '"':
			if(s === S_EQ || s === S_ATTR //|| s == S_ATTR_SPACE
				){//equal
				if(s === S_ATTR){
					errorHandler.warning('attribute value must after "="')
					attrName = source.slice(start,p)
				}
				start = p+1;
				p = source.indexOf(c,start)
				if(p>0){
					value = source.slice(start,p).replace(/&#?\w+;/g,entityReplacer);
					el.add(attrName,value,start-1);
					s = S_ATTR_END;
				}else{
					//fatalError: no end quot match
					throw new Error('attribute value no end \''+c+'\' match');
				}
			}else if(s == S_ATTR_NOQUOT_VALUE){
				value = source.slice(start,p).replace(/&#?\w+;/g,entityReplacer);
				//console.log(attrName,value,start,p)
				el.add(attrName,value,start);
				//console.dir(el)
				errorHandler.warning('attribute "'+attrName+'" missed start quot('+c+')!!');
				start = p+1;
				s = S_ATTR_END
			}else{
				//fatalError: no equal before
				throw new Error('attribute value must after "="');
			}
			break;
		case '/':
			switch(s){
			case S_TAG:
				el.setTagName(source.slice(start,p));
			case S_ATTR_END:
			case S_TAG_SPACE:
			case S_TAG_CLOSE:
				s =S_TAG_CLOSE;
				el.closed = true;
			case S_ATTR_NOQUOT_VALUE:
			case S_ATTR:
			case S_ATTR_SPACE:
				break;
			//case S_EQ:
			default:
				throw new Error("attribute invalid close char('/')")
			}
			break;
		case ''://end document
			//throw new Error('unexpected end of input')
			errorHandler.error('unexpected end of input');
			if(s == S_TAG){
				el.setTagName(source.slice(start,p));
			}
			return p;
		case '>':
			switch(s){
			case S_TAG:
				el.setTagName(source.slice(start,p));
			case S_ATTR_END:
			case S_TAG_SPACE:
			case S_TAG_CLOSE:
				break;//normal
			case S_ATTR_NOQUOT_VALUE://Compatible state
			case S_ATTR:
				value = source.slice(start,p);
				if(value.slice(-1) === '/'){
					el.closed  = true;
					value = value.slice(0,-1)
				}
			case S_ATTR_SPACE:
				if(s === S_ATTR_SPACE){
					value = attrName;
				}
				if(s == S_ATTR_NOQUOT_VALUE){
					errorHandler.warning('attribute "'+value+'" missed quot(")!!');
					el.add(attrName,value.replace(/&#?\w+;/g,entityReplacer),start)
				}else{
					if(currentNSMap[''] !== 'http://www.w3.org/1999/xhtml' || !value.match(/^(?:disabled|checked|selected)$/i)){
						errorHandler.warning('attribute "'+value+'" missed value!! "'+value+'" instead!!')
					}
					el.add(value,value,start)
				}
				break;
			case S_EQ:
				throw new Error('attribute value missed!!');
			}
//			console.log(tagName,tagNamePattern,tagNamePattern.test(tagName))
			return p;
		/*xml space '\x20' | #x9 | #xD | #xA; */
		case '\u0080':
			c = ' ';
		default:
			if(c<= ' '){//space
				switch(s){
				case S_TAG:
					el.setTagName(source.slice(start,p));//tagName
					s = S_TAG_SPACE;
					break;
				case S_ATTR:
					attrName = source.slice(start,p)
					s = S_ATTR_SPACE;
					break;
				case S_ATTR_NOQUOT_VALUE:
					var value = source.slice(start,p).replace(/&#?\w+;/g,entityReplacer);
					errorHandler.warning('attribute "'+value+'" missed quot(")!!');
					el.add(attrName,value,start)
				case S_ATTR_END:
					s = S_TAG_SPACE;
					break;
				//case S_TAG_SPACE:
				//case S_EQ:
				//case S_ATTR_SPACE:
				//	void();break;
				//case S_TAG_CLOSE:
					//ignore warning
				}
			}else{//not space
//S_TAG,	S_ATTR,	S_EQ,	S_ATTR_NOQUOT_VALUE
//S_ATTR_SPACE,	S_ATTR_END,	S_TAG_SPACE, S_TAG_CLOSE
				switch(s){
				//case S_TAG:void();break;
				//case S_ATTR:void();break;
				//case S_ATTR_NOQUOT_VALUE:void();break;
				case S_ATTR_SPACE:
					var tagName =  el.tagName;
					if(currentNSMap[''] !== 'http://www.w3.org/1999/xhtml' || !attrName.match(/^(?:disabled|checked|selected)$/i)){
						errorHandler.warning('attribute "'+attrName+'" missed value!! "'+attrName+'" instead2!!')
					}
					el.add(attrName,attrName,start);
					start = p;
					s = S_ATTR;
					break;
				case S_ATTR_END:
					errorHandler.warning('attribute space is required"'+attrName+'"!!')
				case S_TAG_SPACE:
					s = S_ATTR;
					start = p;
					break;
				case S_EQ:
					s = S_ATTR_NOQUOT_VALUE;
					start = p;
					break;
				case S_TAG_CLOSE:
					throw new Error("elements closed character '/' and '>' must be connected to");
				}
			}
		}//end outer switch
		//console.log('p++',p)
		p++;
	}
}
/**
 * @return true if has new namespace define
 */
function appendElement(el,domBuilder,currentNSMap){
	var tagName = el.tagName;
	var localNSMap = null;
	//var currentNSMap = parseStack[parseStack.length-1].currentNSMap;
	var i = el.length;
	while(i--){
		var a = el[i];
		var qName = a.qName;
		var value = a.value;
		var nsp = qName.indexOf(':');
		if(nsp>0){
			var prefix = a.prefix = qName.slice(0,nsp);
			var localName = qName.slice(nsp+1);
			var nsPrefix = prefix === 'xmlns' && localName
		}else{
			localName = qName;
			prefix = null
			nsPrefix = qName === 'xmlns' && ''
		}
		//can not set prefix,because prefix !== ''
		a.localName = localName ;
		//prefix == null for no ns prefix attribute 
		if(nsPrefix !== false){//hack!!
			if(localNSMap == null){
				localNSMap = {}
				//console.log(currentNSMap,0)
				_copy(currentNSMap,currentNSMap={})
				//console.log(currentNSMap,1)
			}
			currentNSMap[nsPrefix] = localNSMap[nsPrefix] = value;
			a.uri = 'http://www.w3.org/2000/xmlns/'
			domBuilder.startPrefixMapping(nsPrefix, value) 
		}
	}
	var i = el.length;
	while(i--){
		a = el[i];
		var prefix = a.prefix;
		if(prefix){//no prefix attribute has no namespace
			if(prefix === 'xml'){
				a.uri = 'http://www.w3.org/XML/1998/namespace';
			}if(prefix !== 'xmlns'){
				a.uri = currentNSMap[prefix || '']
				
				//{console.log('###'+a.qName,domBuilder.locator.systemId+'',currentNSMap,a.uri)}
			}
		}
	}
	var nsp = tagName.indexOf(':');
	if(nsp>0){
		prefix = el.prefix = tagName.slice(0,nsp);
		localName = el.localName = tagName.slice(nsp+1);
	}else{
		prefix = null;//important!!
		localName = el.localName = tagName;
	}
	//no prefix element has default namespace
	var ns = el.uri = currentNSMap[prefix || ''];
	domBuilder.startElement(ns,localName,tagName,el);
	//endPrefixMapping and startPrefixMapping have not any help for dom builder
	//localNSMap = null
	if(el.closed){
		domBuilder.endElement(ns,localName,tagName);
		if(localNSMap){
			for(prefix in localNSMap){
				domBuilder.endPrefixMapping(prefix) 
			}
		}
	}else{
		el.currentNSMap = currentNSMap;
		el.localNSMap = localNSMap;
		//parseStack.push(el);
		return true;
	}
}
function parseHtmlSpecialContent(source,elStartEnd,tagName,entityReplacer,domBuilder){
	if(/^(?:script|textarea)$/i.test(tagName)){
		var elEndStart =  source.indexOf('</'+tagName+'>',elStartEnd);
		var text = source.substring(elStartEnd+1,elEndStart);
		if(/[&<]/.test(text)){
			if(/^script$/i.test(tagName)){
				//if(!/\]\]>/.test(text)){
					//lexHandler.startCDATA();
					domBuilder.characters(text,0,text.length);
					//lexHandler.endCDATA();
					return elEndStart;
				//}
			}//}else{//text area
				text = text.replace(/&#?\w+;/g,entityReplacer);
				domBuilder.characters(text,0,text.length);
				return elEndStart;
			//}
			
		}
	}
	return elStartEnd+1;
}
function fixSelfClosed(source,elStartEnd,tagName,closeMap){
	//if(tagName in closeMap){
	var pos = closeMap[tagName];
	if(pos == null){
		//console.log(tagName)
		pos =  source.lastIndexOf('</'+tagName+'>')
		if(pos<elStartEnd){//忘记闭合
			pos = source.lastIndexOf('</'+tagName)
		}
		closeMap[tagName] =pos
	}
	return pos<elStartEnd;
	//} 
}
function _copy(source,target){
	for(var n in source){target[n] = source[n]}
}
function parseDCC(source,start,domBuilder,errorHandler){//sure start with '<!'
	var next= source.charAt(start+2)
	switch(next){
	case '-':
		if(source.charAt(start + 3) === '-'){
			var end = source.indexOf('-->',start+4);
			//append comment source.substring(4,end)//<!--
			if(end>start){
				domBuilder.comment(source,start+4,end-start-4);
				return end+3;
			}else{
				errorHandler.error("Unclosed comment");
				return -1;
			}
		}else{
			//error
			return -1;
		}
	default:
		if(source.substr(start+3,6) == 'CDATA['){
			var end = source.indexOf(']]>',start+9);
			domBuilder.startCDATA();
			domBuilder.characters(source,start+9,end-start-9);
			domBuilder.endCDATA() 
			return end+3;
		}
		//<!DOCTYPE
		//startDTD(java.lang.String name, java.lang.String publicId, java.lang.String systemId) 
		var matchs = split(source,start);
		var len = matchs.length;
		if(len>1 && /!doctype/i.test(matchs[0][0])){
			var name = matchs[1][0];
			var pubid = len>3 && /^public$/i.test(matchs[2][0]) && matchs[3][0]
			var sysid = len>4 && matchs[4][0];
			var lastMatch = matchs[len-1]
			domBuilder.startDTD(name,pubid && pubid.replace(/^(['"])(.*?)\1$/,'$2'),
					sysid && sysid.replace(/^(['"])(.*?)\1$/,'$2'));
			domBuilder.endDTD();
			
			return lastMatch.index+lastMatch[0].length
		}
	}
	return -1;
}



function parseInstruction(source,start,domBuilder){
	var end = source.indexOf('?>',start);
	if(end){
		var match = source.substring(start,end).match(/^<\?(\S*)\s*([\s\S]*?)\s*$/);
		if(match){
			var len = match[0].length;
			domBuilder.processingInstruction(match[1], match[2]) ;
			return end+2;
		}else{//error
			return -1;
		}
	}
	return -1;
}

/**
 * @param source
 */
function ElementAttributes(source){
	
}
ElementAttributes.prototype = {
	setTagName:function(tagName){
		if(!tagNamePattern.test(tagName)){
			throw new Error('invalid tagName:'+tagName)
		}
		this.tagName = tagName
	},
	add:function(qName,value,offset){
		if(!tagNamePattern.test(qName)){
			throw new Error('invalid attribute:'+qName)
		}
		this[this.length++] = {qName:qName,value:value,offset:offset}
	},
	length:0,
	getLocalName:function(i){return this[i].localName},
	getLocator:function(i){return this[i].locator},
	getQName:function(i){return this[i].qName},
	getURI:function(i){return this[i].uri},
	getValue:function(i){return this[i].value}
//	,getIndex:function(uri, localName)){
//		if(localName){
//			
//		}else{
//			var qName = uri
//		}
//	},
//	getValue:function(){return this.getValue(this.getIndex.apply(this,arguments))},
//	getType:function(uri,localName){}
//	getType:function(i){},
}




function _set_proto_(thiz,parent){
	thiz.__proto__ = parent;
	return thiz;
}
if(!(_set_proto_({},_set_proto_.prototype) instanceof _set_proto_)){
	_set_proto_ = function(thiz,parent){
		function p(){};
		p.prototype = parent;
		p = new p();
		for(parent in thiz){
			p[parent] = thiz[parent];
		}
		return p;
	}
}

function split(source,start){
	var match;
	var buf = [];
	var reg = /'[^']+'|"[^"]+"|[^\s<>\/=]+=?|(\/?\s*>|<)/g;
	reg.lastIndex = start;
	reg.exec(source);//skip <
	while(match = reg.exec(source)){
		buf.push(match);
		if(match[1])return buf;
	}
}

exports.XMLReader = XMLReader;


},{}]},{},[10,1]);
