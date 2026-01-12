import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Shop products data - migrated from hardcoded store page
const shopProducts = [
  {
    slug: 'home-kit',
    sku: 'HOME-KIT-001',
    name: 'Oh! Home Kit',
    nameZhTW: 'Oh! 家庭套餐',
    nameZhCN: 'Oh! 家庭套餐',
    nameEs: 'Kit para el Hogar Oh!',
    description: 'Everything you need to make restaurant-quality beef noodle soup at home',
    descriptionZhTW: '在家製作餐廳品質牛肉麵所需的一切',
    descriptionZhCN: '在家制作餐厅品质牛肉面所需的一切',
    descriptionEs: 'Todo lo que necesitas para hacer sopa de fideos con carne de res de calidad de restaurante en casa',
    priceCents: 3499,
    category: 'FOOD',
    imageUrl: '/store/HomeKit.png',
    isAvailable: true,
  },
  {
    slug: 'beef-bone-broth',
    sku: 'BROTH-001',
    name: 'Beef Bone Broth Concentrate',
    nameZhTW: '濃縮牛骨湯',
    nameZhCN: '浓缩牛骨汤',
    nameEs: 'Concentrado de Caldo de Hueso de Res',
    description: 'Our signature rich, collagen-packed broth in concentrated form',
    descriptionZhTW: '我們招牌濃郁、富含膠原蛋白的濃縮湯底',
    descriptionZhCN: '我们招牌浓郁、富含胶原蛋白的浓缩汤底',
    descriptionEs: 'Nuestro caldo rico en colágeno en forma concentrada',
    priceCents: 2499,
    category: 'FOOD',
    imageUrl: '/store/BoneConcentrate.png',
    isAvailable: true,
  },
  {
    slug: 'chili-oil',
    sku: 'COND-CHILI-001',
    name: 'Signature Chili Oil',
    nameZhTW: '招牌辣油',
    nameZhCN: '招牌辣油',
    nameEs: 'Aceite de Chile Exclusivo',
    description: 'House-made chili oil with our secret blend of spices',
    descriptionZhTW: '自製辣油，採用我們的秘製香料配方',
    descriptionZhCN: '自制辣油，采用我们的秘制香料配方',
    descriptionEs: 'Aceite de chile hecho en casa con nuestra mezcla secreta de especias',
    priceCents: 1499,
    category: 'CONDIMENTS',
    imageUrl: '/store/ChiliOil.png',
    isAvailable: true,
  },
  {
    slug: 'ceramic-noodle-bowl',
    sku: 'MERCH-BOWL-001',
    name: 'Ceramic Noodle Bowl',
    nameZhTW: '陶瓷麵碗',
    nameZhCN: '陶瓷面碗',
    nameEs: 'Tazón de Cerámica para Fideos',
    description: 'Hand-crafted ceramic bowl perfect for enjoying noodle soups',
    descriptionZhTW: '手工陶瓷碗，完美享用麵湯',
    descriptionZhCN: '手工陶瓷碗，完美享用面汤',
    descriptionEs: 'Tazón de cerámica hecho a mano, perfecto para disfrutar sopas de fideos',
    priceCents: 4200,
    category: 'MERCHANDISE',
    imageUrl: '/store/CeramicBowl.png',
    isAvailable: true,
  },
  {
    slug: 'bamboo-chopsticks',
    sku: 'MERCH-CHOP-001',
    name: 'Bamboo Chopsticks Set',
    nameZhTW: '竹筷套裝',
    nameZhCN: '竹筷套装',
    nameEs: 'Juego de Palillos de Bambú',
    description: 'Set of 4 premium bamboo chopsticks with custom engraving',
    descriptionZhTW: '4雙高級竹筷套裝，附客製化刻字',
    descriptionZhCN: '4双高级竹筷套装，附定制刻字',
    descriptionEs: 'Juego de 4 palillos de bambú premium con grabado personalizado',
    priceCents: 2800,
    category: 'MERCHANDISE',
    imageUrl: '/store/ChopsticksSet.png',
    isAvailable: true,
  },
  {
    slug: 'chef-apron',
    sku: 'MERCH-APRON-001',
    name: "Chef's Apron",
    nameZhTW: '主廚圍裙',
    nameZhCN: '主厨围裙',
    nameEs: 'Delantal de Chef',
    description: 'Professional-grade canvas apron with Oh! branding',
    descriptionZhTW: '專業級帆布圍裙，印有 Oh! 品牌',
    descriptionZhCN: '专业级帆布围裙，印有 Oh! 品牌',
    descriptionEs: 'Delantal de lona de grado profesional con marca Oh!',
    priceCents: 4500,
    category: 'MERCHANDISE',
    imageUrl: '/store/ChefApron.png',
    isAvailable: true,
  },
  {
    slug: 'classic-tshirt',
    sku: 'APRL-TSH-001',
    name: 'Oh! Classic T-Shirt',
    nameZhTW: 'Oh! 經典T恤',
    nameZhCN: 'Oh! 经典T恤',
    nameEs: 'Camiseta Clásica Oh!',
    description: 'Soft cotton tee with embroidered Oh! logo',
    descriptionZhTW: '柔軟棉質T恤，刺繡 Oh! 標誌',
    descriptionZhCN: '柔软棉质T恤，刺绣 Oh! 标志',
    descriptionEs: 'Camiseta de algodón suave con logo Oh! bordado',
    priceCents: 3200,
    category: 'APPAREL',
    imageUrl: '/store/TShirt.png',
    isAvailable: true,
    variants: JSON.stringify([
      { size: 'S', stock: 25 },
      { size: 'M', stock: 50 },
      { size: 'L', stock: 50 },
      { size: 'XL', stock: 25 },
    ]),
  },
  {
    slug: 'comfort-hoodie',
    sku: 'APRL-HOOD-001',
    name: 'Comfort Hoodie',
    nameZhTW: '舒適連帽衫',
    nameZhCN: '舒适连帽衫',
    nameEs: 'Sudadera con Capucha Comfort',
    description: 'Cozy fleece hoodie with embroidered logo',
    descriptionZhTW: '舒適抓絨連帽衫，刺繡標誌',
    descriptionZhCN: '舒适抓绒连帽衫，刺绣标志',
    descriptionEs: 'Sudadera de polar acogedora con logo bordado',
    priceCents: 6800,
    category: 'APPAREL',
    imageUrl: '/store/Hoodie.png',
    isAvailable: true,
    variants: JSON.stringify([
      { size: 'S', stock: 15 },
      { size: 'M', stock: 30 },
      { size: 'L', stock: 30 },
      { size: 'XL', stock: 15 },
    ]),
  },
  {
    slug: 'artisan-wooden-bowl',
    sku: 'LTD-BOWL-001',
    name: 'Artisan Wooden Soup Bowl',
    nameZhTW: '工匠木製湯碗',
    nameZhCN: '工匠木制汤碗',
    nameEs: 'Tazón de Madera Artesanal para Sopa',
    description: 'Limited edition hand-carved wooden bowl by local artisan',
    descriptionZhTW: '限量版手工雕刻木碗，由當地工匠製作',
    descriptionZhCN: '限量版手工雕刻木碗，由当地工匠制作',
    descriptionEs: 'Tazón de madera tallado a mano de edición limitada por artesano local',
    priceCents: 14500,
    category: 'LIMITED_EDITION',
    imageUrl: '/store/WoodenBowl.png',
    isAvailable: true,
    stockCount: 50,
    lowStockThreshold: 10,
  },
];

async function seedShopProducts() {
  console.log('🛍️  Seeding shop products...\n');

  try {
    // Check existing products
    const existingCount = await prisma.shopProduct.count();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing products.`);
      console.log('   Use --force to delete and re-seed, or skipping...\n');

      if (process.argv.includes('--force')) {
        console.log('🗑️  Deleting existing products...');
        await prisma.shopProduct.deleteMany({});
        console.log('✅ Deleted existing products\n');
      } else {
        console.log('Skipping seed. Use --force to overwrite.');
        return;
      }
    }

    // Insert products
    for (const product of shopProducts) {
      const created = await prisma.shopProduct.create({
        data: product,
      });
      console.log(`✅ Created: ${created.name} (${created.slug})`);
    }

    console.log(`\n📦 Total products seeded: ${shopProducts.length}`);

  } catch (error) {
    console.error('❌ Error seeding shop products:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedShopProducts()
  .then(() => {
    console.log('\n✅ Shop products seed complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
