const { EventEmitter, once } = require('node:events')
const { WebSocket } = require('ws')
const { SignalStructure } = require('../nethernet/index')
const { v4fast: v4 } = require("uuid-1345")
const JSONBigInt = require('json-bigint')({ useNativeBigInt: true })

const MAX_RETRIES = 5

class NethernetJSONRPC extends EventEmitter {
    constructor(networkId, authflow, version, serverNetworkId) {
        super()
        this.networkId = networkId
        this.serverNetworkId = serverNetworkId
        this.authflow = authflow
        this.version = version
        this.ws = null
        this.credentials = []
        this.candidates = []
        this.signalCandidates = []

        this.pingInterval = null
        this.retryCount = 0
        this.destroyed = false
        this.lastLiveness = 0
        this.connectionId = null
        this.didSendCandidates = false
    }

    async connect() {
        if (this.ws?.readyState === WebSocket.OPEN) throw new Error('Already connected to signaling server.');
        this.destroyed = false

        await this.init()
        await Promise.race([
            once(this, "credentials"),

            new Promise((_, reject) => setTimeout(() => reject(), 15000))
        ])
    }

    async destroy(resume = false) {
        this.destroyed = !resume

        if (this.pingInterval) clearInterval(this.pingInterval)

        if (this.ws) {
            this.ws.removeAllListeners("open")
            this.ws.removeAllListeners("close")
            this.ws.removeAllListeners("error")
            this.ws.removeAllListeners("message")

            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                await new Promise((resolve) => {
                    const done = () => resolve()

                    this.ws.once("close", done)

                    try { this.ws.close(1000, "Normal close.") } catch { resolve() }
                })
            }
        }

        this.ws = null;

        if (resume) return this.reconnectWithBackoff()
    }

    async reconnectWithBackoff() {
        if (this.retryCount >= MAX_RETRIES) {
            this.emit("error", new Error("Signal reconnection failed after max retries"));
            return;
        }

        await new Promise((r) => setTimeout(r, 15000));

        try {
            await this.init();
        } catch (e) { }
    }

    async init() {
        const xbl = await this.authflow.getMinecraftBedrockServicesToken({ version: this.version })

        const address = `https://signal.franchise.minecraft-services.net/ws/v1.0/messaging/connect`;

        try {
            const ws = new WebSocket(address, { headers: { Authorization: xbl.mcToken, "session-id": this.networkId, "request-id": v4() } })

            this.ws = ws
            this.lastLiveness = Date.now()

            ws.on("open", () => {
                this.retryCount = 0
                this.lastLiveness = Date.now()
                ws.send(JSON.stringify({ params: {}, jsonrpc: "2.0", method: "Signaling_TurnAuth_v1_0", id: v4() }))
            })

            ws.on("close", (code, reason) => this.onClose(code, reason.toString()))
            ws.on("error", (err) => this.onError(err))
            ws.on("message", (data) => this.onMessage(data))

            if (!this.pingInterval) {
                this.pingInterval = setInterval(() => {
                    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

                    this.ws.send(JSON.stringify({ params: {}, jsonrpc: "2.0", method: "System_Ping_v1_0", id: v4() }))

                    if (Date.now() - this.lastLiveness > 60000) {
                        try {
                            this.ws.terminate?.()
                        } catch { }
                    }
                }, 2000)
            }
        } catch (error) {
            this.emit("error", error)
        }
    }

    onError(err) {
        console.error(err);
        this.client.emit("error", `Signaling WebSocket error`)
    }

    async onClose(code, reason) {
        if (this.ws === null && this.pingInterval) clearInterval(this.pingInterval)
        if (this.destroyed) return

        // 1006 closure
        // 1011 error
        // 4401 unauthorized
        const retryable = [1000, 1006, 1011, 4401].includes(code) || code === 0

        if (retryable && this.retryCount < MAX_RETRIES) {
            this.retryCount++
            await this.destroy(true)
        } else {
            await this.destroy(false)
            this.emit("error", new Error(`Signal closed: ${code} ${reason}`))
        }
    }

    onMessage(res) {
        this.lastLiveness = Date.now()

        let message = null

        try {
            if (typeof res === "string") {
                message = JSON.parse(res)
            } else if (Buffer.isBuffer(res)) {
                message = JSON.parse(res.toString("utf8"))
            } else {
                return
            }
        } catch (error) {
            return
        }

        if (Array.isArray(message.result?.TurnAuthServers)) {
            this.credentials = parseTurnServers(JSON.stringify(message.result))
            this.emit("credentials", this.credentials)
        }

        switch (message.method) {
            case "System_Pong_v1_0":
                this.ws.send(JSON.stringify({ id: message.id, result: null, jsonrpc: "2.0" }))
                break
            case "Signaling_ReceiveMessage_v1_0":
                this.ws.send(JSON.stringify({
                    id: message.id,
                    result: null,
                    jsonrpc: "2.0"
                }))

                const params = Array.isArray(message.params)
                    ? message.params
                    : [message.params]

                for (const param of params) {
                    let signalMessage = param.Message

                    try {
                        const parsed = JSON.parse(param.Message)

                        switch (parsed.method) {
                            case "Signaling_WebRtc_v1_0":
                                if (parsed.params?.message) signalMessage = parsed.params.message
                                break;

                            case "Signaling_DeliveryNotification_V1_0":
                                continue;
                        }
                    } catch (e) {
                        console.error(`error stack at onMessage; ${e} ${e.message}`)
                    }

                    if (signalMessage.includes("could not be delivered")) continue

                    const signal = SignalStructure.fromString(signalMessage)
                    signal.connectionId = BigInt(signal.connectionId)
                    signal.networkId = this.networkId
                    signal.serverNetworkId = param.From ?? this.serverNetworkId

                    if (signal.type === "CANDIDATEADD") {
                        signal.data += " network-cost 10"

                        if (!this.didSendCandidates) {
                            this.signalCandidates.push(signal)
                            continue
                        }
                    }

                    if (
                        signal.type === "CONNECTRESPONSE" &&
                        signal.connectionId === this.connectionId &&
                        !this.didSendCandidates
                    ) {
                        for (const candidate of this.candidates) this.write(candidate)
                        for (const signalCandidate of this.signalCandidates) this.emit("signal", signalCandidate)

                        this.didSendCandidates = true
                    }

                    this.emit("signal", signal)
                }

                break
            default:
                break
        }
    }

    write(signal) {
        if (!this.ws) throw new Error('WebSocket not connected')


        if (signal.type === "CANDIDATEADD" && !this.candidates.includes(signal)) {
            this.candidates.length === 0 ? signal.data += " network-cost 50" : signal.data += " network-cost 10"

            if (signal.data.includes("tcp") || signal.data.includes("::1") || signal.data.includes("127.0.0.1")) return;

            return this.candidates.push(signal)
        }

        if (signal.type === "CONNECTREQUEST") this.connectionId = signal.connectionId
        
        const uuidv4 = v4()
        const message = JSONBigInt.stringify({
            params: {
                toPlayerId: String(signal.serverNetworkId ?? this.serverNetworkId),
                messageId: uuidv4,
                message: JSONBigInt.stringify({
                    params: { netherNetId: String(signal.networkId), message: signal.toString() },
                    jsonrpc: "2.0",
                    method: "Signaling_WebRtc_v1_0"
                })
            },
            jsonrpc: "2.0",
            method: "Signaling_SendClientMessage_v1_0",
            id: uuidv4
        })

        this.ws.send(message)
    }

    sendDeliveryNotification(toPlayerId, messageId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

        const uuidv4 = v4()
        const message = JSONBigInt.stringify({
            params: {
                toPlayerId,
                messageId: uuidv4,
                message: JSONBigInt.stringify({
                    params: { messageId },
                    jsonrpc: "2.0",
                    method: "Signaling_DeliveryNotification_V1_0"
                })
            },
            jsonrpc: "2.0",
            method: "Signaling_SendClientMessage_v1_0",
            id: uuidv4
        })

        this.ws.send(message)
    }
}

module.exports = { NethernetJSONRPC }

function parseTurnServers(dataString) {
    const iceServers = []
    const turnServers = JSON.parse(dataString)?.TurnAuthServers ?? []

    for (const server of turnServers) {
        const username = typeof server?.Username === "string" ? server.Username : undefined
        const credential =
            typeof server?.Password === "string"
                ? server.Password
                : typeof server?.Credential === "string"
                    ? server.Credential
                    : undefined

        for (const rawUrl of server?.Urls ?? []) {
            const match = rawUrl.trim().match(
                /^(?<scheme>stuns?|turns?)(?::\/\/|:)?(?<host>[^:?\s]+)(?::(?<port>\d+))?(?:\?(?<query>.*))?$/i
            )

            if (!match?.groups) continue

            const scheme = match.groups.scheme.toLowerCase()
            const hostname = match.groups.host
            const port = Number(match.groups.port) || (scheme === "stuns" ? 3478 : 5349)

            if (!hostname) continue

            const isTurn = scheme.startsWith("turn")

            let transport = "udp"

            if (isTurn) {
                if (scheme === "turns") transport = "tcp"

                transport =
                    match.groups.query
                        ?.split("&")
                        .find(p => p.startsWith("transport="))
                        ?.split("=")[1] ?? transport
            }

            const urls = new Set()

            const makeUrl = (scheme, port, transport) =>
                isTurn
                    ? `${scheme}:${hostname}:${port}?transport=${transport}`
                    : `${scheme}:${hostname}:${port}`

            urls.add(makeUrl(scheme, port, transport))

            if (isTurn) {
                if (transport !== "tcp")
                    urls.add(makeUrl(scheme, port, "udp"))

                if (scheme !== "turns")
                    urls.add(makeUrl("turns", 5349, "udp"))
            }

            for (const url of urls) {
                if (isTurn) {
                    iceServers.push({ urls: url, username, credential })
                } else {
                    iceServers.push({ urls: url })
                }
            }
        }
    }

    return iceServers
}