const { Authflow } = require("prismarine-auth");
const { cacheFactory, androidDevice } = require("../../functions/Util.js");
const PlayFabAPI = require("../../classes/playfab.js");

const linkingMap = new Map() // id, { linkData, started }

module.exports = {
    data: {
        name: "in",
        description: "Opt into crashing, allowing us to use your account for requested processes"
    },
    subCommand: "opt",
    global: true,
    /**
     * @param {import("discord.js").CommandInteraction} interaction
     * @param {{ component: import("../../classes/Component.js"), dbUser: import("../../functions/Database.js").User }} param1
     */
    async execute(interaction, { component, flags, dbUser }) {
        if (dbUser.linked && typeof dbUser.sticky.gamertag === 'string') {
            component.text(
                `### Opt-In\n` +
                `Woah, you are already linked inside of crashing's database, please run \`/opt out\` before trying to linking to another account.\n\n`, 
                true
            ).separator()
            .text(`> currently linked to ***\`${dbUser.sticky.gamertag}\`***`)
            
            return interaction.reply({ components: [component], flags });
        }

        const userInMap = linkingMap.get(interaction.user.id);
        if (userInMap && Date.now() - userInMap.started < 300000) { 
            component.text(
                `### Opt-In\n` +
                `Woah, you are already doing this, please return to the original process before creating another.\n\n-# *Your original process will timeout <t:${Math.floor((userInMap.started + 300000) / 1000)}:R>*`,
                true
            );
            return interaction.reply({ components: [component], flags });
        }
    
        linkingMap.set(interaction.user.id, { linkData: null, started: Date.now() });

        component.text(
            `### Opt-In\n` +
            `Please wait while crashing loads its assets, this should only take a few seconds to complete, your process will timeout <t:${Math.floor((Date.now() + 300000) / 1000)}:R>.\n\n` +
            `-# Any more than a minute please report this as you have reached an un-documented error inside of crashing.`
        ).separator()

        await interaction.reply({ components: [component], flags });

        let timeout;
        try {
            const authFlow = new Authflow(undefined, cacheFactory(dbUser), {
                flow: androidDevice.flow, authTitle: androidDevice.authTitle, deviceType: androidDevice.deviceType 
            }, async (code) => {
                component.text(
                    `### Opt-In\n` +
                    `To use crashing, please go to ***${code.verification_uri}*** and enter to code \`${code.user_code}\`.\n\n` +
                    `-# ***This code will expire in <t:${Math.floor((Date.now() + 300000) / 1000)}:R>, after this if you sign in, crashing will not react.***`,
                    true
                ).separator()
                .addLinkButton("Authorization", `http://microsoft.com/link?otc=${code.user_code}`, "quick link >>");

                linkingMap.set(interaction.user.id, { linkData: code, started: Date.now() });

                await interaction.editReply({ components: [component], flags }).catch(() => {}) // for some reason this bugs out, just catch any discord issues

                timeout = setTimeout(() => {
                    clearLink(dbUser);
                    clearTimeout(timeout);
                }, 300000); 
            });

            const { userXUID = null } = await authFlow.getXboxToken()
            if (!userXUID || typeof userXUID !== 'string') throw new Error("X1, please try again. You encountered an error while fetching userXuid.");
            
            component.components.pop(); // remove the button (last component)
            await interaction.editReply({ components: [component], flags });

            clearTimeout(timeout)
            const playFab = new PlayFabAPI(dbUser);

            const { result = "failed" } = await playFab.uploadSkin();
            if (!result) throw new Error("Failed to upload skin.");

            const { PlayFabId } = await playFab.loginWithXbox()
            if (!PlayFabId || typeof PlayFabId !== 'string') throw new Error("Failed to get PlayFab ID.");

            dbUser.linked = true
            dbUser.sticky.playfabId = PlayFabId.toLowerCase()
            dbUser.sticky.xuid = userXUID;

            const { people: [person] } = await playFab.getXboxUser(userXUID);
            if (!person || !person.gamertag) throw new Error("Failed to get Xbox user.");

            dbUser.sticky.gamertag = person.gamertag;

            await dbUser.save();
            linkingMap.delete(interaction.user.id);

            component.text(
                `### Opt-In\n` +
                `You have now opted-into crashing, ***\`${dbUser.sticky.gamertag}\`*** is now connected to crashing-LTD's database and will be used for further linked-based commands!` +
                `\n\n-# © 2026 Crashing LTD — Not affiliated with Mojang Studios. Minecraft is a trademark of Mojang Studios. `, 
                true
            ).separator();
            return interaction.editReply({ components: [component], flags });
        }
        catch (error) {
            console.error(error);

            // await clearLink(dbUser);
            clearTimeout(timeout);

            component.text(error?.message ?? "An unknown error occurred while linking.", true);
            return interaction.editReply({ components: [component], flags });
        }
    }
}

const clearLink = async (user) => {
    const linkData = linkingMap.get(user.id);
    if (linkData) linkingMap.delete(user.id);

    user.linked = false;
    user.sticky.xuid = null;
    user.sticky.gamertag = null;
    user.linkData = {};
    
    await user.save();
}