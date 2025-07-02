"""
track_fresh_mints.py
Scans recent Solana slots for newly created token mints.
"""

from solana.rpc.api import Client
from solana.publickey import PublicKey
import time

RPC_URL = "https://api.mainnet-beta.solana.com"
PROGRAM_ID = PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")

def track_fresh_mints(lookback_slots: int = 5000):
    client = Client(RPC_URL)
    current_slot = client.get_slot()["result"]
    start_slot = current_slot - lookback_slots

    # fetch all program accounts
    resp = client.get_program_accounts(PROGRAM_ID)
    fresh = []
    for acct in resp["result"]:
        slot = acct["account"]["data"][1]  # simplistic placeholder
        if start_slot <= slot <= current_slot:
            fresh.append({
                "mint": acct["pubkey"],
                "firstSeenSlot": slot
            })

    return fresh

if __name__ == "__main__":
    while True:
        mints = track_fresh_mints()
        print(f"Found {len(mints)} fresh mints:")
        for m in mints:
            print("  ", m)
        time.sleep(300)
