import "dotenv/config";
import { updateStoreSettings } from "@/server/settings";

async function run() {
    await updateStoreSettings({
        storePhone: "+91 7632 932 591",
        whatsappNumber: "+91 7632 932 591",
        supportEmail: "mukulgupta763293@gmail.com",
    });
    console.log("Database settings updated to new contact info!");
    process.exit(0);
}
run();
