// ================================
// 🚀 Servidor Convers IA – Multi-Cliente
// ================================

const express = require("express");
const cors = require("cors");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const clients = {}; // Sessões ativas
const qrCodes = {}; // QR codes temporários

// ====================================
// 🔹 Função para iniciar cliente WhatsApp
// ====================================
function startClient(clientId) {
  const sessionPath = path.join(__dirname, ".sessions", clientId);
  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--disable-gpu",
        "--disable-software-rasterizer"
      ],
    },
  });

  client.on("qr", async (qr) => {
    qrCodes[clientId] = await qrcode.toDataURL(qr);
    console.log(`📱 QR Code gerado para cliente ${clientId}`);
  });

  client.on("ready", () => {
    console.log(`✅ Cliente ${clientId} conectado!`);
    qrCodes[clientId] = null;
  });

  client.on("auth_failure", (msg) => {
    console.error(`❌ Falha na autenticação do cliente ${clientId}:`, msg);
  });

  client.initialize();
  clients[clientId] = client;
}

// ====================================
// 🔹 Inicia conexão (rota chamada pelo WordPress)
// ====================================
app.post("/wp-json/convers-ia/v1/connect", (req, res) => {
  const clientId = req.query.client_id || "default";
  console.log(`🔗 Conectando cliente: ${clientId}`);

  if (!clients[clientId]) startClient(clientId);

  res.json({ status: "starting", client_id: clientId });
});

// ====================================
// 🔹 Retorna QR Code
// ====================================
app.get("/wp-json/convers-ia/v1/qr", (req, res) => {
  const clientId = req.query.client_id || "default";
  const qr = qrCodes[clientId] ? qrCodes[clientId].replace(/^data:image\/png;base64,/, "") : null;
  res.json({ qr });
});

// ====================================
// 🔹 Envia mensagens (opcional para o plugin futuro)
// ====================================
app.post("/wp-json/convers-ia/v1/send", async (req, res) => {
  const { client_id, to, message } = req.body;

  if (!clients[client_id]) {
    return res.status(400).json({ error: "Cliente não conectado" });
  }

  try {
    await clients[client_id].sendMessage(to, message);
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao enviar mensagem:", err);
    res.status(500).json({ error: "Falha ao enviar mensagem" });
  }
});

// ====================================
// 🔹 Inicialização do servidor
// ====================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Servidor Convers IA Multi-Cliente rodando na porta ${PORT}`);
});
