//TODO WRITE THIS WHOLE CLASS

const { Authflow } = require("prismarine-auth");
const { cacheFactory, androidDevice } = require('../functions/Util');
const { v4 } = require("uuid");

function buildBlockUrl(uri) { return `${uri}&comp=block&blockId=${encodeURIComponent(Buffer.from("BlockId0000001").toString("base64"))}` }

class XboxAPI {
  constructor(user) {
    this.flow = new Authflow(undefined, cacheFactory(user), { flow: androidDevice.flow, authTitle: androidDevice.authTitle, deviceType: androidDevice.deviceType });

    this.headers = {
      "x-xbl-contract-version": 3,
      "Accept-Encoding": "gzip, deflate",
      "Accept": "application/json",
      "Accept-Language": "en-US",
      "Authorization": "",
      "Host": "",
      "Connection": "Keep-Alive",
      "User-Agent": "WindowsGameBar/5.823.1271.0"
    };
  }

  async cleanUser(user) {
    user.linked = false
    user.linkData = {}
    user.sticky = { xuid: null, playfabId: null, gamertag: null }

    await user.save()
  }

  async #req(url, options = {}) {
    const authToken = await this.getXboxToken();
    if (authToken?.errorMsg) return authToken;

    const host = new URL(url).host;
    this.headers["Host"] = host;
    this.headers["Authorization"] = authToken;

    const response = await fetch(url, { ...options, headers: { ...this.headers, ...options.headers } });
    switch (response.status) {
      case 200:
      case 201:
      case 202:
      case 204:
        if (response.status === 204) return "success";
        const text = await response.text();

        try { return JSON.parse(text); } catch { return text; }
      default:
        return { errorMsg: await response.text(), status: response.status };
    }
  }

  async getXboxToken(relyingParty) {
    const xboxToken = await this.flow.getXboxToken(relyingParty);

    if (typeof xboxToken.userXUID === "string" || typeof xboxToken.userXUID === "number") this.xuid = xboxToken?.userXUID;

    return `XBL3.0 x=${xboxToken.userHash};${xboxToken.XSTSToken}`;
  }

  async getXboxUserBulk(xuids = []) {
    if (xuids.length === 0) return [];
    const result = await this.#req("https://peoplehub.xboxlive.com/users/me/people/batch/decoration/detail,presenceDetail", { method: "POST", contractVersion: 4, body: JSON.stringify({ xuids }) });
    return result?.people ? result.people : result;
  }

  async sendPresence(body) {
    return await this.#req(`https://userpresence.xboxlive.com/users/xuid(${this.xuid})/devices/current/titles/current`, { method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-cache" }, body: JSON.stringify(body) });
  }

  async sendInGamePresence(realm, inGame) {
    return await this.#req(`https://clubpresence.xboxlive.com/clubs/${realm.clubId}/users/xuid(${this.xuid})/session?titleFamilyId=3347393a-1a27-4e26-a623-31173bb86ee1`, { method: "POST", userAgent: "libhttpclient/1.0.0.0", contractVersion: 1, headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "Accept-Encoding": "gzip, deflate, br" }, body: JSON.stringify({ "inGame": inGame }) });
  }

  async getXboxUser(xuid) {
    if (!xuid) return;
    const result = await this.#req(`https://peoplehub.xboxlive.com/users/me/people/xuids(${xuid})/decoration/detail,preferredColor,presenceDetail`, { contractVersion: 4 });
    return result
  }

  async getFamily(xuid) {
    return await this.#req(`https://accounts.xboxlive.com/family/memberXuid(${xuid})`, {
      headers: {
        "Accept-Encoding": "gzip; q=1.0, deflate; q=0.5, identity; q=0.1",
        "x-xbl-contentrestrictions": "",
        "Signature": "",
        "Cache-Control": "no-store, must-revalidate, no-cache",
        "X-XblCorrelationId": v4(),
        "PRAGMA": "no-cache",
        "Accept-Language": "en-US, en"
      }
    });
  }

  async addFriend(xuid) {
    return await this.#req(`https://social.xboxlive.com/users/me/people/friends/v2/xuid(${xuid})`, { method: "PUT", accept: "*/*", headers: { "accept-language": "en-US", "content-type": "application/json", "Accept-Encoding": "gzip, deflate, br", "Cache-Control": "no-cache" } });
  }

  async followUser(xuid) {
    return await this.#req(`https://social.xboxlive.com/users/xuid(${this.xuid})/people/xuid(${xuid})`, { method: "PUT", headers: { "ms-cv": "rGUN3S.wCU2k6w.1267", "accept-language": "en-US", "content-length": 0, "Cache-Control": "no-cache" } });
  }

  async screenShotsCreate(fileSize, resolutionHeight, resolutionWidth, thumbnailFileSize) {
    const body = JSON.stringify({
      expectedBlocks: 1,
      fileSize: parseInt(fileSize),
      initialMetadata: {
        creationType: "UserGenerated",
        resolutionHeight: parseInt(resolutionHeight),
        resolutionWidth: parseInt(resolutionWidth),
        titleId: androidDevice.titleId // whatever this.flow uses.
      },
      thumbnailFileSize: parseInt(thumbnailFileSize),
      thumbnailNumBlocks: 1
    });

    const result = await this.#req("https://mediahub.xboxlive.com/screenshots/create", { method: "POST", userAgent: "libhttpclient/1.0.0.0", headers: { "Content-Type": "application/json", "Accept-Language": "en-GB", "xbl-contract-version": 3 }, body });
    if (result?.errorMsg) return { ...result, errorMsg: result.errorMsg + " WENT WRONG ON SCREENSHOTS CREATE" };
    return result;
  }

  async uploadImageToXboxLive(imageBuffer) {
    const fileSize = imageBuffer?.byteLength;
    const resolutionHeight = 1080;
    const resolutionWidth = 1920;
    const thumbnailFileSize = imageBuffer?.byteLength || 0;

    const createScreenShot = await this.screenShotsCreate(fileSize, resolutionHeight, resolutionWidth, thumbnailFileSize);
    if (createScreenShot.errorMsg) return createScreenShot;

    const azureHeaders = {
      "Content-Type": "application/octet-stream",
      "Accept-Language": "en-GB",
      "User-Agent": "libhttpclient/1.0.0.0",
      "x-ms-version": "2015-12-11",
      "x-xbl-contract-version": "3"
    };

    let response = await fetch(buildBlockUrl(createScreenShot.thumbnailUploadUri), { method: "PUT", headers: { ...azureHeaders, "x-ms-date": "3" }, body: imageBuffer });
    if (response.status !== 201) return { errorMsg: `${response.status} ${response.statusText} ${await response.text()} WENT WRONG ON THUMBNAILUPLOAD` };

    response = await fetch(buildBlockUrl(createScreenShot.contentUploadUri), { method: "PUT", headers: { ...azureHeaders, "x-ms-date": "placeholder" }, body: imageBuffer });
    if (response.status !== 201) return { errorMsg: `${response.status} ${response.statusText} ${await response.text()} WENT WRONG ON CONTENTUPLOAD` };

    const result = await this.#req(createScreenShot.publishUri, { method: "POST", userAgent: "libhttpclient/1.0.0.0", contractVersion: 2, headers: { "Accept-Language": "en-GB" } });
    if (result?.errorMsg) return { ...result, errorMsg: result.errorMsg + " WENT WRONG ON PUBLISH" };
    return result;
  }

  async sendMessageToClub(message, clubId, image = null) {
    image = image ? await this.uploadImageToXboxLive(image) : null;
    if (image?.errorMsg && image) return image;

    const body = JSON.stringify({
      postText: message,
      postType: image ? "XboxLink" : "Text",
      ...(image && {
        postTypeData: {
          locator: `screenshotsmetadata.xboxlive.com/users/xuid(${this.xuid})/scids/00000000-0000-0000-0000-000000000000/screenshots/${image.contentId}`
        }
      }),
      timelines: [{ timeLineOwner: clubId, timeLineType: "Club" }]
    });

    return await this.#req("https://userposts.xboxlive.com/users/me/posts", { method: "POST", userAgent: "libhttpclient/1.0.0.0", contractVersion: 2, headers: { "content-type": "application/json", "Accept-Encoding": "gzip, deflate, br", "Cache-Control": "no-cache" }, body });
  }

  async getClubData(clubID) {
    if (!clubID) return;
    const result = await this.#req(`https://clubhub.xboxlive.com/clubs/Ids(${clubID})/decoration/clubPresence`, {
      contractVersion: 4,
      headers: {
        "Accept-Encoding": "gzip; q=1.0, deflate; q=0.5, identity; q=0.1",
        "x-xbl-contentrestrictions": "",
        "Cache-Control": "no-store, must-revalidate, no-cache",
        "X-XblCorrelationId": v4(),
        "PRAGMA": "no-cache",
        "Accept-Language": "en-US, en"
      }
    });

    if (result?.code) return result;

    return result?.clubs?.[0] || result;
  }

  async gamertagToXuid(gamertag) {
    const result = await this.#req(`https://profile.xboxlive.com/users/gt(${gamertag})/profile/settings`, {
      userAgent: "XboxServicesAPI/2021.10.20220301.4 c",
      contractVersion: 2,
      headers: {
        "Accept-Language": "en-US,en",
        "Content-Type": "application/json; charset=utf-8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache"
      }
    });
    return result?.profileUsers?.[0]?.id ?? result;
  }

  async reactToPost(ownerXuid, postId, clubId, reactionType = "PUT") {
    return await this.#req(`https://comments.xboxlive.com/users/xuid(${ownerXuid})/posts/${postId}/timelines/Club/${clubId}/likes/me`, { method: reactionType, contractVersion: 1 });
  }

  async sendInGamePresenceRealm(realm) {
    await this.sendPresence({
      state: "active",
      activity: {
        richPresence: {
          id: `Realm_${realm.gamemode}`,
          scid: androidDevice.scid
        }
      }
    })

    await this.sendInGamePresence(realm, true)
  }
}

module.exports = XboxAPI;
