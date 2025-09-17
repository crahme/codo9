import fetch from "node-fetch";

export class CloudOceanService {
  constructor(apiKey) {
    this.apiKey = process.env.API_key;
    this.baseUrl = process.env.CLOUD_OCEAN_BASE_URL; // Replace with actual API base URL
  }

  // Core function to fetch consumption data from the API
  async fetchConsumptionData(startDate, endDate) {
    const url = `${this.baseUrl}/consumption?start=${startDate}&end=${endDate}`;
    const response = await fetch(url, {
      headers: {
        "Access-Token": this.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    // Ensure data is sorted by date ascending
    return data.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * Fetch raw meter readings from Cloud Ocean API
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD
   * @returns {Array} - Array of objects { date, total_kwh }
   */
  async getReads(startDate, endDate) {
    return await this.fetchConsumptionData(startDate, endDate);
  }

  /**
   * Calculate daily CDR from cumulative readings, including days with no charging
   * @param {Array} readings - Array of { date, total_kwh }
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD
   * @returns {Array} - Array of { date, daily_kwh, cumulative_kwh }
   */
  getCDR(readings, startDate, endDate) {
    // Convert readings array to a map for quick lookup
    const readMap = new Map(readings.map(r => [r.date, r.total_kwh]));

    // Helper to get all dates in range
    const allDates = this.fillMissingDays(startDate, endDate);

    let lastValue = 0;
    const result = allDates.map(date => {
      const total = readMap.get(date) ?? lastValue; // Use last known value if no reading
      const daily = total - lastValue; // Compute daily consumption
      lastValue = total;
      return {
        date,
        daily_kwh: daily,
        cumulative_kwh: total,
      };
    });

    return result;
  }

  /**
   * Fill missing dates between startDate and endDate
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD
   * @returns {Array} - Array of date strings
   */
  fillMissingDays(startDate, endDate) {
    const dates = [];
    let current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Fetch CDR report for a given period
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD
   * @returns {Array} - Array of { date, daily_kwh, cumulative_kwh }
   */
  async getCDRReport(startDate, endDate) {
    const readings = await this.getReads(startDate, endDate);
    return this.getCDR(readings, startDate, endDate);
  }
}
