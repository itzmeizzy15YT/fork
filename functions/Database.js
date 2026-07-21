"use strict";

const mongoose = require("mongoose");
const { mongoUri } = require('../data/config.json')

const userSchema = new mongoose.Schema({
    id: { type: String, unique: true },

    blacklisted: { type: Boolean, default: false },
    staff: { type: Boolean, default: false },
    linked: { type: Boolean, default: false },

    premium: { type: Boolean, default: false },

    linkData: { type: Object, default: {} },
    sticky: {
        gamertag: { type: String, default: null },
        xuid: { type: String, default: null },
        playfabId: { type: String, default: null }
    }
})

const User = mongoose.model("users", userSchema)

mongoose.set('strictQuery', false)
mongoose.connect(mongoUri)
    .then(() => console.log('connected to mongodb'))
    .catch(err => { 
        console.error('failed to connect to mongodb, exiting.', err);
        process.exit(1) 
    });

module.exports = { User }
