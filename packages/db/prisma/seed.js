import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Create multiple tenants to demo multi-tenant
  const tenants = [
    {
      slug: 'oh',
      name: 'Oh Beef Noodle Soup',
      brandName: 'Oh! 哦牛肉麵',
      primaryColor: '#dc2626',
      locations: [
        { name: 'Lehi Flagship', city: 'Lehi', address: '123 Main St, Lehi, UT 84043', lat: 40.3916, lng: -111.8508 },
        { name: 'Provo Station', city: 'Provo', address: '456 University Ave, Provo, UT 84601', lat: 40.2338, lng: -111.6585 }
      ],
      menu: [
        { name: 'Classic Beef Noodles', priceCents: 1499 },
        { name: 'Spicy Beef Noodles', priceCents: 1599 },
        { name: 'Dry Noodles (No Soup)', priceCents: 1399 },
        { name: 'A5 Wagyu Upgrade', priceCents: 1200 },
        { name: 'Braised Tendon', priceCents: 399 },
        { name: 'Marinated Egg', priceCents: 199 },
        { name: 'Extra Noodles', priceCents: 299 },
        { name: 'Pickled Vegetables', priceCents: 149 }
      ]
    },
    {
      slug: 'ramen-lab',
      name: 'Ramen Lab',
      brandName: 'Ramen Lab',
      primaryColor: '#f59e0b',
      locations: [
        { name: 'SoHo', city: 'New York', address: '70 Kenmare St, New York, NY 10012', lat: 40.7223, lng: -73.9960 }
      ],
      menu: [
        { name: 'Tonkotsu Ramen', priceCents: 1799 },
        { name: 'Miso Ramen', priceCents: 1699 },
        { name: 'Spicy Miso', priceCents: 1799 },
        { name: 'Extra Chashu', priceCents: 499 },
        { name: 'Ajitama Egg', priceCents: 249 }
      ]
    }
  ]

  for (const tenantData of tenants) {
    let tenant = await prisma.tenant.findUnique({ where: { slug: tenantData.slug } })
    
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: tenantData.name,
          slug: tenantData.slug,
          brandName: tenantData.brandName,
          primaryColor: tenantData.primaryColor,
          subscriptionStatus: 'ACTIVE'
        }
      })
      console.log(`✓ Created tenant: ${tenant.name}`)
    } else {
      console.log(`⤷ Tenant exists: ${tenant.name}`)
    }

    // Locations
    for (const locData of tenantData.locations) {
      let location = await prisma.location.findFirst({
        where: { name: locData.name, tenantId: tenant.id }
      })
      
      if (!location) {
        location = await prisma.location.create({
          data: { ...locData, tenantId: tenant.id }
        })
        console.log(`  ✓ Created location: ${locData.name}`)
      } else {
        console.log(`  ⤷ Location exists: ${locData.name}`)
      }

      // Create seats for this location
      const seatCount = await prisma.seat.count({ where: { locationId: location.id } })
      if (seatCount === 0) {
        const seats = []
        for (let i = 1; i <= 12; i++) {
          seats.push({
            number: `A${i}`,
            qrCode: `${tenant.slug}-${location.city.toLowerCase()}-a${i}-${Math.random().toString(36).substring(2, 9)}`,
            locationId: location.id,
            status: 'AVAILABLE'
          })
        }
        await prisma.seat.createMany({ data: seats })
        console.log(`    ✓ Created 12 seats`)
      } else {
        console.log(`    ⤷ Seats exist (${seatCount})`)
      }

      // Create location stats
      const statsExist = await prisma.locationStats.findUnique({ 
        where: { locationId: location.id } 
      })
      if (!statsExist) {
        await prisma.locationStats.create({
          data: {
            locationId: location.id,
            totalSeats: 12,
            availableSeats: 12,
            occupiedSeats: 0,
            reservedSeats: 0,
            avgWaitMinutes: 0
          }
        })
        console.log(`    ✓ Created location stats`)
      } else {
        console.log(`    ⤷ Stats exist`)
      }
    }

    // Menu
    const existingMenu = await prisma.menuItem.count({ where: { tenantId: tenant.id } })
    if (existingMenu === 0) {
      await prisma.menuItem.createMany({
        data: tenantData.menu.map(item => ({ ...item, tenantId: tenant.id }))
      })
      console.log(`  ✓ Created ${tenantData.menu.length} menu items`)
    } else {
      console.log(`  ⤷ Menu exists (${existingMenu} items)`)
    }
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })