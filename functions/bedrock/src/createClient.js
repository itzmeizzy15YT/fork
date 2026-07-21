const { Client } = require('./client')

function createClient(options) {
    const client = new Client({ port: 19132, ...options, delayedInit: true })

    client.once('resource_packs_info', () => {
        client.write('resource_pack_client_response', { response_status: 'completed', resourcepackids: [] })
        if (!options.hangConnection) client.write('request_chunk_radius', { chunk_radius: 16, max_radius: 8 })
        // only 2 packets needed for spawn!
    });

    client.init()

    return client
}

module.exports = { createClient }