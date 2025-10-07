import dotenv from "dotenv";
dotenv.config();

const logger = {
  info: (...args) => console.log("[INFO]", ...args),
  warn: (...args) => console.warn("[WARN]", ...args),
  error: (...args) => console.error("[ERROR]", ...args),
};

export class CloudOceanService {
  constructor() {
    this.baseUrl = process.env.RVE_API_URL;
    this.headers = {
      'Access-Token':  process.env.RVE_API_KEY,
      'Content-Type': 'application/json'
    };
  }

  async getConsumptionData(startDate, endDate) {
    try {
      const response = await fetch(`${this.baseUrl}/devices`, {
        headers: this.headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch devices: ${response.statusText}`);
      }

      const { devices } = await response.json();
      return { devices };
    } catch (error) {
      logger.error('Failed to get consumption data:', error);
      throw error;
    }
  }

  async getDailyReadings(stationUuid, startDate, endDate) {
    try {
      const dailyReadings = [];
      const currentDate = new Date(startDate);
      const endDateTime = new Date(endDate);

      while (currentDate <= endDateTime) {
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        const [startReading, endReading] = await Promise.all([
          this.getReading(stationUuid, dayStart.toISOString()),
          this.getReading(stationUuid, dayEnd.toISOString())
        ]);

        dailyReadings.push({
          date: currentDate.toISOString().split('T')[0],
          initialReading: startReading.value,
          finalReading: endReading.value,
          consumption: endReading.value - startReading.value
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return dailyReadings;
    } catch (error) {
      logger.error('Failed to get daily readings:', error);
      throw error;
    }
  }

  async getReading(stationUuid, timestamp) {
    try {
      const response = await fetch(
        `${this.baseUrl}/stations/${stationUuid}/reading?timestamp=${timestamp}`,
        {
          headers: this.headers
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to get reading: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        timestamp,
        value: parseFloat(data.reading_value) || 0
      };
    } catch (error) {
      logger.error(`Failed to get reading for ${timestamp}:`, error);
      throw error;
    }
  }
}