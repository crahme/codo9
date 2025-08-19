import { Sequelize, Model, DataTypes } from 'sequelize';
const databaseUrl = process.env.NETLIFY_DATABASE_URL || 'sqlite:./invoices.db';

const sequelize = new Sequelize(databaseUrl, {
  dialect: databaseUrl.includes('postgres') ? 'postgres' : 'sqlite',
  logging: false
});

// Define the ConsumptionRecord model if not imported from elsewhere
class ConsumptionRecord extends Model {}
ConsumptionRecord.init({
  device_id: DataTypes.INTEGER,
  time_stamp: DataTypes.DATE,
  kwh_consumption: DataTypes.DOUBLE,
  rate: DataTypes.DOUBLE
}, { sequelize, modelName: 'ConsumptionRecord', timestamps: false });

// Import or define CloudOceanAPI as needed
// const CloudOceanAPI = require('path-to-your-cloudoceanapi');
const CloudOceanAPI = require('../../services/cloudoceanapi'); // Adjust path as needed

exports.handler = async function(event, context) {
  const cloudOcean = new CloudOceanAPI();

  try {
    const moduleUuid = 'c667ff46-9730-425e-ad48-1e950691b3f9';
    const pointUuid = '71ef9476-3855-4a3f-8fc5-333cfbf9e898';
    const startDate = new Date(Date.now() - 86400 * 1000 * 30);
    const endDate = new Date();

    const reads = await cloudOcean.getMeasuringPointReads(moduleUuid, pointUuid, startDate, endDate);

    await sequelize.sync();

    for (const read of reads) {
      await ConsumptionRecord.create({
        device_id: read.device_id || 1,
        time_stamp: read.timestamp ? new Date(read.timestamp) : new Date(),
        kwh_consumption: parseFloat(read.consumption) || 0,
        rate: parseFloat(read.rate) || 0
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, count: reads.length })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};