import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load .env
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_KEY;
export const bucketName = process.env.SUPABASE_BUCKET;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Supabase URL or Service Key is missing in .env");
}

// Use service role key for admin operations like uploads
export const supabase = createClient(supabaseUrl, supabaseServiceKey);
