import "dotenv/config";
import { db } from "@/db";
import { products, categories, offers, recipes, deliveryZones } from "@/db/schema";
import { sql, eq } from "drizzle-orm";

async function run() {
    const map: Record<string, string> = {
        "/images/hero-basket.jpg": "https://images.pexels.com/photos/1132047/pexels-photo-1132047.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "/images/potato.jpg": "https://images.pexels.com/photos/144248/potatoes-vegetables-erdfrucht-bio-144248.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "/images/cauliflower.jpg": "https://images.pexels.com/photos/821365/pexels-photo-821365.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "/images/cucumber.jpg": "https://images.pexels.com/photos/2329440/pexels-photo-2329440.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "/images/paneer.jpg": "https://images.pexels.com/photos/3756523/pexels-photo-3756523.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "/images/mango.jpg": "https://images.pexels.com/photos/2294471/pexels-photo-2294471.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "/images/orange.jpg": "https://images.pexels.com/photos/207085/pexels-photo-207085.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "/images/capsicum.jpg": "https://images.pexels.com/photos/2893635/pexels-photo-2893635.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "/images/banana.jpg": "https://images.pexels.com/photos/1093952/pexels-photo-1093952.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "/images/ready-to-cook.jpg": "https://images.pexels.com/photos/4113888/pexels-photo-4113888.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
    };

    console.log("Replacing local image paths in database...");
    for (const [local, remote] of Object.entries(map)) {
        await db.execute(sql`UPDATE categories SET image_url = ${remote} WHERE image_url = ${local}`);
        await db.execute(sql`UPDATE offers SET image_url = ${remote} WHERE image_url = ${local}`);
        await db.execute(sql`UPDATE recipes SET image_url = ${remote} WHERE image_url = ${local}`);
    }

    console.log("Fixing product arrays...");
    const allProducts = await db.select({ id: products.id, images: products.images }).from(products);
    for (const p of allProducts) {
        let changed = false;
        const newImages = p.images.map((img: string) => {
            if (map[img]) {
                changed = true;
                return map[img];
            }
            return img;
        });
        if (changed) {
            await db.update(products).set({ images: newImages }).where(eq(products.id, p.id));
        }
    }

    console.log("Deleting old delivery zones...");
    await db.execute(sql`DELETE FROM delivery_zones`);

    console.log("Setting up Patna delivery zones...");
    const patnaZones = [
        { pincode: "800001", area: "Patna GPO", city: "Patna", state: "Bihar", deliveryFee: "29", minOrderValue: "99", freeDeliveryThreshold: "499", etaMinutes: 40 },
        { pincode: "800020", area: "Kankarbagh", city: "Patna", state: "Bihar", deliveryFee: "39", minOrderValue: "149", freeDeliveryThreshold: "599", etaMinutes: 55 },
        { pincode: "800013", area: "Patliputra", city: "Patna", state: "Bihar", deliveryFee: "29", minOrderValue: "99", freeDeliveryThreshold: "449", etaMinutes: 35 },
        { pincode: "800014", area: "Sheikhpura", city: "Patna", state: "Bihar", deliveryFee: "35", minOrderValue: "129", freeDeliveryThreshold: "549", etaMinutes: 50 },
    ];

    await db.insert(deliveryZones).values(patnaZones);

    console.log("Success! Database updated.");
    process.exit(0);
}

run();
