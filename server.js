// =========================
// Convers IA - Servidor Multi-Cliente WhatsApp Web (Persistente)
// =========================

import express from "express";
import cors from "cors";
import qrcode from "qrcode";
import fs from "fs";
import path from "path";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

// =========================
// Inicialização do servidor Express
// =========================
const app = express();
app.use(express.json());

// Configuração de CORS
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options("*", cors());

// =========================
// Estruturas principais
// =========================
const clients = {};
const qrCodes = {};
const sessionsDir = path.join(process.cwd(), "sessions");

// Garante que a pasta de sessões existe (persistência local)
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
  console.log("📂 Pasta de sessões criada:", sessionsDir);
}

// =========================
// Função para inicializar cliente WhatsApp com persistência
// =========================
async function startClient(clientId) {
  if (clients[clientId]) {
    console.log(`⚠️ Cliente ${clientId} já está ativo.`);
    return;
  }

  console.log(`🟢 Iniciando cliente: ${clientId}`);

  // Cria pasta individual por cliente
  const clientPath = path.join(sessionsDir, clientId);
  if (!fs.existsSync(clientPath)) fs.mkdirSync(clientPath);

  // Inicializa cliente com autenticação local persistente
  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: clientPath,
      clientId: clientId,
    }),
    puppeteer: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    },
  });

  // Eventos de QR / Conexão
  client.on("qr", async (qr) => {
    const qrImage = await qrcode.toDataURL(qr);
    qrCodes[clientId] = qrImage;
    console.log(`📱 QR gerado/atualizado para cliente: ${clientId}`);
  });

  client.on("ready", () => {
    console.log(`✅ Cliente conectado e pronto: ${clientId}`);
    delete qrCodes[clientId]; // limpa QR após conexão
  });

  client.on("authenticated", () => {
    console.log(`🔐 Cliente autenticado: ${clientId}`);
  });

  client.on("disconnected", (reason) => {
    console.log(`🔴 Cliente desconectado (${clientId}): ${reason}`);
    delete clients[clientId];
    delete qrCodes[clientId];
    // Tenta reconectar automaticamente após 10s
    setTimeout(() => {
      console.log(`♻️ Tentando reconectar cliente ${clientId}...`);
      startClient(clientId);
    }, 10000);
  });

  // Inicializa
  client.initialize().catch((err) => {
    console.error(`❌ Erro ao inicializar cliente ${clientId}:`, err);
  });

  clients[clientId] = client;
}

// =========================
// ROTAS PRINCIPAIS
// =========================

// Rota raiz (teste rápido)
app.get("/", (req, res) => {
  res.json({
    status: "Servidor ativo e persistente",
    clients: Object.keys(clients),
    timestamp: new Date().toISOString(),
  });
});

// Iniciar ou restaurar sessão
app.all("/wp-json/convers-ia/v1/connect", (req, res) => {
  const clientId = req.query.client_id || "default";
  console.log(`🔗 Solicitando conexão para cliente: ${clientId}`);

  startClient(clientId);
  res.json({
    status: "starting",
    client_id: clientId,
  });
});

// Obter QR code atual
app.get("/wp-json/convers-ia/v1/qr", (req, res) => {
  const clientId = req.query.client_id || "default";
  const qr = qrCodes[clientId]
    ? qrCodes[clientId].replace(/^data:image\/png;base64,/, "")
    : null;

  console.log(`📤 QR solicitado (${clientId}): ${qr ? "OK" : "Aguardando..."}`);
  res.json({ qr });
});

// =========================
// EXECUÇÃO DO SERVIDOR
// =========================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Servidor Convers IA persistente rodando na porta ${PORT}`);
});
