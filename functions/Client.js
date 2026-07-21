const { createClient, Client } = require('./bedrock/index')
const xboxApi = require('../classes/Xbox');
const { generateRandomString, androidDevice } = require('./Util');
const PlayFabAPI = require('../classes/playfab');

const InputFlags = require('../data/InputFlags.json')

const { v4, v3 } = require('uuid');

async function createInstance(realm, user, settings, api = null) {
    const {
        protocol = "DEFAULT", address = "", external = { type: 0, enabled: false }
    } = settings ?? {}

    // everything todo with realm, should be handled inside of realmClass or the command, not here.

    const [host, port] = address.includes(':') ? address.split(':') : [address, null]

    api = api || new xboxApi(user)
    const playfabApi = new PlayFabAPI(user)

    const options = {
        authflow: api.flow,

        host, port,
        networkId: host, // we dont validate as if it is raknet, this wont be used anyways :)

        version: "1.26.30",
        protocolVersion: 1001,
        transport: protocol,

        external,
        skinData: {
            ClientRandomId: Number(generateRandomString(19, "0123456789")),
            CurrentInputMode: 2,
            DefaultInputMode: 2,

            DeviceModel: androidDevice.deviceModel,
            DeviceOs: androidDevice.deviceOS,
            DeviceId: v4().replace(/-/g, ""),

            PlayFabId: user.sticky.playfabId.toLowerCase() ?? "",
            GUIScale: [0, -1, -2][Math.floor(Math.random() * 3)],
            LanguageCode: "en_US",

            OverrideSkin: false,
            SelfSignedId: v3(v4(), v4()),
            PlatformOnlineId: "",
            PlatformOfflineId: v3(v4(), v4()),

            UIProfile: androidDevice.UIProfile,
            MaxViewDistance: androidDevice.maxViewDistance,
            MemoryTier: androidDevice.memoryTier,

            PlatformType: androidDevice.platformType,
            GraphicsMode: ~~(Math.random() * 2),
            TrustedSkin: false
        }
    }

    const client = createClient(options)
    if (external?.enabled && external?.type === 3) return Promise.all([createClient(options), createClient(options)]) 
        // we dont need to waste our resources on a shitty crash :D

    client.disconnected = false;
    client.setIntervals = new Set();

    await api.sendInGamePresenceRealm(realm)
    client.setIntervals.add(setInterval(() => api.sendInGamePresenceRealm(realm), 30000))

    await playfabApi.updatePublisherData()

    client._disconnect = client.disconnect;

    client.disconnect = () => {
        client.kicked = true;

        client.setIntervals.forEach(clearInterval);
        client.setIntervals.clear();

        api.sendInGamePresence(realm, false);
        client._disconnect();

        client.emit("kick", { message: "connection to server lost" });
    };

    client.on("kick", async (data) => {
        if (client.kicked) return;

        console.log(`${JSON.stringify(data)}`);

        client.disconnect();
    });

    client.on("close", () => {
        if (client.kicked) return;

        client.emit("kick", { message: "connection to server lost" });
    });

    client.on('start_game', async ({ player_position = { x: 0, y: 0, z: 0 }, runtime_entity_id = 0, current_tick }) => {
        client.currentPosition = player_position
        client.runtime = runtime_entity_id
        client.tick = BigInt(current_tick)

        client.write("serverbound_loading_screen", { type: 2 });
        client.setIntervals.add(setInterval(() => {
            client.move(client.currentPosition)
        }, 50))
    })

    client.on("respawn", (data) => {
        if (!client.runtime) return;

        switch (data.state) {
            case 0:
                client.write('respawn', {
                    runtime_entity_id: BigInt(client.runtime),
                    state: 2,
                    position: client.currentPosition
                });
                break;
            case 1:
                client.write('player_action', {
                    runtime_entity_id: BigInt(client.runtime),
                    action: 'respawn',
                    position: client.currentPosition,
                    result_position: client.currentPosition,
                    face: -1
                });

                client.currentPosition = data.position;
                break;
        }
    });

    client.on("packet_violation_warning", (packet) => { console.log(packet); });
    client.on("error", () => { });

    return client;
}

module.exports = createInstance

Client.prototype.move = function (position, subClientNumber = 0) {
    if (typeof position !== "object" || !this?.runtime) return;

    let data = {
        position: {
            x: position.x, 
            y: position.y, 
            z: position.z 
        },
        move_vector: { x: 0, z: 0 },
        analogue_move_vector: { x: 0, z: 0 },
        pitch: 0,
        yaw: 0,
        head_yaw: 0,
        delta: {
            x: position.x - this.currentPosition.x, 
            y: position.y - this.currentPosition.y, 
            z: position.z - this.currentPosition.z 
        },
        input_data: InputFlags,
        interact_rotation: { x: 0, z: 0 },
        camera_orientation: { x: 0, y: 0, z: 0 },
        raw_move_vector: { x: 0, z: 0 },
        input_mode: 2,
        play_mode: "normal",
        interaction_model: "classic",
        tick: this.tick
    };

    this.currentPosition = { x: position.x, y: position.y, z: position.z };
    this.write(`player_auth_input${subClientNumber > 0 ? `_${subClientNumber}` : ""}`, data);

    this.tick++;
}