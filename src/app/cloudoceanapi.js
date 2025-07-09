const fetch = require('node-fetch');

const BASE_URL = 'https://api.develop.rve.ca/v1/modules/c667ff46-9730-425e-ad48-1e950691b3f9/measuring-points/71ef9476-3855-4a3f-8fc5-333cfbf9e898/reads';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchCloudOceanReads(start, end, limit = 50, offset = 0, retries = 3) {
  // Input validation
  if (!start || !end) {
    throw new Error('Start and end dates are required');
  }
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = `${BASE_URL}?start=${start}&end=${end}&limit=${limit}&offset=${offset}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Add auth only if needed: 'Authorization': `Bearer ${process.env.API_KEY}`,
        }
      });

      if (!response.ok) {
        throw new Error(`Cloud Ocean API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Cloud Ocean API queried data (page ${Math.floor(offset/limit) + 1}):`, data);
      return data;
      
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt === retries) {
        throw error;
      }
      
      await delay(Math.pow(2, attempt) * 1000);
    }
  }
}

async function fetchAllCloudOceanReads(start, end, limit = 50) {
  let allData = [];
  let offset = 0;
  let hasMore = true;
  let pageCount = 0;

  while (hasMore) {
    try {
      const data = await fetchCloudOceanReads(start, end, limit, offset);
      
      const reads = data.reads || data.data || data;
      
      if (reads && reads.length > 0) {
        allData = [...allData, ...reads];
        offset += limit;
        pageCount++;
        
        hasMore = reads.length === limit;
        
        if (hasMore) {
          await delay(100); // Rate limiting
        }
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error('Error in pagination:', error);
      break;
    }
  }

  console.log(`Fetched ${allData.length} total records across ${pageCount} pages`);
  return allData;
}

module.exports = { 
  fetchCloudOceanReads, 
  fetchAllCloudOceanReads 
};

if (require.main === module) {
  fetchCloudOceanReads('2024-10-16', '2024-11-25')
    .then(console.log)
    .catch(console.error);
}
