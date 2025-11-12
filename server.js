// ================================
// 🚀 Servidor Convers IA (Node.js)
// Compatível com Render + WhatsApp Web
// ================================

const express = require("express");
const cors = require("cors");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");

const app = express();
app.use(cors());
app.use(express.json());

let qrCodeData = null;
let client;

// ================================
// 🔹 Inicializa o cliente WhatsApp
// ================================
function startWhatsApp() {
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
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
    console.log("📱 QR Code recebido. Escaneie no WhatsApp.");
    qrCodeData = await qrcode.toDataURL(qr);
  });

  client.on("ready", () => {
    console.log("✅ WhatsApp conectado com sucesso!");
    qrCodeData = null;
  });

  client.on("auth_failure", (msg) => {
    console.error("❌ Falha na autenticação:", msg);
  });

  client.initialize();
}

// ================================
// 🔹 Rotas da API
// ================================

// Inicia o WhatsApp Web
app.post("/wp-json/convers-ia/v1/connect", (req, res) => {
  if (!client) {
    console.log("🚀 Inicializando o WhatsApp...");
    startWhatsApp();
    return res.json({ status: "starting" });
  }

  if (client.info) {
    return res.json({ status: "active" });
  }

  res.json({ status: "waiting_qr" });
});

// Retorna o QR Code
app.get("/wp-json/convers-ia/v1/qr", (req, res) => {
  if (qrCodeData) {
    res.json({ qr: qrCodeData.replace(/^data:image\/png;base64,/, "") });
  } else {
    res.json({ qr: null });
  }
});

// ================================
// 🔹 Inicialização do servidor
// ================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Servidor Convers IA rodando na porta ${PORT}`));
