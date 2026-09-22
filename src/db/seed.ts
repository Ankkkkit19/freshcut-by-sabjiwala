import "dotenv/config";

import { asc, eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import {
  addresses,
  auditLogs,
  categories,
  counters,
  coupons,
  deliveryZones,
  notifications,
  offers,
  orderItems,
  orders,
  productVariants,
  products,
  recipeIngredients,
  recipes,
  settings,
  stockItems,
  users,
  whatsappIdentities,
} from "@/db/schema";
import { adjustStock } from "@/server/inventory";

const IMG = {
  hero: "/images/hero-basket.jpg",
  potato: "/images/potato.jpg",
  cauliflower: "/images/cauliflower.jpg",
  cucumber: "/images/cucumber.jpg",
  paneer: "/images/paneer.jpg",
  mango: "/images/mango.jpg",
  orange: "/images/orange.jpg",
  capsicum: "/images/capsicum.jpg",
  banana: "/images/banana.jpg",
  readyToCook: "/images/ready-to-cook.jpg",
  tomato: "https://images.pexels.com/photos/4247701/pexels-photo-4247701.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  onion: "https://images.pexels.com/photos/38909864/pexels-photo-38909864.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  carrot: "https://images.pexels.com/photos/38802742/pexels-photo-38802742.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  broccoli: "https://images.pexels.com/photos/13133609/pexels-photo-13133609.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  spinach: "https://images.pexels.com/photos/6083893/pexels-photo-6083893.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  greens: "https://images.pexels.com/photos/7368018/pexels-photo-7368018.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  mixed: "https://images.pexels.com/photos/39105767/pexels-photo-39105767.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  salad: "https://images.pexels.com/photos/5713738/pexels-photo-5713738.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  greekSalad: "https://images.pexels.com/photos/8697517/pexels-photo-8697517.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  mealPrep: "https://images.pexels.com/photos/9124025/pexels-photo-9124025.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  fruits: "https://images.pexels.com/photos/15537200/pexels-photo-15537200.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  apples: "https://images.pexels.com/photos/5421412/pexels-photo-5421412.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  grapes: "https://images.pexels.com/photos/6083707/pexels-photo-6083707.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  market: "https://images.pexels.com/photos/12298301/pexels-photo-12298301.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  bread: "https://images.pexels.com/photos/16005653/pexels-photo-16005653.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
};

type SeedVariant = {
  label: string;
  unit: "KG" | "G" | "PIECE" | "PACKET" | "BOX" | "BUNCH" | "LITRE";
  price: number;
  mrp?: number;
  stock: number;
  weightInGrams?: number;
  yieldRatio?: number;
  isDefault?: boolean;
};

type SeedProduct = {
  name: string;
  slug: string;
  category: string;
  type:
    | "VEGETABLE"
    | "FRUIT"
    | "LEAFY_GREENS"
    | "READY_TO_COOK"
    | "DAIRY"
    | "SALAD"
    | "GROCERY";
  short: string;
  description: string;
  images: string[];
  tags: string[];
  aliases: string[];
  preparation?: string[];
  featured?: boolean;
  variants: SeedVariant[];
};

const CATEGORY_SEED = [
  { name: "Vegetables", slug: "vegetables", description: "Farm fresh everyday vegetables, cut-to-order.", imageUrl: IMG.mixed, sortOrder: 1 },
  { name: "Fruits", slug: "fruits", description: "Sweet, seasonal and ripe fruits.", imageUrl: IMG.fruits, sortOrder: 2 },
  { name: "Leafy Greens", slug: "leafy-greens", description: "Washed bunches of palak, dhaniya and more.", imageUrl: IMG.spinach, sortOrder: 3 },
  { name: "Ready to Cook", slug: "ready-to-cook", description: "Chopped, peeled and portioned in our cut kitchen.", imageUrl: IMG.readyToCook, sortOrder: 4 },
  { name: "Dairy", slug: "dairy", description: "Fresh paneer, curd and dairy essentials.", imageUrl: IMG.paneer, sortOrder: 5 },
  { name: "Salad", slug: "salad", description: "Salad mixes and sprout bowls ready to toss.", imageUrl: IMG.salad, sortOrder: 6 },
];

const PRODUCT_SEED: SeedProduct[] = [
  {
    name: "Potato", slug: "potato", category: "vegetables", type: "VEGETABLE", featured: true,
    short: "Fresh, firm Aloo ideal for sabzi, fries and parathas",
    description: "Hand-picked potatoes from Ooty farms, sorted for uniform size. Ideal for dum aloo, sabzi, fries and curries.",
    images: [IMG.potato, IMG.mixed], tags: ["everyday", "staple", "root"],
    aliases: ["aloo", "aalu", "alu", "potatos"],
    variants: [
      { label: "500 g", unit: "G", price: 25, mrp: 30, stock: 240, weightInGrams: 500 },
      { label: "1 kg", unit: "KG", price: 45, mrp: 55, stock: 320, weightInGrams: 1000, isDefault: true },
      { label: "2 kg", unit: "KG", price: 85, mrp: 100, stock: 180, weightInGrams: 2000 },
      { label: "5 kg", unit: "KG", price: 190, mrp: 230, stock: 60, weightInGrams: 5000 },
    ],
  },
  {
    name: "Tomato", slug: "tomato", category: "vegetables", type: "VEGETABLE", featured: true,
    short: "Juicy, tangy tomatoes for gravies and salads",
    description: "Nashik tomatoes with deep red colour and firm skin. Perfect for gravies, chutney and salads.",
    images: [IMG.tomato, IMG.mixed], tags: ["everyday", "gravy"], aliases: ["tamatar", "tamaatar", "tomato"],
    variants: [
      { label: "500 g", unit: "G", price: 27, mrp: 32, stock: 200, weightInGrams: 500 },
      { label: "1 kg", unit: "KG", price: 48, mrp: 58, stock: 260, weightInGrams: 1000, isDefault: true },
      { label: "2 kg", unit: "KG", price: 90, mrp: 110, stock: 120, weightInGrams: 2000 },
    ],
  },
  {
    name: "Onion", slug: "onion", category: "vegetables", type: "VEGETABLE", featured: true,
    short: "Pungent, firm onions — the base of every Indian dish",
    description: "Well-cured pink onions with low moisture, so they last longer and fry beautifully.",
    images: [IMG.onion, IMG.mixed], tags: ["staple", "everyday"], aliases: ["pyaz", "pyaaz", "kanda", "onions"],
    variants: [
      { label: "1 kg", unit: "KG", price: 38, mrp: 45, stock: 300, weightInGrams: 1000, isDefault: true },
      { label: "2 kg", unit: "KG", price: 72, mrp: 85, stock: 180, weightInGrams: 2000 },
      { label: "5 kg", unit: "KG", price: 170, mrp: 200, stock: 40, weightInGrams: 5000 },
    ],
  },
  {
    name: "Carrot", slug: "carrot", category: "vegetables", type: "VEGETABLE",
    short: "Sweet, crunchy red carrots rich in beta carotene",
    description: "Ooty red carrots, perfect for halwa, salads, juices and pickles.",
    images: [IMG.carrot, IMG.mixed], tags: ["sweet", "juice"], aliases: ["gajar", "gaajar", "carrots"],
    variants: [
      { label: "500 g", unit: "G", price: 30, mrp: 36, stock: 150, weightInGrams: 500, isDefault: true },
      { label: "1 kg", unit: "KG", price: 55, mrp: 65, stock: 120, weightInGrams: 1000 },
    ],
  },
  {
    name: "Capsicum", slug: "capsicum", category: "vegetables", type: "VEGETABLE",
    short: "Thick-walled green shimla mirch for stir fries",
    description: "Crisp capsicum with thick flesh — great for chilli paneer, pizza toppings and dry sabzi.",
    images: [IMG.capsicum, IMG.mixed], tags: ["stir-fry"], aliases: ["shimla mirch", "bhindi mirch", "bell pepper", "pepper"],
    variants: [
      { label: "250 g", unit: "G", price: 24, mrp: 30, stock: 90, weightInGrams: 250, isDefault: true },
      { label: "500 g", unit: "G", price: 45, mrp: 55, stock: 110, weightInGrams: 500 },
    ],
  },
  {
    name: "Cauliflower", slug: "cauliflower", category: "vegetables", type: "VEGETABLE",
    short: "Tight, creamy-white gobi heads",
    description: "Fresh cauliflower with compact florets. Ideal for gobi paratha, manchurian and sabzi.",
    images: [IMG.cauliflower, IMG.mixed], tags: ["winter"], aliases: ["gobi", "phool gobi", "gobhi"],
    variants: [
      { label: "1 piece (~600 g)", unit: "PIECE", price: 42, mrp: 50, stock: 80, weightInGrams: 600, isDefault: true },
    ],
  },
  {
    name: "Cucumber", slug: "cucumber", category: "vegetables", type: "VEGETABLE",
    short: "Cool, hydrating cucumbers for salads and raita",
    description: "Greenhouse cucumbers with thin skin — no bitterness, best for raita and salads.",
    images: [IMG.cucumber, IMG.salad], tags: ["salad", "hydrating"], aliases: ["kheera", "kakdi", "cucumbers"],
    variants: [
      { label: "500 g", unit: "G", price: 22, mrp: 28, stock: 140, weightInGrams: 500, isDefault: true },
      { label: "1 kg", unit: "KG", price: 40, mrp: 50, stock: 90, weightInGrams: 1000 },
    ],
  },
  {
    name: "Broccoli", slug: "broccoli", category: "vegetables", type: "VEGETABLE", featured: true,
    short: "Premium green broccoli florets, washed and trimmed",
    description: "Imported-variety broccoli grown in Pune. Rich in fibre — steam, roast or stir fry.",
    images: [IMG.broccoli, IMG.mixed], tags: ["healthy", "premium"], aliases: ["brocoli", "hari gobi"],
    variants: [
      { label: "250 g", unit: "G", price: 55, mrp: 65, stock: 60, weightInGrams: 250, isDefault: true },
      { label: "500 g", unit: "G", price: 105, mrp: 120, stock: 45, weightInGrams: 500 },
    ],
  },
  {
    name: "Green Peas", slug: "green-peas", category: "vegetables", type: "VEGETABLE",
    short: "Sweet matar, shelled same morning",
    description: "Hand-shelled green peas, naturally sweet. Great for pulao, matar paneer and pav bhaji.",
    images: [IMG.mixed, IMG.mealPrep], tags: ["frozen-alternative", "sweet"], aliases: ["matar", "mutter", "peas"],
    variants: [
      { label: "250 g", unit: "G", price: 32, mrp: 40, stock: 70, weightInGrams: 250, isDefault: true },
      { label: "500 g", unit: "G", price: 60, mrp: 72, stock: 55, weightInGrams: 500 },
    ],
  },
  {
    name: "Ginger", slug: "ginger", category: "vegetables", type: "VEGETABLE",
    short: "Aromatic adrak with high juice content",
    description: "Fresh ginger with a strong aroma — essential for chai, curries and marinades.",
    images: [IMG.onion, IMG.market], tags: ["spice", "masala"], aliases: ["adrak", "ada", "ginger"],
    variants: [
      { label: "250 g", unit: "G", price: 38, mrp: 45, stock: 65, weightInGrams: 250, isDefault: true },
    ],
  },
  {
    name: "Garlic", slug: "garlic", category: "vegetables", type: "VEGETABLE",
    short: "Fat, easy-to-peel lehsun cloves",
    description: "Ooty garlic with large cloves and a pungent bite. Sold as a 250 g pack.",
    images: [IMG.onion, IMG.market], tags: ["spice", "masala"], aliases: ["lehsun", "lasan", "garlic"],
    variants: [{ label: "250 g", unit: "G", price: 42, mrp: 50, stock: 60, weightInGrams: 250, isDefault: true }],
  },
  {
    name: "Spinach", slug: "spinach", category: "leafy-greens", type: "LEAFY_GREENS", featured: true,
    short: "Tender palak leaves, washed twice and trimmed",
    description: "Baby spinach leaves from Mahabaleshwar, triple-washed. Ready for palak paneer or smoothies.",
    images: [IMG.spinach, IMG.greens], tags: ["iron", "healthy"], aliases: ["palak", "paalak", "spinach leaves"],
    variants: [
      { label: "1 bunch (~250 g)", unit: "BUNCH", price: 22, mrp: 28, stock: 110, weightInGrams: 250, isDefault: true },
      { label: "500 g", unit: "G", price: 40, mrp: 48, stock: 60, weightInGrams: 500 },
    ],
  },
  {
    name: "Coriander", slug: "coriander", category: "leafy-greens", type: "LEAFY_GREENS",
    short: "Fragrant dhaniya bunch with roots intact",
    description: "Fresh coriander with roots — keeps for 5+ days when stored wrapped in a cloth bag.",
    images: [IMG.greens, IMG.spinach], tags: ["garnish"], aliases: ["dhaniya", "dhania", "cilantro", "kothmir"],
    variants: [{ label: "1 bunch (~100 g)", unit: "BUNCH", price: 15, mrp: 20, stock: 150, weightInGrams: 100, isDefault: true }],
  },
  {
    name: "Mint", slug: "mint", category: "leafy-greens", type: "LEAFY_GREENS",
    short: "Cool pudina leaves for chutney and drinks",
    description: "Fresh mint leaves, ideal for pudina chutney, mojito and raita.",
    images: [IMG.greens], tags: ["chutney"], aliases: ["pudina", "podina", "mint leaves"],
    variants: [{ label: "1 bunch (~80 g)", unit: "BUNCH", price: 16, mrp: 20, stock: 90, weightInGrams: 80, isDefault: true }],
  },
  {
    name: "Fenugreek Leaves", slug: "fenugreek-leaves", category: "leafy-greens", type: "LEAFY_GREENS",
    short: "Methi leaves with a distinct bittersweet taste",
    description: "Fresh methi from Nashik. Best for methi paratha, thepla and aloo methi.",
    images: [IMG.greens], tags: ["winter"], aliases: ["methi", "methi leaves", "fenugreek"],
    variants: [{ label: "1 bunch (~200 g)", unit: "BUNCH", price: 24, mrp: 30, stock: 70, weightInGrams: 200, isDefault: true }],
  },
  {
    name: "Cut Vegetables Mix", slug: "cut-vegetables-mix", category: "ready-to-cook", type: "READY_TO_COOK", featured: true,
    short: "Diced carrot, beans, peas and potato — sabzi in 10 minutes",
    description: "Washed, peeled and diced in our FSSAI-certified cut kitchen. 10 kg raw vegetables yield 7.5 kg usable prepared mix.",
    images: [IMG.readyToCook, IMG.mealPrep], tags: ["convenience", "no-chopping"],
    aliases: ["mixed veg", "mixed vegetable", "cut veg", "sabzi mix"],
    preparation: ["CUBED", "SLICED", "GRATED"],
    variants: [
      { label: "500 g", unit: "PACKET", price: 89, mrp: 105, stock: 70, weightInGrams: 500, yieldRatio: 0.75, isDefault: true },
      { label: "1 kg", unit: "PACKET", price: 165, mrp: 195, stock: 45, weightInGrams: 1000, yieldRatio: 0.75 },
    ],
  },
  {
    name: "Chopped Onion", slug: "chopped-onion", category: "ready-to-cook", type: "READY_TO_COOK",
    short: "Peeled and diced onions, no tears in the kitchen",
    description: "Uniformly diced onions prepared fresh each morning in our cut kitchen with a 0.82 yield ratio.",
    images: [IMG.readyToCook, IMG.onion], tags: ["convenience", "no-chopping"], aliases: ["cut onion", "diced onion", "kata pyaz"],
    variants: [
      { label: "500 g", unit: "PACKET", price: 55, mrp: 65, stock: 90, weightInGrams: 500, yieldRatio: 0.82, isDefault: true },
    ],
  },
  {
    name: "Diced Tomato", slug: "diced-tomato", category: "ready-to-cook", type: "READY_TO_COOK",
    short: "Ready-to-cook diced tomatoes for instant gravies",
    description: "Firm tomatoes cored and diced, packed in an airtight tray. Great for gravies and pasta sauce.",
    images: [IMG.readyToCook, IMG.tomato], tags: ["convenience"], aliases: ["cut tomato", "tamatar cut"],
    variants: [{ label: "400 g", unit: "PACKET", price: 58, mrp: 70, stock: 65, weightInGrams: 400, yieldRatio: 0.8, isDefault: true }],
  },
  {
    name: "Grated Carrot", slug: "grated-carrot", category: "ready-to-cook", type: "READY_TO_COOK",
    short: "Freshly grated carrot for halwa and salads",
    description: "Grated the same day in our cut kitchen — perfect for gajar halwa, salad and cake batter.",
    images: [IMG.carrot, IMG.readyToCook], tags: ["convenience", "dessert"], aliases: ["gajar grated"],
    variants: [{ label: "400 g", unit: "PACKET", price: 62, mrp: 75, stock: 50, weightInGrams: 400, yieldRatio: 0.85, isDefault: true }],
  },
  {
    name: "Sliced Capsicum", slug: "sliced-capsicum", category: "ready-to-cook", type: "READY_TO_COOK",
    short: "Julienned capsicum for pizza and stir fry",
    description: "De-seeded and sliced capsicum packed fresh. Ready for pizza toppings, noodles and chilli paneer.",
    images: [IMG.capsicum, IMG.readyToCook], tags: ["convenience", "pizza"], aliases: ["cut shimla mirch"],
    variants: [{ label: "250 g", unit: "PACKET", price: 52, mrp: 62, stock: 60, weightInGrams: 250, yieldRatio: 0.88, isDefault: true }],
  },
  {
    name: "Banana", slug: "banana", category: "fruits", type: "FRUIT", featured: true,
    short: "Naturally ripened Yelakki bananas",
    description: "Naturally ripened bananas, no carbide. Sold by weight, roughly 6-7 pieces per kg.",
    images: [IMG.banana, IMG.fruits], tags: ["ripe", "breakfast"], aliases: ["kela", "kele", "bananas"],
    variants: [
      { label: "6 pieces (~800 g)", unit: "PIECE", price: 55, mrp: 66, stock: 120, weightInGrams: 800, isDefault: true },
      { label: "1 kg", unit: "KG", price: 68, mrp: 80, stock: 90, weightInGrams: 1000 },
    ],
  },
  {
    name: "Apple", slug: "apple", category: "fruits", type: "FRUIT", featured: true,
    short: "Crisp Shimla apples, hand-graded",
    description: "Shimla apples graded for size and colour. Stored at 2°C so they stay crisp.",
    images: [IMG.apples, IMG.fruits], tags: ["premium", "snack"], aliases: ["seb", "apple fruit"],
    variants: [
      { label: "4 pieces (~700 g)", unit: "PIECE", price: 165, mrp: 190, stock: 80, weightInGrams: 700, isDefault: true },
      { label: "1 kg", unit: "KG", price: 230, mrp: 265, stock: 60, weightInGrams: 1000 },
    ],
  },
  {
    name: "Mango", slug: "mango", category: "fruits", type: "FRUIT", featured: true,
    short: "Alphonso mangoes, naturally ripened",
    description: "Devgad Alphonso mangoes ripened in hay. Sweet, fibreless pulp.",
    images: [IMG.mango, IMG.fruits], tags: ["seasonal", "premium"], aliases: ["aam", "alphonso", "mangoes"],
    variants: [
      { label: "1 kg (~4 pieces)", unit: "KG", price: 320, mrp: 380, stock: 40, weightInGrams: 1000, isDefault: true },
      { label: "2 kg (~8 pieces)", unit: "KG", price: 610, mrp: 720, stock: 20, weightInGrams: 2000 },
    ],
  },
  {
    name: "Orange", slug: "orange", category: "fruits", type: "FRUIT",
    short: "Juicy Nagpur oranges for fresh juice",
    description: "Nagpur santra with thin skin and high juice yield. Great for juice and salads.",
    images: [IMG.orange, IMG.fruits], tags: ["juice", "vitamin-c"], aliases: ["santra", "narangi", "oranges"],
    variants: [
      { label: "1 kg (~5 pieces)", unit: "KG", price: 135, mrp: 155, stock: 70, weightInGrams: 1000, isDefault: true },
      { label: "2 kg", unit: "KG", price: 255, mrp: 300, stock: 35, weightInGrams: 2000 },
    ],
  },
  {
    name: "Grapes", slug: "grapes", category: "fruits", type: "FRUIT",
    short: "Seedless green grapes, washed and packed",
    description: "Nashik seedless grapes, washed and destemmed. Chill before serving.",
    images: [IMG.grapes, IMG.fruits], tags: ["seedless"], aliases: ["angoor", "draksha", "grape"],
    variants: [
      { label: "500 g", unit: "G", price: 68, mrp: 80, stock: 85, weightInGrams: 500, isDefault: true },
      { label: "1 kg", unit: "KG", price: 130, mrp: 150, stock: 45, weightInGrams: 1000 },
    ],
  },
  {
    name: "Papaya", slug: "papaya", category: "fruits", type: "FRUIT",
    short: "Ripe papaya, perfect for breakfast bowls",
    description: "Sweet, ripe papaya ideal for breakfast and smoothies. Cut-to-order on request.",
    images: [IMG.fruits, IMG.mango], tags: ["breakfast", "digestion"], aliases: ["papita", "papayas"],
    variants: [{ label: "1 piece (~1.2 kg)", unit: "PIECE", price: 95, mrp: 115, stock: 45, weightInGrams: 1200, isDefault: true }],
  },
  {
    name: "Pomegranate", slug: "pomegranate", category: "fruits", type: "FRUIT",
    short: "Ruby-red anar with juicy arils",
    description: "Solan pomegranates with deep red arils and a sweet-tart balance.",
    images: [IMG.fruits, IMG.market], tags: ["premium"], aliases: ["anar", "anaar", "pom"],
    variants: [
      { label: "2 pieces (~600 g)", unit: "PIECE", price: 145, mrp: 170, stock: 40, weightInGrams: 600, isDefault: true },
      { label: "1 kg", unit: "KG", price: 240, mrp: 275, stock: 25, weightInGrams: 1000 },
    ],
  },
  {
    name: "Paneer", slug: "paneer", category: "dairy", type: "DAIRY", featured: true,
    short: "Soft, fresh milk paneer cut to order",
    description: "Made every morning from full-cream milk, no vinegar aftertaste. Sold in vacuum packs.",
    images: [IMG.paneer, IMG.mealPrep], tags: ["protein", "fresh-daily"], aliases: ["cottage cheese", "panir", "panner"],
    variants: [
      { label: "200 g", unit: "PACKET", price: 95, mrp: 110, stock: 60, weightInGrams: 200, isDefault: true },
      { label: "500 g", unit: "PACKET", price: 225, mrp: 255, stock: 35, weightInGrams: 500 },
    ],
  },
  {
    name: "Curd", slug: "curd", category: "dairy", type: "DAIRY",
    short: "Thick set dahi with a mild tang",
    description: "Freshly set curd made from pasteurised milk. Great for raita and lassi.",
    images: [IMG.paneer, IMG.mealPrep], tags: ["probiotic"], aliases: ["dahi", "yogurt", "yoghurt"],
    variants: [
      { label: "400 g", unit: "PACKET", price: 48, mrp: 55, stock: 80, weightInGrams: 400, isDefault: true },
      { label: "1 kg", unit: "PACKET", price: 105, mrp: 120, stock: 40, weightInGrams: 1000 },
    ],
  },
  {
    name: "Salad Mix", slug: "salad-mix", category: "salad", type: "SALAD", featured: true,
    short: "Washed lettuce, cucumber and cherry tomato mix",
    description: "Chlorine-free triple washed salad mix, ready to toss with dressing.",
    images: [IMG.salad, IMG.greekSalad], tags: ["healthy", "washed"], aliases: ["salad greens", "lettuce mix"],
    variants: [
      { label: "250 g", unit: "PACKET", price: 89, mrp: 105, stock: 55, weightInGrams: 250, yieldRatio: 0.9, isDefault: true },
      { label: "500 g", unit: "PACKET", price: 165, mrp: 195, stock: 30, weightInGrams: 500, yieldRatio: 0.9 },
    ],
  },
  {
    name: "Sprouts Salad", slug: "sprouts-salad", category: "salad", type: "SALAD",
    short: "Moong sprout bowl with onion and lemon",
    description: "Protein-rich moong sprouts tossed with onion, tomato and lemon. High-protein breakfast bowl.",
    images: [IMG.greekSalad, IMG.salad], tags: ["protein", "breakfast"], aliases: ["moong salad", "sprout bowl"],
    variants: [{ label: "300 g bowl", unit: "BOX", price: 78, mrp: 90, stock: 40, weightInGrams: 300, isDefault: true }],
  },
  {
    name: "Cucumber Salad Bowl", slug: "cucumber-salad-bowl", category: "salad", type: "SALAD",
    short: "Kheera salad with peanuts and chaat masala",
    description: "Crunchy cucumber salad tossed with roasted peanuts, lemon and chaat masala.",
    images: [IMG.salad, IMG.cucumber], tags: ["side", "chaat"], aliases: ["kheera salad"],
    variants: [{ label: "300 g bowl", unit: "BOX", price: 72, mrp: 85, stock: 35, weightInGrams: 300, isDefault: true }],
  },
];

const ZONES = [
  { pincode: "400058", area: "Andheri West", city: "Mumbai", state: "Maharashtra", deliveryFee: 29, minOrderValue: 99, freeDeliveryThreshold: 499, etaMinutes: 40 },
  { pincode: "400001", area: "Fort", city: "Mumbai", state: "Maharashtra", deliveryFee: 39, minOrderValue: 149, freeDeliveryThreshold: 599, etaMinutes: 55 },
  { pincode: "560034", area: "Koramangala", city: "Bengaluru", state: "Karnataka", deliveryFee: 29, minOrderValue: 99, freeDeliveryThreshold: 449, etaMinutes: 35 },
  { pincode: "560001", area: "MG Road", city: "Bengaluru", state: "Karnataka", deliveryFee: 35, minOrderValue: 129, freeDeliveryThreshold: 549, etaMinutes: 50 },
  { pincode: "110016", area: "Hauz Khas", city: "New Delhi", state: "Delhi", deliveryFee: 25, minOrderValue: 99, freeDeliveryThreshold: 399, etaMinutes: 45 },
];

const COUPONS = [
  { code: "WELCOME50", description: "50% off your first FreshCut order (up to ₹100)", type: "PERCENTAGE" as const, value: 50, minOrderValue: 199, maxDiscount: 100, perUserLimit: 1, usageLimit: 500 },
  { code: "FRESH20", description: "20% off on orders above ₹299", type: "PERCENTAGE" as const, value: 20, minOrderValue: 299, maxDiscount: 150, perUserLimit: 3, usageLimit: null },
  { code: "SAVE100", description: "Flat ₹100 off on orders above ₹799", type: "FIXED" as const, value: 100, minOrderValue: 799, maxDiscount: null, perUserLimit: 2, usageLimit: 200 },
];

const OFFERS = [
  { title: "Fresh Cut Festival", subtitle: "Flat 20% off on all ready-to-cook packs", discountText: "20% OFF", badge: "Most loved", code: "FRESH20", ctaHref: "/ready-to-cook", imageUrl: IMG.readyToCook, description: "Our cut kitchen prepares your sabzi mix, chopped onion and grated carrot every morning. Use FRESH20 at checkout.", sortOrder: 1 },
  { title: "First order? Half price.", subtitle: "50% off up to ₹100 on your first order", discountText: "50% OFF", badge: "New customers", code: "WELCOME50", ctaHref: "/products", imageUrl: IMG.market, description: "Welcome to FreshCut. Use WELCOME50 on your first order above ₹199.", sortOrder: 2 },
  { title: "Big basket, bigger saving", subtitle: "Flat ₹100 off above ₹799", discountText: "₹100 OFF", badge: "Family pack", code: "SAVE100", ctaHref: "/vegetables", imageUrl: IMG.mixed, description: "Stock up your kitchen for the week and save ₹100 instantly.", sortOrder: 3 },
];

const RECIPES = [
  {
    name: "Palak Paneer", slug: "palak-paneer", difficulty: "EASY" as const, prep: 15, cook: 25, servings: 3,
    image: IMG.spinach,
    description: "Silky spinach gravy with soft paneer cubes — a weeknight classic from our cut kitchen.",
    instructions: [
      "Blanch 1 bunch spinach in salted water for 3 minutes, then transfer to cold water.",
      "Grind with green chilli, ginger and garlic into a smooth puree.",
      "Heat ghee, add cumin and onion, sauté until golden.",
      "Add tomato and spices, cook for 5 minutes, then stir in the spinach puree.",
      "Add paneer cubes, simmer 5 minutes and finish with cream.",
    ],
    ingredients: [
      { name: "Spinach", quantity: "1 bunch", slug: "spinach" },
      { name: "Paneer", quantity: "200 g", slug: "paneer" },
      { name: "Onion", quantity: "1 medium", slug: "onion" },
      { name: "Tomato", quantity: "2 medium", slug: "tomato" },
      { name: "Ginger", quantity: "1 inch", slug: "ginger" },
    ],
  },
  {
    name: "Aloo Gobi Masala", slug: "aloo-gobi-masala", difficulty: "MEDIUM" as const, prep: 20, cook: 30, servings: 4,
    image: IMG.potato,
    description: "Dry masala sabzi with crisp potato wedges and cauliflower florets.",
    instructions: [
      "Cut potato into wedges and cauliflower into florets, rinse and pat dry.",
      "Heat oil, add cumin and asafoetida, then add potato and fry 5 minutes.",
      "Add cauliflower, turmeric, coriander powder and salt.",
      "Cover and cook on low heat for 15 minutes, stirring occasionally.",
      "Finish with garam masala, ginger juliennes and fresh coriander.",
    ],
    ingredients: [
      { name: "Potato", quantity: "2 kg pack half", slug: "potato" },
      { name: "Cauliflower", quantity: "1 piece", slug: "cauliflower" },
      { name: "Ginger", quantity: "1 inch", slug: "ginger" },
      { name: "Coriander", quantity: "1/2 bunch", slug: "coriander" },
    ],
  },
  {
    name: "Mumbai Sprout Chaat", slug: "mumbai-sprout-chaat", difficulty: "EASY" as const, prep: 10, cook: 5, servings: 2,
    image: IMG.greekSalad,
    description: "High-protein breakfast chaat with moong sprouts, onion and lemon.",
    instructions: [
      "Steam 1 cup moong sprouts for 5 minutes and cool.",
      "Toss with finely chopped onion, tomato and cucumber.",
      "Add lemon juice, chaat masala, roasted cumin and salt.",
      "Top with crushed peanuts and sev if desired. Serve immediately.",
    ],
    ingredients: [
      { name: "Sprouts Salad", quantity: "1 box", slug: "sprouts-salad" },
      { name: "Onion", quantity: "1 small", slug: "onion" },
      { name: "Tomato", quantity: "1 medium", slug: "tomato" },
      { name: "Cucumber", quantity: "1/2", slug: "cucumber" },
    ],
  },
  {
    name: "Instant Gajar Halwa", slug: "instant-gajar-halwa", difficulty: "EASY" as const, prep: 10, cook: 25, servings: 4,
    image: IMG.carrot,
    description: "Grated carrot halwa in 25 minutes using our cut-kitchen grated carrot.",
    instructions: [
      "Heat 2 tbsp ghee in a pressure cooker and add grated carrot.",
      "Add 500 ml full-fat milk, cardamom and sugar; pressure cook for 2 whistles.",
      "Open and cook on high heat until the milk thickens.",
      "Add khoya or milk powder, mix well and garnish with cashews and raisins.",
    ],
    ingredients: [
      { name: "Grated Carrot", quantity: "400 g pack", slug: "grated-carrot" },
      { name: "Mango", quantity: "1 piece (optional topping)", slug: "mango" },
    ],
  },
];

async function seedUsers() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";
  const customerPassword = process.env.SEED_CUSTOMER_PASSWORD ?? "Demo@12345";
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const customerHash = await bcrypt.hash(customerPassword, 10);

  const admin = await db
    .insert(users)
    .values({
      name: "FreshCut Admin",
      email: "admin@freshcut.local",
      phone: "+919876500011",
      passwordHash: adminHash,
      role: "ADMIN",
    })
    .onConflictDoNothing()
    .returning({ id: users.id });

  const customers = [
    { name: "Kavita Sharma", email: "demo@freshcut.local", phone: "+919812345670" },
    { name: "Rohit Verma", email: "rohit@example.com", phone: "+919812345671" },
    { name: "Anita Desai", email: "anita@example.com", phone: "+919812345672" },
    { name: "Imran Shaikh", email: "imran@example.com", phone: "+919812345673" },
    { name: "Priya Nair", email: "priya@example.com", phone: "+919812345674" },
  ];
  for (const customer of customers) {
    await db
      .insert(users)
      .values({ ...customer, passwordHash: customerHash, role: "CUSTOMER" })
      .onConflictDoNothing();
  }

  const adminRow = admin[0] ?? (await db.select({ id: users.id }).from(users).where(eq(users.email, "admin@freshcut.local")).limit(1))[0];
  return { adminId: adminRow!.id };
}

async function seedAddresses() {
  const customerRows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.role, "CUSTOMER"));
  for (const [index, customer] of customerRows.entries()) {
    const existing = await db
      .select({ id: addresses.id })
      .from(addresses)
      .where(eq(addresses.userId, customer.id))
      .limit(1);
    if (existing[0]) continue;
    const zone = ZONES[index % ZONES.length]!;
    await db.insert(addresses).values({
      userId: customer.id,
      fullName: customer.email === "demo@freshcut.local" ? "Kavita Sharma" : customer.email.split("@")[0]!,
      phone: `+91981234567${index}`,
      line1: `Flat ${101 + index}, Sunrise Residency`,
      street: "12th Cross Road",
      area: zone.area,
      city: zone.city,
      state: zone.state,
      pincode: zone.pincode,
      landmark: "Near metro station",
      type: index % 2 === 0 ? "HOME" : "WORK",
      isDefault: true,
    });
  }
}

async function seedCatalog() {
  for (const category of CATEGORY_SEED) {
    await db.insert(categories).values(category).onConflictDoNothing();
  }
  const categoryRows = await db.select().from(categories);
  const categoryBySlug = new Map(categoryRows.map((c) => [c.slug, c.id]));

  for (const item of PRODUCT_SEED) {
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, item.slug))
      .limit(1);
    if (existing[0]) continue;

    const [product] = await db
      .insert(products)
      .values({
        name: item.name,
        slug: item.slug,
        shortDescription: item.short,
        description: item.description,
        categoryId: categoryBySlug.get(item.category) ?? null,
        productType: item.type,
        images: item.images,
        tags: item.tags,
        aliases: item.aliases,
        preparationTypes: item.preparation ?? [],
        isActive: true,
        isFeatured: Boolean(item.featured),
      })
      .returning();

    for (const [index, variant] of item.variants.entries()) {
      const [inserted] = await db
        .insert(productVariants)
        .values({
          productId: product!.id,
          label: variant.label,
          sku: `${item.slug}-${variant.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          unit: variant.unit,
          weightInGrams: variant.weightInGrams ?? null,
          price: String(variant.price),
          mrp: variant.mrp != null ? String(variant.mrp) : null,
          stock: String(variant.stock),
          yieldRatio: variant.yieldRatio != null ? String(variant.yieldRatio) : null,
          isDefault: Boolean(variant.isDefault) || index === 0,
          sortOrder: index,
        })
        .onConflictDoNothing()
        .returning();
      if (!inserted) continue;
      await db.insert(stockItems).values({
        variantId: inserted.id,
        onHand: String(variant.stock),
        rawQty: item.type === "READY_TO_COOK" ? String(Math.round(variant.stock / (variant.yieldRatio ?? 1))) : String(variant.stock),
        preparedQty: item.type === "READY_TO_COOK" ? String(variant.stock) : "0",
        lowStockThreshold: "8",
        unitCost: String(Math.round(variant.price * 0.62)),
      });
    }
  }
}

async function seedZonesCouponsOffers() {
  for (const zone of ZONES) {
    await db
      .insert(deliveryZones)
      .values({
        ...zone,
        deliveryFee: String(zone.deliveryFee),
        minOrderValue: String(zone.minOrderValue),
        freeDeliveryThreshold: String(zone.freeDeliveryThreshold),
      })
      .onConflictDoNothing();
  }
  for (const coupon of COUPONS) {
    await db
      .insert(coupons)
      .values({
        code: coupon.code,
        description: coupon.description,
        type: coupon.type,
        value: String(coupon.value),
        minOrderValue: String(coupon.minOrderValue),
        maxDiscount: coupon.maxDiscount != null ? String(coupon.maxDiscount) : null,
        startsAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
        expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
        usageLimit: coupon.usageLimit,
        perUserLimit: coupon.perUserLimit,
        isActive: true,
      })
      .onConflictDoNothing();
  }
  for (const offer of OFFERS) {
    const existing = await db
      .select({ id: offers.id })
      .from(offers)
      .where(eq(offers.title, offer.title))
      .limit(1);
    if (existing[0]) continue;
    await db.insert(offers).values({
      ...offer,
      startsAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      expiresAt: new Date(Date.now() + 45 * 24 * 3600 * 1000),
      isActive: true,
    });
  }
}

async function seedRecipes() {
  const productRows = await db.select({ id: products.id, slug: products.slug }).from(products);
  const bySlug = new Map(productRows.map((p) => [p.slug, p.id]));
  for (const recipe of RECIPES) {
    const existing = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.slug, recipe.slug))
      .limit(1);
    if (existing[0]) continue;
    const [inserted] = await db
      .insert(recipes)
      .values({
        name: recipe.name,
        slug: recipe.slug,
        description: recipe.description,
        imageUrl: recipe.image,
        prepMinutes: recipe.prep,
        cookMinutes: recipe.cook,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        instructions: recipe.instructions,
        isActive: true,
      })
      .returning();
    await db.insert(recipeIngredients).values(
      recipe.ingredients.map((ing, index) => ({
        recipeId: inserted!.id,
        name: ing.name,
        quantity: ing.quantity,
        productId: bySlug.get(ing.slug) ?? null,
        sortOrder: index,
      })),
    );
  }
}

const ORDER_STATUSES = [
  "DELIVERED",
  "DELIVERED",
  "DELIVERED",
  "DELIVERED",
  "OUT_FOR_DELIVERY",
  "PACKED",
  "PREPARING",
  "PREPARING",
  "CONFIRMED",
  "CANCELLED",
  "DELIVERED",
  "CONFIRMED",
] as const;

async function seedOrders() {
  const countRows = await db.execute<{ count: number }>(sql`SELECT COUNT(*)::int AS count FROM orders`);
  if (Number(countRows.rows[0]?.count ?? 0) > 0) {
    await syncOrderCounter();
    console.log("• Orders already exist — skipping order seeding (order counter verified).");
    return;
  }

  const customerRows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "CUSTOMER"));
  const productRows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      images: products.images,
    })
    .from(products);
  const variantRows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      label: productVariants.label,
      unit: productVariants.unit,
      price: productVariants.price,
      mrp: productVariants.mrp,
    })
    .from(productVariants)
    .orderBy(asc(productVariants.id));
  const addressRows = await db.select().from(addresses);
  const zoneRows = await db.select().from(deliveryZones);
  if (customerRows.length === 0 || variantRows.length === 0) return;

  // Demo orders use the same SW10001+ sequence as live orders, so we start at
  // 10000 and advance the shared counter at the end of the loop (never overlap).
  let counter = 10000;
  await db.insert(counters).values({ key: "order_number", value: 10000 }).onConflictDoNothing();

  for (const [index, status] of ORDER_STATUSES.entries()) {
    const customer = customerRows[index % customerRows.length]!;
    const address = addressRows.find((a) => a.userId === customer.id) ?? addressRows[0]!;
    const zone = zoneRows.find((z) => z.pincode === address.pincode) ?? zoneRows[0]!;
    const daysAgo = index * 1.5 + 0.2;
    const createdAt = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);

    const picks = [
      variantRows[(index * 3) % variantRows.length]!,
      variantRows[(index * 7 + 5) % variantRows.length]!,
      variantRows[(index * 11 + 9) % variantRows.length]!,
    ];
    const lines = picks.map((variant, lineIndex) => {
      const quantity = lineIndex === 0 ? 2 : 1;
      const unitPrice = Number(variant.price);
      const product = productRows.find((p) => p.id === variant.productId)!;
      return {
        variant,
        product,
        quantity,
        unitPrice,
        unitMrp: variant.mrp ? Number(variant.mrp) : null,
        lineTotal: Math.round(unitPrice * quantity * 100) / 100,
      };
    });
    const subtotal = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
    const discount = index % 4 === 0 ? Math.min(50, subtotal * 0.1) : 0;
    const taxable = subtotal - discount;
    const deliveryFee = taxable >= Number(zone.freeDeliveryThreshold) ? 0 : Number(zone.deliveryFee);
    const tax = Math.round(taxable * 0.05 * 100) / 100;
    const total = Math.round((taxable + deliveryFee + tax) * 100) / 100;
    counter += 1;

    const [order] = await db
      .insert(orders)
      .values({
        orderNumber: `SW${counter}`,
        userId: customer.id,
        status,
        subtotal: String(subtotal),
        discount: String(discount),
        deliveryFee: String(deliveryFee),
        tax: String(tax),
        total: String(total),
        couponCode: discount > 0 ? "FRESH20" : null,
        paymentMethod: index % 3 === 0 ? "UPI" : "COD",
        paymentStatus: status === "DELIVERED" ? "PAID" : "PENDING",
        deliveryZoneId: zone.id,
        deliverySlot: `${zone.etaMinutes} minute express`,
        deliveryAddress: {
          fullName: address.fullName,
          phone: address.phone,
          line1: address.line1,
          street: address.street ?? "",
          area: address.area,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          landmark: address.landmark ?? "",
          type: address.type,
        },
        source: index % 5 === 0 ? "WHATSAPP" : "WEB",
        createdAt,
        updatedAt: createdAt,
        estimatedDeliveryAt: new Date(createdAt.getTime() + zone.etaMinutes * 60 * 1000),
        deliveredAt: status === "DELIVERED" ? new Date(createdAt.getTime() + 40 * 60 * 1000) : null,
        cancelledAt: status === "CANCELLED" ? new Date(createdAt.getTime() + 12 * 60 * 1000) : null,
        cancelReason: status === "CANCELLED" ? "Customer requested cancellation" : null,
      })
      .returning();

    await db.insert(orderItems).values(
      lines.map((line) => ({
        orderId: order!.id,
        variantId: line.variant.id,
        productName: line.product.name,
        productSlug: line.product.slug,
        variantLabel: line.variant.label,
        unit: line.variant.unit,
        imageUrl: (line.product.images ?? [])[0] ?? null,
        quantity: String(line.quantity),
        unitPrice: String(line.unitPrice),
        unitMrp: line.unitMrp != null ? String(line.unitMrp) : null,
        lineTotal: String(line.lineTotal),
      })),
    );

    if (status !== "CANCELLED") {
      for (const line of lines) {
        await adjustStock({
          variantId: line.variant.id,
          type: "SOLD",
          quantity: line.quantity,
          reason: `Seeded order SW${counter}`,
          orderId: order!.id,
          source: "SYSTEM",
        }).catch(() => undefined);
      }
    }

    await db
      .insert(notifications)
      .values({
        userId: customer.id,
        orderId: order!.id,
        type: status === "DELIVERED" ? "ORDER_DELIVERED" : "ORDER_CONFIRMED",
        channel: "WHATSAPP",
        recipient: customer.name,
        status: "SKIPPED",
        error: "WhatsApp Cloud API credentials not configured in this environment.",
        createdAt,
      })
      .onConflictDoNothing();
  }
  await syncOrderCounter();
  console.log(`• Seeded ${ORDER_STATUSES.length} demo orders.`);
}

/** Keeps the public order-number sequence ahead of every existing order. */
async function syncOrderCounter() {
  await db.execute(sql`
    INSERT INTO counters (key, value)
    VALUES ('order_number', COALESCE((SELECT MAX(CAST(SUBSTRING(order_number FROM 3) AS INTEGER)) FROM orders), 10000))
    ON CONFLICT (key) DO UPDATE
    SET value = GREATEST(
      counters.value,
      COALESCE((SELECT MAX(CAST(SUBSTRING(order_number FROM 3) AS INTEGER)) FROM orders), 10000)
    )
  `);
}

async function seedSettingsAndAudit(adminId: number) {
  await db
    .insert(settings)
    .values({
      key: "store",
      value: {
        storeName: "Sabjiwala",
        storePhone: "+912266778899",
        whatsappNumber: process.env.SEED_WHATSAPP_NUMBER ?? "+919876500011",
        supportEmail: "care@freshcut.local",
        minOrderValue: 99,
        freeDeliveryThreshold: 499,
        defaultDeliveryFee: 29,
        taxPercent: 5,
        openingTime: "06:00",
        closingTime: "22:30",
        codEnabled: true,
        notificationsEnabled: true,
        announcement: "Free delivery above ₹499 • Farm fresh cuts delivered in 45 minutes",
      },
    })
    .onConflictDoNothing();

  // Verified admin WhatsApp identity so admin commands can be demonstrated.
  const whatsappNumber = process.env.SEED_WHATSAPP_NUMBER ?? "+919876500011";
  await db
    .insert(whatsappIdentities)
    .values({ phone: whatsappNumber, userId: adminId })
    .onConflictDoNothing();

  const auditCount = await db.execute<{ count: number }>(
    sql`SELECT COUNT(*)::int AS count FROM audit_logs`,
  );
  if (Number(auditCount.rows[0]?.count ?? 0) === 0) {
    await db.insert(auditLogs).values([
      {
        actorUserId: adminId,
        actorLabel: "admin@freshcut.local",
        action: "SEED_COMPLETED",
        resource: "system",
        resourceId: "seed",
        newValue: { products: PRODUCT_SEED.length, orders: ORDER_STATUSES.length },
        source: "SYSTEM",
      },
      {
        actorUserId: adminId,
        actorLabel: "admin@freshcut.local",
        action: "SETTINGS_UPDATED",
        resource: "settings",
        resourceId: "store",
        newValue: { taxPercent: 5, freeDeliveryThreshold: 499 },
        source: "WEB",
      },
    ]);
  }
}

async function main() {
  console.log("🌱 Seeding Sabjiwala / FreshCut demo data...");
  const { adminId } = await seedUsers();
  await seedAddresses();
  await seedCatalog();
  await seedZonesCouponsOffers();
  await seedRecipes();
  await seedOrders();
  await seedSettingsAndAudit(adminId);
  console.log("✅ Seed complete (idempotent — safe to run again).");
  console.log("   Admin:    admin@freshcut.local / Admin@12345  (development demo account)");
  console.log("   Customer: demo@freshcut.local  / Demo@12345");
  await new Promise((resolve) => setTimeout(resolve, 50));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
