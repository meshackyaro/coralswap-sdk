import { SorobanRpc, xdr } from '@stellar/stellar-sdk';

/**
 * Transaction simulation utilities.
 *
 * Pre-flight checks before submitting transactions to Soroban.
 */

/**
 * Check if a simulation result is successful.
 */
export function isSimulationSuccess(
  sim: SorobanRpc.Api.SimulateTransactionResponse,
): boolean {
  return SorobanRpc.Api.isSimulationSuccess(sim);
}

/**
 * Extract the return value from a successful simulation.
 */
export function getSimulationReturnValue(
  sim: SorobanRpc.Api.SimulateTransactionResponse,
): xdr.ScVal | null {
  if (!SorobanRpc.Api.isSimulationSuccess(sim)) return null;
  return sim.result?.retval ?? null;
}

/**
 * Extract resource usage estimates from a simulation.
 */
export function getResourceEstimate(
  sim: SorobanRpc.Api.SimulateTransactionResponse,
): {
  cpuInstructions: number;
  memoryBytes: number;
  readBytes: number;
  writeBytes: number;
} | null {
  if (!SorobanRpc.Api.isSimulationSuccess(sim)) return null;

  const cost = sim.cost;
  return {
    cpuInstructions: cost?.cpuInsns ? Number(cost.cpuInsns) : 0,
    memoryBytes: cost?.memBytes ? Number(cost.memBytes) : 0,
    readBytes: 0,
    writeBytes: 0,
  };
}

/**
 * Check if a simulation exceeds budget limits.
 */
export function exceedsBudget(
  sim: SorobanRpc.Api.SimulateTransactionResponse,
  maxInstructions: number = 100_000_000,
): boolean {
  const resources = getResourceEstimate(sim);
  if (!resources) return true;
  return resources.cpuInstructions > maxInstructions;
}
