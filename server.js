/**
 * Convers IA - WhatsApp Web Server (Render Version)
 */

import express from "express";
import qrcode from "qrcode-terminal";
import { Client, LocalAuth } from "whatsapp-web.js";
import cors from "cors";
import fs from "fs";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const SESSION_PATH = "./session";
if (!fs.existsSync(SESSION_PATH)) fs.mkdirSync(SESSION_PATH);

let qrCodeData = null;
let isReady = false;

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => {
  console.log("📱 QR Code gerado — escaneie com o celular");
  qrCodeData = qr;
});

client.on("ready", () => {
  console.log("✅ WhatsApp conectado com sucesso!");
  qrCodeData = null;
  isReady = true;
});

client.on("disconnected", (reason) => {
  console.log("⚠️ WhatsApp desconectado:", reason);
  isReady = false;
});

client.on("message", async (msg) => {
  console.log("📩 Mensagem recebida:", msg.body);
  if (msg.body.toLowerCase().includes("oi") || msg.body.toLowerCase().includes("olá")) {
    await msg.reply("Olá! 👋 Aqui é o *Convers IA*. Como posso te ajudar?");
  }
});

client.initialize();

// ==================== ROTAS ====================

app.post("/wp-json/convers-ia/v1/connect", (req, res) => {
  console.log("🔄 Conexão solicitada pelo WordPress");
  res.json({ status: isReady ? "active" : "pending" });
});

app.get("/wp-json/convers-ia/v1/qr", async (req, res) => {
  if (!qrCodeData) return res.json({ qr: null });
  const QRCode = await import("qrcode");
  const base64 = await QRCode.toDataURL(qrCodeData);
  const img = base64.split(",")[1];
  res.json({ qr: img });
});

app.get("/wp-json/convers-ia/v1/status", (req, res) => {
  res.json({ ready: isReady });
});

app.post("/wp-json/convers-ia/v1/send", async (req, res) => {
  const { to, message } = req.body;
  try {
    await client.sendMessage(to, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => console.log(`🚀 Servidor WhatsApp rodando na porta ${port}`));
