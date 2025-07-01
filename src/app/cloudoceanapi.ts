// src/app/cloudOceanApi.ts

const BASE_URL = 'https://api.develop.rve.ca/v1/modules/c667ff46-9730-425e-ad48-1e950691b3f9/measuring-points/71ef9476-3855-4a3f-8fc5-333cfbf9e898/reads';

export interface CloudOceanRead {
  // Adjust based on actual API response structure
  id: string;
  value: number;
  timestamp: string;
}

export async function fetchCloudOceanReads(
  start: string,
  end: string,
  limit = 50,
  offset = 0
): Promise<CloudOceanRead[]> {
  const url = `${BASE_URL}?start=${start}&end=${end}&limit=${limit}&offset=${offset}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Cloud Ocean API error: ${response.statusText}`);
  }
  const data = await response.json();
  // Adjust this if the response is wrapped (e.g., data.reads)
  return data as CloudOceanRead[];
}

// Example usage (comment out in production):
 fetchCloudOceanReads('2024-10-16', '2024-11-25').then(console.log).catch(console.error);
