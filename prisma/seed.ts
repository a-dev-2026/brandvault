import { PrismaClient, AssetType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.DEMO_EMAIL!.trim().toLowerCase();
  const rawPassword = process.env.DEMO_PASSWORD!;

  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  // 1. Upsert Demo User
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
    },
    create: {
      email,
      password: hashedPassword,
      name: 'Demo Admin',
    },
  });

  // 2. Upsert Workspace
  let workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: 'Acme Studio Workspace',
        userId: user.id,
      },
    });
  }

  // 3. Upsert Brand
  let brand = await prisma.brand.findFirst({
    where: { workspaceId: workspace.id, name: 'Acme Studio' },
  });

  if (!brand) {
    brand = await prisma.brand.create({
      data: {
        workspaceId: workspace.id,
        name: 'Acme Studio',
        logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80',
        primaryColor: '#4F46E5',
        secondaryColor: '#F59E0B',
        tagline: 'Creative Excellence Delivered',
        guidelines: 'Use primary brand colors #4F46E5 and #F59E0B for main actions.',
      },
    });
  }

  // 4. Folders: Campaigns > Summer 2026, Logos
  let campaignsFolder = await prisma.folder.findFirst({
    where: { workspaceId: workspace.id, name: 'Campaigns', parentId: null },
  });
  if (!campaignsFolder) {
    campaignsFolder = await prisma.folder.create({
      data: {
        workspaceId: workspace.id,
        name: 'Campaigns',
      },
    });
  }

  let summerFolder = await prisma.folder.findFirst({
    where: { workspaceId: workspace.id, name: 'Summer 2026', parentId: campaignsFolder.id },
  });
  if (!summerFolder) {
    summerFolder = await prisma.folder.create({
      data: {
        workspaceId: workspace.id,
        name: 'Summer 2026',
        parentId: campaignsFolder.id,
      },
    });
  }

  let logosFolder = await prisma.folder.findFirst({
    where: { workspaceId: workspace.id, name: 'Logos', parentId: null },
  });
  if (!logosFolder) {
    logosFolder = await prisma.folder.create({
      data: {
        workspaceId: workspace.id,
        name: 'Logos',
      },
    });
  }

  // 5. Assets (8 total, 1 in Trash)
  const assetsData = [
    {
      name: 'Acme Primary Logo',
      type: AssetType.LOGO,
      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
      size: 245000,
      mimeType: 'image/png',
      tags: ['vector', 'logo', 'primary'],
      aiTags: ['graphic', 'branding', 'abstract', 'symbol'],
      folderId: logosFolder.id,
      deletedAt: null,
    },
    {
      name: 'Acme Secondary Icon',
      type: AssetType.LOGO,
      url: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800&q=80',
      size: 182000,
      mimeType: 'image/svg+xml',
      tags: ['icon', 'monochrome'],
      aiTags: ['minimal', 'shape', 'emblem'],
      folderId: logosFolder.id,
      deletedAt: null,
    },
    {
      name: 'Summer Campaign Hero Banner',
      type: AssetType.IMAGE,
      url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80',
      size: 1420000,
      mimeType: 'image/jpeg',
      tags: ['summer', 'beach', 'hero', '2026'],
      aiTags: ['ocean', 'sea', 'nature', 'sunny', 'landscape'],
      folderId: summerFolder.id,
      deletedAt: null,
    },
    {
      name: 'Summer Promo Video',
      type: AssetType.VIDEO,
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      size: 8500000,
      mimeType: 'video/mp4',
      tags: ['video', 'promo', 'summer'],
      aiTags: ['motion', 'trailer', 'outdoor', 'action'],
      folderId: summerFolder.id,
      deletedAt: null,
    },
    {
      name: 'Brand Guidelines 2026 PDF',
      type: AssetType.DOCUMENT,
      url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      size: 512000,
      mimeType: 'application/pdf',
      tags: ['guidelines', 'pdf', 'document'],
      aiTags: ['text', 'specification', 'manual'],
      folderId: campaignsFolder.id,
      deletedAt: null,
    },
    {
      name: 'Inter Custom Font',
      type: AssetType.FONT,
      url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2',
      size: 98000,
      mimeType: 'font/woff2',
      tags: ['font', 'typography', 'sans-serif'],
      aiTags: ['typeface', 'clean', 'modern'],
      folderId: null,
      deletedAt: null,
    },
    {
      name: 'Product Packaging Mockup',
      type: AssetType.IMAGE,
      url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&q=80',
      size: 960000,
      mimeType: 'image/jpeg',
      tags: ['mockup', 'packaging', 'product'],
      aiTags: ['container', 'box', 'design'],
      folderId: null,
      deletedAt: null,
    },
    {
      name: 'Draft Concept Poster (Deprecated)',
      type: AssetType.IMAGE,
      url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&q=80',
      size: 1100000,
      mimeType: 'image/jpeg',
      tags: ['draft', 'deprecated', 'trash'],
      aiTags: ['art', 'painting', 'sketch'],
      folderId: null,
      deletedAt: new Date(),
    },
  ];

  for (const assetData of assetsData) {
    const existingAsset = await prisma.asset.findFirst({
      where: {
        workspaceId: workspace.id,
        name: assetData.name,
      },
    });

    if (!existingAsset) {
      await prisma.asset.create({
        data: {
          workspaceId: workspace.id,
          ...assetData,
        },
      });
    }
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
