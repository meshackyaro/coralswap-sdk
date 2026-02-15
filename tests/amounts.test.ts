import {
  toSorobanAmount,
  fromSorobanAmount,
  formatAmount,
  toBps,
  applyBps,
  safeMul,
  safeDiv,
  minBigInt,
  maxBigInt,
} from '../src/utils/amounts';

describe('Amount Utilities', () => {
  describe('toSorobanAmount', () => {
    it('converts whole numbers', () => {
      expect(toSorobanAmount('1', 7)).toBe(10000000n);
    });

    it('converts decimal numbers', () => {
      expect(toSorobanAmount('1.5', 7)).toBe(15000000n);
    });

    it('handles zero', () => {
      expect(toSorobanAmount('0', 7)).toBe(0n);
    });

    it('truncates excess decimals', () => {
      expect(toSorobanAmount('1.123456789', 7)).toBe(11234567n);
    });

    it('pads short decimals', () => {
      expect(toSorobanAmount('1.5', 7)).toBe(15000000n);
    });
  });

  describe('fromSorobanAmount', () => {
    it('converts to decimal string', () => {
      expect(fromSorobanAmount(15000000n, 7)).toBe('1.5000000');
    });

    it('handles zero', () => {
      expect(fromSorobanAmount(0n, 7)).toBe('0.0000000');
    });

    it('handles negative amounts', () => {
      expect(fromSorobanAmount(-15000000n, 7)).toBe('-1.5000000');
    });
  });

  describe('formatAmount', () => {
    it('formats with display decimals', () => {
      expect(formatAmount(15000000n, 7, 2)).toBe('1.50');
    });

    it('formats with 4 display decimals by default', () => {
      expect(formatAmount(15123456n, 7)).toBe('1.5123');
    });
  });

  describe('toBps', () => {
    it('calculates basis points', () => {
      expect(toBps(30n, 10000n)).toBe(30);
    });

    it('handles zero denominator', () => {
      expect(toBps(30n, 0n)).toBe(0);
    });
  });

  describe('applyBps', () => {
    it('applies basis points to amount', () => {
      expect(applyBps(10000n, 30)).toBe(30n);
    });
  });

  describe('safeMul', () => {
    it('multiplies safely', () => {
      expect(safeMul(100n, 200n)).toBe(20000n);
    });
  });

  describe('safeDiv', () => {
    it('divides safely', () => {
      expect(safeDiv(200n, 100n)).toBe(2n);
    });

    it('throws on division by zero', () => {
      expect(() => safeDiv(200n, 0n)).toThrow('Division by zero');
    });
  });

  describe('minBigInt / maxBigInt', () => {
    it('returns minimum', () => {
      expect(minBigInt(100n, 200n)).toBe(100n);
    });

    it('returns maximum', () => {
      expect(maxBigInt(100n, 200n)).toBe(200n);
    });
  });
});
