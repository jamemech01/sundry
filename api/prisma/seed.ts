import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, Prisma } from '../libs/prisma/generated/client'
import bcrypt from 'bcrypt'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const productSeeds: [string, string, number][] = [
    ['Piano', 'Musical Instruments', 12000],
    ['Guitar', 'Musical Instruments', 4500],
    ['Drum', 'Musical Instruments', 5500],
    ['Violin', 'Musical Instruments', 4800],
    ['Flute', 'Musical Instruments', 1600],
    ['Ukulele', 'Musical Instruments', 2200],
    ['Saxophone', 'Musical Instruments', 15000],
    ['Trumpet', 'Musical Instruments', 8500],
    ['Cello', 'Musical Instruments', 22000],
    ['Harmonica', 'Musical Instruments', 450],
    ['Microphone', 'Audio', 1800],
    ['Speaker', 'Audio', 3200],
    ['Headphone', 'Audio', 2200],
    ['Amplifier', 'Audio', 6500],
    ['Mixer', 'Audio', 4200],
    ['Turntable', 'Audio', 5800],
    ['Subwoofer', 'Audio', 3800],
    ['Soundbar', 'Audio', 2900],
    ['Laptop', 'Computer', 25000],
    ['Monitor', 'Computer', 6500],
    ['Printer', 'Computer', 4200],
    ['Desktop PC', 'Computer', 18000],
    ['Scanner', 'Computer', 3500],
    ['Projector', 'Computer', 9500],
    ['Server', 'Computer', 45000],
    ['Motherboard', 'Computer', 6800],
    ['Keyboard', 'Computer Accessories', 2500],
    ['Mouse', 'Computer Accessories', 800],
    ['Webcam', 'Computer Accessories', 1900],
    ['USB Drive', 'Computer Accessories', 450],
    ['External Hard Drive', 'Computer Accessories', 2800],
    ['Laptop Stand', 'Computer Accessories', 650],
    ['Cooling Pad', 'Computer Accessories', 750],
    ['Docking Station', 'Computer Accessories', 2200],
    ['Tablet', 'Electronics', 8500],
    ['Cable', 'Electronics', 300],
    ['Charger', 'Electronics', 900],
    ['Adapter', 'Electronics', 700],
    ['Powerbank', 'Electronics', 1200],
    ['Smartwatch', 'Electronics', 4500],
    ['Drone', 'Electronics', 15000],
    ['Smartphone', 'Electronics', 18000],
    ['Camera', 'Photography', 18000],
    ['Lens', 'Photography', 9500],
    ['Tripod', 'Photography', 1100],
    ['Flash', 'Photography', 2200],
    ['Camera Bag', 'Photography', 1500],
    ['Memory Card', 'Photography', 850],
    ['Controller', 'Gaming', 1800],
    ['Gamepad', 'Gaming', 1500],
    ['Gaming Chair', 'Gaming', 6500],
    ['Joystick', 'Gaming', 1200],
    ['VR Headset', 'Gaming', 12000],
    ['Gaming Console', 'Gaming', 15000],
    ['Bottle', 'Home & Living', 250],
    ['Cup', 'Home & Living', 150],
    ['Lamp', 'Home & Living', 850],
    ['Pillow', 'Home & Living', 350],
    ['Blanket', 'Home & Living', 650],
    ['Vase', 'Home & Living', 450],
    ['Clock', 'Home & Living', 550],
    ['Mirror', 'Home & Living', 1200],
    ['Rug', 'Home & Living', 1800],
    ['Curtain', 'Home & Living', 950],
    ['Router', 'Networking', 1800],
    ['Modem', 'Networking', 1200],
    ['Switch', 'Networking', 1500],
    ['Access Point', 'Networking', 2200],
    ['Jack', 'Accessories', 350],
    ['Wallet', 'Accessories', 650],
    ['Belt', 'Accessories', 450],
    ['Sunglasses', 'Accessories', 1200],
    ['Watch', 'Accessories', 3500],
    ['Backpack', 'Accessories', 1500],
    ['Blender', 'Kitchen', 1500],
    ['Toaster', 'Kitchen', 1200],
    ['Kettle', 'Kitchen', 850],
    ['Microwave', 'Kitchen', 3500],
    ['Coffee Maker', 'Kitchen', 2200],
    ['Frying Pan', 'Kitchen', 650],
    ['Knife Set', 'Kitchen', 950],
    ['Cutting Board', 'Kitchen', 350],
    ['Chair', 'Furniture', 1500],
    ['Desk', 'Furniture', 3500],
    ['Sofa', 'Furniture', 12000],
    ['Bookshelf', 'Furniture', 2800],
    ['Wardrobe', 'Furniture', 8500],
    ['Bed Frame', 'Furniture', 9500],
    ['Dining Table', 'Furniture', 7500],
    ['Nightstand', 'Furniture', 1800],
    ['Yoga Mat', 'Sports', 450],
    ['Dumbbell', 'Sports', 850],
    ['Bicycle', 'Sports', 6500],
    ['Tennis Racket', 'Sports', 1800],
    ['Basketball', 'Sports', 550],
    ['Football', 'Sports', 450],
    ['Hammer', 'Tools', 350],
    ['Screwdriver', 'Tools', 250],
    ['Drill', 'Tools', 2200],
    ['Wrench Set', 'Tools', 850],
]

const locations = [
    { lat: 13.7563, lng: 100.5018 },
    { lat: 13.7466, lng: 100.5347 },
    { lat: 13.7246, lng: 100.5295 },
    { lat: 13.7868, lng: 100.608 },
    { lat: 13.6685, lng: 100.634 },
    { lat: 13.913, lng: 100.604 },
    { lat: 13.7215, lng: 100.476 },
    { lat: 13.813, lng: 100.731 },
    { lat: 13.727, lng: 100.76 },
    { lat: 13.776, lng: 100.438 },
    { lat: 13.705, lng: 100.349 },
    { lat: 13.92, lng: 100.68 },
    { lat: 13.645, lng: 100.535 },
    { lat: 18.7883, lng: 98.9853 },
    { lat: 19.9105, lng: 99.8406 },
    { lat: 16.4419, lng: 102.835 },
    { lat: 17.4138, lng: 102.787 },
    { lat: 14.9799, lng: 102.0978 },
    { lat: 15.2287, lng: 104.8564 },
    { lat: 16.4322, lng: 103.5061 },
    { lat: 12.9236, lng: 100.8825 },
    { lat: 13.3611, lng: 100.9847 },
    { lat: 14.0228, lng: 99.5328 },
    { lat: 10.493, lng: 99.18 },
    { lat: 8.4304, lng: 99.9631 },
    { lat: 7.8804, lng: 98.3923 },
    { lat: 7.0084, lng: 100.4747 },
    { lat: 6.4255, lng: 101.8253 },
    { lat: 9.1382, lng: 99.3215 },
    { lat: 12.5684, lng: 99.9577 },
]

type CommonsPage = {
    title: string
    imageinfo?: {
        thumburl?: string
        url?: string
        mime?: string
    }[]
}

type Product = {
    name: string
    category: string
    price: number
    imageUrl: string
}

const imageCachePath = path.join(
    process.cwd(),
    'prisma',
    'product-image-cache.json',
)

const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms))

async function loadImageCache(): Promise<Record<string, string>> {
    try {
        return JSON.parse(await readFile(imageCachePath, 'utf8'))
    } catch {
        return {}
    }
}

async function saveImageCache(cache: Record<string, string>) {
    await writeFile(imageCachePath, JSON.stringify(cache, null, 2))
}

async function getProductImageUrl(
    name: string,
    cache: Record<string, string>,
): Promise<string> {
    if (cache[name]) {
        console.log(`Image cached: ${name}`)
        return cache[name]
    }

    const queries = [`${name} product`, name]

    for (const query of queries) {
        const params = new URLSearchParams({
            action: 'query',
            generator: 'search',
            gsrsearch: `filetype:bitmap ${query}`,
            gsrnamespace: '6',
            gsrlimit: '20',
            prop: 'imageinfo',
            iiprop: 'url|mime',
            iiurlwidth: '600',
            format: 'json',
        })

        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                await delay(2000)

                const response = await fetch(
                    `https://commons.wikimedia.org/w/api.php?${params.toString()}`,
                    {
                        headers: {
                            'User-Agent':
                                'SundrySeed/1.0 (development seed script)',
                        },
                        signal: AbortSignal.timeout(20000),
                    },
                )

                if (response.status === 429) {
                    const retryAfter = Number(
                        response.headers.get('retry-after'),
                    )

                    const waitMs =
                        Number.isFinite(retryAfter) && retryAfter > 0
                            ? retryAfter * 1000
                            : Math.min(10000 * 2 ** attempt, 120000)

                    console.log(
                        `Rate limited: ${name}. Waiting ${Math.ceil(waitMs / 1000)} seconds.`,
                    )

                    await delay(waitMs)
                    continue
                }

                if (!response.ok) {
                    throw new Error(
                        `Wikimedia API returned ${response.status}`,
                    )
                }

                const data = (await response.json()) as {
                    query?: {
                        pages?: Record<string, CommonsPage>
                    }
                }

                const normalize = (value: string) =>
                    value.toLowerCase().replace(/[^a-z0-9]/g, '')

                const target = normalize(name)

                const pages = Object.values(data.query?.pages ?? [])
                    .filter((page) => {
                        const image = page.imageinfo?.[0]

                        return Boolean(
                            (image?.thumburl ?? image?.url) &&
                            image?.mime?.startsWith('image/'),
                        )
                    })
                    .sort((a, b) => {
                        const titleA = normalize(
                            a.title.replace(/^File:/, ''),
                        )
                        const titleB = normalize(
                            b.title.replace(/^File:/, ''),
                        )

                        return (
                            Number(titleB.includes(target)) -
                            Number(titleA.includes(target))
                        )
                    })

                const image = pages[0]?.imageinfo?.[0]
                const imageUrl = image?.thumburl ?? image?.url

                if (imageUrl?.startsWith('https://')) {
                    cache[name] = imageUrl
                    await saveImageCache(cache)

                    console.log(`Image found: ${name} -> ${pages[0].title}`)
                    return imageUrl
                }

                break
            } catch (error) {
                console.error(`Image search failed for ${name}:`, error)

                if (attempt < 4) {
                    await delay(Math.min(5000 * 2 ** attempt, 60000))
                }
            }
        }
    }

    throw new Error(`No real image found for product: ${name}`)
}

async function main() {
    const password = await bcrypt.hash('test1234', 10)
    const imageCache = await loadImageCache()
    const products: Product[] = []

    for (const [name, category, price] of productSeeds
        .slice(0, 30)
        .sort((a, b) => b[2] - a[2])) {
        const imageUrl = imageCache[name]

        if (!imageUrl) {
            throw new Error(`Image URL missing from cache: ${name}`)
        }

        products.push({
            name,
            category,
            price,
            imageUrl,
        })
    }

    for (let i = 1; i <= 30; i++) {
        const username = `user${i}`
        const location = locations[i - 1]
        const shopName = products.map((product) => product.name).join('/')

        const user = await prisma.user.upsert({
            where: { username },
            update: { password },
            create: {
                username,
                password,
                shop: {
                    create: {
                        name: shopName,
                        lat: location.lat,
                        lng: location.lng,
                    },
                },
                wallet: {
                    create: {
                        balance: new Prisma.Decimal(100000),
                        transactions: {
                            create: {
                                type: 'topup',
                                amount: new Prisma.Decimal(100000),
                            },
                        },
                    },
                },
            },
            include: {
                shop: true,
                wallet: true,
            },
        })

        if (!user.shop) {
            throw new Error(`Shop not found for ${username}`)
        }

        await prisma.shop.update({
            where: { id: user.shop.id },
            data: {
                name: shopName,
                lat: location.lat,
                lng: location.lng,
            },
        })

        const existingProducts = await prisma.product.findMany({
            where: { shopId: user.shop.id },
            select: { id: true, name: true },
        })

        const existingByName = new Map(
            existingProducts.map((product) => [product.name, product]),
        )

        for (const product of products) {
            const existing = existingByName.get(product.name)

            if (existing) {
                await prisma.product.update({
                    where: { id: existing.id },
                    data: {
                        category: product.category,
                        price: new Prisma.Decimal(product.price),
                        imageUrl: product.imageUrl,
                    },
                })
            } else {
                await prisma.product.create({
                    data: {
                        ...product,
                        price: new Prisma.Decimal(product.price),
                        stock: Math.floor(Math.random() * 91) + 10,
                        shopId: user.shop.id,
                    },
                })
            }
        }

        const keepNames = products.map((product) => product.name)

        const extraProducts = await prisma.product.findMany({
            where: {
                shopId: user.shop.id,
                name: { notIn: keepNames },
            },
            select: { id: true },
        })

        for (const product of extraProducts) {
            const orderItemCount = await prisma.orderItem.count({
                where: { productId: product.id },
            })

            if (orderItemCount === 0) {
                await prisma.product.delete({
                    where: { id: product.id },
                })
            }
        }

        const finalCount = await prisma.product.count({
            where: { shopId: user.shop.id },
        })

        console.log(`${username} | Shop: ${shopName} | Products: ${finalCount}`)
    }

    const totalProducts = await prisma.product.count()
    console.log(`Seed completed. Total products: ${totalProducts}`)
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
        await pool.end()
    })
