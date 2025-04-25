// Load environment variables from .env file
require('dotenv').config();

const axios = require('axios');

// Fetch the API key from environment variables
const API_Key = process.env.API_Key;

// Ensure the API_Key is available
if (!API_Key) {
  console.error("Error: API_Key is not set in the environment variables.");
  process.exit(1);
}

// Function to fetch billing data
async function fetchBillingData() {
  try {
    // Replace with the actual URL of the third-party API
    const apiUrl = 'https://api.develop.rve.ca/v1/modules/c667ff46-9730-425e-ad48-1e950691b3f9/measuring-points/71ef9476-3855-4a3f-8fc5-333cfbf9e898/reads?start=2024-10-16&end=2024-11-25&limit=50&offset=0'';

    // Make the API request
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Bearer ${API_Key}` // Add the API_Key as a Bearer Token
      }
    });

    // Handle the response
    console.log('Billing Data:', response.data);
  } catch (error) {
    console.error('Error fetching billing data:', error.message);
  }
}

// Call the function to fetch billing data
fetchBillingData();  
