import dotenv from 'dotenv';
dotenv.config(); // загружаем переменные из .env

import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  EmbedBuilder,
  PermissionsBitField,
  AttachmentBuilder
} from 'discord.js';

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// === Подключаем модули ===
import initRulesModule from "./rulesModule.js";
import { initFaqModule } from "./faqModule.js";
import initNewsModule from "./newsModulePro.js";

// === Инициализация SQLite ===
let db;
async function initDB() {
  db = await open({ filename: './database.sqlite', driver: sqlite3.Database });
  await db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      userId TEXT,
      channelId TEXT,
      description TEXT,
      status TEXT,
      claimedBy TEXT,
      createdAt INTEGER
    )
  `);
}

// Таблица тикетов
const ticketsTable = {
  async set(id, value) {
    await db.run(`
      INSERT INTO tickets (id, userId, channelId, description, status, claimedBy, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        userId=excluded.userId,
        channelId=excluded.channelId,
        description=excluded.description,
        status=excluded.status,
        claimedBy=excluded.claimedBy,
        createdAt=excluded.createdAt
    `, [id, value.userId, value.channelId, value.description, value.status, value.claimedBy, value.createdAt]);
  },

  async get(id) {
    return await db.get(`SELECT * FROM tickets WHERE id = ?`, [id]);
  },

  async all() {
    const rows = await db.all(`SELECT id, userId, channelId, description, status, claimedBy, createdAt FROM tickets`);
    return rows.map(r => ({ id: r.id, value: r }));
  },

  async delete(id) {
    await db.run(`DELETE FROM tickets WHERE id = ?`, [id]);
  }
};

// === Константы ===
const TOKEN = process.env.BOT_TOKEN;
const SUPPORT_CHANNEL_ID = "1437405016699834429";
const MOD_CHANNEL_ID = "1437405270224404573";
const TICKET_CATEGORY_ID = "1437407648931778652";
const ARCHIVE_CHANNEL_ID = "1437572980745175080";
const LOG_CHANNEL_ID = "1437572980745175080";
const MOD_ROLE_ID = "1436715432823492752";
const CATEGORIES_TARGET_CHANNEL_ID = "1437489070656716870";

// === Клиент Discord ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message],
});

// === Логирование ===
async function log(title, desc = "", color = "#00ffcc") {
  try {
    const channel = await client.channels.fetch(LOG_CHANNEL_ID);
    await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle(title)
        .setDescription(desc)
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: "Maxim Bot" })
      ]
    });
  } catch (err) {
    console.error("Ошибка логирования:", err);
  }
}

// === Инициализация модулей ===
initNewsModule(client, { channelId: "1437400670637654056" });
initRulesModule(client, {
  guildId: "1002528080050528306",
  channelId: "1436690514559762527",
  ackRoleId: "1439782479509852300",
  supportChannelId: SUPPORT_CHANNEL_ID
});
initFaqModule(client, {
  channelId: "1436699596913901710",
  guildId: "1002528080050528306",
  rulesChannelId: "1436690514559762527",
  supportChannelId: SUPPORT_CHANNEL_ID,
  ticketCategoryId: TICKET_CATEGORY_ID,
  modRoleId: MOD_ROLE_ID
});

// === Категории поддержки ===
const SUPPORT_CATEGORIES = {
  bug: { label: "Ошибка / Баг", color: 0xff4444, descriptionPlaceholder: "Опиши шаги для воспроизведения, ожидаемое и фактическое поведение..." },
  crash: { label: "Падение / Краш", color: 0xff3333, descriptionPlaceholder: "Когда происходит краш? Сообщи логи/скриншоты если есть..." },
  feature: { label: "Фича / Улучшение", color: 0x00cc66, descriptionPlaceholder: "Опиши идею и зачем она нужна пользователям..." },
  suggestion: { label: "Предложение", color: 0x0099ff, descriptionPlaceholder: "Коротко опиши предложение и как оно улучшит опыт..." },
  other: { label: "Другое", color: 0x999999, descriptionPlaceholder: "Опиши свой запрос..." }
};

const createButton = (id, label, style) =>
  new ButtonBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(style)
    .setDisabled(false);

const hasModRole = (member) =>
  member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
  member.roles.cache.has(MOD_ROLE_ID);

// === Отправка меню поддержки ===
async function sendSupportMenu() {
  try {
    const channel = await client.channels.fetch(SUPPORT_CHANNEL_ID);

    const messages = await channel.messages.fetch({ limit: 50 });
    for (const msg of messages.values()) {
      if (msg.author?.id === client.user.id && msg.components?.length > 0) {
        await msg.delete().catch(() => {});
      }
    }

    const modEmbed = new EmbedBuilder()
      .setTitle("Связь с модерацией")
      .setDescription("Если нужна помощь — нажми кнопку ниже.")
      .setColor(0x00aaff)
      .setFooter({ text: "Модерация" });

    const modRow = new ActionRowBuilder().addComponents(
      createButton("mod_ticket", "Связаться с модератором", ButtonStyle.Primary)
    );

    await channel.send({ embeds: [modEmbed], components: [modRow] });

    const catEmbed = new EmbedBuilder()
      .setTitle("Поддержка — категории")
      .setDescription("Выбери тип запроса — откроется форма.")
      .setColor(0x2b2b2b);

    const rowA = new ActionRowBuilder().addComponents(
      createButton("category_bug", SUPPORT_CATEGORIES.bug.label, ButtonStyle.Danger),
      createButton("category_crash", SUPPORT_CATEGORIES.crash.label, ButtonStyle.Danger),
      createButton("category_feature", SUPPORT_CATEGORIES.feature.label, ButtonStyle.Success)
    );

    const rowB = new ActionRowBuilder().addComponents(
      createButton("category_suggestion", SUPPORT_CATEGORIES.suggestion.label, ButtonStyle.Primary),
      createButton("category_other", SUPPORT_CATEGORIES.other.label, ButtonStyle.Secondary)
    );

    await channel.send({ embeds: [catEmbed], components: [rowA, rowB] });
    await log("Меню поддержки отправлено", `Канал: ${SUPPORT_CHANNEL_ID}`);
  } catch (err) {
    await log("Ошибка меню поддержки", err.message, "#ff0000");
    console.error("sendSupportMenu ошибка:", err);
  }
}

// === Обработчик интеракций ===
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.inGuild()) return;
  const guild = interaction.guild;

  try {
    // --- Кнопки категорий ---
    if (interaction.isButton() && interaction.customId.startsWith("category_")) {
      const type = interaction.customId.split("_")[1];
      const cat = SUPPORT_CATEGORIES[type];
      if (!cat) return interaction.reply({ content: "Неизвестная категория.", flags: 64 });

      const modal = new ModalBuilder()
        .setCustomId(`modal_category_${type}`)
        .setTitle(cat.label);

      const input = new TextInputBuilder()
        .setCustomId("description")
        .setLabel("Опиши свой запрос")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(cat.descriptionPlaceholder)
        .setRequired(true)
        .setMaxLength(4000);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
      return;
    }

    // --- Модераторский тикет ---
    if (interaction.isButton() && interaction.customId === "mod_ticket") {
      const existing = (await ticketsTable.all()).find(t => t.value.userId === interaction.user.id && t.value.status !== "closed");
      if (existing) return interaction.reply({ content: "У тебя уже есть тикет!", flags: 64 });

      const modal = new ModalBuilder()
        .setCustomId("modal_mod_ticket")
        .setTitle("Связь с модератором");

      const input = new TextInputBuilder()
        .setCustomId("description")
        .setLabel("В чём проблема?")
        .setPlaceholder("Опиши подробно...")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(3000);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
      return;
    }

    // --- Обработка модалей ---
    if (interaction.isModalSubmit()) {
      await interaction.deferReply({ flags: 64 });

      if (interaction.customId.startsWith("modal_category_")) {
        const type = interaction.customId.split("_")[2];
        const cat = SUPPORT_CATEGORIES[type];
        const desc = interaction.fields.getTextInputValue("description");
        const target = await client.channels.fetch(CATEGORIES_TARGET_CHANNEL_ID).catch(() => null);
        if (!target) return interaction.editReply({ content: "Целевой канал не найден." });

        const embed = new EmbedBuilder()
          .setTitle(cat.label)
          .setDescription(desc)
          .addFields({ name: "Отправил", value: `${interaction.user.tag} (<@${interaction.user.id}>)` })
          .setColor(cat.color);

        await target.send({ embeds: [embed] });
        await interaction.editReply({ content: "Отправлено!" });
        return;
      }

      if (interaction.customId === "modal_mod_ticket") {
        const desc = interaction.fields.getTextInputValue("description");
        const ticketChannel = await guild.channels.create({
          name: `тик-${interaction.user.username}`,
          type: ChannelType.GuildText,
          parent: TICKET_CATEGORY_ID,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          ]
        });

        await ticketsTable.set(`ticket_${ticketChannel.id}`, {
          userId: interaction.user.id,
          channelId: ticketChannel.id,
          description: desc,
          status: "waiting",
          claimedBy: null,
          createdAt: Date.now()
        });

        await ticketChannel.send({
          embeds: [new EmbedBuilder()
            .setTitle("Ожидание модератора")
            .setDescription(desc)
            .setColor("#ffaa00")]
        });

        const modChannel = await client.channels.fetch(MOD_CHANNEL_ID);

        const row = new ActionRowBuilder().addComponents(
          createButton(`claim_${ticketChannel.id}`, "Принять", ButtonStyle.Success),
          createButton(`reject_${ticketChannel.id}`, "Отклонить", ButtonStyle.Secondary)
        );

        await modChannel.send({
          content: `<@&${MOD_ROLE_ID}>`,
          embeds: [new EmbedBuilder()
            .setTitle("Новый тикет")
            .setDescription(desc)
            .setColor("#00ffff")],
          components: [row]
        });

        await interaction.editReply({ content: `Тикет создан: ${ticketChannel}` });
      }
    }

    // --- Кнопки claim/reject/close/resolved ---
    if (interaction.isButton()) {
      await interaction.deferReply({ flags: 64 }).catch(() => {});

      const [action, channelId] = interaction.customId.split("_");
      if (!channelId) return;

      const ticketData = (await ticketsTable.all()).find(t => t.value.channelId === channelId);
      if (!ticketData) return;

      const ticketChannel = await guild.channels.fetch(channelId).catch(() => null);
      if (!ticketChannel) return;

      const ticket = ticketData.value;

      if (action === "claim") {
        if (!hasModRole(interaction.member))
          return interaction.editReply({ content: "Только модератор!", flags: 64 });

        await ticketsTable.set(ticketData.id, { ...ticket, status: "claimed", claimedBy: interaction.user.id });

        await ticketChannel.send({
          embeds: [new EmbedBuilder().setTitle("Модератор здесь!").setDescription(`${interaction.user}`).setColor("#00ff00")]
        });

        const closeRow = new ActionRowBuilder().addComponents(
          createButton(`close_${channelId}`, "Закрыть", ButtonStyle.Danger),
          createButton(`resolved_${channelId}`, "Решено", ButtonStyle.Success)
        );

        await ticketChannel.send({ components: [closeRow] });
        await interaction.editReply({ content: "Принято!", flags: 64 });
        return;
      }

      if (action === "reject") {
        await ticketChannel.send("Тикет отклонён.");
        await ticketsTable.delete(ticketData.id);
        setTimeout(() => ticketChannel.delete().catch(() => {}), 3000);
        await interaction.editReply({ content: "Отклонено", flags: 64 });
        return;
      }

      if (action === "close" || action === "resolved") {
        const isResolved = action === "resolved";
        const messages = await ticketChannel.messages.fetch({ limit: 100 });
        const transcript = messages.reverse().map(m => `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content}`).join("\n");
        const attachment = new AttachmentBuilder(Buffer.from(transcript), { name: `ticket-${channelId}.txt` });
        const archive = await client.channels.fetch(ARCHIVE_CHANNEL_ID);

        await archive.send({
          embeds: [new EmbedBuilder()
            .setTitle(isResolved ? "Решено" : "Закрыто")
            .setDescription(`Пользователь: <@${ticket.userId}>`)
            .setColor(isResolved ? "#00ff00" : "#999999")],
          files: [attachment]
        });

        await ticketsTable.delete(ticketData.id);
        setTimeout(() => ticketChannel.delete(), 3000);
        await interaction.editReply({ content: isResolved ? "Тикет отмечен как решённый" : "Тикет закрыт", flags: 64 }).catch(() => {});
        return;
      }
    }

  } catch (err) {
    await log("Ошибка", err.message, "#ff0000");
    if (!interaction.replied && !interaction.deferred)
      interaction.reply({ content: "Ошибка!", flags: 64 }).catch(() => {});
  }
});

// === Авто-закрытие неактивных тикетов ===
setInterval(async () => {
  try {
    const tickets = (await ticketsTable.all()).filter(t => t.value.status === "waiting");

    for (const t of tickets) {
      const channel = await client.channels.fetch(t.value.channelId).catch(() => null);
      if (!channel) continue;

      const last = (await channel.messages.fetch({ limit: 1 })).first();
      if (last && Date.now() - last.createdTimestamp > 30 * 60 * 1000) {
        await channel.send("Тикет закрыт из-за неактивности.");
        await channel.delete().catch(() => {});
        await ticketsTable.delete(t.id);
      }
    }
  } catch (err) {
    await log("Ошибка авто-закрытия", err.message, "#ff0000");
  }
}, 5 * 60 * 1000);

// === Авто-обновление меню поддержки ===
setInterval(async () => {
  try {
    await sendSupportMenu();
  } catch (err) {
    await log("Ошибка авто-обновления меню", err.message, "#ff0000");
  }
}, 10 * 60 * 1000);

// === Ready ===
client.once(Events.ClientReady, async () => {
  console.log(`${client.user.tag} онлайн!`);
  await sendSupportMenu();
});

// === Запуск бота ===
(async () => {
  await initDB();
  const TOKEN = process.env.TOKEN; // берём токен из .env
  if (!TOKEN) {
    console.error("Ошибка: не указан BOT_TOKEN в .env");
    process.exit(1);
  }
  client.login(TOKEN);
})();

export { client, ticketsTable, SUPPORT_CATEGORIES, createButton, TICKET_CATEGORY_ID, MOD_CHANNEL_ID, ARCHIVE_CHANNEL_ID, MOD_ROLE_ID, CATEGORIES_TARGET_CHANNEL_ID, hasModRole, log };
