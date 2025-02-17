import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertBotSchema, insertCommandSchema } from "@shared/schema";
import { analyzeCode } from "./openai";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Bot management routes
  app.get("/api/bots", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const bots = await storage.getBotsByUser(req.user.id);
    res.json(bots);
  });

  app.post("/api/bots", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const validatedData = insertBotSchema.parse(req.body);
    const bot = await storage.createBot(req.user.id, validatedData);
    res.status(201).json(bot);
  });

  app.patch("/api/bots/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const bot = await storage.getBot(parseInt(req.params.id));
    if (!bot || bot.userId !== req.user.id) return res.sendStatus(403);
    const updatedBot = await storage.updateBot(bot.id, req.body);
    res.json(updatedBot);
  });

  app.delete("/api/bots/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const bot = await storage.getBot(parseInt(req.params.id));
    if (!bot || bot.userId !== req.user.id) return res.sendStatus(403);
    await storage.deleteBot(bot.id);
    res.sendStatus(204);
  });

  // Command management routes
  app.get("/api/bots/:botId/commands", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const bot = await storage.getBot(parseInt(req.params.botId));
    if (!bot || bot.userId !== req.user.id) return res.sendStatus(403);
    const commands = await storage.getCommandsByBot(bot.id);
    res.json(commands);
  });

  app.post("/api/bots/:botId/commands", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const bot = await storage.getBot(parseInt(req.params.botId));
    if (!bot || bot.userId !== req.user.id) return res.sendStatus(403);
    const validatedData = insertCommandSchema.parse(req.body);
    const command = await storage.createCommand(bot.id, validatedData);
    res.status(201).json(command);
  });

  app.post("/api/analyze-code", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Code is required" });
    try {
      const analysis = await analyzeCode(code);
      res.json(analysis);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Analytics routes
  app.get("/api/bots/:botId/analytics", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const bot = await storage.getBot(parseInt(req.params.botId));
    if (!bot || bot.userId !== req.user.id) return res.sendStatus(403);
    const analytics = await storage.getAnalyticsByBot(bot.id);
    res.json(analytics);
  });

  const httpServer = createServer(app);
  return httpServer;
}
