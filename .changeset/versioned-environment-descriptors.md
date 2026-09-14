---
"@jmfederico/pi-web": patch
---

Report each environment's protocol version and capabilities from the gateway and have the Web client connect, degrade, or block on that descriptor instead of assuming a compatible remote. Machines that cannot serve the versioned protocol are marked incompatible before use, and session transcripts load through the shared client runtime with exactly-once event reconciliation.
