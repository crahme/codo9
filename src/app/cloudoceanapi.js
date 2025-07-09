const fetch = require('node-fetch'); // Add if not already imported

const BASE_URL = 'https://api.develop.rve.ca/v1/modules/c667ff46-9730-425e-ad48-1e950691b3f9/measuring-points/71ef9476-3855-4a3f-8fc5-333cfbf9e898/reads';

async function fetchCloudOceanReads(start, end, limit = 50, offset = 0) {
  try {
    const url = `${BASE_URL}?start=${start}&end=${end}&limit=${limit}&offset=${offset}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.API_KEY}`, // Add auth if needed
        'Content-Type': 'application/json',
        // Add any other required headers
      }
    });

    if (!response.ok) {
      throw new Error(`Cloud Ocean API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Cloud Ocean API queried data:', data);
    
    // Return the data (adjust based on actual API response structure)
    return data;
    
  } catch (error) {
    console.error('Error fetching Cloud Ocean reads:', error);
    throw error; // Re-throw to handle upstream
  }
}

// Function to fetch all data with pagination
async function fetchAllCloudOceanReads(start, end, limit = 50) {
  let allData = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const data = await fetchCloudOceanReads(start, end, limit, offset);
      
      // Adjust based on your API response structure
      const reads = data.reads || data.data || data; // Common patterns
      
      if (reads && reads.length > 0) {
        allData = [...allData, ...reads];
        offset += limit;
        
        // Check if we got fewer results than requested (indicating last page)
        hasMore = reads.length === limit;
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error('Error in pagination:', error);
      break; // Exit loop on error
    }
  }

  return allData;
}

// Only use CommonJS export (remove ES6 export)
module.exports = { 
  fetchCloudOceanReads, 
  fetchAllCloudOceanReads 
};

// Remove or conditionally execute example usage
if (require.main === module) {
  // Only run if this file is executed directly (not imported)
  fetchCloudOceanReads('2024-10-16', '2024-11-25')
    .then(console.log)
    .catch(console.error);
}
