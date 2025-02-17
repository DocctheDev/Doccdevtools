// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session2 from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

// server/storage.ts
import session from "express-session";
import createMemoryStore from "memorystore";
var MemoryStore = createMemoryStore(session);
var MemStorage = class {
  users;
  bots;
  commands;
  analyticsData;
  sessionStore;
  currentId;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.bots = /* @__PURE__ */ new Map();
    this.commands = /* @__PURE__ */ new Map();
    this.analyticsData = /* @__PURE__ */ new Map();
    this.currentId = { users: 1, bots: 1, commands: 1, analytics: 1 };
    this.sessionStore = new MemoryStore({
      checkPeriod: 864e5
    });
  }
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  async createUser(insertUser) {
    const id = this.currentId.users++;
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  async createBot(userId, bot) {
    const id = this.currentId.bots++;
    const newBot = { ...bot, id, userId, isActive: false };
    this.bots.set(id, newBot);
    return newBot;
  }
  async getBotsByUser(userId) {
    return Array.from(this.bots.values()).filter((bot) => bot.userId === userId);
  }
  async getBot(id) {
    return this.bots.get(id);
  }
  async updateBot(id, update) {
    const bot = this.bots.get(id);
    if (!bot) throw new Error("Bot not found");
    const updatedBot = { ...bot, ...update };
    this.bots.set(id, updatedBot);
    return updatedBot;
  }
  async deleteBot(id) {
    this.bots.delete(id);
  }
  async createCommand(botId, command) {
    const id = this.currentId.commands++;
    const newCommand = { ...command, id, botId };
    this.commands.set(id, newCommand);
    return newCommand;
  }
  async getCommandsByBot(botId) {
    return Array.from(this.commands.values()).filter((cmd) => cmd.botId === botId);
  }
  async updateCommand(id, update) {
    const command = this.commands.get(id);
    if (!command) throw new Error("Command not found");
    const updatedCommand = { ...command, ...update };
    this.commands.set(id, updatedCommand);
    return updatedCommand;
  }
  async deleteCommand(id) {
    this.commands.delete(id);
  }
  async saveAnalytics(data) {
    const id = this.currentId.analytics++;
    const analytics2 = { ...data, id };
    this.analyticsData.set(id, analytics2);
    return analytics2;
  }
  async getAnalyticsByBot(botId) {
    return Array.from(this.analyticsData.values()).filter((a) => a.botId === botId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
};
var storage = new MemStorage();

// server/auth.ts
var scryptAsync = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}
async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
function setupAuth(app2) {
  const sessionSettings = {
    secret: process.env.SESSION_SECRET || "development_secret_key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    }
  };
  app2.set("trust proxy", 1);
  app2.use(session2(sessionSettings));
  app2.use(passport.initialize());
  app2.use(passport.session());
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !await comparePasswords(password, user.password)) {
          return done(null, false);
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
  app2.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }
      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password)
      });
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (err) {
      next(err);
    }
  });
  app2.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });
  app2.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });
  app2.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}

// shared/schema.ts
import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull()
});
var bots = pgTable("bots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  token: text("token").notNull(),
  isActive: boolean("is_active").default(false)
});
var commands = pgTable("commands", {
  id: serial("id").primaryKey(),
  botId: integer("bot_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  code: text("code").notNull()
});
var analytics = pgTable("analytics", {
  id: serial("id").primaryKey(),
  botId: integer("bot_id").notNull(),
  metrics: jsonb("metrics").notNull(),
  timestamp: text("timestamp").notNull()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
});
var insertBotSchema = createInsertSchema(bots).pick({
  name: true,
  token: true
});
var insertCommandSchema = createInsertSchema(commands).pick({
  name: true,
  description: true,
  code: true
});

// server/openai.ts
import OpenAI from "openai";
var openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
async function analyzeCode(code) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a Discord bot code analyzer. Analyze the given code and provide suggestions for improvements, security concerns, and performance optimizations. Response must be in JSON format with arrays of strings for suggestions, security, and performance."
        },
        {
          role: "user",
          content: code
        }
      ],
      response_format: { type: "json_object" }
    });
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    throw new Error("Failed to analyze code: " + error.message);
  }
}

// server/routes.ts
async function registerRoutes(app2) {
  setupAuth(app2);
  app2.get("/api/bots", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const bots2 = await storage.getBotsByUser(req.user.id);
    res.json(bots2);
  });
  app2.post("/api/bots", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const validatedData = insertBotSchema.parse(req.body);
    const bot = await storage.createBot(req.user.id, validatedData);
    res.status(201).json(bot);
  });
  app2.patch("/api/bots/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const bot = await storage.getBot(parseInt(req.params.id));
    if (!bot || bot.userId !== req.user.id) return res.sendStatus(403);
    const updatedBot = await storage.updateBot(bot.id, req.body);
    res.json(updatedBot);
  });
  app2.delete("/api/bots/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const bot = await storage.getBot(parseInt(req.params.id));
    if (!bot || bot.userId !== req.user.id) return res.sendStatus(403);
    await storage.deleteBot(bot.id);
    res.sendStatus(204);
  });
  app2.get("/api/bots/:botId/commands", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const bot = await storage.getBot(parseInt(req.params.botId));
    if (!bot || bot.userId !== req.user.id) return res.sendStatus(403);
    const commands2 = await storage.getCommandsByBot(bot.id);
    res.json(commands2);
  });
  app2.post("/api/bots/:botId/commands", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const bot = await storage.getBot(parseInt(req.params.botId));
    if (!bot || bot.userId !== req.user.id) return res.sendStatus(403);
    const validatedData = insertCommandSchema.parse(req.body);
    const command = await storage.createCommand(bot.id, validatedData);
    res.status(201).json(command);
  });
  app2.post("/api/analyze-code", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Code is required" });
    try {
      const analysis = await analyzeCode(code);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/bots/:botId/analytics", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const bot = await storage.getBot(parseInt(req.params.botId));
    if (!bot || bot.userId !== req.user.id) return res.sendStatus(403);
    const analytics2 = await storage.getAnalyticsByBot(bot.id);
    res.json(analytics2);
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2, { dirname as dirname2 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared")
    }
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname2(__filename2);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        __dirname2,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(__dirname2, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const PORT = 5e3;
  server.listen(PORT, "0.0.0.0", () => {
    log(`serving on port ${PORT}`);
  });
})();
