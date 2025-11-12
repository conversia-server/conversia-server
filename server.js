// =========================
// Convers IA - Servidor Multi-Cliente WhatsApp Web (Persistente + Mensagens)
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

if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
  console.log("📂 Pasta de sessões criada:", sessionsDir);
}

// =========================
// Função para inicializar cliente WhatsApp
// =========================
async function startClient(clientId) {
  if (clients[clientId]) {
    console.log(`⚠️ Cliente ${clientId} já está ativo.`);
    return;
  }

  console.log(`🟢 Iniciando cliente: ${clientId}`);

  const clientPath = path.join(sessionsDir, clientId);
  if (!fs.existsSync(clientPath)) fs.mkdirSync(clientPath);

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

  client.on("qr", async (qr) => {
    const qrImage = await qrcode.toDataURL(qr);
    qrCodes[clientId] = qrImage;
    console.log(`📱 QR atualizado para cliente: ${clientId}`);
  });

  client.on("ready", () => {
    console.log(`✅ Cliente conectado e pronto: ${clientId}`);
    delete qrCodes[clientId];
  });

  client.on("authenticated", () => {
    console.log(`🔐 Cliente autenticado: ${clientId}`);
  });

  client.on("disconnected", (reason) => {
    console.log(`🔴 Cliente desconectado (${clientId}): ${reason}`);
    delete clients[clientId];
    delete qrCodes[clientId];
    setTimeout(() => {
      console.log(`♻️ Tentando reconectar cliente ${clientId}...`);
      startClient(clientId);
    }, 10000);
  });

  client.initialize().catch((err) => {
    console.error(`❌ Erro ao inicializar cliente ${clientId}:`, err);
  });

  clients[clientId] = client;
}

// =========================
// ROTAS PRINCIPAIS
// =========================

// Teste rápido
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
  res.json({ status: "starting", client_id: clientId });
});

// Obter QR Code atual
app.get("/wp-json/convers-ia/v1/qr", (req, res) => {
  const clientId = req.query.client_id || "default";
  const qr = qrCodes[clientId]
    ? qrCodes[clientId].replace(/^data:image\/png;base64,/, "")
    : null;
  console.log(`📤 QR solicitado (${clientId}): ${qr ? "OK" : "Aguardando..."}`);
  res.json({ qr });
});

// =========================
// 💬 Enviar mensagem via WhatsApp
// =========================
app.post("/wp-json/convers-ia/v1/send-message", async (req, res) => {
  const { client_id, to, message } = req.body;

  if (!client_id || !to || !message) {
    return res.status(400).json({
      error: "Parâmetros obrigatórios ausentes: client_id, to, message",
    });
  }

  const client = clients[client_id];
  if (!client) {
    return res
      .status(404)
      .json({ error: `Cliente ${client_id} não está conectado.` });
  }

  try {
    const formattedNumber = to.replace(/\D/g, "") + "@c.us";
    await client.sendMessage(formattedNumber, message);
    console.log(`💬 Mensagem enviada para ${to} (${client_id})`);
    res.json({ success: true, to, message });
  } catch (err) {
    console.error("❌ Erro ao enviar mensagem:", err);
    res.status(500).json({ error: "Falha ao enviar mensagem." });
  }
});

// =========================
// 🤖 Integração com Automação Inteligente (Convers IA Flow Builder)
// =========================

const WP_API_URL = "https://centrodecriacao.com.br/wp-json/convers-ia/v1/automations"; // 🔹 Substitua SEU_DOMINIO
const activeFlows = {}; // Cache de automações carregadas
const conversationState = {}; // Estado atual de cada usuário

// --- Carrega automações do WordPress ---
async function loadAutomations() {
  try {
    const res = await fetch(WP_API_URL);
    const data = await res.json();
    const flows = data.filter((a) => a.is_active && a.flow_data);
    flows.forEach((flow) => (activeFlows[flow.id] = flow));
    console.log(`🧩 ${flows.length} fluxos ativos carregados.`);
  } catch (err) {
    console.error("❌ Falha ao carregar automações:", err);
  }
}

// --- Interpreta mensagem recebida ---
async function handleIncomingMessage(clientId, message) {
  const sender = message.from;
  const text = message.body.toLowerCase().trim();
  const flow = Object.values(activeFlows)[0];
  if (!flow) return;

  const { nodes, connections } = flow.flow_data;

  // Se é a primeira mensagem do cliente → começa do início
  if (!conversationState[sender]) {
    const firstNode = nodes[0];
    conversationState[sender] = { node: firstNode };
    await message.reply(firstNode.text);
    await sendNextButtons(clientId, sender, firstNode, connections);
    return;
  }

  const state = conversationState[sender];
  const currentNode = state.node;

  // Encontra a próxima conexão com base no texto
  const options = connections.filter((c) => c.from === currentNode.id);
  let matched = null;
  for (const conn of options) {
    if (!conn.condition) {
      matched = conn;
      break;
    }
    const keywords = conn.condition
      .split(",")
      .map((k) => k.trim().toLowerCase());
    if (keywords.some((k) => text.includes(k))) {
      matched = conn;
      break;
    }
  }

  if (!matched) {
    await message.reply("❓ Não entendi... tente novamente.");
    await sendNextButtons(clientId, sender, currentNode, connections);
    return;
  }

  const nextNode = nodes.find((n) => n.id === matched.to);
  if (!nextNode) {
    await message.reply("⚡ Fim do fluxo.");
    delete conversationState[sender];
    return;
  }

  conversationState[sender].node = nextNode;
  await message.reply(nextNode.text);
  await sendNextButtons(clientId, sender, nextNode, connections);

  // Encaminhamento automático
  if (nextNode.type === "Encaminhar") {
    const setor = nextNode.text || "atendimento";
    console.log(`📨 Encaminhando ${sender} para o setor: ${setor}`);
  }
}

// --- Envia botões interativos (via WhatsApp) ---
async function sendNextButtons(clientId, to, node, connections) {
  const client = clients[clientId];
  if (!client) return;

  const options = connections.filter(
    (c) => c.from === node.id && c.as_button
  );
  if (options.length === 0) return;

  const buttons = options.map((c) => ({
    body: c.condition.split(",")[0].trim(),
  }));

  await client.sendMessage(to, {
    text: "Escolha uma opção:",
    buttons,
    headerType: 1,
  });
}

// --- Listener global para todas as mensagens ---
setInterval(loadAutomations, 60000); // Atualiza fluxos a cada 1 min
loadAutomations(); // Carrega inicial

Object.keys(clients).forEach((clientId) => {
  const client = clients[clientId];
  client.on("message", async (msg) => {
    try {
      await handleIncomingMessage(clientId, msg);
    } catch (err) {
      console.error("❌ Erro ao processar mensagem:", err);
    }
  });
});

// =========================
// EXECUÇÃO DO SERVIDOR
// =========================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Servidor Convers IA persistente rodando na porta ${PORT}`);
});


