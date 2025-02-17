import { users, bots, commands, analytics } from "@shared/schema";
import type { User, InsertUser, Bot, Command, Analytics } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Bot operations
  createBot(userId: number, bot: Omit<Bot, "id" | "userId">): Promise<Bot>;
  getBotsByUser(userId: number): Promise<Bot[]>;
  getBot(id: number): Promise<Bot | undefined>;
  updateBot(id: number, update: Partial<Bot>): Promise<Bot>;
  deleteBot(id: number): Promise<void>;

  // Command operations
  createCommand(botId: number, command: Omit<Command, "id" | "botId">): Promise<Command>;
  getCommandsByBot(botId: number): Promise<Command[]>;
  updateCommand(id: number, update: Partial<Command>): Promise<Command>;
  deleteCommand(id: number): Promise<void>;

  // Analytics operations
  saveAnalytics(analytics: Omit<Analytics, "id">): Promise<Analytics>;
  getAnalyticsByBot(botId: number): Promise<Analytics[]>;

  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private bots: Map<number, Bot>;
  private commands: Map<number, Command>;
  private analyticsData: Map<number, Analytics>;
  public sessionStore: session.Store;
  private currentId: { [key: string]: number };

  constructor() {
    this.users = new Map();
    this.bots = new Map();
    this.commands = new Map();
    this.analyticsData = new Map();
    this.currentId = { users: 1, bots: 1, commands: 1, analytics: 1 };
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId.users++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createBot(userId: number, bot: Omit<Bot, "id" | "userId">): Promise<Bot> {
    const id = this.currentId.bots++;
    const newBot: Bot = { ...bot, id, userId, isActive: false };
    this.bots.set(id, newBot);
    return newBot;
  }

  async getBotsByUser(userId: number): Promise<Bot[]> {
    return Array.from(this.bots.values()).filter(bot => bot.userId === userId);
  }

  async getBot(id: number): Promise<Bot | undefined> {
    return this.bots.get(id);
  }

  async updateBot(id: number, update: Partial<Bot>): Promise<Bot> {
    const bot = this.bots.get(id);
    if (!bot) throw new Error('Bot not found');
    const updatedBot = { ...bot, ...update };
    this.bots.set(id, updatedBot);
    return updatedBot;
  }

  async deleteBot(id: number): Promise<void> {
    this.bots.delete(id);
  }

  async createCommand(botId: number, command: Omit<Command, "id" | "botId">): Promise<Command> {
    const id = this.currentId.commands++;
    const newCommand: Command = { ...command, id, botId };
    this.commands.set(id, newCommand);
    return newCommand;
  }

  async getCommandsByBot(botId: number): Promise<Command[]> {
    return Array.from(this.commands.values()).filter(cmd => cmd.botId === botId);
  }

  async updateCommand(id: number, update: Partial<Command>): Promise<Command> {
    const command = this.commands.get(id);
    if (!command) throw new Error('Command not found');
    const updatedCommand = { ...command, ...update };
    this.commands.set(id, updatedCommand);
    return updatedCommand;
  }

  async deleteCommand(id: number): Promise<void> {
    this.commands.delete(id);
  }

  async saveAnalytics(data: Omit<Analytics, "id">): Promise<Analytics> {
    const id = this.currentId.analytics++;
    const analytics: Analytics = { ...data, id };
    this.analyticsData.set(id, analytics);
    return analytics;
  }

  async getAnalyticsByBot(botId: number): Promise<Analytics[]> {
    return Array.from(this.analyticsData.values())
      .filter(a => a.botId === botId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}

export const storage = new MemStorage();
