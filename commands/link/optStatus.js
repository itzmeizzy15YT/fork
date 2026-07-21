const PlayFabAPI = require("../../classes/playfab.js");

module.exports = {
    data: {
        name: "status",
        description: "View your linked account status and information"
    },
    subCommand: "opt",
    global: true,
    linkOnly: true,
    /**
     * @param {import("discord.js").CommandInteraction} interaction
     * @param {{ component: import("../../classes/Component.js"), dbUser: import("../../functions/Database.js").User }} param1
     */
    async execute(interaction, { component, flags, dbUser }) {
        try {
            if (!dbUser.linked || !dbUser.sticky.gamertag) {
                component.text(
                    `### Account Status\n` +
                    `You are not currently linked to crashing. Please run \`/opt in\` to link your account.\n\n`,
                    true
                );
                return interaction.reply({ components: [component], flags });
            }
            
            const playFab = new PlayFabAPI(dbUser);
            const { people: [person] } = await playFab.getXboxUser(dbUser.sticky.xuid);
            console.log(person)

            const playFabID = new PlayFabAPI(dbUser);
            const authData = await playFabID.loginWithXbox();
            const playFabId = authData?.PlayFabId || "N/A";
            const gamerscore = person.gamerScore || "N/A";

            component.text(
                `### Opt-Status\n`,
            ).separator()
                .text(
                    `⠀⠀⠀**Gamertag**⠀⠀⠀⠀⠀⠀⠀**XUID**\n-# **[**\`${dbUser.sticky.gamertag}\`**]**   **[**\`${dbUser.sticky.xuid}\`**]**\n\n` +
                    `⠀⠀⠀**PlayFab**⠀⠀⠀⠀⠀⠀**Gamerscore**\n-# **[**\`${playFabId}\`**]**  ⠀⠀⠀⠀⠀ **[**\`${gamerscore}\`**]**\n\n`
                )
                .separator()   
                .addLinkButton("View Profile", `https://account.xbox.com/en-US/Profile?Gamertag=${dbUser.sticky.gamertag}`, "View your Profile on Xbox")
                .separator()
                .text(`-# © 2026 Crashing LTD — Not affiliated with Mojang Studios. Minecraft is a trademark of Mojang Studios.`)
                

            await interaction.reply({ components: [component], flags });
        }
        catch (error) {
            console.error(error);
            component.text(
                `### Account Status\n` +
                `An error occurred while fetching your account information.\n\n` +
                `-# Error: ${error?.message ?? "Unknown error"}`,
                true
            );
            return interaction.reply({ components: [component], flags });
        }
    }
}