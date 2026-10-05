require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
    Client,
    GatewayIntentBits,
    Partials,
    ChannelType,
    PermissionsBitField,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    EmbedBuilder,
    AttachmentBuilder,
    SlashCommandBuilder,
    REST,
    Routes,
    Events
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.GuildMember
    ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const PANEL_CHANNEL_ID = process.env.PANEL_CHANNEL_ID;

const STAFF_ROLE_IDS = process.env.STAFF_ROLE_IDS
    ? process.env.STAFF_ROLE_IDS.split(",").map(id => id.trim()).filter(Boolean)
    : [];

const PANEL_IMAGE_PATH = path.join(__dirname, "assets", "auren-panel.png");

const TICKET_TYPES = {
    soporte: {
        name: "Soporte",
        emoji: "🛠️",
        category: process.env.SOPORTE_CATEGORY_ID,
        color: 0x3498db,
        description: "Solicitudes generales de ayuda o soporte."
    },
    reportes: {
        name: "Reportes",
        emoji: "🚨",
        category: process.env.REPORTES_CATEGORY_ID,
        color: 0xe74c3c,
        description: "Reporta situaciones, jugadores o problemas dentro del servidor."
    },
    apelacion: {
        name: "Apelación",
        emoji: "⚖️",
        category: process.env.APELACION_CATEGORY_ID,
        color: 0xf1c40f,
        description: "Solicita una revisión o apelación de una sanción."
    },
    donaciones: {
        name: "Donaciones",
        emoji: "💰",
        category: process.env.DONACIONES_CATEGORY_ID,
        color: 0x2ecc71,
        description: "Consultas relacionadas con donaciones y beneficios."
    },
    organizaciones: {
        name: "Organizaciones",
        emoji: "🏢",
        category: process.env.ORGANIZACIONES_CATEGORY_ID,
        color: 0x9b59b6,
        description: "Solicitudes y asuntos relacionados con organizaciones."
    },
    reclamos: {
        name: "Reclamos",
        emoji: "📢",
        category: process.env.RECLAMOS_CATEGORY_ID,
        color: 0xe67e22,
        description: "Presenta un reclamo ante el equipo correspondiente."
    },
    ckpk: {
        name: "CK/PK",
        emoji: "💀",
        category: process.env.CKPK_CATEGORY_ID,
        color: 0x2c3e50,
        description: "Solicitudes y consultas relacionadas con CK/PK."
    },
    reporte_staff: {
        name: "Reporte Staff",
        emoji: "👮",
        category: process.env.REPORTE_STAFF_CATEGORY_ID,
        color: 0x8e44ad,
        description: "Reporta una situación relacionada con un miembro del staff."
    },
    streamers: {
        name: "Streamers",
        emoji: "🎥",
        category: process.env.STREAMERS_CATEGORY_ID,
        color: 0x9146ff,
        description: "Solicitudes y asuntos relacionados con streamers."
    },
    negocios: {
        name: "Negocios",
        emoji: "💼",
        category: process.env.NEGOCIOS_CATEGORY_ID,
        color: 0x16a085,
        description: "Consultas relacionadas con negocios."
    },
    postulacion_staff: {
        name: "Postulación Staff",
        emoji: "📋",
        category: process.env.POSTULACION_STAFF_CATEGORY_ID,
        color: 0x1abc9c,
        description: "Envía tu postulación para formar parte del staff."
    }
};

const LOG_CHANNELS = {
    apelacion: process.env.LOG_APELACION_ID,
    ckpk: process.env.LOG_CKPK_ID,
    organizaciones: process.env.LOG_ORGANIZACIONES_ID,
    donaciones: process.env.LOG_DONACIONES_ID,
    default: process.env.LOG_DEFAULT_ID
};

const dataFolder = path.join(__dirname, "data");
const ticketsFile = path.join(dataFolder, "tickets.json");

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder, { recursive: true });
}

if (!fs.existsSync(ticketsFile)) {
    fs.writeFileSync(ticketsFile, JSON.stringify({}, null, 4));
}

function loadTickets() {
    try {
        return JSON.parse(fs.readFileSync(ticketsFile, "utf8"));
    } catch {
        return {};
    }
}

function saveTickets(data) {
    fs.writeFileSync(ticketsFile, JSON.stringify(data, null, 4));
}

function isStaff(member) {
    return !!member &&
        STAFF_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
}

function getTicket(channelId) {
    const tickets = loadTickets();

    return Object.values(tickets).find(
        ticket =>
            ticket.channelId === channelId &&
            ticket.status === "open"
    );
}

function getLogChannelId(type) {
    return LOG_CHANNELS[type] || LOG_CHANNELS.default;
}

async function sendLog(type, embed) {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;

    const channel = guild.channels.cache.get(getLogChannelId(type));

    if (channel) {
        await channel.send({ embeds: [embed] });
    }
}

const commands = [
    new SlashCommandBuilder()
        .setName("ticket-panel")
        .setDescription("Envía el panel de tickets de Auren RP."),

    new SlashCommandBuilder()
        .setName("ticket-mensaje")
        .setDescription("Envía un mensaje del staff dentro del ticket.")
        .addStringOption(option =>
            option
                .setName("mensaje")
                .setDescription("Mensaje que quieres enviar.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("ticket-agregar")
        .setDescription("Agrega un usuario al ticket.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario que quieres agregar.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("ticket-quitar")
        .setDescription("Quita un usuario del ticket.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario que quieres quitar.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("ticket-cerrar")
        .setDescription("Cierra el ticket actual.")
].map(command => command.toJSON());

async function registerCommands() {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    await rest.put(
        Routes.applicationGuildCommands(client.user.id, GUILD_ID),
        { body: commands }
    );

    console.log("✅ Comandos registrados correctamente.");
}

client.once(Events.ClientReady, async () => {
    console.log(`🤖 Bot conectado como ${client.user.tag}`);
    console.log("🎫 AUREN RP TICKET SYSTEM");
    console.log(`📂 Tipos de tickets: ${Object.keys(TICKET_TYPES).length}`);
    console.log(`👮 Roles Staff: ${STAFF_ROLE_IDS.length}`);

    await registerCommands();

    client.user.setPresence({
        activities: [
            {
                name: "Auren RP | Tickets",
                type: 3
            }
        ],
        status: "online"
    });
});

async function createTicket(interaction, ticketType) {
    const guild = interaction.guild;
    const user = interaction.user;
    const config = TICKET_TYPES[ticketType];

    if (!config) {
        return interaction.reply({
            content: "❌ Tipo de ticket inválido.",
            ephemeral: true
        });
    }

    const tickets = loadTickets();

    const category = guild.channels.cache.get(config.category);

    if (!category) {
        return interaction.reply({
            content: `❌ No encontré la categoría de **${config.name}**. Revisa el ID configurado.`,
            ephemeral: true
        });
    }

    const username = user.username
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .slice(0, 45);

    const uniqueSuffix = Date.now().toString(36).slice(-6);
    const channelName = `${ticketType}-${username}-${uniqueSuffix}`;

    const permissions = [
        {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
            id: user.id,
            allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.AttachFiles,
                PermissionsBitField.Flags.EmbedLinks
            ]
        }
    ];

    for (const roleId of STAFF_ROLE_IDS) {
        permissions.push({
            id: roleId,
            allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.ManageMessages,
                PermissionsBitField.Flags.AttachFiles,
                PermissionsBitField.Flags.EmbedLinks
            ]
        });
    }

    // ============================================================
    // PERMISOS DEL BOT
    // ============================================================
    // El bot debe tener un overwrite propio. Esto evita que un deny
    // heredado de la categoría le impida escribir en el ticket recién creado.
    permissions.push({
        id: client.user.id,
        allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.ManageMessages,
            PermissionsBitField.Flags.AttachFiles,
            PermissionsBitField.Flags.EmbedLinks
        ]
    });

    let channel;

    try {
        channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: config.category,
            permissionOverwrites: permissions
        });

        // Reaplicar explícitamente los permisos del bot después de crear el canal.
        await channel.permissionOverwrites.edit(client.user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            ManageChannels: true,
            ManageMessages: true,
            AttachFiles: true,
            EmbedLinks: true
        });

        const botPermissions = channel.permissionsFor(client.user.id);

        if (!botPermissions?.has(PermissionsBitField.Flags.ViewChannel) ||
            !botPermissions?.has(PermissionsBitField.Flags.SendMessages)) {
            throw new Error(
                'El bot no tiene ViewChannel/SendMessages en el ticket. Revisa los permisos de la categoría.'
            );
        }
    } catch (error) {
        console.error('❌ No pude configurar el canal del ticket:', error);

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: '❌ No pude configurar los permisos del nuevo ticket. Revisa que el bot tenga **Gestionar canales**, **Ver canales** y **Enviar mensajes**.',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: '❌ No pude configurar los permisos del nuevo ticket. Revisa que el bot tenga **Gestionar canales**, **Ver canales** y **Enviar mensajes**.',
                    ephemeral: true
                });
            }
        } catch {}

        return;
    }

    const ticketId = Date.now().toString();

    tickets[ticketId] = {
        id: ticketId,
        guildId: guild.id,
        channelId: channel.id,
        userId: user.id,
        username: user.tag,
        type: ticketType,
        typeName: config.name,
        status: "open",
        claimed: false,
        claimedBy: null,
        createdAt: new Date().toISOString()
    };

    saveTickets(tickets);

    const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle(`${config.emoji} AUREN RP — ${config.name.toUpperCase()}`)
        .setDescription(
            `Bienvenido ${user} 👋\n\n` +
            `Tu ticket de **${config.name}** ha sido creado correctamente.\n\n` +
            `📌 **Motivo del ticket**\n` +
            `${config.description}\n\n` +
            `📝 Explica detalladamente tu situación.\n\n` +
            `👮 Un miembro autorizado del staff podrá reclamar este ticket.\n\n` +
            `⚠️ Por favor espera a que el staff te atienda.`
        )
        .addFields(
            {
                name: "👤 Usuario",
                value: `${user}`,
                inline: true
            },
            {
                name: "📁 Categoría",
                value: config.name,
                inline: true
            },
            {
                name: "📊 Estado",
                value: "🟢 Abierto",
                inline: true
            },
            {
                name: "👮 Atendido por",
                value: "Sin reclamar",
                inline: true
            }
        )
        .setFooter({
            text: `Auren RP • Ticket #${ticketId}`
        })
        .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket_claim")
            .setLabel("Reclamar Ticket")
            .setEmoji("🙋")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("ticket_close")
            .setLabel("Cerrar Ticket")
            .setEmoji("🔒")
            .setStyle(ButtonStyle.Danger)
    );

    const staffMentions = STAFF_ROLE_IDS
        .map(id => `<@&${id}>`)
        .join(" ");

    try {
        await channel.send({
            content: `${user}\n${staffMentions}`,
            embeds: [embed],
            components: [buttons]
        });
    } catch (error) {
        console.error('❌ Missing Access al enviar el mensaje inicial del ticket:', error);

        delete tickets[ticketId];
        saveTickets(tickets);

        try {
            await channel.delete('No se pudo enviar el mensaje inicial del ticket');
        } catch {}

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: '❌ El ticket fue creado, pero Discord no permitió que el bot escribiera dentro. Revisa los permisos de la categoría y del bot.',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: '❌ El ticket fue creado, pero Discord no permitió que el bot escribiera dentro. Revisa los permisos de la categoría y del bot.',
                    ephemeral: true
                });
            }
        } catch {}

        return;
    }

    await interaction.reply({
        content: `✅ Tu ticket de **${config.name}** ha sido creado: ${channel}`,
        ephemeral: true
    });

    const logEmbed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle(`${config.emoji} Ticket creado`)
        .addFields(
            {
                name: "👤 Usuario",
                value: `${user} (${user.id})`,
                inline: true
            },
            {
                name: "📁 Tipo",
                value: config.name,
                inline: true
            },
            {
                name: "📊 Estado",
                value: "🟢 Abierto",
                inline: true
            },
            {
                name: "📌 Canal",
                value: `${channel}`,
                inline: true
            }
        )
        .setFooter({
            text: `Ticket ID: ${ticketId}`
        })
        .setTimestamp();

    await sendLog(ticketType, logEmbed);
}

async function claimTicket(interaction) {
    const ticket = getTicket(interaction.channel.id);

    if (!isStaff(interaction.member)) {
        return interaction.reply({
            content: "❌ No tienes permiso para reclamar tickets.",
            ephemeral: true
        });
    }

    if (!ticket) {
        return interaction.reply({
            content: "❌ Este canal no es un ticket abierto.",
            ephemeral: true
        });
    }

    if (ticket.claimed) {
        return interaction.reply({
            content: `❌ Este ticket ya fue reclamado por <@${ticket.claimedBy}>.`,
            ephemeral: true
        });
    }

    const tickets = loadTickets();

    tickets[ticket.id].claimed = true;
    tickets[ticket.id].claimedBy = interaction.user.id;
    tickets[ticket.id].claimedAt = new Date().toISOString();

    saveTickets(tickets);

    const config = TICKET_TYPES[ticket.type];

    const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("🙋 TICKET RECLAMADO")
        .setDescription(
            `Este ticket ha sido reclamado por ${interaction.user}.\n\n` +
            `👮 **Staff encargado:** ${interaction.user}\n\n` +
            `El miembro del staff indicado será quien continúe atendiendo este ticket.`
        )
        .addFields(
            {
                name: "👤 Usuario",
                value: `<@${ticket.userId}>`,
                inline: true
            },
            {
                name: "📁 Tipo",
                value: config.name,
                inline: true
            },
            {
                name: "📊 Estado",
                value: "🟡 En atención",
                inline: true
            }
        )
        .setTimestamp();

    await interaction.channel.send({
        content: `📢 ${interaction.user} ha reclamado este ticket.`,
        embeds: [embed]
    });

    await interaction.reply({
        content: "✅ Has reclamado este ticket correctamente.",
        ephemeral: true
    });

    const logEmbed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle(`${config.emoji} Ticket reclamado`)
        .addFields(
            {
                name: "👤 Usuario",
                value: `<@${ticket.userId}>`,
                inline: true
            },
            {
                name: "👮 Reclamado por",
                value: `${interaction.user}`,
                inline: true
            },
            {
                name: "📁 Tipo",
                value: config.name,
                inline: true
            },
            {
                name: "📌 Ticket",
                value: `${interaction.channel}`,
                inline: true
            }
        )
        .setTimestamp();

    await sendLog(ticket.type, logEmbed);
}

async function closeTicket(interaction) {
    const ticket = getTicket(interaction.channel.id);

    if (!isStaff(interaction.member)) {
        return interaction.reply({
            content: "❌ No tienes permiso para cerrar tickets.",
            ephemeral: true
        });
    }

    if (!ticket) {
        return interaction.reply({
            content: "❌ Este canal no es un ticket abierto.",
            ephemeral: true
        });
    }

    const config = TICKET_TYPES[ticket.type];
    const tickets = loadTickets();

    tickets[ticket.id].status = "closed";
    tickets[ticket.id].closedBy = interaction.user.id;
    tickets[ticket.id].closedAt = new Date().toISOString();

    saveTickets(tickets);

    const logEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle(`${config.emoji} Ticket cerrado`)
        .addFields(
            {
                name: "👤 Usuario",
                value: `<@${ticket.userId}>`,
                inline: true
            },
            {
                name: "📁 Tipo",
                value: config.name,
                inline: true
            },
            {
                name: "👮 Cerrado por",
                value: `${interaction.user}`,
                inline: true
            },
            {
                name: "📌 Canal",
                value: ticket.channelId,
                inline: true
            },
            {
                name: "🙋 Reclamado por",
                value: ticket.claimedBy
                    ? `<@${ticket.claimedBy}>`
                    : "Nadie",
                inline: true
            }
        )
        .setTimestamp();

    await sendLog(ticket.type, logEmbed);

    await interaction.reply({
        content: "🔒 Este ticket ha sido cerrado.\n\n🗑️ El canal será eliminado en 5 segundos."
    });

    setTimeout(async () => {
        try {
            await interaction.channel.delete("Ticket cerrado por staff.");
        } catch (error) {
            console.error("Error eliminando ticket:", error);
        }
    }, 5000);
}

async function ticketMessage(interaction) {
    const ticket = getTicket(interaction.channel.id);

    if (!ticket) {
        return interaction.reply({
            content: "❌ Este comando solo puede utilizarse dentro de un ticket.",
            ephemeral: true
        });
    }

    if (!isStaff(interaction.member)) {
        return interaction.reply({
            content: "❌ Solo el staff puede utilizar este comando.",
            ephemeral: true
        });
    }

    const message = interaction.options.getString("mensaje");
    const config = TICKET_TYPES[ticket.type];

    const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle(`${config.emoji} MENSAJE DEL STAFF`)
        .setDescription(message)
        .setFooter({
            text: `Auren RP • ${config.name} • ${interaction.user.tag}`
        })
        .setTimestamp();

    await interaction.channel.send({
        embeds: [embed]
    });

    await interaction.reply({
        content: "✅ Mensaje enviado correctamente.",
        ephemeral: true
    });
}

async function addUser(interaction) {
    const ticket = getTicket(interaction.channel.id);

    if (!ticket) {
        return interaction.reply({
            content: "❌ Este canal no es un ticket.",
            ephemeral: true
        });
    }

    if (!isStaff(interaction.member)) {
        return interaction.reply({
            content: "❌ No tienes permiso para hacer esto.",
            ephemeral: true
        });
    }

    const user = interaction.options.getUser("usuario");

    await interaction.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true
    });

    await interaction.reply({
        content: `✅ ${user} ha sido agregado al ticket.`
    });
}

async function removeUser(interaction) {
    const ticket = getTicket(interaction.channel.id);

    if (!ticket) {
        return interaction.reply({
            content: "❌ Este canal no es un ticket.",
            ephemeral: true
        });
    }

    if (!isStaff(interaction.member)) {
        return interaction.reply({
            content: "❌ No tienes permiso para hacer esto.",
            ephemeral: true
        });
    }

    const user = interaction.options.getUser("usuario");

    if (user.id === ticket.userId) {
        return interaction.reply({
            content: "❌ No puedes quitar al creador del ticket.",
            ephemeral: true
        });
    }

    await interaction.channel.permissionOverwrites.delete(user.id);

    await interaction.reply({
        content: `✅ ${user} ha sido quitado del ticket.`
    });
}

async function sendPanel(interaction) {
    if (!isStaff(interaction.member)) {
        return interaction.reply({
            content: "❌ Solo el staff puede enviar el panel.",
            ephemeral: true
        });
    }

    const panelChannel = interaction.guild.channels.cache.get(PANEL_CHANNEL_ID);

    if (!panelChannel) {
        return interaction.reply({
            content: "❌ No encontré el canal del panel.",
            ephemeral: true
        });
    }

    const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_type_select")
        .setPlaceholder("🎫 Selecciona el tipo de ticket")
        .addOptions(
            Object.entries(TICKET_TYPES).map(([key, config]) => ({
                label: config.name,
                description: config.description.slice(0, 100),
                value: key,
                emoji: config.emoji
            }))
        );

    const row = new ActionRowBuilder().addComponents(menu);

    let panelEmbed = new EmbedBuilder()
        .setColor(0x075bff)
        .setTitle("🎫 AUREN RP — SISTEMA DE TICKETS")
        .setDescription(
            "Bienvenido al sistema oficial de tickets de **Auren RP**.\n\n" +
            "Selecciona en el menú de abajo el departamento que corresponde a tu solicitud.\n\n" +
            "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
            "🛠️ **Soporte**\n" +
            "🚨 **Reportes**\n" +
            "⚖️ **Apelación**\n" +
            "💰 **Donaciones**\n" +
            "🏢 **Organizaciones**\n" +
            "📢 **Reclamos**\n" +
            "💀 **CK/PK**\n" +
            "👮 **Reporte Staff**\n" +
            "🎥 **Streamers**\n" +
            "💼 **Negocios**\n" +
            "📋 **Postulación Staff**\n\n" +
            "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
            "📌 **Importante:**\n" +
            "• Abre un ticket solamente cuando sea necesario.\n" +
            "• Explica claramente tu situación.\n" +
            "• No hagas spam mencionando al staff.\n" +
            "• Espera a que un miembro autorizado te atienda."
        )
        .setFooter({
            text: "Auren RP • Sistema Oficial de Tickets"
        })
        .setTimestamp();

    const files = [];

    if (fs.existsSync(PANEL_IMAGE_PATH)) {
        const panelImage = new AttachmentBuilder(PANEL_IMAGE_PATH, {
            name: "auren-panel.png"
        });

        files.push(panelImage);
        panelEmbed.setImage("attachment://auren-panel.png");
    } else {
        console.warn("⚠️ No se encontró assets/auren-panel.png");
    }

    await panelChannel.send({
        embeds: [panelEmbed],
        components: [row],
        files
    });

    await interaction.reply({
        content: "✅ Panel de tickets enviado correctamente con la imagen de Auren RP.",
        ephemeral: true
    });
}

client.on(Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === "ticket_type_select") {
                const type = interaction.values[0];
                return await createTicket(interaction, type);
            }
        }

        if (interaction.isButton()) {
            if (interaction.customId === "ticket_claim") {
                return await claimTicket(interaction);
            }

            if (interaction.customId === "ticket_close") {
                return await closeTicket(interaction);
            }
        }

        if (!interaction.isChatInputCommand()) return;

        switch (interaction.commandName) {
            case "ticket-panel":
                return await sendPanel(interaction);

            case "ticket-mensaje":
                return await ticketMessage(interaction);

            case "ticket-agregar":
                return await addUser(interaction);

            case "ticket-quitar":
                return await removeUser(interaction);

            case "ticket-cerrar":
                return await closeTicket(interaction);
        }
    } catch (error) {
        console.error("❌ Interaction error:", error);

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: "❌ Ocurrió un error ejecutando esta acción.",
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: "❌ Ocurrió un error ejecutando esta acción.",
                    ephemeral: true
                });
            }
        } catch {}
    }
});

if (!TOKEN) {
    console.error("❌ FALTA DISCORD_TOKEN EN .env");
    process.exit(1);
}

if (!GUILD_ID) {
    console.error("❌ FALTA GUILD_ID EN .env");
    process.exit(1);
}

if (!PANEL_CHANNEL_ID) {
    console.error("❌ FALTA PANEL_CHANNEL_ID EN .env");
    process.exit(1);
}

client.login(TOKEN);
