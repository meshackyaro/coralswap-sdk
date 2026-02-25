import {
  isValidPublicKey,
  isValidContractId,
  isValidAddress,
  isNativeToken,
  sortTokens,
  truncateAddress,
} from '../src/utils/addresses';

describe('Address Utilities', () => {
  const VALID_PUBLIC_KEY = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
  const VALID_CONTRACT = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

  describe('isValidPublicKey', () => {
    it('validates correct public keys', () => {
      expect(isValidPublicKey(VALID_PUBLIC_KEY)).toBe(true);
    });

    it('rejects invalid keys', () => {
      expect(isValidPublicKey('invalid')).toBe(false);
    });

    it('rejects contract addresses', () => {
      expect(isValidPublicKey(VALID_CONTRACT)).toBe(false);
    });
  });

  describe('isValidContractId', () => {
    it('validates correct contract IDs', () => {
      expect(isValidContractId(VALID_CONTRACT)).toBe(true);
    });

    it('rejects invalid IDs', () => {
      expect(isValidContractId('invalid')).toBe(false);
    });
  });

  describe('isValidAddress', () => {
    it('validates public keys', () => {
      expect(isValidAddress(VALID_PUBLIC_KEY)).toBe(true);
    });

    it('validates contract IDs', () => {
      expect(isValidAddress(VALID_CONTRACT)).toBe(true);
    });

    it('rejects invalid addresses', () => {
      expect(isValidAddress('xyz')).toBe(false);
    });
  });

  describe('isNativeToken', () => {
    it('returns true for XLM symbol (case-insensitive)', () => {
      expect(isNativeToken('XLM')).toBe(true);
      expect(isNativeToken('xlm')).toBe(true);
    });

    it('returns true for generic native identifier', () => {
      expect(isNativeToken('native')).toBe(true);
      expect(isNativeToken(' NATIVE ')).toBe(true);
    });

    it('returns false for empty or whitespace-only input', () => {
      expect(isNativeToken('')).toBe(false);
      expect(isNativeToken('   ')).toBe(false);
    });

    it('returns false for real Stellar addresses', () => {
      expect(isNativeToken(VALID_PUBLIC_KEY)).toBe(false);
      expect(isNativeToken(VALID_CONTRACT)).toBe(false);
    });

    it('returns false for arbitrary asset identifiers', () => {
      expect(isNativeToken('USDC')).toBe(false);
      expect(isNativeToken('TOKEN:ISSUER')).toBe(false);
    });
  });

  describe('sortTokens', () => {
    it('sorts tokens deterministically', () => {
      const [a, b] = sortTokens('B_TOKEN', 'A_TOKEN');
      expect(a).toBe('A_TOKEN');
      expect(b).toBe('B_TOKEN');
    });

    it('throws on identical tokens', () => {
      expect(() => sortTokens('A_TOKEN', 'A_TOKEN')).toThrow('Identical');
    });
  });

  describe('truncateAddress', () => {
    it('truncates long addresses', () => {
      const truncated = truncateAddress(VALID_PUBLIC_KEY, 4);
      expect(truncated).toBe('GAAA...AWHF');
    });

    it('preserves short strings', () => {
      expect(truncateAddress('short')).toBe('short');
    });
  });
});
