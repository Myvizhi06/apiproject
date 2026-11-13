# Computer Networks, Protocol Lifecycles & Failure Semantics

## 1. The Client-Server Architectural Paradigm
The Internet's distributed application tier is fundamentally structured upon the **Client-Server model** (RFC 2616 / RFC 7230). In this paradigm:
- The **Client** acts as the initiating agent (requestor), constructing messages according to protocol syntax, binding transport sockets, and dispatching requests.
- The **Server** acts as the passive listening agent, continuously binding to a designated port (`0.0.0.0` or `127.0.0.1`), accepting inbound transmission streams, evaluating request semantics, and returning deterministic response packets.

In **API Sentinel**, the engine acts simultaneously in dual networking roles:
1. As an **HTTP Client** initiating outbound probes towards target APIs under strict timeout, idempotency, and SSRF rules.
2. As an **HTTP Server** exposing RESTful management endpoints and bi-directional WebSocket streams to browser clients.

---

## 2. HTTP/1.1 Request-Response Lifecycle

An API request traverses multiple networking layers before an application response is received:

```
[Application Layer (L7)]      HTTP Request: POST /api/payment HTTP/1.1
            │
[Transport Layer (L4)]        TCP 3-Way Handshake: SYN -> SYN-ACK -> ACK
            │
[Network Layer (L3)]          IP Routing & Packet Fragmentation
            │
[Physical / Link (L1/L2)]     Ethernet / Wi-Fi Frames
```

### The Exact Steps of an Execution Probe:
1. **URI Parsing & Scheme Validation**: The executor parses the target URI (e.g. `http://127.0.0.1:5000/api/demo/products`), extracting protocol, host, port, path, and query string.
2. **SSRF Pre-flight Verification**: Before socket initialization, the SSRF Guard verifies the destination against disallowed schemes and cloud metadata IP ranges.
3. **DNS Name Resolution**: Hostnames are resolved to IP addresses via `getaddrinfo` system calls.
4. **TCP Socket Allocation & 3-Way Handshake**:
   - Client sends `SYN` packet to server.
   - Server responds with `SYN-ACK`.
   - Client returns `ACK` and initiates data transmission.
5. **TLS Handshake (if HTTPS)**: ClientHello, ServerHello, Certificate exchange, asymmetric key agreement, and derivation of symmetric session keys (AES-GCM / ChaCha20).
6. **Data Streaming & Framing**: Client serializes headers and payload, flushing frames over the TCP stream.
7. **Server Processing & Response Delivery**: The server parses the request, executes business logic, and writes back response headers followed by the payload body.
8. **Socket Closure or Keep-Alive**: The connection is either returned to a connection pool (`Connection: keep-alive`) or terminated via `FIN-ACK`.

---

## 3. REST Architectural Constraints & HTTP Semantics
Representational State Transfer (REST) imposes six architectural constraints:
1. **Client-Server Separation**: Separation of user interface concerns from data storage concerns.
2. **Statelessness**: Every request contains all context necessary to understand and process the transaction; server session affinity is eliminated.
3. **Cacheability**: Responses explicitly declare whether they are cacheable via `Cache-Control` and `ETag` headers.
4. **Uniform Interface**: Identification of resources (`/orders/123`), manipulation through representations, and self-descriptive messages.
5. **Layered System**: Client cannot determine whether it is connected directly to the end server or an intermediate proxy/load balancer.
6. **Code on Demand** (Optional): Extensibility via client-side execution.

---

## 4. HTTP Status Codes & Failure Taxonomies

| Status Class | Code | Diagnostic Meaning | Sentinel Recovery Action |
| :--- | :--- | :--- | :--- |
| **2xx Success** | `200 OK`, `201 Created` | Request fulfilled successfully. | Transition FSM to `SUCCESS`. |
| **3xx Redirect** | `301`, `302`, `307`, `308` | Resource located elsewhere. | Handled hop-by-hop with SSRF re-validation. |
| **4xx Client Error** | `400 Bad Request` | Malformed syntax or payload. | Non-transient. Immediate `FAIL`. |
| **4xx Client Error** | `401 Unauthorized` | Missing or invalid authentication token. | Non-transient. Immediate `FAIL`. |
| **4xx Client Error** | `403 Forbidden` | Server understood but refuses authorization. | Non-transient. Immediate `FAIL`. |
| **4xx Client Error** | `404 Not Found` | Target URI endpoint does not exist. | Non-transient. Immediate `FAIL`. |
| **4xx Client Error** | `429 Too Many Requests` | Client exceeded rate limit quotas. | **Transient**. Honors `Retry-After` header. |
| **5xx Server Error** | `500 Internal Error` | Unexpected condition on server. | **Transient**. Triggers Exponential Backoff. |
| **5xx Server Error** | `502 Bad Gateway` | Upstream proxy received invalid response. | **Transient**. Triggers Retry. |
| **5xx Server Error** | `503 Unavailable` | Temporary server overload or maintenance. | **Transient**. Triggers Retry. |
| **5xx Server Error** | `504 Gateway Timeout`| Upstream gateway timed out waiting for server. | **Transient**. Triggers Retry. |

---

## 5. Network Failure Mechanisms
In real-world networks, failures occur across various physical and logical boundaries:
1. **Connection Timeout (`ETIMEDOUT`)**: Occurs when client dispatches a TCP `SYN` packet, but no `SYN-ACK` is returned within socket timeout thresholds (indicates firewall drop, routing blackhole, or unresponsive host).
2. **Connection Refused (`ECONNREFUSED`)**: Occurs when the target IP host is active and responds with a TCP `RST` packet because no server process is listening on the destination port.
3. **Connection Reset (`ECONNRESET`)**: Occurs when an established TCP connection is forcibly aborted by the remote server (e.g. process crash, OOM kill, unhandled exception).
4. **DNS Resolution Failure (`ENOTFOUND`, `EAI_AGAIN`)**: Occurs when the DNS resolver is unable to resolve the target domain name to an IP address.

---

## 6. Mathematical Model of Exponential Backoff with Jitter
When a transient network error is detected, blind retries risk causing a **Thundering Herd** or **Retry Storm**, exacerbating server overload.

API Sentinel implements truncated exponential backoff with full jitter:

$$T_{\text{wait}} = \min\left(T_{\text{max}}, \; T_{\text{base}} \times 2^{\text{attempt} - 1}\right) + \text{Uniform}(0, J_{\text{max}})$$

Where:
- $T_{\text{base}}$ is base delay (default $250\text{ms}$).
- $T_{\text{max}}$ is maximum cap (default $5000\text{ms}$).
- $J_{\text{max}}$ is random jitter cap (default $150\text{ms}$) to decorrelate concurrent retrying clients.

---

## 7. Honest Academic Disclosure: Scope of Network Observation
> **Academic Integrity Statement**:
> This platform implements **Layer 7 (Application Layer) Observation and Synthetic Simulation**. All metrics (latency, status codes, timeouts, connection drops) are observed through standard Node.js OS socket abstractions (`net.Socket`, `http.ClientRequest`).
>
> **The system does NOT perform raw packet capture, promiscuous network interface monitoring (PCAP/WinPcap), or kernel-level packet injection.** Network failure modes (500 errors, timeouts, connection resets, rate limits) are synthetically triggered and tested via controlled mock endpoints and socket closures.

