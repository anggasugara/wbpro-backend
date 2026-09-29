import fs from "node:fs/promises";
import path from "node:path";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket
} from "@whiskeysockets/baileys";
import pino from "pino";
import { prisma } from "./db.js";

export type SendResult = {
  providerId: string;
};

export type WhatsAppStatus = "DISCONNECTED" | "CONNECTING" | "QR_READY" | "CONNECTED";

export interface WhatsAppConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  status(): Promise<string>;
  sendMessage(phone: string, body: string): Promise<SendResult>;
}

const sessionsRoot = path.resolve(process.env.WHATSAPP_SESSIONS_DIR || "./sessions");
const log = pino({ level: process.env.LOG_LEVEL || "info" });

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) throw new Error("Nomor WhatsApp tidak valid");
  return digits;
}

function textFromMessage(message: any) {
  return message?.conversation
    || message?.extendedTextMessage?.text
    || message?.imageMessage?.caption
    || message?.videoMessage?.caption
    || "";
}

class BaileysConnector implements WhatsAppConnector {
  private socket: WASocket | null = null;
  private state: WhatsAppStatus = "DISCONNECTED";
  private qr: string | null = null;
  private connectPromise: Promise<void> | null = null;
  private manualDisconnect = false;

  constructor(
    private readonly accountId: string,
    private readonly workspaceId: string
  ) {}

  async connect() {
    if (this.state === "CONNECTED" || this.state === "CONNECTING" || this.state === "QR_READY") return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this.start();
    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private async start() {
    this.manualDisconnect = false;
    this.state = "CONNECTING";
    this.qr = null;
    await fs.mkdir(path.join(sessionsRoot, this.accountId), { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(path.join(sessionsRoot, this.accountId));

    this.socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: log.child({ accountId: this.accountId }),
      browser: ["WBPro", "Chrome", "1.0.0"]
    });

    this.socket.ev.on("creds.update", saveCreds);
    this.socket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        this.qr = qr;
        this.state = "QR_READY";
        await this.persistStatus("QR_READY");
      }

      if (connection === "open") {
        this.qr = null;
        this.state = "CONNECTED";
        const jid = this.socket?.user?.id?.split(":")[0]?.split("@")[0] || null;
        await prisma.whatsAppAccount.updateMany({
          where: { id: this.accountId, workspaceId: this.workspaceId },
          data: { status: "CONNECTED", ...(jid ? { phone: jid } : {}) }
        });
      }

      if (connection === "close") {
        this.socket = null;
        const code = (lastDisconnect?.error as any)?.output?.statusCode;
        this.state = "DISCONNECTED";
        await this.persistStatus("DISCONNECTED");

        if (!this.manualDisconnect && code !== DisconnectReason.loggedOut) {
          setTimeout(() => this.connect().catch((error) => log.error(error)), 1500);
        }
      }
    });

    this.socket.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const message of messages) {
        if (!message.message || message.key.fromMe) continue;
        await this.saveIncomingMessage(message).catch((error) => log.error(error));
      }
    });

    await this.persistStatus(this.state);
  }

  private async persistStatus(status: string) {
    await prisma.whatsAppAccount.updateMany({
      where: { id: this.accountId, workspaceId: this.workspaceId },
      data: { status }
    });
  }

  private async saveIncomingMessage(message: any) {
    const remoteJid = message.key.remoteJid;
    if (!remoteJid || remoteJid.endsWith("@g.us") || remoteJid === "status@broadcast") return;

    const phone = remoteJid.split("@")[0].split(":")[0];
    const body = textFromMessage(message.message);
    if (!phone || !body) return;

    const contact = await prisma.contact.upsert({
      where: { workspaceId_phone: { workspaceId: this.workspaceId, phone } },
      update: {},
      create: {
        workspaceId: this.workspaceId,
        name: message.pushName || phone,
        phone,
        optedIn: false
      }
    });

    await prisma.message.create({
      data: {
        accountId: this.accountId,
        contactId: contact.id,
        body,
        status: "REPLIED",
        repliedAt: new Date()
      }
    });
  }

  async disconnect() {
    this.manualDisconnect = true;
    if (this.socket) {
      this.socket.end(undefined);
      this.socket = null;
    }
    this.state = "DISCONNECTED";
    this.qr = null;
    await this.persistStatus("DISCONNECTED");
  }

  async status() {
    return this.state;
  }

  getQr() {
    return this.qr;
  }

  async sendMessage(phone: string, body: string): Promise<SendResult> {
    if (this.state !== "CONNECTED" || !this.socket) {
      await this.connect();
      const deadline = Date.now() + 30000;
      while (this.state !== "CONNECTED" && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (this.state !== "CONNECTED" || !this.socket) {
      throw new Error("WhatsApp belum terhubung. Scan QR terlebih dahulu.");
    }

    const jid = `${normalizePhone(phone)}@s.whatsapp.net`;
    const result = await this.socket.sendMessage(jid, { text: body });
    if (!result?.key?.id) throw new Error("WhatsApp tidak mengembalikan ID pesan");

    return { providerId: result.key.id };
  }
}

const connectors = new Map<string, BaileysConnector>();

export function connectorFor(accountId: string, workspaceId?: string): BaileysConnector {
  const existing = connectors.get(accountId);
  if (existing) return existing;
  if (!workspaceId) throw new Error("workspaceId diperlukan untuk koneksi WhatsApp");
  const connector = new BaileysConnector(accountId, workspaceId);
  connectors.set(accountId, connector);
  return connector;
}

export async function connectExistingAccounts() {
  const accounts = await prisma.whatsAppAccount.findMany();
  if (accounts.length) {
    await prisma.whatsAppAccount.updateMany({
      where: { id: { in: accounts.map((account) => account.id) } },
      data: { connector: "baileys" }
    });
  }
  for (const account of accounts) {
    connectorFor(account.id, account.workspaceId).connect().catch((error) => log.error(error));
  }
}
