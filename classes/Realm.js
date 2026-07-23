"use strict";

const { generateRandomString, formatRealmApi } = require("../functions/Util.js");
const XboxAPI = require("./Xbox.js");

class realmAPI extends XboxAPI {
    constructor(user = null) {
        super(user);

        this.maxRetries = 3;
        this.user = user;
    }

    async init() {
        this.authToken = await this.getXboxToken("https://pocket.realms.minecraft.net/");

        this.headers = {
            authorization: this.authToken,
            Accept: "*/*",
            charset: "utf-8",
            "client-ref": generateRandomString(40, "0123456789abcdef"),
            "client-version": "1.26.33",
            "x-networkprotocolversion": "1001",
            "x-clientplatform": "Windows",
            "content-type": "application/json",
            "user-agent": "MCPE/UWP",
            "Accept-Language": "en-US",
            "Accept-Encoding": "gzip, deflate, br",
            Host: "pocket.realms.minecraft.net",
            Connection: "Keep-Alive"
        };
    }

    async #req(path, options = {}, name = "") {
        const url = typeof path === "string" && path.startsWith("http") ? path : `https://${this.headers.Host}${path}`;

        for (this.retryCount = -1; ; this.retryCount++) {
            if (this.retryCount > this.maxRetries) return { status: 429, body: { errorMsg: `crashing has limited your request amount, please try again later.`, errorCode: 429 } };

            try {
                const response = await fetch(url,
                    {
                        ...options,
                        headers: { ...this.headers, ...options.headers },
                        signal: AbortSignal.timeout(15000)
                    }
                );

                if (response.status === 429) return { status: 429, body: { errorMsg: "It appears crashing has been ratelimited from realmsAPI, please retry again later.", errorCode: 429 } };

                if ([502, 503, 504].includes(response.status) || response.status >= 500) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    continue;
                }

                const text = await response.text();
                let body;

                try { body = JSON.parse(text); } catch { body = text || null; }

                if (response.status === 403 && body?.errorMsg === "Timeline Opt-In is required for each member") {
                    let realmID = this.realmID;
                    if (url.includes("/join")) {
                        realmID = url.match(/\/(\d+)\/join$/)?.[1]
                    }
                    const storySettingsResponse = await this.postStorySettings(realmID, true, true, true, true)

                    if (storySettingsResponse.status === 204) {
                        return await this.getRealmIP(realmID)
                    } else {
                        return storySettingsResponse
                    }
                }

                return { status: response.status, body };
            } catch (error) {
                console.error(`${name} failed request; `, error.message || error);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await new Promise(resolve => setTimeout(resolve, 3500));
        }
    }

    async getRealmInfo(realmCode, fast = true) {
        const response = await this.#req(`https://bedrock.frontendlegacy.realms.minecraft-services.net/worlds/v1/link/${realmCode}`, { method: "GET" }, "getRealmInfo");
        if (response.status !== 200) return response;

        let body = response.body;
        if (fast) return body;

        if (!body?.member) await this.joinRealm(realmCode);
        body = await this.getRealmInfoByID(body.id);
        return body;
    }

    async getRealmInfoByID(realmID) {
        const response = await this.#req(`https://bedrock.frontendlegacy.realms.minecraft-services.net/worlds/${realmID}`, { method: "GET" }, "getRealmInfoByID");
        if (response.status !== 200) return response;
        return response.body;
    }

    async getActivePlayers(realmID = null) {
        let response = await this.#req(`https://bedrock.frontendlegacy.realms.minecraft-services.net/activities/live/players`, { method: "GET" }, "getActivePlayers")
        if (response.status !== 200 || !realmID) return response;

        response.body = response.body.servers.find((realm) => realm.id === Number(realmID))
        return response
    }

    async getRealmIP(realmID) {
        return await this.#req(`https://bedrock.frontendlegacy.realms.minecraft-services.net/worlds/${realmID}/join`, { method: "GET" }, "getRealmIP");
    }

    async postStorySettings(realmID, notifications, autostories, coordinates, timeline) {
        const body = JSON.stringify({ timeline, autostories, coordinates, notifications, playerOptIn: "OPT_IN", realmOptIn: "OPT_IN" });
        return await this.#req(`https://bedrock.frontendlegacy.realms.minecraft-services.net/worlds/${realmID}/stories/settings`, { method: "POST", body, retryServerError: false }, "postStorySettings");
    }

    async getStorySettings(realmID) {
        return await this.#req(`https://bedrock.frontendlegacy.realms.minecraft-services.net/worlds/${realmID}/stories/settings`, { method: "GET" }, "getStorySettings")
    }

    async getStory(realmID) {
        return await this.#req(`https://frontend.realms.minecraft-services.net/api/v1.0/worlds/${realmID}/stories`, { method: "GET" }, "getStory");
    }

    async getWorlds() {
        return await this.#req(`https://bedrock.frontendlegacy.realms.minecraft-services.net/worlds`, { method: "GET" }, "getWorlds");
    }

    async joinRealm(realmCode) {
        return await this.#req(`https://bedrock.frontendlegacy.realms.minecraft-services.net/invites/v1/link/accept/${realmCode}`, { method: "POST" }, "joinRealm");
    }

    async leaveRealm(realmID) {
        return await this.#req(`https://bedrock.frontendlegacy.realms.minecraft-services.net/invites/${realmID}`, { method: "DELETE" }, "leaveRealm")
    }

    async getInvites() {
        return await this.#req(`https://bedrock.frontendlegacy.realms.minecraft-services.net/invites/pending`, { method: "GET" }, "getInvites")
    }

    async acceptInvite(inviteID) {
        return await this.#req(`https://bedrock.frontendlegacy.realms.minecraft-services.net/invites/accept/${inviteID}`, { method: "PUT" }, "acceptInvite")
    }

    async rejectInvite(inviteID) {
        return await this.#req(`https://bedrock.frontendlegacy.realms.minecraft-services.net/invites/reject/${inviteID}`, { method: "PUT" }, "rejectInvite")
    }

    async doRealmChecks(realm = null, host = null) {
        if (!realm && !host) return;
        
        if (realm) {
            if (typeof realm.status === "number") {
                return { errorMsg: `${formatRealmApi[realm.body?.errorCode] || realm.body?.errorMsg} ${realm.body?.errorCode}` };
            }

            if (realm.body?.errorMsg) return { errorMsg: `${formatRealmApi[realm.body.errorCode] || realm.body.errorMsg} ${realm.body.errorCode}` };
            if (!realm.id) return { errorMsg: "Woah no realm ID was found, please retry this command! 404" };
            if (realm.maxPlayers == 2) return { errorMsg: "Realm is a 2 player realm, crashing only works on 10+ player realms! 501" };
            if (this.user.sticky.xuid === realm.ownerUUID) return { errorMsg: "You are the owner of this realm, you cannot crash it! 403" };
        }

        if (host) {
            if (host.status !== 200) return { errorMsg: `${host.body?.errorMsg} ${host.body?.errorCode}` };
            if (!host.body || typeof host.body.networkProtocol !== "string") return { errorMsg: "The realm networking Protocol wasnt a string, or was invalid, please try again later! 403" };
            
            if (!["NETHERNET", "DEFAULT", "NETHERNET_JSONRPC"].includes(host.body.networkProtocol)) return { errorMsg: "This realm is using a unsupported type of protocol. 501" };
            if (typeof host.body.address !== "string") return { errorMsg: "The realm address wasnt a string, or was invalid, please try again later! 403" };
            if (
                (host.body.networkProtocol === "DEFAULT" && !host.body.address.includes(":")) ||
                (host.body.networkProtocol.includes("NETHERNET") && !host.body.address.includes("-"))
            ) return { errorMsg: "It appears mojang has sent an invalid address back for this networking type, please try again later. 501" };
        }

        return false
    }
}

module.exports = realmAPI;
