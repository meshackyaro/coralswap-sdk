import { xdr, Address, SorobanRpc } from '@stellar/stellar-sdk';
import {
  CoralSwapEvent,
  SwapEvent,
  LiquidityEvent,
  FlashLoanEvent,
  FeeUpdateEvent,
  ProposalEvent,
} from '../types/events';
import { ValidationError } from '../errors';

// ---------------------------------------------------------------------------
// Known event topic names emitted by CoralSwap Pair contracts
// ---------------------------------------------------------------------------

/** Recognised event topic identifiers. */
export const EVENT_TOPICS = {
  SWAP: 'swap',
  ADD_LIQUIDITY: 'add_liquidity',
  REMOVE_LIQUIDITY: 'remove_liquidity',
  FLASH_LOAN: 'flash_loan',
  FEE_UPDATE: 'fee_update',
  PROPOSAL_SIGNED: 'proposal_signed',
  PROPOSAL_EXECUTED: 'proposal_executed',
} as const;

// ---------------------------------------------------------------------------
// ScVal decoding helpers (safe-guarded against invalid XDR)
// ---------------------------------------------------------------------------

/**
 * Decode an ScVal i128 to a bigint.
 * Handles both positive and negative values via hi/lo pair.
 */
function decodeI128(val: xdr.ScVal): bigint {
  const parts = val.i128();
  const lo = BigInt(parts.lo().toString());
  const hi = BigInt(parts.hi().toString());
  return (hi << 64n) + lo;
}

/**
 * Decode an ScVal u32 to a number.
 */
function decodeU32(val: xdr.ScVal): number {
  return val.u32();
}

/**
 * Decode an ScVal address to a string.
 */
function decodeAddress(val: xdr.ScVal): string {
  return Address.fromScVal(val).toString();
}

/**
 * Decode an ScVal symbol or string to a JS string.
 */
function decodeString(val: xdr.ScVal): string {
  const tag = val.switch().name;
  if (tag === 'scvSymbol') return val.sym().toString();
  if (tag === 'scvString') return val.str().toString();
  return val.value()?.toString() ?? '';
}

/**
 * Safely extract a value from an ScMap by key name.
 * Returns undefined when the key is missing instead of throwing.
 */
function getMapValue(map: xdr.ScMapEntry[], key: string): xdr.ScVal | undefined {
  for (const entry of map) {
    const k = entry.key();
    const tag = k.switch().name;
    let keyStr: string | undefined;
    if (tag === 'scvSymbol') keyStr = k.sym().toString();
    else if (tag === 'scvString') keyStr = k.str().toString();
    if (keyStr === key) return entry.val();
  }
  return undefined;
}

/**
 * Require a value from an ScMap by key, throwing if absent.
 */
function requireMapValue(map: xdr.ScMapEntry[], key: string): xdr.ScVal {
  const val = getMapValue(map, key);
  if (!val) {
    throw new ValidationError(`Missing required event field: ${key}`);
  }
  return val;
}

// ---------------------------------------------------------------------------
// Raw event type from Soroban RPC
// ---------------------------------------------------------------------------

/**
 * Shape of a single event returned by `getEvents()` on the Soroban RPC.
 * This mirrors `SorobanRpc.Api.EventResponse`.
 */
export interface RawSorobanEvent {
  type: string;
  ledger: number;
  contractId: string;
  id: string;
  pagingToken: string;
  topic: xdr.ScVal[];
  value: xdr.ScVal;
  inSuccessfulContractCall: boolean;
  txHash: string;
}

/**
 * Options for fetching events from Soroban RPC.
 */
export interface GetEventsOptions {
  startLedger?: number;
  contractIds?: string[];
  topics?: string[][];
  limit?: number;
}

// ---------------------------------------------------------------------------
// EventParser
// ---------------------------------------------------------------------------

/**
 * Utility for parsing Soroban contract events into typed CoralSwap objects.
 *
 * Input: raw events from `SorobanRpc.Server.getEvents()`.
 * Output: array of typed {@link CoralSwapEvent} objects.
 *
 * Events that cannot be parsed (unknown topics, malformed XDR) are silently
 * skipped to avoid breaking pagination loops. Use {@link parseStrict} to
 * throw on any parse failure instead.
 *
 * @example
 * ```ts
 * const parser = new EventParser();
 * const raw = await server.getEvents({ startLedger: 1000 });
 * const events = parser.parse(raw.events);
 * ```
 */
export class EventParser {
  /**
   * Parse an array of raw Soroban events, skipping unrecognised entries.
   *
   * @param events - Raw event array from `getEvents()` response.
   * @returns Typed CoralSwapEvent array (only successfully parsed events).
   */
  parse(events: RawSorobanEvent[]): CoralSwapEvent[] {
    const parsed: CoralSwapEvent[] = [];
    for (const raw of events) {
      try {
        const evt = this.parseSingle(raw);
        if (evt) parsed.push(evt);
      } catch {
        // Skip malformed events in lenient mode
      }
    }
    return parsed;
  }

  /**
   * Parse an array of raw events, throwing on any parse failure.
   *
   * @param events - Raw event array from `getEvents()` response.
   * @returns Typed CoralSwapEvent array.
   * @throws {ValidationError} If any event cannot be decoded.
   */
  parseStrict(events: RawSorobanEvent[]): CoralSwapEvent[] {
    return events.map((raw) => {
      const evt = this.parseSingle(raw);
      if (!evt) {
        throw new ValidationError(
          `Unrecognised event topic in contract ${raw.contractId}`,
          { id: raw.id, topics: raw.topic.map((t) => decodeString(t)) },
        );
      }
      return evt;
    });
  }

  /**
   * Parse a single raw Soroban event into a typed event, or return null
   * if the topic is not recognised.
   *
   * @param raw - A single raw event from the RPC.
   * @returns A typed CoralSwapEvent or null.
   * @throws {ValidationError} If XDR decoding fails on a recognised topic.
   */
  parseSingle(raw: RawSorobanEvent): CoralSwapEvent | null {
    if (!raw.topic || raw.topic.length === 0) return null;

    const topic = decodeString(raw.topic[0]);
    const base = {
      contractId: raw.contractId,
      ledger: raw.ledger,
      timestamp: raw.ledger, // ledger used as timestamp proxy
      txHash: raw.txHash,
    };

    try {
      switch (topic) {
        case EVENT_TOPICS.SWAP:
          return this.parseSwapEvent(raw, base);
        case EVENT_TOPICS.ADD_LIQUIDITY:
        case EVENT_TOPICS.REMOVE_LIQUIDITY:
          return this.parseLiquidityEvent(raw, base, topic as 'add_liquidity' | 'remove_liquidity');
        case EVENT_TOPICS.FLASH_LOAN:
          return this.parseFlashLoanEvent(raw, base);
        case EVENT_TOPICS.FEE_UPDATE:
          return this.parseFeeUpdateEvent(raw, base);
        case EVENT_TOPICS.PROPOSAL_SIGNED:
        case EVENT_TOPICS.PROPOSAL_EXECUTED:
          return this.parseProposalEvent(raw, base, topic as 'proposal_signed' | 'proposal_executed');
        default:
          return null;
      }
    } catch (err) {
      throw new ValidationError(
        `Failed to parse ${topic} event: ${err instanceof Error ? err.message : String(err)}`,
        { contractId: raw.contractId, id: raw.id },
      );
    }
  }

  // -------------------------------------------------------------------------
  // Individual event parsers
  // -------------------------------------------------------------------------

  /**
   * Parse a swap event.
   * Expected data: ScMap { sender, token_in, token_out, amount_in, amount_out, fee_bps }
   */
  private parseSwapEvent(
    raw: RawSorobanEvent,
    base: Omit<SwapEvent, 'type' | 'sender' | 'tokenIn' | 'tokenOut' | 'amountIn' | 'amountOut' | 'feeBps'>,
  ): SwapEvent {
    const map = raw.value.map();
    if (!map) throw new Error('Swap event data is not an ScMap');

    return {
      ...base,
      type: 'swap',
      sender: decodeAddress(requireMapValue(map, 'sender')),
      tokenIn: decodeAddress(requireMapValue(map, 'token_in')),
      tokenOut: decodeAddress(requireMapValue(map, 'token_out')),
      amountIn: decodeI128(requireMapValue(map, 'amount_in')),
      amountOut: decodeI128(requireMapValue(map, 'amount_out')),
      feeBps: decodeU32(requireMapValue(map, 'fee_bps')),
    };
  }

  /**
   * Parse an add_liquidity or remove_liquidity event.
   * Expected data: ScMap { provider, token_a, token_b, amount_a, amount_b, liquidity }
   */
  private parseLiquidityEvent(
    raw: RawSorobanEvent,
    base: Omit<LiquidityEvent, 'type' | 'provider' | 'tokenA' | 'tokenB' | 'amountA' | 'amountB' | 'liquidity'>,
    type: 'add_liquidity' | 'remove_liquidity',
  ): LiquidityEvent {
    const map = raw.value.map();
    if (!map) throw new Error('Liquidity event data is not an ScMap');

    return {
      ...base,
      type,
      provider: decodeAddress(requireMapValue(map, 'provider')),
      tokenA: decodeAddress(requireMapValue(map, 'token_a')),
      tokenB: decodeAddress(requireMapValue(map, 'token_b')),
      amountA: decodeI128(requireMapValue(map, 'amount_a')),
      amountB: decodeI128(requireMapValue(map, 'amount_b')),
      liquidity: decodeI128(requireMapValue(map, 'liquidity')),
    };
  }

  /**
   * Parse a flash_loan event.
   * Expected data: ScMap { borrower, token, amount, fee }
   */
  private parseFlashLoanEvent(
    raw: RawSorobanEvent,
    base: Omit<FlashLoanEvent, 'type' | 'borrower' | 'token' | 'amount' | 'fee'>,
  ): FlashLoanEvent {
    const map = raw.value.map();
    if (!map) throw new Error('FlashLoan event data is not an ScMap');

    return {
      ...base,
      type: 'flash_loan',
      borrower: decodeAddress(requireMapValue(map, 'borrower')),
      token: decodeAddress(requireMapValue(map, 'token')),
      amount: decodeI128(requireMapValue(map, 'amount')),
      fee: decodeI128(requireMapValue(map, 'fee')),
    };
  }

  /**
   * Parse a fee_update event.
   * Expected data: ScMap { previous_fee_bps, new_fee_bps, volatility }
   */
  private parseFeeUpdateEvent(
    raw: RawSorobanEvent,
    base: Omit<FeeUpdateEvent, 'type' | 'previousFeeBps' | 'newFeeBps' | 'volatility'>,
  ): FeeUpdateEvent {
    const map = raw.value.map();
    if (!map) throw new Error('FeeUpdate event data is not an ScMap');

    return {
      ...base,
      type: 'fee_update',
      previousFeeBps: decodeU32(requireMapValue(map, 'previous_fee_bps')),
      newFeeBps: decodeU32(requireMapValue(map, 'new_fee_bps')),
      volatility: decodeI128(requireMapValue(map, 'volatility')),
    };
  }

  /**
   * Parse a proposal_signed or proposal_executed governance event.
   * Expected data: ScMap { action_hash, signer, signatures_count }
   */
  private parseProposalEvent(
    raw: RawSorobanEvent,
    base: Omit<ProposalEvent, 'type' | 'actionHash' | 'signer' | 'signaturesCount'>,
    type: 'proposal_signed' | 'proposal_executed',
  ): ProposalEvent {
    const map = raw.value.map();
    if (!map) throw new Error('Proposal event data is not an ScMap');

    return {
      ...base,
      type,
      actionHash: decodeString(requireMapValue(map, 'action_hash')),
      signer: decodeAddress(requireMapValue(map, 'signer')),
      signaturesCount: decodeU32(requireMapValue(map, 'signatures_count')),
    };
  }
}
