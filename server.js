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
app.use(cors());

// Armazena múltiplos clientes e QRs por domínio/site
const clients = {};
const qrCodes = {};

// Função para iniciar uma nova sessão WhatsApp
function startClient(clientId) {
  if (clients[clientId]) return;

  console.log(`🟢 Iniciando cliente: ${clientId}`);

  const client = new Client({
    authStrategy: new LocalAuth({ clientId }),
    puppeteer: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  client.on("qr", async (qr) => {
    const qrImage = await qrcode.toDataURL(qr);
    qrCodes[clientId] = qrImage;
    console.log(`📱 QR atualizado para cliente: ${clientId}`);
  });

  client.on("ready", () => {
    console.log(`✅ Cliente pronto: ${clientId}`);
  });

  client.on("disconnected", () => {
    console.log(`🔴 Cliente desconectado: ${clientId}`);
    delete clients[clientId];
  });

  client.initialize();
  clients[clientId] = client;
}

// =========================
// ROTAS PRINCIPAIS
// =========================

// Rota raiz (teste rápido)
app.get("/", (req, res) => {
  res.json({ status: "Servidor ativo", clients: Object.keys(clients) });
});

// Iniciar sessão (cria cliente e retorna status)
app.all("/wp-json/convers-ia/v1/connect", (req, res) => {
  const clientId = req.query.client_id || "default";
  console.log(`🔗 Conectando cliente: ${clientId}`);

  if (!clients[clientId]) startClient(clientId);
  res.json({ status: "starting", client_id: clientId });
});

// Obter QR code para o cliente atual
app.get("/wp-json/convers-ia/v1/qr", (req, res) => {
  const clientId = req.query.client_id || "default";
  const qr = qrCodes[clientId]
    ? qrCodes[clientId].replace(/^data:image\/png;base64,/, "")
    : null;
  res.json({ qr });
});

// =========================
// EXECUÇÃO DO SERVIDOR
// =========================
const PORT = process.env.PORT || 10000; // pode ser 10000 para Render
app.listen(PORT, () => {
  console.log(`🌐 Servidor Convers IA Multi-Cliente rodando na porta ${PORT}`);
});

