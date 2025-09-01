import axios from "axios";
import 'dotenv/config';

// Module and measuring point UUIDs
const moduleUuid = "c667ff46-9730-425e-ad48-1e950691b3f9";
const pointUuid = "71ef9476-3855-4a3f-8fc5-333cfbf9e898";

// Create Axios client
const client = axios.create({
  baseURL: process.env.CLOUD_OCEAN_BASE_URL,
  headers: {
    Access-Token: `Bearer ${process.env.API_Key}`, // raw token from .env
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

async function fetchCDR() {
  try {
    const res = await client.get(`/v1/modules/${moduleUuid}/measuring-points/${pointUuid}/cdr`);
    console.log("✅ Fetched data:", res.data);
  } catch (err) {
    console.error(err.response?.status, err.response?.data);
  }
}

fetchCDR();
