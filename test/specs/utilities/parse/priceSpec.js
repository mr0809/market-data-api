const parsePrice = require('../../../../lib/utilities/parse/price');

describe('when parsing prices', () => {
	'use strict';

	describe('when parsing invalid values (regardless of unit code)', () => {
		it('returns NaN when parsing a zero-length string', () => {
			expect(parsePrice('')).toEqual(Number.NaN);
		});

		it('returns NaN when parsing a non-numeric string', () => {
			expect(parsePrice('bob')).toEqual(Number.NaN);
		});

		it('returns NaN when parsing an undefined value', () => {
			expect(parsePrice(undefined)).toEqual(Number.NaN);
		});

		it('returns NaN when parsing an null value', () => {
			expect(parsePrice(null)).toEqual(Number.NaN);
		});
	});

	describe('with an implied, non-decimal fraction separator', () => {
		it('returns 125.625 (with unit code 2) when parsing "125-5"', () => {
			expect(parsePrice('125-5', '2')).toEqual(125.625);
		});

		it('returns -125.625 (with unit code 2) when parsing "-125-5"', () => {
			expect(parsePrice('-125-5', '2')).toEqual(-125.625);
		});

		it('returns 125.625 (with unit code 5) when parsing "125-240"', () => {
			expect(parsePrice('125-240', '5')).toEqual(125.75);
		});

		it('returns -125.625 (with unit code 5) when parsing "-125-240"', () => {
			expect(parsePrice('-125-240', '5')).toEqual(-125.75);
		});
	});
});

describe('when parsing prices (generated by formatter)', () => {
	describe('with a decimal fraction separator (implied)', () => {
		it('parses "377.000" (with unit code 2) as 377', () => {
			expect(parsePrice('377.000', '2')).toEqual(377);
		});

		it('parses "377.500" (with unit code 2) as 377.5', () => {
			expect(parsePrice('377.500', '2')).toEqual(377.5);
		});

		it('parses "377.750" (with unit code 2) as 377.75', () => {
			expect(parsePrice('377.750', '2')).toEqual(377.75);
		});

		it('parses "3770.750" (with unit code 2) as 3770.75', () => {
			expect(parsePrice('3770.750', '2')).toEqual(3770.75);
		});

		it('parses "37700.750" (with unit code 2) as 37700.75', () => {
			expect(parsePrice('37700.750', '2')).toEqual(37700.75);
		});

		it('parses "377000.750" (with unit code 2) as 377000.75', () => {
			expect(parsePrice('377000.750', '2')).toEqual(377000.75);
		});

		it('parses "3770000.750" (with unit code 2) as 3770000.75', () => {
			expect(parsePrice('3770000.750', '2')).toEqual(3770000.75);
		});

		it('parses "3770000.000" (with unit code 2) as 3770000', () => {
			expect(parsePrice('3770000.000', '2')).toEqual(3770000);
		});

		it('parses "0.000" (with unit code 2) as 0', () => {
			expect(parsePrice('0.000', '2')).toEqual(0);
		});

		/*
		it('parses undefined (with unit code 2) as zero-length string', () => {
			expect(formatPrice(undefined, '2', '.')).toEqual('');
		});

		it('parses null (with unit code 2) as zero-length string', () => {
			expect(formatPrice(null, '2', '.')).toEqual('');
		});

		it('parses Number.NaN (with unit code 2) as zero-length string', () => {
			expect(formatPrice(Number.NaN, '2', '.')).toEqual('');
		});

		it('parses 0 (with unit code 8) as "0"', () => {
			expect(formatPrice(0, '8', '.')).toEqual('0');
		});

		it('parses 1000 (with unit code 8) as "1000"', () => {
			expect(formatPrice(1000, '8', '.')).toEqual('1000');
		});
		*/
	});
	
});