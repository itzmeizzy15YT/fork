const XboxAPI = require("./Xbox.js");
const fs = require("fs");
const skinData = require('../functions/bedrock/src/skins/steve.json')

const { v4fast: v4 } = require("uuid-1345");
const { androidDevice } = require("../functions/Util.js");

class PlayFabAPI extends XboxAPI {
	constructor(user) {
		super(user);

		this.apiUrl = "https://20ca2.playfabapi.com";
		this.api_headers = {
			"Accept": "application/json",
			"content-type": "application/json",
			"User-Agent": "libhttpclient/1.0.0.0",
			"Accept-Language": "en-US",
			"Accept-Encoding": "gzip, deflate, br",
			"Host": "20ca2.playfabapi.com",
			"Connection": "Keep-Alive",
			"Cache-Control": "no-cache"
		};
	}

	async loginWithXbox() {
		const authToken = await this.getXboxToken("https://b980a380.minecraft.playfabapi.com/");
		if (!authToken || authToken.errorMsg) return { errorMsg: "failed to get xbox token" };

		const body = JSON.stringify({
			CreateAccount: true,
			InfoRequestParameters: { GetPlayerProfile: true, GetUserAccountInfo: true },
			TitleId: "20CA2",
			XboxToken: authToken
		}, null, 2);

		const response = await fetch(`${this.apiUrl}/Client/LoginWithXbox`, {
			method: "POST",
			headers: this.api_headers,
			body
		});

		const data = await response.json();

		return data?.data ? data.data : data;
	}

	async getPublisherData() {
		const authData = await this.loginWithXbox();
		if (authData.errorMsg) return authData;

		const response = await fetch(`${this.apiUrl}/Client/GetUserPublisherData`, {
			method: "POST",
			headers: {
				...this.api_headers,
				"x-authorization": authData.SessionTicket
			}
		});

		const data = await response.json();

		if (data.status !== "OK") return { errorMsg: `${data.code} ${data.status}. errormessage: ${data.errorMessage} getPublisherData` };

		return data.data;
	}

	async updatePublisherData() {
		const authData = await this.loginWithXbox();

		if (authData.errorMsg) return authData;

		const publisherData = await this.getPublisherData();
		if (!publisherData || !publisherData.Data) return { errorMsg: "failed to get publisher data" };
		const profile = await this.getXboxUser(authData.InfoResultPayload?.AccountInfo?.XboxInfo?.XboxUserId);

		if (!profile) return { errorMsg: "failed to get xbox user data" };

		if (
			typeof publisherData?.Data?.GamertagHint?.Value != "undefined" &&
			typeof publisherData?.Data?.FilterProfanity?.Value != "undefined" &&
			typeof publisherData?.Data?.ReportCount?.Value != "undefined" &&
			publisherData?.Data?.GamertagHint?.Value === profile.gamertag &&
			publisherData?.Data?.DataVersion >= 1
		) return { msg: "No update was needed, gamertag and version match" };

		const body = JSON.stringify({
			Data: { "GamertagHint": profile.gamertag, "FilterProfanity": "false", "ReportCount": (Math.floor(Math.random() * 100)).toFixed(0) },
			Entity: { "Id": authData?.PlayFabId, "Type": "master_player_account" },
			Permission: "Public"
		}, null, 2);

		const response = await fetch(`${this.apiUrl}/Client/UpdateUserPublisherData`, {
			method: "POST",
			headers: {
				...this.api_headers,
				"x-authorization": authData.SessionTicket,
			},
			body
		});

		const data = await response.json();
		if (data.status !== "OK") return { errorMsg: `${data.code} ${data.status}. errormessage: ${data.errorMessage} updatePublisherData` };

		return data;
	}

	async getCurrency() {
		const authData = await this.loginWithXbox();

		if (authData.errorMsg) return authData;

		const response = await fetch(`${this.apiUrl}/inventory/GetVirtualCurrencies`, {
			method: "POST",
			headers: {
				...this.api_headers,
				"x-entitytoken": authData.EntityToken.EntityToken
			}
		})

		const data = await response.json();

		if (data.status !== "OK") return { errorMsg: `${data.code} ${data.status}. errormessage: ${data.errorMessage} GETCURRENCY` };

		return data;
	}

	async servicesToken() {
		const authData = await this.loginWithXbox();

		if (authData.errorMsg) return authData;

		const response = await fetch("https://authorization.franchise.minecraft-services.net/api/v1.0/session/start", {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'User-Agent': 'libhttpclient/1.0.0.0' },
			body: JSON.stringify({
				device: {
					applicationType: 'MinecraftPE',
					capabilities: ["VibrantVisuals"],
					gameVersion: "1.26.20",
					hardwareMemoryTier: 1,
					id: v4().replace(/-/g, ""),
					integrityToken: "",
					isPreview: false,
					memory: Math.floor(Math.random() * 1000000000),
					platform: androidDevice.deviceType,
					playFabTitleId: '20CA2',
					storePlatform: 'android.googleplay',
					treatmentOverrides: null,
					type: androidDevice.deviceType
				},
				user: {
					language: "en",
					languageCode: "en-US",
					regionCode: "US",
					token: authData.SessionTicket,
					tokenType: 'PlayFab'
				}
			})
		})

		const data = await response.json();

		return data
	}

	async uploadNewBanner(imageBuffer) {
		const token = (await this.flow.getMinecraftBedrockServicesToken({ version: "1.26.21" })).mcToken;

		const res = await fetch(
			`https://persona-secondary.franchise.minecraft-services.net/api/v1.0/gallery`,
			{
				method: "POST",
				headers: {
					Authorization: token,
					"User-Agent": "libhttpclient/1.0.0.0",
					Connection: "Keep-Alive",
					"Content-Type": "application/octet-stream",
					"x-ms-showcased-featured": "true",
					"x-ms-showcased-timetaken": "05/25/2026 18:17:11 PM",
					"Content-Length": String(imageBuffer.length),
					Host: "persona-secondary.franchise.minecraft-services.net"
				},
				body: imageBuffer
			}
		);

		const text = await res.text();

		return JSON.parse(text);
	}

	async getUserFeatured(xuid = this.xuid) {
		const token = (await this.flow.getMinecraftBedrockServicesToken({ version: "1.26.21" })).mcToken;

		const res = await fetch(
			`https://persona-secondary.franchise.minecraft-services.net/api/v1.0/gallery/featured/xuid/${xuid}`,
			{
				method: "GET",
				headers: {
					Authorization: token,
					"User-Agent": "libhttpclient/1.0.0.0",
					Connection: "Keep-Alive",
					Host: "persona-secondary.franchise.minecraft-services.net"
				}
			}
		);

		const text = await res.text().catch(() => null);
		return Buffer.from(text);
	}

	async uploadSkin(packUuid = skinData.PersonaPieces?.[0].PackId) {
		const token = (await this.flow.getMinecraftBedrockServicesToken({ version: "1.26.21" })).mcToken;

		const json = fs.readFileSync("./data/apperanceObjects.json", "utf8")
			.replaceAll("c18e65aa-7b21-4637-9b63-8ad63622ef01", packUuid);

		const res = await fetch(
			`https://persona-secondary.franchise.minecraft-services.net/api/v1.0/appearance`,
			{
				method: "PUT",
				body: json,
				headers: {
					Authorization: token,
					"User-Agent": "libhttpclient/1.0.0.0",
					Connection: "Keep-Alive",
					Host: "persona-secondary.franchise.minecraft-services.net"
				}
			}
		);

		return await res.text();
	}
}

module.exports = PlayFabAPI;