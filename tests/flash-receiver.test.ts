import {
  encodeFlashLoanData,
  decodeFlashLoanData,
  calculateRepayment,
  validateFeeFloor,
} from '../src/contracts/flash-receiver';

describe('Flash Receiver Utilities', () => {
  describe('encodeFlashLoanData / decodeFlashLoanData', () => {
    it('roundtrips data correctly', () => {
      const data = { action: 'arbitrage', pair: 'XLM/USDC', minProfit: '100' };
      const encoded = encodeFlashLoanData(data);
      const decoded = decodeFlashLoanData(encoded);
      expect(decoded).toEqual(data);
    });
  });

  describe('calculateRepayment', () => {
    it('calculates principal + fee', () => {
      const repayment = calculateRepayment(10000n, 9);
      expect(repayment).toBe(10009n);
    });

    it('handles large amounts', () => {
      const amount = 1000000000000n;
      const repayment = calculateRepayment(amount, 9);
      const fee = (amount * 9n) / 10000n;
      expect(repayment).toBe(amount + fee);
    });
  });

  describe('validateFeeFloor', () => {
    it('validates fees above floor', () => {
      expect(validateFeeFloor(9, 5)).toBe(true);
    });

    it('rejects fees below floor', () => {
      expect(validateFeeFloor(3, 5)).toBe(false);
    });

    it('accepts fees at exact floor', () => {
      expect(validateFeeFloor(5, 5)).toBe(true);
    });
  });
});
