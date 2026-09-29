import "dotenv/config";
import { prisma } from "../src/db.js";
import { hashPassword } from "../src/auth.js";

const passwordHash = await hashPassword("ChangeMe123!");
const workspace = await prisma.workspace.create({ data: { name: "WBPro Demo Workspace" } });
await prisma.user.create({ data: {
  workspaceId: workspace.id, name: "Owner", email: "owner@example.com", passwordHash, role: "ADMIN"
}});
await prisma.template.createMany({ data: [
  { workspaceId: workspace.id, name: "Promo Pelanggan", body: "Halo {nama}, ada promo spesial untuk kamu hari ini." },
  { workspaceId: workspace.id, name: "Follow Up Order", body: "Halo {nama}, apakah ada yang bisa kami bantu untuk pesananmu?" }
]});
await prisma.whatsAppAccount.create({ data: {
  workspaceId: workspace.id, name: "Demo Connector", phone: "+620000000000", connector: "mock", status: "CONNECTED"
}});
console.log("Seed complete. Login: owner@example.com / ChangeMe123!");
await prisma.$disconnect();
