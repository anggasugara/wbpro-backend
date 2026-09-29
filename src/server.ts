import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { prisma } from "./db.js";
import {
  auth,
  hashPassword,
  signUser,
  verifyPassword,
  AuthRequest
} from "./auth.js";
import { connectorFor, connectExistingAccounts } from "./connector.js";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || true
  })
);

app.use(express.json({ limit: "2mb" }));

const port = Number(process.env.PORT || 3000);

type Handler = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => unknown | Promise<unknown>;

const wrap = (fn: Handler) =>
  (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

app.get(
  "/health",
  (_req: express.Request, res: express.Response) => {
    res.json({
      ok: true,
      service: "wbpro-backend",
      time: new Date().toISOString()
    });
  }
);
app.get("/", (_req: express.Request, res: express.Response) => {
  res.send("WBPRO OK");
});

app.post(
  "/api/auth/register",
  wrap(async (req, res) => {
    const input = z.object({
      workspaceName: z.string().min(2),
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8)
    }).parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { email: input.email }
    });

    if (existing) {
      return res.status(409).json({
        error: "Email already registered"
      });
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: input.workspaceName
      }
    });

    const user = await prisma.user.create({
      data: {
        workspaceId: workspace.id,
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        role: "ADMIN"
      }
    });

    res.status(201).json({
      token: signUser(user),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  })
);

app.post(
  "/api/auth/login",
  wrap(async (req, res) => {
    const input = z.object({
      email: z.string().email(),
      password: z.string()
    }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: input.email }
    });

    if (
      !user ||
      !(await verifyPassword(input.password, user.passwordHash))
    ) {
      return res.status(401).json({
        error: "Invalid credentials"
      });
    }

    res.json({
      token: signUser(user),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  })
);

app.get(
  "/api/me",
  auth,
  wrap(async (req, res) => {
    const authReq = req as AuthRequest;

    const user = await prisma.user.findUnique({
      where: {
        id: authReq.user!.id
      },
      include: {
        workspace: true
      }
    });

    res.json(user);
  })
);

app.get(
  "/api/dashboard",
  auth,
  wrap(async (req, res) => {
    const authReq = req as AuthRequest;
    const wid = authReq.user!.workspaceId;

    const [
      contacts,
      sent,
      replies,
      accounts,
      campaigns
    ] = await Promise.all([
      prisma.contact.count({
        where: {
          workspaceId: wid
        }
      }),

      prisma.message.count({
        where: {
          account: {
            workspaceId: wid
          },
          status: {
            in: ["SENT", "READ", "REPLIED"]
          }
        }
      }),

      prisma.message.count({
        where: {
          account: {
            workspaceId: wid
          },
          status: "REPLIED"
        }
      }),

      prisma.whatsAppAccount.findMany({
        where: {
          workspaceId: wid
        },
        orderBy: {
          createdAt: "desc"
        }
      }),

      prisma.campaign.findMany({
        where: {
          workspaceId: wid
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 10
      })
    ]);

    res.json({
      contacts,
      sent,
      replies,
      accounts,
      campaigns
    });
  })
);

app.get(
  "/api/contacts",
  auth,
  wrap(async (req, res) => {
    const authReq = req as AuthRequest;
    const q = typeof req.query.q === "string"
      ? req.query.q
      : "";

    const contacts = await prisma.contact.findMany({
      where: {
        workspaceId: authReq.user!.workspaceId,
        ...(q
          ? {
              OR: [
                {
                  name: {
                    contains: q,
                    mode: "insensitive"
                  }
                },
                {
                  phone: {
                    contains: q
                  }
                }
              ]
            }
          : {})
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 500
    });

    res.json(contacts);
  })
);

app.post(
  "/api/contacts",
  auth,
  wrap(async (req, res) => {
    const authReq = req as AuthRequest;

    const input = z.object({
      name: z.string().min(1),
      phone: z.string().min(5),
      tag: z.string().optional(),
      optedIn: z.boolean().default(false)
    }).parse(req.body);

    if (!input.optedIn) {
      return res.status(400).json({
        error: "Contact must have opted in before campaign messaging"
      });
    }

    const contact = await prisma.contact.create({
      data: {
        ...input,
        phone: input.phone || null,
        workspaceId: authReq.user!.workspaceId
      }
    });

    res.status(201).json(contact);
  })
);

app.delete(
  "/api/contacts/:id",
  auth,
  wrap(async (req, res) => {
    const authReq = req as AuthRequest;

    await prisma.contact.deleteMany({
      where: {
        id: String(req.params.id),
        workspaceId: authReq.user!.workspaceId
      }
    });

    res.status(204).end();
  })
);

app.get(
  "/api/templates",
  auth,
  wrap(async (req, res) => {
    const authReq = req as AuthRequest;

    res.json(
      await prisma.template.findMany({
        where: {
          workspaceId: authReq.user!.workspaceId
        },
        orderBy: {
          createdAt: "desc"
        }
      })
    );
  })
);

app.post(
  "/api/templates",
  auth,
  wrap(async (req, res) => {
    const authReq = req as AuthRequest;

    const input = z.object({
      name: z.string().min(1),
      body: z.string().min(1)
    }).parse(req.body);

    res.status(201).json(
      await prisma.template.create({
        data: {
          ...input,
          workspaceId: authReq.user!.workspaceId
        }
      })
    );
  })
);

app.delete(
  "/api/templates/:id",
  auth,
  wrap(async (req, res) => {
    const authReq = req as AuthRequest;

    await prisma.template.deleteMany({
      where: {
        id: String(req.params.id),
        workspaceId: authReq.user!.workspaceId
      }
    });

    res.status(204).end();
  })
);

app.get(
  "/api/whatsapp/accounts",
  auth,
  wrap(async (req, res) => {
    const authReq = req as AuthRequest;

    res.json(
      await prisma.whatsAppAccount.findMany({
        where: {
          workspaceId: authReq.user!.workspaceId
        },
        orderBy: {
          createdAt: "desc"
        }
      })
    );
  })
);

app.post(
  "/api/whatsapp/accounts",
  auth,
  wrap(async (req, res) => {
    const authReq = req as AuthRequest;

    const input = z.object({
      name: z.string().min(1),
      phone: z.string().min(5).optional(),
      connector: z.literal("baileys").default("baileys")
    }).parse(req.body);

    const account = await prisma.whatsAppAccount.create({
      data: {
        ...input,
        workspaceId: authReq.user!.workspaceId
      }
    });

    res.status(201).json(account);
  })
);

app.post(
  "/api/whatsapp/accounts/:id/connect",
  auth,
  wrap(async (req, res) => {
    const authReq = req as AuthRequest;
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: String(req.params.id), workspaceId: authReq.user!.workspaceId }
    });
    if (!account) return res.status(404).json({ error: "Account not found" });
    const connector = connectorFor(account.id, account.workspaceId);
    await connector.connect();
    res.json({ status: await connector.status(), qr: connector.getQr() });
  })
);

app.get(
  "/api/whatsapp/accounts/:id/status",
  auth,
  wrap(async (req, res) => {
    const authReq = req as AuthRequest;
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: String(req.params.id), workspaceId: authReq.user!.workspaceId }
    });
    if (!account) return res.status(404).json({ error: "Account not found" });
    const connector = connectorFor(account.id, account.workspaceId);
    res.json({ status: await connector.status(), qr: connector.getQr() });
  })
);

app.post(
  "/api/whatsapp/accounts/:id/disconnect",
  auth,
  wrap(async (req, res) => {
    const authReq = req as AuthRequest;
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: String(req.params.id), workspaceId: authReq.user!.workspaceId }
    });
    if (!account) return res.status(404).json({ error: "Account not found" });
    await connectorFor(account.id, account.workspaceId).disconnect();
    res.json({ status: "DISCONNECTED" });
  })
);

app.post(
  "/api/whatsapp/accounts/:id/send",
  auth,
  wrap(async (req, res) => {
    const authReq = req as AuthRequest;
    const input = z.object({ phone: z.string().min(5), body: z.string().min(1).max(4000) }).parse(req.body);
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: String(req.params.id), workspaceId: authReq.user!.workspaceId }
    });
    if (!account) return res.status(404).json({ error: "Account not found" });
    const connector = connectorFor(account.id, account.workspaceId);
    const result = await connector.sendMessage(input.phone, input.body);
    res.json(result);
  })
);

app.get(
  "/api/whatsapp/accounts/:id/messages",
  auth,
  wrap(async (req, res) => {
    const authReq = req as AuthRequest;
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: String(req.params.id), workspaceId: authReq.user!.workspaceId }
    });
    if (!account) return res.status(404).json({ error: "Account not found" });
    const messages = await prisma.message.findMany({
      where: { accountId: account.id },
      include: { contact: true },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    res.json(messages);
  })
);

app.get(
  "/api/campaigns",
  auth,
  wrap(async (req, res) => {
    const authReq = req as AuthRequest;

    res.json(
      await prisma.campaign.findMany({
        where: {
          workspaceId: authReq.user!.workspaceId
        },
        include: {
          account: true,
          _count: {
            select: {
              messages: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      })
    );
  })
);

app.post(
  "/api/campaigns",
  auth,
  wrap(async (req, res) => {
    const authReq = req as AuthRequest;

    const input = z.object({
      name: z.string().min(1),
      body: z.string().min(1),
      accountId: z.string(),
      contactIds: z.array(z.string()).min(1),
      scheduledAt: z.coerce.date().optional()
    }).parse(req.body);

    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        id: input.accountId,
        workspaceId: authReq.user!.workspaceId
      }
    });

    if (!account) {
      return res.status(404).json({
        error: "Account not found"
      });
    }

    const contacts = await prisma.contact.findMany({
      where: {
        id: {
          in: input.contactIds
        },
        workspaceId: authReq.user!.workspaceId,
        optedIn: true
      }
    });

    if (!contacts.length) {
      return res.status(400).json({
        error: "No opted-in contacts selected"
      });
    }

    const campaign = await prisma.campaign.create({
      data: {
        workspaceId: authReq.user!.workspaceId,
        accountId: account.id,
        name: input.name,
        body: input.body,
        status: input.scheduledAt
          ? "SCHEDULED"
          : "RUNNING",
        scheduledAt: input.scheduledAt
      }
    });

    await prisma.message.createMany({
      data: contacts.map((c) => ({
        campaignId: campaign.id,
        accountId: account.id,
        contactId: c.id,
        body: input.body.replaceAll("{nama}", c.name)
      }))
    });

    if (!input.scheduledAt) {
      setImmediate(() => runCampaign(campaign.id).catch((error) => console.error(error)));
    }

    res.status(201).json(campaign);
  })
);

async function runCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { account: true } });
  if (!campaign) return;

  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "RUNNING", startedAt: new Date() } });
  const connector = connectorFor(campaign.account.id, campaign.account.workspaceId);
  try {
    await connector.connect();
    const messages = await prisma.message.findMany({ where: { campaignId, status: "QUEUED" }, include: { contact: true }, orderBy: { createdAt: "asc" } });
    for (const message of messages) {
      try {
        const result = await connector.sendMessage(message.contact.phone, message.body);
        await prisma.message.update({ where: { id: message.id }, data: { status: "SENT", providerId: result.providerId, sentAt: new Date() } });
        await new Promise(resolve => setTimeout(resolve, 1200));
      } catch (e: any) {
        await prisma.message.update({ where: { id: message.id }, data: { status: "FAILED", error: e?.message || "send failed" } });
      }
    }
    const remaining = await prisma.message.count({ where: { campaignId, status: "QUEUED" } });
    await prisma.campaign.update({ where: { id: campaignId }, data: remaining ? { status: "FAILED" } : { status: "COMPLETED", finishedAt: new Date() } });
  } catch (e: any) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "FAILED", finishedAt: new Date() } });
    console.error(e);
  }
}

app.get(
  "/api/reports",
  auth,
  wrap(async (req, res) => {
    const authReq = req as AuthRequest;
    const wid = authReq.user!.workspaceId;

    const where = {
      account: {
        workspaceId: wid
      }
    };

    const [
      queued,
      sent,
      failed,
      read,
      replied
    ] = await Promise.all([
      prisma.message.count({
        where: {
          ...where,
          status: "QUEUED"
        }
      }),

      prisma.message.count({
        where: {
          ...where,
          status: "SENT"
        }
      }),

      prisma.message.count({
        where: {
          ...where,
          status: "FAILED"
        }
      }),

      prisma.message.count({
        where: {
          ...where,
          status: "READ"
        }
      }),

      prisma.message.count({
        where: {
          ...where,
          status: "REPLIED"
        }
      })
    ]);

    res.json({
      queued,
      sent,
      failed,
      read,
      replied
    });
  })
);

app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);

    if (err?.name === "ZodError") {
      return res.status(400).json({
        error: err.issues
      });
    }

    res.status(500).json({
      error: "Internal server error"
    });
  }
);

app.listen(port, () => {
  console.log(`WBPro backend listening on http://localhost:${port}`);
  connectExistingAccounts().catch((error) => console.error("WhatsApp startup error", error));
});
