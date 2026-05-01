'use strict';

const FALLBACK = ['https://evmrpc-testnet.0g.ai'];

let rpcEndpoints;

if (process.env.RPC_URLS && process.env.RPC_URLS.trim().length > 0) {
  rpcEndpoints = process.env.RPC_URLS
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  if (rpcEndpoints.length === 0) {
    rpcEndpoints = FALLBACK;
  }
} else {
  rpcEndpoints = FALLBACK;
}

module.exports = rpcEndpoints;