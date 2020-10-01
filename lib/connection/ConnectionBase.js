const is = require('@barchart/common-js/lang/is');

const MarketState = require('./../marketState/MarketState');

module.exports = (() => {
	'use strict';

	let instanceCounter = 0;

	/**
	 * Contract for communicating with remove market data servers and
	 * querying current market state.
	 *
	 * @protected
	 * @abstract
	 * @ignore
	 */
	class ConnectionBase {
		constructor() {
			this._server = null;
			this._username = null;
			this._password = null;

			this._marketState = new MarketState(symbol => this._handleProfileRequest(symbol));

			this._pollingFrequency = null;
			this._extendedProfileMode = false;

			this._instance = ++instanceCounter;
		}

		/**
		 * Establishes WebSocket connection to Barchart's servers and authenticates. Success
		 * or failure is reported asynchronously by the **Events** subscription (see
		 * {@link Enums.SubscriptionType}).
		 *
		 * @public
		 * @param {string} server - Barchart hostname (contact solutions@barchart.com)
		 * @param {string} username - Your username (contact solutions@barchart.com)
		 * @param {string} password - Your password (contact solutions@barchart.com)
		 * @param {WebSocketAdapterFactory=} webSocketAdapterFactory - Strategy for creating a WebSocket (required for Node.js)
		 */
		connect(server, username, password, webSocketAdapterFactory) {
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
		_connect(webSocketAdapterFactory) {
			return;
		}

		/**
		 * Forces a disconnect from the server. All subscriptions are discarded.
		 *
		 * @public
		 */
		disconnect() {
			this._server = null;
			this._username = null;
			this._password = null;

			this._disconnect();
		}

		/**
		 * @protected
		 * @ignore
		 */
		_disconnect() {
			return;
		}

		/**
		 * Initiates a subscription, registering a callback for event notifications.
		 *
		 * @public
		 * @param {Enums.SubscriptionType} subscriptionType - The type of subscription
		 * @param {Callbacks.MarketDepthCallback|Callbacks.MarketUpdateCallback|Callbacks.CumulativeVolumeCallback|Callbacks.TimestampCallback|Callbacks.EventsCallback} callback - A function which will be invoked each time the event occurs
		 * @param {String=} symbol - A symbol (only applicable for market data subscriptions)
		 */
		on() {
			this._on.apply(this, arguments);
		}

		/**
		 * @protected
		 * @ignore
		 */
		_on() {
			return;
		}

		/**
		 * Drops a subscription (see {@link ConnectionBase#on}).
		 *
		 * @public
		 * @param {Enums.SubscriptionType} subscriptionType - The type of subscription
		 * @param {Callbacks.MarketDepthCallback|Callbacks.MarketUpdateCallback|Callbacks.CumulativeVolumeCallback|Callbacks.TimestampCallback|Callbacks.EventsCallback} callback - The **same** function which was passed to {@link ConnectionBase#on}
		 * @param {String=} symbol - The symbol (only applicable for market data subscriptions)
		 */
		off() {
			this._off.apply(this, arguments);
		}

		/**
		 * @protected
		 * @ignore
		 */
		_off() {
			return;
		}

		/**
		 * Pauses the data flow over the network. All subscriptions are maintained;
		 * however, callbacks will cease to be invoked.
		 *
		 * @public
		 */
		pause() {
			this._pause();
		}

		/**
		 * @protected
		 * @ignore
		 */
		_pause() {
			return;
		}

		/**
		 * Restarts the flow of data over the network. Subscription callbacks will once
		 * again be invoked.
		 *
		 * @public
		 */
		resume() {
			this._resume();
		}

		/**
		 * @protected
		 * @ignore
		 */
		_resume() {
			return;
		}

		getActiveSymbolCount() {
			return this._getActiveSymbolCount();
		}

		_getActiveSymbolCount() {
			return null;
		}

		/**
		 * By default, the server pushes data to the SDK. However, to save network
		 * bandwidth, the SDK can operate in a polling mode -- only updating
		 * periodically. Calling this function with a positive number will
		 * cause the SDK to begin polling. Calling this function with a null
		 * value will cause to SDK to resume normal operation.
		 *
		 * @public
		 * @param {number|null} pollingFrequency
		 */
		setPollingFrequency(pollingFrequency) {
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
		_onPollingFrequencyChanged(pollingFrequency) {
			return;
		}

		/**
		 * By default, the server pushes data to the SDK. However, to save network
		 * bandwidth, the SDK can operate in a polling mode -- only updating
		 * periodically. If the SDK is configured for polling, the frequency, in
		 * milliseconds will be returned. If the SDK is configured for normal operation,
		 * a null value will be returned.
		 *
		 * @public
		 * @returns {number|null}
		 */
		getPollingFrequency() {
			return this._pollingFrequency;
		}

		/**
		 * When set to true, additional properties properties become
		 * available on {@link Profile} instances (e.g. future contract
		 * expiration date). This is accomplished by making additional
		 * out-of-band queries to Barchart services.
		 *
		 * @public
		 * @param {Boolean}
		 */
		setExtendedProfileMode(mode) {
			if (is.boolean(mode) && this._extendedProfileMode !== mode) {
				this._extendedProfileMode = mode;

				this._onExtendedProfileModeChanged(this._extendedProfileMode);
			}
		}

		/**
		 * @protected
		 * @ignore
		 */
		_onExtendedProfileModeChanged(mode) {
			return;
		}

		/**
		 * Indicates if additional {@link Profile} data (e.g. future contract
		 * expiration dates) should be loaded (via out-of-band queries).
		 *
		 * @public
		 * @returns {boolean}
		 */
		getExtendedProfileMode() {
			return this._extendedProfileMode;
		}

		/**
		 * @protected
		 * @ignore
		 * @param {String}
		 */
		_handleProfileRequest(symbol) {
			return;
		}

		/**
		 * Returns the {@link MarketState} singleton -- which can be used to access
		 * {@link Quote}, {@link Profile}, and {@link CumulativeVolume} instances
		 * for any symbol subscribed symbol.
		 *
		 * @public
		 * @returns {MarketState}
		 */
		getMarketState() {
			return this._marketState;
		}

		/**
		 * The Barchart hostname.
		 *
		 * @public
		 * @returns {null|string}
		 */
		getServer() {
			return this._server;
		}

		/**
		 * The password used to authenticate to Barchart.
		 *
		 * @public
		 * @returns {null|string}
		 */
		getPassword() {
			return this._password;
		}

		/**
		 * The username used to authenticate to Barchart.
		 *
		 * @public
		 * @returns {null|string}
		 */
		getUsername() {
			return this._username;
		}

		/**
		 * Gets a unique identifier for the current instance.
		 *
		 * @protected
		 * @ignore
		 * @returns {Number}
		 */
		_getInstance() {
			return this._instance;
		}

		toString() {
			return `[ConnectionBase (instance=${this._instance}]`;
		}
	}

	return ConnectionBase;
})();