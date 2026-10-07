import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import fs from 'fs';
import process from 'process';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { CommandRegistry } from './command-registry.js';
import { ModuleManager } from './module-manager.js';
import { PluginManager } from './plugin-manager.js';
import { ServiceManager } from './service-manager.js';
import { ConfigManager } from './config-manager.js';
import { DatabaseManager } from './database-manager.js';
import { EventManager } from './event-manager.js';
import { Logger } from '../utils/logger.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import { SecurityManager } from '../utils/security.js';
import { AutoUpdater } from '../services/auto-updater.js';
import { WebDashboard } from '../web/dashboard.js';
import { WhatsAppClient } from './whatsapp-client.js';
import { CommandManager } from '../scripts/command-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env') });

class UltimateWhatsAppBot {
  constructor() {
    this.version = '2.0.0';
    this.name = 'Ultimate WhatsApp Bot';
    this.startTime = Date.now();
    this.isRunning = false;
    this.isShuttingDown = false;

    this.config = new ConfigManager();
    this.logger = new Logger(this.config.get('logging'));
    this.database = new DatabaseManager(this.config.get('database'));
    this.rateLimiter = new RateLimiter(this.config.get('rateLimit'));
    this.security = new SecurityManager(this.config.get('security'));
    this.events = new EventManager();
    this.commandRegistry = new CommandRegistry(this.events, this.logger);
    this.moduleManager = new ModuleManager(this.commandRegistry, this.events, this.logger);
    this.pluginManager = new PluginManager(this.commandRegistry, this.events, this.logger);
    this.serviceManager = new ServiceManager(this.config, this.logger);
    this.autoUpdater = new AutoUpdater(this.config, this.logger);
    this.whatsappClient = new WhatsAppClient(this.config, this.logger, this.events);
    this.webDashboard = new WebDashboard(this.config, this.logger, this);
    this.commandManager = new CommandManager(this.commandRegistry, this.logger);

    this.setupGlobalErrorHandlers();
  }

  setupGlobalErrorHandlers() {
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception:', error);
      this.gracefulShutdown(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('SIGINT', () => this.gracefulShutdown(0));
    process.on('SIGTERM', () => this.gracefulShutdown(0));
    process.on('SIGHUP', () => this.reload());
  }

  async initialize() {
    this.logger.info(`${this.name} v${this.version} initializing...`);

    try {
      await this.config.load();
      this.logger.success('Configuration loaded');

      await this.database.connect();
      this.logger.success('Database connected');

      await this.serviceManager.initialize();
      this.logger.success('Services initialized');

      await this.moduleManager.loadAll();
      this.logger.success(`Modules loaded: ${this.moduleManager.getLoadedCount()}`);

      await this.pluginManager.loadAll();
      this.logger.success(`Plugins loaded: ${this.pluginManager.getLoadedCount()}`);

      await this.commandRegistry.loadAll();
      this.logger.success(`Commands registered: ${this.commandRegistry.getCommandCount()}`);

      await this.whatsappClient.initialize();
      this.logger.success('WhatsApp client initialized');

      if (this.config.get('webDashboard.enabled')) {
        await this.webDashboard.start();
        this.logger.success('Web dashboard started');
      }

      if (this.config.get('autoUpdate.enabled')) {
        this.autoUpdater.start();
        this.logger.success('Auto-updater started');
      }

      this.setupEventListeners();
      this.isRunning = true;

      this.logger.success(`${this.name} v${this.version} started successfully!`);
      this.printStartupInfo();

      return true;
    } catch (error) {
      this.logger.error('Failed to initialize bot:', error);
      throw error;
    }
  }

  setupEventListeners() {
    this.events.on('message', this.handleMessage.bind(this));
    this.events.on('command', this.handleCommand.bind(this));
    this.events.on('connection:open', this.onConnected.bind(this));
    this.events.on('connection:close', this.onDisconnected.bind(this));
    this.events.on('error', this.onError.bind(this));
  }

  async handleMessage(message) {
    try {
      if (!message || !message.key) return;

      const isFromMe = message.key.fromMe;
      const senderJid = message.key.participant || message.key.remoteJid;
      const chatJid = message.key.remoteJid;

      if (this.security.isBlocked(senderJid)) {
        this.logger.debug(`Blocked message from ${senderJid}`);
        return;
      }

      const rateLimitResult = this.rateLimiter.check(senderJid, chatJid);
      if (!rateLimitResult.allowed) {
        this.logger.warn(`Rate limited: ${senderJid} - ${rateLimitResult.reason}`);
        await this.whatsappClient.sendMessage(chatJid, {
          text: `⚠️ Rate limit exceeded. Please wait ${rateLimitResult.retryAfter}s.`
        }, { quoted: message });
        return;
      }

      const prefix = this.config.get('bot.prefix');
      const content = this.extractMessageContent(message);

      if (!content) return;

      const isCommand = isFromMe ? true : content.startsWith(prefix);
      const commandText = isCommand ? content.slice(prefix.length).trim() : content.trim();

      if (isCommand && commandText) {
        await this.executeCommand(commandText, message, senderJid, chatJid, prefix);
      } else if (!isCommand && this.config.get('bot.prefixlessMode')) {
        await this.executeCommand(commandText, message, senderJid, chatJid, '');
      }

      this.events.emit('message:processed', { message, senderJid, chatJid, isCommand });
    } catch (error) {
      this.logger.error('Error handling message:', error);
      this.events.emit('error', error);
    }
  }

  extractMessageContent(message) {
    const msg = message.message;
    if (!msg) return null;

    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption) return msg.imageMessage.caption;
    if (msg.videoMessage?.caption) return msg.videoMessage.caption;
    if (msg.documentMessage?.caption) return msg.documentMessage.caption;
    if (msg.stickerMessage) return '[sticker]';
    if (msg.audioMessage) return '[audio]';
    if (msg.documentMessage) return '[document]';
    if (msg.imageMessage) return '[image]';
    if (msg.videoMessage) return '[video]';
    if (msg.locationMessage) return '[location]';
    if (msg.contactMessage) return '[contact]';
    if (msg.contactsArrayMessage) return '[contacts]';
    if (msg.reactionMessage) return '[reaction]';
    if (msg.ephemeralMessage?.message) return this.extractMessageContent({ message: msg.ephemeralMessage.message, key: message.key });
    if (msg.viewOnceMessage?.message) return this.extractMessageContent({ message: msg.viewOnceMessage.message, key: message.key });
    if (msg.templateMessage?.hydratedTemplate?.hydratedContentText) return msg.templateMessage.hydratedTemplate.hydratedContentText;
    if (msg.interactiveMessage?.body?.text) return msg.interactiveMessage.body.text;
    if (msg.listMessage?.title) return msg.listMessage.title;
    if (msg.buttonsMessage?.contentText) return msg.buttonsMessage.contentText;
    if (msg.orderMessage?.order?.text) return msg.orderMessage.order.text;

    return null;
  }

  async executeCommand(commandText, message, senderJid, chatJid, prefix) {
    const args = commandText.trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    const command = this.commandRegistry.get(commandName);
    if (!command) {
      const suggestions = this.commandRegistry.getSuggestions(commandName);
      if (suggestions.length > 0) {
        await this.whatsappClient.sendMessage(chatJid, {
          text: `❓ Command "${commandName}" not found. Did you mean: ${suggestions.join(', ')}?`
        }, { quoted: message });
      }
      return;
    }

    if (command.ownerOnly && !this.security.isOwner(senderJid)) {
      await this.whatsappClient.sendMessage(chatJid, {
        text: '🚫 This command is restricted to the bot owner.'
      }, { quoted: message });
      return;
    }

    if (command.groupOnly && !chatJid.endsWith('@g.us')) {
      await this.whatsappClient.sendMessage(chatJid, {
        text: '🚫 This command only works in groups.'
      }, { quoted: message });
      return;
    }

    if (command.nsfw && !this.security.isNsfwAllowed(chatJid)) {
      await this.whatsappClient.sendMessage(chatJid, {
        text: '🚫 NSFW commands are not allowed in this chat.'
      }, { quoted: message });
      return;
    }

    const cooldownKey = `${senderJid}:${commandName}`;
    if (this.rateLimiter.isOnCooldown(cooldownKey, command.cooldown || 0)) {
      const remaining = this.rateLimiter.getCooldownRemaining(cooldownKey);
      await this.whatsappClient.sendMessage(chatJid, {
        text: `⏳ Command on cooldown. Wait ${remaining}s.`
      }, { quoted: message });
      return;
    }

    const context = {
      bot: this,
      config: this.config,
      database: this.database,
      logger: this.logger,
      rateLimiter: this.rateLimiter,
      security: this.security,
      events: this.events,
      commandRegistry: this.commandRegistry,
      moduleManager: this.moduleManager,
      pluginManager: this.pluginManager,
      serviceManager: this.serviceManager,
      whatsappClient: this.whatsappClient,
      senderJid,
      chatJid,
      isOwner: this.security.isOwner(senderJid),
      isGroup: chatJid.endsWith('@g.us'),
      prefix,
      message,
      args,
      utils: this.getUtils()
    };

    try {
      this.logger.command(`${senderJid} executed ${prefix}${commandName} ${args.join(' ')}`);
      await command.execute(context);
      this.rateLimiter.setCooldown(cooldownKey, command.cooldown || 0);
      this.events.emit('command:success', { command: commandName, senderJid, chatJid, args });
    } catch (error) {
      this.logger.error(`Command ${commandName} failed:`, error);
      this.events.emit('command:error', { command: commandName, senderJid, chatJid, args, error });
      await this.whatsappClient.sendMessage(chatJid, {
        text: `❌ Error executing command: ${error.message}`
      }, { quoted: message });
    }
  }

  getUtils() {
    return {
      formatTime: (ms) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
      },
      formatBytes: (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      },
      randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
      randomChoice: (arr) => arr[Math.floor(Math.random() * arr.length)],
      sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
      escapeHtml: (text) => text.replace(/[&<>"']/g, m => ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": ''' }[m])),
      truncate: (str, len = 100) => str.length > len ? str.slice(0, len - 3) + '...' : str,
      capitalize: (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase(),
      slugify: (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      isUrl: (str) => /^https?:\/\//.test(str),
      parseTime: (str) => {
        const match = str.match(/^(\d+)([smhdw])$/);
        if (!match) return 0;
        const value = parseInt(match[1]);
        const unit = match[2];
        const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
        return value * (multipliers[unit] || 0);
      }
    };
  }

  async handleCommand(data) {
    this.events.emit('command:executed', data);
  }

  async onConnected() {
    this.logger.success('WhatsApp connected!');
    this.events.emit('bot:ready');
  }

  async onDisconnected(reason) {
    this.logger.warn('WhatsApp disconnected:', reason);
    if (!this.isShuttingDown && this.config.get('whatsapp.autoReconnect')) {
      this.logger.info('Attempting to reconnect...');
      setTimeout(() => this.whatsappClient.reconnect(), 5000);
    }
  }

  async onError(error) {
    this.logger.error('Bot error:', error);
  }

  async reload() {
    this.logger.info('Reloading bot...');
    await this.commandRegistry.reload();
    await this.moduleManager.reload();
    await this.pluginManager.reload();
    this.logger.success('Bot reloaded');
  }

  async gracefulShutdown(code = 0) {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.logger.info('Shutting down gracefully...');

    try {
      this.autoUpdater.stop();
      await this.webDashboard.stop();
      await this.whatsappClient.disconnect();
      await this.serviceManager.shutdown();
      await this.database.disconnect();
      this.logger.success('Shutdown complete');
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
    }

    process.exit(code);
  }

  printStartupInfo() {
    const uptime = Date.now() - this.startTime;
    const memory = process.memoryUsage();
    console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════════════════════╗
║  ${chalk.bold(this.name)} v${this.version}
║  ═════════════════════════════════════════════════════════════════════════════
║  📊 Commands: ${chalk.green(this.commandRegistry.getCommandCount())} | Modules: ${chalk.green(this.moduleManager.getLoadedCount())} | Plugins: ${chalk.green(this.pluginManager.getLoadedCount())}
║  💾 Memory: ${chalk.yellow(this.formatBytes(memory.heapUsed))} / ${chalk.yellow(this.formatBytes(memory.heapTotal))}
║  ⏱️  Startup: ${chalk.green(this.formatTime(uptime))}
║  🌐 Dashboard: ${this.config.get('webDashboard.enabled') ? chalk.green(`http://localhost:${this.config.get('webDashboard.port')}`) : chalk.red('Disabled')}
║  🔄 Auto-Update: ${this.config.get('autoUpdate.enabled') ? chalk.green('Enabled') : chalk.red('Disabled')}
║  🛡️  Security: ${this.config.get('security.enabled') ? chalk.green('Active') : chalk.red('Disabled')}
║  ⚡ Rate Limit: ${this.config.get('rateLimit.enabled') ? chalk.green('Active') : chalk.red('Disabled')}
╚══════════════════════════════════════════════════════════════════════════════╝
    `));
  }

  formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getStats() {
    return {
      version: this.version,
      uptime: Date.now() - this.startTime,
      commands: this.commandRegistry.getCommandCount(),
      modules: this.moduleManager.getLoadedCount(),
      plugins: this.pluginManager.getLoadedCount(),
      memory: process.memoryUsage(),
      connected: this.whatsappClient.isConnected(),
      config: this.config.getAll()
    };
  }
}

export { UltimateWhatsAppBot };

const bot = new UltimateWhatsAppBot();

await bot.initialize();

export default bot;