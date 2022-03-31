const SymbolParser = require('./../utilities/parsers/SymbolParser'),
	buildPriceFormatter = require('../utilities/format/factories/price');

const AssetClass = require('./../utilities/data/AssetClass');

const cmdtyViewPriceFormatter = require('./../utilities/format/specialized/cmdtyView');

module.exports = (() => {
	'use strict';

	let profiles = { };

	let formatter = cmdtyViewPriceFormatter;

	/**
	 * Describes an instrument (associated with a unique symbol).
	 *
	 * @public
	 * @exported
	 */
	class Profile {
		constructor(symbol, name, exchangeId, unitCode, pointValue, tickIncrement, exchange, additional) {
			/**
			 * @property {string} symbol - Symbol of the instrument.
			 * @public
			 * @readonly
			 */
			this.symbol = symbol;

			/**
			 * @property {string} name - Name of the instrument.
			 * @public
			 * @readonly
			 */
			this.name = name;

			/**
			 * @property {string} exchange - Code for the listing exchange.
			 * @public
			 * @readonly
			 */
			this.exchange = exchangeId;

			/**
			 * @property {Exchange|null} exchangeRef - The {@link Exchange}.
			 * @public
			 * @readonly
			 */
			this.exchangeRef = exchange || null;

			/**
			 * @property {string} unitCode - Code indicating how a prices should be formatted.
			 * @public
			 * @readonly
			 */
			this.unitCode = unitCode;

			/**
			 * @property {string} pointValue - The change in value for a one point change in price.
			 * @public
			 * @readonly
			 */
			this.pointValue = pointValue;

			/**
			 * @property {number} tickIncrement - The minimum price movement.
			 * @public
			 * @readonly
			 */
			this.tickIncrement = tickIncrement;

			const info = SymbolParser.parseInstrumentType(this.symbol);

			const future = info !== null && info.asset === AssetClass.FUTURE;
			const option = info !== null && info.asset === AssetClass.FUTURE_OPTION;

			if (future || option) {
				/**
				 * @property {string|undefined} root - Root symbol (futures and futures options only).
				 * @public
				 * @readonly
				 */
				this.root = info.root;

				if (future) {
					/**
					 * @property {string|undefined} month - Month code (futures only).
					 */
					this.month = info.month;

					/**
					 * @property {number|undefined} year - Expiration year (futures only).
					 */
					this.year = info.year;

					/**
					 * @property {string|undefined} expiration - Expiration date, formatted as YYYY-MM-DD (futures only).
					 */
					this.expiration = null;

					/**
					 * @property {string|undefined} firstNotice - First notice date, formatted as YYYY-MM-DD (futures only).
					 */
					this.firstNotice = null;
				}
			}

			/**
			 * @property {AssetClass|null} asset - The instrument type (a.k.a. asset class). This will only be present when inference based on the instrument symbol is possible.
			 */
			this.asset = null;

			if (info && info.asset) {
				this.asset = info.asset;
			}

			if (typeof(additional) === 'object' && additional !== null) {
				for (let p in additional) {
					this[p] = additional[p];
				}
			}

			profiles[symbol] = this;
		}

		/**
		 * Given a price, returns a the human-readable string representation.
		 *
		 * @public
		 * @param {number} price
		 * @returns {string}
		 */
		formatPrice(price) {
			return formatter(price, this.unitCode, this);
		}

		/**
		 * Configures the logic used to format all prices using the {@link Profile#formatPrice} instance function.
		 * Alternately, the {@link Profile.setPriceFormatterCustom} function can be used for complete control over
		 * price formatting.
		 *
		 * @public
		 * @static
		 * @param {string} fractionSeparator - usually a dash or a period
		 * @param {boolean} specialFractions - usually true
		 * @param {string=} thousandsSeparator - usually a comma
		 */
		static setPriceFormatter(fractionSeparator, specialFractions, thousandsSeparator) {
			formatter = buildPriceFormatter(fractionSeparator, specialFractions, thousandsSeparator);
		}

		/**
		 * An alternative to {@link Profile.setPriceFormatter} which allows the consumer to specify
		 * a function to format prices. Use of this function overrides the rules set using the
		 * {link Profile.setPriceFormatter} function.
		 *
		 * @public
		 * @static
		 * @param {Callbacks.CustomPriceFormatterCallback} fn - The function to use for price formatting (which replaces the default logic).
		 */
		static setPriceFormatterCustom(fn) {
			formatter = fn;
		}

		/**
		 * Alias for the {@link Profile.setPriceFormatter} function.
		 *
		 * @public
		 * @static
		 * @ignore
		 * @deprecated
		 * @see {@link Profile.setPriceFormatter}
		 */
		static PriceFormatter(fractionSeparator, specialFractions, thousandsSeparator) {
			Profile.setPriceFormatter(fractionSeparator, specialFractions, thousandsSeparator);
		}

		/**
		 * @protected
		 * @ignore
		 */
		static get Profiles() {
			return profiles;
		}

		toString() {
			return `[Profile (symbol=${this.symbol})]`;
		}
	}

	return Profile;
})();