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

type ProductSeed = [name: string, category: string, price: number]

type Product = {
    name: string
    category: string
    price: number
    imageUrl: string
}

type ShopSeed = {
    username: string
    location: { lat: number; lng: number }
    products: ProductSeed[]
}

const EXPECTED_USERS = 10
const EXPECTED_SHOPS = 10
const EXPECTED_PRODUCTS = 300

const SHOP_NAME_MAX_LENGTH = 100
const SHOP_NAME_SEPARATOR = ' / '

/**
 * 10 locations spread across Thailand.
 * Bangkok, Chiang Mai, Chiang Rai, Khon Kaen, Nakhon Ratchasima,
 * Ubon Ratchathani, Pattaya, Surat Thani, Phuket, Hat Yai
 */
const locations = [
    { lat: 13.7563, lng: 100.5018 }, // Bangkok
    { lat: 18.7883, lng: 98.9853 }, // Chiang Mai
    { lat: 19.9105, lng: 99.8406 }, // Chiang Rai
    { lat: 16.4419, lng: 102.835 }, // Khon Kaen
    { lat: 14.9799, lng: 102.0978 }, // Nakhon Ratchasima
    { lat: 15.2287, lng: 104.8564 }, // Ubon Ratchathani
    { lat: 12.9236, lng: 100.8825 }, // Pattaya
    { lat: 9.1382, lng: 99.3215 }, // Surat Thani
    { lat: 7.8804, lng: 98.3923 }, // Phuket
    { lat: 7.0084, lng: 100.4747 }, // Hat Yai
]

/**
 * Shop name = product names of that shop joined with " / ",
 * added in list order, until the name is full (max 100 characters).
 * Whole product names only, nothing is cut in the middle of a name.
 */
function buildShopName(productNames: string[]): string {
    let result = ''

    for (const name of productNames) {
        const next = result ? `${result}${SHOP_NAME_SEPARATOR}${name}` : name
        if (next.length <= SHOP_NAME_MAX_LENGTH) {
            result = next
        }
    }

    return result
}

/* -------------------------------------------------------------------------- */
/*                               Image handling                               */
/* -------------------------------------------------------------------------- */

const USER_AGENT = 'SundrySeed/1.0 (development seed script)'
const STRICT_IMAGES = process.env.STRICT_IMAGES === 'true'
const RETRY_PLACEHOLDERS = process.env.RETRY_PLACEHOLDERS === 'true'
const PEXELS_API_KEY = process.env.PEXELS_API_KEY
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY
const REQUEST_TIMEOUT_MS = 10000
const REACHABLE_TIMEOUT_MS = 8000
const IMAGE_CONCURRENCY = 4

const prismaDir = path.join(process.cwd(), 'prisma')
// The only cache file. To fix a wrong image, edit its "url" here and
// set "source" to "manual": it is never overwritten.
const imageCachePath = path.join(prismaDir, 'product-images.json')
const imagePreviewPath = path.join(prismaDir, 'image-preview.html')

const delay = (ms: number): Promise<void> =>
    new Promise<void>((resolve) => setTimeout(resolve, ms))

type ImageResult = {
    url: string
    source: string
    /** Title / tags the image was matched on (used for the preview page) */
    title: string
}

type ImageCache = Record<string, ImageResult>

type Candidate = {
    url: string
    /** Text describing the image (title, tags, alt text, file name) */
    text: string
}

/** URLs already assigned to a product, so no image is used twice. */
const usedUrls = new Set<string>()

/* ------------------------- Rate limit + concurrency ----------------------- */

const gates = new Map<string, Promise<void>>()

/** Spaces out requests per source, even when called from many workers. */
function throttle(sourceName: string, ms: number): Promise<void> {
    const next = (gates.get(sourceName) ?? Promise.resolve()).then(() =>
        delay(ms),
    )
    gates.set(sourceName, next)
    return next
}

async function mapPool<T>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<void>,
) {
    let index = 0
    await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, async () => {
            while (index < items.length) await fn(items[index++])
        }),
    )
}

/* ----------------------------- Name matching ------------------------------ */

/** Words that say nothing about what the product actually is. */
const GENERIC_WORDS = new Set([
    'professional',
    'industrial',
    'commercial',
    'concert',
    'luxury',
    'premium',
    'enterprise',
    'high',
    'performance',
    'heavy',
    'duty',
    'set',
    'kit',
    'pack',
    'system',
    'machine',
    'large',
    'digital',
    'wireless',
    'portable',
    'size',
    'person',
])

/** Images whose text contains these are never product photos. */
const REJECT_PATTERN =
    /\b(stamp|screenshot|diagram|chart|logo|icon|clipart|vector|cartoon|illustration|drawing|painting|poster|newspaper|manuscript|flower|pansy|wallpaper|coloring|toy|phone|smartphone|mural|church|googly|portrait of|still life)\b/i

/**
 * Extra help for names that are ambiguous on their own.
 * query: search text to try first.
 * anyOf: the image text must also contain at least one of these words.
 */
const IMAGE_HINTS: Record<string, { query?: string; anyOf?: string[] }> = {
    Viola: {
        query: 'viola instrument',
        anyOf: ['instrument', 'violin', 'string', 'orchestra', 'music', 'bow', 'musician'],
    },
    Compass: {
        query: 'magnetic compass navigation',
        anyOf: ['magnetic', 'navigation', 'needle', 'orienteering', 'hiking'],
    },
    Fins: {
        query: 'swim fins diving',
        anyOf: ['dive', 'diving', 'snorkel', 'scuba', 'swim', 'swimming'],
    },
    'Router Tool': {
        query: 'woodworking router power tool',
        anyOf: ['wood', 'woodworking', 'bit', 'power', 'trim', 'tool'],
    },
    Jigsaw: {
        query: 'jigsaw power tool saw',
        anyOf: ['saw', 'power', 'tool', 'blade', 'cordless'],
    },
    'Prism Set': {
        query: 'glass optical prism',
        anyOf: ['glass', 'optic', 'optical', 'light', 'refraction', 'spectrum', 'triangular'],
    },
    'Industrial 3D Printer': {
        query: 'industrial 3D printer machine',
        anyOf: ['3d'],
    },
    'Resin 3D Printer': {
        query: 'resin 3D printer machine',
        anyOf: ['3d'],
    },
    'FDM 3D Printer': {
        query: 'FDM 3D printer machine',
        anyOf: ['3d'],
    },
    '3D Scanner': {
        query: '3D scanner equipment',
        anyOf: ['3d'],
    },
    'Studio Flash Kit': {
        query: 'photography studio flash strobe lighting equipment',
        anyOf: ['flash', 'strobe'],
    },
    'AI Workstation': {
        query: 'AI workstation desktop computer GPU',
        anyOf: ['workstation', 'computer'],
    },
    'OLED Monitor': {
        query: 'OLED display screen computer monitor',
        anyOf: ['oled', 'monitor', 'display', 'screen'],
    },
    'Enterprise SSD': {
        query: 'enterprise solid state drive SSD',
        anyOf: ['ssd', 'solid', 'drive'],
    },
    'Professional Treadmill': {
        query: 'gym running treadmill exercise machine',
        anyOf: ['treadmill', 'running machine'],
    },
    'Olympic Barbell Set': {
        query: 'Olympic barbell weight plates gym equipment',
        anyOf: ['barbell', 'weight'],
    },
    'Sweatband Set': {
        query: 'sports headband wristband sweat band',
        anyOf: ['sweatband', 'headband', 'wristband', 'wrist band'],
    },
    'Generator 10kW': {
        query: 'portable diesel electric generator genset',
        anyOf: ['generator', 'genset'],
    },
    'Silicone Spatula Set': {
        query: 'silicone kitchen spatula utensils',
        anyOf: ['silicone', 'spatula'],
    },
    'UV Curing Machine': {
        query: 'UV curing machine equipment',
        anyOf: ['curing', 'machine'],
    },
    'Hot Air Rework Gun': {
        query: 'hot air soldering station rework tool',
        anyOf: ['solder', 'rework', 'hot air'],
    },
    'Jumper Wire Kit': {
        query: 'electronic jumper wires breadboard kit',
        anyOf: ['jumper', 'wire'],
    },
    'Capacitor Kit': {
        query: 'electronic capacitors assorted components',
        anyOf: ['capacitor', 'capacitors'],
    },
    'Arduino Starter Kit': {
        query: 'Arduino microcontroller development board kit',
        anyOf: ['arduino'],
    },
    'Heat Shrink Tube Set': {
        query: 'heat shrink tubing electrical insulation',
        anyOf: ['shrink', 'tubing', 'tube'],
    },
    'Precision Tweezers': {
        query: 'precision stainless steel electronics tweezers',
        anyOf: ['tweezer'],
    },
    'Eyepiece Set': {
        query: 'telescope eyepiece optical lens',
        anyOf: ['eyepiece', 'ocular'],
    },
    'Cover Glass Pack': {
        query: 'microscope cover glass slides pack',
        anyOf: ['glass', 'cover'],
    },
    'Professional Kayak': {
        query: 'touring kayak sea kayak boat',
        anyOf: ['kayak'],
    },
    'Fire Starter Kit': {
        query: 'outdoor camping fire starter kit',
        anyOf: ['fire', 'starter'],
    },
    'Tent Peg Set': {
        query: 'camping tent stakes pegs set',
        anyOf: ['tent', 'peg', 'stake'],
    },
}

const tokenize = (value: string) => value.toLowerCase().match(/[a-z0-9]+/g) ?? []

/** Very small stemmer so "lens"/"lenses", "pliers"/"plier" compare equal. */
function stem(word: string): string {
    if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`
    if (word.endsWith('s') && word.length > 3 && !word.endsWith('ss')) {
        return word.slice(0, -1)
    }
    return word
}

/** The words that identify the product, e.g. "Cinema Camera" -> cinema, camera */
function getKeywords(name: string): string[] {
    const tokens = tokenize(name).map(stem)
    const meaningful = tokens.filter(
        (token) =>
            token.length > 1 &&
            !GENERIC_WORDS.has(token) &&
            !/\d/.test(token),
    )

    if (meaningful.length > 0) return [...new Set(meaningful)]
    return [...new Set(tokens.filter((token) => token.length > 1))]
}

/**
 * True when the image text really talks about this product:
 * - the last keyword (the "what is it" noun) must be present
 * - 1-2 keywords: all of them; 3+ keywords: all but one
 * - hint words (if any) must be present, reject words must not be
 */

function matchesProduct(text: string, name: string): boolean {
    if (REJECT_PATTERN.test(text)) return false

    const textTokens = new Set(tokenize(text).map(stem))
    const keywords = getKeywords(name)
    const hint = IMAGE_HINTS[name]

    // If product-specific hints exist, use them to validate the image.
    if (hint?.anyOf) {
        return hint.anyOf.some((word) =>
            textTokens.has(stem(word.toLowerCase())),
        )
    }

    const head = keywords[keywords.length - 1]
    if (!textTokens.has(head)) return false

    const matched = keywords.filter((keyword) => textTokens.has(keyword)).length
    const required = keywords.length <= 2 ? keywords.length : keywords.length - 1

    return matched >= required
}

/* ------------------------------ Cache + files ----------------------------- */

async function readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
        return JSON.parse(await readFile(filePath, 'utf8')) as T
    } catch {
        return null
    }
}

async function loadImageCache(validNames: Set<string>): Promise<ImageCache> {
    let cache: ImageCache = {}

    if (process.env.RESET_IMAGE_CACHE === 'true') {
        console.log('RESET_IMAGE_CACHE=true: ignoring cached images')
    } else {
        cache = (await readJsonFile<ImageCache>(imageCachePath)) ?? {}
    }

    // Drop stale names and URLs shared by several products (manual ones stay)
    const urlCounts = new Map<string, number>()
    for (const result of Object.values(cache)) {
        urlCounts.set(result.url, (urlCounts.get(result.url) ?? 0) + 1)
    }

    for (const [name, result] of Object.entries(cache)) {
        const duplicated =
            result.source !== 'manual' && (urlCounts.get(result.url) ?? 0) > 1
        if (!validNames.has(name) || duplicated) {
            delete cache[name]
        }
    }

    for (const result of Object.values(cache)) {
        usedUrls.add(result.url)
    }

    const cachedCount = Object.keys(cache).length
    console.log(`Image cache: ${cachedCount} cached, ${validNames.size - cachedCount} to find`)

    return cache
}

async function saveImageCache(cache: ImageCache) {
    await writeFile(imageCachePath, JSON.stringify(cache, null, 2))
}

/* ------------------------------- HTTP helpers ----------------------------- */

async function fetchJson<T>(
    url: string,
    headers: Record<string, string> = {},
    label = 'request',
): Promise<T | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': USER_AGENT, ...headers },
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            })

            if (response.status === 429) {
                const retryAfter = Number(response.headers.get('retry-after'))
                const waitMs =
                    Number.isFinite(retryAfter) && retryAfter > 0
                        ? Math.min(retryAfter * 1000, 30000)
                        : 10000
                console.log(
                    `Rate limited (${label}). Waiting ${Math.ceil(waitMs / 1000)} seconds.`,
                )
                await delay(waitMs)
                continue
            }

            if (!response.ok) {
                throw new Error(`${label} returned ${response.status}`)
            }

            return (await response.json()) as T
        } catch (error) {
            console.error(
                `${label} failed (attempt ${attempt + 1}):`,
                error instanceof Error ? error.message : error,
            )
            if (attempt < 1) {
                await delay(2000)
            }
        }
    }

    return null
}

/** Confirms the URL is publicly reachable and really serves a photo. */
async function isImageReachable(url: string): Promise<boolean> {
    if (!url.startsWith('https://')) return false

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
            redirect: 'follow',
            signal: AbortSignal.timeout(REACHABLE_TIMEOUT_MS),
        })
        const contentType = response.headers.get('content-type') ?? ''
        const ok =
            response.ok && /^image\/(jpeg|png|webp)/i.test(contentType)
        await response.body?.cancel()
        return ok
    } catch {
        return false
    }
}

/* ------------------------------ Image sources ----------------------------- */

type ImageSource = {
    name: string
    delayMs: number
    enabled: boolean
    /**
     * The service already ranks by relevance and may return no text.
     * Results without any text are accepted for these sources.
     */
    trustEmptyText: boolean
    find: (query: string) => Promise<Candidate[]>
}

const imageSources: ImageSource[] = [
    {
        // Free to use. Needs PEXELS_API_KEY in .env
        name: 'Pexels',
        delayMs: 600,
        enabled: Boolean(PEXELS_API_KEY),
        trustEmptyText: true,
        async find(query) {
            const params = new URLSearchParams({
                query,
                per_page: '10',
                size: 'medium',
            })
            const data = await fetchJson<{
                photos?: {
                    alt?: string
                    src?: { large?: string; medium?: string }
                }[]
            }>(
                `https://api.pexels.com/v1/search?${params.toString()}`,
                { Authorization: PEXELS_API_KEY ?? '' },
                'Pexels',
            )

            return (data?.photos ?? []).flatMap((photo) => {
                const url = photo.src?.large ?? photo.src?.medium
                return url ? [{ url, text: photo.alt ?? '' }] : []
            })
        },
    },
    {
        // Free to use. Needs UNSPLASH_ACCESS_KEY in .env
        name: 'Unsplash',
        delayMs: 1200,
        enabled: Boolean(UNSPLASH_ACCESS_KEY),
        trustEmptyText: true,
        async find(query) {
            const params = new URLSearchParams({
                query,
                per_page: '10',
                client_id: UNSPLASH_ACCESS_KEY ?? '',
            })
            const data = await fetchJson<{
                results?: {
                    alt_description?: string | null
                    description?: string | null
                    tags?: { title?: string }[]
                    urls?: { regular?: string; small?: string }
                }[]
            }>(
                `https://api.unsplash.com/search/photos?${params.toString()}`,
                {},
                'Unsplash',
            )

            return (data?.results ?? []).flatMap((item) => {
                const url = item.urls?.regular ?? item.urls?.small
                if (!url) return []

                const text = [
                    item.alt_description,
                    item.description,
                    ...(item.tags ?? []).map((tag) => tag.title),
                ]
                    .filter(Boolean)
                    .join(' ')
                return [{ url, text }]
            })
        },
    },
    {
        // Free CC-licensed images (commercial use allowed), no API key needed
        name: 'Openverse',
        delayMs: 2000,
        enabled: true,
        trustEmptyText: false,
        async find(query) {
            const params = new URLSearchParams({
                q: query,
                license_type: 'commercial',
                category: 'photograph',
                page_size: '20',
                mature: 'false',
            })
            const data = await fetchJson<{
                results?: {
                    title?: string
                    url?: string
                    thumbnail?: string
                    tags?: { name?: string }[]
                }[]
            }>(
                `https://api.openverse.org/v1/images/?${params.toString()}`,
                {},
                'Openverse',
            )

            return (data?.results ?? []).flatMap((item) => {
                const text = [
                    item.title,
                    ...(item.tags ?? []).map((tag) => tag.name),
                ]
                    .filter(Boolean)
                    .join(' ')

                return [item.url, item.thumbnail]
                    .filter((url): url is string => Boolean(url))
                    .map((url) => ({ url, text }))
            })
        },
    },
    {
        name: 'Wikimedia Commons',
        delayMs: 1000,
        enabled: true,
        trustEmptyText: false,
        async find(query) {
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
            const data = await fetchJson<{
                query?: {
                    pages?: Record<
                        string,
                        {
                            title: string
                            imageinfo?: {
                                thumburl?: string
                                url?: string
                                mime?: string
                            }[]
                        }
                    >
                }
            }>(
                `https://commons.wikimedia.org/w/api.php?${params.toString()}`,
                {},
                'Wikimedia',
            )

            // JPEG only: skips charts, screenshots, diagrams and scans
            return Object.values(data?.query?.pages ?? {}).flatMap((page) => {
                const image = page.imageinfo?.[0]
                const url = image?.thumburl ?? image?.url
                if (!url || image?.mime !== 'image/jpeg') return []

                return [
                    {
                        url,
                        text: page.title
                            .replace(/^File:/, '')
                            .replace(/\.[a-z0-9]+$/i, '')
                            .replace(/[_-]/g, ' '),
                    },
                ]
            })
        },
    },
]

const fallbackProducts: string[] = []

function placeholderImageUrl(name: string) {
    const params = new URLSearchParams({
        text: name,
        font: 'roboto',
    })
    return `https://placehold.co/600x600/png?${params.toString()}`
}

/** Search queries to try, from most specific to broadest. */
function buildQueries(name: string, category: string): string[] {
    const words = name.split(' ')
    const shortName = words.length > 2 ? words.slice(-2).join(' ') : ''

    return [
        ...new Set(
            [
                IMAGE_HINTS[name]?.query ?? '',
                name,
                `${name} ${category}`,
                shortName,
            ].filter((query) => query.length > 0),
        ),
    ]
}

async function getProductImage(
    name: string,
    category: string,
    cache: ImageCache,
): Promise<ImageResult> {
    const cached = cache[name]
    if (cached && (cached.source !== 'placeholder' || !RETRY_PLACEHOLDERS)) {
        if (cached.source === 'placeholder') fallbackProducts.push(name)
        return cached
    }

    const remember = (result: ImageResult) => {
        cache[name] = result
        usedUrls.add(result.url)
        console.log(`Image found [${result.source}]: ${name}`)
        return result
    }

    const queries = buildQueries(name, category)

    for (const source of imageSources) {
        if (!source.enabled) continue

        for (const query of queries) {
            await throttle(source.name, source.delayMs)

            const candidates = await source.find(query)
            const matching = candidates.filter((candidate) => {
                if (usedUrls.has(candidate.url)) return false
                if (!candidate.text.trim()) return source.trustEmptyText
                return matchesProduct(candidate.text, name)
            })

            for (const candidate of matching.slice(0, 5)) {
                if (!(await isImageReachable(candidate.url))) continue
                // another worker may have taken it while we were checking
                if (usedUrls.has(candidate.url)) continue

                return remember({
                    url: candidate.url,
                    source: source.name,
                    title: candidate.text || '(no text)',
                })
            }
        }
    }

    if (STRICT_IMAGES) {
        throw new Error(`No matching image found for product: ${name}`)
    }

    console.warn(`No matching image found, using placeholder: ${name}`)
    fallbackProducts.push(name)

    // Cached too, so the next run does not search again
    cache[name] = {
        url: placeholderImageUrl(name),
        source: 'placeholder',
        title: '',
    }
    return cache[name]
}

/* -------------------------------------------------------------------------- */
/*                                  Seed data                                 */
/* -------------------------------------------------------------------------- */

/**
 * 10 shops (user1 - user10) × 30 products = 300 unique products.
 * Each product name is unique across all shops.
 * Shop name is built from the product names of that shop (see buildShopName).
 */
const shopProductSeeds: ShopSeed[] = [
    {
        username: 'user1',
        location: locations[0],
        products: [
            ['Grand Piano', 'Musical Instruments', 120000],
            ['Concert Harp', 'Musical Instruments', 95000],
            ['Cello', 'Musical Instruments', 72000],
            ['Double Bass', 'Musical Instruments', 68000],
            ['Concert Tuba', 'Musical Instruments', 56000],
            ['Professional Saxophone', 'Musical Instruments', 48000],
            ['Digital Stage Piano', 'Musical Instruments', 45000],
            ['Concert Trumpet', 'Musical Instruments', 42000],
            ['Professional Drum Kit', 'Musical Instruments', 39000],
            ['Electric Guitar', 'Musical Instruments', 35000],
            ['Bass Guitar', 'Musical Instruments', 32000],
            ['Viola', 'Musical Instruments', 28000],
            ['Acoustic Guitar', 'Musical Instruments', 24000],
            ['Digital Keyboard', 'Musical Instruments', 21000],
            ['French Horn', 'Musical Instruments', 19500],
            ['Clarinet', 'Musical Instruments', 16500],
            ['Flute', 'Musical Instruments', 14500],
            ['Oboe', 'Musical Instruments', 13500],
            ['Bassoon', 'Musical Instruments', 12500],
            ['Mandolin', 'Musical Instruments', 9800],
            ['Ukulele', 'Musical Instruments', 6500],
            ['Banjo', 'Musical Instruments', 6200],
            ['Accordion', 'Musical Instruments', 5900],
            ['Harmonica', 'Musical Instruments', 2800],
            ['Tambourine', 'Musical Instruments', 1200],
            ['Metronome', 'Musical Instruments', 950],
            ['Guitar Capo', 'Musical Instruments', 650],
            ['Violin Rosin', 'Musical Instruments', 450],
            ['Guitar Pick Set', 'Musical Instruments', 250],
            ['Sheet Music Folder', 'Musical Instruments', 180],
        ],
    },
    {
        username: 'user2',
        location: locations[1],
        products: [
            ['Cinema Camera', 'Photography', 180000],
            ['Medium Format Camera', 'Photography', 145000],
            ['Telephoto Lens', 'Photography', 98000],
            ['Cinema Lens', 'Photography', 92000],
            ['Full Frame Camera', 'Photography', 85000],
            ['Professional Camcorder', 'Photography', 78000],
            ['Wide Angle Lens', 'Photography', 54000],
            ['Portrait Lens', 'Photography', 48000],
            ['Macro Lens', 'Photography', 39000],
            ['Studio Flash Kit', 'Photography', 32000],
            ['Drone Camera', 'Photography', 29000],
            ['Action Camera', 'Photography', 22000],
            ['Instant Camera', 'Photography', 9500],
            ['Mirrorless Camera', 'Photography', 72000],
            ['DSLR Camera', 'Photography', 65000],
            ['Camera Gimbal', 'Photography', 18500],
            ['Carbon Fiber Tripod', 'Photography', 16000],
            ['Camera Slider', 'Photography', 14500],
            ['Wireless Microphone Kit', 'Photography', 12500],
            ['Camera Monitor', 'Photography', 9800],
            ['Camera Cage', 'Photography', 6500],
            ['Camera Battery Grip', 'Photography', 5200],
            ['Camera Flash', 'Photography', 4800],
            ['Camera Backpack', 'Photography', 3900],
            ['Camera Shoulder Bag', 'Photography', 3200],
            ['Memory Card Reader', 'Photography', 1800],
            ['SD Memory Card', 'Photography', 1500],
            ['Lens Cleaning Kit', 'Photography', 950],
            ['Camera Wrist Strap', 'Photography', 450],
            ['Lens Cap', 'Photography', 180],
        ],
    },
    {
        username: 'user3',
        location: locations[2],
        products: [
            ['Enterprise Server Rack', 'Computer', 250000],
            ['AI Workstation', 'Computer', 220000],
            ['High Performance Server', 'Computer', 195000],
            ['Workstation PC', 'Computer', 160000],
            ['Gaming Desktop', 'Computer', 135000],
            ['Professional Laptop', 'Computer', 110000],
            ['MacBook Laptop', 'Computer', 95000],
            ['Business Laptop', 'Computer', 72000],
            ['OLED Monitor', 'Computer', 58000],
            ['4K Reference Monitor', 'Computer', 52000],
            ['Graphics Card', 'Computer', 48000],
            ['Processor CPU', 'Computer', 39000],
            ['Motherboard', 'Computer', 28000],
            ['DDR5 Memory Kit', 'Computer', 22000],
            ['NAS Storage System', 'Computer', 35000],
            ['Enterprise SSD', 'Computer', 18000],
            ['External SSD', 'Computer', 9500],
            ['Internal Hard Drive', 'Computer', 6500],
            ['Laser Printer', 'Computer', 14500],
            ['Large Format Printer', 'Computer', 42000],
            ['Document Scanner', 'Computer', 8500],
            ['4K Projector', 'Computer', 32000],
            ['Docking Station', 'Computer Accessories', 7500],
            ['Mechanical Keyboard', 'Computer Accessories', 6500],
            ['Ergonomic Mouse', 'Computer Accessories', 3200],
            ['Webcam 4K', 'Computer Accessories', 4800],
            ['Laptop Cooling Pad', 'Computer Accessories', 1800],
            ['USB-C Hub', 'Computer Accessories', 2200],
            ['Laptop Sleeve', 'Computer Accessories', 950],
            ['USB Flash Drive', 'Computer Accessories', 450],
        ],
    },
    {
        username: 'user4',
        location: locations[3],
        products: [
            ['Luxury Electric SUV', 'Vehicles', 2400000],
            ['Electric Motorcycle', 'Vehicles', 185000],
            ['Mountain Bike', 'Sports', 48000],
            ['Road Racing Bicycle', 'Sports', 95000],
            ['Electric Bicycle', 'Sports', 72000],
            ['Carbon Road Bike Frame', 'Sports', 68000],
            ['Full Suspension Bike', 'Sports', 65000],
            ['Professional Treadmill', 'Sports', 59000],
            ['Elliptical Trainer', 'Sports', 42000],
            ['Exercise Bike', 'Sports', 28000],
            ['Rowing Machine', 'Sports', 32000],
            ['Adjustable Weight Bench', 'Sports', 12500],
            ['Olympic Barbell Set', 'Sports', 18000],
            ['Power Rack', 'Sports', 22000],
            ['Dumbbell Set', 'Sports', 9800],
            ['Kettlebell Set', 'Sports', 5200],
            ['Tennis Ball Machine', 'Sports', 39000],
            ['Tennis Racket', 'Sports', 8500],
            ['Badminton Racket', 'Sports', 6500],
            ['Golf Club Set', 'Sports', 28000],
            ['Golf Bag', 'Sports', 6500],
            ['Basketball Hoop', 'Sports', 14500],
            ['Soccer Goal', 'Sports', 12000],
            ['Boxing Punching Bag', 'Sports', 7500],
            ['Yoga Mat', 'Sports', 850],
            ['Resistance Bands', 'Sports', 650],
            ['Jump Rope', 'Sports', 350],
            ['Sports Water Bottle', 'Sports', 250],
            ['Whistle', 'Sports', 180],
            ['Sweatband Set', 'Sports', 150],
        ],
    },
    {
        username: 'user5',
        location: locations[4],
        products: [
            ['Industrial CNC Machine', 'Tools', 950000],
            ['Professional Excavator', 'Tools', 850000],
            ['Forklift Truck', 'Tools', 650000],
            ['Industrial Air Compressor', 'Tools', 180000],
            ['Welding Machine', 'Tools', 85000],
            ['Generator 10kW', 'Tools', 78000],
            ['Hydraulic Press', 'Tools', 72000],
            ['Metal Lathe', 'Tools', 65000],
            ['Plasma Cutter', 'Tools', 59000],
            ['Professional Drill Press', 'Tools', 48000],
            ['Table Saw', 'Tools', 39000],
            ['Band Saw', 'Tools', 32000],
            ['MIG Welder', 'Tools', 28000],
            ['Cordless Tool Set', 'Tools', 22000],
            ['Impact Wrench', 'Tools', 12500],
            ['Rotary Hammer', 'Tools', 9800],
            ['Angle Grinder', 'Tools', 6500],
            ['Circular Saw', 'Tools', 5900],
            ['Jigsaw', 'Tools', 4800],
            ['Orbital Sander', 'Tools', 3900],
            ['Router Tool', 'Tools', 5200],
            ['Air Nail Gun', 'Tools', 4500],
            ['Torque Wrench', 'Tools', 2800],
            ['Socket Set', 'Tools', 2200],
            ['Adjustable Wrench', 'Tools', 850],
            ['Screwdriver Set', 'Tools', 650],
            ['Pliers Set', 'Tools', 550],
            ['Claw Hammer', 'Tools', 450],
            ['Measuring Tape', 'Tools', 250],
            ['Utility Knife', 'Tools', 180],
        ],
    },
    {
        username: 'user6',
        location: locations[5],
        products: [
            ['Luxury Sofa Set', 'Furniture', 320000],
            ['Solid Wood Dining Table', 'Furniture', 185000],
            ['King Size Bed Frame', 'Furniture', 95000],
            ['Walk In Wardrobe', 'Furniture', 88000],
            ['Leather Recliner Chair', 'Furniture', 72000],
            ['Modular Kitchen Cabinet', 'Furniture', 68000],
            ['Executive Office Desk', 'Furniture', 59000],
            ['Bookshelf Wall Unit', 'Furniture', 48000],
            ['Sectional Sofa', 'Furniture', 85000],
            ['Dining Chair Set', 'Furniture', 32000],
            ['Standing Desk', 'Furniture', 28000],
            ['Office Chair Ergonomic', 'Furniture', 22000],
            ['Mattress King Size', 'Home & Living', 39000],
            ['Bedroom Dresser', 'Furniture', 18000],
            ['Coffee Table', 'Furniture', 14500],
            ['TV Cabinet', 'Furniture', 12500],
            ['Sideboard Cabinet', 'Furniture', 9800],
            ['Nightstand', 'Furniture', 6500],
            ['Bar Stool', 'Furniture', 4800],
            ['Shoe Cabinet', 'Furniture', 3900],
            ['Floor Lamp', 'Home & Living', 5200],
            ['Area Rug', 'Home & Living', 8500],
            ['Blackout Curtains', 'Home & Living', 3200],
            ['Full Length Mirror', 'Home & Living', 2800],
            ['Decorative Vase', 'Home & Living', 1500],
            ['Wall Clock', 'Home & Living', 950],
            ['Throw Blanket', 'Home & Living', 850],
            ['Cushion Pillow', 'Home & Living', 650],
            ['Laundry Basket', 'Home & Living', 450],
            ['Picture Frame', 'Home & Living', 250],
        ],
    },
    {
        username: 'user7',
        location: locations[6],
        products: [
            ['Professional Espresso Machine', 'Kitchen', 185000],
            ['Commercial Refrigerator', 'Kitchen', 165000],
            ['Commercial Dishwasher', 'Kitchen', 125000],
            ['Induction Cooking Range', 'Kitchen', 98000],
            ['Commercial Oven', 'Kitchen', 85000],
            ['Ice Maker Machine', 'Kitchen', 72000],
            ['Commercial Blender', 'Kitchen', 48000],
            ['Stand Mixer', 'Kitchen', 32000],
            ['Built In Microwave', 'Kitchen', 28000],
            ['Wine Cooler', 'Kitchen', 22000],
            ['Coffee Grinder', 'Kitchen', 18500],
            ['Air Fryer Oven', 'Kitchen', 12500],
            ['Food Processor', 'Kitchen', 9800],
            ['Vacuum Sealer', 'Kitchen', 8500],
            ['Rice Cooker', 'Kitchen', 6500],
            ['Electric Kettle', 'Kitchen', 3200],
            ['Toaster Oven', 'Kitchen', 2800],
            ['Slow Cooker', 'Kitchen', 2200],
            ['Blender Bottle', 'Kitchen', 650],
            ['Frying Pan Set', 'Kitchen', 2800],
            ['Chef Knife Set', 'Kitchen', 8500],
            ['Cutting Board Set', 'Kitchen', 1200],
            ['Digital Kitchen Scale', 'Kitchen', 950],
            ['Food Thermometer', 'Kitchen', 850],
            ['Reusable Food Container', 'Kitchen', 650],
            ['Measuring Cup Set', 'Kitchen', 450],
            ['Silicone Spatula Set', 'Kitchen', 350],
            ['Peeler', 'Kitchen', 250],
            ['Can Opener', 'Kitchen', 180],
            ['Dish Brush', 'Kitchen', 120],
        ],
    },
    {
        username: 'user8',
        location: locations[7],
        products: [
            ['Industrial 3D Printer', 'Manufacturing', 480000],
            ['Laser Engraving Machine', 'Manufacturing', 320000],
            ['CNC Router', 'Manufacturing', 280000],
            ['Resin 3D Printer', 'Manufacturing', 125000],
            ['FDM 3D Printer', 'Manufacturing', 85000],
            ['3D Scanner', 'Manufacturing', 72000],
            ['Vacuum Forming Machine', 'Manufacturing', 68000],
            ['Injection Molding Machine', 'Manufacturing', 650000],
            ['UV Curing Machine', 'Manufacturing', 59000],
            ['Soldering Rework Station', 'Electronics', 22000],
            ['Oscilloscope', 'Electronics', 48000],
            ['Bench Power Supply', 'Electronics', 12500],
            ['Digital Multimeter', 'Electronics', 6500],
            ['Logic Analyzer', 'Electronics', 18500],
            ['Thermal Camera', 'Electronics', 39000],
            ['Spectrum Analyzer', 'Electronics', 98000],
            ['Function Generator', 'Electronics', 28000],
            ['Hot Air Rework Gun', 'Electronics', 4500],
            ['Soldering Iron', 'Electronics', 1800],
            ['Breadboard Kit', 'Electronics', 650],
            ['Jumper Wire Kit', 'Electronics', 450],
            ['Resistor Kit', 'Electronics', 350],
            ['Capacitor Kit', 'Electronics', 450],
            ['Arduino Starter Kit', 'Electronics', 2200],
            ['Raspberry Pi Kit', 'Electronics', 5200],
            ['ESP32 Development Board', 'Electronics', 950],
            ['Solder Wire', 'Electronics', 350],
            ['Heat Shrink Tube Set', 'Electronics', 250],
            ['Wire Stripper', 'Tools', 850],
            ['Precision Tweezers', 'Tools', 250],
        ],
    },
    {
        username: 'user9',
        location: locations[8],
        products: [
            ['Professional Telescope', 'Optics', 185000],
            ['Astronomy Mount', 'Optics', 98000],
            ['Binocular Night Vision', 'Optics', 85000],
            ['Thermal Imaging Monocular', 'Optics', 72000],
            ['Spotting Scope', 'Optics', 48000],
            ['Astronomy Camera', 'Optics', 39000],
            ['Laser Rangefinder', 'Optics', 22000],
            ['Night Vision Goggles', 'Optics', 28000],
            ['Field Microscope', 'Optics', 18500],
            ['Laboratory Microscope', 'Optics', 65000],
            ['Digital Magnifier', 'Optics', 6500],
            ['Prism Set', 'Optics', 5200],
            ['Optical Bench', 'Optics', 32000],
            ['Spectrometer', 'Optics', 125000],
            ['Refractor Telescope', 'Optics', 39000],
            ['Reflector Telescope', 'Optics', 48000],
            ['Eyepiece Set', 'Optics', 9800],
            ['Barlow Lens', 'Optics', 2800],
            ['Telescope Filter', 'Optics', 1800],
            ['Microscope Slides', 'Optics', 650],
            ['Cover Glass Pack', 'Optics', 450],
            ['Lab Safety Goggles', 'Laboratory', 350],
            ['Lab Coat', 'Laboratory', 1200],
            ['Pipette Set', 'Laboratory', 8500],
            ['Analytical Balance', 'Laboratory', 59000],
            ['Centrifuge Machine', 'Laboratory', 85000],
            ['Incubator Machine', 'Laboratory', 72000],
            ['Autoclave Machine', 'Laboratory', 98000],
            ['Laboratory Refrigerator', 'Laboratory', 125000],
            ['Test Tube Rack', 'Laboratory', 450],
        ],
    },
    {
        username: 'user10',
        location: locations[9],
        products: [
            ['Professional Kayak', 'Outdoor', 85000],
            ['Aluminum Fishing Boat', 'Outdoor', 320000],
            ['Inflatable Paddle Board', 'Outdoor', 28000],
            ['Mountain Tent 8 Person', 'Outdoor', 18500],
            ['Camping Trailer', 'Outdoor', 480000],
            ['Expedition Backpack', 'Outdoor', 8500],
            ['Down Sleeping Bag', 'Outdoor', 9800],
            ['Portable Power Station', 'Outdoor', 45000],
            ['Solar Generator', 'Outdoor', 68000],
            ['Camping Refrigerator', 'Outdoor', 32000],
            ['Portable Water Filter', 'Outdoor', 2800],
            ['Camping Stove', 'Outdoor', 2200],
            ['Headlamp', 'Outdoor', 950],
            ['Trekking Poles', 'Outdoor', 1800],
            ['Climbing Harness', 'Outdoor', 3200],
            ['Climbing Rope', 'Outdoor', 4500],
            ['Car Roof Tent', 'Outdoor', 98000],
            ['Four Season Tent', 'Outdoor', 39000],
            ['Portable Shower', 'Outdoor', 6500],
            ['Waterproof Duffel Bag', 'Outdoor', 2800],
            ['Camping Chair', 'Outdoor', 1200],
            ['Folding Table', 'Outdoor', 1800],
            ['Cooler Box', 'Outdoor', 2200],
            ['Camping Lantern', 'Outdoor', 850],
            ['Enamel Camping Mug', 'Outdoor', 450],
            ['Fire Starter Kit', 'Outdoor', 650],
            ['Paracord Rope', 'Outdoor', 250],
            ['Tent Peg Set', 'Outdoor', 180],
            ['Dry Bag', 'Outdoor', 650],
            ['Compass', 'Outdoor', 850],
        ],
    },
]

function validateShopProductSeeds() {
    if (shopProductSeeds.length !== EXPECTED_SHOPS) {
        throw new Error(
            `Expected ${EXPECTED_SHOPS} shops, got ${shopProductSeeds.length}`,
        )
    }

    if (locations.length < shopProductSeeds.length) {
        throw new Error('Not enough locations for all shops')
    }

    // user1 - user10, each exactly once
    const usernames = shopProductSeeds.map((shop) => shop.username)
    for (let i = 1; i <= EXPECTED_USERS; i++) {
        if (!usernames.includes(`user${i}`)) {
            throw new Error(`Missing user${i}`)
        }
    }
    if (new Set(usernames).size !== usernames.length) {
        throw new Error('Duplicate usernames found')
    }

    // 300 unique product names
    const names = shopProductSeeds.flatMap((shop) =>
        shop.products.map(([name]) => name),
    )
    const duplicateNames = names.filter(
        (name, index) => names.indexOf(name) !== index,
    )

    if (duplicateNames.length > 0) {
        throw new Error(
            `Duplicate product names found: ${[...new Set(duplicateNames)].join(', ')}`,
        )
    }

    if (names.length !== EXPECTED_PRODUCTS) {
        throw new Error(
            `Expected ${EXPECTED_PRODUCTS} products, got ${names.length}`,
        )
    }

    // Shop names are built from the shop's own products, must be unique
    const shopNames = shopProductSeeds.map((shop) =>
        buildShopName(shop.products.map(([name]) => name)),
    )
    if (new Set(shopNames).size !== shopNames.length) {
        throw new Error('Duplicate shop names found')
    }

    for (const shop of shopProductSeeds) {
        if (shop.products.length !== 30) {
            throw new Error(
                `${shop.username} must have 30 products, got ${shop.products.length}`,
            )
        }

        const shopName = buildShopName(shop.products.map(([name]) => name))
        if (!shopName || shopName.length > SHOP_NAME_MAX_LENGTH) {
            throw new Error(`${shop.username} has an invalid shop name`)
        }

        for (const [name, category, price] of shop.products) {
            if (name.length > 200) {
                throw new Error(`Product name exceeds 200 characters: ${name}`)
            }
            if (category.length > 100) {
                throw new Error(`Category exceeds 100 characters: ${category}`)
            }
            if (
                !Number.isFinite(price) ||
                price < 0 ||
                price > 99999999.99
            ) {
                throw new Error(`Invalid price for ${name}: ${price}`)
            }
        }
    }
}

/* -------------------------------------------------------------------------- */
/*                               Preview page                                 */
/* -------------------------------------------------------------------------- */

type PreviewRow = {
    shop: string
    name: string
    image: ImageResult
}

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')

/** Writes a page showing every product next to its image, to check by eye. */
async function writeImagePreview(rows: PreviewRow[]) {
    const cards = rows
        .map((row) => {
            const isPlaceholder = row.image.source === 'placeholder'
            return `
        <div class="card${isPlaceholder ? ' missing' : ''}">
            <img src="${escapeHtml(row.image.url)}" alt="${escapeHtml(row.name)}" loading="lazy" referrerpolicy="no-referrer" />
            <div class="name">${escapeHtml(row.name)}</div>
            <div class="meta">${escapeHtml(row.shop)}</div>
            <div class="meta">${isPlaceholder ? '<b class="tag">PLACEHOLDER</b>' : escapeHtml(row.image.source)}</div>
            <div class="meta small">${escapeHtml(row.image.title)}</div>
        </div>`
        })
        .join('\n')

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Product image preview</title>
<style>
    body { font-family: system-ui, sans-serif; margin: 16px; background: #f5f5f5; }
    h1 { font-size: 18px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
    .card { background: #fff; border-radius: 8px; padding: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
    .card.missing { outline: 2px solid #e5484d; }
    img { width: 100%; height: 150px; object-fit: cover; border-radius: 6px; background: #eee; }
    .name { font-weight: 600; font-size: 13px; margin-top: 6px; }
    .meta { font-size: 11px; color: #666; margin-top: 2px; word-break: break-word; }
    .small { color: #999; }
    .tag { color: #e5484d; }
</style>
</head>
<body>
<h1>Product image preview (${rows.length} products, ${rows.filter((row) => row.image.source === 'placeholder').length} placeholders)</h1>
<div class="grid">
${cards}
</div>
</body>
</html>`

    await writeFile(imagePreviewPath, html)
    console.log(`Image preview written: ${imagePreviewPath}`)
}

/* -------------------------------------------------------------------------- */
/*                                    Main                                    */
/* -------------------------------------------------------------------------- */

async function main() {
    validateShopProductSeeds()

    const password = await bcrypt.hash('test1234', 10)

    const validNames = new Set(
        shopProductSeeds.flatMap((shop) =>
            shop.products.map(([name]) => name),
        ),
    )
    const imageCache = await loadImageCache(validNames)

    console.log(
        `Image sources: ${imageSources
            .filter((source) => source.enabled)
            .map((source) => source.name)
            .join(', ')}`,
    )

    // Phase 1: find all images (in parallel), no database work yet
    const allProducts = shopProductSeeds.flatMap((shop) => shop.products)
    try {
        await mapPool(
            allProducts,
            IMAGE_CONCURRENCY,
            async ([name, category]) => {
                await getProductImage(name, category, imageCache)
            },
        )
    } finally {
        // saved once (also when something fails half way)
        await saveImageCache(imageCache)
    }

    // Phase 2: write the database
    const previewRows: PreviewRow[] = []

    for (const shopSeed of shopProductSeeds) {
        const { username, location } = shopSeed
        const shopName = buildShopName(
            shopSeed.products.map(([name]) => name),
        )

        const products: Product[] = shopSeed.products.map(
            ([name, category, price]) => {
                const image = imageCache[name]
                previewRows.push({ shop: shopName, name, image })
                return { name, category, price, imageUrl: image.url }
            },
        )

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
        const shopId = user.shop.id

        await prisma.shop.update({
            where: { id: shopId },
            data: {
                name: shopName,
                lat: location.lat,
                lng: location.lng,
            },
        })

        const existingProducts = await prisma.product.findMany({
            where: { shopId },
            select: { id: true, name: true },
        })
        const existingByName = new Map(
            existingProducts.map((product) => [product.name, product]),
        )

        const toCreate = products.filter((p) => !existingByName.has(p.name))
        const toUpdate = products.filter((p) => existingByName.has(p.name))

        if (toCreate.length > 0) {
            await prisma.product.createMany({
                data: toCreate.map((p) => ({
                    ...p,
                    price: new Prisma.Decimal(p.price),
                    stock: Math.floor(Math.random() * 91) + 10,
                    shopId,
                })),
            })
        }

        await Promise.all(
            toUpdate.map((p) =>
                prisma.product.update({
                    where: { id: existingByName.get(p.name)!.id },
                    data: {
                        category: p.category,
                        price: new Prisma.Decimal(p.price),
                        imageUrl: p.imageUrl,
                    },
                }),
            ),
        )

        // Remove products that are no longer in the seed (and never ordered)
        const extraProducts = await prisma.product.findMany({
            where: {
                shopId,
                name: { notIn: products.map((p) => p.name) },
            },
            select: { id: true },
        })

        if (extraProducts.length > 0) {
            const ordered = await prisma.orderItem.findMany({
                where: { productId: { in: extraProducts.map((p) => p.id) } },
                select: { productId: true },
                distinct: ['productId'],
            })
            const orderedIds = new Set(ordered.map((o) => o.productId))

            await prisma.product.deleteMany({
                where: {
                    id: {
                        in: extraProducts
                            .map((p) => p.id)
                            .filter((id) => !orderedIds.has(id)),
                    },
                },
            })
        }

        console.log(
            `${username} | Shop: ${shopName} | Products: ${products.length}`,
        )
    }

    const [totalUsers, totalShops, totalProducts] = await Promise.all([
        prisma.user.count(),
        prisma.shop.count(),
        prisma.product.count(),
    ])

    console.log(
        `Seed completed. Users: ${totalUsers}, Shops: ${totalShops}, Products: ${totalProducts}`,
    )

    if (
        totalUsers !== EXPECTED_USERS ||
        totalShops !== EXPECTED_SHOPS ||
        totalProducts !== EXPECTED_PRODUCTS
    ) {
        console.warn(
            `Expected ${EXPECTED_USERS} users / ${EXPECTED_SHOPS} shops / ${EXPECTED_PRODUCTS} products. ` +
            'The database has extra old data: run "npm run db:reset" to start clean.',
        )
    }

    await writeImagePreview(previewRows)

    if (fallbackProducts.length > 0) {
        console.warn(
            `\n${fallbackProducts.length} products use placeholder images. ` +
            'Edit prisma/product-images.json (set "source": "manual") ' +
            'or run with RETRY_PLACEHOLDERS=true:',
        )
        console.warn(fallbackProducts.join(', '))
    }
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