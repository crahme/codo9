import axios from "axios";
import 'dotenv/config';

// Module and measuring point UUIDs
const moduleUuid = "c667ff46-9730-425e-ad48-1e950691b3f9";
const pointUuid = "71ef9476-3855-4a3f-8fc5-333cfbf9e898";

// Create Axios client
const client = axios.create({
  baseURL: process.env.CLOUD_OCEAN_BASE_URL,
  headers: {
    "Access-Token": `Bearer ${process.env.API_Key}`, // raw token from .env
    "Content-Type": "application/json",
    "Accept": "application/json"
  },
});

async function fetchReads() {
  try {
    const res = await client.get(
      `${this.baseURL}/v1/modules/${moduleUuid}/measuring-points/${pointUuid}/reads`,
      {
        params: {
          start: "2024-10-16",
          end: "2024-11-25",
          limit: 50,
          offset: 0,
        },
      }
    );
    console.log("✅ Fetched data:", res.data);
  } catch (err) {
    console.error("❌ Error:", err.response?.status, err.response?.data);
  }
}
fetchReads();
