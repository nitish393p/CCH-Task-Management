import { createClient } from "@supabase/supabase-js";
import { CONFIG, CONFIG_ERROR, DEMO } from "./config";
export const supabase = DEMO || CONFIG_ERROR ? null : createClient(CONFIG.url, CONFIG.anon);
