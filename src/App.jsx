import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import "./App.css";

const ARC = {
  chainId: "0x4cef52",
  chainIdDecimal: 5042002,
  chainName: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 6,
  },
  rpcUrls: ["https://rpc.testnet.arc.network"],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

const USDC = "0x3600000000000000000000000000000000000000";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function App() {
  const [account, setAccount] = useState("");
  const [balance, setBalance] = useState("0.000000");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);

  async function getProvider() {
    if (!window.ethereum) {
      throw new Error(
        "No EVM wallet found. Open PayFlow inside MetaMask or another EVM wallet browser."
      );
    }
    return new ethers.BrowserProvider(window.ethereum);
  }

  async function addOrSwitchArc(provider) {
    try {
      await provider.send("wallet_switchEthereumChain", [
        { chainId: ARC.chainId },
      ]);
    } catch (error) {
      if (error.code === 4902 || error.code === -32603) {
        await provider.send("wallet_addEthereumChain", [
          {
            chainId: ARC.chainId,
            chainName: ARC.chainName,
            nativeCurrency: ARC.nativeCurrency,
            rpcUrls: ARC.rpcUrls,
            blockExplorerUrls: ARC.blockExplorerUrls,
          },
        ]);
      } else {
        throw error;
      }
    }
  }

  async function loadBalance(address) {
    try {
      const provider = await getProvider();
      const network = await provider.getNetwork();

      if (Number(network.chainId) !== ARC.chainIdDecimal) {
        return;
      }

      const contract = new ethers.Contract(USDC, ERC20_ABI, provider);
      const decimals = await contract.decimals();
      const raw = await contract.balanceOf(address);

      setBalance(
        Number(ethers.formatUnits(raw, decimals)).toFixed(6)
      );
    } catch (error) {
      console.error(error);
    }
  }

  async function connectWallet() {
    try {
      setStatus("");
      setTxHash("");

      const provider = await getProvider();

      await provider.send("eth_requestAccounts", []);
      await addOrSwitchArc(provider);

      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      setAccount(address);
      setStatus("Wallet connected to Arc Testnet.");
      await loadBalance(address);
    } catch (error) {
      console.error(error);
      setStatus(error?.shortMessage || error?.message || "Wallet connection failed.");
    }
  }

  async function sendPayment(event) {
    event.preventDefault();

    if (!account) {
      setStatus("Connect your wallet first.");
      return;
    }

    if (!ethers.isAddress(recipient)) {
      setStatus("Please enter a valid recipient wallet address.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setStatus("Enter a valid USDC amount.");
      return;
    }

    try {
      setLoading(true);
      setStatus("Preparing transaction...");
      setTxHash("");

      const provider = await getProvider();
      await addOrSwitchArc(provider);

      const signer = await provider.getSigner();
      const sender = await signer.getAddress();

      const contract = new ethers.Contract(USDC, ERC20_ABI, signer);
      const decimals = await contract.decimals();

      const value = ethers.parseUnits(amount, decimals);
      const currentBalance = await contract.balanceOf(sender);

      if (currentBalance < value) {
        throw new Error("Insufficient USDC balance.");
      }

      setStatus("Waiting for wallet confirmation...");

      const tx = await contract.transfer(recipient, value);

      setTxHash(tx.hash);
      setStatus("Transaction submitted. Waiting for finality...");

      await tx.wait();

      setStatus("Payment confirmed on Arc Testnet.");
      setAmount("");
      setRecipient("");

      await loadBalance(sender);
    } catch (error) {
      console.error(error);
      setStatus(
        error?.shortMessage ||
        error?.reason ||
        error?.message ||
        "Transaction failed."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccounts = async (accounts) => {
      if (!accounts.length) {
        setAccount("");
        setBalance("0.000000");
        return;
      }

      setAccount(accounts[0]);
      await loadBalance(accounts[0]);
    };

    const handleChain = async () => {
      if (account) {
        await loadBalance(account);
      }
    };

    window.ethereum.on("accountsChanged", handleAccounts);
    window.ethereum.on("chainChanged", handleChain);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccounts);
      window.ethereum.removeListener("chainChanged", handleChain);
    };
  }, [account]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">P</div>
          <div>
            <div className="brand-name">PayFlow</div>
            <div className="brand-sub">Built on Arc</div>
          </div>
        </div>

        <button className="connect" onClick={connectWallet}>
          {account ? shortAddress(account) : "Connect Wallet"}
        </button>
      </header>

      <main>
        <div className="network-pill">● ARC TESTNET</div>

        <h1>Simple USDC payments.</h1>
        <p className="hero-text">
          Send native USDC on Arc with fast, simple and transparent settlement.
        </p>

        <section className="grid">
          <div className="card balance-card">
            <div className="label">Your USDC Balance</div>
            <div className="balance">
              {balance}
              <span>USDC</span>
            </div>

            <div className="wallet-status">
              <span className={account ? "dot online" : "dot"}></span>
              {account ? `Connected: ${shortAddress(account)}` : "Wallet not connected"}
            </div>
          </div>

          <form className="card payment-card" onSubmit={sendPayment}>
            <div className="payment-heading">
              <div>
                <h2>Send Payment</h2>
                <p>Transfer USDC directly to another wallet.</p>
              </div>
              <div className="arrow">↗</div>
            </div>

            <label>Recipient Address</label>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              autoComplete="off"
            />

            <label>Amount</label>
            <div className="amount-wrap">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
              <span>USDC</span>
            </div>

            <button className="send" type="submit" disabled={loading}>
              {loading ? "Processing..." : "Send USDC"}
            </button>

            {status && <div className="status">{status}</div>}

            {txHash && (
              <a
                className="tx-link"
                href={`https://testnet.arcscan.app/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View transaction on Arcscan ↗
              </a>
            )}
          </form>
        </section>

        <section className="features">
          <div>
            <strong>USDC Native</strong>
            <span>USDC is Arc's native gas asset.</span>
          </div>

          <div>
            <strong>Fast Finality</strong>
            <span>Transactions settle with deterministic finality.</span>
          </div>

          <div>
            <strong>Onchain</strong>
            <span>Every payment can be verified on Arcscan.</span>
          </div>
        </section>

        <footer>
          PayFlow · Built on Arc · Arc Testnet
        </footer>
      </main>
    </div>
  );
}
