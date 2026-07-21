const { User } = require('./Database.js')
const reasons = require('../data/disconnectReasons.json');

function cacheFactory(user) {
    class CacheFactory {
        async getCached() { return user.linkData; }
        async setCached(value) {
            user.linkData = value || {};

            try {
                await user.save();
            } catch {
                user = await User.findOne({ id: user.id });
                user.linkData = value || {};

                await user.save();
            }
        }
        
        async setCachedPartial(value) {
            user.linkData = { ...user.linkData, ...value };

            try {
                await user.save();
            } catch {
                user = await User.findOne({ id: user.id });
                user.linkData = { ...user.linkData, ...value };

                await user.save();
            }
        }
    }

    return function () { return new CacheFactory(); };
}

function generateRandomString(length, characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890_-") {
    const array = new Uint8Array(length);
    for (let i = 0; i < length; i++) array[i] = characters.charCodeAt(~~(Math.random() * characters.length));

    return Buffer.from(array).toString();
}

function cleanTimeoutsAndIntervals(timeouts, intervals) {
    return [[timeouts, clearTimeout], [intervals, clearInterval]]
        .forEach(([items, clear]) => items.forEach(clear));
}

const androidDevice = { // this could be a lot more differently, and id like to do it better <<<<<<<< TOUPDATE
    flow: "sisu", authTitle: "0000000048183522",
    deviceType: "Android", deviceOS: 1,
    maxViewDistance: 10, memoryTier: 3,
    platformType: 1, UIProfile: 1,
    scid: "00000000-0000-0000-0000-000067b57dac", deviceModel: "SAMSUNG SM-G955U",
    userAgent: "MCPE/Android", titleId: "1739947436",
    deviceVersion: "0.0.0"
};

function getDisconnectInfo(reason) {
    const key = (reason || "").toLowerCase().replace(/_/g, "");

    const themes = Object.values(reasons);

    let found = themes
        .map(({ main, sub }) => sub?.[key] && { main, sub: sub[key] })
        .find(Boolean);

    if (!found && key) {
        found = themes
            .map(({ main, sub }) => {
                const match = Object.entries(sub || {}).find(
                    ([k]) => k.includes(key) || key.includes(k)
                );
                return match && { main, sub: match[1] };
            })
            .find(Boolean);
    }

    const { main, sub = {} } = found || {
        main: { codeword: "Terracotta", title: "disconnectionScreen.title.errorOccurred" },
        sub: {}
    };

    return {
        codeword: sub.codeword || main?.codeword,
        title: sub.title || main?.title,
        body: sub.body || main?.body,
        weburl: sub.weburl || main?.weburl
    };
}

const formatRealmApi = {
    403: "The server understood the request, but you lacked the correct authority to do it.",
    401: "You are not authorized to access this resource, please re-link by doing \`/opt in\` again.",
    429: "Crashing has been ratelimited by RealmsAPI, trying later will sort this issue out.",
    500: "The realm is undergoing a change and crashing cannot touch it until it has finished.",
    503: "Unable to fetch address, try again later.",

    6016: "Invite link was not found, please try another link!",

    890: "Woah, this command only takes code, not an id."
}

module.exports = {
    cacheFactory,
    androidDevice,
    generateRandomString,
    cleanTimeoutsAndIntervals,
    getDisconnectInfo,
    formatRealmApi
}