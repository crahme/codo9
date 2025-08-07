// Build the URL with query parameters
const moduleUuid = "c667ff46-9730-425e-ad48-1e950691b3f9";
const measuringPointUuid = "71ef9476-3855-4a3f-8fc5-333cfbf9e898";
const BASE_URL = `https://api.develop.rve.ca/v1/modules/${moduleUuid}/measuring-points/${measuringPointUuid}/reads`;

const url = new URL(BASE_URL);
url.searchParams.append('start', '2024-10-16');
url.searchParams.append('end', '2024-11-25');
url.searchParams.append('limit', 50);
url.searchParams.append('offset', 0);

// Use your API Key from environment variable
const apiKey = process.env.API_KEY; // or CLOUD_OCEAN_API_KEY if that's your env var

fetch(url.toString(), {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
})
  .then(response => {
    if (!response.ok) throw new Error(`Cloud Ocean API error: ${response.statusText}`);
    return response.json();
  })
  .then(data => console.log(data))
  .catch(err => console.error(err));
