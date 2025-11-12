// =========================
// Convers IA - Servidor Multi-Cliente WhatsApp Web
// =========================

import express from "express";
import cors from "cors";
import qrcode from "qrcode";

// Importação compatível com CommonJS
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

// Inicializa o servidor Express
const app = express();
app.use(express.json());

// =========================
// 🔧 Configuração completa de CORS
// =========================
app.use(cors({
  origin: '*', // permite conexões de qualquer domínio (WordPress)
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Permite respostas imediatas a pré-flights OPTIONS
app.options('*', cors());

// =========================
// Armazenamento de clientes e QRs
// =========================
const clients = {};
const qrCodes = {};

// =========================
// Função para iniciar cliente WhatsApp
// =========================
function startClient(clientId) {
  if (clients[clientId]) {
    console.log(`⚠️ Cliente ${clientId} já iniciado.`);
    return;
  }

  console.log(`🟢 Iniciando cliente: ${clientId}`);

  const client = new Client({
    authStrategy: new LocalAuth({ clientId }),
    puppeteer: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  // Evento QR — gerado quando precisa autenticar
  client.on("qr", async (qr) => {
    try {
      const qrImage = await qrcode.toDataURL(qr);
      qrCodes[clientId] = qrImage;
      console.log(`📱 QR atualizado para cliente: ${clientId}`);
    } catch (err) {
      console.error(`❌ Erro ao gerar QR para ${clientId}:`, err);
    }
  });

  // Cliente pronto
  client.on("ready", () => {
    console.log(`✅ Cliente pronto: ${clientId}`);
  });

  // Cliente desconectado
  client.on("disconnected", () => {
    console.log(`🔴 Cliente desconectado: ${clientId}`);
    delete clients[clientId];
    delete qrCodes[clientId];
  });

  client.initialize();
  clients[clientId] = client;
}

// =========================
// ROTAS PRINCIPAIS
// =========================

// Rota base de status (teste rápido)
app.get("/", (req, res) => {
  res.json({
    status: "Servidor ativo",
    clients: Object.keys(clients),
  });
});

// Iniciar sessão (WordPress → iniciar WhatsApp)
app.all("/wp-json/convers-ia/v1/connect", (req, res) => {
  const clientId = req.query.client_id || "default";
  console.log(`🔗 Solicitando conexão para cliente: ${clientId}`);

  if (!clients[clientId]) {
    startClient(clientId);
  }

  res.json({
    status: "starting",
    client_id: clientId,
  });
});

// Obter QR Code (WordPress → mostrar QR)
app.get("/wp-json/convers-ia/v1/qr", (req, res) => {
  const clientId = req.query.client_id || "default";
  const qr = qrCodes[clientId]
    ? qrCodes[clientId].replace(/^data:image\/png;base64,/, "")
    : null;

  console.log(`📤 QR enviado para ${clientId}: ${qr ? "OK" : "NULO"}`);
  res.json({ qr });
});

// =========================
// EXECUÇÃO DO SERVIDOR
// =========================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Servidor Convers IA Multi-Cliente rodando na porta ${PORT}`);
});
