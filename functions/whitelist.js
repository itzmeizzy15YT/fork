"use strict";

const { Whitelist } = require('./Database.js');

async function addRealm(realmId, userId) {
    return Whitelist.findOneAndUpdate(
        { realmId: String(realmId) },
        { realmId: String(realmId), addedBy: userId, addedAt: new Date() },
        { upsert: true, new: true }
    );
}

async function removeRealm(realmId) {
    return Whitelist.findOneAndDelete({ realmId: String(realmId) });
}

async function isProtected(realmId) {
    const wl = await Whitelist.findOne({ realmId: String(realmId) });
    return !!wl;
}

async function getAllProtected() {
    return Whitelist.find({}).lean();
}

module.exports = {
    addRealm,
    removeRealm,
    isProtected,
    getAllProtected
};
