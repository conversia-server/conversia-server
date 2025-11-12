// =========================
// Convers IA - Servidor Multi-Cliente WhatsApp Web (Persistente + Mensagens)
// =========================

import express from "express";
import cors from "cors";
import qrcode from "qrcode";
import fs from "fs";
import path from "path";
import fetch from "node-fetch"; // ✅ Import necessário para compatibilidade Node 16/18
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
const q
