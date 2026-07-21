class ComponentBuilder {
    constructor(color = 0xAFCBFF) {
        this.type = enums.CONTAINER;
        this.defaultColor = color;
        this.accent_color = color;

        this.components = [];
        this.files = [];
    }

    reset() {
        this.accent_color = this.defaultColor;
        this.components = [];
        this.files = [];

        return this;
    }

    push(...components) {
        this.components.push(...components.filter(Boolean));
        return this;
    }

    text(content, reset = false) {
        if (reset) this.reset();

        return this.push({
            type: enums.TEXT,
            content: Array.isArray(content) ? content.join("\n") : String(content)
        });
    }

    separator(spacing = 1, divider = true) {
        return this.push({ type: enums.SEPARATOR, divider, spacing });
    }

    addFile(url) {
        return this.push({ type: enums.FILE, file: { url } });
    }

    addImages(urls) {
        urls = Array.isArray(urls) ? urls : [urls];
        return this.push({ type: enums.MEDIA, items: urls.map(url => ({ media: { url } })) });
    }

    addThumbnail(url = "", ...texts) {
        return this.push({
            type: enums.SECTION,
            components: texts.map(text => ({ type: enums.TEXT, content: String(text) })),
            accessory: { type: enums.THUMBNAIL, media: { url } }
        });
    }

    addLinkButton(label, url, text = "no text", emoji = undefined) {
        return this.push({
            type: enums.SECTION,
            components: [{ type: 10, content: text }],
            accessory: { type: enums.BUTTON, style: 5, emoji, label, url }
        });
    }

    addButtons({ custom_id, label, style = 1, emoji = null, text = null, disabled = false }) {
        return this.push({
            type: enums.SECTION,
            components: text ? [{ type: enums.TEXT, content: text }] : [],
            accessory: { type: enums.BUTTON, custom_id, label, style, emoji, disabled }
        });
    }

    testButton(...butons) {
        return this.push({ type: enums.ACTION_ROW, components: butons });
    }

    addSelectionMenu(type, custom_id, placeholder, options = []) {
        type = menuTypes[type] ?? type;

        let menu = { type, custom_id, placeholder };
        if (type === enums.USER_SELECT) menu.options = options;
        if (type === enums.CHANNEL_SELECT) menu.channel_types = [0, 2, 4, 5, 13];

        return this.push({ type: enums.ACTION_ROW, components: [menu] });
    }

    addFileAttachment(name, description, buffer) {
        this.files.push({ attachment: Buffer.from(buffer), name, description });
        return this;
    }

    newComponent(color = this.defaultColor) { return new ComponentBuilder(color) }
    toJSON() {
        return { type: this.type, accent_color: this.accent_color, components: this.components };
    }
}

module.exports = ComponentBuilder;

const enums = {
    ACTION_ROW: 1, BUTTON: 2,
    USER_SELECT: 3, MENTIONABLE_SELECT: 5,
    ROLE_SELECT: 6, CHANNEL_SELECT: 8,
    SECTION: 9, TEXT: 10,
    THUMBNAIL: 11, MEDIA: 12,
    FILE: 13, SEPARATOR: 14,
    CONTAINER: 17
};

const menuTypes = {
    user: enums.USER_SELECT,
    mentionable: enums.MENTIONABLE_SELECT,
    role: enums.ROLE_SELECT,
    channel: enums.CHANNEL_SELECT
};