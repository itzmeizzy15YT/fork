"use strict";
//error list - lxcky
const realmErrors = {
    "Realm not found": "The realm code or ID you entered doesn't exist.",
    "Realm is expired": "This realm has expired and is no longer active.",
    "Realm is closed": "This realm is currently closed by the owner.",
    "You are banned from this realm": "You have been banned from this realm and cannot join.",
    "You are not a member of this realm": "You must be a member to access this realm.",
    "Invite link expired": "The invite link has expired.",
    "Invite link not found": "The invite code was not found, please try another.",
    "Realm is full": "This realm is currently full.",
    "Realm requires owner approval": "The realm owner must approve new members.",
    
    "2 player realm": "This is a 2 player realm, requires 10+ player realm.",
    "Whitelisted": "This realm is whitelisted and protected from all operations.",
    
    "Rate limited": "Rate limited by Realms API, please wait and try again later.",
    "Unauthorized": "Your account is not authorized, try re-linking with `/link account`.",
    "Forbidden": "Access denied, you lack permission for this realm.",
    "Server error": "The realm is undergoing maintenance, try again later.",
    "Service unavailable": "Unable to reach realm servers, try again later.",
    "Network protocol unsupported": "This realm uses an unsupported network protocol.",
    "Invalid address": "The realm returned an invalid address, try again later.",
    
    "Connection failed": "Failed to connect to the realm server.",
    "Connection timeout": "Connection to the realm timed out.",
    "Failed to authenticate": "Failed to authenticate with the realm.",
    "Disconnected": "Disconnected from the realm unexpectedly.",
    
    "Unknown error": "An unknown error occurred."
};

function getErrorMessage(checkResult) {
    if (!checkResult?.errorMsg) return null;
    
    const msg = checkResult.errorMsg.toLowerCase();
    
    if (msg.includes("403") || msg.includes("forbidden")) return realmErrors["Forbidden"];
    if (msg.includes("401") || msg.includes("unauthorized")) return realmErrors["Unauthorized"];
    if (msg.includes("429") || msg.includes("ratelimited")) return realmErrors["Rate limited"];
    if (msg.includes("500")) return realmErrors["Server error"];
    if (msg.includes("501")) return realmErrors["Network protocol unsupported"] || realmErrors["2 player realm"];
    if (msg.includes("503")) return realmErrors["Service unavailable"];
    if (msg.includes("404")) return realmErrors["Realm not found"];
    if (msg.includes("expired")) return realmErrors["Realm is expired"];
    if (msg.includes("closed")) return realmErrors["Realm is closed"];
    if (msg.includes("banned")) return realmErrors["You are banned from this realm"];
    if (msg.includes("not a member") || msg.includes("member")) return realmErrors["You are not a member of this realm"];
    if (msg.includes("full")) return realmErrors["Realm is full"];
    if (msg.includes("2 player") || msg.includes("maxplayers")) return realmErrors["2 player realm"];
    if (msg.includes("6016") || msg.includes("invite")) return realmErrors["Invite link not found"];
    if (msg.includes("890")) return realmErrors["Realm not found"];
    if (msg.includes("unsupported")) return realmErrors["Network protocol unsupported"];
    if (msg.includes("invalid")) return realmErrors["Invalid address"];
    if (msg.includes("timeout")) return realmErrors["Connection timeout"];
    if (msg.includes("disconnect")) return realmErrors["Disconnected"];
    if (msg.includes("auth")) return realmErrors["Failed to authenticate"];
    
    return checkResult.errorMsg;
}

function errorEmbed(title, realm = null, errorKey, color = 0xF87171) {
    const { EmbedBuilder } = require("discord.js");
    
    const description = realm 
        ? `**${realm.name || 'Realm'}** · \`${realm.id || '???'}\`\n-# ${realmErrors[errorKey] || errorKey}`
        : `-# ${realmErrors[errorKey] || errorKey}`;
    
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color);
}

module.exports = { realmErrors, getErrorMessage, errorEmbed };
