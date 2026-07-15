import {
  createPublicClient,
  decodeEventLog,
  defineChain,
  http,
  parseAbi,
} from "viem";

const hash = "0x985affa890c9b02bff0b72b11848de16505866a663b3e3c02d7707c13344214b";
const memoAddress = "0x5294E9927c3306DcBaDb03fe70b92e01cCede505";
const arc = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});
const memoAbi = parseAbi([
  "event Memo(address indexed sender, address indexed target, bytes32 callDataHash, bytes32 indexed memoId, bytes memo, uint256 memoIndex)",
]);
const client = createPublicClient({ chain: arc, transport: http() });

const [transaction, receipt] = await Promise.all([
  client.getTransaction({ hash }),
  client.getTransactionReceipt({ hash }),
]);

if (!transaction || !receipt) throw new Error("Demo transaction was not returned by Arc RPC");
if (receipt.status !== "success") throw new Error("Demo transaction is not successful");

const memoLogs = receipt.logs.filter((log) => log.address.toLowerCase() === memoAddress.toLowerCase());
const decoded = memoLogs.flatMap((log) => {
  try {
    const event = decodeEventLog({ abi: memoAbi, data: log.data, topics: log.topics, strict: false });
    return event.eventName === "Memo" ? [event] : [];
  } catch {
    return [];
  }
});

if (!decoded.length) throw new Error("No Arc Memo events decoded from the live demo");

console.log(`Arc RPC: connected (chain ${await client.getChainId()})`);
console.log(`Transaction: ${receipt.status} at block ${receipt.blockNumber}`);
console.log(`Memo events decoded: ${decoded.length}`);
console.log("Smoke test passed");
