import fs from "fs";
import pkg from "whatsapp-web.js";
import config from "../config.js";
import {
  buildChromiumArgs,
  detectRuntime,
  resolveChromePath,
  resolveAuthPath,
  shouldDisableSandbox
} from "./runtime.js";

const { Client, LocalAuth, MessageMedia } = pkg;

export function createClient() {
  const runtime = detectRuntime();
  const authPath = resolveAuthPath(config.authPath);
  const disableSandbox = shouldDisableSandbox(runtime, config.disableSandbox);
  const chromePath = resolveChromePath(config.chromePath);

  fs.mkdirSync(authPath, { recursive: true });

  const puppeteer = {
    headless: config.headless,
    args: buildChromiumArgs(runtime, disableSandbox)
  };

  if (chromePath) {
    puppeteer.executablePath = chromePath;
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: "ghost-bot",
      dataPath: authPath
    }),
    puppeteer
  });

  client.commands = new Map();

  return {
    client,
    runtime,
    authPath,
    disableSandbox,
    MessageMedia
  };
}
