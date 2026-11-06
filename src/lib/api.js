import { DEMO } from "./config";
import { demo } from "./demo";
import { live } from "./live";
export const api = DEMO ? demo : live;
